import { useEffect, useMemo, useState } from "react";
import { loadPriceAdjustmentHistory } from "../db.js";
import { ADJUST_REASON_CODES } from "./AdjustPriceModal.jsx";
import { COLOR, FONT, SHADOW } from "../theme.js";

// Provider's own price-adjustment history — spec §6/§11 reflection tool.
// "Not gamified, not a performance metric, not visible to peers": this is a
// private, filterable record of the exceptions the logged-in provider has
// documented. Deliberately NO running dollar totals or rankings — a plain
// count is the only aggregate. Rows come pre-scoped to the caller's own
// provider_id by loadPriceAdjustmentHistory.

const REASON_LABEL = Object.fromEntries(ADJUST_REASON_CODES.map(r => [r.code, r.label]));

const PRODUCT_LABEL = {
  device:    "Device",
  bundle:    "Device + Care+",
  care_plan: "Care plan",
  accessory: "Accessory",
};

const money = (n) =>
  (n == null || isNaN(n))
    ? "—"
    : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The table's timestamp column name isn't guaranteed (created_at vs timestamp),
// so read whichever is present.
const tsOf = (row) => row.created_at || row.timestamp || row.logged_at || row.inserted_at || null;

function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Adjusted − original. Discounts are negative. Falls back to computing from the
// two prices when the table didn't store a precomputed delta.
function deltaOf(row) {
  const orig = row.original_price != null ? Number(row.original_price) : null;
  const adj = row.adjusted_price != null ? Number(row.adjusted_price) : null;
  const amount = row.delta_amount != null ? Number(row.delta_amount)
    : (orig != null && adj != null ? adj - orig : null);
  const percent = row.delta_percent != null ? Number(row.delta_percent)
    : (orig ? ((adj - orig) / orig) * 100 : null);
  return { orig, adj, amount, percent };
}

export default function AdjustmentHistory({ staffId, patients = [] }) {
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [patientId, setPatientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("recent"); // recent | discount

  useEffect(() => {
    let cancelled = false;
    if (!staffId) { setRows([]); return; }
    (async () => {
      try {
        const data = await loadPriceAdjustmentHistory(staffId);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) { setError(e.message || String(e)); setRows([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [staffId]);

  const patientName = useMemo(() => {
    const byId = {};
    for (const p of patients) {
      byId[p.id] = p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || null;
    }
    return (id) => byId[id] || (id ? id.slice(0, 8).toUpperCase() : "—");
  }, [patients]);

  // Patients that actually appear in this provider's log — the patient filter
  // only offers names there's history for.
  const patientOptions = useMemo(() => {
    if (!rows) return [];
    const ids = [...new Set(rows.map(r => r.patient_id).filter(Boolean))];
    return ids.map(id => ({ id, name: patientName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, patientName]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const fromMs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toMs = to ? new Date(to + "T23:59:59").getTime() : null;
    const out = rows.filter(r => {
      if (reason && r.reason_code !== reason) return false;
      if (patientId && r.patient_id !== patientId) return false;
      const ts = tsOf(r);
      const ms = ts ? new Date(ts).getTime() : null;
      if (fromMs != null && (ms == null || ms < fromMs)) return false;
      if (toMs != null && (ms == null || ms > toMs)) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sort === "discount") {
        return Math.abs(deltaOf(b).amount || 0) - Math.abs(deltaOf(a).amount || 0);
      }
      return (new Date(tsOf(b) || 0).getTime()) - (new Date(tsOf(a) || 0).getTime());
    });
    return out;
  }, [rows, reason, patientId, from, to, sort]);

  const hasFilters = reason || patientId || from || to;
  const clear = () => { setReason(""); setPatientId(""); setFrom(""); setTo(""); };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">My Price Adjustments</div>
          <div className="topbar-sub">A private record of the exceptions you've documented — to reflect on, not a scorecard.</div>
        </div>
      </div>

      <div className="content">
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {/* Filters */}
          <div style={st.filterBar}>
            <Field label="Reason">
              <select value={reason} onChange={e => setReason(e.target.value)} style={st.select}>
                <option value="">All reasons</option>
                {ADJUST_REASON_CODES.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Patient">
              <select value={patientId} onChange={e => setPatientId(e.target.value)} style={st.select}>
                <option value="">All patients</option>
                {patientOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="From">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={st.select} />
            </Field>
            <Field label="To">
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={st.select} />
            </Field>
            <Field label="Sort">
              <select value={sort} onChange={e => setSort(e.target.value)} style={st.select}>
                <option value="recent">Newest first</option>
                <option value="discount">Largest change first</option>
              </select>
            </Field>
            {hasFilters && (
              <button onClick={clear} style={st.clearBtn}>Clear</button>
            )}
          </div>

          {error && <div style={st.error}>Couldn't load your adjustments. {error}</div>}

          {rows == null ? (
            <div style={st.empty}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={st.empty}>
              {rows.length === 0
                ? "You haven't documented any price adjustments yet. When you adjust a price during a fitting, it'll appear here."
                : "No adjustments match these filters."}
            </div>
          ) : (
            <>
              <div style={st.count}>
                {filtered.length} {filtered.length === 1 ? "adjustment" : "adjustments"}
                {hasFilters ? ` of ${rows.length}` : ""}
              </div>
              <div style={st.table}>
                <div style={{ ...st.row, ...st.headRow }}>
                  <span>When</span>
                  <span>Patient</span>
                  <span>What</span>
                  <span>Reason</span>
                  <span style={st.num}>Original</span>
                  <span style={st.num}>Adjusted</span>
                  <span style={st.num}>Change</span>
                </div>
                {filtered.map(r => {
                  const d = deltaOf(r);
                  const isDiscount = d.amount != null && d.amount < 0;
                  return (
                    <div key={r.id} style={st.row}>
                      <span style={st.when}>{fmtWhen(tsOf(r))}</span>
                      <span style={st.patient}>{patientName(r.patient_id)}</span>
                      <span style={st.muted}>{PRODUCT_LABEL[r.product_type] || r.product_type || "—"}</span>
                      <span>
                        <span style={st.reasonChip}>{REASON_LABEL[r.reason_code] || r.reason_code || "—"}</span>
                        {r.reason_text && <div style={st.reasonText}>{r.reason_text}</div>}
                      </span>
                      <span style={{ ...st.num, ...st.muted }}>{money(d.orig)}</span>
                      <span style={{ ...st.num, fontWeight: 700 }}>{money(d.adj)}</span>
                      <span style={{ ...st.num, color: isDiscount ? COLOR.teal : COLOR.danger, fontWeight: 700 }}>
                        {d.amount == null ? "—" : `${d.amount < 0 ? "−" : "+"}$${money(Math.abs(d.amount)).slice(1)}`}
                        {d.percent != null && (
                          <div style={st.pct}>{d.percent < 0 ? "−" : "+"}{Math.abs(Math.round(d.percent))}%</div>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <label style={st.field}>
      <span style={st.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const st = {
  filterBar: {
    display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end",
    background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
    padding: "14px 16px", marginBottom: 16, boxShadow: SHADOW.sm,
  },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: COLOR.ink3 },
  select: {
    padding: "7px 10px", border: `1px solid ${COLOR.line}`, borderRadius: 8,
    fontFamily: FONT.ui, fontSize: 13, color: COLOR.ink, background: COLOR.card, outline: "none",
  },
  clearBtn: {
    padding: "7px 14px", border: `1px solid ${COLOR.line}`, borderRadius: 8,
    background: COLOR.card, color: COLOR.ink2, fontFamily: FONT.ui, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  count: { fontSize: 12, color: COLOR.ink3, fontWeight: 600, marginBottom: 8, paddingLeft: 2 },
  table: {
    background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
    overflow: "hidden", boxShadow: SHADOW.sm, fontFamily: FONT.ui,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1.3fr 1.1fr 0.9fr 1.6fr 0.9fr 0.9fr 0.9fr",
    gap: 12, alignItems: "start", padding: "11px 16px",
    borderTop: `1px solid ${COLOR.line2}`, fontSize: 13, color: COLOR.ink,
  },
  headRow: {
    borderTop: "none", background: COLOR.paper2,
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: COLOR.ink3,
  },
  num: { textAlign: "right" },
  when: { color: COLOR.ink2, fontSize: 12.5 },
  patient: { fontWeight: 600 },
  muted: { color: COLOR.ink2 },
  reasonChip: {
    display: "inline-block", background: COLOR.tealSoft, color: COLOR.tealInk,
    borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 600,
  },
  reasonText: { marginTop: 4, fontSize: 11.5, color: COLOR.ink3, fontStyle: "italic", lineHeight: 1.4 },
  pct: { fontSize: 11, fontWeight: 600, opacity: 0.85 },
  empty: {
    background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
    padding: "40px 24px", textAlign: "center", color: COLOR.ink3, fontSize: 14, fontFamily: FONT.ui,
  },
  error: {
    background: COLOR.dangerSoft, border: `1px solid ${COLOR.danger}`, borderRadius: 10,
    padding: "12px 16px", color: COLOR.dangerInk, fontSize: 13, marginBottom: 16, fontFamily: FONT.ui,
  },
};
