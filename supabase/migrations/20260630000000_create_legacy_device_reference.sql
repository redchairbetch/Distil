-- Old-vs-new device comparison: curated reference of legacy / competitor /
-- trade-in hearing aids so the comparator can score a patient's CURRENT device
-- against a proposed new one. These devices (e.g. a 7-yr-old Costco KS9) are
-- often ones we never fit, so they don't exist in device_fittings — this table
-- is their home. Scoring lives in src/deviceComparison.js (era + spec model);
-- only original_tier_rank / release_year / mic / bluetooth feed it.
--
-- RLS mirrors the catalog pattern (20260624...): reads open to every
-- authenticated provider; writes admin-only via the staff.role check.

create table if not exists public.legacy_device (
  id                   text primary key,
  manufacturer         text not null,                    -- actual OEM maker (KS9 -> Phonak)
  brand                text,                              -- retail brand (Costco Kirkland Signature)
  model                text not null,
  aliases              text[] not null default '{}',      -- search terms: {KS9, Kirkland 9}
  release_year         int,                               -- drives the era penalty
  platform             text,                              -- e.g. "Phonak Marvel-class"
  original_tier_label  text,                              -- Premium | Advanced | Standard (when new)
  original_tier_rank   int check (original_tier_rank in (5, 3, 1)),  -- COVERAGE_BY_RANK key
  form_factors         text[] not null default '{}',      -- {ric, bte, ...}
  channels             int,
  directional_mic      text check (directional_mic in ('omni','fixed','adaptive','beamforming')),
  rechargeable         boolean,
  bluetooth_streaming  boolean,
  telecoil             boolean,
  ip_rating            text,
  notable_features     text[] not null default '{}',
  source_url           text,                              -- provenance (defensibility)
  confidence           text check (confidence in ('high','medium','low')),
  active               boolean not null default true,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.legacy_device enable row level security;

create policy legacy_device_auth_read on public.legacy_device
  for select to authenticated using (true);

create policy legacy_device_admin_write on public.legacy_device
  for all to authenticated
  using ((select role from public.staff where id = (select auth.uid())) = 'admin')
  with check ((select role from public.staff where id = (select auth.uid())) = 'admin');
