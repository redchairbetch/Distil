-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- READY TO APPLY: Run this in Supabase SQL editor or via CLI migration
-- Migration: 004_expand_retail_anchors_manufacturer_class
-- Created: 2026-04-29
-- Description: Expand the manufacturer_class CHECK constraint on
--              clinic_retail_anchors to cover the hearing aid manufacturers
--              the catalog tracks, plus the legacy 'standard' class used
--              for clinic-wide manufacturer-agnostic retail anchors. The
--              original constraint only permitted 'signia', which blocked
--              the new Clinic Settings → Retail Anchors editor from saving
--              rows for any other vendor. Beltone is deliberately excluded
--              — we lack the proprietary software auth required to support
--              it (Rexton-only per project rules).

ALTER TABLE clinic_retail_anchors
  DROP CONSTRAINT IF EXISTS clinic_retail_anchors_manufacturer_class_check;

ALTER TABLE clinic_retail_anchors
  ADD CONSTRAINT clinic_retail_anchors_manufacturer_class_check
  CHECK (manufacturer_class IN ('standard', 'signia', 'rexton', 'phonak', 'oticon', 'starkey', 'widex'));
