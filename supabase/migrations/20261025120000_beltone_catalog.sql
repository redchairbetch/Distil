-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Beltone catalog, gated per clinic by proprietary fitting-software auth.
--
-- Beltone devices can only be programmed with Solus Max. The old rule ("Beltone
-- excluded everywhere") becomes a per-clinic authorization (Kurt, 2026-10-17):
--   · clinics.proprietary_software_auth lists the brand keys a clinic can fit
--     (e.g. {beltone}); lib/catalogVisibility hides every
--     product_catalog.requires_proprietary_software family from clinics that
--     don't list its brand. The flag column already existed (all false) — this
--     is its first use.
--   · clinic_retail_anchors gains a 'beltone' class. No anchors are seeded
--     here: the app seeds DEFAULT_RETAIL_ANCHORS.beltone the first time a
--     clinic enables Beltone in Settings. Pricing is per pair 17 $6,499 ·
--     9 $5,999 · 6 $4,999 · 4 $4,499 → $3,249.50 / $2,999.50 / $2,499.50 /
--     $2,249.50 per aid.
--
-- Current line (source: Beltone trainer product sheet, Oct 2026): Illuminate
-- RIE 62/63/64, Illuminate customs, Boost Max S BTE — tech levels 17/9/6/4 →
-- tier ranks 5/4/3/2. Commence (3/2) deliberately NOT catalogued.
--
-- DEPLOY ORDER: product_catalog rows land active = FALSE. Code deployed before
-- this PR doesn't know the proprietary gate and would show Beltone to every
-- clinic. 20261025120100_activate_beltone_catalog.sql flips them on and must be
-- applied only after the gating code is live.
--
-- Legacy chain (device_platforms, for the old-vs-new comparator): Beltone is
-- GN's sister brand to ReSound and each generation is a ReSound platform under
-- a Beltone name (ReSound→Beltone quick-reference guide, Oct 2026). Each legacy
-- row points base_platform_id at its ReSound platform so lineage + tier math
-- resolve through the verified ReSound data; lineage_order mirrors ReSound's
-- so generation counts line up. Trust / Legend / First (LiNX 3D / LiNX2 /
-- LiNX) predate every ReSound row in the catalog and are not added.

-- 1. Clinic authorization ------------------------------------------------------
alter table clinics
  add column if not exists proprietary_software_auth text[] not null default '{}';

comment on column clinics.proprietary_software_auth is
  'Brand keys (lowercase) this clinic holds proprietary fitting-software authorization for, e.g. {beltone} = Solus Max. Gates product_catalog.requires_proprietary_software families.';

-- 2. Retail-anchor class ---------------------------------------------------------
alter table clinic_retail_anchors
  drop constraint if exists clinic_retail_anchors_manufacturer_class_check;

alter table clinic_retail_anchors
  add constraint clinic_retail_anchors_manufacturer_class_check
  check (manufacturer_class in ('standard', 'signia', 'rexton', 'phonak', 'oticon', 'starkey', 'widex', 'resound', 'beltone'));

-- 3. Product catalog (inactive until the activation migration) ------------------
insert into product_catalog
  (id, manufacturer, generation, display_generation, parent_platform, family,
   styles, tech_levels, variants, battery_options, colors, active, requires_proprietary_software, notes)
values
  ('bel-illuminate-mrie', 'Beltone', 'Illuminate', 'Illuminate', 'Illuminate', 'Illuminate miniRIE 62',
   array['ric'], array['17','9','6','4'], array['Standard','CROS'],
   array['Rechargeable'], array[]::text[], false, true,
   'Style 62. Illuminate CROS pairs with another RIE only; trainer guidance: pair CROS with level 9 or below (17 performs best paired with another 17).'),
  ('bel-illuminate-rie-312', 'Beltone', 'Illuminate', 'Illuminate', 'Illuminate', 'Illuminate RIE 63',
   array['ric'], array['17','9','6','4'], array['Standard'],
   array['Size 312'], array[]::text[], false, true,
   'Style 63 (ReSound RIE 61 equivalent).'),
  ('bel-illuminate-rie-13', 'Beltone', 'Illuminate', 'Illuminate', 'Illuminate', 'Illuminate RIE 64',
   array['ric'], array['17','9','6','4'], array['Standard'],
   array['Size 13'], array[]::text[], false, true,
   'Style 64 (ReSound RIE 62 equivalent).'),
  ('bel-illuminate-custom', 'Beltone', 'Illuminate', 'Illuminate', 'Illuminate', 'Illuminate Custom',
   array['ite','itc','cic'], array['17','9','6','4'], array['ITE','ITC','CIC'],
   array['Rechargeable','Size 312','Size 10'],
   array['Light Beige','Medium Beige','Medium-Dark Beige','Dark Beige','Invisible Matte'], false, true,
   'All customs available LP/MP/HP/UP. ITE/ITC: rechargeable or 312. CIC: size 10.'),
  ('bel-boost-max-s', 'Beltone', 'Boost Max S', 'Boost Max S', 'Boost Max S', 'Boost Max S BTE',
   array['bte'], array['17','9','6','4'], array['Standard'],
   array['Rechargeable'], array[]::text[], false, true,
   'Rechargeable power BTE (ReSound Enzo IA equivalent).')
on conflict (id) do nothing;

insert into product_catalog_tier (product_catalog_id, tier_name, tier_rank)
select f.id, t.tier_name, t.tier_rank
from (values ('bel-illuminate-mrie'), ('bel-illuminate-rie-312'), ('bel-illuminate-rie-13'),
             ('bel-illuminate-custom'), ('bel-boost-max-s')) as f(id)
cross join (values ('17', 5), ('9', 4), ('6', 3), ('4', 2)) as t(tier_name, tier_rank)
on conflict (product_catalog_id, tier_name) do nothing;

-- 4. Device-platform lineage (comparator reference data) ------------------------
do $$
declare
  guide constant text := 'local PDF: ReSound_to_Beltone_Quick_Reference_Guide.pdf (Beltone trainer, Oct 2026)';
  sheet constant text := 'local PDF: Beltone Hearing Aids.pdf + TECHNOLOGY LEVELS.docx (Beltone trainer, Oct 2026)';
  r record;
  v_base uuid;
  v_id   uuid;
begin
  -- Idempotent: skip entirely if Beltone platforms are already seeded.
  if exists (select 1 from device_platforms where manufacturer = 'Beltone') then
    return;
  end if;

  -- White-label generations: name, ReSound base, status, ladder.
  for r in
    select * from (values
      ('Amaze',    'LiNX Quattro', 'discontinued', array['17','9','6']),
      ('Imagine',  'ONE',          'discontinued', array['17','9','6','4']),
      ('Achieve',  'OMNIA',        'legacy',       array['17','9','6']),
      ('Serene',   'Nexia',        'legacy',       array['17','9','6']),
      ('Envision', 'Vivia',        'legacy',       array['17','9','6','4'])
    ) as x(name, base, status, ladder)
  loop
    select id into v_base from device_platforms
      where manufacturer = 'ReSound' and platform_name = r.base;
    if v_base is null then
      raise notice 'Beltone %: ReSound base % not found — skipped', r.name, r.base;
      continue;
    end if;

    insert into device_platforms
      (manufacturer, platform_name, device_class, release_year, status,
       bluetooth_protocol, auracast, rechargeable_offered, disposable_offered,
       form_factors, lineage_order, base_platform_id, source_urls, verification_status, notes)
    select 'Beltone', r.name, 'prescription', b.release_year, r.status,
           b.bluetooth_protocol, b.auracast, b.rechargeable_offered, b.disposable_offered,
           '{}', b.lineage_order, b.id, array[guide], 'unverified',
           format('Beltone-branded ReSound %s (GN sister brands; equivalence per the ReSound→Beltone quick-reference guide). Release year, connectivity and battery fields mirror the ReSound base — not independently sourced. Tier ladder (%s) mirrors the base by position; feature gates resolve through the base ladder.',
                  r.base, array_to_string(r.ladder, '/'))
    from device_platforms b where b.id = v_base
    returning id into v_id;

    insert into device_tech_tiers (platform_id, tier_designation, tier_position, source_urls, verification_status, notes)
    select v_id, lvl, pos, array[guide], 'unverified',
           format('Beltone %s %s ≈ ReSound %s position %s.', r.name, lvl, r.base, pos)
    from unnest(r.ladder) with ordinality as u(lvl, pos);
  end loop;

  -- Illuminate: current flagship, newer than the crosswalk (no ReSound base on
  -- record). Feature gates from the trainer's Technology Levels guide — taken
  -- from its prose, because the guide's comparison table is garbled (checkmarks
  -- shifted left so it reads backwards).
  insert into device_platforms
    (manufacturer, platform_name, device_class, release_year, status,
     rechargeable_offered, disposable_offered, form_factors, platform_innovations,
     lineage_order, source_urls, verification_status, notes)
  values
    ('Beltone', 'Illuminate', 'prescription', null, 'current',
     true, true,
     array['RIE 62 (rechargeable)','RIE 63 (312)','RIE 64 (13)','ITE','ITC','CIC'],
     array['AcoustIQ sound sensing','4-microphone beamforming'],
     6, array[sheet], 'unverified',
     'Current Beltone flagship (Oct 2026). Release year UNKNOWN. Lineage order 6 places it after Envision (ReSound Vivia-equivalent, order 5). Customs are LP/MP/HP/UP. Source is a Beltone trainer cheat sheet, not a manufacturer datasheet — hence unverified.')
  returning id into v_id;

  insert into device_tech_tiers
    (platform_id, tier_designation, tier_position, speech_in_noise_features, tier_feature_gates,
     source_urls, verification_status, notes)
  values
    (v_id, '17', 1, array['True Directionality (microRIE)','True Focus'],
     array['True Directionality (microRIE only)','Most True Focus adjustment options','Highest level of automatic processing'],
     array[sheet], 'unverified', 'Premium — maximum processing.'),
    (v_id, '9', 2, array['True Focus'],
     array['True Focus','Advanced directionality'],
     array[sheet], 'unverified', 'Advanced — strong speech-in-noise support.'),
    (v_id, '6', 3, null,
     array['Advanced processing'],
     array[sheet], 'unverified', 'Mid-level — strong everyday automatic processing.'),
    (v_id, '4', 4, null,
     array[]::text[],
     array[sheet], 'unverified', 'Essential — core Illuminate technology (AcoustIQ, 4-mic beamforming, automatic processing).');
end $$;
