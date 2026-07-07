-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Seed: kmoulton staff record (login existed with no staff row → saw zero
-- patients), St. George + Mesquite assignments for Kurt & kmoulton, Mesquite
-- clinic-scoped catalog provisioning, and the duplicate St. George directory
-- row dedupe. (Applied to prod 2026-07-02 via MCP.)
-- Clinic ids: St. George ae14da3e-9774-4c01-924b-f9bf3cee6a03,
--             Mesquite   e7cb7815-cade-4688-8bfd-be7804e17015,
--             StG dup    5e80c876-f69d-54da-ab14-a7243966f061

-- 1. kmoulton staff row (name is a placeholder editable in the Team view)
insert into staff (id, full_name, role, is_manager, active, clinic_id, active_clinic_id)
values (
  '3e2e7947-0df4-4b7f-8897-1d5fbbd13f6a',
  'K. Moulton',
  'admin',
  false,
  true,
  'ae14da3e-9774-4c01-924b-f9bf3cee6a03',
  'ae14da3e-9774-4c01-924b-f9bf3cee6a03'
)
on conflict (id) do nothing;

-- 2. Clinic assignments: Kurt and kmoulton work both locations
insert into staff_clinics (staff_id, clinic_id) values
  ('3f901c3f-7ba6-4fd2-9d8d-f61c81d4e96c', 'ae14da3e-9774-4c01-924b-f9bf3cee6a03'),
  ('3f901c3f-7ba6-4fd2-9d8d-f61c81d4e96c', 'e7cb7815-cade-4688-8bfd-be7804e17015'),
  ('3e2e7947-0df4-4b7f-8897-1d5fbbd13f6a', 'ae14da3e-9774-4c01-924b-f9bf3cee6a03'),
  ('3e2e7947-0df4-4b7f-8897-1d5fbbd13f6a', 'e7cb7815-cade-4688-8bfd-be7804e17015')
on conflict do nothing;

-- 3a. Provision Mesquite: care plan catalog copied from St. George
insert into care_plan_catalog (clinic_id, plan_type, display_name, price, unit_label, active)
select 'e7cb7815-cade-4688-8bfd-be7804e17015', plan_type, display_name, price, unit_label, active
from care_plan_catalog
where clinic_id = 'ae14da3e-9774-4c01-924b-f9bf3cee6a03'
  and not exists (
    select 1 from care_plan_catalog m
    where m.clinic_id = 'e7cb7815-cade-4688-8bfd-be7804e17015'
      and m.plan_type = care_plan_catalog.plan_type
  );

-- 3b. Provision Mesquite: retail anchors copied from St. George.
--     insurance_plans.retail_anchor_key still points at St. George anchor
--     ids; loadPricingReveal re-resolves by label for other clinics.
insert into clinic_retail_anchors (id, clinic_id, manufacturer_class, label, price_per_aid, sort_order)
select gen_random_uuid(), 'e7cb7815-cade-4688-8bfd-be7804e17015', manufacturer_class, label, price_per_aid, sort_order
from clinic_retail_anchors
where clinic_id = 'ae14da3e-9774-4c01-924b-f9bf3cee6a03'
  and not exists (
    select 1 from clinic_retail_anchors m
    where m.clinic_id = 'e7cb7815-cade-4688-8bfd-be7804e17015'
      and m.manufacturer_class = clinic_retail_anchors.manufacturer_class
      and m.label = clinic_retail_anchors.label
  );

-- 4. Dedupe St. George: repoint the dup directory row's provider link to
--    the operational row (unless it already exists), then deactivate the
--    dup so pickers show one St. George. Kept (inactive) rather than
--    deleted — the kiosk provider matcher may reference directory rows.
update clinic_providers cp
set clinic_id = 'ae14da3e-9774-4c01-924b-f9bf3cee6a03'
where cp.clinic_id = '5e80c876-f69d-54da-ab14-a7243966f061'
  and not exists (
    select 1 from clinic_providers x
    where x.clinic_id = 'ae14da3e-9774-4c01-924b-f9bf3cee6a03'
      and x.provider_id = cp.provider_id
  );
delete from clinic_providers
where clinic_id = '5e80c876-f69d-54da-ab14-a7243966f061';
update clinics set active = false where id = '5e80c876-f69d-54da-ab14-a7243966f061';
