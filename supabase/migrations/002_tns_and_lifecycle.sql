-- READY TO APPLY: Run this in Supabase SQL editor or via CLI migration
-- Migration: 002_tns_and_lifecycle
-- Created: 2026-04-06
-- Description: Adds patient lifecycle status, TNS outcomes, nurture enrollment,
--              Lima Charlie events, patient achievements, and punch card usage tables.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1A — Add status tracking to patients table
-- ═══════════════════════════════════════════════════════════════════════════════
-- prospect  = intake completed, not yet fitted
-- active    = fitted, current patient
-- tns       = did not proceed at point of sale
-- lapsed    = active patient who has gone silent / missed appointments
-- churned   = confirmed gone to competitor or deceased

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS patient_status text NOT NULL DEFAULT 'prospect'
    CHECK (patient_status IN ('prospect', 'active', 'tns', 'lapsed', 'churned')),
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz DEFAULT now();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1B — TNS outcomes table
-- ═══════════════════════════════════════════════════════════════════════════════
-- Captures the provider-selected reason why a patient did not proceed,
-- logged after the patient leaves.

CREATE TABLE tns_outcomes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id       uuid NOT NULL REFERENCES clinics(id),
  logged_by       uuid REFERENCES staff(id),
  outcome_reason  text NOT NULL CHECK (outcome_reason IN (
                    'needs_spouse_consult',
                    'cost_barrier',
                    'needs_more_research',
                    'not_ready_emotionally',
                    'prior_bad_experience',
                    'pain_not_acute_enough',
                    'insurance_confusion',
                    'other'
                  )),
  outcome_notes   text,
  quote_amount    integer,
  follow_up_date  date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON tns_outcomes(patient_id);
CREATE INDEX ON tns_outcomes(clinic_id);
CREATE INDEX ON tns_outcomes(outcome_reason);
ALTER TABLE tns_outcomes ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1C — Nurture enrollment table
-- ═══════════════════════════════════════════════════════════════════════════════
-- Tracks which campaign sequence a TNS patient is enrolled in
-- and their progress through it.

CREATE TABLE nurture_enrollment (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id           uuid NOT NULL REFERENCES clinics(id),
  campaign_type       text NOT NULL CHECK (campaign_type IN (
                        'tns_denial',
                        'tns_cost',
                        'tns_skeptic',
                        'tns_emotional',
                        'tns_research',
                        'tns_general',
                        'active_upgrade_y3',
                        'active_upgrade_y4',
                        'active_upgrade_y5_lima_charlie'
                      )),
  enrolled_at         timestamptz NOT NULL DEFAULT now(),
  current_touchpoint  integer NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'converted', 'unsubscribed')),
  converted_at        timestamptz,
  notes               text
);

CREATE INDEX ON nurture_enrollment(patient_id);
CREATE INDEX ON nurture_enrollment(clinic_id);
CREATE INDEX ON nurture_enrollment(campaign_type);
ALTER TABLE nurture_enrollment ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1D — Lima Charlie events table
-- ═══════════════════════════════════════════════════════════════════════════════
-- Records hearing aid donation events and links them to the donating
-- patient's lifetime record.

CREATE TABLE lima_charlie_events (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id             uuid NOT NULL REFERENCES clinics(id),
  fitting_id            uuid REFERENCES device_fittings(id),
  event_type            text NOT NULL CHECK (event_type IN ('donation', 'recipient')),
  certificate_number    text UNIQUE,
  certificate_issued_at timestamptz,
  donor_message         text,
  recipient_thank_you   text,
  social_consent        boolean NOT NULL DEFAULT false,
  swag_shipped          boolean NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON lima_charlie_events(patient_id);
CREATE INDEX ON lima_charlie_events(clinic_id);
ALTER TABLE lima_charlie_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1E — Patient achievements table
-- ═══════════════════════════════════════════════════════════════════════════════
-- Stores earned badges/milestones per patient for display in Aided.

CREATE TABLE patient_achievements (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  achievement   text NOT NULL CHECK (achievement IN (
                  'first_fitting',
                  'one_year_anniversary',
                  'three_year_anniversary',
                  'five_year_anniversary',
                  'six_year_survivor',
                  'care_plan_streak_6',
                  'care_plan_streak_12',
                  'lima_charlie_donor',
                  'early_upgrader',
                  'serial_upgrader',
                  'two_sets_one_year',
                  'hearing_champion'
                )),
  earned_at     timestamptz NOT NULL DEFAULT now(),
  acknowledged  boolean NOT NULL DEFAULT false
);

CREATE INDEX ON patient_achievements(patient_id);
ALTER TABLE patient_achievements ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1F — RLS Policies for all new tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- TNS outcomes: staff access by clinic
CREATE POLICY "Staff access tns_outcomes by clinic"
  ON tns_outcomes FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  ));

-- Nurture enrollment: staff access by clinic
CREATE POLICY "Staff access nurture_enrollment by clinic"
  ON nurture_enrollment FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  ));

-- Lima Charlie: staff access by clinic
CREATE POLICY "Staff access lima_charlie_events by clinic"
  ON lima_charlie_events FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  ));

-- Patient achievements: patients can read their own
CREATE POLICY "Patients read own achievements"
  ON patient_achievements FOR SELECT
  USING (patient_id = auth.uid());

-- Patient achievements: staff can read/write by clinic
CREATE POLICY "Staff manage patient achievements"
  ON patient_achievements FOR ALL
  USING (patient_id IN (
    SELECT id FROM patients WHERE clinic_id IN (
      SELECT clinic_id FROM staff WHERE id = auth.uid()
    )
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1G — Punch card usage table (addendum for Aided PWA migration)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Tracks punch card usage per patient, replacing window.storage persistence.

CREATE TABLE punch_card_usage (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  cleanings     integer NOT NULL DEFAULT 0,
  appointments  integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);
ALTER TABLE punch_card_usage ENABLE ROW LEVEL SECURITY;

-- Punch card: patients can read their own
CREATE POLICY "Patients read own punch card"
  ON punch_card_usage FOR SELECT
  USING (patient_id = auth.uid());

-- Punch card: staff can manage by clinic
CREATE POLICY "Staff manage punch card usage"
  ON punch_card_usage FOR ALL
  USING (patient_id IN (
    SELECT id FROM patients WHERE clinic_id IN (
      SELECT clinic_id FROM staff WHERE id = auth.uid()
    )
  ));
