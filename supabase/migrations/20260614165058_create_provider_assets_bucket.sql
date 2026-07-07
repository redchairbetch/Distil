-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: create_provider_assets_bucket
-- Prod version: 20260614165058 (applied via Supabase MCP; captured retroactively
-- to preserve history — already live in production).
--
-- Storage bucket for provider signature images (referenced by uploadSignatureImage
-- but never created). Public-read (path keyed by staff UUID, so unguessable);
-- authenticated insert/update/select.

insert into storage.buckets (id, name, public)
values ('provider-assets', 'provider-assets', true)
on conflict (id) do update set public = true;

-- Authenticated staff may upload/replace/read provider signature assets.
-- Public read is served via the bucket's public flag; the object path is keyed
-- by the staff UUID, so URLs are unguessable.
drop policy if exists "provider_assets_auth_insert" on storage.objects;
create policy "provider_assets_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'provider-assets');

drop policy if exists "provider_assets_auth_update" on storage.objects;
create policy "provider_assets_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'provider-assets')
  with check (bucket_id = 'provider-assets');

drop policy if exists "provider_assets_auth_select" on storage.objects;
create policy "provider_assets_auth_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'provider-assets');
