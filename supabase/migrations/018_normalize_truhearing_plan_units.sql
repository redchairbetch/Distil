-- 018: Normalize active TruHearing insurance_plans rows to cents + restore retail anchors.
--
-- Backlog #32. The current active TruHearing rows store price_per_aid in DOLLARS
-- with no retail_anchor_key (a later re-import), while the code contract is CENTS:
-- loadInsurancePlans() divides by 100 (db.js) and loadPricingReveal() joins
-- retail_anchor_key. The original cents+anchor rows were left inactive, so the
-- edit-coverage plan list showed TruHearing copays ~100x too low and the anchor
-- join returned null for any coverage linked to an active row.
--
-- Guard on the conversion: active dollar values are all 0..999; genuine cents
-- values are 0 or >= 9900. Verified pre-migration that every active dollar row's
-- inactive twin equals price_per_aid * 100 exactly (0 mismatches).

update insurance_plans
set price_per_aid = price_per_aid * 100
where active
  and tpa = 'TruHearing'
  and price_per_aid > 0
  and price_per_aid < 5000;

-- Rebuild retail anchors from tier_label (mapping per src/context.md — the
-- active set carries only these three labels; UHCH rows keep their deliberate
-- null anchors).
update insurance_plans
set retail_anchor_key = case tier_label
  when 'Premium'  then 'select'
  when 'Advanced' then 'advanced'
  when 'Standard' then 'standard'
end
where active
  and tpa = 'TruHearing'
  and retail_anchor_key is null;

-- Re-point the 7 insurance_coverage rows still linked to the retired inactive
-- snapshot rows at their active twins (verified 1:1 by carrier / plan_group /
-- tier_label pre-migration). Leaves the inactive rows unreferenced.
update insurance_coverage ic
set insurance_plan_id = t.id
from insurance_plans old
join insurance_plans t
  on t.active
 and t.carrier    = old.carrier
 and t.plan_group = old.plan_group
 and t.tier_label = old.tier_label
where ic.insurance_plan_id = old.id
  and not old.active;
