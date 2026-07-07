-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: add_closer_to_staff_role_check
-- Prod version: 20260614153915 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production).
--
-- Widens the staff role CHECK to allow the event-specialist 'closer' role.

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role = any (array['audiologist'::text, 'front_desk'::text, 'admin'::text, 'closer'::text]));
