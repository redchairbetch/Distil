-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Backlog #15: orphan storage sweeper for failed kiosk-intake archives.
-- uploadPatientDocument's anon kiosk path can't delete its own storage object
-- when the patient_documents insert fails (anon has no storage DELETE policy),
-- so failed archives leave orphaned objects. This adds a read-only finder + a
-- quarterly pg_cron job that invokes the intake-orphan-sweep edge function,
-- which deletes the orphans through the Storage API (the only correct way to
-- remove the physical file). The SQL here never deletes anything.
--
-- NOT auto-applied by the agent: arming an autonomous production deletion cron
-- needs explicit sign-off. Apply this migration + deploy the edge function only
-- after review. The two SECTIONS below can be applied independently — Section 1
-- (the finder) is read-only and safe; Section 2 arms the recurring sweep.

-- ── Section 1 (safe, read-only) ───────────────────────────────────────────────
-- List kiosk-intake storage objects that have no patient_documents row, older
-- than a grace window (so an in-flight upload mid-insert is never swept).
-- SECURITY DEFINER to read the storage schema; execution restricted to the
-- service role (the edge function), not anon/authenticated.
create or replace function public.list_intake_orphans(grace_days int default 7, lim int default 500)
returns table(name text)
language sql
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  left join public.patient_documents pd on pd.storage_path = o.name
  where o.bucket_id = 'patient-documents'
    and o.name like 'clinics/%/intakes/%'
    and pd.id is null
    and o.created_at < now() - make_interval(days => greatest(grace_days, 0))
  order by o.created_at
  limit greatest(least(lim, 1000), 0)
$$;

revoke all on function public.list_intake_orphans(int, int) from public;
-- Supabase grants EXECUTE to anon/authenticated directly (not just via PUBLIC),
-- and orphan paths embed the patient name in the filename, so revoke from those
-- roles explicitly — only the service role (the edge function) may call it.
revoke all on function public.list_intake_orphans(int, int) from anon, authenticated;
grant execute on function public.list_intake_orphans(int, int) to service_role;

-- ── Section 2 (arms the autonomous sweep) ─────────────────────────────────────
-- Quarterly sweep (04:00 on the 1st of Jan/Apr/Jul/Oct). Mirrors the
-- aided-daily-notifications job: the Vault service_role_key is the bearer secret
-- the edge function checks via get_cron_auth_secret(). Re-running reschedules
-- the same job name in place. Requires the intake-orphan-sweep edge function to
-- be deployed first.
select cron.schedule(
  'intake-orphan-sweep-quarterly',
  '0 4 1 1,4,7,10 *',
  $job$
  select net.http_post(
    url := 'https://gznvccnxlsbnvsunoxna.supabase.co/functions/v1/intake-orphan-sweep',
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
