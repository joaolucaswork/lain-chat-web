/**
 * Benchmark manual: recall vetorial vs grafo (frase cheia vs keyword).
 * Roda contra lain-memory local (:3341). Não é teste de CI — os dados do
 * workspace evoluem, então os asserts são por substring (hit/no-hit), não snapshot.
 *
 *   LAIN_MEMORY_URL=http://localhost:3341 LAIN_MEMORY_API_KEY=<key> bun run server/scripts/graph-benchmark.ts
 */
const MEMORY_URL = (process.env.LAIN_MEMORY_URL || 'http://localhost:3341').replace(/\/$/, '');
const KEY = process.env.LAIN_MEMORY_API_KEY || '';
const PROJECT = process.env.LAIN_CHAT_PROJECT || 'diario';

const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (KEY) headers['Authorization'] = `Bearer ${KEY}`;

function stripQuestionFraming(q: string): string {
  return q.toLowerCase().trim()
    .replace(/^(você|vc|tu)\s+/g, '')
    .replace(/^(sabe|lembra|conhece|lembra-se)\s+(que\s+)?/g, '')
    .replace(/^(me\s+)?(conta|fala|diz|explica)\s+(sobre\s+|a\s+respeito\s+de\s+)?/g, '')
    .replace(/\?+\s*$/g, '').trim();
}

async function post(path: string, body: unknown, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${MEMORY_URL}${path}`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

interface Probe { q: string; keyword: string; expectKeys: string[] }

const PROBES: Probe[] = [
  { q: 'quem é dono do projeto percurso?', keyword: 'percurso', expectKeys: ['joao pedro', 'owns'] },
  { q: 'o que o alprazolam trata ou causa?', keyword: 'alprazolam', expectKeys: ['sono', 'treats', 'causes'] },
  { q: 'onde fica a Ariel e qual o padrão dela?', keyword: 'Ariel', expectKeys: ['ariel', 'quarto', 'agita'] },
  { q: 'o que o usuário come de ritual?', keyword: 'banana assada', expectKeys: ['banana', 'autocuidado'] },
  { q: 'quem trabalha no percurso?', keyword: 'percurso', expectKeys: ['works_on', 'percurso'] },
  { q: 'o que foi decidido sobre trabalhar no percurso do irmão?', keyword: 'decisão percurso irmão', expectKeys: ['decision', 'percurso'] },
];

async function memHit(q: string, keys: string[]): Promise<{ n: number; hit: boolean }> {
  const data = await post('/api/memory/recall', { query: q, project: PROJECT, limit: 5 });
  const items = Array.isArray(data) ? data : [];
  const hit = items.some((m: any) => keys.some(k => String(m.memory ?? '').toLowerCase().includes(k)));
  return { n: items.length, hit };
}

async function graphHit(q: string, keys: string[]): Promise<{ chars: number; hit: boolean }> {
  const data = await post('/api/graph/query', { query: q, depth: 2, maxNodes: 8 }, 4000);
  const md = typeof data?.markdown === 'string' ? data.markdown : '';
  const low = md.toLowerCase();
  return { chars: md.length, hit: keys.some(k => low.includes(k)) };
}

let memFull = 0, graphFull = 0, graphDual = 0, graphKw = 0;
for (const p of PROBES) {
  const m = await memHit(p.q, p.expectKeys).catch(() => ({ n: -1, hit: false }));
  const g = await graphHit(p.q, p.expectKeys).catch(() => ({ chars: -1, hit: false }));
  // Dual do BFF (server.ts queryGraph): original + stripQuestionFraming.
  const stripped = stripQuestionFraming(p.q);
  const gs = (stripped.length >= 3 && stripped !== p.q.toLowerCase().trim())
    ? await graphHit(stripped, p.expectKeys).catch(() => ({ chars: -1, hit: false }))
    : { chars: -1, hit: false };
  const dual = g.hit || gs.hit;
  const gk = await graphHit(p.keyword, p.expectKeys).catch(() => ({ chars: -1, hit: false }));
  if (m.hit) memFull++;
  if (g.hit) graphFull++;
  if (dual) graphDual++;
  if (dual || gk.hit) graphKw++;
  console.log(`Q: ${p.q}\n  MEM[cheia]: ${m.hit ? 'HIT' : 'miss'} (${m.n}) | GRAPH[cheia]: ${g.hit ? 'HIT' : 'miss'} (${g.chars}ch) | GRAPH[dual-BFF]: ${dual ? 'HIT' : 'miss'} (stripped:${gs.chars}ch) | GRAPH[keyword-oracle]: ${gk.hit ? 'HIT' : 'miss'} (${gk.chars}ch)`);
}
console.log(`\nResumo: MEM ${memFull}/${PROBES.length} | GRAPH cheia ${graphFull}/${PROBES.length} | GRAPH dual-BFF ${graphDual}/${PROBES.length} | GRAPH dual+keyword-oracle ${graphKw}/${PROBES.length}`);
