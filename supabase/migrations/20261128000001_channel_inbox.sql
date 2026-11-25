-- Caixa de entrada do channel manager: mensagens brutas recebidas,
-- guardadas sem interpretar para estudar o formato antes da integração.
-- Pode conter dados pessoais de hóspedes (LGPD): só o usuário autenticado lê.

create table public.channel_inbox (
  id            uuid primary key default gen_random_uuid(),
  received_at   timestamptz not null default now(),
  method        text not null,
  path          text not null,
  query         jsonb not null default '{}'::jsonb,
  headers       jsonb not null default '{}'::jsonb,
  content_type  text,
  body          text,
  truncated     boolean not null default false
);

create index channel_inbox_received_idx on public.channel_inbox(received_at desc);

alter table public.channel_inbox enable row level security;
create policy "authenticated_read" on public.channel_inbox
  for select to authenticated using (true);
create policy "authenticated_delete" on public.channel_inbox
  for delete to authenticated using (true);
revoke all on public.channel_inbox from anon;

-- Limpeza: mensagens com mais de 30 dias podem ser apagadas com
--   delete from public.channel_inbox where received_at < now() - interval '30 days';
