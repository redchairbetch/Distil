-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: dispensing_providers_model
-- Prod version: 20260615030443 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production).
--
-- Replaces the abandoned clinic_staff junction (20260614173124) with a dedicated
-- dispensing_providers reference table + clinic_providers junction, and reworks
-- get_clinic_providers to read it (signature coalesces dp -> linked staff).

-- Dispensing providers are reference data (no login), so they can't live in
-- staff (staff.id FKs auth.users). Own table + junction instead.
drop function if exists public.get_clinic_providers(uuid);
drop table if exists public.clinic_staff;

create table if not exists public.dispensing_providers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  licenses jsonb not null default '{}'::jsonb,
  npi text,
  credentials text,
  signature_url text,
  staff_id uuid references public.staff(id) on delete set null,  -- set when the provider is also a login user
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.dispensing_providers enable row level security;
drop policy if exists dp_admin_all on public.dispensing_providers;
create policy dp_admin_all on public.dispensing_providers for all to authenticated
  using ((select role from staff where id = auth.uid()) = 'admin')
  with check ((select role from staff where id = auth.uid()) = 'admin');

create table if not exists public.clinic_providers (
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  provider_id uuid not null references public.dispensing_providers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (clinic_id, provider_id)
);
alter table public.clinic_providers enable row level security;
drop policy if exists cp_admin_all on public.clinic_providers;
create policy cp_admin_all on public.clinic_providers for all to authenticated
  using ((select role from staff where id = auth.uid()) = 'admin')
  with check ((select role from staff where id = auth.uid()) = 'admin');

-- Cross-clinic resolver for the closer's PA picker (no patient data).
create function public.get_clinic_providers(p_clinic_id uuid)
returns table(provider_id uuid, full_name text, licenses jsonb, signature_url text, credentials text)
language sql security definer set search_path = public as $$
  select dp.id, dp.full_name, dp.licenses,
         coalesce(dp.signature_url, s.signature_url),
         dp.credentials
  from clinic_providers cp
  join dispensing_providers dp on dp.id = cp.provider_id
  left join staff s on s.id = dp.staff_id
  where cp.clinic_id = p_clinic_id and dp.active
  order by dp.full_name
$$;
grant execute on function public.get_clinic_providers(uuid) to authenticated;
