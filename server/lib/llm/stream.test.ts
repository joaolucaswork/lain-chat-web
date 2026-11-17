import { describe, expect, test } from 'bun:test';
import { extractStreamText, callLlmStreamWithRetry } from './stream.ts';

describe('extractStreamText', () => {
  test('null/string passam direto', () => {
    expect(extractStreamText(null)).toBe('');
    expect(extractStreamText('oi')).toBe('oi');
  });

  test('blocos text/content concatenam; resto ignora', () => {
    expect(extractStreamText([{ text: 'a' }, { content: 'b' }, 'c', { nope: 1 }])).toBe('abc');
  });

  test('não-string/array volta vazio', () => {
    expect(extractStreamText(42)).toBe('');
  });
});

describe('callLlmStreamWithRetry', () => {
  test('signal abortado joga STOPPED sem chamar fetch', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    let fetched = false;
    const orig = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      fetched = true;
      throw new Error('should not fetch');
    };
    try {
      await expect(callLlmStreamWithRetry([], 'm', [], () => {}, ctrl.signal)).rejects.toThrow('STOPPED');
    } finally {
      globalThis.fetch = orig;
    }
    expect(fetched).toBe(false);
  });
});
