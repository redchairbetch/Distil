-- Direct Purchase: a patient with a TruHearing (TPA) benefit who wasn't
-- referred to the clinic can be sold PRIVATELY at their insurance price on the
-- equivalent Signia device. It prices like TruHearing and attaches a care plan
-- like a TruHearing sale, but is billed privately — so it's neither a real TPA
-- claim nor ordinary private pay. Two additive, backward-compatible changes:

-- 1. A distinct payer_type so the reports can track this revenue stream on its
--    own (separate from referred TruHearing AND from private pay). Complete
--    Care+ counts as a normal $1,250 charge here (it isn't bundled the way
--    private-pay CC+ is), which the reporting layer already derives from the
--    non-private-pay payer type. ADD VALUE is safe on an existing enum; the new
--    value just can't be USED in this same transaction (we don't).
alter type payer_type add value if not exists 'direct_purchase';

-- 2. Persist the flag on the patient so a purchase agreement re-generated from
--    the chart later still renders as a Direct Purchase (Signia device at the
--    TruHearing price, care plan a separate line, no insurance-coverage copy).
--    Defaults false so every existing row is unaffected.
alter table public.patients
  add column if not exists direct_purchase boolean not null default false;

comment on column public.patients.direct_purchase is
  'True when the fitting was a Direct Purchase: a TruHearing benefit sold private at the TPA tier price on a Signia device. Drives payer_type=direct_purchase at close and the quote/PA rendering.';
