/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL. See the LICENSE file at the repository root.
 */

-- Backlog #42 (phase c) — manufacturer form engine support.
--
-- 1. patient_documents gains the 'manufacturer_form' kind: filled repair /
--    Loss & Damage / Return-for-Credit PDFs generated from the chart archive
--    alongside quotes and purchase agreements. The CHECK is dropped and
--    re-added with the full live kind list (verified against the remote
--    constraint on 2026-08-29).
-- 2. clinics gains fax + manufacturer_accounts: the practice header data the
--    fill engine prints on every manufacturer's paperwork. Accounts are keyed
--    by canonical manufacturer key (src/lib/manufacturerKeys.js) with separate
--    bill-to / ship-to numbers, since several manufacturers bill and ship on
--    different account numbers.

alter table public.patient_documents drop constraint patient_documents_kind_check;
alter table public.patient_documents add constraint patient_documents_kind_check
  check (kind in ('quote', 'purchase_agreement', 'kiosk_intake', 'medical_referral', 'manufacturer_form'));

alter table public.clinics add column if not exists fax text;
alter table public.clinics add column if not exists manufacturer_accounts jsonb not null default '{}'::jsonb;

comment on column public.clinics.fax is
  'Clinic fax number, printed on manufacturer forms (backlog #42).';
comment on column public.clinics.manufacturer_accounts is
  'Canonical manufacturer key -> { billTo, shipTo } account numbers; consumed by the manufacturer form fill engine (backlog #42).';
