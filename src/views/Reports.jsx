import React, { useEffect, useMemo, useState } from "react";
import { loadAppointmentOutcomes, loadFittingTypesForVisits, loadPriceAdjustmentHistory } from "../db.js";
import { computeReportStats, computeAdjustmentStats } from "../lib/reportStats.js";

// Reports v1 (sprint PR 4). Reads what the app already records — every metric
// here derives from appointment_outcomes payer SNAPSHOTS (never the live
// patient record), so a later insurance change can't rewrite July's numbers.
// Headline: TPA care-plan attach rate + device close rate / revenue lift.

const RANGES = [
  { key: "month",   label: "This month" },
  { key: "30d",     label: "Last 30 days" },
  { key: "quarter", label: "This quarter" },
  { key: "ytd",     label: "Year to date" },
  { key: "all",     label: "All time" },
];

function rangeToFrom(key) {
  const now = new Date();
  if (key === "month")   return new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === "30d")     return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  if (key === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (key === "ytd")     return new Date(now.getFullYear(), 0, 1);
  return null; // all time
}

const DISPOSITION_LABELS = {
  committed: "Committed", deferred: "Deferred", declined: "Declined",
  no_decision: "No decision", not_a_candidate: "Not a candidate", not_applicable: "N/A",
};
const DISPOSITION_COLORS = {
  committed: "#0d9488", deferred: "#b45309", declined: "#dc2626",
  no_decision: "#6b7280", not_a_candidate: "#7c3aed", not_applicable: "#9ca3af",
};
const REASON_LABELS = {
  price_budget: "Price / budget",
  spouse_family_consult: "Spouse or family consult",
  wants_to_think: "Wants to think it over",
  no_perceived_need: "No perceived need",
  shopping_second_opinion: "Shopping / second opinion",
  insurance_benefit_issue: "Insurance benefit issue",
  health_life_circumstances: "Health / life circumstances",
  satisfied_with_current_devices: "Satisfied with current devices",
};
const CONTEXT_LABELS = { new_fit: "New fittings", upgrade: "Upgrades", care_plan_only: "Care-plan only" };
const PAYER_LABELS = { tpa: "TPA", other_insurance: "Other insurance", private_pay: "Private pay" };
const CARE_PLAN_LABELS = { complete: "Complete Care+", punch: "MHC Punch Card", paygo: "Standard Billing" };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);

function StatCard({ label, value, sub, accent = "#0d9488" }) {
  return (
    <div style={{ flex: "1 1 180px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// Horizontal count bars for a {key: count} map. Sorted descending.
function BarList({ counts, labels = {}, colors = {}, total }) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <div style={{ fontSize: 13, color: "#9ca3af" }}>Nothing in this range.</div>;
  const max = Math.max(...entries.map(([, n]) => n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map(([key, n]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 200, fontSize: 13, color: "#374151", flexShrink: 0 }}>{labels[key] || key}</div>
          <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 6, height: 18, position: "relative" }}>
            <div style={{ width: `${(n / max) * 100}%`, minWidth: 4, height: "100%", borderRadius: 6, background: colors[key] || "#0d9488", opacity: 0.85 }} />
          </div>
          <div style={{ width: 70, fontSize: 13, fontWeight: 700, color: "#111827", textAlign: "right", flexShrink: 0 }}>
            {n}{total ? <span style={{ color: "#9ca3af", fontWeight: 500 }}> · {Math.round((n / total) * 100)}%</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, blurb, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: blurb ? 2 : 14 }}>{title}</div>
      {blurb && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>{blurb}</div>}
      {children}
    </div>
  );
}

export default function Reports({ clinicId, clinicName, staffId }) {
  const [range, setRange] = useState("month");
  const [scope, setScope] = useState("clinic"); // 'clinic' | 'org'
  const [outcomes, setOutcomes] = useState(null);
  const [fittingTypes, setFittingTypes] = useState({});
  const [adjustments, setAdjustments] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const from = rangeToFrom(range);
        const rows = await loadAppointmentOutcomes({
          clinicId: scope === "clinic" ? clinicId : null,
          from: from ? from.toISOString() : null,
        });
        const ftMap = await loadFittingTypesForVisits(rows.map(r => r.visit_id));
        if (cancelled) return;
        setOutcomes(rows);
        setFittingTypes(ftMap);
      } catch (e) {
        console.error("Reports load failed:", e);
        if (!cancelled) setError(e?.message || "Failed to load report data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range, scope, clinicId]);

  // Price adjustments are provider-scoped by RLS — this is the signed-in
  // provider's own log, filtered to the range client-side.
  useEffect(() => {
    let cancelled = false;
    loadPriceAdjustmentHistory(staffId).then(rows => { if (!cancelled) setAdjustments(rows); });
    return () => { cancelled = true; };
  }, [staffId]);

  const stats = useMemo(
    () => (outcomes ? computeReportStats(outcomes, fittingTypes) : null),
    [outcomes, fittingTypes]
  );
  const adjStats = useMemo(() => {
    const from = rangeToFrom(range);
    const inRange = from
      ? adjustments.filter(r => {
          const ts = r.created_at || r.timestamp || null;
          return ts ? new Date(ts) >= from : true;
        })
      : adjustments;
    return computeAdjustmentStats(inRange);
  }, [adjustments, range]);

  const tpa = stats?.carePlan.byPayer.tpa;
  const seg = (active) => ({
    padding: "7px 14px", fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: "pointer",
    border: `1px solid ${active ? "#0d9488" : "#e5e7eb"}`,
    background: active ? "#f0fdfa" : "#fff", color: active ? "#0f766e" : "#6b7280",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1060 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Reports</h2>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            Outcomes recorded at close — payer details are snapshotted at the moment of decision.
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={range} onChange={e => setRange(e.target.value)}
            style={{ padding: "7px 10px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid #e5e7eb", color: "#374151", background: "#fff" }}>
            {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button style={seg(scope === "clinic")} onClick={() => setScope("clinic")}>{clinicName || "This clinic"}</button>
          <button style={seg(scope === "org")} onClick={() => setScope("org")}>All locations</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>
          <strong>Couldn't load report data:</strong> {error}
        </div>
      )}

      {loading && <div style={{ fontSize: 14, color: "#6b7280", padding: "24px 0" }}>Loading outcomes…</div>}

      {!loading && !error && stats && stats.total === 0 && (
        <div style={{ background: "#fff", border: "1px dashed #d1d5db", borderRadius: 12, padding: "36px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 4 }}>No closed appointments in this range yet</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            Outcomes appear here as appointments are closed with a disposition. Try a wider date range or All locations.
          </div>
        </div>
      )}

      {!loading && !error && stats && stats.total > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Device close rate" value={pct(stats.closeRate.rate)}
              sub={`${stats.closeRate.closed} committed of ${stats.closeRate.denominator} decidable`} />
            <StatCard label="TPA care-plan attach" value={pct(tpa?.rate)}
              sub={tpa?.candidates ? `${tpa.attached} of ${tpa.candidates} TPA device commits` : "No TPA device commits in range"}
              accent="#7c3aed" />
            <StatCard label="Committed revenue" value={usd.format(stats.revenue.committedRevenue)}
              sub={`${stats.revenue.revenueCount} priced commits` +
                (stats.revenue.estimatedAidCount ? ` · ${stats.revenue.estimatedAidCount} assumed bilateral` : "") +
                (stats.revenue.unpricedCount ? ` · ${stats.revenue.unpricedCount} unpriced` : "")}
              accent="#0369a1" />
            <StatCard label="Outcomes logged" value={stats.total}
              sub={Object.entries(stats.byContext).map(([k, v]) => `${CONTEXT_LABELS[k] || k}: ${pct(v.rate)}`).join(" · ")}
              accent="#374151" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
            <Section title="Outcome mix" blurb="Device-layer disposition of every outcome in range.">
              <BarList counts={stats.deviceMix} labels={DISPOSITION_LABELS} colors={DISPOSITION_COLORS} total={stats.total} />
            </Section>

            <Section title="Why patients deferred or declined" blurb="Device-layer reasons (required on deferrals and declines).">
              <BarList counts={stats.deviceReasons} labels={REASON_LABELS} />
            </Section>

            <Section title="Care-plan attach by payer"
              blurb="Among committed device outcomes where a care plan was in play.">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(stats.carePlan.byPayer).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <div style={{ width: 200, color: "#374151", flexShrink: 0 }}>{PAYER_LABELS[k]}</div>
                    <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 6, height: 18 }}>
                      <div style={{ width: `${(v.rate || 0) * 100}%`, minWidth: v.candidates ? 4 : 0, height: "100%", borderRadius: 6, background: "#7c3aed", opacity: 0.85 }} />
                    </div>
                    <div style={{ width: 110, fontWeight: 700, color: "#111827", textAlign: "right", flexShrink: 0 }}>
                      {pct(v.rate)}<span style={{ color: "#9ca3af", fontWeight: 500 }}> · {v.attached}/{v.candidates}</span>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                  Overall: {pct(stats.carePlan.overall.rate)} ({stats.carePlan.overall.attached} of {stats.carePlan.overall.candidates})
                </div>
              </div>
            </Section>

            <Section title="Care plans selected" blurb="Which plan committed patients chose.">
              <BarList counts={stats.carePlan.selectedMix} labels={CARE_PLAN_LABELS} />
            </Section>

            <Section title="Tier mix on commits" blurb="From the payer snapshot at close.">
              <BarList counts={stats.revenue.tierMix} total={Object.values(stats.revenue.tierMix).reduce((a, b) => a + b, 0)} />
            </Section>

            <Section title="Your price adjustments"
              blurb="Adjustments you logged in this range (each provider sees their own).">
              {adjStats.count === 0 ? (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>No adjustments logged in this range.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#374151" }}>
                    <div><strong style={{ fontSize: 18 }}>{adjStats.count}</strong> adjustments</div>
                    <div><strong style={{ fontSize: 18 }}>{usd.format(adjStats.totalDiscount)}</strong> total discounted</div>
                    <div><strong style={{ fontSize: 18 }}>{adjStats.avgPercent == null ? "—" : `${Math.abs(adjStats.avgPercent).toFixed(1)}%`}</strong> avg discount</div>
                  </div>
                  <BarList counts={adjStats.byReason} />
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
