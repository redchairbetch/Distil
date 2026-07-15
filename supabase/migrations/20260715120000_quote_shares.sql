-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- Migration: 20260715120000_quote_shares
-- Created: 2026-07-15
-- Description: Interactive take-home quote links. Generating a quote (wizard or
--              Custom Quote modal) now also mints a tokenized share row whose
--              payload is a PHI-minimal display snapshot (patient FIRST NAME
--              only — no phone, no DOB, no address) of the same data the PDF
--              prints. The anonymous /quote/<token> page reads it through a
--              SECURITY DEFINER RPC that also records open tracking
--              (first/last viewed, view count) — the engagement signal the
--              follow-up queue (backlog #1) will consume later.
--
-- Security model (mirrors kiosk_upgrade_sessions + send_patient_reply):
--   * Bearer = knowledge of a 192-bit random token; links expire with the
--     quote's 30-day validity and can be revoked (revoked_at).
--   * anon can ONLY call get_shared_quote(token) — there is no anon SELECT
--     policy on the table, and the RPC returns a single row's payload plus
--     clinic display fields, never a browsable set.
--   * Staff follow the org model: org-wide reads (cross-clinic chart access),
--     writes scoped to the ACTIVE clinic via my_clinic_id().

create table if not exists public.quote_shares (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  clinic_id       uuid not null references public.clinics(id) on delete cascade,
  -- The archived PDF this link was minted alongside (chart cross-reference).
  document_id     uuid references public.patient_documents(id) on delete set null,
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid references public.staff(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  -- Open tracking. Bumped by get_shared_quote on every successful resolve —
  -- including a provider previewing their own link, so counts are a signal,
  -- not an exact patient-open ledger.
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz,
  view_count      integer not null default 0
);

create index if not exists idx_quote_shares_patient on public.quote_shares(patient_id);
create index if not exists idx_quote_shares_clinic  on public.quote_shares(clinic_id);

alter table public.quote_shares enable row level security;

drop policy if exists authenticated_read_quote_shares on public.quote_shares;
create policy authenticated_read_quote_shares
  on public.quote_shares
  for select to authenticated
  using (true);

drop policy if exists staff_insert_quote_shares on public.quote_shares;
create policy staff_insert_quote_shares
  on public.quote_shares
  for insert to authenticated
  with check (clinic_id = public.my_clinic_id());

drop policy if exists staff_update_quote_shares on public.quote_shares;
create policy staff_update_quote_shares
  on public.quote_shares
  for update to authenticated
  using (clinic_id = public.my_clinic_id())
  with check (clinic_id = public.my_clinic_id());

drop policy if exists staff_delete_quote_shares on public.quote_shares;
create policy staff_delete_quote_shares
  on public.quote_shares
  for delete to authenticated
  using (clinic_id = public.my_clinic_id());

-- ── Anon resolve RPC ─────────────────────────────────────────────────────────
-- Single lookup by token; live links resolve to { payload, clinic, createdAt,
-- expiresAt } and bump the open tracking. Expired / revoked / unknown tokens
-- all return null — indistinguishable to a probing caller. The length guard
-- keeps trivially short probes from ever touching the index.
create or replace function public.get_shared_quote(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share  public.quote_shares%rowtype;
  v_clinic jsonb;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;

  select * into v_share
    from public.quote_shares
   where token = p_token
     and revoked_at is null
     and expires_at > now();
  if not found then
    return null;
  end if;

  update public.quote_shares
     set view_count      = view_count + 1,
         first_viewed_at = coalesce(first_viewed_at, now()),
         last_viewed_at  = now()
   where id = v_share.id;

  select jsonb_build_object('name', c.name, 'phone', c.phone, 'address', c.address)
    into v_clinic
    from public.clinics c
   where c.id = v_share.clinic_id;

  return jsonb_build_object(
    'payload',   v_share.payload,
    'clinic',    coalesce(v_clinic, '{}'::jsonb),
    'createdAt', v_share.created_at,
    'expiresAt', v_share.expires_at
  );
end;
$$;

-- Default privileges grant EXECUTE directly to anon/authenticated on new
-- functions; make the grant explicit and intentional (see migration
-- 20260704200000 for why the revoke-then-grant dance matters).
revoke execute on function public.get_shared_quote(text) from public, anon, authenticated;
grant  execute on function public.get_shared_quote(text) to anon, authenticated;
