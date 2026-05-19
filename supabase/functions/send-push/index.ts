// Edge function: send-push
//
// Delivers a Web Push notification to every active subscription for a
// patient. Called from the Distil provider CRM (the manual "Notify Patient"
// action).
//
//   POST /send-push  { patient_id, title, body, url?, tag? }  → { ok, sent, failed }
//
// Auth: the caller must present a real authenticated provider session (a
// Supabase user JWT). The public anon key is rejected — without that gate
// anyone holding a patient's pid could push attacker-controlled text to their
// device. Distil providers are authenticated, so they pass.
//
// The actual encryption + send loop lives in ../_shared/webpush.ts, shared
// with notification-cron.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendToPatient } from '../_shared/webpush.ts';

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

    const { sent, failed } = await sendToPatient(admin, patient_id, { title, body, url, tag });
    return json({ ok: true, sent, failed });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
