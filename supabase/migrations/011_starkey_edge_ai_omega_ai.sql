-- Add Starkey Edge AI (Oct 2024) and Omega AI (Feb 2025, Feb 2026 update) as
-- distinct generations alongside Genesis AI. Per SME-supplied availability
-- guide:
--
--   Edge AI tiers: 24 / 20 / 16 / 12 (matches Genesis ladder)
--   Omega AI tiers: 24 / 20 / 16 (no entry tier; streamlined to rechargeable
--                                 to support 51-hr battery + Auracast)
--
-- Both ship in RIC, Custom (ITE/ITC/CIC/IIC), and BTE. Following the Genesis
-- AI pattern of three rows per generation by body style.
--
-- Also cleans up sta-genesis-ric: the "Omega AI (smaller form)" variant and
-- the launch-note comment were placeholders from before Omega AI got its own
-- row set.

-- ── Edge AI (4 tiers: 24/20/16/12) ──────────────────────────────────────
insert into product_catalog
  (id, manufacturer, family, generation, styles, tech_levels, variants,
   battery_options, colors, tpa, active, notes, metadata) values
  ('sta-edge-ai-ric', 'Starkey', 'Edge AI mRIC R', 'Edge AI',
   array['ric'], array['24','20','16','12'],
   array['RIC RT (Rechargeable)','RIC 312'],
   array['Rechargeable','Size 312'],
   array['Silver','Black','Rose Gold','Champagne','Mocha','Brushed Titanium','Pewter'],
   null, true,
   'G2 Neuro Processor. Both rechargeable and battery-operated receivers.',
   '{}'::jsonb),
  ('sta-edge-ai-bte', 'Starkey', 'Edge AI BTE', 'Edge AI',
   array['bte'], array['24','20','16','12'],
   array['BTE 13','BTE R'],
   array['Rechargeable','Size 13'],
   array['Silver','Black','Beige','Dark Brown'],
   null, true, null, '{}'::jsonb),
  ('sta-edge-ai-custom', 'Starkey', 'Edge AI Custom', 'Edge AI',
   array['ite','itc','cic','iic'], array['24','20','16','12'],
   array['ITE R','ITC R','CIC','IIC'],
   array['Rechargeable','Size 312','Size 10'],
   array['Sahara Beige','Mocha','Cocoa','Espresso','Tan','Pink','Black'],
   null, true,
   'CIC/IIC are battery-operated; ITE R/ITC R are rechargeable.', '{}'::jsonb)
on conflict (id) do nothing;

insert into product_catalog_tier (product_catalog_id, tier_name, tier_rank, active) values
  ('sta-edge-ai-ric',    '24', 5, true),
  ('sta-edge-ai-ric',    '20', 4, true),
  ('sta-edge-ai-ric',    '16', 3, true),
  ('sta-edge-ai-ric',    '12', 2, true),
  ('sta-edge-ai-bte',    '24', 5, true),
  ('sta-edge-ai-bte',    '20', 4, true),
  ('sta-edge-ai-bte',    '16', 3, true),
  ('sta-edge-ai-bte',    '12', 2, true),
  ('sta-edge-ai-custom', '24', 5, true),
  ('sta-edge-ai-custom', '20', 4, true),
  ('sta-edge-ai-custom', '16', 3, true),
  ('sta-edge-ai-custom', '12', 2, true)
on conflict do nothing;

-- ── Omega AI (3 tiers: 24/20/16) ────────────────────────────────────────
insert into product_catalog
  (id, manufacturer, family, generation, styles, tech_levels, variants,
   battery_options, colors, tpa, active, notes, metadata) values
  ('sta-omega-ai-ric', 'Starkey', 'Omega AI mRIC R', 'Omega AI',
   array['ric'], array['24','20','16'],
   array['RIC RT (Rechargeable)','mRIC RT'],
   array['Rechargeable'],
   array['Silver','Black','Rose Gold','Champagne','Mocha','Brushed Titanium','Pewter'],
   null, true,
   '51-hour rechargeable. Auracast-ready. Streamlined to rechargeable RIC variants only.',
   '{}'::jsonb),
  ('sta-omega-ai-bte', 'Starkey', 'Omega AI BTE', 'Omega AI',
   array['bte'], array['24','20','16'],
   array['BTE R','Power Plus BTE R'],
   array['Rechargeable'],
   array['Silver','Black','Beige','Dark Brown'],
   null, true,
   'Power Plus BTE R fitting range covers severe-to-profound loss.', '{}'::jsonb),
  ('sta-omega-ai-custom', 'Starkey', 'Omega AI Custom', 'Omega AI',
   array['ite','itc','cic','iic'], array['24','20','16'],
   array['ITE R','ITC R','CIC','IIC'],
   array['Rechargeable','Size 312','Size 10'],
   array['Sahara Beige','Mocha','Cocoa','Espresso','Tan','Pink','Black'],
   null, true,
   'CIC/IIC are battery-operated; ITE R/ITC R are rechargeable.', '{}'::jsonb)
on conflict (id) do nothing;

insert into product_catalog_tier (product_catalog_id, tier_name, tier_rank, active) values
  ('sta-omega-ai-ric',    '24', 5, true),
  ('sta-omega-ai-ric',    '20', 4, true),
  ('sta-omega-ai-ric',    '16', 3, true),
  ('sta-omega-ai-bte',    '24', 5, true),
  ('sta-omega-ai-bte',    '20', 4, true),
  ('sta-omega-ai-bte',    '16', 3, true),
  ('sta-omega-ai-custom', '24', 5, true),
  ('sta-omega-ai-custom', '20', 4, true),
  ('sta-omega-ai-custom', '16', 3, true)
on conflict do nothing;

-- ── Genesis AI cleanup ──────────────────────────────────────────────────
update product_catalog
  set variants = array['Standard'],
      notes    = null
  where id = 'sta-genesis-ric';
