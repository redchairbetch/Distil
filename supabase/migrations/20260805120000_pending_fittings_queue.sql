-- Pending Fittings queue (Kurt, 2026-08-05).
--
-- A signed purchase agreement is a sale, not a fitting: the devices still have
-- to be ordered and delivered. Until now every clock started at signing off an
-- ESTIMATED fit date (signature + 14 days) — warranty expiry, the 4-year care
-- arc, and nurture-campaign enrollment were all anchored to a guess.
--
-- New model: signing creates a fitting row with fitting_status='pending'
-- (fitting_date holds the estimate for scheduling display only; warranty_expiry
-- stays NULL). Confirming the fitting from the Pending Fittings queue stamps
-- the authoritative fitting_date and starts every clock from it:
-- warranty_expiry = fitting_date + warranty_years, care arc scheduled, nurture
-- campaign enrolled with the real trigger date.
--
-- Default 'fitted' keeps every existing row and every legacy write path
-- (TNS recommendation records, direct chart edits, updatePatientDevices)
-- semantically unchanged.

alter table public.device_fittings
  add column fitting_status text not null default 'fitted'
    constraint device_fittings_fitting_status_check
    check (fitting_status in ('pending', 'fitted')),
  add column warranty_years smallint,
  add column fit_confirmed_at timestamptz,
  add column fit_confirmed_by uuid references public.staff(id);

comment on column public.device_fittings.fitting_status is
  'pending = purchase agreement signed but devices not yet delivered/fit (fitting_date is an estimate, warranty_expiry NULL). fitted = fitting_date is authoritative.';
comment on column public.device_fittings.warranty_years is
  'Warranty term captured at PA signing (Complete Care+/private pay = 4, else 3). warranty_expiry = confirmed fitting_date + warranty_years.';
comment on column public.device_fittings.fit_confirmed_at is
  'When the pending fitting was confirmed as delivered/fit from the Pending Fittings queue.';
comment on column public.device_fittings.fit_confirmed_by is
  'Staff member who confirmed the fitting.';

-- The queue scans for pending rows only — keep that lookup off the main heap.
create index idx_device_fittings_pending
  on public.device_fittings (patient_id)
  where fitting_status = 'pending';
