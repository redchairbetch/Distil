// campaign-email-drain — sends due email campaign_deliveries via Resend.
//
// Invoked daily by pg_cron (campaign-email-drain-daily) with the cron shared
// secret as bearer auth, same pattern as notification-cron / intake-orphan-
// sweep. verify_jwt:false — the function self-authenticates against
// get_cron_auth_secret().
//
// SAFETY LATCH: real sends require the EMAIL_LIVE=true function secret,
// which should only be set once a sending domain is verified in Resend
// (until then Resend rejects sends to anyone but the account owner anyway).
// Without it the function is a dry-run: it reports what WOULD send and
// mutates nothing. A manual invocation can pass { testTo } to deliver one
// [TEST]-prefixed sample email (to the Resend account owner's address)
// without touching any delivery rows.
//
// Modes:
//   cron default {}            → live? drain up to `limit` : dry-run report
//   { dryRun: true }           → report only, even when EMAIL_LIVE=true
//   { testTo: "you@x" }        → dry-run + one sample email to testTo
//   { limit: n }               → cap rows per run (default 50)
//
// Retry: a failed send bumps attempts and keeps status='pending' so the next
// daily run retries; the third failure marks it 'failed' with the error.
// Patients with no email on file are marked 'skipped' (live mode only).

import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_ATTEMPTS = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain, transparent patient-facing copy — no marketing framing. The opt-out
// line is honored manually for pilot volume (front desk cancels the
// enrollment); a proper suppression list is a pre-scale TODO.
function renderEmail({ firstName, title, body, url, clinicName, clinicPhone }: {
  firstName: string | null; title: string; body: string; url: string | null;
  clinicName: string; clinicPhone: string | null;
}) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
  const phoneLine = clinicPhone ? ` or call us at ${clinicPhone}` : '';
  const footerText = `Sent by ${clinicName}. Questions? Reply to this email${phoneLine}. If you'd rather not receive these emails, reply and let us know — we'll stop them.`;

  const text = `${greeting}\n\n${body}\n${url ? `\n${url}\n` : ''}\n—\n${footerText}`;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a2b2d;max-width:560px;margin:0 auto;padding:24px 16px;">
  <p style="font-size:15px;">${esc(greeting)}</p>
  ${body.split(/\n\n+/).map(p => `<p style="font-size:15px;line-height:1.6;">${esc(p)}</p>`).join('')}
  ${url ? `<p><a href="${esc(url)}" style="color:#0A7B8C;font-weight:bold;">${esc(title)}</a></p>` : ''}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:12px;color:#5a7274;line-height:1.5;">${esc(footerText)}</p>
</body></html>`;
  return { text, html };
}

async function sendViaResend(apiKey: string, payload: Record<string, unknown>) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body?.message || `Resend ${resp.status}`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: expected, error: authErr } = await admin.rpc('get_cron_auth_secret');
  if (authErr) return json({ error: 'auth check unavailable' }, 500);
  if (!expected || token !== expected) return json({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500);
  const fromAddress = Deno.env.get('RESEND_FROM') || 'onboarding@resend.dev';
  const live = Deno.env.get('EMAIL_LIVE') === 'true';

  const body = await req.json().catch(() => ({}));
  const dryRun = !live || body?.dryRun === true;
  const testTo = typeof body?.testTo === 'string' ? body.testTo : null;
  const limit = Number.isFinite(body?.limit) ? Number(body.limit) : 50;

  // Due email deliveries: pending, scheduled, on an active enrollment,
  // under the retry cap. Embeds are aliased so filters address them stably.
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error: dueErr } = await admin
    .from('campaign_deliveries')
    .select(`id, scheduled_date, attempts,
      step:campaign_steps!inner(delivery_channel, content:campaign_content(title, body, url)),
      enrollment:patient_campaigns!inner(status, patient:patients!inner(id, first_name, email, clinic_id, created_by))`)
    .eq('status', 'pending')
    .eq('step.delivery_channel', 'email')
    .eq('enrollment.status', 'active')
    .lte('scheduled_date', today)
    .lt('attempts', MAX_ATTEMPTS)
    .order('scheduled_date', { ascending: true })
    .limit(limit);
  if (dueErr) return json({ error: dueErr.message }, 500);

  const rows = due ?? [];

  // Batch-resolve clinic identity (name/phone/reply-to) and provider names.
  const clinicIds = [...new Set(rows.map(r => r.enrollment?.patient?.clinic_id).filter(Boolean))];
  const staffIds = [...new Set(rows.map(r => r.enrollment?.patient?.created_by).filter(Boolean))];
  const [clinicsRes, staffRes] = await Promise.all([
    clinicIds.length
      ? admin.from('clinics').select('id, name, phone, reply_to_email').in('id', clinicIds)
      : Promise.resolve({ data: [] }),
    staffIds.length
      ? admin.from('staff').select('id, full_name').in('id', staffIds)
      : Promise.resolve({ data: [] }),
  ]);
  const clinicById = Object.fromEntries((clinicsRes.data ?? []).map((c: { id: string }) => [c.id, c]));
  const staffById = Object.fromEntries((staffRes.data ?? []).map((s: { id: string }) => [s.id, s]));

  const compose = (r: typeof rows[number]) => {
    const patient = r.enrollment.patient;
    const content = r.step.content;
    const clinic = clinicById[patient.clinic_id] ?? {};
    const provider = staffById[patient.created_by] ?? null;
    const clinicName = clinic.name || 'My Hearing Centers';
    const fromDisplay = provider?.full_name || clinicName;
    const { text, html } = renderEmail({
      firstName: patient.first_name || null,
      title: content?.title || 'A note from your hearing care team',
      body: content?.body || '',
      url: content?.url || null,
      clinicName,
      clinicPhone: clinic.phone || null,
    });
    return {
      from: `${fromDisplay} <${fromAddress}>`,
      reply_to: clinic.reply_to_email || undefined,
      subject: content?.title || 'A note from your hearing care team',
      text, html,
      _to: patient.email || null,
    };
  };

  // ── Dry-run (the default until EMAIL_LIVE=true) ────────────────────────────
  if (dryRun) {
    const report = {
      ok: true,
      live,
      dryRun: true,
      due: rows.length,
      sample: rows.slice(0, 10).map(r => ({
        deliveryId: r.id,
        scheduled: r.scheduled_date,
        subject: r.step?.content?.title ?? null,
        hasPatientEmail: !!r.enrollment?.patient?.email,
      })),
    };

    // Optional single proof-of-pipeline email. Uses the first due delivery,
    // or a synthetic sample from the content library when nothing is due.
    if (testTo) {
      let payload;
      if (rows.length) {
        payload = compose(rows[0]);
      } else {
        const { data: sampleContent } = await admin
          .from('campaign_content')
          .select('title, body, url')
          .eq('content_type', 'email')
          .eq('active', true)
          .limit(1)
          .maybeSingle();
        const { text, html } = renderEmail({
          firstName: null,
          title: sampleContent?.title || 'Distil campaign email test',
          body: sampleContent?.body || 'This is a test of the Distil campaign email pipeline. If you can read this, Resend delivery works end to end.',
          url: sampleContent?.url || null,
          clinicName: 'My Hearing Centers',
          clinicPhone: null,
        });
        payload = {
          from: `My Hearing Centers <${fromAddress}>`,
          subject: sampleContent?.title || 'Distil campaign email test',
          text, html,
        };
      }
      try {
        const sent = await sendViaResend(apiKey, {
          ...payload,
          to: [testTo],
          subject: `[TEST] ${payload.subject}`,
        });
        return json({ ...report, testSent: true, testId: sent?.id ?? null });
      } catch (e) {
        return json({ ...report, testSent: false, testError: String(e?.message || e) }, 502);
      }
    }
    return json(report);
  }

  // ── Live drain ──────────────────────────────────────────────────────────────
  let sent = 0, failed = 0, skipped = 0;
  const errors: string[] = [];
  for (const r of rows) {
    const payload = compose(r);
    if (!payload._to) {
      skipped++;
      await admin.from('campaign_deliveries')
        .update({ status: 'skipped', error_message: 'patient has no email on file' })
        .eq('id', r.id);
      continue;
    }
    try {
      await sendViaResend(apiKey, {
        from: payload.from, reply_to: payload.reply_to,
        to: [payload._to], subject: payload.subject,
        text: payload.text, html: payload.html,
      });
      sent++;
      await admin.from('campaign_deliveries')
        .update({ status: 'sent', delivered_at: new Date().toISOString(), error_message: null })
        .eq('id', r.id);
    } catch (e) {
      failed++;
      const attempts = (r.attempts ?? 0) + 1;
      errors.push(`${r.id}: ${String(e?.message || e)}`);
      await admin.from('campaign_deliveries')
        .update({
          attempts,
          error_message: String(e?.message || e),
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        })
        .eq('id', r.id);
    }
    // Resend free tier allows ~2 req/s — pace the loop.
    await new Promise(res => setTimeout(res, 600));
  }
  return json({ ok: true, live, due: rows.length, sent, failed, skipped, errors: errors.slice(0, 10) });
});
