-- Checklists de limpeza, execução da limpeza, horário de check-in e link da equipe

-- Horário padrão de check-in e token do link público da equipe (por propriedade)
alter table public.properties
  add column checkin_time time not null default '15:00',
  add column team_token   text not null unique
                          default encode(extensions.gen_random_bytes(24), 'hex');

-- Horário de check-in combinado com o hóspede (opcional; senão vale o da propriedade)
alter table public.reservations
  add column check_in_time time;

-- ---------------------------------------------------------------------------
-- Itens de checklist: modelo da propriedade (property_id) ou extra do quarto (unit_id)
-- ---------------------------------------------------------------------------
create table public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references public.properties(id) on delete cascade,
  unit_id      uuid references public.units(id) on delete cascade,
  label        text not null check (length(trim(label)) > 0),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint checklist_items_owner_chk check ((property_id is null) <> (unit_id is null))
);

create index checklist_items_property_idx on public.checklist_items(property_id, sort_order);
create index checklist_items_unit_idx on public.checklist_items(unit_id, sort_order);

-- ---------------------------------------------------------------------------
-- Limpezas: uma por reserva, criada ao realizar o check-out.
-- Os itens são uma CÓPIA do checklist naquele momento.
-- ---------------------------------------------------------------------------
create table public.cleanings (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null unique references public.reservations(id) on delete cascade,
  unit_id         uuid not null references public.units(id) on delete cascade,
  date            date not null,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index cleanings_date_idx on public.cleanings(date);

create trigger cleanings_updated_at before update on public.cleanings
  for each row execute function public.set_updated_at();

create table public.cleaning_items (
  id           uuid primary key default gen_random_uuid(),
  cleaning_id  uuid not null references public.cleanings(id) on delete cascade,
  label        text not null,
  sort_order   integer not null default 0,
  done_at      timestamptz
);

create index cleaning_items_cleaning_idx on public.cleaning_items(cleaning_id, sort_order);

-- RLS: mesmo padrão das demais tabelas
alter table public.checklist_items enable row level security;
alter table public.cleanings       enable row level security;
alter table public.cleaning_items  enable row level security;

create policy "authenticated_all" on public.checklist_items
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.cleanings
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.cleaning_items
  for all to authenticated using (true) with check (true);

revoke all on public.checklist_items, public.cleanings, public.cleaning_items from anon;
