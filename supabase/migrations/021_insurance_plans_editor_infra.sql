-- 021: Editor infrastructure for insurance_plans (backlog #17 — insurance-plans CRUD).
--
-- RLS already covers the editor (authenticated_read_plans SELECT +
-- admin_manage_plans ALL for staff.role='admin'), so this only adds:
--   1. updated_at + maintenance trigger (matches product_catalog, migration 015)
--   2. a partial unique index — resolveInsurancePlanId() (db.js) uses
--      .maybeSingle() on (carrier, plan_group, tier_label, active), which errors
--      (→ silent null) if editor drift ever creates duplicates
--   3. the existing generic audit_trigger_fn, so plan/price changes land in
--      audit_log with changed_fields + performed_by (same as the 12 patient
--      tables; insurance_plans.id is uuid, which audit_log.record_id requires)

alter table public.insurance_plans
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists insurance_plans_set_updated_at on public.insurance_plans;
create trigger insurance_plans_set_updated_at
  before update on public.insurance_plans
  for each row execute function public.update_updated_at();

-- Verified pre-migration: no duplicates exist among the 185 active rows.
create unique index if not exists insurance_plans_active_identity_uniq
  on public.insurance_plans (carrier, plan_group, tier_label)
  where active;

drop trigger if exists audit_insurance_plans on public.insurance_plans;
create trigger audit_insurance_plans
  after insert or update or delete on public.insurance_plans
  for each row execute function public.audit_trigger_fn();
