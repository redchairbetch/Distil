-- BCBS Federal Employees Program: allowance-style plan (Kurt, 2026-08-04).
-- Standard product portfolio (regular catalog, clinic retail billed) with a
-- $2,500 benefit toward any hearing aid purchase, renewable every 3 calendar
-- years. No TPA and no copay tiers — patient cost is computed per-VOB via the
-- complex-benefit calculator (coverage 100%, benefit max $2,500 combined).
-- Single placeholder tier row follows the VA-CCN precedent: tier_label is a
-- deliberately non-{Standard,Advanced,Premium} label so isPrivateLabelPlan
-- stays false and the wizard keeps the standard-catalog cascade.
INSERT INTO insurance_plans (carrier, plan_group, tpa, tier_label, price_per_aid, active, notes)
VALUES (
  'Blue Cross Blue Shield',
  'Federal Employees Program',
  NULL,
  'Allowance',
  0,
  true,
  '$2,500 allowance toward any hearing aid purchase, once every 3 calendar years. Standard product portfolio — devices from the regular catalog at clinic retail. No copay tiers: price via the VOB / complex-benefit calculator on Device Selection (coverage 100%, benefit max $2,500 combined, period "every 3 yrs"; deductible/OOP per the VOB). The $0 here is a placeholder, not a copay.'
);
