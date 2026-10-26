-- Retire the punch card care plan (2026-10-25). It was an MHC-specific
-- product. Soft-deactivate (reversible) rather than delete: historical
-- appointment_outcomes rows still carry care_plan_selected = 'punch', and
-- the empty punch_cards / punch_card_usage tables are left in place.
update public.care_plan_catalog
   set active = false
 where plan_type = 'punch';
