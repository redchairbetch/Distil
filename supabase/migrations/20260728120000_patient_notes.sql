-- Timestamped interaction log on the patient chart. Append-only by design:
-- no UPDATE policy — a mistaken note is deleted and re-entered, never edited,
-- so the log stays a trustworthy record of what was written when.
create table public.patient_notes (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id  uuid not null references public.clinics(id),
  staff_id   uuid references public.staff(id) on delete set null,
  body       text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now()
);

create index patient_notes_patient_created_idx
  on public.patient_notes (patient_id, created_at desc);

alter table public.patient_notes enable row level security;

-- Org-wide authenticated reads (All Locations chart access); writes scoped
-- to the active clinic via my_clinic_id() — same model as patient_messages.
create policy "authenticated_read_all_patient_notes"
  on public.patient_notes for select to authenticated
  using (true);

create policy "Staff insert clinic notes"
  on public.patient_notes for insert to authenticated
  with check (clinic_id = my_clinic_id() and staff_id = auth.uid());

create policy "Staff delete clinic notes"
  on public.patient_notes for delete to authenticated
  using (clinic_id = my_clinic_id());
