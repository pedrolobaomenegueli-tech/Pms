-- =============================================================================
-- Sincronização automática a cada 15 minutos (pg_cron + pg_net)
--
-- Rode este arquivo no SQL Editor do Supabase DEPOIS do deploy na Vercel.
-- Troque os dois placeholders abaixo antes de executar:
--   <APP_URL>      ex.: https://meu-pms.vercel.app   (sem barra no final)
--   <SYNC_SECRET>  o mesmo valor da variável SYNC_SECRET na Vercel
--
-- A URL e o segredo ficam no Supabase Vault (criptografados), não no job.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda URL e segredo no Vault (rode só uma vez; para trocar, veja o final)
select vault.create_secret('<APP_URL>/api/sync', 'pms_sync_url');
select vault.create_secret('<SYNC_SECRET>', 'pms_sync_secret');

-- Agenda o job (se já existir com o mesmo nome, é substituído)
select cron.schedule(
  'pms-sync-ical',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pms_sync_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pms_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- -----------------------------------------------------------------------------
-- Consultas úteis
-- -----------------------------------------------------------------------------
-- Ver o job:            select * from cron.job;
-- Últimas execuções:    select * from cron.job_run_details order by start_time desc limit 20;
-- Respostas HTTP:       select id, status_code, content, created from net._http_response order by created desc limit 20;
-- Pausar:               select cron.unschedule('pms-sync-ical');
-- Trocar o segredo:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'pms_sync_secret'), '<NOVO_SEGREDO>');
