-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Complex-benefit calculator (coinsurance / deductible / benefit-max / OOP).
-- For the rare commercial/PPO/FEP plans that don't fit the device-driven copay
-- model. The provider enters the VOB numbers from the billing department; the
-- reveal computes the patient's out-of-pocket via computeComplexBenefit. Null
-- for device-driven copay plans. jsonb is proportionate for ~1-2 patients/month
-- vs. a wide sparse column set.

alter table public.insurance_coverage
  add column if not exists complex_benefit jsonb;

comment on column public.insurance_coverage.complex_benefit is
  'Provider-entered VOB for complex commercial/PPO plans (coinsurance / deductible / benefit-max / OOP). Drives computeComplexBenefit in the Pricing Reveal. Null for device-driven copay plans. Shape: { coveragePercent, deductibleRemaining, benefitMax, benefitBasis, oopMaxRemaining, periodNote, finalOverridePerAid }.';
