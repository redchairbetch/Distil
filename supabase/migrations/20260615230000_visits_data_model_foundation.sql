-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Visits: one row per clinical encounter. Establishes longitudinal history so
-- the upgrade pathway can diff a baseline audiogram against a new visit and
-- anchor the patient on their multi-year hearing journey. Prior to this, every
-- audiogram/fitting save deleted the previous one (overwrite-on-save), leaving
-- no history. The schema already allowed multiple rows per patient (only
-- non-unique patient_id indexes); this makes a clinical encounter the owner.

create table if not exists public.visits (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  clinic_id   uuid references public.clinics(id),
  staff_id    uuid references public.staff(id),
  visit_type  text not null default 'initial_fit'
                check (visit_type in ('initial_fit','annual_check','upgrade_consult','device_eval','fit_follow_up')),
  visit_date  date not null default current_date,
  status      text not null default 'in_progress'
                check (status in ('in_progress','completed','cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists visits_patient_id_idx on public.visits(patient_id);
create index if not exists visits_visit_date_idx on public.visits(visit_date);

-- keep updated_at fresh (reuse the existing shared trigger fn)
drop trigger if exists visits_set_updated_at on public.visits;
create trigger visits_set_updated_at
  before update on public.visits
  for each row execute function update_updated_at();

-- Link the clinical artifacts to the visit that produced them. Nullable +
-- ON DELETE SET NULL so deleting a visit never destroys the audiogram/fitting.
alter table public.audiograms      add column if not exists visit_id uuid references public.visits(id) on delete set null;
alter table public.device_fittings add column if not exists visit_id uuid references public.visits(id) on delete set null;
create index if not exists audiograms_visit_id_idx      on public.audiograms(visit_id);
create index if not exists device_fittings_visit_id_idx on public.device_fittings(visit_id);

-- RLS: mirror the audiograms/device_fittings clinic-scoped policy.
alter table public.visits enable row level security;
drop policy if exists staff_see_own_clinic_visits on public.visits;
create policy staff_see_own_clinic_visits on public.visits
  for all
  using (patient_id in (select id from public.patients where clinic_id = my_clinic_id()));

-- Backfill: every existing patient with an audiogram or fitting becomes one
-- completed 'initial_fit' visit (their "visit 1"), anchored at the earliest
-- known clinical date. New flows append visit 2+.
with anchor as (
  select
    p.id          as patient_id,
    p.clinic_id   as clinic_id,
    coalesce(
      (select min(df.fitting_date) from public.device_fittings df where df.patient_id = p.id and df.fitting_date is not null),
      (select min(ag.test_date)    from public.audiograms     ag where ag.patient_id = p.id),
      p.created_at::date
    )            as visit_date
  from public.patients p
  where exists (select 1 from public.device_fittings df where df.patient_id = p.id)
     or exists (select 1 from public.audiograms     ag where ag.patient_id = p.id)
)
insert into public.visits (patient_id, clinic_id, visit_type, visit_date, status)
select patient_id, clinic_id, 'initial_fit', visit_date, 'completed'
from anchor;

-- Point existing artifacts at their patient's freshly-created initial_fit visit.
update public.audiograms ag
   set visit_id = v.id
  from public.visits v
 where v.patient_id = ag.patient_id
   and ag.visit_id is null;

update public.device_fittings df
   set visit_id = v.id
  from public.visits v
 where v.patient_id = df.patient_id
   and df.visit_id is null;
