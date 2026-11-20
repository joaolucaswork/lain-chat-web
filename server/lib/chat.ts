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
import { persistSession, sessionKey, streamKey } from './sessions.ts';
import { personContext, resolveTenantProfile } from './profile.ts';
import { SYSTEM_PROMPT } from '../config.ts';

export interface TurnToday {
  iso: string;
  long: string;
  time: string;
}

export interface TurnHistoryItem {
  role: string;
  content: string | null;
}

/**
 * Monta as mensagens da API com prefixo estável para prompt caching:
 * - Mensagem 0 (`role: 'system'` único e estável): baseSystem + (who ? `\n\n${who}`).
 *   Sem hora nem memórias → byte-idêntico durante toda a sessão.
 * - Mensagens 1..N-1 (`priorHistory`): history.slice(0, -1). Estável turno a turno.
 * - Última mensagem (`currentTurn`, efêmera — nunca gravada em session.messages):
 *   bloco efêmero do turno (`turnContext`) injetado antes do texto do usuário.
 * Sem mutar `session.messages` em nenhum momento.
 */
export function buildApiMessages(opts: {
  baseSystem: string;
  who: string | null;
  memBlock: string;
  today: TurnToday;
  history: TurnHistoryItem[];
}): Array<Record<string, unknown>> {
  const { baseSystem, who, memBlock, today, history } = opts;
  const stableContent = who ? `${baseSystem}\n\n${who}` : baseSystem;
  const stable: Record<string, unknown> = { role: 'system', content: stableContent };
  if (history.length === 0) return [stable];
  const priorHistory = history.slice(0, -1) as unknown as Array<Record<string, unknown>>;
  const currentTurn = history[history.length - 1];
  const turnContext = memBlock
    ? `Contexto da memória de longo prazo (use quando relevante):\n${memBlock}`
    : `Data de hoje: ${today.long} (${today.iso}, America/Sao_Paulo), hora: ${today.time}. Use para resolver "hoje/ontem", o dia da semana e "agora/há pouco" na conversa; relativos em memórias futuras resolvem pela data da tag.`;
  if (currentTurn.role === 'user') {
    const wrapped: Record<string, unknown> = {
      role: 'user',
      content: `<turn_context>\n${turnContext}\n</turn_context>\n\n${currentTurn.content ?? ''}`,
    };
    return [stable, ...priorHistory, wrapped];
  }
  return [stable, ...priorHistory, { ...currentTurn } as unknown as Record<string, unknown>];
}

export async function processMessage(session: Session, userMessage: string, signal?: AbortSignal, memKey?: string): Promise<void> {
  // 1. Hybrid paralelo: recall (vetor) + grafo + perfil. Grafo/perfil são
  // best-effort, nunca bloqueiam. Latência efetiva do perfil = zero quando
  // já em cache, mascarada pelo recall no 1º miss.
  const [hits, graphMd, profileName] = await Promise.all([
    recallMemories(userMessage, memKey),
    queryGraph(userMessage, memKey),
    resolveTenantProfile(session.owner, memKey),
  ]);
  if (signal?.aborted) return;
  const stream = streamKey(session);
  const memBlock = buildMemoryBlock(hits, graphMd);
  const byScope = new Map<string, number>();
  for (const h of hits) byScope.set(h.project ?? '?', (byScope.get(h.project ?? '?') ?? 0) + 1);
  console.log(`[bff] memblock: ${hits.length} hits${graphMd ? ' +graph' : ''}` +
    (hits.length ? ` scopes=[${[...byScope.entries()].map(([s, n]) => `${s}:${n}`).join(',')}]` : ''));

  // 2. Monta contexto com prefixo estável (system + perfil + histórico) para
  // prompt caching; contexto dinâmico (memórias/hora) vai só no turno atual,
  // efêmero — nunca persiste na sessão nem nas memórias.
  // Nome do visitante (best-effort): entra CITADO como dado no system estável.
  const history = session.messages.filter(m => m.role !== 'system').slice(-20);
  const today = getSaoPauloToday();
  const who = personContext(profileName);
  const baseSystem = (typeof session.messages[0]?.content === 'string' && session.messages[0].content
    ? session.messages[0].content
    : SYSTEM_PROMPT) as string;
  const apiMessages: Array<Record<string, unknown>> = buildApiMessages({
    baseSystem,
    who,
    memBlock,
    today,
    history: history as unknown as TurnHistoryItem[],
  });

  // 3. Loop de tools (máx 3 turnos) com stream do texto
  let streamed = false;
  let finalText = '';
  for (let turn = 0; turn < 3; turn++) {
    const { content, toolCalls } = await callLlmStreamWithRetry(apiMessages, session.model, MEM_TOOLS, (token) => {
      streamed = true;
      broadcast(stream, 'token', { text: token });
    }, signal);
    if (toolCalls.length === 0) { finalText = content; break; }
    finalText = content; // normalmente vazio quando há tool calls
    apiMessages.push({
      role: 'assistant', content: content || null,
      tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.args } })),
    });
    for (const tc of toolCalls) {
      if (signal?.aborted) throw new Error('STOPPED');
      const result = await execLlmTool(tc, memKey);
      apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }

  // 4. Persiste só o texto final + finaliza (protocolo do frontend: token_end fecha o balão)
  if (!finalText.trim()) {
    broadcast(stream, 'server_error', { message: 'O modelo esgotou as tentativas sem responder. Tente reformular a pergunta.' });
    broadcast(stream, 'done', {});
    return; // sem remember de resposta vazia
  }
  session.messages.push({ role: 'assistant', content: finalText });
  await persistSession(session);
  maybeGenerateTitle(session);
  broadcast(stream, 'token_end', { text: streamed ? '' : finalText });
  broadcast(stream, 'done', {});

  // 5. Remember em background (só o texto limpo do usuário — sem <turn_context>)
  rememberTurn(userMessage, finalText, memKey);
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
export function runTurn(sessionId: string, session: Session, userMessage: string, memKey?: string): void {
  const stream = streamKey(session);
  broadcast(stream, 'processing_start', { model: session.model });
  const abortCtrl = new AbortController();
  abortCtrls.set(sessionKey(session.owner, sessionId), abortCtrl);
  processMessage(session, userMessage, abortCtrl.signal, memKey).catch(err => {
    if (err instanceof Error && (err.message === 'STOPPED' || abortCtrl.signal.aborted)) {
      broadcast(stream, 'token_end', { text: '' });
    } else {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[bff] chat failed (session=${sessionId}):`, raw);
      broadcast(stream, 'server_error', { message: friendlyChatError(err) });
    }
    broadcast(stream, 'done', {});
  }).finally(() => abortCtrls.delete(sessionKey(session.owner, sessionId)));
}
