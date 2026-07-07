-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- READY TO APPLY LAST — only after the notification-cron edge function is
-- deployed AND the Vault secret below exists. See the prerequisite note.
--
-- Migration: 012_schedule_notification_cron
-- Created: 2026-05-18
-- Description: Installs pg_cron + pg_net and schedules the daily Aided
--              notification scan. The cron job POSTs to the notification-cron
--              edge function; the service-role key is read from Vault, so no
--              secret is committed in this file.
--
-- PREREQUISITE (run once, manually, before applying this migration):
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- Re-running this migration is safe: the extension creates are guarded and
-- cron.schedule upserts by job name.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'aided-daily-notifications',
  '0 14 * * *',  -- daily at 14:00 UTC (~7-8am Mountain)
  $$
  select net.http_post(
    url := 'https://gznvccnxlsbnvsunoxna.supabase.co/functions/v1/notification-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
