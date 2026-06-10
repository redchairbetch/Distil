-- 020: Delete the retired inactive insurance_plans snapshot (Kurt-approved 2026-06-10).
--
-- Follow-up to 018. These 179 rows are the original cents+anchor TruHearing
-- import that a later re-import superseded (deactivated rather than replaced).
-- After 018 normalized the active set to cents, rebuilt its anchors, and
-- re-pointed the 7 insurance_coverage FKs, the inactive set carries no unique
-- data and nothing references it (verified against both FK tables:
-- insurance_coverage.insurance_plan_id and plan_product_eligibility.plan_id —
-- 0 references each).

delete from insurance_plans
where not active
  and tpa = 'TruHearing';
