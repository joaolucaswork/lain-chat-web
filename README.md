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

Dev (HMR): `bun run server` num terminal + `bun run dev` noutro (`/api/*` proxia para `:3335`).

## Como funciona

Cada mensagem: `recall` + `graph/query` no lain-memory → injeta memórias no
system prompt → stream do LLM → `remember` em background (`mode: bundle`,
com dedup ADD/UPDATE/NOOP). Sem lain-memory no ar o chat funciona, mas sem
memória. Vault (`/memorias`) lista `lain-memory` via `/api/vault/*`.

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
