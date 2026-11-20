-- Conversas do chat: fonte única (localhost e VPS leem o mesmo lugar).
-- Um doc JSONB por sessão — o BFF sempre carrega a sessão inteira por request,
-- então doc > tabela de mensagens (sem paginação, sem join, migração trivial).
--
-- Acesso SOMENTE via BFF com service_role (bypassa RLS). RLS ligada sem
-- policies = anon/authenticated não leem nada; o isolamento por dono (owner)
-- continua no BFF, como era no disco (getSession/findSession filtram por owner).
-- RLS estrita por auth.uid() exigiria o browser falar direto com o Supabase
-- (fora da arquitetura atual BFF+cookie HttpOnly) — passo futuro, não MVP.
create table if not exists chat_sessions (
  owner text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

create index if not exists chat_sessions_owner_updated
  on chat_sessions (owner, updated_at desc);

alter table chat_sessions enable row level security;
-- Sem policies de propósito: só service_role (BFF) acessa.
