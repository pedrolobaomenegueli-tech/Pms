-- Manutenção por quarto

create table public.maintenance_issues (
  id                    uuid primary key default gen_random_uuid(),
  unit_id               uuid not null references public.units(id) on delete cascade,
  title                 text not null check (length(trim(title)) > 0),
  description           text,
  priority              text not null default 'media'
                        check (priority in ('baixa', 'media', 'alta', 'urgente')),
  status                text not null default 'aberto'
                        check (status in ('aberto', 'em_andamento', 'resolvido')),
  opened_on             date not null default (now() at time zone 'America/Sao_Paulo')::date,
  resolved_at           timestamptz,
  cost                  numeric(10, 2) check (cost is null or cost >= 0),
  notes                 text,
  -- Bloqueio manual criado junto com o problema (entra na exportação iCal)
  block_reservation_id  uuid references public.reservations(id) on delete set null,
  -- Limpeza em que o problema foi encontrado
  cleaning_id           uuid references public.cleanings(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index maintenance_unit_idx on public.maintenance_issues(unit_id);
create index maintenance_status_idx on public.maintenance_issues(status, priority);

create trigger maintenance_updated_at before update on public.maintenance_issues
  for each row execute function public.set_updated_at();

alter table public.maintenance_issues enable row level security;
create policy "authenticated_all" on public.maintenance_issues
  for all to authenticated using (true) with check (true);
revoke all on public.maintenance_issues from anon;
