-- Campaign email delivery infrastructure (sprint PR 5).
-- campaign_deliveries rows with delivery_channel='email' have sat pending
-- forever — nothing drained them. The campaign-email-drain edge function
-- (deployed alongside this migration) sends due rows via Resend and marks
-- them sent/failed. This migration adds the retry counter, the per-clinic
-- reply-to address, and the daily cron trigger.

alter table public.campaign_deliveries
  add column if not exists attempts int not null default 0;

-- Front-desk inbox for campaign email reply-to. Per Kurt (2026-07-05):
-- From = provider name, replies land at the clinic front desk.
alter table public.clinics
  add column if not exists reply_to_email text;

-- Daily drain at 16:00 UTC (~9–10am Mountain — mid-morning local sends).
-- Mirrors aided-daily-notifications / intake-orphan-sweep: the Vault
-- service_role_key is the bearer secret the function checks via
-- get_cron_auth_secret(). SAFE BY DEFAULT: until the EMAIL_LIVE=true
-- function secret is set (after the sending domain verifies in Resend),
-- the function runs as a dry-run report and mutates nothing.
select cron.schedule(
  'campaign-email-drain-daily',
  '0 16 * * *',
  $job$
  select net.http_post(
    url := 'https://gznvccnxlsbnvsunoxna.supabase.co/functions/v1/campaign-email-drain',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);
