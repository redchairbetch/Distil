-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Catalog-hole "verify managed copay rate" flow.
-- When a device-driven managed-care patient (Nations / UHCH) lands on a COVERED
-- tier whose copay hasn't been reverse-engineered yet, the provider phones the
-- insurer and enters the confirmed per-aid copay. That rate is persisted on the
-- patient's own insurance_coverage row (immediate pricing) AND recorded here as a
-- pending verification for an admin to promote into insurance_plans, plugging the
-- hole network-wide. NOT a silent global write — insurance_plans stays admin-only.
-- copay is integer CENTS (matches insurance_coverage.tier_price_per_aid /
-- insurance_plans.price_per_aid).

create table if not exists public.insurance_rate_verifications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete set null,
  clinic_id uuid not null references public.clinics(id),
  provider_id uuid not null,
  tpa text,
  carrier text not null,
  plan_group text not null,
  tier_label text not null,
  verified_copay_per_aid integer not null check (verified_copay_per_aid >= 0),
  status text not null default 'pending' check (status in ('pending','promoted','dismissed')),
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

comment on table public.insurance_rate_verifications is
  'Provider-verified managed-care copays for catalog holes (a covered device-driven tier with no mapped rate). Written per-visit via record_rate_verification (SECURITY DEFINER); an admin promotes a pending row into insurance_plans to plug the hole network-wide. copay is integer cents.';

create index if not exists idx_irv_pending on public.insurance_rate_verifications (status) where status = 'pending';
create index if not exists idx_irv_plan on public.insurance_rate_verifications (tpa, carrier, plan_group, tier_label);

alter table public.insurance_rate_verifications enable row level security;

-- Org-wide authenticated read (mirrors insurance_coverage / price_adjustment_log).
create policy irv_authenticated_read on public.insurance_rate_verifications
  for select to authenticated using (true);

-- Resolve (promote / dismiss) is admin-only (mirrors admin_manage_plans).
create policy irv_admin_update on public.insurance_rate_verifications
  for update to authenticated
  using ((select role from public.staff where id = (select auth.uid())) = 'admin')
  with check ((select role from public.staff where id = (select auth.uid())) = 'admin');

-- No INSERT policy by design: rows are written only through the SECURITY DEFINER
-- RPC below, which stamps provider_id + clinic_id server-side (a traveling closer
-- can record at a non-home clinic, same rationale as log_price_adjustment).

create or replace function public.record_rate_verification(
  p_patient_id uuid,
  p_tpa text,
  p_carrier text,
  p_plan_group text,
  p_tier_label text,
  p_copay_per_aid integer,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff  uuid := auth.uid();
  v_clinic uuid;
  v_id     uuid;
begin
  if not exists (select 1 from staff where id = v_staff and active) then
    raise exception 'not authorized: caller is not active staff';
  end if;
  select clinic_id into v_clinic from patients where id = p_patient_id;
  if v_clinic is null then
    raise exception 'patient not found or patient has no clinic';
  end if;
  if p_copay_per_aid is null or p_copay_per_aid < 0 then
    raise exception 'invalid copay';
  end if;

  insert into insurance_rate_verifications (
    patient_id, clinic_id, provider_id, tpa, carrier, plan_group,
    tier_label, verified_copay_per_aid, notes
  ) values (
    p_patient_id, v_clinic, v_staff, p_tpa, p_carrier, p_plan_group,
    p_tier_label, p_copay_per_aid, p_notes
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_rate_verification(uuid,text,text,text,text,integer,text) from public;
revoke all on function public.record_rate_verification(uuid,text,text,text,text,integer,text) from anon;
grant execute on function public.record_rate_verification(uuid,text,text,text,text,integer,text) to authenticated;
