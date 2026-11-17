/**
 * Barrel: implementação mora em `llm/tools.ts` (definição + execução
 * das tools) e `llm/stream.ts` (transporte SSE + retry).
 * Importe deste módulo para não quebrar `lib/chat.ts`.
 */
export * from './llm/tools.ts';
export * from './llm/stream.ts';
