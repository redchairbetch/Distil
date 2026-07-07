-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: closer_clinic_provider_model
-- Prod version: 20260614173124 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production).
--
-- First cut of the closer clinic/provider model. NOTE: the clinic_staff junction
-- and the staff-based get_clinic_providers created here were superseded by the
-- dispensing_providers model (20260615030443), which drops both. Kept for an
-- accurate history.

-- Per-location identity + grouping code (clinic # repeats across addresses)
alter table public.clinics add column if not exists clinic_code text;
alter table public.clinics add column if not exists location_key text;
create unique index if not exists clinics_location_key_uniq
  on public.clinics(location_key) where location_key is not null;

-- Allow no-login dispensing-provider staff rows
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role = any (array['audiologist','front_desk','admin','closer','provider']));

-- Provider <-> clinic many-to-many (providers float across locations)
create table if not exists public.clinic_staff (
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  staff_id   uuid not null references public.staff(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (clinic_id, staff_id)
);
alter table public.clinic_staff enable row level security;

drop policy if exists clinic_staff_admin_all on public.clinic_staff;
create policy clinic_staff_admin_all on public.clinic_staff for all to authenticated
  using ((select role from staff where id = auth.uid()) = 'admin')
  with check ((select role from staff where id = auth.uid()) = 'admin');

drop policy if exists clinic_staff_select_own on public.clinic_staff;
create policy clinic_staff_select_own on public.clinic_staff for select to authenticated
  using (clinic_id = my_clinic_id());

-- Cross-clinic provider resolver for the closer's PA location picker.
-- SECURITY DEFINER so a closer homed to one clinic can resolve the providers
-- of the clinic they're running an event at. Returns no patient data.
create or replace function public.get_clinic_providers(p_clinic_id uuid)
returns table(staff_id uuid, full_name text, licenses jsonb, signature_url text)
language sql security definer set search_path = public as $$
  select s.id, s.full_name, s.licenses, s.signature_url
  from clinic_staff cs join staff s on s.id = cs.staff_id
  where cs.clinic_id = p_clinic_id and s.active
  order by s.full_name
$$;
grant execute on function public.get_clinic_providers(uuid) to authenticated;
