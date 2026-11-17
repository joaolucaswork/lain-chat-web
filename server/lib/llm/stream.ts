/** Transporte stream OpenAI-compatible + retry de vazios transitórios. */
import { CHAT_TEMPERATURE, LLM_BASE, getLlmKey } from '../../config.ts';
import type { LlmToolCall } from './tools.ts';

export function extractStreamText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return joinBlocks(node);
  return '';
}

function joinBlocks(blocks: unknown[]): string {
  // Blocos tipo [{type:'text',text:'...'}] (alguns providers via OpenRouter)
  return blocks.map((b) => {
    if (typeof b === 'string') return b;
    if (b && typeof (b as { text?: unknown }).text === 'string') return (b as { text: string }).text;
    if (b && typeof (b as { content?: unknown }).content === 'string') return (b as { content: string }).content;
    return '';
  }).join('');
}

interface StreamAcc {
  content: string;
  reasoningChars: number;
  streamError: string | null;
  lastRaw: string;
  streamDone: boolean;
  finishReasons: string[];
  toolParts: Map<number, { id: string; name: string; args: string }>;
}

function newAcc(): StreamAcc {
  return { content: '', reasoningChars: 0, streamError: null, lastRaw: '', streamDone: false, finishReasons: [], toolParts: new Map() };
}

function applyDelta(delta: any, acc: StreamAcc, onToken: (t: string) => void): void {
  const reasoning =
    (typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '') +
    (typeof delta.reasoning === 'string' ? delta.reasoning : '');
  if (reasoning) acc.reasoningChars += reasoning.length;
  const text = extractStreamText(delta.content ?? delta.text);
  if (text) {
    acc.content += text;
    onToken(text);
  }
  for (const tc of (delta?.tool_calls ?? []) as Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>) {
    const part = acc.toolParts.get(tc.index ?? 0) ?? { id: '', name: '', args: '' };
    if (tc.id) part.id += tc.id;
    if (tc.function?.name) part.name += tc.function.name;
    if (tc.function?.arguments) part.args += tc.function.arguments;
    acc.toolParts.set(tc.index ?? 0, part);
  }
}

function consumeLine(line: string, acc: StreamAcc, onToken: (t: string) => void): void {
  const t = line.trim();
  if (!t || !t.startsWith('data:')) return;
  const data = t.slice(5).trim();
  if (data === '[DONE]') {
    acc.streamDone = true;
    return;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }
  // OpenRouter pode entregar erro no meio do stream (ex provider indisponível)
  if (parsed?.error) {
    const msg = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? JSON.stringify(parsed.error));
    acc.streamError = String(msg).slice(0, 500);
    return;
  }
  const choice = parsed?.choices?.[0];
  if (!choice) return;
  if (choice.finish_reason) acc.finishReasons.push(String(choice.finish_reason));
  if (choice.native_finish_reason && choice.native_finish_reason !== choice.finish_reason) {
    acc.finishReasons.push(`native:${choice.native_finish_reason}`);
  }
  applyDelta(choice.delta ?? choice.message ?? {}, acc, onToken);
  acc.lastRaw = data.slice(0, 300);
}

function buildAbort(ctrl: AbortController, signal?: AbortSignal): () => void {
  const timer = setTimeout(() => ctrl.abort(new Error('LLM_TIMEOUT')), 120_000);
  if (signal) {
    if (signal.aborted) ctrl.abort((signal as any).reason ?? new Error('STOPPED'));
    else signal.addEventListener('abort', () => ctrl.abort((signal as any).reason ?? new Error('STOPPED')), { once: true });
  }
  return () => clearTimeout(timer);
}

function isOpenRouter(): boolean {
  try {
    return new URL(LLM_BASE).hostname.endsWith('openrouter.ai');
  } catch {
    return false;
  }
}

export async function callLlmStream(
  messages: Array<Record<string, unknown>>,
  model: string,
  tools: Array<Record<string, unknown>>,
  onToken: (t: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; toolCalls: LlmToolCall[] }> {
  const llmKey = getLlmKey();
  if (!llmKey) throw new Error('LLM key not set (configure em Settings ou via OPENROUTER_API_KEY)');
  // Timeout próprio por turno (120s): stream travado não pode prender o chat.
  // Combina com o abort do usuário (/stop).
  const ctrl = new AbortController();
  const clearTimer = buildAbort(ctrl, signal);
  let res: Response;
  try {
    res = await fetch(`${LLM_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmKey}`,
        ...(isOpenRouter() ? { 'HTTP-Referer': 'https://github.com/joaolucaswork/lain-chat-web', 'X-Title': 'Lain Chat' } : {}),
      },
      body: JSON.stringify({
        model, messages, temperature: CHAT_TEMPERATURE, max_tokens: 4096, stream: true,
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimer();
    if (err instanceof Error && err.message === 'LLM_TIMEOUT') throw new Error('LLM timeout (120s por turno)');
    throw err;
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    clearTimer();
    throw new Error(`LLM ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    clearTimer();
    throw new Error('No response body');
  }
  const acc = newAcc();
  try {
    await pumpStream(reader, acc, ctrl, signal, onToken);
  } finally {
    clearTimer();
    try {
      await reader.cancel();
    } catch { /* já fechado */ }
  }
  const toolCalls = [...acc.toolParts.values()]
    .filter(p => p.id && p.name)
    .map(p => ({ id: p.id, name: p.name, args: p.args }));
  if (acc.streamError && !acc.content && toolCalls.length === 0) {
    throw new Error(`LLM stream error: ${acc.streamError}`);
  }
  if (!acc.content && toolCalls.length === 0) {
    console.error(`[bff] empty LLM response (model=${model} finish=[${acc.finishReasons.join(',')}] reasoningChars=${acc.reasoningChars} last=${acc.lastRaw})`);
    throw new Error('EMPTY_LLM_RESPONSE');
  }
  return { content: acc.content, toolCalls };
}

async function pumpStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  acc: StreamAcc,
  ctrl: AbortController,
  signal: AbortSignal | undefined,
  onToken: (t: string) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (!acc.streamDone) {
    if (ctrl.signal.aborted) {
      throw new Error(signal?.aborted ? 'STOPPED' : 'LLM timeout (120s por turno)');
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) consumeLine(line, acc, onToken);
  }
}

/** Retry curto p/ respostas vazias transitórias (thinking models via OpenRouter às vezes voltam vazios). */
export async function callLlmStreamWithRetry(
  messages: Array<Record<string, unknown>>,
  model: string,
  tools: Array<Record<string, unknown>>,
  onToken: (t: string) => void,
  signal?: AbortSignal,
  attempts = 2,
): Promise<{ content: string; toolCalls: LlmToolCall[] }> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw new Error('STOPPED');
    // Tokens já streamados pertencem à tentativa falha — avisa a UI para descartar o balão vazio.
    // (processMessage só faz broadcast de token em tentativas com conteúdo, então retry é seguro.)
    try {
      return await callLlmStream(messages, model, tools, onToken, signal);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'STOPPED' || msg === 'LLM timeout (120s por turno)') throw err;
      const retryable = msg === 'EMPTY_LLM_RESPONSE' || msg.startsWith('LLM stream error') || msg.startsWith('LLM 5');
      if (!retryable || i === attempts - 1) throw err;
      console.warn(`[bff] LLM empty/transient (tentativa ${i + 1}/${attempts}), retrying...`);
      await new Promise(r => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('EMPTY_LLM_RESPONSE');
}
