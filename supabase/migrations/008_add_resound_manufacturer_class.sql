-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- 008_add_resound_manufacturer_class.sql
-- Three things:
--   1. Expand the manufacturer_class CHECK on clinic_retail_anchors to allow
--      'resound' (migration 004 enumerated the others; ReSound was missed).
--   2. Seed retail anchor rows for the four manufacturer classes that were
--      empty (rexton, starkey, widex, resound) so the per-ear pricing
--      refactor (backlog #18) has data to resolve against. Prices match the
--      existing Oticon/Phonak pattern ($4,497.50 / $3,997.50 / $3,497.50 /
--      $2,997.50). Labels per the brand × tech-level comparison provided by
--      Kurt. Each block guards against re-seeding so re-applying is safe.
--   3. Seed product_catalog_tier rows for the Signia IX families at 2IX
--      (rank 2) and 1IX (rank 1) — these tech levels are real but rarely
--      dispensed, and the IX families shipped at rank 5/4/3 only.
--      Active IX is intentionally excluded — it ships as 7IX/1IX only.
--
-- Notes:
--   - Anchor seeds are scoped to the existing dev clinic. Production roll-
--     out will require seeding per-clinic via the Retail Anchors editor in
--     Settings, or extending this migration with a clinic-loop.
--   - Top-tier label normalized to 'Premium' (vs. legacy 'Select') was
--     handled in an earlier migration; we follow that vocabulary here.

-- 1. CHECK constraint --------------------------------------------------------

ALTER TABLE clinic_retail_anchors
  DROP CONSTRAINT IF EXISTS clinic_retail_anchors_manufacturer_class_check;

ALTER TABLE clinic_retail_anchors
  ADD CONSTRAINT clinic_retail_anchors_manufacturer_class_check
  CHECK (manufacturer_class IN ('standard', 'signia', 'rexton', 'phonak', 'oticon', 'starkey', 'widex', 'resound'));

-- 2. Retail anchor seeds (idempotent per manufacturer_class) -----------------

DO $$
DECLARE
  v_clinic_id uuid := 'ae14da3e-9774-4c01-924b-f9bf3cee6a03';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clinic_retail_anchors
                 WHERE clinic_id = v_clinic_id AND manufacturer_class = 'rexton') THEN
    INSERT INTO clinic_retail_anchors (id, clinic_id, manufacturer_class, label, price_per_aid, sort_order) VALUES
      (gen_random_uuid(), v_clinic_id, 'rexton', '80', 4497.50, 1),
      (gen_random_uuid(), v_clinic_id, 'rexton', '60', 3997.50, 2),
      (gen_random_uuid(), v_clinic_id, 'rexton', '40', 3497.50, 3),
      (gen_random_uuid(), v_clinic_id, 'rexton', '20', 2997.50, 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clinic_retail_anchors
                 WHERE clinic_id = v_clinic_id AND manufacturer_class = 'starkey') THEN
    INSERT INTO clinic_retail_anchors (id, clinic_id, manufacturer_class, label, price_per_aid, sort_order) VALUES
      (gen_random_uuid(), v_clinic_id, 'starkey', '24', 4497.50, 1),
      (gen_random_uuid(), v_clinic_id, 'starkey', '20', 3997.50, 2),
      (gen_random_uuid(), v_clinic_id, 'starkey', '16', 3497.50, 3),
      (gen_random_uuid(), v_clinic_id, 'starkey', '12', 2997.50, 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clinic_retail_anchors
                 WHERE clinic_id = v_clinic_id AND manufacturer_class = 'widex') THEN
    INSERT INTO clinic_retail_anchors (id, clinic_id, manufacturer_class, label, price_per_aid, sort_order) VALUES
      (gen_random_uuid(), v_clinic_id, 'widex', '440', 4497.50, 1),
      (gen_random_uuid(), v_clinic_id, 'widex', '330', 3997.50, 2),
      (gen_random_uuid(), v_clinic_id, 'widex', '220', 3497.50, 3),
      (gen_random_uuid(), v_clinic_id, 'widex', '110', 2997.50, 4);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clinic_retail_anchors
                 WHERE clinic_id = v_clinic_id AND manufacturer_class = 'resound') THEN
    INSERT INTO clinic_retail_anchors (id, clinic_id, manufacturer_class, label, price_per_aid, sort_order) VALUES
      (gen_random_uuid(), v_clinic_id, 'resound', '9', 4497.50, 1),
      (gen_random_uuid(), v_clinic_id, 'resound', '7', 3997.50, 2),
      (gen_random_uuid(), v_clinic_id, 'resound', '5', 3497.50, 3),
      (gen_random_uuid(), v_clinic_id, 'resound', '4', 2997.50, 4);
  END IF;
END $$;

-- 3. Signia IX 2IX/1IX tier rows (idempotent via UNIQUE constraint) ---------

INSERT INTO product_catalog_tier (product_catalog_id, tier_name, tier_rank) VALUES
  ('sig-pure-ix',       '2IX', 2),
  ('sig-pure-ix',       '1IX', 1),
  ('sig-styletto-ix',   '2IX', 2),
  ('sig-styletto-ix',   '1IX', 1),
  ('sig-motion-ix',     '2IX', 2),
  ('sig-motion-ix',     '1IX', 1),
  ('sig-silk-ix',       '2IX', 2),
  ('sig-silk-ix',       '1IX', 1),
  ('sig-insio-iic-ix',  '2IX', 2),
  ('sig-insio-iic-ix',  '1IX', 1),
  ('sig-insio-cic-ix',  '2IX', 2),
  ('sig-insio-cic-ix',  '1IX', 1),
  ('sig-insio-itc-ix',  '2IX', 2),
  ('sig-insio-itc-ix',  '1IX', 1),
  ('sig-insio-ite-ix',  '2IX', 2),
  ('sig-insio-ite-ix',  '1IX', 1)
ON CONFLICT (product_catalog_id, tier_name) DO NOTHING;
