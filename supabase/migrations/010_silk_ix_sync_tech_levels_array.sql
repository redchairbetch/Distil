-- The product_catalog_tier rows for sig-silk-ix already cover all 5 IX tiers
-- (7IX/5IX/3IX/2IX/1IX), but the parent product_catalog.tech_levels array
-- was stuck at 3 — the cascade UI hides 2IX/1IX as a result. Sync the array
-- to the tier rows.

update product_catalog
  set tech_levels = array['7IX','5IX','3IX','2IX','1IX']
  where id = 'sig-silk-ix';
