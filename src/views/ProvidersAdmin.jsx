import React, { useEffect, useMemo, useState } from "react";
import {
  loadProvidersAdmin,
  saveDispensingProvider,
  deleteDispensingProvider,
  setProviderClinics,
  saveClinicAdmin,
} from "../db.js";

// Admin-only "Providers & Locations" manager (closer-role initiative, PR B).
// Lets an admin fill in the dispensing providers seeded without a license,
// assign providers to the clinics they serve, and add/edit clinic locations.
// The closer's purchase-agreement picker reads this data via get_clinic_providers().

const NAVY = "#0a1628";
const st = {
  input: { width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none", boxSizing: "border-box" },
  label: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9ca3af", letterSpacing: 1, display: "block", marginBottom: 4 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 10 },
  btnPrimary: { background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btnGhost: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#6b7280" },
  btnDanger: { background: "#fff", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#dc2626" },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "#eef2ff", color: "#4338ca", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
};

export default function ProvidersAdmin() {
  const [data, setData] = useState(null); // { providers, clinics, links }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("providers");
  const [search, setSearch] = useState("");
  const [needLicenseOnly, setNeedLicenseOnly] = useState(false);
  const [pDraft, setPDraft] = useState(null); // provider being edited/added
  const [cDraft, setCDraft] = useState(null); // clinic being edited/added
  const [clinicQuery, setClinicQuery] = useState(""); // assignment search inside provider edit
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const reload = async () => {
    setLoading(true); setErr("");
    try { setData(await loadProvidersAdmin()); }
    catch (e) { setErr("Couldn't load providers. " + (e.message || "")); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const clinicsById = useMemo(
    () => Object.fromEntries((data?.clinics || []).map(c => [c.id, c])),
    [data]
  );
  const clinicIdsByProvider = useMemo(() => {
    const m = {};
    (data?.links || []).forEach(l => { (m[l.provider_id] ||= []).push(l.clinic_id); });
    return m;
  }, [data]);
  const providerCountByClinic = useMemo(() => {
    const m = {};
    (data?.links || []).forEach(l => { m[l.clinic_id] = (m[l.clinic_id] || 0) + 1; });
    return m;
  }, [data]);
  const orgId = data?.clinics?.[0]?.organization_id;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ── provider editing ──────────────────────────────────────────────────────
  const startEditProvider = (p) => {
    setCDraft(null); setClinicQuery(""); setErr("");
    setPDraft({
      id: p.id, full_name: p.full_name, credentials: p.credentials || "", npi: p.npi || "",
      active: p.active, staff_id: p.staff_id,
      licenseRows: Object.entries(p.licenses || {}).map(([state, num]) => ({ state, num })),
      clinicIds: [...(clinicIdsByProvider[p.id] || [])],
    });
  };
  const startAddProvider = () => {
    setCDraft(null); setClinicQuery(""); setErr("");
    setPDraft({ id: null, full_name: "", credentials: "", npi: "", active: true, staff_id: null, licenseRows: [], clinicIds: [] });
  };
  const saveProvider = async () => {
    if (!pDraft.full_name.trim()) { setErr("Provider name is required."); return; }
    setBusy(true); setErr("");
    try {
      const licenses = {};
      pDraft.licenseRows.forEach(r => {
        const stt = (r.state || "").trim().toUpperCase();
        const num = (r.num || "").trim();
        if (stt && num) licenses[stt] = num;
      });
      const id = await saveDispensingProvider({
        id: pDraft.id, full_name: pDraft.full_name, credentials: pDraft.credentials,
        npi: pDraft.npi, active: pDraft.active, licenses,
      });
      await setProviderClinics(id, pDraft.clinicIds);
      setPDraft(null); showToast("Provider saved"); await reload();
    } catch (e) { setErr("Save failed. " + (e.message || "")); }
    finally { setBusy(false); }
  };
  const removeProvider = async () => {
    if (pDraft.staff_id) { setErr("This provider is tied to a login account — deactivate instead of deleting."); return; }
    if (!window.confirm(`Delete ${pDraft.full_name}? This also removes their clinic assignments.`)) return;
    setBusy(true); setErr("");
    try { await deleteDispensingProvider(pDraft.id); setPDraft(null); showToast("Provider deleted"); await reload(); }
    catch (e) { setErr("Delete failed. " + (e.message || "")); }
    finally { setBusy(false); }
  };

  // ── clinic editing ────────────────────────────────────────────────────────
  const startEditClinic = (c) => {
    setPDraft(null); setErr("");
    setCDraft({ id: c.id, name: c.name, clinic_code: c.clinic_code || "", address: c.address || "", phone: c.phone || "", active: c.active });
  };
  const startAddClinic = () => {
    setPDraft(null); setErr("");
    setCDraft({ id: null, name: "", clinic_code: "", address: "", phone: "", active: true });
  };
  const saveClinic = async () => {
    if (!cDraft.name.trim()) { setErr("Location name is required."); return; }
    setBusy(true); setErr("");
    try {
      await saveClinicAdmin({ ...cDraft, organization_id: orgId });
      setCDraft(null); showToast("Location saved"); await reload();
    } catch (e) { setErr("Save failed. " + (e.message || "")); }
    finally { setBusy(false); }
  };

  // ── filtered lists ────────────────────────────────────────────────────────
  const providers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.providers || []).filter(p => {
      if (needLicenseOnly && Object.keys(p.licenses || {}).length > 0) return false;
      if (q && !p.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, needLicenseOnly]);

  const clinics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.clinics || []).filter(c =>
      !q || c.name.toLowerCase().includes(q) || (c.clinic_code || "").includes(q) || (c.address || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const needLicenseCount = (data?.providers || []).filter(p => Object.keys(p.licenses || {}).length === 0).length;

  // assignment picker candidates (unassigned clinics matching the query)
  const assignCandidates = useMemo(() => {
    if (!pDraft) return [];
    const q = clinicQuery.trim().toLowerCase();
    if (!q) return [];
    const assigned = new Set(pDraft.clinicIds);
    return (data?.clinics || [])
      .filter(c => !assigned.has(c.id) && (c.name.toLowerCase().includes(q) || (c.clinic_code || "").includes(q)))
      .slice(0, 8);
  }, [pDraft, clinicQuery, data]);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Providers &amp; Locations</div>
          <div className="topbar-sub">
            {data ? `${data.providers.length} providers · ${data.clinics.length} locations` : "Loading…"}
            {needLicenseCount > 0 && <span style={{ color: "#b45309", fontWeight: 600 }}> · {needLicenseCount} need a license</span>}
          </div>
        </div>
      </div>

      <div className="content">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[["providers", "Providers"], ["locations", "Locations"]].map(([id, lbl]) => (
              <div key={id} onClick={() => { setTab(id); setSearch(""); setPDraft(null); setCDraft(null); }}
                style={{ padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: tab === id ? NAVY : "#fff", color: tab === id ? "#fff" : "#6b7280",
                  border: tab === id ? `1px solid ${NAVY}` : "1px solid #e5e7eb" }}>
                {lbl}
              </div>
            ))}
          </div>

          {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}
          {loading && <div style={{ color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>Loading…</div>}

          {/* ── PROVIDERS TAB ─────────────────────────────────────────────── */}
          {!loading && tab === "providers" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ ...st.input, maxWidth: 280 }} placeholder="Search providers…" value={search} onChange={e => setSearch(e.target.value)} />
                <div onClick={() => setNeedLicenseOnly(v => !v)}
                  style={{ padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: needLicenseOnly ? "#fffbeb" : "#fff", color: needLicenseOnly ? "#b45309" : "#6b7280",
                    border: needLicenseOnly ? "1px solid #fcd34d" : "1px solid #e5e7eb" }}>
                  ⚠ Needs license {needLicenseOnly ? "✓" : ""}
                </div>
                <button style={{ ...st.btnPrimary, marginLeft: "auto" }} onClick={startAddProvider}>＋ Add Provider</button>
              </div>

              {pDraft && pDraft.id === null && renderProviderForm()}

              {providers.length === 0 && <div style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>No providers match.</div>}

              {providers.map(p => {
                const states = Object.keys(p.licenses || {});
                const editing = pDraft && pDraft.id === p.id;
                const clinicCount = (clinicIdsByProvider[p.id] || []).length;
                return (
                  <div key={p.id} style={{ ...st.card, ...(editing ? { border: `2px solid ${NAVY}` } : {}) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {p.full_name}
                          {p.credentials && <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{p.credentials}</span>}
                          {p.staff_id && <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "1px 6px" }}>LOGIN</span>}
                          {!p.active && <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, background: "#f3f4f6", borderRadius: 6, padding: "1px 6px" }}>INACTIVE</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                          {states.length
                            ? states.map(s2 => `${s2} ${p.licenses[s2]}`).join("  ·  ")
                            : <span style={{ color: "#b45309", fontWeight: 600 }}>⚠ No license on file</span>}
                          {"  ·  "}{clinicCount} clinic{clinicCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <button style={st.btnGhost} onClick={() => (editing ? setPDraft(null) : startEditProvider(p))}>{editing ? "Cancel" : "Edit"}</button>
                    </div>
                    {editing && renderProviderForm()}
                  </div>
                );
              })}
            </>
          )}

          {/* ── LOCATIONS TAB ─────────────────────────────────────────────── */}
          {!loading && tab === "locations" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
                <input style={{ ...st.input, maxWidth: 320 }} placeholder="Search by name, code, or address…" value={search} onChange={e => setSearch(e.target.value)} />
                <button style={{ ...st.btnPrimary, marginLeft: "auto" }} onClick={startAddClinic}>＋ Add Location</button>
              </div>

              {cDraft && cDraft.id === null && renderClinicForm()}

              {clinics.length === 0 && <div style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>No locations match.</div>}

              {clinics.map(c => {
                const editing = cDraft && cDraft.id === c.id;
                const pc = providerCountByClinic[c.id] || 0;
                return (
                  <div key={c.id} style={{ ...st.card, ...(editing ? { border: `2px solid ${NAVY}` } : {}) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {c.name}
                          {c.clinic_code && <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>#{c.clinic_code}</span>}
                          {!c.active && <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, background: "#f3f4f6", borderRadius: 6, padding: "1px 6px" }}>INACTIVE</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{c.address || "No address"}{"  ·  "}{pc} provider{pc === 1 ? "" : "s"}</div>
                      </div>
                      <button style={st.btnGhost} onClick={() => (editing ? setCDraft(null) : startEditClinic(c))}>{editing ? "Cancel" : "Edit"}</button>
                    </div>
                    {editing && renderClinicForm()}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, background: NAVY, color: "#4ade80", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "'Sora',sans-serif", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}>
          ✓ {toast}
        </div>
      )}
    </>
  );

  // ── forms (closures over draft state) ──────────────────────────────────────
  function renderProviderForm() {
    const d = pDraft;
    const set = (patch) => setPDraft(prev => ({ ...prev, ...patch }));
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div><label style={st.label}>Full Name</label>
            <input style={st.input} value={d.full_name} onChange={e => set({ full_name: e.target.value })} placeholder="First Last" />
          </div>
          <div><label style={st.label}>Credentials</label>
            <input style={st.input} value={d.credentials} onChange={e => set({ credentials: e.target.value })} placeholder="e.g. AuD, HIS" />
          </div>
          <div><label style={st.label}>NPI #</label>
            <input style={st.input} value={d.npi} onChange={e => set({ npi: e.target.value })} placeholder="10-digit NPI" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
              <input type="checkbox" checked={d.active} onChange={e => set({ active: e.target.checked })} /> Active
            </label>
          </div>
        </div>

        {/* Licenses */}
        <div style={{ marginBottom: 12 }}>
          <label style={st.label}>Licenses <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(state + number — the state-matched one prints on the purchase agreement)</span></label>
          {d.licenseRows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
              <input style={{ ...st.input, width: 70, textTransform: "uppercase" }} maxLength={2} value={r.state}
                onChange={e => set({ licenseRows: d.licenseRows.map((x, j) => j === i ? { ...x, state: e.target.value } : x) })} placeholder="UT" />
              <input style={st.input} value={r.num}
                onChange={e => set({ licenseRows: d.licenseRows.map((x, j) => j === i ? { ...x, num: e.target.value } : x) })} placeholder="License number" />
              <button style={st.btnGhost} onClick={() => set({ licenseRows: d.licenseRows.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button style={st.btnGhost} onClick={() => set({ licenseRows: [...d.licenseRows, { state: "", num: "" }] })}>＋ Add license</button>
        </div>

        {/* Clinic assignment */}
        <div style={{ marginBottom: 12 }}>
          <label style={st.label}>Clinics Served</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {d.clinicIds.length === 0 && <span style={{ fontSize: 12, color: "#9ca3af" }}>Not assigned to any clinic yet.</span>}
            {d.clinicIds.map(cid => (
              <span key={cid} style={st.chip}>
                {clinicsById[cid]?.name?.replace("My Hearing Centers – ", "") || "Unknown"}
                <span style={{ cursor: "pointer", fontWeight: 800 }} onClick={() => set({ clinicIds: d.clinicIds.filter(x => x !== cid) })}>×</span>
              </span>
            ))}
          </div>
          <input style={{ ...st.input, maxWidth: 360 }} placeholder="Search a clinic to add…" value={clinicQuery} onChange={e => setClinicQuery(e.target.value)} />
          {assignCandidates.length > 0 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginTop: 4, maxWidth: 360, overflow: "hidden" }}>
              {assignCandidates.map(c => (
                <div key={c.id} onClick={() => { set({ clinicIds: [...d.clinicIds, c.id] }); setClinicQuery(""); }}
                  style={{ padding: "8px 10px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}>
                  {c.name.replace("My Hearing Centers – ", "")} {c.clinic_code && <span style={{ color: "#9ca3af" }}>#{c.clinic_code}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ ...st.btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={saveProvider}>{busy ? "Saving…" : "Save Provider"}</button>
          <button style={st.btnGhost} onClick={() => setPDraft(null)}>Cancel</button>
          {d.id && !d.staff_id && <button style={{ ...st.btnDanger, marginLeft: "auto" }} disabled={busy} onClick={removeProvider}>Delete</button>}
        </div>
      </div>
    );
  }

  function renderClinicForm() {
    const d = cDraft;
    const set = (patch) => setCDraft(prev => ({ ...prev, ...patch }));
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 12 }}>
          <div><label style={st.label}>Location Name</label>
            <input style={st.input} value={d.name} onChange={e => set({ name: e.target.value })} placeholder="My Hearing Centers – City" />
          </div>
          <div><label style={st.label}>Clinic Code</label>
            <input style={st.input} value={d.clinic_code} onChange={e => set({ clinic_code: e.target.value })} placeholder="e.g. 5509" />
          </div>
          <div style={{ gridColumn: "1/-1" }}><label style={st.label}>Address</label>
            <input style={st.input} value={d.address} onChange={e => set({ address: e.target.value })} placeholder="Street, City, ST ZIP" />
          </div>
          <div><label style={st.label}>Phone</label>
            <input style={st.input} value={d.phone} onChange={e => set({ phone: e.target.value })} placeholder="(555) 555-5555" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
              <input type="checkbox" checked={d.active} onChange={e => set({ active: e.target.checked })} /> Active
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...st.btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={saveClinic}>{busy ? "Saving…" : "Save Location"}</button>
          <button style={st.btnGhost} onClick={() => setCDraft(null)}>Cancel</button>
        </div>
      </div>
    );
  }
}
