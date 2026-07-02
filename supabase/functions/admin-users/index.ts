// admin-users — user management for Distil's Team admin view (multi-clinic
// initiative). Lets an admin create logins with a temp password, list auth
// users (to surface logins without a staff record), and reset passwords —
// all without leaving Distil for the Supabase dashboard.
//
// verify_jwt is true: the caller must be signed in. The function then checks
// the caller's staff row for role = 'admin' before doing anything, and uses
// the service role key for the auth-admin API + staff writes.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const VALID_ROLES = ["admin", "provider", "care_coordinator", "closer"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify the caller from their JWT and require an active admin.
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "not_signed_in" }, 401);
    const { data: caller } = await admin
      .from("staff")
      .select("role, active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!caller || caller.role !== "admin" || caller.active === false) {
      return json({ error: "admin_only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list-users") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) return json({ error: error.message }, 500);
      return json({
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email,
          lastSignInAt: u.last_sign_in_at ?? null,
        })),
      });
    }

    if (action === "create-user") {
      let userId: string | null = body?.userId ?? null;
      const { email, password, fullName, role, homeClinicId } = body ?? {};
      const clinicIds: string[] = Array.isArray(body?.clinicIds) ? body.clinicIds : [];
      if (!fullName || !role || !homeClinicId || !clinicIds.length) {
        return json({ error: "missing_fields" }, 400);
      }
      if (!VALID_ROLES.includes(role)) return json({ error: "invalid_role" }, 400);
      if (!clinicIds.includes(homeClinicId)) return json({ error: "home_clinic_not_assigned" }, 400);

      // No userId → mint a fresh login with a temp password. With a userId
      // (a login that exists but has no staff record) we just attach access.
      if (!userId) {
        if (!email || !password || String(password).length < 8) {
          return json({ error: "email_and_password_required" }, 400);
        }
        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) return json({ error: error.message }, 400);
        userId = created.user.id;
      }

      const { error: staffErr } = await admin.from("staff").upsert({
        id: userId,
        full_name: fullName,
        role,
        clinic_id: homeClinicId,
        active_clinic_id: homeClinicId,
        active: true,
      });
      if (staffErr) return json({ error: staffErr.message }, 400);

      const { error: scErr } = await admin.from("staff_clinics").upsert(
        clinicIds.map((clinic_id) => ({ staff_id: userId, clinic_id })),
      );
      if (scErr) return json({ error: scErr.message }, 400);

      return json({ ok: true, userId });
    }

    if (action === "reset-password") {
      const { userId, password } = body ?? {};
      if (!userId || !password || String(password).length < 8) {
        return json({ error: "userId_and_password_required" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("admin-users:", e);
    return json({ error: (e as Error)?.message ?? "internal_error" }, 500);
  }
});
