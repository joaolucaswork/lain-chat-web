import { describe, expect, test, afterEach } from 'bun:test';
import {
  buildMemoryBlock,
  fetchJson,
  getSaoPauloToday,
  listVaultMemories,
  memDate,
  shouldQueryGraph,
  stripQuestionFraming,
} from './memory.ts';

const _origFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = _origFetch;
});

function mockFetchOnce(responses: Response[]): { calls: number } {
  const state = { calls: 0 };
  globalThis.fetch = (async () => {
    const r = responses[Math.min(state.calls, responses.length - 1)];
    state.calls++;
    return r;
  }) as typeof fetch;
  return state;
}

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const errText = (status: number, body: string) => new Response(body, { status });

describe('fetchJson retry', () => {
  test('429 rate-limit repete e devolve o JSON da tentativa boa', async () => {
    const state = mockFetchOnce([
      errText(429, JSON.stringify({ error: 'tenant rate limit exceeded (60 req/min)' })),
      okJson({ ok: true }),
    ]);
    const out = await fetchJson('https://x/api/memory/recall', {}, 5000, undefined, 3);
    expect(out).toEqual({ ok: true });
    expect(state.calls).toBe(2);
  });

  test('429 de cota (memory cap) NÃO repete — chamada única', async () => {
    const state = mockFetchOnce([errText(429, JSON.stringify({ error: 'memory cap reached (500 per scope)' }))]);
    await expect(fetchJson('https://x/api/memory/remember', {}, 5000, undefined, 3)).rejects.toThrow('→ 429');
    expect(state.calls).toBe(1);
  });

  test('500 não repete (pode ser pós-escrita)', async () => {
    const state = mockFetchOnce([errText(500, 'boom')]);
    await expect(fetchJson('https://x/api/memory/recall', {}, 5000, undefined, 3)).rejects.toThrow('→ 500');
    expect(state.calls).toBe(1);
  });

  test('timeout de rede não repete (remember pode ter salvo)', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error('signal timed out');
    }) as typeof fetch;
    await expect(fetchJson('https://x/api/memory/remember', {}, 50, undefined, 3)).rejects.toThrow('timed out');
    expect(calls).toBe(1);
  });
});

describe('listVaultMemories', () => {
  test('ordena por mais recentes primeiro (getAll da VPS não garante ordem)', async () => {
    const items = [
      { id: 'old', memory: 'fato antigo', created_at: '2026-01-01T00:00:00Z' },
      { id: 'new', memory: 'fato novo', created_at: '2026-11-20T00:00:00Z' },
      { id: 'nodate', memory: 'fato sem data' },
    ];
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith('/api/graph/nodes')) return okJson([]);
      return okJson(items);
    }) as typeof fetch;
    const out = await listVaultMemories('k-test');
    expect(out.map((m) => m.id)).toEqual(['new', 'old', 'nodate']);
  });
});

describe('stripQuestionFraming', () => {
  test('remove framing interrogativo mantendo a keyword', () => {
    expect(stripQuestionFraming('Você sabe que eu tenho uma cadelinha?')).toBe('eu tenho uma cadelinha');
  });

  test('remove pedido de explicação', () => {
    expect(stripQuestionFraming('me conta sobre o projeto percurso')).toBe('o projeto percurso');
  });

  test('frase sem framing volta intacta (sem ?)', () => {
    expect(stripQuestionFraming('minha cadela Ariel')).toBe('minha cadela ariel');
  });
});

describe('memDate', () => {
  test('prefere created_at (updated é reconsolidação, não novo relato)', () => {
    expect(memDate({ created_at: '2026-06-10T12:00:00Z', updated_at: '2026-11-16T12:00:00Z' })).toBe('2026-06-10');
  });

  test('cai para updated_at quando created_at falta', () => {
    expect(memDate({ created_at: null, updated_at: '2026-11-16T12:00:00Z' })).toBe('2026-11-16');
  });

  test('string vazia ou null viram data ausente (|| faz o fallback, ?? não faria)', () => {
    expect(memDate({ created_at: '', updated_at: '2026-11-16T12:00:00Z' })).toBe('2026-11-16');
    expect(memDate({})).toBe('');
  });
});

describe('getSaoPauloToday', () => {
  test('fuso America/Sao_Paulo, não UTC (21h BRT = 00h UTC do dia seguinte)', () => {
    // 2026-11-17T00:30Z ainda é dia 16 em SP
    const t = getSaoPauloToday(new Date('2026-11-17T00:30:00Z'));
    expect(t.iso).toBe('2026-11-16');
    expect(t.time).toBe('21:30');
  });

  test('formato longo com dia da semana', () => {
    const t = getSaoPauloToday(new Date('2026-11-17T12:00:00Z'));
    expect(t.iso).toBe('2026-11-17');
    expect(t.time).toBe('09:00');
    expect(t.long).toContain('terça-feira');
  });
});

describe('buildMemoryBlock', () => {
  test('vazio sem grafo retorna string vazia', () => {
    expect(buildMemoryBlock([])).toBe('');
  });

  test('tag = escopo + quando foi SALVA, nunca data do evento', () => {
    const block = buildMemoryBlock([
      { id: '1', memory: 'cirurgia no joelho', created_at: '2026-06-10T00:00:00Z', project: 'diario' },
    ]);
    expect(block).toContain('[diario 2026-06-10]');
    expect(block).toContain('NUNCA use a data da tag como data do evento');
  });

  test('memória sem data não ganha chute de data', () => {
    const block = buildMemoryBlock([{ id: '1', memory: 'gosta de café', project: 'global' }]);
    expect(block).toContain('[global] gosta de café');
  });

  test('grafo sozinho ainda injeta a data de hoje', () => {
    const block = buildMemoryBlock([], '## Ariel\n- tipo: Dog');
    expect(block).toContain('[GRAFO]');
    expect(block).toContain('Data de hoje:');
  });
});

describe('shouldQueryGraph', () => {
  test('pula smalltalk/saudação', () => {
    expect(shouldQueryGraph('oi', true)).toBe(false);
    expect(shouldQueryGraph('bom dia!', true)).toBe(false);
    expect(shouldQueryGraph('valeu', true)).toBe(false);
  });

  test('consulta por default em pergunta real', () => {
    expect(shouldQueryGraph('quem é dono do projeto percurso?', true)).toBe(true);
  });

  test('flag off desliga tudo', () => {
    expect(shouldQueryGraph('quem é Ariel?', false)).toBe(false);
  });
});
