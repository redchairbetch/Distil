import { useState, useEffect } from "react";
import {
  loadDonationCandidates,
  loadRecipients,
  saveRecipient,
  updateDonationIntent,
  matchDonation,
} from "../db.js";

const INTENT_COLORS = {
  none:       { bg: "#f3f4f6", color: "#6b7280", label: "Not Contacted" },
  interested: { bg: "#dbeafe", color: "#1d4ed8", label: "Interested" },
  committed:  { bg: "#fef3c7", color: "#92400e", label: "Committed" },
  donated:    { bg: "#dcfce7", color: "#16a34a", label: "Donated" },
  matched:    { bg: "#e0e7ff", color: "#4338ca", label: "Matched" },
};

const BRANCHES = ["Army", "Navy", "Air Force", "Marines", "Coast Guard", "Space Force", "National Guard"];

export default function LimaCharlie({ clinicId, staffId }) {
  const [candidates, setCandidates] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [tab, setTab] = useState("pipeline"); // "pipeline" | "veterans" | "eligible"
  const [addingVet, setAddingVet] = useState(false);
  const [vetDraft, setVetDraft] = useState({ first_name: "", last_name: "", branch: "", notes: "" });
  const [matchModal, setMatchModal] = useState(null); // { donationId, recipientId }

  useEffect(() => {
    loadDonationCandidates().then(setCandidates);
    loadRecipients().then(setRecipients);
  }, []);

  const refresh = async () => {
    setCandidates(await loadDonationCandidates());
    setRecipients(await loadRecipients());
  };

  const handleIntentChange = async (patient, newStatus) => {
    await updateDonationIntent(patient.id, patient.fittingId, newStatus);
    await refresh();
  };

  const handleAddVeteran = async () => {
    if (!vetDraft.first_name || !vetDraft.last_name) return;
    await saveRecipient(vetDraft);
    setVetDraft({ first_name: "", last_name: "", branch: "", notes: "" });
    setAddingVet(false);
    await refresh();
  };

  const handleMatch = async () => {
    if (!matchModal) return;
    await matchDonation(matchModal.donationId, matchModal.recipientId);
    setMatchModal(null);
    await refresh();
  };

  // Stats
  const eligible = candidates.filter(c => c.daysLeft > 0 && c.daysLeft <= 365);
  const byIntent = {
    interested: candidates.filter(c => c.intentStatus === "interested"),
    committed:  candidates.filter(c => c.intentStatus === "committed"),
    donated:    candidates.filter(c => c.intentStatus === "donated"),
    matched:    candidates.filter(c => c.intentStatus === "matched"),
  };
  const waitingVets = recipients.filter(r => r.status === "waiting");

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Lima Charlie</div>
          <div className="topbar-sub">Donate & Upgrade — Veterans Hearing Program</div>
        </div>
      </div>
      <div className="content">
        {/* Stats row */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 24 }}>
          {[
            { icon: "🎯", val: eligible.length, label: "Eligible" },
            { icon: "💙", val: byIntent.interested.length, label: "Interested" },
            { icon: "🤝", val: byIntent.committed.length, label: "Committed" },
            { icon: "🎁", val: byIntent.donated.length + byIntent.matched.length, label: "Donated" },
            { icon: "🎖️", val: waitingVets.length, label: "Veterans Waiting" },
          ].map((s, i) => (
            <div key={i} className={`stat-card${i === 4 ? " highlight" : ""}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {[["pipeline", "Donation Pipeline"], ["eligible", "Eligible Patients"], ["veterans", "Veteran Queue"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: "1px solid", cursor: "pointer", fontFamily: "'Sora',sans-serif",
              background: tab === id ? "#0a1628" : "white",
              color: tab === id ? "white" : "#6b7280",
              borderColor: tab === id ? "#0a1628" : "#e5e7eb",
            }}>{label}</button>
          ))}
        </div>

        {/* Pipeline tab — kanban columns */}
        {tab === "pipeline" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {["interested", "committed", "donated", "matched"].map(status => {
              const items = candidates.filter(c => c.intentStatus === status);
              const style = INTENT_COLORS[status];
              return (
                <div key={status}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: style.color, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: style.bg, padding: "2px 10px", borderRadius: 12 }}>{style.label}</span>
                    <span style={{ color: "#9ca3af", fontWeight: 400 }}>({items.length})</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items.length === 0 ? (
                      <div style={{ background: "#f9fafb", border: "1px dashed #e5e7eb", borderRadius: 10, padding: 20, textAlign: "center", color: "#d1d5db", fontSize: 12 }}>
                        No patients
                      </div>
                    ) : (
                      items.map(p => (
                        <div key={p.id} className="card" style={{ padding: 14, marginBottom: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#0a1628" }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                            {p.daysLeft > 0 ? `${p.daysLeft}d left on warranty` : "Warranty expired"}
                          </div>
                          {status === "donated" && (
                            <button onClick={() => {
                              if (waitingVets.length > 0) {
                                setMatchModal({ donationId: p.donationId, recipientId: waitingVets[0].id });
                              }
                            }} style={{
                              marginTop: 8, background: "#e0e7ff", color: "#4338ca", border: "none",
                              borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                            }}>
                              Match to Veteran
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Eligible patients tab */}
        {tab === "eligible" && (
          <div className="table-card">
            <div className="table-header">
              <div className="table-title">Patients Eligible for Donation (Warranty expiring within 1 year)</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Fitting Date</th>
                  <th>Warranty Expiry</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {eligible.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No eligible patients at this time</td></tr>
                ) : (
                  eligible.map(p => {
                    const intent = INTENT_COLORS[p.intentStatus];
                    return (
                      <tr key={p.id}>
                        <td><span className="patient-name">{p.name}</span></td>
                        <td style={{ fontSize: 12 }}>{p.fittingDate}</td>
                        <td style={{ fontSize: 12 }}>{p.warrantyExpiry}</td>
                        <td>
                          <span style={{
                            color: p.daysLeft < 90 ? "#ef4444" : p.daysLeft < 180 ? "#f59e0b" : "#16a34a",
                            fontWeight: 600, fontSize: 13,
                          }}>{p.daysLeft}d</span>
                        </td>
                        <td>
                          <span style={{ background: intent.bg, color: intent.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                            {intent.label}
                          </span>
                        </td>
                        <td>
                          <select value={p.intentStatus}
                            onChange={e => handleIntentChange(p, e.target.value)}
                            style={{ padding: "4px 8px", fontSize: 12, borderRadius: 6 }}>
                            {Object.entries(INTENT_COLORS).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Veterans queue tab */}
        {tab === "veterans" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0a1628" }}>Veteran Recipients</div>
              <button className="btn-primary" onClick={() => setAddingVet(true)} style={{ fontSize: 12, padding: "6px 14px" }}>+ Add Veteran</button>
            </div>

            {addingVet && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="field-grid">
                  <div className="field">
                    <label>First Name</label>
                    <input value={vetDraft.first_name} onChange={e => setVetDraft({ ...vetDraft, first_name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Last Name</label>
                    <input value={vetDraft.last_name} onChange={e => setVetDraft({ ...vetDraft, last_name: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Branch</label>
                    <select value={vetDraft.branch} onChange={e => setVetDraft({ ...vetDraft, branch: e.target.value })}>
                      <option value="">— Select —</option>
                      {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Notes</label>
                    <input value={vetDraft.notes} onChange={e => setVetDraft({ ...vetDraft, notes: e.target.value })} placeholder="Optional..." />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => setAddingVet(false)}>Cancel</button>
                  <button className="btn-primary green" onClick={handleAddVeteran} disabled={!vetDraft.first_name || !vetDraft.last_name}>Add</button>
                </div>
              </div>
            )}

            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>No veterans in queue</td></tr>
                  ) : (
                    recipients.map(r => (
                      <tr key={r.id}>
                        <td><span className="patient-name">{r.first_name} {r.last_name}</span></td>
                        <td>{r.branch || "—"}</td>
                        <td>
                          <span style={{
                            padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: r.status === "waiting" ? "#fef3c7" : r.status === "matched" ? "#dbeafe" : "#dcfce7",
                            color: r.status === "waiting" ? "#92400e" : r.status === "matched" ? "#1d4ed8" : "#16a34a",
                          }}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "#9ca3af" }}>{r.notes || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Match modal */}
        {matchModal && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
          }} onClick={() => setMatchModal(null)}>
            <div style={{ background: "white", borderRadius: 14, padding: 28, width: 400 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Match Donation to Veteran</div>
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Select Veteran</label>
                <select value={matchModal.recipientId} onChange={e => setMatchModal({ ...matchModal, recipientId: e.target.value })}>
                  {waitingVets.map(v => <option key={v.id} value={v.id}>{v.first_name} {v.last_name} ({v.branch || "—"})</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn-ghost" onClick={() => setMatchModal(null)}>Cancel</button>
                <button className="btn-primary green" onClick={handleMatch}>Confirm Match</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
