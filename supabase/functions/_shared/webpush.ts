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

// Shared Web Push send logic for the Aided notification system.
//
// Both send-push (manual provider sends) and notification-cron (scheduled
// reminders) deliver pushes through sendToPatient(). The VAPID keypair's
// public half lives here; the private half is the VAPID_PRIVATE_KEY edge
// secret. Dead (404/410) subscriptions are retired as they're encountered.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Public half of the VAPID keypair — also shipped in the Aided client
// (src/Aided.jsx). Safe to embed; the private key is an edge secret.
export const VAPID_PUBLIC_KEY =
  'BJCKzkGWeA724r7lKUs2xwq19HGIazobrVD8FzZhr6kLgcBn9E1mSLatAGehFNjhYaM7KSA3iCrPGhNPZkmxPrk';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!privateKey) throw new Error('VAPID_PRIVATE_KEY not configured');
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'https://distil-lime.vercel.app',
    VAPID_PUBLIC_KEY,
    privateKey,
  );
  vapidReady = true;
}

// Sends a notification to every active subscription a patient has registered.
// A 404/410 from the push service means the endpoint is gone — that row is
// marked inactive so later sends (and the cron) skip it. Returns the tally.
export async function sendToPatient(
  admin: SupabaseClient,
  patientId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  ensureVapid();

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('patient_id', patientId)
    .eq('active', true);
  if (error) throw new Error(error.message);
  if (!subs?.length) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/aided',
    tag: payload.tag ?? undefined,
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      sent++;
    } catch (err) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
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
  return { sent, failed };
}
