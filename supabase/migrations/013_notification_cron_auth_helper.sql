-- Auth helper for the notification-cron edge function.
-- Returns the shared secret the pg_cron job ("aided-daily-notifications")
-- authenticates with. The secret lives in Vault under the name
-- 'service_role_key'; the cron job reads it directly, and the edge function
-- reads it back through this function, so the two always agree regardless of
-- which Supabase API-key format is in use.
-- SECURITY DEFINER: required to read the vault schema. EXECUTE is granted only
-- to service_role (the edge function's client) -- never anon/authenticated.
create or replace function public.get_cron_auth_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'service_role_key'
$$;

revoke execute on function public.get_cron_auth_secret() from public;
grant execute on function public.get_cron_auth_secret() to service_role;
