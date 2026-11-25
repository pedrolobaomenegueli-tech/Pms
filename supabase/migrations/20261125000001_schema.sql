-- Esquema inicial do PMS
-- Propriedades (4 imóveis) -> quartos/unidades -> reservas, feeds e tarefas.

create extension if not exists pgcrypto with schema extensions;

-- Atualiza updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Propriedades
-- ---------------------------------------------------------------------------
create table public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  notes       text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quartos (unidades anunciadas)
-- ---------------------------------------------------------------------------
create table public.units (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete restrict,
  name          text not null check (length(trim(name)) > 0),
  color         text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active        boolean not null default true,
  notes         text,
  sort_order    integer not null default 0,
  -- Token secreto usado nas URLs de exportação iCal
  export_token  text not null unique
                default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index units_property_idx on public.units(property_id);

create trigger units_updated_at before update on public.units
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Feeds iCal importados
-- ---------------------------------------------------------------------------
create table public.feeds (
  id                uuid primary key default gen_random_uuid(),
  unit_id           uuid not null references public.units(id) on delete cascade,
  channel           text not null check (channel in ('airbnb', 'booking', 'outro')),
  url               text not null check (url ~* '^(https?|webcal)://'),
  last_synced_at    timestamptz,
  last_success_at   timestamptz,
  -- pendente: nunca sincronizou | ok | erro: falhou | alerta: veio suspeito
  status            text not null default 'pendente'
                    check (status in ('pendente', 'ok', 'erro', 'alerta')),
  error_message     text,
  last_event_count  integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index feeds_unit_idx on public.feeds(unit_id);

create trigger feeds_updated_at before update on public.feeds
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reservas e bloqueios
-- check_in e check_out são datas; check_out é exclusivo (dia da saída).
-- ---------------------------------------------------------------------------
create table public.reservations (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid not null references public.units(id) on delete cascade,
  source               text not null check (source in ('manual', 'airbnb', 'booking', 'outro')),
  kind                 text not null default 'reserva' check (kind in ('reserva', 'bloqueio')),
  feed_id              uuid references public.feeds(id) on delete set null,
  external_uid         text,
  check_in             date not null,
  check_out            date not null,
  guest_name           text,
  guests               integer check (guests is null or guests > 0),
  notes                text,
  status               text not null default 'ativa' check (status in ('ativa', 'cancelada')),
  cancelled_at         timestamptz,
  cleaning_started_at  timestamptz,
  cleaning_done_at     timestamptz,
  ical_summary         text,
  ical_description     text,
  last_seen_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint reservations_dates_chk check (check_out > check_in),
  constraint reservations_feed_uid_key unique (feed_id, external_uid)
);

create index reservations_unit_dates_idx on public.reservations(unit_id, check_in, check_out);
create index reservations_check_out_idx on public.reservations(check_out);
create index reservations_feed_idx on public.reservations(feed_id);

create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tarefas (limpeza, manutenção, outros)
-- ---------------------------------------------------------------------------
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  date        date not null,
  title       text not null check (length(trim(title)) > 0),
  kind        text not null default 'outro' check (kind in ('limpeza', 'manutencao', 'outro')),
  done        boolean not null default false,
  done_at     timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_date_idx on public.tasks(date);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: só usuário autenticado acessa. O cadastro público deve ficar
-- DESATIVADO no Supabase (ver README), então o único usuário é você.
-- As rotas /api/sync e /api/ical usam a service role no servidor.
-- ---------------------------------------------------------------------------
alter table public.properties   enable row level security;
alter table public.units        enable row level security;
alter table public.feeds        enable row level security;
alter table public.reservations enable row level security;
alter table public.tasks        enable row level security;

create policy "authenticated_all" on public.properties
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.units
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.feeds
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.reservations
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.tasks
  for all to authenticated using (true) with check (true);

-- Remove qualquer acesso do papel anônimo
revoke all on public.properties, public.units, public.feeds,
              public.reservations, public.tasks from anon;
