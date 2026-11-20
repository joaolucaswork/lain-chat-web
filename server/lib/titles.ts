/** Títulos de sessão gerados via LLM a partir dos primeiros turnos. */
import { DEFAULT_MODEL, LLM_BASE, getLlmKey } from '../config.ts';
import { findSession, persistSession, sessionKey } from './sessions.ts';
import type { Session } from './sessions.ts';

const titleGenInFlight = new Set<string>();

export function sanitizeTitle(raw: string): string {
  let t = (raw || '').trim().replace(/^["'«»“”]+|["'«»“”.,;:!?…]+$/g, '').trim();
  t = t.replace(/\s+/g, ' ');
  if (t.length > 60) t = t.slice(0, 60).trimEnd();
  return t;
}

/** Gera título curto via LLM a partir dos primeiros turnos (user+assistant). Fire-and-forget. */
export function maybeGenerateTitle(session: Session): void {
  const key = sessionKey(session.owner, session.id);
  if (session.title || titleGenInFlight.has(key)) return;
  const convo = session.messages.filter(m => m.role !== 'system' && m.content?.trim()).slice(0, 4);
  if (convo.length < 2) return; // precisa de ao menos 1 ida + 1 volta
  const llmKey = getLlmKey();
  if (!llmKey) return;
  titleGenInFlight.add(key);
  const buildExcerpt = (n: number, chars: number) =>
    convo
      .slice(0, n)
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n')
      .slice(0, chars);
  const tryOnce = async (excerpt: string): Promise<string> => {
    const res = await fetch(`${LLM_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmKey}`,
      },
      body: JSON.stringify({
        model: session.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'Você gera títulos curtos para conversas. Responda APENAS com o título, sem aspas, sem ponto final, máximo 40 caracteres, em português, capturando o tema central da conversa.' },
          { role: 'user', content: excerpt },
        ],
        temperature: 0.3,
        // reasoning.minimal+exclude: GLM gasta tokens com `reasoning` interno
        // e o título vinha vazio (finish=length, content=null). Excluído o
        // reasoning, 60 tokens bastam para o título.
        max_tokens: 60,
        reasoning: { effort: 'minimal', exclude: true },
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json() as any;
    const raw: string =
      data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.delta?.content ?? '';
    return sanitizeTitle(typeof raw === 'string' ? raw : '');
  };
  void (async () => {
    try {
      // Tentativa 1: 4 turnos / 800 chars. Retry: 2 turnos / 400 chars (menos reasoning).
      let title = await tryOnce(buildExcerpt(4, 800));
      if (!title) {
        await new Promise(r => setTimeout(r, 2000));
        title = await tryOnce(buildExcerpt(2, 400));
      }
      if (!title) {
        console.error(`[bff] title gen empty (${session.id.slice(0, 8)}) após retry`);
        return;
      }
      const current = await findSession(session.id, session.owner);
      if (!current || current.title) return;
      current.title = title;
      await persistSession(current);
    } catch (err) {
      console.error(`[bff] title gen failed (${session.id.slice(0, 8)}):`, err instanceof Error ? err.message : err);
    } finally {
      titleGenInFlight.delete(sessionKey(session.owner, session.id));
    }
  })();
}
