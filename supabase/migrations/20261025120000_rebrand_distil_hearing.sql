-- Rebrand: My Hearing Centers → Distil Hearing (2026-10-25).
-- Data-only. Location names keep their "<Brand> – <City>" shape so the
-- UI's shortClinicName() (src/lib/brand.js) still strips the prefix.
update public.clinics
   set name = regexp_replace(name, '^My Hearing Centers', 'Distil Hearing')
 where name like 'My Hearing Centers%';

-- Was "WSA / My Hearing Centers"; the practice is no longer WSA-affiliated.
update public.organizations
   set name = 'Distil Hearing'
 where name ilike '%My Hearing Centers%';
