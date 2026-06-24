-- Backlog #17: enforce admin-only access to catalog/pricing admin tooling.
--
-- The catalog + insurance-plans editors were already admin-gated in the UI nav
-- (Distil.jsx checkRole(staffRole, ["admin"])), but enforcement was incomplete:
--   1. product_catalog / insurance_plans restricted writes to staff.role='admin',
--      but the two tables holding the actual PRICES did not — any authenticated
--      user (e.g. the closer login) could rewrite retail anchors + tier pricing.
--   2. staff_update_own_row (UPDATE USING id=auth.uid(), no with_check) let a
--      non-admin run `update staff set role='admin' where id=auth.uid()` and
--      self-promote, defeating every admin gate.
--
-- This migration closes both. Reads stay open to all authenticated users — the
-- wizard / device-selection screens read these tables for every logged-in
-- provider. Mirrors the existing admin_manage_catalog / admin_manage_plans
-- pattern: (select role from staff where id = auth.uid()) = 'admin'.

-- a. clinic_retail_anchors: replace permissive ALL-write with admin-only write.
drop policy if exists cra_auth_write on public.clinic_retail_anchors;
create policy cra_admin_write on public.clinic_retail_anchors
  for all to authenticated
  using ((select role from public.staff where id = (select auth.uid())) = 'admin')
  with check ((select role from public.staff where id = (select auth.uid())) = 'admin');

-- b. product_catalog_tier: same treatment.
drop policy if exists product_catalog_tier_auth_write on public.product_catalog_tier;
create policy product_catalog_tier_admin_write on public.product_catalog_tier
  for all to authenticated
  using ((select role from public.staff where id = (select auth.uid())) = 'admin')
  with check ((select role from public.staff where id = (select auth.uid())) = 'admin');

-- c. staff: block non-admins from changing their own role or clinic_id.
-- RLS with_check can't compare to the OLD row, so a BEFORE UPDATE trigger is the
-- correct tool. SECURITY DEFINER so the admin lookup isn't itself RLS-filtered;
-- auth.uid() still reflects the calling user inside a definer function. The only
-- legitimate self-write to staff is signature_url (updateStaffSignature), which
-- this leaves untouched.
create or replace function public.prevent_staff_priv_escalation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role is distinct from old.role
      or new.clinic_id is distinct from old.clinic_id)
     and (select role from public.staff where id = (select auth.uid())) is distinct from 'admin'
  then
    raise exception 'only admins may change a staff role or clinic';
  end if;
  return new;
end $$;

-- Trigger functions fire via the trigger mechanism, not the caller's EXECUTE
-- grant, so revoking RPC access is safe and silences the SECURITY DEFINER lint.
revoke all on function public.prevent_staff_priv_escalation() from public, anon, authenticated;

drop trigger if exists trg_prevent_staff_priv_escalation on public.staff;
create trigger trg_prevent_staff_priv_escalation
  before update on public.staff
  for each row execute function public.prevent_staff_priv_escalation();
