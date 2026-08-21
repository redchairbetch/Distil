-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: medical_referral_outcome
-- Created: 2026-08-21
-- Description: Medical Referral — a patient who presents with a red-flag
-- condition (FDA 21 CFR 801.420 list + asymmetry) is referred out for
-- medical evaluation before amplification can proceed. Two pieces:
--
-- 1. 'medical_referral' becomes its own outcome_disposition so the visit
--    lands in a measured reporting bucket instead of being lumped into
--    not_a_candidate (whose comment always said "e.g. medical referral
--    out" — now it keeps the true never-a-candidate cases only). Like
--    not_a_candidate / no_hearing_loss / did_not_test it is EXCLUDED
--    from close-rate denominators: the sale wasn't lost, it's paused
--    behind a medical evaluation. No reason-constraint change needed —
--    the referral's reasons are richer than the single decline-reason
--    enum (multi-select red flags + notes) and live in the dedicated
--    table below, so device_reason stays NULL for this disposition,
--    which the existing device_reason_iff_required constraint already
--    enforces.
--
-- 2. medical_referrals — one row per referral, backing both the
--    printable referral document the patient takes to their medical
--    appointment and the reason breakdown in Reports. The patient stays
--    a PROSPECT (they may return with medical clearance).

ALTER TYPE outcome_disposition ADD VALUE IF NOT EXISTS 'medical_referral';

CREATE TABLE public.medical_referrals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cascade like patient_notes so delete_patient_profile() needs no change.
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id     uuid NOT NULL REFERENCES public.clinics(id),
  provider_id   uuid NOT NULL REFERENCES public.staff(id),
  visit_id      uuid REFERENCES public.visits(id) ON DELETE SET NULL,
  referral_type text NOT NULL DEFAULT 'ent'
                CHECK (referral_type IN ('ent','physician','other')),
  -- Multi-select red-flag keys; vocabulary mirrored from
  -- src/lib/medicalReferral.js REFERRAL_REASONS — keep in sync.
  reasons       jsonb NOT NULL,
  -- Provider narrative for the referral document (required when
  -- 'other_medical_concern' is checked; enforced app-side).
  notes         text,
  -- Free-text practice / physician the patient was referred to, when known.
  referred_to   text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT medical_referrals_reasons_vocab CHECK (
    jsonb_typeof(reasons) = 'array'
    AND jsonb_array_length(reasons) >= 1
    AND reasons <@ '["ear_deformity","active_drainage","sudden_progressive_loss",
                     "unilateral_sudden_loss","significant_asymmetry","air_bone_gap",
                     "acute_chronic_dizziness","ear_pain_discomfort",
                     "cerumen_foreign_body","other_medical_concern"]'::jsonb
  )
);

-- Patient chart history + per-clinic reporting range scans.
CREATE INDEX medical_referrals_patient_created_idx
  ON public.medical_referrals (patient_id, created_at DESC);
CREATE INDEX medical_referrals_clinic_created_idx
  ON public.medical_referrals (clinic_id, created_at DESC);

ALTER TABLE public.medical_referrals ENABLE ROW LEVEL SECURITY;

-- Same shape as appointment_outcomes: writes scoped to the active clinic
-- via my_clinic_id(); org-wide read for All Locations search / reporting.
CREATE POLICY staff_manage_own_clinic_medical_referrals
  ON public.medical_referrals FOR ALL
  TO authenticated
  USING (clinic_id = my_clinic_id())
  WITH CHECK (clinic_id = my_clinic_id());

CREATE POLICY authenticated_read_all_medical_referrals
  ON public.medical_referrals FOR SELECT
  TO authenticated
  USING (true);

-- The printable referral document archives to the patient's chart like
-- quotes and purchase agreements (uploadPatientDocument, db.js — its JS
-- whitelist gains the same value).
ALTER TABLE public.patient_documents DROP CONSTRAINT patient_documents_kind_check;
ALTER TABLE public.patient_documents ADD CONSTRAINT patient_documents_kind_check
  CHECK (kind IN ('quote','purchase_agreement','kiosk_intake','medical_referral'));
