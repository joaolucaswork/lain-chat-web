import { describe, expect, test } from 'bun:test';
import { isSafeSessionId } from './sessions.ts';

describe('isSafeSessionId', () => {
  test('aceita ids gerados (uuid/slug)', () => {
    expect(isSafeSessionId('abc-123_XYZ')).toBe(true);
    expect(isSafeSessionId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  test('rejeita path traversal e vazio (protege sessionFile)', () => {
    expect(isSafeSessionId('../server')).toBe(false);
    expect(isSafeSessionId('a/b')).toBe(false);
    expect(isSafeSessionId('')).toBe(false);
    expect(isSafeSessionId('com espaço')).toBe(false);
    expect(isSafeSessionId('a'.repeat(129))).toBe(false);
    expect(isSafeSessionId('a'.repeat(128))).toBe(true);
  });
});
