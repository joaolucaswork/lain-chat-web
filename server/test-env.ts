/**
 * Ambiente dos testes (dummies, zero segredo). Carregado via --preload
 * (`bun test` → package.json), ANTES de qualquer import — o config.ts
 * congela o env no primeiro import, então setar dentro de um arquivo de
 * teste é tarde demais (outro arquivo pode importar o config antes).
 */
process.env.LAIN_MEMORY_API_KEY ??= 'test-owner-master-key-0123456789abcdef0123456789abcdef';
