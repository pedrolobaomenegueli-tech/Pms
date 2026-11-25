-- Remove a sincronização por iCal. As reservas passarão a vir do channel
-- manager (HotelLink) via API; o modelo para isso será criado quando a
-- documentação da API estiver disponível.

-- Se o agendamento do pg_cron foi ativado, desliga
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'pms-sync-ical';
  end if;
end $$;

-- Segredos do Vault usados pelo cron (se existirem)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    delete from vault.secrets where name in ('pms_sync_url', 'pms_sync_secret');
  end if;
end $$;

-- Reservas: colunas exclusivas do iCal
alter table public.reservations drop constraint if exists reservations_feed_uid_key;
drop index if exists public.reservations_feed_idx;
alter table public.reservations
  drop column if exists feed_id,
  drop column if exists external_uid,
  drop column if exists ical_summary,
  drop column if exists ical_description,
  drop column if exists last_seen_at;

-- Feeds iCal importados
drop table if exists public.feeds;

-- Token dos links de exportação iCal
alter table public.units drop column if exists export_token;
