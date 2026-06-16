-- Upgrade assessment: one row per visit capturing the provider-administered
-- upgrade-readiness questionnaire + current-aid performance, the computed
-- readiness band (1-5), and (populated later, PR3/PR4) the reprogram-vs-upgrade
-- decision. Mirrors the recommendation_engine_output pattern: raw inputs in
-- jsonb + computed columns + a provider-editable rationale.

create table if not exists public.upgrade_assessments (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.visits(id) on delete cascade,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  clinic_id   uuid references public.clinics(id),
  -- raw questionnaire + performance inputs
  responses   jsonb not null default '{}'::jsonb,
  -- computed readiness
  readiness_score int,
  readiness_band  int check (readiness_band between 1 and 5),
  -- current-aid performance
  performance_tier text check (performance_tier in ('Excellent','Adequate','Marginal','Failing')),
  performance_tags text[] not null default '{}',
  -- reprogram-vs-upgrade decision (populated in PR3/PR4; nullable now)
  decision         text check (decision in ('reprogram','upgrade','provider_judgment')),
  decision_score   int,
  decision_rationale text,
  provider_edited_rationale text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists upgrade_assessments_visit_id_key on public.upgrade_assessments(visit_id);
create index if not exists upgrade_assessments_patient_id_idx on public.upgrade_assessments(patient_id);

drop trigger if exists upgrade_assessments_set_updated_at on public.upgrade_assessments;
create trigger upgrade_assessments_set_updated_at
  before update on public.upgrade_assessments
  for each row execute function update_updated_at();

alter table public.upgrade_assessments enable row level security;
drop policy if exists staff_see_own_clinic_upgrade_assessments on public.upgrade_assessments;
create policy staff_see_own_clinic_upgrade_assessments on public.upgrade_assessments
  for all
  using (patient_id in (select id from public.patients where clinic_id = my_clinic_id()));
