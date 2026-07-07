-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: harden_closer_provider_access
-- Prod version: 20260615031310 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production).
--
-- Locks the provider resolver to signed-in staff and drops the broad
-- provider-assets SELECT/list policy.

-- Provider resolver: signed-in staff only (closers are authenticated); not anon.
revoke execute on function public.get_clinic_providers(uuid) from public;
revoke execute on function public.get_clinic_providers(uuid) from anon;

-- Public bucket doesn't need a broad SELECT/list policy; object URLs still
-- resolve for rendering signatures. Removing avoids exposing a file listing.
drop policy if exists "provider_assets_auth_select" on storage.objects;
