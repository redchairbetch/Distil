/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL. This source code is the exclusive property of
 * the copyright holder. Unauthorized copying, distribution, modification, or
 * use of this file, in whole or in part, via any medium, is strictly
 * prohibited without the prior written permission of the copyright holder.
 * See the LICENSE file at the repository root for full terms.
 */

// Edge function: subscribe-push
//
// Write proxy for the push_subscriptions table. Aided patients are not
// authenticated (no Supabase auth.uid), so RLS policies cannot key on the
// caller. Instead we use the service role here and validate that the supplied
// patient_id exists in the patients table before inserting.
//
//   POST   /subscribe-push   { patient_id, subscription, user_agent? }  → upsert
//   DELETE /subscribe-push   { endpoint }                                → mark inactive

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();

    if (req.method === 'POST') {
      const { patient_id, subscription, user_agent } = body ?? {};
      if (
        !patient_id ||
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
      ) {
        return json({ error: 'invalid payload' }, 400);
      }

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('id', patient_id)
        .single();

      if (!patient) return json({ error: 'patient not found' }, 404);

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            patient_id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            user_agent: user_agent ?? null,
            active: true,
            last_seen_at: new Date().toISOString(),
            last_error: null,
          },
          { onConflict: 'endpoint' },
        );

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { endpoint } = body ?? {};
      if (!endpoint) return json({ error: 'missing endpoint' }, 400);

      const { error } = await supabase
        .from('push_subscriptions')
        .update({ active: false, last_seen_at: new Date().toISOString() })
        .eq('endpoint', endpoint);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
