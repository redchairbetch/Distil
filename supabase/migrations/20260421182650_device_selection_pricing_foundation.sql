-- Migration: device_selection_pricing_foundation
-- Prod version: 20260421182650 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production).
--
-- Creates the device-selection / pricing schema, including price_adjustment_log
-- (with GENERATED delta columns + the §6 reason-code CHECK), purchase_configuration,
-- purchase_line_item, and the §10 clinic columns (default_bundle_mode,
-- override_manager_auth_threshold_percent, financing_partners). The discount
-- authorization feature (PR #104) builds its write path on this table.

-- ============================================================================
-- Device Selection & Pricing Foundation
-- Spec: Device Selection & Pricing Screen v1 (2026-04-21)
-- Phase 0 first migration: schema only, no seed data
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. product_catalog_tier
--    One row per tier within a product_catalog family.
--    Carries MSRP (informational), fitting range, spec details.
-- ----------------------------------------------------------------------------
CREATE TABLE product_catalog_tier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_catalog_id text NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,
  tier_name text NOT NULL,
  tier_rank integer NOT NULL CHECK (tier_rank >= 1),
  msrp numeric(10,2),
  platform_chip text,
  battery_type text CHECK (
    battery_type IS NULL OR battery_type IN (
      'rechargeable_liion','rechargeable_silver_zinc',
      'disposable_zinc_air','disposable_312','disposable_10','disposable_13'
    )
  ),
  rechargeable boolean,
  streaming_protocols text[] NOT NULL DEFAULT '{}',
  ip_rating text,
  telecoil boolean,
  directional_mic text CHECK (
    directional_mic IS NULL OR directional_mic IN (
      'omni','fixed_directional','adaptive_directional','beamforming'
    )
  ),
  fitting_range_low_hz_db integer,
  fitting_range_high_hz_db integer,
  bundled_cc_plus_compatible boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_catalog_id, tier_name)
);

CREATE INDEX idx_pct_product_catalog_id ON product_catalog_tier(product_catalog_id);
CREATE INDEX idx_pct_tier_rank ON product_catalog_tier(tier_rank);

ALTER TABLE product_catalog_tier ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_catalog_tier_auth_read" ON product_catalog_tier
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_catalog_tier_auth_write" ON product_catalog_tier
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. cross_manufacturer_equivalence
-- ----------------------------------------------------------------------------
CREATE TABLE cross_manufacturer_equivalence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_tier_id uuid NOT NULL REFERENCES product_catalog_tier(id) ON DELETE CASCADE,
  equivalent_tier_id uuid NOT NULL REFERENCES product_catalog_tier(id) ON DELETE CASCADE,
  equivalence_confidence text NOT NULL DEFAULT 'close'
    CHECK (equivalence_confidence IN ('exact','close','approximate')),
  notes text,
  last_reviewed date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (anchor_tier_id <> equivalent_tier_id),
  UNIQUE (anchor_tier_id, equivalent_tier_id)
);

CREATE INDEX idx_cme_anchor ON cross_manufacturer_equivalence(anchor_tier_id);
CREATE INDEX idx_cme_equivalent ON cross_manufacturer_equivalence(equivalent_tier_id);

ALTER TABLE cross_manufacturer_equivalence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cme_auth_read" ON cross_manufacturer_equivalence
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cme_auth_write" ON cross_manufacturer_equivalence
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. rebate_promo
-- ----------------------------------------------------------------------------
CREATE TABLE rebate_promo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL
    CHECK (type IN ('seasonal_promo','manufacturer_rebate','qualifying_program')),
  scope_manufacturer text CHECK (
    scope_manufacturer IS NULL OR scope_manufacturer IN (
      'signia','phonak','oticon','starkey','resound','widex','truhearing','other'
    )
  ),
  scope_device_family text REFERENCES product_catalog(id) ON DELETE SET NULL,
  scope_tier_rank integer,
  scope_patient_attribute text
    CHECK (scope_patient_attribute IS NULL OR scope_patient_attribute IN (
      'veteran','hardship','loyalty','other'
    )),
  discount_type text NOT NULL
    CHECK (discount_type IN ('flat_amount','percentage','override_price')),
  discount_value numeric(10,2) NOT NULL,
  active_from timestamptz NOT NULL,
  active_to timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (active_to > active_from)
);

CREATE INDEX idx_rebate_promo_active ON rebate_promo(clinic_id, active_to)
  WHERE active = true;

ALTER TABLE rebate_promo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rebate_promo_auth_read" ON rebate_promo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rebate_promo_auth_write" ON rebate_promo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. purchase_configuration
-- ----------------------------------------------------------------------------
CREATE TABLE purchase_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  bundle_mode text NOT NULL DEFAULT 'bundled'
    CHECK (bundle_mode IN ('bundled','unbundled')),
  total_displayed_price numeric(10,2),
  finalized boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pc_patient_id ON purchase_configuration(patient_id);
CREATE INDEX idx_pc_clinic_finalized ON purchase_configuration(clinic_id, finalized);

ALTER TABLE purchase_configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_config_auth_read" ON purchase_configuration
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "purchase_config_auth_write" ON purchase_configuration
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. purchase_line_item
-- ----------------------------------------------------------------------------
CREATE TABLE purchase_line_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchase_configuration(id) ON DELETE CASCADE,
  product_type text NOT NULL
    CHECK (product_type IN ('device_left','device_right','care_plan','accessory')),
  product_catalog_tier_id uuid REFERENCES product_catalog_tier(id),
  care_plan_type text
    CHECK (care_plan_type IS NULL OR care_plan_type IN (
      'complete','basic','private','paygo','punch'
    )),
  listed_price numeric(10,2) NOT NULL,
  adjusted_price numeric(10,2),
  rebate_promo_id uuid REFERENCES rebate_promo(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pli_purchase_id ON purchase_line_item(purchase_id);

ALTER TABLE purchase_line_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_line_item_auth_read" ON purchase_line_item
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "purchase_line_item_auth_write" ON purchase_line_item
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. price_adjustment_log
-- ----------------------------------------------------------------------------
CREATE TABLE price_adjustment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider_id uuid NOT NULL REFERENCES staff(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  purchase_id uuid REFERENCES purchase_configuration(id) ON DELETE SET NULL,
  purchase_line_item_id uuid REFERENCES purchase_line_item(id) ON DELETE SET NULL,
  product_type text NOT NULL
    CHECK (product_type IN ('device','bundle','care_plan','accessory')),
  sku text,
  original_price numeric(10,2) NOT NULL,
  adjusted_price numeric(10,2) NOT NULL,
  delta_amount numeric(10,2) GENERATED ALWAYS AS (adjusted_price - original_price) STORED,
  delta_percent numeric(6,2) GENERATED ALWAYS AS (
    CASE WHEN original_price = 0 THEN 0
         ELSE ROUND(((adjusted_price - original_price) / original_price * 100)::numeric, 2)
    END
  ) STORED,
  reason_code text NOT NULL
    CHECK (reason_code IN (
      'preferred_provider_courtesy','hardship_consideration','bundle_adjustment',
      'price_match','loyalty_returning_patient','clinical_judgment','other'
    )),
  reason_text text,
  required_manager_auth boolean NOT NULL DEFAULT false,
  manager_id uuid REFERENCES staff(id),
  CHECK (reason_code <> 'other' OR reason_text IS NOT NULL),
  CHECK (required_manager_auth = false OR manager_id IS NOT NULL)
);

CREATE INDEX idx_pal_provider_id ON price_adjustment_log(provider_id, created_at DESC);
CREATE INDEX idx_pal_patient_id ON price_adjustment_log(patient_id, created_at DESC);
CREATE INDEX idx_pal_clinic_created ON price_adjustment_log(clinic_id, created_at DESC);

ALTER TABLE price_adjustment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pal_auth_read" ON price_adjustment_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pal_auth_write" ON price_adjustment_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. recommendation_engine_output
-- ----------------------------------------------------------------------------
CREATE TABLE recommendation_engine_output (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  recommended_tier_rank integer NOT NULL,
  recommended_product_catalog_tier_id uuid REFERENCES product_catalog_tier(id),
  down_tier_score integer NOT NULL DEFAULT 0,
  contributing_inputs jsonb NOT NULL DEFAULT '{}',
  generated_rationale_text text NOT NULL,
  provider_edited_rationale_text text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz
);

CREATE INDEX idx_reo_patient_active ON recommendation_engine_output(patient_id, generated_at DESC)
  WHERE superseded_at IS NULL;

ALTER TABLE recommendation_engine_output ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reo_auth_read" ON recommendation_engine_output
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reo_auth_write" ON recommendation_engine_output
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. Alter clinic_retail_anchors
-- ----------------------------------------------------------------------------
ALTER TABLE clinic_retail_anchors
  ADD COLUMN manufacturer_class text NOT NULL DEFAULT 'signia'
    CHECK (manufacturer_class IN ('signia','standard'));

ALTER TABLE clinic_retail_anchors DROP CONSTRAINT clinic_retail_anchors_pkey;
ALTER TABLE clinic_retail_anchors ADD PRIMARY KEY (id, clinic_id, manufacturer_class);

-- ----------------------------------------------------------------------------
-- 9. Alter intakes
-- ----------------------------------------------------------------------------
ALTER TABLE intakes
  ADD COLUMN patient_id uuid REFERENCES patients(id) ON DELETE SET NULL;

CREATE INDEX idx_intakes_patient_id ON intakes(patient_id);

-- ----------------------------------------------------------------------------
-- 10. Alter clinics
-- ----------------------------------------------------------------------------
ALTER TABLE clinics
  ADD COLUMN default_bundle_mode text NOT NULL DEFAULT 'bundled'
    CHECK (default_bundle_mode IN ('bundled','unbundled')),
  ADD COLUMN override_manager_auth_threshold_percent numeric(5,2) NOT NULL DEFAULT 40.00,
  ADD COLUMN financing_partners jsonb NOT NULL DEFAULT '{}'::jsonb;
