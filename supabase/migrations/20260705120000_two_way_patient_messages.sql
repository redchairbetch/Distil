-- READY TO APPLY: Run in the Supabase SQL editor or via CLI migration.
-- Migration: 20260705120000_two_way_patient_messages
-- Created: 2026-07-05
-- Description: Flip on the two-way half of patient_messages that migration 014
--              designed for. Patients write back from Aided via a SECURITY
--              DEFINER RPC; providers see inbound messages in a clinic inbox
--              on the Distil dashboard. Also brings patient_messages into the
--              multi-clinic RLS model (it was missed by 20260702000000: staff
--              access was still scoped to the HOME clinic via s.clinic_id,
--              ignoring active-clinic switching) and adds channel columns so
--              email-reply ingestion can land later without a data migration.

-- ── Channel columns ──────────────────────────────────────────────────────────
-- 'aided'  = written in the Aided app (or Distil, for clinic-sent rows).
-- 'email'  = future: patient replied to a campaign email; an ingestion edge
--            function inserts the row with email_from + email_message_id
--            (RFC 5322 Message-ID) so re-delivered webhooks/polls de-dupe.
alter table public.patient_messages
  add column channel          text not null default 'aided'
                              check (channel in ('aided', 'email')),
  add column email_from       text,
  add column email_message_id text;

create unique index patient_messages_email_msg_idx
  on public.patient_messages (email_message_id)
  where email_message_id is not null;

-- Provider-side unread queue: "patient messages awaiting a response for this
-- clinic". Partial index keeps the dashboard badge count cheap.
create index patient_messages_clinic_unread_idx
  on public.patient_messages (clinic_id, created_at desc)
  where sender_role = 'patient' and read_at is null;

-- ── RLS: staff (Distil, authenticated) ───────────────────────────────────────
-- Replace the pre-multi-clinic FOR ALL policy (home-clinic scoped) with the
-- org model used everywhere else since 20260702000000: org-wide reads (cross-
-- clinic chart access), writes scoped to the ACTIVE clinic via my_clinic_id().
drop policy "Staff manage clinic messages" on public.patient_messages;

create policy authenticated_read_all_patient_messages
on public.patient_messages
for select to authenticated
using (true);

-- Clinic-sent messages must be authored as yourself, into your active clinic.
create policy "Staff send clinic messages"
on public.patient_messages
for insert to authenticated
with check (
  clinic_id = public.my_clinic_id()
  and sender_role = 'clinic'
  and sender_staff_id = auth.uid()
);

-- Updates cover push_url/push_fired_at bookkeeping after send and marking
-- inbound patient messages handled (read_at). Active clinic only.
create policy "Staff update clinic messages"
on public.patient_messages
for update to authenticated
using (clinic_id = public.my_clinic_id())
with check (clinic_id = public.my_clinic_id());

create policy "Staff delete clinic messages"
on public.patient_messages
for delete to authenticated
using (clinic_id = public.my_clinic_id());

-- ── Tighten mark_message_read to clinic-sent rows ────────────────────────────
-- read_at now drives two different queues: on clinic-sent rows it means "the
-- patient read it"; on patient-sent rows it means "the clinic handled it".
-- The anon-callable RPC must only be able to flip the former — otherwise a
-- stray caller could hide a patient's message from the provider inbox before
-- anyone saw it. Staff mark patient rows handled through a direct UPDATE
-- under the policy above.
create or replace function public.mark_message_read(p_message_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.patient_messages
     set read_at = now()
   where id = p_message_id
     and read_at is null
     and sender_role = 'clinic';
$$;

-- ── Patient reply RPC (anon-callable) ────────────────────────────────────────
-- Aided runs on the anon key with pid-knowledge as the bearer (same model as
-- mark_message_read / the anon SELECT policy). SECURITY DEFINER so the insert
-- bypasses the staff-only insert policy; clinic_id is derived server-side from
-- the patient row so a caller can never file a message under the wrong clinic.
-- Title is a fixed placeholder — the column is NOT NULL for clinic-sent rows'
-- sake, and both UIs render patient rows body-first.
create or replace function public.send_patient_reply(p_patient_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid;
  v_body      text := btrim(coalesce(p_body, ''));
  v_id        uuid;
begin
  if v_body = '' then
    raise exception 'message body required';
  end if;
  if length(v_body) > 4000 then
    raise exception 'message too long (4000 character max)';
  end if;

  select clinic_id into v_clinic_id
    from public.patients
   where id = p_patient_id;
  if v_clinic_id is null then
    raise exception 'unknown patient';
  end if;

  insert into public.patient_messages
    (patient_id, clinic_id, sender_role, sender_staff_id, title, body, channel)
  values
    (p_patient_id, v_clinic_id, 'patient', null, 'Patient message', v_body, 'aided')
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.send_patient_reply(uuid, text) from public;
grant  execute on function public.send_patient_reply(uuid, text) to anon, authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Distil's dashboard inbox subscribes to INSERTs (same pattern as intakes).
-- Guarded: the publication may already include the table in some environments.
do $$
begin
  alter publication supabase_realtime add table public.patient_messages;
exception
  when duplicate_object then null;
end $$;
