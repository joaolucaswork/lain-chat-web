/** Rotas de settings: estado da chave do LLM (somente env, nunca em disco). */
import { ENV_LLM_KEY, getLlmKey, getLlmKeySource, maskKey } from '../config.ts';
import { json } from '../lib/http.ts';

export async function handleSettings(req: Request, path: string): Promise<Response | null> {
  // ── Settings: OpenRouter key ──
  if (req.method === 'GET' && path === '/api/settings') {
    const source = getLlmKeySource();
    return json({
      hasKey: getLlmKey() !== '',
      source,
      masked: ENV_LLM_KEY ? maskKey(ENV_LLM_KEY) : '',
      fromEnv: Boolean(ENV_LLM_KEY),
    });
  }

  if (req.method === 'POST' && path === '/api/settings/openrouter-key') {
    return json({ error: 'A chave é configurada no ambiente do servidor' }, 410);
  }

  if (req.method === 'DELETE' && path === '/api/settings/openrouter-key') {
    return json({ error: 'A chave é configurada no ambiente do servidor' }, 410);
  }

  return null;
}
