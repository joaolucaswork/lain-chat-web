/** LLM OpenAI-compatible: streaming com tools contra o lain-memory. */
import { CHAT_PROJECT, CHAT_TEMPERATURE, LLM_BASE, MEMORY_URL, getLlmKey } from '../config.ts';
import { fetchJson, getChatScopes, memDate, memGetHeaders } from './memory.ts';

export interface LlmToolCall { id: string; name: string; args: string }

export const MEM_TOOLS: Array<Record<string, unknown>> = [
  {
    type: 'function',
    function: {
      name: 'list_memories',
      description: 'Lista as memórias salvas de longo prazo em TODOS os escopos (global + todos os projetos). Chame quando o usuário perguntar o que está salvo/lembrado.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Máximo de memórias (default 20, máx 50)' },
          project: { type: 'string', description: 'Opcional: restringe a um escopo ("global", "diario", "lain-memory", ...). Omitido = todos.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memories',
      description: 'Busca nas memórias salvas em TODOS os escopos (global + todos os projetos) por keywords. Chame com palavras-chave da pergunta (ex "cadela", "Ariel") ANTES de dizer que algo não está salvo.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keywords para buscar (ex "cadela Ariel")' },
          limit: { type: 'number', description: 'Máximo de resultados (default 8, máx 15)' },
          project: { type: 'string', description: 'Opcional: restringe a um escopo ("global", "diario", "lain-memory", ...). Omitido = todos.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'graph_stats',
      description: 'Resumo do grafo de conhecimento: quantas entidades e relacionamentos existem, por tipo. Use quando perguntarem o que há no grafo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'graph_query',
      description: 'Busca entidades e relacionamentos no grafo (pessoas, projetos, tecnologias e como se conectam). Chame com KEYWORDS/entidade ("percurso", "alprazolam", "Ariel") — nunca a pergunta cheia ("quem é...?"), que o matching não entende.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Tema ou nome da entidade (ex "lain-memory", "Lucas")' },
        },
        required: ['query'],
      },
    },
  },
];

/** Executa tools do LLM contra o lain-memory. Roda silencioso (sem eventos na UI). */
export async function execLlmTool(tc: LlmToolCall): Promise<string> {
  if (tc.name === 'list_memories') {
    let limit = 20;
    let onlyScope: string | undefined;
    try {
      const a = JSON.parse(tc.args || '{}') as { limit?: number; project?: string };
      if (typeof a.limit === 'number') limit = Math.min(Math.max(a.limit, 1), 50);
      if (typeof a.project === 'string' && a.project.trim()) onlyScope = a.project.trim();
    } catch { /* args padrão */ }
    const fmt = (m: any, i: number, scope: string) => {
      const d = memDate(m);
      return `${i + 1}. [${scope}] ${m.memory ?? ''}${d ? ` (${d})` : ''}`;
    };
    try {
      // Escopo único explícito (tool pediu project)
      if (onlyScope) {
        const isGlobal = onlyScope.toLowerCase() === 'global';
        const data = await fetchJson(`${MEMORY_URL}/api/memory/list`,
          isGlobal ? { limit } : { project: onlyScope, limit }, 10_000);
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) return 'Nenhuma memória salva.';
        items.sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
        return items.slice(0, limit).map((m: any, i: number) => fmt(m, i, isGlobal ? 'global' : onlyScope as string)).join('\n').slice(0, 6000);
      }
      // Fan-out total: global + todos os projetos (best-effort por escopo)
      const { includeGlobal, projects } = await getChatScopes();
      const scopes: Array<string | undefined> = [...(includeGlobal ? [undefined] : []), ...projects];
      if (scopes.length === 0) scopes.push(CHAT_PROJECT || undefined);
      const perScope = Math.min(Math.max(Math.ceil(limit / Math.max(scopes.length, 1)), 5), 50);
      const batches = await Promise.all(scopes.map(async (scope) => {
        try {
          const data = await fetchJson(`${MEMORY_URL}/api/memory/list`,
            scope ? { project: scope, limit: perScope } : { limit: perScope }, 10_000);
          return { scope: scope ?? 'global', items: Array.isArray(data) ? data : [] };
        } catch { return { scope: scope ?? 'global', items: [] as any[] }; }
      }));
      const seen = new Set<string>();
      const all: Array<{ m: any; scope: string }> = [];
      for (const b of batches) {
        for (const m of b.items) {
          if (!m?.id || seen.has(m.id)) continue;
          seen.add(m.id);
          all.push({ m, scope: b.scope });
        }
      }
      if (all.length === 0) return 'Nenhuma memória salva.';
      // /api/memory/list não garante ordem — mais recentes primeiro.
      all.sort((a, b) => String(b.m.created_at ?? '').localeCompare(String(a.m.created_at ?? '')));
      return all.slice(0, limit).map(({ m, scope }, i) => fmt(m, i, scope)).join('\n').slice(0, 6000);
    } catch {
      return 'Memória indisponível no momento.';
    }
  }

  if (tc.name === 'search_memories') {
    let q = '';
    let limit = 8;
    let onlyScope: string | undefined;
    try {
      const a = JSON.parse(tc.args || '{}') as { query?: string; limit?: number; project?: string };
      q = a.query ?? '';
      if (typeof a.limit === 'number') limit = Math.min(Math.max(a.limit, 1), 15);
      if (typeof a.project === 'string' && a.project.trim()) onlyScope = a.project.trim();
    } catch { /* vazio */ }
    if (!q.trim()) return 'Informe as keywords para buscar nas memórias.';
    const fmt = (m: any, i: number, scope: string) => {
      const d = memDate(m);
      return `${i + 1}. [${scope}] ${m.memory ?? ''}${d ? ` (${d})` : ''}`;
    };
    try {
      if (onlyScope) {
        const isGlobal = onlyScope.toLowerCase() === 'global';
        const data = await fetchJson(`${MEMORY_URL}/api/memory/recall`,
          isGlobal ? { query: q, limit } : { query: q, project: onlyScope, limit }, 10_000);
        const items = Array.isArray(data) ? data : [];
        if (items.length === 0) return 'Nenhuma memória encontrada para essa busca.';
        return items.slice(0, limit).map((m: any, i: number) => fmt(m, i, isGlobal ? 'global' : onlyScope as string)).join('\n').slice(0, 4000);
      }
      const { includeGlobal, projects } = await getChatScopes();
      const scopes: Array<string | undefined> = [...(includeGlobal ? [undefined] : []), ...projects];
      if (scopes.length === 0) scopes.push(CHAT_PROJECT || undefined);
      const batches = await Promise.all(scopes.map(async (scope) => {
        try {
          const data = await fetchJson(`${MEMORY_URL}/api/memory/recall`,
            scope ? { query: q, project: scope, limit } : { query: q, limit }, 10_000);
          return { scope: scope ?? 'global', items: Array.isArray(data) ? data : [] };
        } catch { return { scope: scope ?? 'global', items: [] as any[] }; }
      }));
      const merged = new Map<string, { m: any; scope: string }>();
      for (const b of batches) {
        for (const m of b.items) {
          if (!m?.id) continue;
          const prev = merged.get(m.id);
          if (!prev || (m.score ?? 0) > (prev.m.score ?? 0)) merged.set(m.id, { m, scope: (m as any).project ?? b.scope });
        }
      }
      const items = [...merged.values()].sort((a, b) => (b.m.score ?? 0) - (a.m.score ?? 0)).slice(0, limit);
      if (items.length === 0) return 'Nenhuma memória encontrada para essa busca.';
      return items.map(({ m, scope }, i) => fmt(m, i, scope)).join('\n').slice(0, 4000);
    } catch {
      return 'Memória indisponível no momento.';
    }
  }

  if (tc.name === 'graph_stats') {
    try {
      const res = await fetch(`${MEMORY_URL}/api/graph/stats`, { headers: memGetHeaders(), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`graph/stats → ${res.status}`);
      const s = await res.json() as { nodes: number; edges: number; types: Record<string, number> };
      const types = Object.entries(s.types || {}).map(([t, n]) => `${t} (${n})`).join(', ');
      let out = `Grafo: ${s.nodes} entidades, ${s.edges} relacionamentos.${types ? ` Tipos: ${types}.` : ''}`;
      // Nomes das entidades (para o modelo poder detalhar via graph_query)
      try {
        const rn = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(), signal: AbortSignal.timeout(10_000) });
        if (rn.ok) {
          const nodes = (await rn.json()) as Array<{ id: string; type: string }>;
          const byType = new Map<string, string[]>();
          for (const n of nodes) {
            const arr = byType.get(n.type) ?? [];
            if (arr.length < 12) arr.push(n.id);
            byType.set(n.type, arr);
          }
          const parts = [...byType.entries()].map(([t, ids]) => `${t}: ${ids.join(', ')}`);
          if (parts.length > 0) out += `\nEntidades: ${parts.join(' | ')}`.slice(0, 2500);
        }
      } catch { /* stats sem nomes ainda vale */ }
      return out;
    } catch {
      return 'Grafo indisponível no momento.';
    }
  }

  if (tc.name === 'graph_query') {
    let q = '';
    try { q = (JSON.parse(tc.args || '{}') as { query?: string }).query ?? ''; } catch { /* vazio */ }
    if (!q.trim()) return 'Informe o tema ou entidade a buscar no grafo.';
    try {
      const data = await fetchJson(`${MEMORY_URL}/api/graph/query`, { query: q, depth: 2, maxNodes: 10 }, 10_000);
      const md = typeof data?.markdown === 'string' ? data.markdown : '';
      if (md.trim()) return md.slice(0, 3000);
    } catch {
      return 'Grafo indisponível no momento.';
    }
    // Fallback: busca direta é lexical e pode falhar — lista entidades que casam por substring
    try {
      const rn = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(), signal: AbortSignal.timeout(10_000) });
      if (!rn.ok) return 'Nenhuma entidade relacionada encontrada no grafo.';
      const nodes = (await rn.json()) as Array<{ id: string; type: string }>;
      const words = q.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
      const matched = nodes.filter(n => words.some(w => n.id.toLowerCase().includes(w)));
      const list = (matched.length > 0 ? matched : nodes.slice(0, 30)).map(n => `${n.id} [${n.type}]`);
      if (list.length === 0) return 'Nenhuma entidade relacionada encontrada no grafo.';
      return `Busca por relações não achou nada direto, mas estas entidades existem no grafo: ${list.join(', ')}`.slice(0, 3000);
    } catch {
      return 'Nenhuma entidade relacionada encontrada no grafo.';
    }
  }

  return `Error: unknown tool "${tc.name}"`;
}

export function extractStreamText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    // Blocos tipo [{type:'text',text:'...'}] (alguns providers via OpenRouter)
    return node.map((b) => {
      if (typeof b === 'string') return b;
      if (b && typeof b.text === 'string') return b.text;
      if (b && typeof b.content === 'string') return b.content;
      return '';
    }).join('');
  }
  return '';
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
  const isOpenRouter = (() => {
    try { return new URL(LLM_BASE).hostname.endsWith('openrouter.ai'); } catch { return false; }
  })();
  // Timeout próprio por turno (120s): stream travado não pode prender o chat.
  // Combina com o abort do usuário (/stop).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('LLM_TIMEOUT')), 120_000);
  if (signal) {
    if (signal.aborted) ctrl.abort((signal as any).reason ?? new Error('STOPPED'));
    else signal.addEventListener('abort', () => ctrl.abort((signal as any).reason ?? new Error('STOPPED')), { once: true });
  }
  let res: Response;
  try {
    res = await fetch(`${LLM_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmKey}`,
        ...(isOpenRouter ? { 'HTTP-Referer': 'https://github.com/joaolucaswork/lain-chat-web', 'X-Title': 'Lain Chat' } : {}),
      },
      body: JSON.stringify({
        model, messages, temperature: CHAT_TEMPERATURE, max_tokens: 4096, stream: true,
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.message === 'LLM_TIMEOUT') throw new Error('LLM timeout (120s por turno)');
    throw err;
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    clearTimeout(timer);
    throw new Error(`LLM ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const reader = res.body?.getReader();
  if (!reader) { clearTimeout(timer); throw new Error('No response body'); }
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoningChars = 0;
  const finishReasons: string[] = [];
  let streamError: string | null = null;
  let lastRaw = '';
  const toolParts = new Map<number, { id: string; name: string; args: string }>();
  let streamDone = false;
  try {
  while (!streamDone) {
    if (ctrl.signal.aborted) {
      throw new Error(signal?.aborted ? 'STOPPED' : 'LLM timeout (120s por turno)');
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t || !t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (data === '[DONE]') { streamDone = true; break; }
      let parsed: any;
      try { parsed = JSON.parse(data); } catch { continue; }
      // OpenRouter pode entregar erro no meio do stream (ex provider indisponível)
      if (parsed?.error) {
        const msg = typeof parsed.error === 'string' ? parsed.error : (parsed.error?.message ?? JSON.stringify(parsed.error));
        streamError = String(msg).slice(0, 500);
        continue;
      }
      const choice = parsed?.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReasons.push(String(choice.finish_reason));
      if (choice.native_finish_reason && choice.native_finish_reason !== choice.finish_reason) {
        finishReasons.push(`native:${choice.native_finish_reason}`);
      }
      const delta = choice.delta ?? choice.message ?? {};
      // reasoning (GLM/Zhipu e outros thinking models mandam antes do content) — não é resposta
      const reasoning =
        (typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '') +
        (typeof delta.reasoning === 'string' ? delta.reasoning : '');
      if (reasoning) reasoningChars += reasoning.length;
      const text = extractStreamText(delta.content ?? delta.text);
      if (text) { content += text; onToken(text); }
      for (const tc of (delta?.tool_calls ?? []) as Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>) {
        const idx = tc.index ?? 0;
        let part = toolParts.get(idx);
        if (!part) { part = { id: '', name: '', args: '' }; toolParts.set(idx, part); }
        if (tc.id) part.id += tc.id;
        if (tc.function?.name) part.name += tc.function.name;
        if (tc.function?.arguments) part.args += tc.function.arguments;
      }
      lastRaw = data.slice(0, 300);
    }
  }
  } finally {
    clearTimeout(timer);
    try { await reader.cancel(); } catch { /* já fechado */ }
  }
  const toolCalls = [...toolParts.values()]
    .filter(p => p.id && p.name)
    .map(p => ({ id: p.id, name: p.name, args: p.args }));
  if (streamError && !content && toolCalls.length === 0) {
    throw new Error(`LLM stream error: ${streamError}`);
  }
  if (!content && toolCalls.length === 0) {
    console.error(`[bff] empty LLM response (model=${model} finish=[${finishReasons.join(',')}] reasoningChars=${reasoningChars} last=${lastRaw})`);
    throw new Error('EMPTY_LLM_RESPONSE');
  }
  return { content, toolCalls };
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
