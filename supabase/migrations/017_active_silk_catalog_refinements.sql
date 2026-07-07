-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- 017_active_silk_catalog_refinements.sql
-- Catalog refinements for the Signia instant-fit (IF) families surfaced during
-- PR #94 testing. Applied to the live DB via Supabase MCP (migration
-- "active_silk_catalog_refinements"); kept here for record. CATALOG_DEFAULT in
-- src/Distil.jsx is the fallback and is kept in sync with these values.

-- Active IX: simplify family to "Active IX", drop the redundant variant row
-- (Pro/entry were duplicated against the tech levels), and store rich tech-level
-- display labels in metadata. tech_levels values stay 7IX/1IX so the
-- product_catalog_tier pricing rows keep matching — this is a display-only change.
update product_catalog
set family = 'Active IX',
    variants = '{}',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'techLevelLabels', jsonb_build_object(
        '7IX', 'Active Pro IX (7IX — full feature set)',
        '1IX', 'Active IX (1IX — entry level)'
      )
    )
where id = 'sig-active-ix';

-- Silk IX: the only color choice is the faceplate (Black or Mocha); the shell is
-- fixed red (right) / blue (left) by side. Flag faceplate in metadata so the
-- device-selection color picker labels it "Faceplate Color" and shows the
-- side-specific shell note.
update product_catalog
set colors = array['Black','Mocha'],
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('faceplate', true)
where id = 'sig-silk-ix';
