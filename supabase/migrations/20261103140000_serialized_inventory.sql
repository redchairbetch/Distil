-- Serialized device inventory (backlog #44, phase 3).
--
-- device_units: one row per PHYSICAL hearing aid (or CROS transmitter /
-- charger-less accessory with a serial). Purpose says why we have it;
-- status says where it is in its life:
--
--   on_order → reserved (received for a patient) | in_stock (shelf stock)
--   reserved → fitted | in_stock | rfc_pending
--   in_stock → reserved | fitted (same-day fit) | loaned_out | rfc_pending
--   fitted   → in_repair | lost_damaged | rfc_pending (returned in the
--              adaptation period) | in_stock (demo/loaner back on shelf)
--   in_repair → fitted | in_stock | retired (manufacturer replaced it)
--   loaned_out → in_stock | lost_damaged
--   rfc_pending → returned_for_credit | in_stock
--   returned_for_credit / lost_damaged / retired — terminal
--
-- The state machine is enforced in src/lib/inventory.js (ALLOWED_TRANSITIONS)
-- and every move writes a device_unit_events row, so the unit's whole
-- history (who, when, which patient, which manufacturer form) is on record.
--
-- device_fittings.serial_left/right remain as the display copy the chart and
-- the manufacturer-forms engine read; the app writes them when a unit is fit.
--
-- RFC window: 60 days from receipt by default (Kurt, 2026-11-03), overridable
-- per manufacturer via clinics.manufacturer_accounts[mfr].rfc_days. The
-- computed deadline is stored on the unit (rfc_deadline) and editable.

create table public.device_units (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references public.clinics(id),
  purpose             text not null default 'patient_order'
                      check (purpose in ('patient_order', 'stock', 'loaner', 'demo')),
  status              text not null default 'on_order'
                      check (status in ('on_order', 'in_stock', 'reserved', 'fitted', 'in_repair',
                                        'loaned_out', 'rfc_pending', 'returned_for_credit',
                                        'lost_damaged', 'retired')),
  manufacturer        text not null,
  family              text,
  model               text,
  tech_level          text,
  style               text,
  color               text,
  ear                 text check (ear in ('left', 'right')),
  product_catalog_id  text,
  serial_number       text,
  patient_id          uuid references public.patients(id) on delete set null,
  fitting_id          uuid references public.device_fittings(id) on delete set null,
  side_id             uuid references public.device_sides(id) on delete set null,
  order_ref           text,
  ordered_at          date,
  received_at         date,
  unit_cost_cents     integer check (unit_cost_cents is null or unit_cost_cents >= 0),
  rfc_deadline        date,
  mfr_warranty_expiry date,
  ld_claims_used      integer not null default 0,
  replaced_by         uuid references public.device_units(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- A serial identifies one physical device per manufacturer.
create unique index device_units_mfr_serial_uidx
  on public.device_units (lower(manufacturer), serial_number)
  where serial_number is not null;
create index device_units_clinic_status_idx on public.device_units (clinic_id, status);
create index device_units_patient_idx on public.device_units (patient_id) where patient_id is not null;
create index device_units_fitting_idx on public.device_units (fitting_id) where fitting_id is not null;

create table public.device_unit_events (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.device_units(id) on delete cascade,
  clinic_id   uuid not null references public.clinics(id),
  staff_id    uuid references public.staff(id) on delete set null,
  patient_id  uuid references public.patients(id) on delete set null,
  event_type  text not null,
  from_status text,
  to_status   text,
  document_id uuid references public.patient_documents(id) on delete set null,
  meta        jsonb not null default '{}'::jsonb,
  note        text,
  occurred_at timestamptz not null default now()
);
create index device_unit_events_unit_idx on public.device_unit_events (unit_id, occurred_at desc);

alter table public.device_units enable row level security;
alter table public.device_unit_events enable row level security;

-- Org-wide reads (same model as patient charts); writes scoped to the
-- active clinic via my_clinic_id().
create policy "authenticated_read_device_units"
  on public.device_units for select to authenticated using (true);
create policy "Staff insert clinic device units"
  on public.device_units for insert to authenticated
  with check (clinic_id = my_clinic_id());
create policy "Staff update clinic device units"
  on public.device_units for update to authenticated
  using (clinic_id = my_clinic_id()) with check (clinic_id = my_clinic_id());

-- Events are append-only: no update or delete policy.
create policy "authenticated_read_device_unit_events"
  on public.device_unit_events for select to authenticated using (true);
create policy "Staff insert clinic device unit events"
  on public.device_unit_events for insert to authenticated
  with check (clinic_id = my_clinic_id());

create or replace function public.device_units_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger device_units_touch
  before update on public.device_units
  for each row execute function public.device_units_touch();
