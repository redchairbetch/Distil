-- Distil — hearing clinic patient management & intake system
-- Copyright (c) 2026 Kurt Mooney. All rights reserved.
-- PROPRIETARY AND CONFIDENTIAL. Unauthorized use, copying, or distribution is
-- prohibited without the prior written permission of the copyright holder.
-- See the LICENSE file at the repository root for full terms.

-- get_cron_auth_secret() is SECURITY DEFINER and returns the Vault secret
-- that authenticates the pg_cron → edge-function calls (notification-cron,
-- intake-orphan-sweep). Migration 013 revoked EXECUTE from PUBLIC, but
-- Supabase's default privileges also grant EXECUTE on new functions DIRECTLY
-- to anon and authenticated — and revoking the PUBLIC pseudo-role does not
-- touch direct grants. Net effect: anyone holding the publishable key could
-- read the cron secret via /rest/v1/rpc/get_cron_auth_secret. Both real
-- callers use the service-role client, so this revoke breaks nothing.
revoke execute on function public.get_cron_auth_secret() from anon, authenticated;

-- Trigger functions are never legitimately called through the API (Postgres
-- rejects direct invocation of trigger functions anyway) — revoked as
-- defense in depth. NOT revoked: my_clinic_id()/my_role() (evaluated as the
-- querying role inside RLS policies — authenticated needs EXECUTE) and
-- mark_message_read() (intentionally anon-callable from the Aided app).
revoke execute on function public.audit_trigger_fn() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
