-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Multi-clinic staff support: staff_clinics junction, active clinic
-- switching, admin management policies, org-wide authenticated reads.
-- (Applied to prod 2026-07-02 via MCP as multi_clinic_staff +
--  harden_multi_clinic_functions + regrant_policy_helper_functions.)

-- 1. Junction: which clinics a staff member may work in
create table if not exists staff_clinics (
  staff_id   uuid not null references staff(id)   on delete cascade,
  clinic_id  uuid not null references clinics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id, clinic_id)
);
alter table staff_clinics enable row level security;

-- Backfill: every staff member is assigned to their home clinic
insert into staff_clinics (staff_id, clinic_id)
select id, clinic_id from staff where clinic_id is not null
on conflict do nothing;

-- 2. Active clinic column. Deliberately NO foreign key to clinics:
--    a second staff->clinics FK would make existing PostgREST
--    clinics(*) embeds on staff ambiguous (PGRST201). Validity is
--    enforced inside my_clinic_id() instead.
alter table staff add column if not exists active_clinic_id uuid;
update staff set active_clinic_id = clinic_id where active_clinic_id is null;

-- 3. my_clinic_id(): the single function ~40 RLS policies funnel
--    through. Now returns the active clinic when it is a valid
--    assignment, else falls back to the home clinic.
create or replace function public.my_clinic_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select s.active_clinic_id
       from staff s
      where s.id = auth.uid()
        and exists (select 1 from staff_clinics sc
                     where sc.staff_id = s.id
                       and sc.clinic_id = s.active_clinic_id)),
    (select clinic_id from staff where id = auth.uid())
  )
$$;

-- 4. my_role(): SECURITY DEFINER so staff policies can check role
--    without recursing into staff RLS.
create or replace function public.my_role()
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select role from staff where id = auth.uid()
$$;

-- Policy helper functions must stay executable by the querying roles
-- (RLS expressions run with the caller's privileges), but there is no
-- reason to expose them over PostgREST RPC beyond that.
grant execute on function public.my_clinic_id() to anon, authenticated;
grant execute on function public.my_role() to anon, authenticated;

-- 5. Admin management policies
create policy staff_admin_select on staff
  for select using (my_role() = 'admin');
create policy staff_admin_insert on staff
  for insert with check (my_role() = 'admin');
create policy staff_admin_update on staff
  for update using (my_role() = 'admin');

create policy staff_clinics_select_own on staff_clinics
  for select using (staff_id = (select auth.uid()));
create policy staff_clinics_admin_all on staff_clinics
  for all using (my_role() = 'admin') with check (my_role() = 'admin');

-- 6. Self-escalation guard: non-admins may only change their own
--    active_clinic_id / full_name / signature_url / licenses.
--    (staff_update_own_row previously allowed editing any column.)
create or replace function public.staff_guard_self_update()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  -- service role / migrations bypass (no auth context)
  if auth.uid() is null then
    return new;
  end if;
  if my_role() is distinct from 'admin' then
    if new.role      is distinct from old.role
       or new.clinic_id is distinct from old.clinic_id
       or new.active    is distinct from old.active
       or new.is_manager is distinct from old.is_manager then
      raise exception 'Only admins may change role, home clinic, manager flag, or active status';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.staff_guard_self_update() from anon, authenticated, public;

drop trigger if exists staff_guard_self_update on staff;
create trigger staff_guard_self_update
  before update on staff
  for each row execute function public.staff_guard_self_update();

-- 7. Org-wide authenticated reads for the Sycle-style "all locations"
--    search + cross-clinic chart access. Writes remain clinic-scoped
--    via the existing my_clinic_id() policies.
do $$
declare t text;
begin
  foreach t in array array[
    'patients','audiograms','audiogram_thresholds','device_fittings',
    'device_sides','insurance_coverage','appointments','visits','intakes',
    'patient_documents','upgrade_assessments','punch_cards',
    'patient_campaigns','campaign_deliveries','recommendation_engine_output',
    'price_adjustment_log','purchase_configuration','purchase_line_item',
    'tns_outcomes','kiosk_upgrade_sessions','va_episodes',
    'lima_charlie_donations','staff'
  ]
  loop
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      'authenticated_read_all_' || t, t
    );
  end loop;
end $$;
