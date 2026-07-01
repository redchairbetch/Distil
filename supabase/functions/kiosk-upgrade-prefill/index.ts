// kiosk-upgrade-prefill — redeem a short, single-use upgrade check-in code
// minted by a provider in the CRM, returning the returning-patient prefill
// payload (prior contact + last readiness answers) for the anonymous kiosk.
//
// verify_jwt is false: the kiosk runs anon. The CODE itself is the bearer
// secret — the function self-authenticates by validating it against
// kiosk_upgrade_sessions with the service role (RLS-bypassing), enforces
// single-use + 30-min expiry, and never exposes patient_id or any chart key.
// Mirrors the verify_jwt:false self-auth pattern of subscribe-push.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const clean = String(body?.code ?? "").trim().toUpperCase();
    if (!clean) return json({ error: "missing_code" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await supabase
      .from("kiosk_upgrade_sessions")
      .select("id, payload, expires_at, used_at")
      .eq("code", clean)
      .maybeSingle();

    if (error) {
      console.error("lookup", error);
      return json({ error: "lookup_failed" }, 500);
    }
    if (!row) return json({ error: "not_found" }, 404);
    if (row.used_at) return json({ error: "already_used" }, 410);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 410);

    // Single-use: atomically claim by requiring used_at still null, so a
    // concurrent redeem can't double-consume the same code.
    const { data: claimed, error: claimErr } = await supabase
      .from("kiosk_upgrade_sessions")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) return json({ error: "already_used" }, 410);

    return json({ payload: row.payload ?? {} }, 200);
  } catch (e) {
    console.error("prefill", e);
    return json({ error: "bad_request" }, 400);
  }
});
