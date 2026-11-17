/** Rotas de chat: SSE, envio, retry, stop, histórico e clear. */
import { randomUUID } from 'node:crypto';
import { abortCtrls, getSession, persistSession, sessions } from '../lib/sessions.ts';
import { addSseClient, broadcast, removeSseClient } from '../lib/sse.ts';
import { json, sseMsg, withSecurityHeaders } from '../lib/http.ts';
import { runTurn } from '../lib/chat.ts';

export async function handleChat(req: Request, path: string, params: URLSearchParams): Promise<Response | null> {
  // ── SSE ──
  if (req.method === 'GET' && path === '/api/chat') {
    const sessionId = params.get('sessionId') || randomUUID();
    getSession(sessionId);
    let ctrl!: ReadableStreamDefaultController<string>;
    const stream = new ReadableStream<string>({
      start(c) {
        ctrl = c;
        addSseClient(sessionId, c);
        c.enqueue(sseMsg('connected', { sessionId }));
        const keepalive = setInterval(() => {
          try { c.enqueue(sseMsg('ping', {})); } catch { clearInterval(keepalive); }
        }, 10_000);
        (c as any)._keepalive = keepalive;
      },
      cancel() {
        removeSseClient(sessionId, ctrl);
        clearInterval((ctrl as any)._keepalive);
      },
    });
    return withSecurityHeaders(new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } }));
  }

  // ── Send message ──
  if (req.method === 'POST' && path === '/api/chat') {
    const sessionId = params.get('sessionId') || randomUUID();
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    const message = ((body.message || '') as string).trim();
    if (!message) return json({ error: 'Message is required' }, 400);

    const session = getSession(sessionId);
    if (typeof body.model === 'string' && body.model) session.model = body.model;

    session.messages.push({ role: 'user', content: message });
    persistSession(session);
    broadcast(sessionId, 'user_message', { text: message });
    runTurn(sessionId, session, message);

    return json({ sessionId });
  }

  // ── Retry last turn ──
  // Re-executa o LLM para a última mensagem do usuário SEM duplicá-la
  // no histórico (o POST /api/chat normal sempre faz push de user).
  // Usado pelo botão "Tentar de novo" após server_error.
  if (req.method === 'POST' && path === '/api/chat/retry') {
    const sessionId = params.get('sessionId');
    if (!sessionId) return json({ error: 'sessionId required' }, 400);
    const session = sessions.get(sessionId);
    if (!session) return json({ error: 'session not found' }, 404);
    if (abortCtrls.has(sessionId)) return json({ error: 'already processing' }, 409);
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* corpo opcional (só model) */ }
    if (typeof body.model === 'string' && body.model) session.model = body.model;
    // Última mensagem do usuário no histórico persistido
    let lastUser = -1;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.role === 'user' && m.content?.trim()) { lastUser = i; break; }
    }
    if (lastUser === -1) return json({ error: 'no user message to retry' }, 400);
    // Descarta respostas de tentativas anteriores (regenerar não empilha
    // assistants; turno falho não tem nada após o user — no-op).
    if (lastUser < session.messages.length - 1) {
      session.messages = session.messages.slice(0, lastUser + 1);
      persistSession(session);
    }
    runTurn(sessionId, session, session.messages[lastUser].content as string);
    return json({ sessionId, retried: true });
  }

  // ── Stop ──
  if (req.method === 'POST' && path === '/api/chat/stop') {
    const sessionId = params.get('sessionId');
    if (!sessionId) return json({ error: 'sessionId required' }, 400);
    abortCtrls.get(sessionId)?.abort();
    abortCtrls.delete(sessionId);
    return json({ ok: true });
  }

  // ── History ──
  if (req.method === 'GET' && path === '/api/history') {
    const sessionId = params.get('sessionId');
    if (!sessionId) return json({ error: 'sessionId required' }, 400);
    const s = getSession(sessionId);
    return json({ messages: s.messages });
  }

  // ── Clear ──
  // Limpa as mensagens da sessão atual SEM remover a sessão da lista,
  // para o histórico continuar acessível. "New conversation" no frontend
  // nem chama mais isso — só troca para um id novo preservando a antiga.
  if (req.method === 'POST' && path === '/api/clear') {
    const sessionId = params.get('sessionId');
    if (sessionId) {
      const s = sessions.get(sessionId);
      if (s) {
        s.messages = [s.messages[0]];
        persistSession(s);
      }
    }
    return json({ ok: true });
  }

  return null;
}
