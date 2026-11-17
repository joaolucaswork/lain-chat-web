/** Tools do LLM contra o lain-memory. Roda silencioso (sem eventos na UI). */
import { CHAT_PROJECT, MEMORY_URL } from '../../config.ts';
import { fetchJson, getChatScopes, memDate, memGetHeaders } from '../memory.ts';

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

function fmtHit(m: any, i: number, scope: string): string {
  const d = memDate(m);
  return `${i + 1}. [${scope}] ${m.memory ?? ''}${d ? ` (${d})` : ''}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function parseToolArgs(raw: string): Record<string, any> {
  try {
    return JSON.parse(raw || '{}') as Record<string, any>;
  } catch {
    return {};
  }
}

async function fanoutScopes(): Promise<Array<string | undefined>> {
  const { includeGlobal, projects } = await getChatScopes();
  const scopes: Array<string | undefined> = [...(includeGlobal ? [undefined] : []), ...projects];
  if (scopes.length === 0) scopes.push(CHAT_PROJECT || undefined);
  return scopes;
}

async function execListMemories(args: Record<string, any>): Promise<string> {
  const limit = typeof args.limit === 'number' ? clamp(args.limit, 1, 50) : 20;
  const onlyScope = typeof args.project === 'string' && args.project.trim() ? args.project.trim() : undefined;
  try {
    if (onlyScope) return await listSingleScope(onlyScope, limit);
    return await listAllScopes(limit);
  } catch {
    return 'Memória indisponível no momento.';
  }
}

async function listSingleScope(scope: string, limit: number): Promise<string> {
  const isGlobal = scope.toLowerCase() === 'global';
  const data = await fetchJson(`${MEMORY_URL}/api/memory/list`,
    isGlobal ? { limit } : { project: scope, limit }, 10_000);
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'Nenhuma memória salva.';
  items.sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  return items.slice(0, limit).map((m: any, i: number) => fmtHit(m, i, isGlobal ? 'global' : scope)).join('\n').slice(0, 6000);
}

async function listAllScopes(limit: number): Promise<string> {
  const scopes = await fanoutScopes();
  const perScope = clamp(Math.ceil(limit / Math.max(scopes.length, 1)), 5, 50);
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
  return all.slice(0, limit).map(({ m, scope }, i) => fmtHit(m, i, scope)).join('\n').slice(0, 6000);
}

async function execSearchMemories(args: Record<string, any>): Promise<string> {
  const q = typeof args.query === 'string' ? args.query : '';
  const limit = typeof args.limit === 'number' ? clamp(args.limit, 1, 15) : 8;
  const onlyScope = typeof args.project === 'string' && args.project.trim() ? args.project.trim() : undefined;
  if (!q.trim()) return 'Informe as keywords para buscar nas memórias.';
  try {
    if (onlyScope) return await searchSingleScope(onlyScope, q, limit);
    return await searchAllScopes(q, limit);
  } catch {
    return 'Memória indisponível no momento.';
  }
}

async function searchSingleScope(scope: string, q: string, limit: number): Promise<string> {
  const isGlobal = scope.toLowerCase() === 'global';
  const data = await fetchJson(`${MEMORY_URL}/api/memory/recall`,
    isGlobal ? { query: q, limit } : { query: q, project: scope, limit }, 10_000);
  const items = Array.isArray(data) ? data : [];
  if (items.length === 0) return 'Nenhuma memória encontrada para essa busca.';
  return items.slice(0, limit).map((m: any, i: number) => fmtHit(m, i, isGlobal ? 'global' : scope)).join('\n').slice(0, 4000);
}

async function searchAllScopes(q: string, limit: number): Promise<string> {
  const scopes = await fanoutScopes();
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
  return items.map(({ m, scope }, i) => fmtHit(m, i, scope)).join('\n').slice(0, 4000);
}

async function execGraphStats(): Promise<string> {
  try {
    const res = await fetch(`${MEMORY_URL}/api/graph/stats`, { headers: memGetHeaders(), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`graph/stats → ${res.status}`);
    const s = await res.json() as { nodes: number; edges: number; types: Record<string, number> };
    const types = Object.entries(s.types || {}).map(([t, n]) => `${t} (${n})`).join(', ');
    let out = `Grafo: ${s.nodes} entidades, ${s.edges} relacionamentos.${types ? ` Tipos: ${types}.` : ''}`;
    try {
      const rn = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(), signal: AbortSignal.timeout(10_000) });
      if (rn.ok) out += await appendNodeNames(rn);
    } catch { /* stats sem nomes ainda vale */ }
    return out;
  } catch {
    return 'Grafo indisponível no momento.';
  }
}

async function appendNodeNames(rn: Response): Promise<string> {
  const nodes = (await rn.json()) as Array<{ id: string; type: string }>;
  const byType = new Map<string, string[]>();
  for (const n of nodes) {
    const arr = byType.get(n.type) ?? [];
    if (arr.length < 12) arr.push(n.id);
    byType.set(n.type, arr);
  }
  const parts = [...byType.entries()].map(([t, ids]) => `${t}: ${ids.join(', ')}`);
  if (parts.length === 0) return '';
  return `\nEntidades: ${parts.join(' | ')}`.slice(0, 2500);
}

async function execGraphQuery(args: Record<string, any>): Promise<string> {
  const q = typeof args.query === 'string' ? args.query : '';
  if (!q.trim()) return 'Informe o tema ou entidade a buscar no grafo.';
  try {
    const data = await fetchJson(`${MEMORY_URL}/api/graph/query`, { query: q, depth: 2, maxNodes: 10 }, 10_000);
    const md = typeof data?.markdown === 'string' ? data.markdown : '';
    if (md.trim()) return md.slice(0, 3000);
  } catch {
    return 'Grafo indisponível no momento.';
  }
  return await fallbackGraphSubstring(q);
}

async function fallbackGraphSubstring(q: string): Promise<string> {
  // Busca direta é lexical e pode falhar — lista entidades que casam por substring.
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

/** Executa tools do LLM contra o lain-memory. Roda silencioso (sem eventos na UI). */
export async function execLlmTool(tc: LlmToolCall): Promise<string> {
  const args = parseToolArgs(tc.args);
  if (tc.name === 'list_memories') return execListMemories(args);
  if (tc.name === 'search_memories') return execSearchMemories(args);
  if (tc.name === 'graph_stats') return execGraphStats();
  if (tc.name === 'graph_query') return execGraphQuery(args);
  return `Error: unknown tool "${tc.name}"`;
}
