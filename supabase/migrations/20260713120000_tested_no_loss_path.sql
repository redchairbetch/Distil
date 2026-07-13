-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: tested_no_loss_path
-- Created: 2026-07-13
-- Description: Tested No Loss (TNL) — the third point-of-sale path alongside
-- active (fitted) and tns (tested not sold). A TNL patient tested within
-- normal limits (all thresholds ≤ 20 dB, the domain's normal-hearing rule),
-- so there was never a treatment recommendation to accept or decline. The
-- path: baseline on file → annual retest recall → tnl nurture campaign.

-- 1. patients.patient_status gains 'tnl'
ALTER TABLE patients DROP CONSTRAINT patients_patient_status_check;
ALTER TABLE patients ADD CONSTRAINT patients_patient_status_check
  CHECK (patient_status IN ('prospect', 'active', 'tns', 'tnl', 'lapsed', 'churned'));

-- 2. Campaign templates can trigger on a TNL designation (annual retest
--    reminders / hearing-wellness education, sibling to the 'tns' trigger).
ALTER TABLE campaign_templates DROP CONSTRAINT campaign_templates_trigger_type_check;
ALTER TABLE campaign_templates ADD CONSTRAINT campaign_templates_trigger_type_check
  CHECK (trigger_type IN ('fitting_date', 'manual', 'warranty_expiry', 'tns', 'tnl'));

-- 3. Close Appointment vocabulary: 'no_hearing_loss' device disposition.
--    Deliberately NOT in the close-rate denominator (like not_a_candidate):
--    normal hearing means there was no sales opportunity to close.
ALTER TYPE outcome_disposition ADD VALUE IF NOT EXISTS 'no_hearing_loss';
