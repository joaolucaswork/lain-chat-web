import { describe, expect, test } from 'bun:test';
import { friendlyChatError } from './chat.ts';

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
