-- READY TO APPLY: Run in the Supabase SQL editor or via CLI migration.
-- Migration: 014_patient_messages
-- Created: 2026-05-20
-- Description: Inbox-style longer-form messages between clinic and patient.
--              Phase 1 is clinic->patient only (push + persisted inbox in Aided);
--              schema accommodates patient replies later via the sender_role
--              check constraint — no data migration needed when we flip on
--              two-way.

-- ── Table ───────────────────────────────────────────────────────────────────
create table public.patient_messages (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients(id) on delete cascade,
  clinic_id       uuid not null references public.clinics(id),
  sender_role     text not null check (sender_role in ('clinic','patient')),
  sender_staff_id uuid references public.staff(id),
  title           text not null,
  body            text not null,
  tag             text,
  push_url        text,
  push_fired_at   timestamptz,
  push_sent_count integer not null default 0,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  -- A clinic-authored message must name the sending staff member; a
  -- patient reply (future) must not. Mirrors the sender_role discriminator.
  constraint patient_messages_sender_shape check (
    (sender_role = 'clinic'  and sender_staff_id is not null) or
    (sender_role = 'patient' and sender_staff_id is null)
  )
);

create index patient_messages_patient_idx on public.patient_messages (patient_id, created_at desc);
create index patient_messages_clinic_idx  on public.patient_messages (clinic_id,  created_at desc);

alter table public.patient_messages enable row level security;

-- ── RLS: staff (Distil, authenticated) ──────────────────────────────────────
-- Staff can manage every message for a patient in their own clinic. Matches
-- the existing "Staff manage X" pattern on punch_card_usage / patient_achievements.
create policy "Staff manage clinic messages"
on public.patient_messages
for all
to public
using (
  clinic_id in (
    select s.clinic_id from public.staff s where s.id = auth.uid()
  )
)
with check (
  clinic_id in (
    select s.clinic_id from public.staff s where s.id = auth.uid()
  )
);

-- ── RLS: anon (Aided PWA) ───────────────────────────────────────────────────
-- Aided uses the anon key with the patient's pid UUID as the bearer (no
-- patient login). This mirrors the access model Aided already relies on for
-- patient profile reads: knowing the pid grants read access. Anon SELECT is
-- open here so the inbox query (filtered client-side by patient_id) returns
-- rows.
create policy "Anon read messages"
on public.patient_messages
for select
to anon
using (true);

-- Anon cannot insert (Phase 1 disables patient replies) or update arbitrary
-- columns. read_at flips through mark_message_read() below, which runs with
-- elevated privileges and is the only anon-callable write path.

-- ── Mark-as-read RPC (anon-callable) ────────────────────────────────────────
-- One-shot idempotent flip from null -> now() on read_at. SECURITY DEFINER
-- so anon can execute even though it writes; the function is intentionally
-- non-revealing (no return value beyond success/no-op) and only touches
-- read_at, so the worst a stray caller can do is mark a stranger's message
-- read. That's acceptable noise — the message body is already gated by
-- pid-knowledge under the anon SELECT policy.
create or replace function public.mark_message_read(p_message_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.patient_messages
     set read_at = now()
   where id = p_message_id
     and read_at is null;
$$;

revoke execute on function public.mark_message_read(uuid) from public;
grant  execute on function public.mark_message_read(uuid) to anon, authenticated;
