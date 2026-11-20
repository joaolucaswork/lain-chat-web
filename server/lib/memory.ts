/**
 * Cliente do lain-memory (:3341): recall, grafo, remember e vault.
 * Tudo best-effort — o chat funciona mesmo com a memória fora do ar.
 */
import {
  CHAT_INCLUDE_GLOBAL_AUTO_OFF,
  CHAT_PROJECT,
  CHAT_PROJECTS_ALLOWLIST,
  CHAT_RECALL_PER_PROJECT,
  GRAPH_AUTO,
  MEMORY_KEY,
  MEMORY_URL,
} from '../config.ts';

export interface MemoryHit {
  id: string;
  memory: string;
  score?: number;
  created_at?: string;
  updated_at?: string;
  project?: string;
}

export function memGetHeaders(key?: string): Record<string, string> {
  const k = key ?? MEMORY_KEY;
  return { ...(k ? { Authorization: `Bearer ${k}` } : {}) };
}

/** 429 do gate de rate limit (60 req/min/tenant) sai ANTES do handler da VPS —
 *  sem efeito colateral, seguro repetir. 429 de cota ("memory cap reached")
 *  já passou do gate: repetir não adianta. 502/503/504 = proxy, pré-handler. */
function isRetryableStatus(status: number, body: string): boolean {
  if (status === 429) return /rate limit/i.test(body);
  return status === 502 || status === 503 || status === 504;
}

const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchJson(url: string, body: unknown, timeoutMs = 5000, key?: string, attempts = FETCH_RETRY_ATTEMPTS): Promise<any> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...memGetHeaders(key),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Timeout/abort/rede: sem retry — um remember pode ter salvo no servidor
      // e só a resposta se perdeu; repetir criaria duplicata.
      throw err;
    }
    if (res.ok) return res.json();
    const errBody = await res.text().catch(() => '');
    lastErr = new Error(`${url} → ${res.status}${errBody ? `: ${errBody.slice(0, 120)}` : ''}`);
    if (!isRetryableStatus(res.status, errBody) || i === attempts - 1) throw lastErr;
    const waitMs = FETCH_RETRY_BASE_MS * 2 ** i;
    console.warn(`[bff] memory retry ${res.status} (tentativa ${i + 1}/${attempts}) em ${waitMs}ms: ${url}`);
    await sleep(waitMs);
  }
  throw lastErr;
}

/** Tira framing interrogativo PT para o recall não enterrar keywords.
 *  Ex: "sabe que eu tenho uma cadelinha?" → "eu tenho uma cadelinha" (acha Ariel 0.36;
 *  a frase completa volta só lixo e filtra a Ariel fora do top). */
export function stripQuestionFraming(q: string): string {
  return q.toLowerCase().trim()
    .replace(/^(você|vc|tu)\s+/g, '')
    .replace(/^(sabe|lembra|conhece|lembra-se)\s+(que\s+)?/g, '')
    .replace(/^(me\s+)?(conta|fala|diz|explica)\s+(sobre\s+|a\s+respeito\s+de\s+)?/g, '')
    .replace(/\?+\s*$/g, '').trim();
}

export async function recallMemories(query: string, key?: string): Promise<MemoryHit[]> {
  // Fan-out total: frase original + versão sem framing, em global + cada projeto.
  // Merge por id (maior score), tag de origem em h.project. Best-effort por escopo.
  const queries = [query];
  const stripped = stripQuestionFraming(query);
  if (stripped.length >= 12 && stripped !== query.toLowerCase().trim()) queries.push(stripped);
  const { includeGlobal, projects } = await getChatScopes(key);
  const scopes: Array<string | undefined> = [...(includeGlobal ? [undefined] : []), ...projects];
  if (scopes.length === 0) scopes.push(CHAT_PROJECT || undefined);
  try {
    const calls: Array<Promise<{ scope: string | undefined; data: unknown }>> = [];
    for (const scope of scopes) {
      for (const q of queries) {
        const body = scope
          ? { query: q, project: scope, limit: CHAT_RECALL_PER_PROJECT, cached: true }
          : { query: q, limit: CHAT_RECALL_PER_PROJECT, cached: true };
        calls.push(fetchJson(`${MEMORY_URL}/api/memory/recall`, body, 5000, key)
          .then((data) => ({ scope, data }))
          .catch(() => ({ scope, data: [] as unknown })));
      }
    }
    const results = await Promise.all(calls);
    const merged = new Map<string, MemoryHit>();
    for (const { scope, data } of results) {
      if (!Array.isArray(data)) continue;
      for (const h of (data as MemoryHit[])) {
        const tagged: MemoryHit = { ...h, project: h.project ?? scope ?? 'global' };
        const prev = merged.get(tagged.id);
        if (!prev || (tagged.score ?? 0) > (prev.score ?? 0)) merged.set(tagged.id, tagged);
      }
    }
    return [...merged.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 20);
  } catch (err) {
    console.error('[bff] recall failed (following without memory):', err instanceof Error ? err.message : err);
    return [];
  }
}

/** Data de registro da memória (created_at; updated_at é manutenção/reconsolidação,
 *  não novo relato — usar updated faria um fato de junho parecer "deste fim de semana").
 *  Usa `||` em vez de `??`: o recall às vezes devolve string vazia ou null,
 *  e nesses casos o `??` não faria o fallback e a data sumiria do bloco. */
export function memDate(m: { updated_at?: string | null; created_at?: string | null }): string {
  const raw = String(m.created_at || m.updated_at || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

/** Data/hora de agora no fuso do usuário (America/Sao_Paulo), não UTC.
 *  `toISOString()` quebra perto da virada (21h BRT = 00h UTC do dia seguinte)
 *  e o LLM ainda tinha que adivinhar o dia da semana a partir de YYYY-MM-DD. */
export function getSaoPauloToday(now: Date = new Date()): { iso: string; long: string; time: string } {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(now);
  const dmy = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  return { iso, long: `${weekday}, ${dmy}`, time };
}

export function buildMemoryBlock(hits: MemoryHit[], graphMd?: string): string {
  const parts: string[] = [];
  const today = getSaoPauloToday();
  if (hits.length > 0) {
    // Teto de ~4000 chars: com fan-out o bloco cresceria sem controle no prompt.
    // Tag [projeto] = escopo de origem (global/diario/lain-memory/...); data = quando foi salvo.
    // O "quando aconteceu" continua vindo do texto da memória (ex "Na época...", "Antes...").
    const body = hits.map(h => {
      const d = memDate(h);
      const proj = (h.project ?? '').trim();
      const tag = proj ? (d ? `[${proj} ${d}]` : `[${proj}]`) : (d ? `[${d}]` : '');
      return `- ${tag ? `${tag} ` : ''}${h.memory}`;
    }).join('\n').slice(0, 4000);
    parts.push(`[MEMORIAS RELEVANTES — hoje é ${today.long} (${today.iso}, America/Sao_Paulo), agora são ${today.time}; [projeto data] = escopo + quando a memória foi SALVA, nunca quando o fato aconteceu. NUNCA use a data da tag como data do evento. Se o texto da memória não traz data explícita, o quando é desconhecido — não chute ("fim de semana", "recente"). Quando uma memória traz data explícita ("junho", "há 5 meses") ela prevalece sobre memórias sem data.]\n` + body);
  }
  const g = (graphMd ?? '').trim();
  if (g) {
    // Sem recall mas com grafo: a data ainda precisa ir (senão o LLM fica sem "hoje").
    if (hits.length === 0) parts.push(`Data de hoje: ${today.long} (${today.iso}, America/Sao_Paulo), hora: ${today.time}. Relativos da conversa ("hoje/ontem/agora") = hoje.`);
    parts.push('[GRAFO]\n' + g.slice(0, 1500));
  }
  return parts.join('\n\n');
}

/** Heurística barata: pula o grafo em smalltalk/saudação (economiza latência). Default = consulta. */
export function shouldQueryGraph(query: string, graphAuto = GRAPH_AUTO): boolean {
  if (!graphAuto) return false;
  const q = query.trim().toLowerCase();
  if (q.length < 3) return false;
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|tchau|ok|certo|entendi|beleza)[!.\s]*$/.test(q)) return false;
  return true;
}

/** Best-effort: busca contexto do grafo em paralelo com o recall. Nunca quebra o chat.
 *  Dual-query como o recall: o matching do grafo é literal por entidade, então a frase
 *  cheia ("quem é dono do projeto percurso?") volta vazia enquanto a keyword ("percurso")
 *  acerta o nó. Merge por seção `##` com dedup. */
export async function queryGraph(query: string, key?: string): Promise<string> {
  if (!shouldQueryGraph(query)) return '';
  const t0 = Date.now();
  const queries = [query];
  const stripped = stripQuestionFraming(query);
  if (stripped.length >= 3 && stripped !== query.toLowerCase().trim()) queries.push(stripped);
  try {
    const results = await Promise.all(queries.map(q =>
      fetchJson(`${MEMORY_URL}/api/graph/query`, { query: q, depth: 2, maxNodes: 8 }, 4000, key)));
    const seen = new Set<string>();
    const sections: string[] = [];
    for (const data of results) {
      const md = typeof data?.markdown === 'string' ? data.markdown.trim() : '';
      if (!md) continue;
      // Split por seção `## <entidade>`; dedup por título normalizado.
      for (const sec of md.split(/\n(?=## )/g)) {
        const m = sec.match(/^##\s+(.+?)\s*\n/);
        const key = (m ? m[1] : sec.slice(0, 80)).toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        sections.push(sec.trim());
      }
    }
    const merged = sections.join('\n\n').trim();
    if (merged) console.log(`[bff] graph hit (${Date.now() - t0}ms, ${merged.length} chars, ${sections.length} secs)`);
    return merged ? merged.slice(0, 1500) : '';
  } catch (err) {
    console.error('[bff] graph query failed (following without graph):', err instanceof Error ? err.message : err);
    return '';
  }
}

/** Fire-and-forget: extrai fatos do que o usuário disse. A fala do modelo não é salva. */
export function rememberTurn(userMsg: string, assistantText: string, key?: string): void {
  const user = userMsg.trim();
  if (!user) return;
  fetchJson(`${MEMORY_URL}/api/memory/remember`,
    {
      text: user.slice(0, 8000),
      assistant: assistantText.trim().slice(0, 12000),
      project: CHAT_PROJECT || undefined,
      mode: 'chat',
      date: getSaoPauloToday().iso,
    }, 60_000, key)
    .then((r: any) => {
      const ids = Array.isArray(r) ? r.map(x => `${x.id}${x.action ? `:${x.action}` : ''}`) : [];
      console.log('[bff] remember result:', ids.length ? ids.join(', ') : 'nothing saved (empty/rejected/duplicate)');
    })
    .catch(err => console.error('[bff] remember failed:', err instanceof Error ? err.message : err));
}

// ─── Escopos de leitura (fan-out) ───

export async function discoverMemoryProjects(key?: string): Promise<string[]> {
  try {
    const res = await fetch(`${MEMORY_URL}/api/graph/nodes`, { headers: memGetHeaders(key), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const nodes = (await res.json()) as Array<{ id: string; type: string }>;
    const seen = new Set<string>();
    for (const n of nodes) {
      if (n?.type === 'Project' && typeof n.id === 'string' && n.id.trim()) {
        seen.add(n.id.trim());
      }
    }
    // CHAT_PROJECT explícito sempre incluído (pode ainda não ter nó no grafo)
    if (CHAT_PROJECT && !seen.has(CHAT_PROJECT)) seen.add(CHAT_PROJECT);
    return [...seen];
  } catch {
    return CHAT_PROJECT ? [CHAT_PROJECT] : [];
  }
}

/** Escopos de leitura do chat (fan-out total, Opção A).
 *  - LAIN_CHAT_PROJECTS=vazio → auto: global (+flag) + discoverMemoryProjects().
 *  - LAIN_CHAT_PROJECTS=csv → allowlist explícita ('global' no csv inclui o global).
 *  Cache de 60s POR CHAVE (upstream): o recall roda por mensagem, não pode
 *  bater em /graph/nodes sempre — mas um cache global vazaria escopos entre
 *  tenants, então a chave do cache é o hash da bearer. */
const _chatScopesCache = new Map<string, { at: number; value: { includeGlobal: boolean; projects: string[] } }>();
function scopesCacheKey(key?: string): string {
  if (!key || key === MEMORY_KEY) return 'owner';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return `k${h}`;
}
export async function getChatScopes(key?: string): Promise<{ includeGlobal: boolean; projects: string[] }> {
  const ck = scopesCacheKey(key);
  const now = Date.now();
  const hit = _chatScopesCache.get(ck);
  if (hit && now - hit.at < 60_000) return hit.value;
  let value: { includeGlobal: boolean; projects: string[] };
  if (CHAT_PROJECTS_ALLOWLIST.length > 0) {
    const lower = CHAT_PROJECTS_ALLOWLIST.map((s) => s.toLowerCase());
    value = {
      includeGlobal: lower.includes('global'),
      projects: CHAT_PROJECTS_ALLOWLIST.filter((s) => s.toLowerCase() !== 'global'),
    };
  } else {
    value = { includeGlobal: !CHAT_INCLUDE_GLOBAL_AUTO_OFF, projects: await discoverMemoryProjects(key) };
  }
  _chatScopesCache.set(ck, { at: now, value });
  return value;
}

// ─── Vault (lain-memory → formato da UI) ───

export interface VaultMemory {
  id: string;
  file: string;
  project: string;
  tags: string[];
  created: string;
  preview: string;
  title: string | null;
  confidence: number;
  last_confirmed_at: string | null;
  status: 'active' | 'archived';
  kind: 'fact' | 'state';
}

export async function listVaultMemories(key?: string): Promise<VaultMemory[]> {
  const out: VaultMemory[] = [];
  const seenIds = new Set<string>();
  const pushBatch = (items: any[], projectLabel: string) => {
    for (const m of (Array.isArray(items) ? items : [])) {
      if (!m?.id || seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      const body: string = m.memory ?? '';
      out.push({
        id: m.id, file: '', project: projectLabel, tags: [],
        created: m.created_at ?? '',
        preview: body.slice(0, 200) + (body.length > 200 ? '...' : ''),
        title: typeof m.title === 'string' && m.title ? m.title : null,
        confidence: typeof m.confidence === 'number' ? m.confidence : 0.5,
        last_confirmed_at: typeof m.last_confirmed_at === 'string' ? m.last_confirmed_at : null,
        status: m.status === 'archived' ? 'archived' : 'active',
        kind: m.kind === 'state' ? 'state' : 'fact',
      });
    }
  };
  // 1. Global (sem filtro de projeto)
  try {
    const data = await fetchJson(`${MEMORY_URL}/api/memory/list`, { limit: 200 }, 5000, key);
    pushBatch(data, 'global');
  } catch (err) {
    console.error('[bff] vault memories failed (global):', err instanceof Error ? err.message : err);
    throw err;
  }
  // 2. Cada projeto descoberto via grafo (ex: 'percurso', 'lain-memory').
  //    O lain-memory não tem endpoint que lista projetos, então o grafo
  //    (nós type=Project) é a fonte da verdade. Falhas por projeto (ex 500
  //    em nomes com espaço) são ignoradas — não podem derrubar a página.
  const projects = await discoverMemoryProjects(key);
  await Promise.all(projects.map(async (p) => {
    if (!p || p === 'global') return;
    try {
      const data = await fetchJson(`${MEMORY_URL}/api/memory/list`, { project: p, limit: 200 }, 5000, key);
      pushBatch(data, p);
    } catch (err) {
      console.error(`[bff] vault memories failed (project=${p}):`, err instanceof Error ? err.message : err);
    }
  }));
  return out;
}
