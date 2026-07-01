-- 024: Rexton display_generation → "Current" / "Legacy".
--
-- Follow-up to 023. The #16 device screen renders `{family} · {display_generation}`.
-- Setting display_generation to the platform name (Reach / BiCore) repeated the
-- word already in `family` ("Reach R Plus · Reach"). Replace it with the platform
-- era as a frame of reference — Reach = current line, BiCore = predecessor:
--   "Reach R Plus · Current"   "BiCore R-Li · Legacy"
-- parent_platform keeps the real platform name for grouping; only the rendered
-- label changes. `generation` (IX/AX) is untouched — it stays the dome key.

update product_catalog set display_generation = 'Current'
where manufacturer = 'Rexton' and parent_platform = 'Reach';

update product_catalog set display_generation = 'Legacy'
where manufacturer = 'Rexton' and parent_platform = 'BiCore';
