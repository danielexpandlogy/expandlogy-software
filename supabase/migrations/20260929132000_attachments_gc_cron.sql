-- Programa la limpieza diaria de adjuntos huérfanos (03:17 UTC).
-- La URL del proyecto y el secreto viven en Vault (no en el repo):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<secreto>', 'attachments_gc_secret');
-- El mismo secreto se configura en la función: supabase secrets set GC_SECRET=<secreto>
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('attachments-gc') where exists (select 1 from cron.job where jobname = 'attachments-gc');

select cron.schedule(
  'attachments-gc',
  '17 3 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/attachments-gc',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-gc-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'attachments_gc_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
