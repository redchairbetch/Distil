-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- READY TO APPLY: Run in the Supabase SQL editor or via CLI migration.
-- Migration: 011_notification_log
-- Created: 2026-05-18
-- Description: Phase 4 of the Aided push notification system (scheduled
--              auto-reminders). Adds the notification_log dedup ledger and the
--              get_due_notifications() function that the notification-cron
--              edge function scans once a day.

-- ── Dedup ledger ─────────────────────────────────────────────────────────────
-- One row per reminder actually claimed. The unique (patient_id, kind, ref_key)
-- key is what makes a reminder fire exactly once: notification-cron claims a
-- row here (INSERT ... ON CONFLICT DO NOTHING) before it sends.
create table public.notification_log (
  id          uuid primary key default uuid_generate_v4(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  kind        text not null,
  ref_key     text not null,
  sent_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (patient_id, kind, ref_key)
);

-- RLS: enabled with no policies — denies all anon/authenticated access.
-- notification-cron writes via the service role, which bypasses RLS.
alter table public.notification_log enable row level security;

-- ── Due-reminder scan ────────────────────────────────────────────────────────
-- Returns every reminder due "today", evaluated in the clinic timezone
-- (America/Denver). All date logic lives here so the edge function stays a
-- thin sender. Already-logged reminders are excluded, and every branch
-- requires an active push subscription (an unreachable patient is skipped).
create or replace function public.get_due_notifications()
returns table (patient_id uuid, kind text, ref_key text, detail text)
language sql
stable
security invoker
set search_path = ''
as $$
  -- 1. Appointment — the day before a scheduled appointment.
  select a.patient_id,
         'appointment_24h'::text,
         a.id::text,
         a.appointment_type
  from public.appointments a
  where a.status = 'scheduled'
    and (a.appointment_date at time zone 'America/Denver')::date
        = (now() at time zone 'America/Denver')::date + 1
    and exists (
      select 1 from public.push_subscriptions ps
      where ps.patient_id = a.patient_id and ps.active
    )
    and not exists (
      select 1 from public.notification_log nl
      where nl.patient_id = a.patient_id
        and nl.kind = 'appointment_24h'
        and nl.ref_key = a.id::text
    )

  union all

  -- 2. Cleaning — a monthly nudge for anyone with an active fitting. ref_key
  --    is the calendar month, so the first cron run each month sends and the
  --    rest dedup out.
  select distinct
         df.patient_id,
         'cleaning_monthly'::text,
         to_char((now() at time zone 'America/Denver')::date, 'YYYY-MM'),
         null::text
  from public.device_fittings df
  where df.active
    and exists (
      select 1 from public.push_subscriptions ps
      where ps.patient_id = df.patient_id and ps.active
    )
    and not exists (
      select 1 from public.notification_log nl
      where nl.patient_id = df.patient_id
        and nl.kind = 'cleaning_monthly'
        and nl.ref_key = to_char((now() at time zone 'America/Denver')::date, 'YYYY-MM')
    )

  union all

  -- 3. Warranty — 90d / 30d / expired. The window (<= +90) plus the
  --    notification_log dedup means a missed cron day still catches up and
  --    each threshold fires exactly once.
  select w.patient_id, w.kind, w.ref_key, w.detail
  from (
    select df.patient_id,
           case
             when df.warranty_expiry <= (now() at time zone 'America/Denver')::date
               then 'warranty_expired'
             when df.warranty_expiry <= (now() at time zone 'America/Denver')::date + 30
               then 'warranty_30d'
             else 'warranty_90d'
           end as kind,
           df.id::text as ref_key,
           null::text as detail
    from public.device_fittings df
    where df.active
      and df.warranty_expiry is not null
      and df.warranty_expiry <= (now() at time zone 'America/Denver')::date + 90
      and exists (
        select 1 from public.push_subscriptions ps
        where ps.patient_id = df.patient_id and ps.active
      )
  ) w
  where not exists (
    select 1 from public.notification_log nl
    where nl.patient_id = w.patient_id
      and nl.kind = w.kind
      and nl.ref_key = w.ref_key
  )

  union all

  -- 4. Upgrade — once, ~4 years after the care plan started, if no upgrade
  --    outcome has been recorded yet.
  select p.id,
         'upgrade_year4'::text,
         p.id::text,
         null::text
  from public.patients p
  where p.care_plan_start_date is not null
    and p.care_plan_start_date
        <= (now() at time zone 'America/Denver')::date - interval '4 years'
    and p.upgrade_outcome is null
    and exists (
      select 1 from public.device_fittings df
      where df.patient_id = p.id and df.active
    )
    and exists (
      select 1 from public.push_subscriptions ps
      where ps.patient_id = p.id and ps.active
    )
    and not exists (
      select 1 from public.notification_log nl
      where nl.patient_id = p.id
        and nl.kind = 'upgrade_year4'
        and nl.ref_key = p.id::text
    );
$$;

-- Only the service role (used by notification-cron) may run the scan —
-- it returns patient ids, so it must not be reachable by anon/authenticated.
revoke execute on function public.get_due_notifications() from public;
grant execute on function public.get_due_notifications() to service_role;
