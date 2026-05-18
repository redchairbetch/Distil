// Edge function: send-push
//
// Delivers a Web Push (RFC 8030/8291) notification to every active
// subscription for a patient. Called from the Distil provider CRM (the manual
// "Notify Patient" action) and, later, from scheduled jobs (Phase 4).
//
//   POST /send-push  { patient_id, title, body, url?, tag? }  → { ok, sent, failed }
//
// Auth: the caller must present a real authenticated provider session
// (a Supabase user JWT). The public anon key is rejected — without that gate
// anyone holding a patient's pid could push attacker-controlled text to their
// device. Distil providers are authenticated, so they pass.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Public half of the VAPID keypair — already shipped in the Aided client
// (src/Aided.jsx). Safe to embed here; the private key is an edge secret.
const VAPID_PUBLIC_KEY =
  'BJCKzkGWeA724r7lKUs2xwq19HGIazobrVD8FzZhr6kLgcBn9E1mSLatAGehFNjhYaM7KSA3iCrPGhNPZkmxPrk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

  // ── Auth: require a real provider session, not the public anon key ────────
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return json({ error: 'unauthorized' }, 401);

  try {
    const { patient_id, title, body, url, tag } = (await req.json()) ?? {};
    if (!patient_id || !title || !body) {
      return json({ error: 'patient_id, title and body are required' }, 400);
    }

    const admin = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: patient } = await admin
      .from('patients')
      .select('id')
      .eq('id', patient_id)
      .single();
    if (!patient) return json({ error: 'patient not found' }, 404);

    const { data: subs, error: subErr } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('patient_id', patient_id)
      .eq('active', true);
    if (subErr) return json({ error: subErr.message }, 500);
    if (!subs?.length) return json({ ok: true, sent: 0, failed: 0 });

    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!privateKey) return json({ error: 'VAPID_PRIVATE_KEY not configured' }, 500);
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'https://distil-lime.vercel.app',
      VAPID_PUBLIC_KEY,
      privateKey,
    );

    const payload = JSON.stringify({
      title,
      body,
      url: url ?? '/aided',
      tag: tag ?? undefined,
    });

    let sent = 0;
    let failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        failed++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 — the push service no longer recognizes this endpoint.
        // Retire the row so later sends (and Phase 4 jobs) skip it.
        if (statusCode === 404 || statusCode === 410) {
          await admin
            .from('push_subscriptions')
            .update({
              active: false,
              last_error: `gone (${statusCode})`,
              last_seen_at: new Date().toISOString(),
            })
            .eq('id', sub.id);
        } else {
          await admin
            .from('push_subscriptions')
            .update({ last_error: String((err as Error)?.message ?? err) })
            .eq('id', sub.id);
        }
      }
    }

    return json({ ok: true, sent, failed });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
