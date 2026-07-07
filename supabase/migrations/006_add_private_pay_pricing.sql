-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- 006_add_private_pay_pricing.sql
-- Phase 2 of the private-pay quote/PA backlog item: persist the patient's
-- chosen tier + per-aid price on the patient record so re-generated quotes
-- and purchase agreements from the patient list don't fall back to the
-- hardcoded $2,750. Mirrors insurance_coverage.tier / tier_price_per_aid
-- but lives on the patients row to avoid a NULL-carrier insurance_coverage
-- entry for non-insurance patients.
--
-- Both columns are nullable. Legacy private-pay patients written before
-- this migration keep NULL, and the patient-list handlers fall back to
-- $2,750 for those records.

ALTER TABLE patients
  ADD COLUMN private_pay_tier text,
  ADD COLUMN private_pay_price_per_aid integer;

COMMENT ON COLUMN patients.private_pay_tier IS 'Tier label chosen during private-pay flow (e.g. "Premium", "Advanced"). Mirrors insurance_coverage.tier for the insurance flow.';
COMMENT ON COLUMN patients.private_pay_price_per_aid IS 'Snapshot of clinic_retail_anchors.price_per_aid in cents at time of private-pay close. Mirrors insurance_coverage.tier_price_per_aid.';
