-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: device_selection_v1
-- Prod version: 20260502012214 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production). Internally labeled
-- "005_device_selection_v1". Builds on device_selection_pricing_foundation
-- (20260421182650), which created the device-selection / pricing tables incl.
-- price_adjustment_log, purchase_configuration, and the §10 clinic columns.

-- Migration: 005_device_selection_v1
-- Device Selection & Pricing Screen v1 foundation.

-- 1 — care_plan_catalog
CREATE TABLE care_plan_catalog (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id    uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_type    text NOT NULL CHECK (plan_type IN ('paygo','punch','complete')),
  display_name text NOT NULL,
  price        numeric(10,2),
  unit_label   text,
  active       boolean NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, plan_type)
);
CREATE INDEX care_plan_catalog_clinic_id_idx ON care_plan_catalog(clinic_id);

ALTER TABLE care_plan_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY care_plan_catalog_clinic_read
  ON care_plan_catalog FOR SELECT TO authenticated
  USING (clinic_id = my_clinic_id());

CREATE POLICY care_plan_catalog_clinic_write
  ON care_plan_catalog FOR ALL TO authenticated
  USING (clinic_id = my_clinic_id())
  WITH CHECK (clinic_id = my_clinic_id());

-- 2 — staff.is_manager flag
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN staff.is_manager IS
  'When true, this staff member can authorize price adjustments above the clinic''s manager-auth threshold via OverrideAuthorizationModal. Orthogonal to role.';

-- 3 — Partial unique index on recommendation_engine_output
CREATE UNIQUE INDEX IF NOT EXISTS recommendation_engine_output_one_active_per_patient
  ON recommendation_engine_output(patient_id) WHERE superseded_at IS NULL;

-- 4 — RLS hardening on six device-selection tables

-- 4a — cross_manufacturer_equivalence (global catalog; auth read, admin write)
DROP POLICY IF EXISTS cme_auth_read  ON cross_manufacturer_equivalence;
DROP POLICY IF EXISTS cme_auth_write ON cross_manufacturer_equivalence;

CREATE POLICY cme_authenticated_read
  ON cross_manufacturer_equivalence FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cme_admin_write
  ON cross_manufacturer_equivalence FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE staff.id = auth.uid() AND staff.role = 'admin'));

-- 4b — rebate_promo
DROP POLICY IF EXISTS rebate_promo_auth_read  ON rebate_promo;
DROP POLICY IF EXISTS rebate_promo_auth_write ON rebate_promo;

CREATE POLICY rebate_promo_clinic_read
  ON rebate_promo FOR SELECT TO authenticated
  USING (clinic_id IS NULL OR clinic_id = my_clinic_id());

CREATE POLICY rebate_promo_clinic_write
  ON rebate_promo FOR ALL TO authenticated
  USING  (clinic_id = my_clinic_id())
  WITH CHECK (clinic_id = my_clinic_id());

-- 4c — purchase_configuration
DROP POLICY IF EXISTS purchase_config_auth_read  ON purchase_configuration;
DROP POLICY IF EXISTS purchase_config_auth_write ON purchase_configuration;

CREATE POLICY purchase_config_clinic_read
  ON purchase_configuration FOR SELECT TO authenticated
  USING (clinic_id = my_clinic_id());

CREATE POLICY purchase_config_clinic_write
  ON purchase_configuration FOR ALL TO authenticated
  USING  (clinic_id = my_clinic_id())
  WITH CHECK (clinic_id = my_clinic_id());

-- 4d — purchase_line_item (scoped via parent purchase_configuration)
DROP POLICY IF EXISTS purchase_line_item_auth_read  ON purchase_line_item;
DROP POLICY IF EXISTS purchase_line_item_auth_write ON purchase_line_item;

CREATE POLICY purchase_line_item_clinic_read
  ON purchase_line_item FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM purchase_configuration pc
    WHERE pc.id = purchase_line_item.purchase_id AND pc.clinic_id = my_clinic_id()
  ));

CREATE POLICY purchase_line_item_clinic_write
  ON purchase_line_item FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM purchase_configuration pc
    WHERE pc.id = purchase_line_item.purchase_id AND pc.clinic_id = my_clinic_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_configuration pc
    WHERE pc.id = purchase_line_item.purchase_id AND pc.clinic_id = my_clinic_id()
  ));

-- 4e — price_adjustment_log
DROP POLICY IF EXISTS pal_auth_read  ON price_adjustment_log;
DROP POLICY IF EXISTS pal_auth_write ON price_adjustment_log;

CREATE POLICY pal_clinic_read
  ON price_adjustment_log FOR SELECT TO authenticated
  USING (clinic_id = my_clinic_id());

CREATE POLICY pal_clinic_write
  ON price_adjustment_log FOR ALL TO authenticated
  USING  (clinic_id = my_clinic_id())
  WITH CHECK (clinic_id = my_clinic_id());

-- 4f — recommendation_engine_output
DROP POLICY IF EXISTS reo_auth_read  ON recommendation_engine_output;
DROP POLICY IF EXISTS reo_auth_write ON recommendation_engine_output;

CREATE POLICY reo_clinic_read
  ON recommendation_engine_output FOR SELECT TO authenticated
  USING (clinic_id = my_clinic_id());

CREATE POLICY reo_clinic_write
  ON recommendation_engine_output FOR ALL TO authenticated
  USING  (clinic_id = my_clinic_id())
  WITH CHECK (clinic_id = my_clinic_id());
