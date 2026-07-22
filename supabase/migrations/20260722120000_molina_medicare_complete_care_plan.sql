-- ─────────────────────────────────────────────────────────────────────────────
-- Molina Medicare Complete Care (HMO D-SNP) — second NationsBenefits plan
-- ─────────────────────────────────────────────────────────────────────────────
-- Contract H5628-001-000. Official plan name; NO relation to the Complete
-- Care+ care plan. Administered by NationsBenefits like the Aetna · Nations
-- Hearing plan and covered by the SAME device catalog, but Molina renames all
-- six product levels and re-prices the flat per-aid copays:
--
--   canonical rung   Molina label   copay/aid
--   Standard      →  Entry          $0
--   Select        →  Basic          $175
--   Superior Plus →  Prime          $475
--   Advanced      →  Preferred      $775
--   Advanced Plus →  Advanced       $1,075
--   Specialty     →  Premium        $1,475
--
-- Device→tier resolution stays in nationsCoverageTier() (canonical rungs);
-- NATIONS_PLAN_TIER_ALIASES (lib/pricing.js) translates rung → Molina label
-- before the tier-row lookup. NOTE Molina's 'Advanced' and 'Premium' are
-- DIFFERENT rungs than Aetna's 'Advanced' / TruHearing's 'Premium' — the
-- alias layer exists precisely so these colliding labels can't cross-match.
--
-- Prices are integer CENTS (Entry's 0 is a real $0 member cost, not a hole).
-- No retail_anchor_key — Nations plans anchor savings off the device's own
-- manufacturer-class retail (resolveClassRetailPerAid), not a tier slug.
--
-- STAGED active = false until Kurt verifies against the full NationsBenefits
-- portal catalog (rung alignment) and flips the plan on in Admin → Insurance
-- Plans — same go-live pattern as the Aetna Nations plan. Fitting fees for
-- Molina are NOT yet known (portal "Show Fitting Fees" toggle); until they're
-- imported, Molina commits accrue no clinic fee in Reports by design.

insert into insurance_plans (carrier, plan_group, tpa, tier_label, price_per_aid, active, notes)
select v.carrier, v.plan_group, v.tpa, v.tier_label, v.price_per_aid, v.active, v.notes
from (values
  ('Molina', 'Medicare Complete Care HMO D-SNP', 'Nations', 'Entry',          0, false,
   'NationsBenefits · Molina Medicare Complete Care (HMO D-SNP) H5628-001-000. No relation to the Complete Care+ care plan. Copays flow to NationsBenefits; clinic revenue is the fitting fee (schedule pending import).'),
  ('Molina', 'Medicare Complete Care HMO D-SNP', 'Nations', 'Basic',      17500, false, null),
  ('Molina', 'Medicare Complete Care HMO D-SNP', 'Nations', 'Prime',      47500, false, null),
  ('Molina', 'Medicare Complete Care HMO D-SNP', 'Nations', 'Preferred',  77500, false, null),
  ('Molina', 'Medicare Complete Care HMO D-SNP', 'Nations', 'Advanced',  107500, false, null),
  ('Molina', 'Medicare Complete Care HMO D-SNP', 'Nations', 'Premium',   147500, false, null)
) as v(carrier, plan_group, tpa, tier_label, price_per_aid, active, notes)
where not exists (
  select 1 from insurance_plans p
  where p.carrier = v.carrier and p.plan_group = v.plan_group and p.tier_label = v.tier_label
);
