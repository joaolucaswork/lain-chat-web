import { describe, expect, test } from 'bun:test';
import { sanitizeTitle } from './titles.ts';

describe('sanitizeTitle', () => {
  test('tira aspas e pontuação das bordas', () => {
    expect(sanitizeTitle('"Minha conversa sobre Ariel!"')).toBe('Minha conversa sobre Ariel');
  });

  test('colapsa espaços e limita a 60 chars', () => {
    expect(sanitizeTitle('  oi    mundo  ')).toBe('oi mundo');
    const long = sanitizeTitle('a'.repeat(100));
    expect(long.length).toBeLessThanOrEqual(60);
  });

  test('vazio volta vazio', () => {
    expect(sanitizeTitle('')).toBe('');
  });
});
