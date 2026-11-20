#!/usr/bin/env bun
/**
 * lain-chat-web BFF — chat web com memória persistente.
 *
 * Serve o frontend (`../dist`) e implementa o mesmo protocolo `/api/*`
 * que o frontend espera (SSE em `/api/chat`), mas com backend simplificado:
 *   - Chat: recall no lain-memory (:3341) → LLM OpenAI-compatible (stream) → remember em background.
 *   - Vault: proxy para lain-memory (lista/grafo) no formato que a UI consome.
 *   - Agents/projects/browse/validate: implementações locais mínimas (sem MCP proxy).
 *
 * Estrutura:
 *   config.ts        env + constantes (ver server/.env.example)
 *   lib/http.ts      headers de segurança, json(), sseMsg()
 *   lib/sse.ts       clientes SSE por sessão + broadcast()
 *   lib/sessions.ts  memória (L1) + Supabase (fonte única) ou disco (fallback)
 *   lib/memory.ts    recall/grafo/remember/vault (best-effort)
 *   lib/llm.ts       streaming OpenAI-compatible + tools
 *   lib/titles.ts    títulos de sessão via LLM
 *   lib/chat.ts      orquestração do turno (processMessage + runTurn)
 *   routes/*.ts      dispatch por prefixo (static, chat, sessions, vault, settings)
 *
 * Env: ver server/.env.example.
 * Uso: bun run server/server.ts
 */
import { BIND_ADDR, LLM_BASE, MEMORY_KEY, MEMORY_URL, PORT } from './config.ts';
import { json } from './lib/http.ts';
import { loadSessionsFromDisk, sessions } from './lib/sessions.ts';
import { isSessionDbConfigured } from './lib/session-store.ts';
import { maybeGenerateTitle } from './lib/titles.ts';
import { handleStatic } from './routes/static.ts';
import { handleChat } from './routes/chat.ts';
import { handleSessions } from './routes/sessions.ts';
import { handleVault } from './routes/vault.ts';
import { handleSettings } from './routes/settings.ts';
import { handleTenant } from './routes/tenant.ts';
import { handleAuth } from './routes/auth.ts';
import { isSupabaseConfigured } from './lib/supabase.ts';

if (!MEMORY_KEY) {
  console.error('[lain-chat-bff] fatal: LAIN_MEMORY_API_KEY is required');
  process.exit(1);
}

if (!isSessionDbConfigured()) {
  loadSessionsFromDisk();

  // Backfill: sessões antigas (criadas antes do título) ganham título
  // na subida do BFF, sem bloquear o boot. Sequencial com intervalo
  // para não tomar rate limit do provider (17 paralelas falham).
  let _titleBackfillDelay = 0;
  for (const s of sessions.values()) {
    if (!s.title) {
      const delay = _titleBackfillDelay;
      _titleBackfillDelay += 1500;
      setTimeout(() => maybeGenerateTitle(s), delay);
    }
  }
} else {
  // Com DB: sessões vêm do Supabase por demanda (read-through) — sem
  // warmup, sem backfill no boot (títulos geram no próximo turno).
  console.log('[bff] sessions: Supabase (sync localhost↔VPS)');
}

const server = Bun.serve({
  hostname: BIND_ADDR,
  port: PORT,
  idleTimeout: 120, // SSE streams ficam abertos; keepalive a cada 10s
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const params = url.searchParams;

    return (await handleStatic(req, path))
      ?? (await handleChat(req, path, params))
      ?? (await handleSessions(req, path, params))
      ?? (await handleVault(req, path))
      ?? (await handleSettings(req, path))
      ?? (await handleTenant(req, path))
      ?? (await handleAuth(req, path))
      ?? json({ error: `unknown route: ${path}` }, 404);
  },
});

// WHY: sem isso o pm2 restart manda SIGTERM e o Bun com SSE aberto
// (idleTimeout 120s) demora a morrer — o próximo processo bate em
// EADDRINUSE e o contador de restarts acumula (550+ em Nov/2026).
let _shuttingDown = false;
function shutdownGracefully(signal: string) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  try {
    server.stop(true); // fecha o socket imediatamente, libera a porta
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

console.log(`[lain-chat-bff] listening on http://${BIND_ADDR}:${PORT} (memory: ${MEMORY_URL}, llm: ${LLM_BASE}, auth: ${isSupabaseConfigured() ? 'supabase' : 'legacy'})`);
