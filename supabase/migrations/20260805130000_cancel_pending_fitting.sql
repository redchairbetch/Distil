-- Cancel a pending sale (Kurt, 2026-08-05 — follow-up to the Pending
-- Fittings queue). A patient who signs a purchase agreement and rescinds
-- BEFORE the devices are delivered/fit gets a third fitting_status:
-- 'cancelled'. The row is never deleted — it is the record that the sale
-- happened and was unwound — but it stops being the chart's current fitting,
-- never starts a warranty, and leaves the queue.

alter table public.device_fittings
  drop constraint device_fittings_fitting_status_check;

alter table public.device_fittings
  add constraint device_fittings_fitting_status_check
  check (fitting_status in ('pending', 'fitted', 'cancelled'));

alter table public.device_fittings
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.staff(id),
  add column cancel_reason text
    constraint device_fittings_cancel_reason_check
    check (cancel_reason is null or cancel_reason in (
      'changed_mind',
      'financing_fell_through',
      'insurance_issue',
      'medical',
      'moved_relocated',
      'deceased',
      'other'
    )),
  add column cancel_note text;

comment on column public.device_fittings.cancel_reason is
  'Why a pending sale was cancelled before fitting. Vocabulary mirrors CANCEL_REASONS in lib/pendingFitting.js.';
