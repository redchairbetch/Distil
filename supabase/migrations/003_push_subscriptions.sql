-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- READY TO APPLY: Run this in Supabase SQL editor or via CLI migration
-- Migration: 003_push_subscriptions
-- Created: 2026-04-27
-- Description: Stores Web Push (RFC 8030) subscriptions for the Aided patient PWA.
--              One row per (patient, device). Browser-issued endpoint URL is the
--              "mailbox" we POST encrypted payloads to; p256dh + auth are the
--              per-device encryption material. Edge functions write via the
--              service role (bypassing RLS); no client-side access is granted.

CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  active        boolean NOT NULL DEFAULT true,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON push_subscriptions(patient_id);
CREATE INDEX ON push_subscriptions(active) WHERE active = true;

-- RLS: enabled with no policies — denies all anon/authenticated access.
-- Edge functions using SUPABASE_SERVICE_ROLE_KEY bypass RLS and are the only writers.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
