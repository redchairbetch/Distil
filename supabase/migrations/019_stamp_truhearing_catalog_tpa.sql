-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- 019: Stamp TruHearing product_catalog rows with their TPA.
--
-- Backlog #31. The wizard's generic device cascade filters on TPA exclusivity
-- (visibleCatalog: tpa-less rows show for everyone, tpa'd rows only for patients
-- on that TPA — the mechanism that keeps Relate UHCH-only). TruHearing's ~30
-- rows were tpa-null, so they surfaced as a selectable manufacturer for
-- private-pay, UHCH, and other-insurance patients. TruHearing-plan patients are
-- unaffected: their device UI is the dedicated TH card flow (isPrivateLabel),
-- which reads TH_MODELS/TH_AVAILABILITY constants, not product_catalog.
--
-- Verified pre-migration: the only product_catalog readers are the wizard
-- cascade (gets the gate), CreateQuoteModal (gains the same patient-keyed gate
-- in the same change), and the admin catalog editor (intentionally ungated;
-- its save path round-trips tpa).

update product_catalog
set tpa = 'TruHearing'
where manufacturer = 'TruHearing'
  and tpa is null;
