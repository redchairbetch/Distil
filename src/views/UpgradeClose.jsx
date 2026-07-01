import React from "react";
import CareJourney from "./CareJourney.jsx";

// Consultation close for the established-patient upgrade flow (PR4). Branches on
// the PR3b reprogram-vs-upgrade decision (provider can override the path) and
// records the outcome. Self-contained on purpose — it does NOT embed the
// new-patient TierSelection (which is empty for regular-insurance patients and
// runs the new-patient recommendation engine on mount); the actual device order
// + purchase agreement still route through the existing device flow if the
// patient proceeds. Controlled via a single `value`/`onChange` close object.

// TH tier value props — clinic-stable copy, kept in sync with TH_TIER_BLURBS in
// Distil.jsx (replicated to keep the close free of new-patient-flow imports).
const UPGRADE_TIERS = [
  { label: "Standard", blurb: "Clear, automatic hearing for quieter, one-on-one settings — home, small groups, TV." },
  { label: "Advanced", blurb: "Adds active noise management and directional focus — restaurants, gatherings, and conversations over background noise become easier to follow." },
  { label: "Premium",  blurb: "The most sophisticated processing offered — effortless clarity in the hardest environments, with richer spatial awareness, steadier streaming, and the lowest listening effort across a full day." },
];

const UPGRADE_OUTCOMES = [
  { key: "upgraded", label: "Upgrading now",    color: "#059669" },
  { key: "pending",  label: "Thinking it over", color: "#b45309" },
  { key: "declined", label: "Declined",         color: "#6b7280" },
];

const DISPOSITIONS = [
  { key: "keep",   label: "Keep as backup" },
  { key: "donate", label: "Donate" },
  { key: "trade",  label: "Trade-in" },
];

function decisionWord(decision) {
  if (!decision) return null;
  if (decision.decision === "upgrade")   return "upgrade";
  if (decision.decision === "reprogram") return "reprogram";
  return "provider judgment";
}

export default function UpgradeClose({
  value, onChange, defaultPath,
  patient, tierPrices = null, decision,
  journeyPosition = 0, warrantyYears = 4, currentAbility = null,
}) {
  const path = value.path || defaultPath || "upgrade";
  const set = (patch) => onChange({ ...value, ...patch });

  // Per-tier reference pricing (resolved by the wizard from the plan copays or
  // clinic retail anchors), so the header tracks the selected tier. Falls back
  // to the patient's stored tier price when the map hasn't loaded. Final
  // per-tier upgrade pricing is confirmed in device selection.
  const payLabel = patient?.payType === "private" ? "Private pay" : "Plan copay";
  const storedPrice = patient?.payType === "private"
    ? patient?.privatePay?.tierPrice
    : patient?.insurance?.tierPrice;
  const priceForTier = (label) => {
    const p = tierPrices?.[label];
    return p != null ? p : null;
  };
  const fmtPrice = (n) => `$${Math.round(n).toLocaleString()}/aid`;
  const selectedPrice = value.tierOffered ? priceForTier(value.tierOffered) : null;
  const headerPrice = selectedPrice != null ? selectedPrice
    : (storedPrice != null ? storedPrice : null);
  const costRef = headerPrice != null ? `${payLabel}: ${fmtPrice(headerPrice)}` : null;

  const firstName = patient?.name?.split(" ")[0] || "the patient";
  const decWord = decisionWord(decision);

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ margin: "0 0 4px", fontFamily: "'Sora',sans-serif", fontSize: 20 }}>Close the visit</h2>
      <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>
        {decWord ? <>Recommendation was <strong>{decWord}</strong>. </> : null}
        Confirm the path and record what {firstName} decided.
      </p>

      {/* Path toggle (defaults to the recommendation; provider has final say) */}
      <div style={{ display: "inline-flex", border: "1px solid #d1d5db", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        {[["upgrade", "⬆ Upgrade"], ["reprogram", "🔧 Reprogram"]].map(([k, label]) => (
          <button key={k} onClick={() => set({ path: k })} style={{
            padding: "9px 18px", fontSize: 14, fontWeight: path === k ? 700 : 500, cursor: "pointer", border: "none",
            background: path === k ? (k === "upgrade" ? "#0f766e" : "#4338ca") : "white",
            color: path === k ? "white" : "#374151", fontFamily: "'Sora',sans-serif",
          }}>{label}</button>
        ))}
      </div>

      {path === "upgrade" ? (
        <>
          {/* Tiers offered */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            Technology offered {costRef && <span style={{ fontWeight: 400, color: "#9ca3af" }}>· {costRef}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 6 }}>
            {UPGRADE_TIERS.map((t) => {
              const active = value.tierOffered === t.label;
              const tierPrice = priceForTier(t.label);
              return (
                <button key={t.label} onClick={() => set({ tierOffered: active ? "" : t.label })} style={{
                  textAlign: "left", padding: 14, borderRadius: 12, cursor: "pointer",
                  border: active ? "2px solid #0f766e" : "1px solid #e5e7eb",
                  background: active ? "#f0fdfa" : "white",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: "#111827" }}>{t.label}</span>
                    {tierPrice != null ? (
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: active ? "#0f766e" : "#374151", whiteSpace: "nowrap" }}>{fmtPrice(tierPrice)}</span>
                    ) : (tierPrices && patient?.payType !== "private") ? (
                      <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>Not on plan</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{t.blurb}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>
            Final upgrade pricing is confirmed in device selection.
          </div>

          {/* Old-aid disposition */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Old aids</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DISPOSITIONS.map((d) => {
                const active = value.disposition === d.key;
                return (
                  <button key={d.key}
                    onClick={() => set({ disposition: active ? "" : d.key, ...(d.key !== "donate" ? { donationRecipient: "" } : {}) })}
                    style={{
                      padding: "8px 14px", borderRadius: 999, fontSize: 13, cursor: "pointer",
                      border: active ? "2px solid #0f766e" : "1px solid #e5e7eb",
                      background: active ? "#f0fdfa" : "white", color: active ? "#0f766e" : "#374151", fontWeight: active ? 600 : 400,
                    }}>{d.label}</button>
                );
              })}
            </div>
            {value.disposition === "donate" && (
              <input type="text" value={value.donationRecipient || ""} onChange={(e) => set({ donationRecipient: e.target.value })}
                placeholder="Donation recipient (name or organization)"
                style={{ marginTop: 10, width: "100%", maxWidth: 360, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
            )}
          </div>

          {/* Outcome */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Outcome</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {UPGRADE_OUTCOMES.map((o) => {
                const active = value.outcome === o.key;
                return (
                  <button key={o.key} onClick={() => set({ outcome: o.key })} style={{
                    padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: active ? 700 : 500,
                    border: active ? `2px solid ${o.color}` : "1px solid #e5e7eb",
                    background: active ? o.color : "white", color: active ? "white" : "#374151",
                  }}>{o.label}</button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Reprogram — lighter close, journey reinforces the retention case */}
          <CareJourney position={journeyPosition} warrantyYears={warrantyYears} currentAbility={currentAbility} />
          <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: 16, fontSize: 13, color: "#4338ca", marginBottom: 20, lineHeight: 1.6 }}>
            Reprogramming {firstName}'s current devices to today's audiogram. Regular care keeps hearing at its best — the journey above shows where {firstName} sits now and how consistent follow-up holds the line.
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Follow-up date <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            <input type="date" value={value.followUpDate || ""} onChange={(e) => set({ followUpDate: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, fontFamily: "inherit" }} />
          </div>
        </>
      )}

      {/* Notes — both paths */}
      <div style={{ marginTop: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Notes <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
        </label>
        <textarea value={value.notes || ""} onChange={(e) => set({ notes: e.target.value })} rows={3}
          placeholder={path === "upgrade" ? "What was discussed, objections, next steps…" : "Adjustments made, what to watch for…"}
          style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", fontFamily: "inherit", fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
      </div>
    </div>
  );
}
