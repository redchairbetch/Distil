-- 023: Rexton full product line + real platform branding.
--
-- Backlog #28. Two problems on the device-selection screen:
--   (a) Rexton's `generation` field held Signia's IX/AX codes, so the #16 screen
--       rendered "Reach Plus · IX" / "BiCore · AX" — Signia branding under a
--       Rexton family. Fix: keep `generation` (IX/AX) purely as the dome key —
--       getDomeOptions() routes Rexton through the Signia Gen-3 sleeve set and
--       would break if we relabelled it — and put the patient-facing platform
--       name in `display_generation` (Reach / BiCore), which the screen now
--       renders in preference to `generation`.
--   (b) The catalog had 2 stand-in RIC rows for a 10-model line. This expands to
--       the full Reach (current) + BiCore (predecessor) matrix Kurt supplied.
--
-- Tier policy (Kurt, 2026-06-30): MHC dispenses tech levels 80/60/40/20 only —
-- "30" is dropped everywhere, and "20" stays at rank 2 ($2,497.50). No pricing
-- change: clinic_retail_anchors (rexton class) is untouched and no rank-1 anchor
-- is added. Full-ladder models (RIC / BTE / Custom) carry 80/60/40/20; the
-- restricted form factors (Slim-RIC, instant-fit CIC) carry 80/60/40.
--
-- Rank map (unchanged): 80→5, 60→4, 40→3, 20→2. Verified 0 device_sides rows
-- reference any Rexton family, so repurposing rex-reach-plus / rex-bicore is safe.

-- ── Repurpose the two existing rows into their real model identities ─────────
update product_catalog set
  family             = 'Reach R Plus',
  display_generation = 'Reach',
  parent_platform    = 'Reach',
  tech_levels        = ARRAY['80','60','40','20'],
  variants           = ARRAY['Standard','T (Telecoil)','BC (Bluetooth Classic)','CROS'],
  battery_options    = ARRAY['Rechargeable'],
  notes              = 'Reach platform (current). Sister product to Signia Pure BCT IX. Launched Oct 2025.'
where id = 'rex-reach-plus';

update product_catalog set
  family             = 'BiCore R-Li',
  display_generation = 'BiCore',
  parent_platform    = 'BiCore',
  tech_levels        = ARRAY['80','60','40','20'],
  variants           = ARRAY['Standard','T (Telecoil)','CROS'],
  battery_options    = ARRAY['Rechargeable'],
  notes              = 'BiCore platform (predecessor). Lithium-ion RIC; R-Li T adds telecoil.'
where id = 'rex-bicore';

-- ── Insert the 8 remaining models ────────────────────────────────────────────
insert into product_catalog
  (id, manufacturer, generation, display_generation, parent_platform, family,
   styles, tech_levels, variants, battery_options, colors, active, requires_proprietary_software, notes)
values
  ('rex-reach-r', 'Rexton', 'IX', 'Reach', 'Reach', 'Reach R',
   ARRAY['ric'], ARRAY['80','60','40','20'], ARRAY['Standard','T (Telecoil)','CROS'],
   ARRAY['Rechargeable'],
   ARRAY['Black','Graphite','Dark Champagne','Silver','Pearl White','Fine Gold','Deep Brown','Sandy Brown','Rose Gold','Beige'],
   true, false, 'Reach platform (current). Standard RIC.'),

  ('rex-reach-styleline', 'Rexton', 'IX', 'Reach', 'Reach', 'Reach Style Line',
   ARRAY['ric'], ARRAY['80','60','40'], ARRAY['Standard'],
   ARRAY['Rechargeable'],
   ARRAY['Black','Graphite','Dark Champagne','Silver','Pearl White','Fine Gold','Deep Brown','Sandy Brown','Rose Gold','Beige'],
   true, false, 'Reach platform (current). Slim-RIC form factor. Premium tiers only (80/60/40).'),

  ('rex-reach-inox-cic', 'Rexton', 'IX', 'Reach', 'Reach', 'Reach inoX CIC',
   ARRAY['if'], ARRAY['80','60','40'], ARRAY['Standard'],
   ARRAY['Rechargeable'], ARRAY['Beige','Brown','Black'],
   true, false, 'Reach platform (current). Instant-fit CIC. No direct wireless audio streaming (size constraint). Premium tiers only (80/60/40).'),

  ('rex-bicore-r312', 'Rexton', 'AX', 'BiCore', 'BiCore', 'BiCore R 312',
   ARRAY['ric'], ARRAY['80','60','40','20'], ARRAY['Standard','CROS'],
   ARRAY['Size 312'],
   ARRAY['Black','Graphite','Silver','Pearl White','Deep Brown','Sandy Brown','Rose Gold','Beige'],
   true, false, 'BiCore platform (predecessor). Size 312 zinc-air RIC.'),

  ('rex-bicore-slim-ric', 'Rexton', 'AX', 'BiCore', 'BiCore', 'BiCore Slim-RIC',
   ARRAY['ric'], ARRAY['80','60','40'], ARRAY['Standard'],
   ARRAY['Rechargeable'],
   ARRAY['Black','Graphite','Silver','Pearl White','Deep Brown','Sandy Brown','Rose Gold','Beige'],
   true, false, 'BiCore platform (predecessor). Slim-RIC form factor. Premium tiers only (80/60/40).'),

  ('rex-bicore-bte', 'Rexton', 'AX', 'BiCore', 'BiCore', 'BiCore BTE',
   ARRAY['bte'], ARRAY['80','60','40','20'], ARRAY['M','P','HP'],
   ARRAY['Rechargeable'],
   ARRAY['Black','Graphite','Silver','Pearl White','Deep Brown','Sandy Brown','Rose Gold','Beige'],
   true, false, 'BiCore platform (predecessor). Standard/Power BTE (M/P/HP).'),

  ('rex-bicore-custom', 'Rexton', 'AX', 'BiCore', 'BiCore', 'BiCore Custom',
   ARRAY['ite','itc'], ARRAY['80','60','40','20'], ARRAY['ITE','ITC'],
   ARRAY['Rechargeable'], ARRAY[]::text[],
   true, false, 'BiCore platform (predecessor). Custom ITE/ITC, rechargeable.'),

  ('rex-bicore-inox-cic', 'Rexton', 'AX', 'BiCore', 'BiCore', 'BiCore inoX Click CIC',
   ARRAY['if'], ARRAY['80','60','40'], ARRAY['Standard'],
   ARRAY['Size 10'], ARRAY['Beige','Brown','Black'],
   true, false, 'BiCore platform (predecessor). Instant-fit Click CIC, size 10 zinc-air. No direct wireless streaming. Premium tiers only (80/60/40).');

-- ── Tier ladders (product_catalog_tier). Rank map 80→5, 60→4, 40→3, 20→2. ────
-- rex-reach-plus gains its "20" rank; rex-bicore already has all four. Idempotent
-- via NOT EXISTS so a re-run is a no-op.
insert into product_catalog_tier (product_catalog_id, tier_name, tier_rank)
select v.pcid, v.tname, v.trank
from (values
  ('rex-reach-plus','20',2),
  ('rex-reach-r','80',5),('rex-reach-r','60',4),('rex-reach-r','40',3),('rex-reach-r','20',2),
  ('rex-reach-styleline','80',5),('rex-reach-styleline','60',4),('rex-reach-styleline','40',3),
  ('rex-reach-inox-cic','80',5),('rex-reach-inox-cic','60',4),('rex-reach-inox-cic','40',3),
  ('rex-bicore-r312','80',5),('rex-bicore-r312','60',4),('rex-bicore-r312','40',3),('rex-bicore-r312','20',2),
  ('rex-bicore-slim-ric','80',5),('rex-bicore-slim-ric','60',4),('rex-bicore-slim-ric','40',3),
  ('rex-bicore-bte','80',5),('rex-bicore-bte','60',4),('rex-bicore-bte','40',3),('rex-bicore-bte','20',2),
  ('rex-bicore-custom','80',5),('rex-bicore-custom','60',4),('rex-bicore-custom','40',3),('rex-bicore-custom','20',2),
  ('rex-bicore-inox-cic','80',5),('rex-bicore-inox-cic','60',4),('rex-bicore-inox-cic','40',3)
) as v(pcid, tname, trank)
where not exists (
  select 1 from product_catalog_tier x
  where x.product_catalog_id = v.pcid and x.tier_name = v.tname
);
