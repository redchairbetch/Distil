-- Migration: add_closer_to_staff_role_check
-- Prod version: 20260614153915 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production).
--
-- Widens the staff role CHECK to allow the event-specialist 'closer' role.

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role = any (array['audiologist'::text, 'front_desk'::text, 'admin'::text, 'closer'::text]));
