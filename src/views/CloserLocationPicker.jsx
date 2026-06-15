import React, { useEffect, useMemo, useState } from "react";
import { loadActiveClinics, getClinicProviders } from "../db.js";

// Closer-role PR C: the dispensing-location picker. An event specialist picks
// the clinic they're working that day, then the local provider it dispenses
// under. That provider's name + state-matched license (+ signature if on file)
// is what prints on the purchase agreement — not the closer's own login.

const NAVY = "#0a1628";

export default function CloserLocationPicker({ onClose, onSelect }) {
  const [clinics, setClinics] = useState([]);
  const [q, setQ] = useState("");
  const [clinic, setClinic] = useState(null);
  const [providers, setProviders] = useState(null); // null = not loaded
  const [loadingP, setLoadingP] = useState(false);

  useEffect(() => { loadActiveClinics().then(setClinics); }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return clinics
      .filter(c => c.name.toLowerCase().includes(s) || (c.clinic_code || "").includes(s) || (c.address || "").toLowerCase().includes(s))
      .slice(0, 12);
  }, [q, clinics]);

  const chooseClinic = async (c) => {
    setClinic(c); setProviders(null); setLoadingP(true);
    try { setProviders(await getClinicProviders(c.id)); }
    finally { setLoadingP(false); }
  };

  const shortName = (n) => (n || "").replace("My Hearing Centers – ", "");
  const licSummary = (lic) => {
    const states = Object.keys(lic || {});
    return states.length ? states.map(s => `${s} ${lic[s]}`).join(" · ") : null;
  };

  const overlay = { position: "fixed", inset: 0, background: "rgba(10,22,40,0.55)", zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 16px" };
  const card = { background: "#fff", width: "100%", maxWidth: 460, borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.35)", overflow: "hidden", fontFamily: "'Sora',sans-serif" };
  const input = { width: "100%", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14, fontFamily: "'Sora',sans-serif", outline: "none", boxSizing: "border-box" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: NAVY }}>Dispensing Location</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {clinic ? "Who is this dispensed under?" : "Where are you working today?"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, maxHeight: "60vh", overflowY: "auto" }}>
          {!clinic && (
            <>
              <input autoFocus style={input} placeholder="Search clinic by name, code, or address…" value={q} onChange={e => setQ(e.target.value)} />
              <div style={{ marginTop: 10 }}>
                {q.trim() && matches.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 2px" }}>No clinics match.</div>}
                {matches.map(c => (
                  <div key={c.id} onClick={() => chooseClinic(c)}
                    style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: "1px solid #f3f4f6", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{shortName(c.name)} {c.clinic_code && <span style={{ color: "#9ca3af", fontWeight: 400 }}>#{c.clinic_code}</span>}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{c.address}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {clinic && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{shortName(clinic.name)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{clinic.address}</div>
                </div>
                <button onClick={() => { setClinic(null); setProviders(null); }} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>Change</button>
              </div>

              {loadingP && <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>Loading providers…</div>}
              {providers && providers.length === 0 && (
                <div style={{ fontSize: 13, color: "#b45309", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 12px" }}>
                  No provider is assigned to this location yet. Add one in Admin → Providers first.
                </div>
              )}
              {(providers || []).map(p => {
                const lic = licSummary(p.licenses);
                return (
                  <div key={p.provider_id} onClick={() => onSelect(clinic, p)}
                    style={{ padding: "12px", borderRadius: 10, cursor: "pointer", border: "1px solid #e5e7eb", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, display: "flex", alignItems: "center", gap: 8 }}>
                      {p.full_name}
                      {p.credentials && <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{p.credentials}</span>}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3, color: lic ? "#16a34a" : "#b45309", fontWeight: 600 }}>
                      {lic || "⚠ No license on file — PA will print a blank license line"}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
