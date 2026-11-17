import { describe, expect, test } from 'bun:test';
import {
  buildMemoryBlock,
  getSaoPauloToday,
  memDate,
  shouldQueryGraph,
  stripQuestionFraming,
} from './memory.ts';

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
