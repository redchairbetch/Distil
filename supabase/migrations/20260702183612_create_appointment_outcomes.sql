-- Close Appointment disposition capture. Two-layer design: device and care
-- plan dispositions are logged separately so the TPA care-plan attach rate
-- (the pilot's headline metric) stays computable when a patient accepts
-- devices but declines a care plan. Payer fields are snapshotted at the
-- moment of decision — never derived from the patient record at query time —
-- so a later insurance change cannot corrupt historical numbers.

create type appointment_context as enum ('new_fit','upgrade','care_plan_only');

create type outcome_disposition as enum (
  'committed',        -- signed today
  'deferred',         -- intends to proceed, decision pending (reason required)
  'declined',         -- chose not to proceed (reason required)
  'not_a_candidate',  -- e.g. medical referral out; excluded from close-rate denominators
  'no_decision',      -- diagnostic-only / ran out of time; keeps the denominator honest
  'not_applicable'    -- e.g. care plan layer when device layer is not_a_candidate
);

create type outcome_reason as enum (
  'price_budget',
  'spouse_family_consult',
  'wants_to_think',
  'no_perceived_need',
  'shopping_second_opinion',
  'insurance_benefit_issue',
  'health_life_circumstances',
  'satisfied_with_current_devices'
);

-- 'other_insurance' covers carriers billed without a TPA (live data has
-- insurance_coverage rows with tpa = null); folding those into 'tpa' or
-- 'private_pay' would corrupt the TPA attach-rate denominator.
create type payer_type as enum ('tpa','other_insurance','private_pay');

create table public.appointment_outcomes (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references public.patients(id),
  clinic_id             uuid not null references public.clinics(id),
  provider_id           uuid not null references public.staff(id),
  visit_id              uuid references public.visits(id),
  context               appointment_context not null,
  device_disposition    outcome_disposition not null,
  device_reason         outcome_reason,
  care_plan_disposition outcome_disposition not null,
  care_plan_reason      outcome_reason,
  care_plan_selected    text,   -- app care-plan vocabulary: 'complete' | 'punch' | 'paygo'
  payer_type            payer_type not null,
  payer_name            text,   -- 'TruHearing' | 'UHCH' | carrier name; null for private pay
  payer_plan_snapshot   jsonb,  -- plan details as-of decision moment
  closed_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),

  constraint device_reason_iff_deferred_declined check (
    (device_disposition in ('deferred','declined')) = (device_reason is not null)
  ),
  constraint care_plan_reason_iff_deferred_declined check (
    (care_plan_disposition in ('deferred','declined')) = (care_plan_reason is not null)
  ),
  constraint care_plan_selected_iff_committed check (
    (care_plan_disposition = 'committed') = (care_plan_selected is not null)
  ),
  constraint not_applicable_not_both_layers check (
    not (device_disposition = 'not_applicable' and care_plan_disposition = 'not_applicable')
  )
);

-- last_visit_date derivation (max(closed_at) per patient) + per-clinic reporting
create index appointment_outcomes_patient_closed_idx
  on public.appointment_outcomes (patient_id, closed_at desc);
create index appointment_outcomes_clinic_closed_idx
  on public.appointment_outcomes (clinic_id, closed_at desc);

alter table public.appointment_outcomes enable row level security;

-- Same shape as visits/upgrade_assessments: writes scoped to the active
-- clinic via my_clinic_id(); org-wide read for All Locations search.
create policy staff_manage_own_clinic_appointment_outcomes
  on public.appointment_outcomes for all
  to authenticated
  using (clinic_id = my_clinic_id())
  with check (clinic_id = my_clinic_id());

create policy authenticated_read_all_appointment_outcomes
  on public.appointment_outcomes for select
  to authenticated
  using (true);
