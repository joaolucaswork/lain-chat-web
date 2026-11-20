# lain-chat-web

Chat web com memória persistente. Frontend React + BFF em Bun (`server/server.ts`)
que fala com o `lain-memory` (`:3341`) para recall/remember/grafo.

## Rodando

Pré-requisitos: `lain-memory` no ar (`docker compose up -d` + `bun run dev` em `lain-memory`).

```bash
cp server/.env.example server/.env   # preencha LAIN_LLM_API_KEY
bun install
bun run build    # gera dist/ servido pelo BFF
bun run server   # :3335
```

Dev (HMR): `bun run dev:all` (BFF com `--watch` + Vite juntos; abra `http://localhost:5173`).
Se o pm2 estiver com o BFF no ar, pare antes (`pm2 stop lain-chat-bff`) senão dá EADDRINUSE no `:3335`.

## Como funciona

Cada mensagem: `recall` + `graph/query` no lain-memory → injeta memórias no
system prompt → stream do LLM → `remember` em background (`mode: chat`:
extrai fatos do que o usuário disse; a resposta do modelo não vira memória).
Sem lain-memory no ar o chat funciona, mas sem
memória. Vault (`/memorias`) lista `lain-memory` via `/api/vault/*`.

## Estrutura do servidor

`server/server.ts` é só boot + dispatch. Lógica em módulos:

- `config.ts` — env + constantes · `lib/http.ts` — headers/CSP, `json()`, SSE
- `lib/sse.ts` — clientes SSE · `lib/sessions.ts` — store + disco
- `lib/memory.ts` — recall/grafo/remember/vault · `lib/llm.ts` — stream + tools
- `lib/titles.ts` — títulos via LLM · `lib/chat.ts` — turno (`processMessage`/`runTurn`)
- `lib/tenant.ts` — cookie `lain_tk`, dono estável `t-<slug>`, `effectiveModel`
- `lib/supabase.ts` — Auth server-side (secret key) · `lib/session-store.ts` — `chat_sessions`
- `lib/profile.ts` — nome de exibição por dono (`profile.json`) + `personContext`
- `routes/` — `static`, `chat`, `sessions`, `vault`, `settings`, `auth`, `tenant`
  (retornam `null` se não casar)

Testes: `bun test` (funções puras de cada `lib/*.test.ts`).

## Auth (Supabase)

Login em 2 etapas (`src/components/AuthGate.tsx`): email único → o BFF diz
se a conta existe (`POST /api/auth/check-email`) → senha, código por email (OTP 6 dígitos) ou Google OAuth.
O browser autentica com a publishable key (`src/lib/supabase.ts`,
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` no `.env.local`) e manda o
`access_token` para `POST /api/auth/exchange`. O BFF valida o token
server-side com a secret key (`server/lib/supabase.ts` — nunca sai do
`server/.env`), vincula o `sub` a um tenant interno via
`POST /api/tenant/link` no lain-memory e grava o cookie HttpOnly `lain_tk`.
O browser nunca vê a key `lm_*`; o display name fica no `localStorage`
(só exibição, `src/hooks/useMe.ts`).

## Tenant (multitenant + demo)

Cada visitante tem uma tenant key do lain-memory guardada no cookie HttpOnly
`lain_tk` (`server/lib/tenant.ts`) — nunca em `localStorage`/URL (o
`EventSource` não manda headers, mas manda cookies). Sem cookie = modo owner
legado; `LAIN_DEMO_MODE=on` = gate aberto para visitantes.
A key resolve por request o bearer do upstream e o dono das sessões:
`resolveOwner()` → `t-<slug>` via `/api/tenant/whoami` (cache 10min) com
fallback legado por hash; master (`lucas`) → `owner`. Visitante usa sempre o
modelo barato (`effectiveModel`). Rotas (`server/routes/tenant.ts`):
`POST /api/tenant/signup` (409 se nome tomado), `POST /api/tenant/logout`,
`POST /api/tenant/mcp-token` (token dedicado p/ opencode/Claude, mostrado 1x),
`GET /api/me` (`owner`|`demo`|`tenant` — o `DemoGate` em `src/App.tsx`
decide: app, gate ou app de visitante), `DELETE /api/tenant/account`
(exclusão total LGPD: upstream + Supabase Auth + sessões/profile locais).
Frontend: `TenantSettingsPage` (nome + token MCP + sair/excluir),
`TenantExitButton`, `useMe()`.

## Supabase (Auth + sessões)

Dois usos, chaves separadas: browser usa a publishable
(`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`); BFF usa a secret
(`SUPABASE_URL` + `SUPABASE_SECRET_KEY` em `server/.env`, nunca commitada).
Sem URL/secret o BFF cai no disco local, sem sync entre máquinas.
A tabela `chat_sessions` tem RLS ligada **sem policies** — anon/authenticated
não leem nada; só o BFF com `service_role` acessa (isolamento por dono
continua no BFF, como era no disco).

## Session-store (sync localhost ↔ VPS)

Fonte única: `chat_sessions (owner, id, data jsonb, updated_at)` —
`supabase/migrations/20261120_chat_sessions.sql`. localhost e VPS leem/escrevem
o mesmo lugar, por isso as conversas sincronizam. `server/lib/session-store.ts`
(`dbUpsert/List/Fetch/Delete`, upsert last-write-wins por `(owner, id)`);
`server/lib/sessions.ts` = L1 memória + Supabase primário + disco
(`SESSIONS_DIR`) como fallback (dev sem secret, testes). Tudo filtrado por
`owner` — um visitante nunca lista/abre sessão de outro.
Migração disco → Supabase: `bun run server/scripts/migrate-sessions-to-supabase.ts`.

## Profile (nome do visitante)

Nome de exibição editável por dono (`server/lib/profile.ts`):
`t-<slug>/profile.json` (0600, escrita atômica), sanitizado (2–40 chars, sem
aspas/controles, nunca exceção), cache 5min. `GET/POST /api/tenant/profile`
(valida, salva no BFF, espelha no upstream best-effort; nunca troca o slug).
O chat injeta por turno via `personContext()` — nome CITADO como dado, nunca
como instrução. Sai junto no `DELETE /api/tenant/account` (nome é PII).

## Manter no ar (Mac local)

Docker (Qdrant+Redis) já usa `restart: unless-stopped` — basta o Docker
Desktop abrir no login. Os dois serviços Bun ficam no pm2:

```bash
cp server/.env.example server/.env   # 1ª vez: preencher chaves
pm2 start ecosystem.config.cjs       # lain-memory :3341 + BFF :3335
pm2 save
```

Para sobreviver a reboot, rode uma vez (pede sudo):

```bash
sudo env PATH=$PATH:/opt/homebrew/bin /opt/homebrew/lib/node_modules/pm2/bin/pm2 startup launchd -u lucas --hp /Users/lucas
```

Comandos úteis: `pm2 list`, `pm2 logs lain-chat-bff`, `pm2 restart all`.
