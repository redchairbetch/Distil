/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. See the LICENSE file at the repository root.
 */

-- Backlog #42 (phase a) — explicit earmold selection on device_sides.
--
-- Until now "the patient needs an earmold" was derived (earmold:true on
-- RECEIVER_POWERS / TH_GAIN_MATRIX rows) and recorded only as the magic
-- string 'Custom Earmold' stuffed into the dome column — so a catalog edit
-- could silently rewrite what a historical fitting meant, and nothing stored
-- WHICH mold was ordered. Coupling and the earmold configuration become real
-- columns; assembleSide shims legacy 'Custom Earmold' dome rows to
-- coupling='earmold' on read. Flat columns (not jsonb) to match every other
-- device_sides field and keep buildSideRow/assembleSide symmetric.

alter table public.device_sides
  add column if not exists coupling          text check (coupling in ('dome', 'earmold')),
  add column if not exists earmold_style     text,
  add column if not exists earmold_material  text,
  add column if not exists earmold_color     text,
  add column if not exists earmold_vent      text,
  add column if not exists earmold_vent_size text,
  add column if not exists earmold_canal     text,
  add column if not exists earmold_notes     text;

comment on column public.device_sides.coupling is
  'How a RIC/BTE couples to the ear: dome or custom earmold. Null for custom-shell styles and legacy rows (legacy earmolds read via the dome=''Custom Earmold'' shim).';
comment on column public.device_sides.earmold_style is
  'earmold_catalog style_id for this side''s mold (backlog #42).';
