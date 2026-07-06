-- ═══════════════════════════════════════════════════════════════════════════
-- SEED TEMPLATE — cross_manufacturer_equivalence (Kurt-owned, spec §11)
-- NOT a migration. Fill in the tier-parity judgments below and run the
-- INSERT via the Supabase SQL editor (or hand it to Claude to apply).
-- DeviceSelection's Zone 4c cross-manufacturer comparison panel is parked
-- until this table has rows — populating it un-parks the shipped UI.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Table shape (live in prod; verified 2026-07-05):
--   anchor_tier_id          uuid → product_catalog_tier(id)  the tier being viewed
--   equivalent_tier_id      uuid → product_catalog_tier(id)  its peer on another brand
--   equivalence_confidence  'exact' | 'close' | 'approximate'
--   notes                   text — the one-line clinical justification
--   last_reviewed           date
-- Constraints: (anchor, equivalent) unique; anchor ≠ equivalent.
-- Direction: judgments are one-way rows. If Signia 7IX ≈ Phonak 90 should
-- read both ways in the UI, insert BOTH directions.
--
-- STEP 1 — find your tier ids (run this first, keep the output handy):
/*
select t.id, c.manufacturer, c.family, t.tier_name, t.tier_rank
from product_catalog_tier t
join product_catalog c on c.id = t.product_catalog_id
where c.active
order by c.manufacturer, c.family, t.tier_rank desc;
*/
--
-- STEP 2 — fill the VALUES rows. One worked example (REPLACE the ids —
-- these are placeholders, they will not insert):
/*
insert into cross_manufacturer_equivalence
  (anchor_tier_id, equivalent_tier_id, equivalence_confidence, notes, last_reviewed)
values
  -- Signia Pure IX 7IX  ≈  Phonak Audéo Infinio 90 (both flagship RIC tiers)
  ('<signia-pure-7ix-tier-id>', '<phonak-infinio-90-tier-id>', 'close',
   'Flagship RIC tiers; comparable channels/AI features, Phonak edges waterproofing, Signia edges conversation enhancement.',
   '2026-07-06'),
  -- ...and the reverse direction so the panel shows it from a Phonak anchor too
  ('<phonak-infinio-90-tier-id>', '<signia-pure-7ix-tier-id>', 'close',
   'Flagship RIC tiers; comparable channels/AI features.',
   '2026-07-06')
on conflict (anchor_tier_id, equivalent_tier_id) do update
  set equivalence_confidence = excluded.equivalence_confidence,
      notes = excluded.notes,
      last_reviewed = excluded.last_reviewed;
*/
--
-- Suggested first pass (from the spec): map each brand's flagship + mid tier
-- across Signia / Phonak / Oticon / Starkey / ReSound / Widex — the same
-- pairs UHCH's coverage map already treats as peers is a sane starting grid.
