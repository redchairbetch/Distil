-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- 022_log_price_adjustment_rpc.sql
-- Closer-role: Price Adjustment Authorization (spec §6/§10).
--
-- Write path for the price_adjustment_log audit table. SECURITY DEFINER so a
-- traveling closer can record an adjustment at an event clinic that is not their
-- home clinic — the table's clinic-scoped RLS write policy (clinic_id =
-- my_clinic_id()) would otherwise reject it. The function:
--   * stamps provider_id = auth.uid() server-side (the actor cannot be spoofed;
--     "every adjustment under the staff id"),
--   * derives clinic_id from the patient row (not caller-supplied),
--   * lets the table's GENERATED columns compute delta_amount / delta_percent,
--   * leaves required_manager_auth / manager_id inert (closers have unlimited
--     discount authority, name attached — no manager-auth path, no threshold).
-- Append-only (INSERT, returns the new row id) — no patient data is read back.
--
-- NOTE: the price_adjustment_log table, purchase_configuration,
-- purchase_line_item, and the §10 clinics additions were applied to prod in an
-- earlier session via the Supabase MCP and are not yet captured as migration
-- files in this folder (pending a history-backfill pass). This migration is the
-- one piece of that feature's DDL authored here, captured so the discount write
-- path is reproducible.

create or replace function public.log_price_adjustment(
  p_patient_id uuid,
  p_original_price numeric,
  p_adjusted_price numeric,
  p_reason_code text,
  p_reason_text text default null,
  p_product_type text default 'device',
  p_sku text default null,
  p_purchase_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff  uuid := auth.uid();
  v_clinic uuid;
  v_id     uuid;
begin
  if not exists (select 1 from staff where id = v_staff and active) then
    raise exception 'not authorized: caller is not active staff';
  end if;

  select clinic_id into v_clinic from patients where id = p_patient_id;
  if v_clinic is null then
    raise exception 'patient not found or patient has no clinic';
  end if;

  insert into price_adjustment_log (
    provider_id, patient_id, clinic_id, purchase_id,
    product_type, sku, original_price, adjusted_price,
    reason_code, reason_text,
    required_manager_auth, manager_id
  ) values (
    v_staff, p_patient_id, v_clinic, p_purchase_id,
    p_product_type, p_sku, p_original_price, p_adjusted_price,
    p_reason_code, p_reason_text,
    false, null
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_price_adjustment(uuid,numeric,numeric,text,text,text,text,uuid) from public;
revoke all on function public.log_price_adjustment(uuid,numeric,numeric,text,text,text,text,uuid) from anon;
grant execute on function public.log_price_adjustment(uuid,numeric,numeric,text,text,text,text,uuid) to authenticated;
