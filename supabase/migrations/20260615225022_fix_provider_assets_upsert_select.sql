-- Migration: fix_provider_assets_upsert_select
-- Prod version: 20260615225022 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production). Shipped with PR #103.
--
-- Re-adds a SELECT policy (dropped by harden_closer_provider_access) scoped to
-- the caller's own signature object, because storage upsert does an existence
-- SELECT first — without it, signature re-upload fails.

-- Storage upsert (upload with upsert:true) does an existence SELECT first, so
-- it needs a SELECT policy. Scope it to the caller's OWN signature object so
-- upload works without re-exposing a bucket-wide file listing.
drop policy if exists "provider_assets_auth_select" on storage.objects;
create policy "provider_assets_auth_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'provider-assets' and name = 'signatures/' || auth.uid()::text || '.png');
