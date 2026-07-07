-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- 010_sync_catalog_tech_levels.sql
-- Backlog #19 — catalog tech-level completeness. Migration 008 added the
-- 2IX/1IX product_catalog_tier (pricing) rows for the Signia IX families but
-- never updated product_catalog.tech_levels — the column that drives the
-- device-selection cascade. Result: 2IX/1IX were priceable but unreachable
-- in the UI. This migration syncs the cascade column to ground truth.
--
-- Three fixes:
--   1. Signia IX families (7): extend tech_levels to the full 7/5/3/2/1 IX
--      ladder. Silk Charge&Go IX is excluded — its tech_levels was already
--      complete.
--   2. Oticon Real: drop the phantom "4" — Real is a 3-tier line with no
--      product_catalog_tier row for a 4th tier, so picking it resolved no
--      price.
--   3. "Pure Charge & Go UX" (id entry-1777555930890): a stale catalog-editor
--      stub — superseded generation, generic tech levels, no pricing tier
--      rows, zero device_sides references. Deactivate it.
--
-- Every statement sets a fixed value, so re-applying is safe.

-- 1. Signia IX families — full 5-tier ladder ---------------------------------

UPDATE product_catalog
SET tech_levels = ARRAY['7IX','5IX','3IX','2IX','1IX']
WHERE id IN (
  'sig-insio-cic-ix', 'sig-insio-iic-ix', 'sig-insio-itc-ix', 'sig-insio-ite-ix',
  'sig-motion-ix', 'sig-pure-ix', 'sig-styletto-ix'
);

-- 2. Oticon Real — drop phantom tier "4" -------------------------------------

UPDATE product_catalog
SET tech_levels = ARRAY['1','2','3']
WHERE id = 'oti-real';

-- 3. Deactivate the stale "Pure Charge & Go UX" stub -------------------------

UPDATE product_catalog
SET active = false
WHERE id = 'entry-1777555930890';
