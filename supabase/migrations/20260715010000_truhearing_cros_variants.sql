-- TruHearing CROS variants in product_catalog
--
-- Quote generation for TruHearing patients had no CROS option: the wizard's
-- TH card flow prices CROS from the isCROS side flag (it never reads these
-- rows), but CreateQuoteModal's variant dropdown reads product_catalog — and
-- the live TruHearing rows carried granular variants ('RIC', 'RIC Li', …)
-- with no 'CROS' entry, so the transmitter could never be quoted.
--
-- Per the CROS pricing doctrine (Kurt, 2026-07-14): TruHearing sells its CROS
-- transmitter alongside RIC-form aids only — TH7 RIC Li and TH6 RIC 312.
-- SR, BTE, and customs have no companion transmitter on the TH portal, so
-- their rows stay untouched. The transmitter bills at the coordinating
-- technology level's instrument price (handled in lib/pricing.js +
-- CreateQuoteModal.earPricing; this migration only surfaces the option).
--
-- Idempotent: appends 'CROS' only where it isn't already present.

update product_catalog
   set variants = variants || array['CROS']
 where manufacturer = 'TruHearing'
   and id in (
     'th6-ric-std',
     'th6-ric-adv',
     'th6-ric-prem',
     'th7-ric-li-adv',
     'th7-ric-li-prem'
   )
   and not ('CROS' = any(variants));
