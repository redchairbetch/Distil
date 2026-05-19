// Edge function: notification-cron
//
// Scheduled scanner for the Aided notification system (Phase 4). Invoked once
// daily by a pg_cron job (see migration 012). Reads get_due_notifications(),
// claims a notification_log row per due reminder (so it never fires twice),
// and pushes it through the shared sendToPatient() helper.
//
//   POST /notification-cron  →  { ok, due, sent }
//
// Auth: the bearer token must equal the cron shared secret. It is stored in
// Vault (secret name: service_role_key) and read back via the
// get_cron_auth_secret() RPC; the pg_cron job sends the same Vault secret, so
// the two always agree. Not a user-facing endpoint; verify_jwt is disabled and
// this token check is the gate.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendToPatient, type PushPayload } from '../_shared/webpush.ts';

interface DueRow {
  patient_id: string;
  kind: string;
  ref_key: string;
  detail: string | null;
}

// kind → notification copy. `detail` carries the appointment type for the
// appointment reminder and is ignored by the others.
function payloadFor(kind: string, detail: string | null): PushPayload {
  switch (kind) {
    case 'appointment_24h':
      return {
        title: 'Appointment tomorrow',
        body: detail
          ? `You have a ${detail} appointment tomorrow. Call the clinic if you need to reschedule.`
          : 'You have an appointment tomorrow. Call the clinic if you need to reschedule.',
        tag: 'appointment',
      };
    case 'cleaning_monthly':
      return {
        title: 'Time for a clean & check',
        body: 'A quick clean keeps your hearing aids performing their best — stop by the clinic when it suits you.',
        tag: 'cleaning',
      };
    case 'warranty_90d':
      return {
        title: 'Warranty: 90 days left',
        body: 'Your hearing aid warranty ends in about 90 days — a good time for a check-up.',
        tag: 'warranty',
      };
    case 'warranty_30d':
      return {
        title: 'Warranty: 30 days left',
        body: "Your hearing aid warranty ends in about 30 days. Let's make sure everything is working well.",
        tag: 'warranty',
      };
    case 'warranty_expired':
      return {
        title: 'Warranty has ended',
        body: 'Your hearing aid warranty has ended. Ask the clinic about your protection options.',
        tag: 'warranty',
      };
    case 'upgrade_year4':
      return {
        title: 'Time to talk upgrades',
        body: "It's been about four years — let's look at what's new in hearing technology.",
        tag: 'upgrade',
      };
    default:
      return { title: 'My Hearing Centers', body: 'You have an update from your clinic.' };
  }
}

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

  // Auth: the caller must present the cron shared secret. get_cron_auth_secret()
  // returns the Vault secret the pg_cron job also sends, so the two agree no
  // matter which Supabase API-key format is in use. The RPC is service-role only.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: expectedToken, error: authErr } = await admin.rpc('get_cron_auth_secret');
  if (authErr) return json({ error: 'auth check unavailable' }, 500);
  if (!expectedToken || token !== expectedToken) return json({ error: 'unauthorized' }, 401);

  try {
    const { data: due, error } = await admin.rpc('get_due_notifications');
    if (error) return json({ error: error.message }, 500);

    const rows = (due ?? []) as DueRow[];
    let sent = 0;

    for (const row of rows) {
      try {
        // Claim the slot first. ON CONFLICT DO NOTHING against the unique
        // (patient_id, kind, ref_key) index makes this idempotent — a reminder
        // is never sent twice, even if the cron runs twice in a day.
        const { data: claimed } = await admin
          .from('notification_log')
          .upsert(
            { patient_id: row.patient_id, kind: row.kind, ref_key: row.ref_key },
            { onConflict: 'patient_id,kind,ref_key', ignoreDuplicates: true },
          )
          .select('id')
          .maybeSingle();
        if (!claimed) continue; // already handled by an earlier run

        const result = await sendToPatient(admin, row.patient_id, payloadFor(row.kind, row.detail));
        sent += result.sent;
        await admin
          .from('notification_log')
          .update({ sent_count: result.sent })
          .eq('id', claimed.id);
      } catch (err) {
        // One bad row must not abort the rest of the scan.
        console.error('notification-cron row failed:', row.kind, row.patient_id, err);
      }
    }

    return json({ ok: true, due: rows.length, sent });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
