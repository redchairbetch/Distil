-- Patient language preference (en/es). Default 'en' backfills all existing
-- rows. Auto-set from the kiosk intake's chosen language at accept/link time;
-- editable in the Distil chart contact card and from the Aided app.
alter table public.patients
  add column if not exists preferred_language text not null default 'en';

alter table public.patients
  drop constraint if exists patients_preferred_language_chk;
alter table public.patients
  add constraint patients_preferred_language_chk
  check (preferred_language in ('en','es'));

-- Anon-callable language setter for the Aided PWA. Same pid-knowledge bearer
-- model as mark_message_read / send_patient_reply: knowing the patient UUID
-- (QR pid) authorizes this single, non-PHI, value-constrained write.
-- SECURITY DEFINER so no anon UPDATE policy is opened on patients (anon has
-- SELECT-only access today; staff updates stay clinic-scoped).
create or replace function public.set_patient_language(p_patient_id uuid, p_lang text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.patients
     set preferred_language = p_lang
   where id = p_patient_id
     and p_lang in ('en','es');
$$;

revoke all on function public.set_patient_language(uuid, text) from public, anon, authenticated;
grant execute on function public.set_patient_language(uuid, text) to anon, authenticated;
