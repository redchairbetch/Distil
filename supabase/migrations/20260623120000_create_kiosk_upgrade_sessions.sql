-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Phase 2 of the annual/upgrade kiosk route (backlog #23): cross-device prefill.
-- A provider mints a short-lived, single-use code from the CRM that carries the
-- returning patient's prior contact + last readiness answers; the anonymous
-- kiosk redeems it through the kiosk-upgrade-prefill edge function (service
-- role) so last year's answers can be reviewed without the kiosk ever reading
-- patient data directly. Provider access is clinic-scoped; the edge function
-- bypasses RLS via the service role, so no anon policy is needed here.
create table if not exists public.kiosk_upgrade_sessions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb,
  created_by  uuid references public.staff(id) on delete set null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_kiosk_upgrade_sessions_code on public.kiosk_upgrade_sessions(code);

alter table public.kiosk_upgrade_sessions enable row level security;

drop policy if exists staff_manage_own_clinic_upgrade_sessions on public.kiosk_upgrade_sessions;
create policy staff_manage_own_clinic_upgrade_sessions
  on public.kiosk_upgrade_sessions
  for all
  using (clinic_id = my_clinic_id())
  with check (clinic_id = my_clinic_id());
