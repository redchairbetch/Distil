-- Catalog completeness audit fixes (backlog #19).
--
-- Adds missing tech levels to product families where the catalog row was thinner
-- than the manufacturer's actual lineup, and corrects one misnamed row.
--
-- Applied via Supabase MCP as two migrations:
--   catalog_tech_level_completeness  — initial pass (over-broad)
--   catalog_tech_level_corrections   — narrows to actual lineup per SME review
--
-- This file consolidates them for repo-side reproducibility. Already applied
-- in production; safe to re-run (the updates are idempotent and the insert
-- targets specific (family, tier) tuples that are now present).

-- ─────────────────────────────────────────────────────────────
-- Phonak Infinio: add level 30 (entry tier on the 4-tier ladder)
-- ─────────────────────────────────────────────────────────────
update product_catalog set tech_levels = array['90','70','50','30'] where id = 'pho-sphere-infinio';
update product_catalog set tech_levels = array['90','70','50','30'] where id = 'pho-virto-infinio';

insert into product_catalog_tier (product_catalog_id, tier_name, tier_rank, active) values
  ('pho-sphere-infinio', '30', 2, true),
  ('pho-virto-infinio', '30', 2, true)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- Signia Insio AX ITC / ITE: complete the 5-tier ladder (2AX, 1AX)
-- ─────────────────────────────────────────────────────────────
update product_catalog set tech_levels = array['7AX','5AX','3AX','2AX','1AX'] where id = 'sig-insio-cg-ax-itc';
update product_catalog set tech_levels = array['7AX','5AX','3AX','2AX','1AX'] where id = 'sig-insio-cg-ax-ite';

insert into product_catalog_tier (product_catalog_id, tier_name, tier_rank, active) values
  ('sig-insio-cg-ax-itc', '2AX', 2, true),
  ('sig-insio-cg-ax-itc', '1AX', 1, true),
  ('sig-insio-cg-ax-ite', '2AX', 2, true),
  ('sig-insio-cg-ax-ite', '1AX', 1, true)
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- Silk Charge&Go AX → Insio Charge&Go AX CIC rename.
--
-- The previous "sig-silk-ax" row was a misnomer. Silk is only on the IX
-- platform; the actual AX-platform CIC is the Insio AX CIC, sibling to the
-- existing Insio AX ITC and ITE rows. All three Insio AX customs ship in
-- the full 5-tier ladder.
--
-- FK product_catalog_tier.product_catalog_id has ON DELETE CASCADE but no
-- ON UPDATE CASCADE, so the rename goes: insert-new → repoint-FK → delete-old.
-- Verified pre-migration that no device_sides rows reference sig-silk-ax.
-- ─────────────────────────────────────────────────────────────
insert into product_catalog (id, manufacturer, family, generation, styles,
  tech_levels, variants, battery_options, colors, tpa, active, notes, metadata)
select 'sig-insio-cg-ax-cic', manufacturer, 'Insio Charge&Go AX CIC', generation,
  styles, array['7AX','5AX','3AX','2AX','1AX'], variants, battery_options, colors, tpa, active,
  'Rechargeable custom CIC — pairs with Insio AX ITC/ITE family.', metadata
from product_catalog where id = 'sig-silk-ax'
on conflict (id) do nothing;

update product_catalog_tier
  set product_catalog_id = 'sig-insio-cg-ax-cic'
  where product_catalog_id = 'sig-silk-ax';

-- The CIC-side rows already had 2AX/1AX added by the earlier insert pass;
-- re-add here in case this file is run against a fresh schema.
insert into product_catalog_tier (product_catalog_id, tier_name, tier_rank, active) values
  ('sig-insio-cg-ax-cic', '2AX', 2, true),
  ('sig-insio-cg-ax-cic', '1AX', 1, true)
on conflict do nothing;

delete from product_catalog where id = 'sig-silk-ax';
