import React, { useEffect, useMemo, useState } from "react";
import {
  loadTeam,
  saveStaffMember,
  setStaffClinics,
  adminCreateUser,
  adminListUsers,
  adminResetPassword,
  loadActiveClinics,
} from "../db.js";

// Admin-only "Team" manager (multi-clinic initiative). Lets an admin manage
// Distil logins without leaving the app: edit roles, assign staff to the
// clinics they work in (drives the sidebar clinic switcher + RLS scoping via
// staff_clinics), create new logins with a temp password, and reset passwords.
// Login create/list/reset go through the admin-users edge function (service
// role); everything else hits staff/staff_clinics directly under admin RLS.

const NAVY = "#0a1628";
const st = {
  input: { width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" },
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", letterSpacing: 1, display: "block", marginBottom: 4 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
  btnPrimary: { background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btnGhost: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#6b7280" },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "#eef2ff", color: "#4338ca", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
};

const ROLES = [
  ["admin", "Admin"],
  ["provider", "Provider"],
  ["care_coordinator", "Care Coordinator"],
  ["closer", "Closer"],
];

const shortClinic = (name) => (name || "").replace(/^My Hearing Centers\s*[–-]\s*/, "");

export default function TeamAdmin({ activeClinicId }) {
  const [team, setTeam] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [authUsers, setAuthUsers] = useState(null); // null = edge fn unavailable
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [draft, setDraft] = useState(null); // staff member being edited / created
  const [resetFor, setResetFor] = useState(null); // { id, name } → password reset
  const [resetPw, setResetPw] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const reload = async () => {
    setLoading(true); setErr("");
    try {
      const [t, c] = await Promise.all([loadTeam(), loadActiveClinics()]);
      setTeam(t); setClinics(c);
    } catch (e) { setErr("Couldn't load team. " + (e.message || "")); }
    finally { setLoading(false); }
    // Auth-user list needs the edge function; degrade gracefully without it.
    try { setAuthUsers(await adminListUsers()); } catch { setAuthUsers(null); }
  };
  useEffect(() => { reload(); }, []);

  const emailByStaffId = useMemo(() => {
    const m = {};
    (authUsers || []).forEach(u => { m[u.id] = u.email; });
    return m;
  }, [authUsers]);

  // Logins that exist in Supabase Auth but have no staff record yet —
  // exactly the state kmoulton's account was in (login works, sees nothing).
  const orphanLogins = useMemo(() => {
    if (!authUsers) return [];
    const staffIds = new Set(team.map(s => s.id));
    return authUsers.filter(u => !staffIds.has(u.id));
  }, [authUsers, team]);

  const startEdit = (s) => {
    setErr("");
    setDraft({
      mode: "edit",
      id: s.id,
      full_name: s.full_name || "",
      role: s.role || "provider",
      clinic_id: s.clinic_id,
      active: s.active !== false,
      clinicIds: (s.staff_clinics || []).map(sc => sc.clinic_id),
    });
  };

  const startAdd = (orphan = null) => {
    setErr("");
    setDraft({
      mode: orphan ? "orphan" : "create",
      id: orphan?.id || null,
      email: orphan?.email || "",
      password: "",
      full_name: "",
      role: "provider",
      clinic_id: activeClinicId || clinics[0]?.id || null,
      active: true,
      clinicIds: activeClinicId ? [activeClinicId] : [],
    });
  };

  const toggleClinic = (id) => setDraft(d => ({
    ...d,
    clinicIds: d.clinicIds.includes(id) ? d.clinicIds.filter(x => x !== id) : [...d.clinicIds, id],
  }));

  const saveDraft = async () => {
    if (!draft.full_name.trim()) { setErr("Name is required."); return; }
    if (!draft.clinicIds.length) { setErr("Assign at least one clinic."); return; }
    const homeId = draft.clinicIds.includes(draft.clinic_id) ? draft.clinic_id : draft.clinicIds[0];
    setBusy(true); setErr("");
    try {
      if (draft.mode === "edit") {
        await saveStaffMember(draft.id, {
          full_name: draft.full_name,
          role: draft.role,
          clinic_id: homeId,
          active: draft.active,
        });
        await setStaffClinics(draft.id, draft.clinicIds);
      } else {
        if (draft.mode === "create") {
          if (!draft.email.trim()) { setErr("Email is required."); setBusy(false); return; }
          if ((draft.password || "").length < 8) { setErr("Temp password must be at least 8 characters."); setBusy(false); return; }
        }
        await adminCreateUser({
          userId: draft.id, // set for orphan logins; null when minting a new login
          email: draft.email,
          password: draft.password || undefined,
          fullName: draft.full_name,
          role: draft.role,
          homeClinicId: homeId,
          clinicIds: draft.clinicIds,
        });
      }
      setDraft(null);
      showToast(draft.mode === "edit" ? "Saved" : "Account ready");
      await reload();
    } catch (e) { setErr("Save failed. " + (e.message || "")); }
    finally { setBusy(false); }
  };

  const doReset = async () => {
    if ((resetPw || "").length < 8) { setErr("Temp password must be at least 8 characters."); return; }
    setBusy(true); setErr("");
    try {
      await adminResetPassword(resetFor.id, resetPw);
      setResetFor(null); setResetPw("");
      showToast("Password reset");
    } catch (e) { setErr("Reset failed. " + (e.message || "")); }
    finally { setBusy(false); }
  };

  const clinicName = (id) => shortClinic(clinics.find(c => c.id === id)?.name) || "—";

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Team</div>
          <div className="topbar-sub">Logins, roles &amp; clinic assignments · {team.length} member{team.length === 1 ? "" : "s"}</div>
        </div>
        <button style={st.btnPrimary} onClick={() => startAdd()}>＋ Add User</button>
      </div>
      <div className="content">
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          {toast && <div style={{ ...st.card, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", fontWeight: 600, fontSize: 13 }}>{toast}</div>}
          {err && <div style={{ ...st.card, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 600, fontSize: 13 }}>{err}</div>}
          {loading ? (
            <div style={{ color: "#9ca3af", fontSize: 13, padding: 20 }}>Loading team…</div>
          ) : (
            <>
              {/* Logins with no staff record — they see an empty Distil */}
              {orphanLogins.length > 0 && (
                <div style={{ ...st.card, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>
                    {orphanLogins.length} login{orphanLogins.length === 1 ? "" : "s"} without a staff record
                  </div>
                  <div style={{ fontSize: 12, color: "#a16207", marginBottom: 10 }}>
                    These accounts can sign in but see no patients until they're given a role and clinic.
                  </div>
                  {orphanLogins.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{u.email}</span>
                      <button style={{ ...st.btnGhost, marginLeft: "auto", padding: "5px 12px", fontSize: 12 }} onClick={() => startAdd(u)}>
                        Set Up Access
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {team.map(s => (
                <div key={s.id} style={st.card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.active === false ? "#9ca3af" : "#111827" }}>
                        {s.full_name}{s.active === false ? " · inactive" : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {emailByStaffId[s.id] || ""}{emailByStaffId[s.id] ? " · " : ""}{ROLES.find(r => r[0] === s.role)?.[1] || s.role} · Home: {clinicName(s.clinic_id)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center", flexWrap: "wrap" }}>
                      {(s.staff_clinics || []).map(sc => (
                        <span key={sc.clinic_id} style={st.chip}>{shortClinic(sc.clinics?.name)}</span>
                      ))}
                      {authUsers && emailByStaffId[s.id] && (
                        <button style={{ ...st.btnGhost, padding: "5px 12px", fontSize: 12 }}
                          onClick={() => { setResetFor({ id: s.id, name: s.full_name }); setResetPw(""); setErr(""); }}>
                          Reset Password
                        </button>
                      )}
                      <button style={{ ...st.btnGhost, padding: "5px 12px", fontSize: 12 }} onClick={() => startEdit(s)}>Edit</button>
                    </div>
                  </div>
                </div>
              ))}

              {authUsers === null && (
                <div style={{ fontSize: 12, color: "#9ca3af", padding: "6px 2px" }}>
                  Login management (emails, add user, password resets) requires the admin-users
                  edge function — staff roles and clinic assignments still work without it.
                </div>
              )}
            </>
          )}

          {/* Edit / create panel */}
          {draft && (
            <div style={{ ...st.card, border: `2px solid ${NAVY}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                {draft.mode === "edit" ? `Edit ${draft.full_name || "member"}` : draft.mode === "orphan" ? `Set up ${draft.email}` : "Add User"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {draft.mode === "create" && (
                  <>
                    <div>
                      <label style={st.label}>Email</label>
                      <input style={st.input} value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} placeholder="name@myhearingcenters.com" />
                    </div>
                    <div>
                      <label style={st.label}>Temp Password</label>
                      <input style={st.input} value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} placeholder="They can change it later" />
                    </div>
                  </>
                )}
                <div>
                  <label style={st.label}>Full Name</label>
                  <input style={st.input} value={draft.full_name} onChange={e => setDraft({ ...draft, full_name: e.target.value })} />
                </div>
                <div>
                  <label style={st.label}>Role</label>
                  <select style={st.input} value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}>
                    {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={st.label}>Clinics (patients &amp; schedule access)</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {clinics.map(c => {
                      const on = draft.clinicIds.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => toggleClinic(c.id)} style={{
                          ...st.btnGhost, padding: "6px 12px", fontSize: 12,
                          background: on ? "#eef2ff" : "#fff",
                          border: on ? "1px solid #a5b4fc" : "1px solid #e5e7eb",
                          color: on ? "#4338ca" : "#6b7280", fontWeight: on ? 700 : 600,
                        }}>
                          {on ? "✓ " : ""}{shortClinic(c.name)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={st.label}>Home Clinic</label>
                  <select style={st.input} value={draft.clinic_id || ""} onChange={e => setDraft({ ...draft, clinic_id: e.target.value })}>
                    {draft.clinicIds.map(id => <option key={id} value={id}>{clinicName(id)}</option>)}
                  </select>
                </div>
                {draft.mode === "edit" && (
                  <div>
                    <label style={st.label}>Status</label>
                    <button style={{ ...st.btnGhost, width: "100%", color: draft.active ? "#047857" : "#dc2626" }}
                      onClick={() => setDraft({ ...draft, active: !draft.active })}>
                      {draft.active ? "Active — click to deactivate" : "Inactive — click to reactivate"}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button style={st.btnPrimary} onClick={saveDraft} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                <button style={st.btnGhost} onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
              </div>
            </div>
          )}

          {/* Password reset panel */}
          {resetFor && (
            <div style={{ ...st.card, border: `2px solid ${NAVY}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Reset password — {resetFor.name}</div>
              <label style={st.label}>New Temp Password</label>
              <input style={st.input} value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="At least 8 characters" />
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button style={st.btnPrimary} onClick={doReset} disabled={busy}>{busy ? "Resetting…" : "Reset"}</button>
                <button style={st.btnGhost} onClick={() => setResetFor(null)} disabled={busy}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
