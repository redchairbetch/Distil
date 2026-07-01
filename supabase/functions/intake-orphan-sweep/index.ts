// Edge function: intake-orphan-sweep
//
// Quarterly janitor (backlog #15) that removes orphaned kiosk-intake archive
// objects — storage objects under clinics/*/intakes/* with no matching
// patient_documents row. These accumulate when the anonymous kiosk's archive
// insert fails: anon has no storage DELETE policy, so uploadPatientDocument's
// own cleanup no-ops and the object is stranded.
//
//   POST /intake-orphan-sweep  { dryRun?, graceDays?, limit? }
//     dryRun true  → report what WOULD be deleted, delete nothing (default false)
//     graceDays    → only sweep objects older than this many days (default 7)
//     limit        → max objects per run (default 500, capped at 1000 by the RPC)
//   → { ok, deleted } | { ok, dryRun, orphans, sample }
//
// Deletes through the Storage API (the only way that also removes the physical
// file). The find step is the read-only list_intake_orphans() RPC; a defensive
// prefix guard here means even a misbehaving RPC can't delete outside intakes.
//
// Auth mirrors notification-cron: the bearer token must equal the cron shared
// secret (Vault service_role_key, read via get_cron_auth_secret()). verify_jwt
// is disabled and this token check is the gate.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'patient-documents';
const INTAKE_PREFIX = /^clinics\/[^/]+\/intakes\//;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Auth: caller must present the cron shared secret (see notification-cron).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: expected, error: authErr } = await admin.rpc('get_cron_auth_secret');
  if (authErr) return json({ error: 'auth check unavailable' }, 500);
  if (!expected || token !== expected) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const graceDays = Number.isFinite(body?.graceDays) ? Number(body.graceDays) : 7;
  const limit = Number.isFinite(body?.limit) ? Number(body.limit) : 500;

  const { data: rows, error } = await admin.rpc('list_intake_orphans', {
    grace_days: graceDays,
    lim: limit,
  });
  if (error) return json({ error: error.message }, 500);

  // Defense in depth: never act on anything outside the intake prefix.
  const paths = (rows ?? [])
    .map((r: { name: string }) => r.name)
    .filter((p: string) => p && INTAKE_PREFIX.test(p));

  if (dryRun) {
    return json({ ok: true, dryRun: true, orphans: paths.length, sample: paths.slice(0, 20) });
  }
  if (paths.length === 0) return json({ ok: true, deleted: 0 });

  const { data: removed, error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
  if (rmErr) return json({ error: rmErr.message }, 500);

  return json({ ok: true, deleted: (removed ?? []).length, requested: paths.length });
});
