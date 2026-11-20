import { describe, expect, test } from 'bun:test';
import { buildApiMessages, friendlyChatError } from './chat.ts';

describe('friendlyChatError', () => {
  test('resposta vazia transitória vira mensagem amigável', () => {
    expect(friendlyChatError(new Error('EMPTY_LLM_RESPONSE'))).toContain('voltou vazio');
  });

  test('erro no meio do stream vira mensagem amigável', () => {
    expect(friendlyChatError(new Error('LLM stream error: provider down'))).toContain('meio da resposta');
  });

  test('erro desconhecido passa cru (debug)', () => {
    expect(friendlyChatError(new Error('LLM 400: bad request'))).toBe('LLM 400: bad request');
  });
});

describe('buildApiMessages (prefixo estável para prompt caching)', () => {
  const baseSystem = 'BASE SYSTEM';
  const who = '[USER PROFILE]\nname: "Ana"';
  const history = [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'olá!' },
    { role: 'user', content: 'tudo bem?' },
  ];

  test('exatamente 1 system no índice 0 (estável: sem hora nem memórias)', () => {
    const msgs = buildApiMessages({
      baseSystem,
      who,
      memBlock: 'mem',
      today: { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:00' },
      history,
    });
    expect(msgs[0]).toEqual({ role: 'system', content: `${baseSystem}\n\n${who}` });
    expect(msgs.filter((m) => m.role === 'system')).toHaveLength(1);
    expect(msgs).toHaveLength(history.length + 1);
  });

  test('sem perfil: system é só o base', () => {
    const msgs = buildApiMessages({
      baseSystem,
      who: null,
      memBlock: '',
      today: { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:00' },
      history,
    });
    expect(msgs[0]).toEqual({ role: 'system', content: baseSystem });
  });

  test('prefixo messages[0..N-2] idêntico quando memBlock/today mudam', () => {
    const a = buildApiMessages({
      baseSystem, who, memBlock: 'mem-A',
      today: { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:00' },
      history,
    });
    const b = buildApiMessages({
      baseSystem, who, memBlock: 'mem-B completamente diferente',
      today: { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:05' },
      history,
    });
    expect(a.slice(0, -1)).toEqual(b.slice(0, -1));
    expect(a[a.length - 1]).not.toEqual(b[b.length - 1]);
  });

  test('contexto dinâmico só no turno atual (envelope <turn_context>)', () => {
    const memBlock = 'O usuário gosta de café.';
    const msgs = buildApiMessages({
      baseSystem, who: null, memBlock,
      today: { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:00' },
      history,
    });
    const last = msgs[msgs.length - 1] as { role: string; content: string };
    expect(last.role).toBe('user');
    expect(last.content).toContain('<turn_context>');
    expect(last.content).toContain(memBlock);
    expect(last.content).toContain('tudo bem?');
    // Prior intacto: sem envelope vazado.
    for (const m of msgs.slice(0, -1)) {
      expect(String((m as { content: unknown }).content ?? '')).not.toContain('<turn_context>');
    }
  });

  test('sem memBlock: cai para data de hoje no turno atual', () => {
    const today = { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:00' };
    const msgs = buildApiMessages({ baseSystem, who: null, memBlock: '', today, history });
    const last = String((msgs[msgs.length - 1] as { content: unknown }).content ?? '');
    expect(last).toContain('Data de hoje');
    expect(last).toContain('10:00');
  });

  test('não muta history nem session.messages', () => {
    const snapshot = JSON.parse(JSON.stringify(history));
    buildApiMessages({
      baseSystem, who, memBlock: 'mem',
      today: { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:00' },
      history,
    });
    expect(history).toEqual(snapshot);
  });

  test('histórico vazio: só o system estável', () => {
    const msgs = buildApiMessages({
      baseSystem, who, memBlock: 'mem',
      today: { iso: '2026-11-20', long: 'quinta-feira, 20/11/2026', time: '10:00' },
      history: [],
    });
    expect(msgs).toEqual([{ role: 'system', content: `${baseSystem}\n\n${who}` }]);
  });
});
