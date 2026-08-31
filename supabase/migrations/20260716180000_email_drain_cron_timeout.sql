-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Raise the pg_net timeout on the campaign-email-drain cron call.
-- The first post-arm run (2026-07-16 16:00 UTC) hit pg_net's default 5s
-- timeout: the edge function completed fine (200 in ~8.9s per function logs)
-- but net._http_response recorded a client-side timeout error. In live mode
-- a full drain is ~60s (50 emails × 600ms rate-limit pacing plus send
-- latency), so the response would never be captured and we'd be relying on
-- the edge runtime finishing after client disconnect. 120s covers a full
-- drain batch with headroom. cron.schedule() with an existing jobname
-- replaces the job in place.
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
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
