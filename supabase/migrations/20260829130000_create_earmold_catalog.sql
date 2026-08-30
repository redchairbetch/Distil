/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. See the LICENSE file at the repository root.
 */

-- Backlog #42 (phase a) — earmold catalog reference table.
--
-- One row per (manufacturer, mold style), transcribed from the earmold order
-- forms in docs/manufacturer-forms/. Option groups are jsonb because the
-- availability matrices are irregular per manufacturer (style×material,
-- material×color, vent×canal) and are consumed whole by the wizard's
-- EarmoldPicker — never joined across manufacturers. Provenance columns
-- (form_id, confidence) let providers audit a row against the printed form
-- before trusting an unusual combination.
--
-- RLS mirrors the legacy_device reference-table pattern (20260630000000):
-- reads open to all authenticated staff, writes admin-only.

create table if not exists public.earmold_catalog (
  id            text primary key,          -- 'signia|skeleton'
  manufacturer  text not null,             -- canonical key (src/lib/manufacturerKeys.js)
  form_id       text not null,             -- source form in the manufacturer-form registry
  device_type   text not null check (device_type in ('ric', 'bte', 'both')),
  style_id      text not null,
  style_label   text not null,
  materials     jsonb not null default '[]'::jsonb, -- [{id,label,colors:[{id,label}],notes}]
  vents         jsonb not null default '[]'::jsonb, -- [{id,label,sizes:[],notes}]
  canal         jsonb not null default '{}'::jsonb, -- {types:[], lengths:[]}
  tubing        jsonb not null default '{}'::jsonb, -- {receivers:[]} RIC | {options:[]} BTE
  extras        jsonb not null default '{}'::jsonb, -- retention/finish/waxguard/options/labeling
  constraints_note text,
  sort_order    int not null default 0,
  confidence    text not null default 'high' check (confidence in ('high', 'medium', 'low')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.earmold_catalog is
  'Earmold option reference per manufacturer+style, transcribed from manufacturer order forms (backlog #42a). Drives the wizard EarmoldPicker and the admin browse view.';
comment on column public.earmold_catalog.confidence is
  'high = fully machine-verified transcription; medium = the printed form gates some combinations in a grid that was not fully machine-readable — verify on paper.';

create index if not exists idx_earmold_catalog_mfr on public.earmold_catalog (manufacturer) where active;

alter table public.earmold_catalog enable row level security;

create policy earmold_catalog_auth_read on public.earmold_catalog
  for select to authenticated using (true);

create policy earmold_catalog_admin_write on public.earmold_catalog
  for all to authenticated
  using ((select role from public.staff where id = (select auth.uid())) = 'admin')
  with check ((select role from public.staff where id = (select auth.uid())) = 'admin');
