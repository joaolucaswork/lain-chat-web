/**
 * Orquestração de um turno do chat: recall+grafo → LLM+tools → persist → remember.
 *
 * `runTurn` é o lifecycle compartilhado entre POST /api/chat e /api/chat/retry
 * (antes o bloco de catch/abort existia duplicado nos dois handlers).
 */
import { abortCtrls } from './sessions.ts';
import type { Session } from './sessions.ts';
import { broadcast } from './sse.ts';
import { buildMemoryBlock, getSaoPauloToday, queryGraph, recallMemories, rememberTurn } from './memory.ts';
import { MEM_TOOLS, callLlmStreamWithRetry, execLlmTool } from './llm.ts';
import { maybeGenerateTitle } from './titles.ts';
import { persistSession } from './sessions.ts';

export async function processMessage(session: Session, userMessage: string, signal?: AbortSignal): Promise<void> {
  // 1. Hybrid paralelo: recall (vetor) + grafo. Grafo é best-effort, nunca bloqueia.
  const [hits, graphMd] = await Promise.all([recallMemories(userMessage), queryGraph(userMessage)]);
  if (signal?.aborted) return;
  const memBlock = buildMemoryBlock(hits, graphMd);
  const byScope = new Map<string, number>();
  for (const h of hits) byScope.set(h.project ?? '?', (byScope.get(h.project ?? '?') ?? 0) + 1);
  console.log(`[bff] memblock: ${hits.length} hits${graphMd ? ' +graph' : ''}` +
    (hits.length ? ` scopes=[${[...byScope.entries()].map(([s, n]) => `${s}:${n}`).join(',')}]` : ''));

  // 2. Monta contexto: system + memórias + histórico recente (sem acumular no session)
  // Data de hoje vai sempre — mesmo com recall vazio — para o LLM resolver "hoje/ontem".
  const history = session.messages.filter(m => m.role !== 'system').slice(-20);
  const today = getSaoPauloToday();
  const apiMessages: Array<Record<string, unknown>> = [
    session.messages[0] as unknown as Record<string, unknown>,
    ...(memBlock
      ? [{ role: 'system', content: `Contexto da memória de longo prazo (use quando relevante):\n${memBlock}` }]
      : [{ role: 'system', content: `Data de hoje: ${today.long} (${today.iso}, America/Sao_Paulo), hora: ${today.time}. Use para resolver "hoje/ontem", o dia da semana e "agora/há pouco" na conversa; relativos em memórias futuras resolvem pela data da tag.` }]),
    ...(history as unknown as Array<Record<string, unknown>>),
  ];

  // 3. Loop de tools (máx 3 turnos) com stream do texto
  let streamed = false;
  let finalText = '';
  for (let turn = 0; turn < 3; turn++) {
    const { content, toolCalls } = await callLlmStreamWithRetry(apiMessages, session.model, MEM_TOOLS, (token) => {
      streamed = true;
      broadcast(session.id, 'token', { text: token });
    }, signal);
    if (toolCalls.length === 0) { finalText = content; break; }
    finalText = content; // normalmente vazio quando há tool calls
    apiMessages.push({
      role: 'assistant', content: content || null,
      tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } })),
    });
    for (const tc of toolCalls) {
      if (signal?.aborted) throw new Error('STOPPED');
      const result = await execLlmTool(tc);
      apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }

  // 4. Persiste só o texto final + finaliza (protocolo do frontend: token_end fecha o balão)
  if (!finalText.trim()) {
    broadcast(session.id, 'server_error', { message: 'O modelo esgotou as tentativas sem responder. Tente reformular a pergunta.' });
    broadcast(session.id, 'done', {});
    return; // sem remember de resposta vazia
  }
  session.messages.push({ role: 'assistant', content: finalText });
  persistSession(session);
  maybeGenerateTitle(session);
  broadcast(session.id, 'token_end', { text: streamed ? '' : finalText });
  broadcast(session.id, 'done', {});

  // 5. Remember em background
  rememberTurn(userMessage, finalText);
}

/** Erro técnico → mensagem amigável para a UI. */
export function friendlyChatError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw === 'EMPTY_LLM_RESPONSE') {
    return 'O modelo voltou vazio agora (falha transitória do provedor). Tente enviar de novo ou reformule a pergunta.';
  }
  if (raw.startsWith('LLM stream error')) {
    return 'O provedor do modelo falhou no meio da resposta. Tente de novo em alguns segundos.';
  }
  return raw;
}

/** Lifecycle de um turno: processing_start → processMessage → erro/done. */
export function runTurn(sessionId: string, session: Session, userMessage: string): void {
  broadcast(sessionId, 'processing_start', { model: session.model });
  const abortCtrl = new AbortController();
  abortCtrls.set(sessionId, abortCtrl);
  processMessage(session, userMessage, abortCtrl.signal).catch(err => {
    if (err instanceof Error && (err.message === 'STOPPED' || abortCtrl.signal.aborted)) {
      broadcast(sessionId, 'token_end', { text: '' });
    } else {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[bff] chat failed (session=${sessionId}):`, raw);
      broadcast(sessionId, 'server_error', { message: friendlyChatError(err) });
    }
    broadcast(sessionId, 'done', {});
  }).finally(() => abortCtrls.delete(sessionId));
}
