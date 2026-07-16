-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: did_not_test_vocabulary
-- Created: 2026-07-16
-- Description: "Did Not Test" — the wizard's Testing-step fork for visits
-- where no audiometric test happened (e.g. the patient booked the slot just
-- for wax removal). The patient profile is already saved as a draft; the fork
-- closes the appointment with a did_not_test disposition + a reason, skipping
-- tier/device/care-plan entirely. The patient stays a PROSPECT (never demoted
-- to tns — no recommendation was ever made) and, like not_a_candidate and
-- no_hearing_loss, the visit is excluded from close-rate denominators.
--
-- Enum additions only — the reason-required constraint rewrite lives in the
-- sibling migration 20260716120100 because a new enum value cannot be used
-- (as an enum literal) inside the transaction that added it.

-- 1. Close Appointment vocabulary: 'did_not_test' device disposition.
ALTER TYPE outcome_disposition ADD VALUE IF NOT EXISTS 'did_not_test';

-- 2. Why the test didn't happen — a separate reason vocabulary from the
--    decline reasons (those explain a "no" to a recommendation; these explain
--    why no recommendation could exist).
ALTER TYPE outcome_reason ADD VALUE IF NOT EXISTS 'cerumen_management_only';
ALTER TYPE outcome_reason ADD VALUE IF NOT EXISTS 'patient_declined_testing';
ALTER TYPE outcome_reason ADD VALUE IF NOT EXISTS 'medical_contraindication';
ALTER TYPE outcome_reason ADD VALUE IF NOT EXISTS 'equipment_issue';
ALTER TYPE outcome_reason ADD VALUE IF NOT EXISTS 'ran_out_of_time';
