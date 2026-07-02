// ── Device Comparison — old vs. new, side by side ────────────────────────────
// A split-screen comparator: the patient's current/older hearing aid against a
// proposed new one, scored across the same nine listening environments the
// Technology Tier + Device Selection screens use. Built for two homes:
//   • embedded in the returning-patient Journey Review (UpgradeWizard step 4),
//     pre-filled from the chart; and
//   • a standalone tool (route /distil/compare) usable cold, outside a visit.
//
// The old side draws from the curated legacy_device reference (competitor /
// trade-in units we never fit, e.g. a 7-yr-old Costco KS9), a prior MHC fitting,
// or manual quick-entry. The new side draws from the live product catalog.
// Scoring lives in deviceComparison.js — an honest, provider-confirmed estimate,
// never a measured claim about a competitor.
import React, { useState, useEffect, useMemo } from "react";
import { COLOR, FONT } from "../theme.js";
import { coverageColor } from "../components/CoverageBars.jsx";
import { ENVIRONMENTS } from "../listeningSituations.js";
import {
  compareCoverage, specUpgrades, averageGain, searchLegacyDevices, rankFromTierLabel,
} from "../deviceComparison.js";
import { loadLegacyDevices, loadProductCatalogTiers } from "../db.js";

// Product-catalog tier_rank (1-5) → the sparse COVERAGE_BY_RANK scale (5/3/1).
const COVERAGE_RANK_BY_CATALOG_RANK = { 5: 5, 4: 3, 3: 1, 2: 0, 1: -1 };
// Fallback manufacturer lines if the catalog can't be loaded.
const FALLBACK_MFRS = ["Signia", "Phonak", "Rexton", "Oticon", "ReSound", "Starkey", "Widex"];
const CURRENT_YEAR = new Date().getFullYear();

// Normalize a catalog / free-text directional-mic value into the model's vocab.
function normalizeMic(x) {
  const m = String(x || "").toLowerCase();
  if (m.includes("beam")) return "beamforming";
  if (m.includes("adaptive")) return "adaptive";
  if (m.includes("fixed")) return "fixed";
  if (m.includes("omni")) return "omni";
  return null;
}

// Best-effort tech-level string ("7IX", "80", "90") → coverage rank. Single
// digits use the plan-tier map (7→Premium); two-digit ladders use the tens
// digit (80/90→Premium, 60/70→Advanced, else Standard). Provider can override.
// Exported for the new-patient wizard, which builds a "proposed new" descriptor
// from its configured device selection.
export function techLevelToRank(tl) {
  const n = parseInt(String(tl ?? "").match(/\d+/)?.[0] ?? "", 10);
  if (!Number.isFinite(n)) return null;
  if (n < 10) return rankFromTierLabel(String(n));
  const tens = Math.floor(n / 10);
  if (tens >= 8) return 5;
  if (tens >= 6) return 3;
  return 1;
}

// ── Device descriptor builders ───────────────────────────────────────────────
// Each returns the shape the model + cards consume: display/sub for the card,
// plus the tierRank/releaseYear/spec fields the coverage math reads.
function legacyToDevice(row) {
  if (!row) return null;
  return {
    kind: "legacy",
    display: `${row.brand || row.manufacturer} ${row.model}`,
    sub: [row.platform, row.releaseYear].filter(Boolean).join(" · "),
    tierRank: row.originalTierRank,
    tierLabel: row.originalTierLabel,
    releaseYear: row.releaseYear,
    directionalMic: row.directionalMic,
    bluetoothStreaming: row.bluetoothStreaming,
    rechargeable: row.rechargeable,
    telecoil: row.telecoil,
    formFactors: row.formFactors,
    confidence: row.confidence,
    sourceUrl: row.sourceUrl,
  };
}

function fittingToDevice(devices) {
  if (!devices || !devices.manufacturer) return null;
  const year = devices.fittingDate ? new Date(devices.fittingDate).getFullYear() : null;
  return {
    kind: "fitting",
    display: [devices.manufacturer, devices.family].filter(Boolean).join(" "),
    sub: [devices.techLevel, year ? `fitted ${year}` : null].filter(Boolean).join(" · "),
    tierRank: techLevelToRank(devices.techLevel),
    releaseYear: year,
    // Specs unknown for a prior fitting — era penalty carries the estimate.
    directionalMic: null, bluetoothStreaming: null, rechargeable: null, telecoil: null,
  };
}

function catalogTierToDevice(tierRow) {
  if (!tierRow) return null;
  const rank = COVERAGE_RANK_BY_CATALOG_RANK[tierRow.tierRank] ?? null;
  const label = [tierRow.manufacturer, tierRow.family].filter(Boolean).join(" ");
  const mic = normalizeMic(tierRow.directionalMic);
  // The catalog's per-tier spec columns are largely unpopulated today, so an
  // empty value means "unknown", NOT "absent". Current-generation devices are
  // modern by default — streaming + directionality that scale with tier — and
  // an explicit catalog value always wins when present. Without this, an empty
  // streaming array would wrongly dock the NEW device a connectivity penalty.
  return {
    kind: "catalog",
    display: label || "New technology",
    sub: [tierRow.tierName, tierRow.platformChip].filter(Boolean).join(" · "),
    tierRank: rank,
    releaseYear: null, // current generation — no era penalty
    directionalMic: mic || (rank != null && rank >= 3 ? "beamforming" : "adaptive"),
    bluetoothStreaming: true,
    rechargeable: tierRow.rechargeable ?? true,
    telecoil: tierRow.telecoil ?? null,
  };
}

function manualToDevice(m) {
  const rank = rankFromTierLabel(m.tierLabel);
  if (rank == null) return null;
  return {
    kind: "manual",
    display: m.name?.trim() || `${m.tierLabel} device`,
    sub: [m.year ? `~${m.year}` : null, m.tierLabel].filter(Boolean).join(" · "),
    tierRank: rank,
    releaseYear: m.year ? Number(m.year) : null,
    directionalMic: m.directionalMic || null,
    bluetoothStreaming: m.bluetoothStreaming,
    rechargeable: m.rechargeable,
    telecoil: null,
  };
}

// Prefer the Signia Pure Charge&Go IX flagship (7IX) as the default "new" side,
// so the comparison opens against a real current premium, not a placeholder.
function pickDefaultNewTier(tiers) {
  const signia = tiers.filter(t => (t.manufacturer || "").toLowerCase() === "signia" && t.tierRank === 5);
  return signia.find(t => t.family === "Pure Charge&Go IX")
    || signia.find(t => /IX/.test(t.tierName || ""))
    || signia[0] || null;
}

// A modern flagship stand-in used until the catalog loads (then replaced by 7IX).
const DEFAULT_NEW = {
  kind: "default", display: "New premium technology", sub: "Current generation",
  tierRank: 5, releaseYear: null,
  directionalMic: "beamforming", bluetoothStreaming: true, rechargeable: true, telecoil: true,
};

// ── Small UI atoms ───────────────────────────────────────────────────────────
function Chip({ children, tone = "teal" }) {
  const tones = {
    teal: { bg: COLOR.tealSoft, fg: COLOR.tealInk },
    brass: { bg: COLOR.brassSoft, fg: COLOR.brassInk },
    muted: { bg: COLOR.paper2, fg: COLOR.ink2 },
  };
  const t = tones[tone] || tones.teal;
  return (
    <span style={{ display: "inline-block", background: t.bg, color: t.fg, fontSize: 11,
      fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function DeviceCard({ side, device, onChange }) {
  const isNew = side === "new";
  return (
    <div style={{ flex: 1, minWidth: 0, background: COLOR.card, border: `1px solid ${COLOR.line}`,
      borderRadius: 12, padding: 16, borderTop: `3px solid ${isNew ? COLOR.teal : COLOR.ink3}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: isNew ? COLOR.tealInk : COLOR.ink3, marginBottom: 6 }}>
        {isNew ? "New — proposed" : "Current — today"}
      </div>
      <div style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: COLOR.ink,
        lineHeight: 1.15 }}>
        {device?.display || (isNew ? "Pick a device" : "No current device set")}
      </div>
      {device?.sub && (
        <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 3 }}>{device.sub}</div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {device?.tierLabel && <Chip tone="muted">{device.tierLabel} when new</Chip>}
        {device?.rechargeable && <Chip tone="muted">Rechargeable</Chip>}
        {device?.bluetoothStreaming && <Chip tone="muted">Bluetooth</Chip>}
      </div>
      <button onClick={onChange} style={{ marginTop: 12, background: "transparent",
        border: `1px solid ${COLOR.line}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer",
        fontSize: 12, fontWeight: 600, color: COLOR.ink2 }}>
        {device ? "Change" : "Choose"}
      </button>
    </div>
  );
}

// One environment row: label, stacked current/new bars, and the gain.
// Both bars read on the SAME green-to-red coverage scale so the eye compares
// like with like; the current device's bar is muted (desaturated + faded) so
// the vivid bar is always the proposed device.
const MUTED_BAR = { opacity: 0.5, filter: "saturate(0.45)" };
function PairedRow({ label, oldPct, newPct, delta, prominent }) {
  const track = { position: "relative", height: 6, background: COLOR.line, borderRadius: 3, overflow: "hidden" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10,
      fontSize: prominent ? 12 : 11, padding: "3px 0" }}>
      <div style={{ flex: "1 1 40%", minWidth: 0, color: prominent ? COLOR.ink : COLOR.ink2,
        fontWeight: prominent ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={track} title="Current device">
          <div style={{ width: `${oldPct ?? 0}%`, height: "100%", background: coverageColor(oldPct ?? 0),
            ...MUTED_BAR }} />
        </div>
        <div style={track} title="New device">
          <div style={{ width: `${newPct ?? 0}%`, height: "100%", background: coverageColor(newPct ?? 0),
            transition: "width 0.25s" }} />
        </div>
      </div>
      <div style={{ flex: "0 0 44px", textAlign: "right", fontSize: 12, fontWeight: 700,
        color: delta > 0 ? COLOR.tealInk : COLOR.ink3 }}>
        {delta == null ? "–" : (delta > 0 ? `+${delta}` : delta)}
      </div>
    </div>
  );
}

// ── Pickers ──────────────────────────────────────────────────────────────────
function OldPicker({ legacyList, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ name: "", tierLabel: "Advanced", year: "",
    directionalMic: "adaptive", bluetoothStreaming: true, rechargeable: false });
  const results = useMemo(() => searchLegacyDevices(legacyList, query).slice(0, 40), [legacyList, query]);

  const field = { width: "100%", padding: "8px 10px", border: `1px solid ${COLOR.line}`,
    borderRadius: 8, fontSize: 13, color: COLOR.ink, background: COLOR.card, boxSizing: "border-box" };

  return (
    <div style={{ background: COLOR.paper, border: `1px solid ${COLOR.line}`, borderRadius: 12, padding: 14, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: COLOR.ink, fontSize: 14 }}>Set the current device</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setManual(!manual)} style={{ background: "transparent", border: "none",
            color: COLOR.teal, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {manual ? "Search catalog" : "Enter manually"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLOR.ink3,
            cursor: "pointer", fontSize: 12 }}>Close</button>
        </div>
      </div>

      {!manual ? (
        <>
          <input autoFocus placeholder="Search — e.g. KS9, Marvel, Oticon More…" value={query}
            onChange={e => setQuery(e.target.value)} style={field} />
          <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {results.length === 0 && (
              <div style={{ fontSize: 12, color: COLOR.ink3, padding: "8px 2px" }}>
                No match. Try a model name or “Enter manually”.
              </div>
            )}
            {results.map(d => (
              <button key={d.id} onClick={() => onPick(legacyToDevice(d))} style={{ textAlign: "left",
                background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 8, padding: "8px 10px",
                cursor: "pointer" }}>
                <div style={{ fontWeight: 600, color: COLOR.ink, fontSize: 13 }}>{d.brand} {d.model}</div>
                <div style={{ fontSize: 11, color: COLOR.ink2 }}>
                  {[d.platform, d.releaseYear, `${d.originalTierLabel} class`].filter(Boolean).join(" · ")}
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Name (optional) — e.g. Oticon Opn 1" value={m.name}
            onChange={e => setM({ ...m, name: e.target.value })} style={field} />
          <div style={{ display: "flex", gap: 8 }}>
            <select value={m.tierLabel} onChange={e => setM({ ...m, tierLabel: e.target.value })} style={field}>
              <option>Premium</option><option>Advanced</option><option>Standard</option>
            </select>
            <input placeholder="Year (e.g. 2019)" value={m.year} inputMode="numeric"
              onChange={e => setM({ ...m, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} style={field} />
          </div>
          <select value={m.directionalMic} onChange={e => setM({ ...m, directionalMic: e.target.value })} style={field}>
            <option value="beamforming">Beamforming mics</option>
            <option value="adaptive">Adaptive directional</option>
            <option value="fixed">Fixed directional</option>
            <option value="omni">Omnidirectional</option>
          </select>
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: COLOR.ink2 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={m.bluetoothStreaming}
                onChange={e => setM({ ...m, bluetoothStreaming: e.target.checked })} /> Bluetooth streaming
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={m.rechargeable}
                onChange={e => setM({ ...m, rechargeable: e.target.checked })} /> Rechargeable
            </label>
          </div>
          <button onClick={() => { const d = manualToDevice(m); if (d) onPick(d); }}
            style={{ background: COLOR.pine, color: "white", border: "none", borderRadius: 8,
              padding: "9px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Use this device
          </button>
        </div>
      )}
    </div>
  );
}

function NewPicker({ catalogTiers, onPick, onClose }) {
  // Group catalog tiers by family; each family lists its tiers (premium first).
  const families = useMemo(() => {
    const map = new Map();
    for (const t of catalogTiers) {
      if (t.tierRank == null) continue;
      const key = [t.manufacturer, t.family].filter(Boolean).join(" ");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.tierRank - a.tierRank);
    return [...map.entries()].map(([label, tiers]) => ({ label, tiers }));
  }, [catalogTiers]);

  const [familyKey, setFamilyKey] = useState("");
  const family = families.find(f => f.label === familyKey) || families[0];
  const field = { width: "100%", padding: "8px 10px", border: `1px solid ${COLOR.line}`,
    borderRadius: 8, fontSize: 13, color: COLOR.ink, background: COLOR.card, boxSizing: "border-box" };

  return (
    <div style={{ background: COLOR.paper, border: `1px solid ${COLOR.line}`, borderRadius: 12, padding: 14, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, color: COLOR.ink, fontSize: 14 }}>Choose the new device</div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLOR.ink3,
          cursor: "pointer", fontSize: 12 }}>Close</button>
      </div>
      {families.length === 0 ? (
        <div style={{ fontSize: 12, color: COLOR.ink3 }}>Catalog unavailable — the comparison uses a
          modern premium baseline. Try again once the catalog loads.</div>
      ) : (
        <>
          <select value={family?.label || ""} onChange={e => setFamilyKey(e.target.value)} style={{ ...field, marginBottom: 8 }}>
            {families.map(f => <option key={f.label} value={f.label}>{f.label}</option>)}
          </select>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {family?.tiers.map(t => (
              <button key={t.id} onClick={() => onPick(catalogTierToDevice(t))} style={{ background: COLOR.card,
                border: `1px solid ${COLOR.line}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: COLOR.ink }}>
                {t.tierName}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main comparator ──────────────────────────────────────────────────────────
export default function DeviceComparison({
  patient = null, initialOld = null, initialNew = null, proposedNew = null,
  flaggedEnvs = null, variant = "standalone", onClose = null,
}) {
  const [legacyList, setLegacyList] = useState([]);
  const [catalogTiers, setCatalogTiers] = useState([]);
  const [oldDevice, setOldDevice] = useState(initialOld || fittingToDevice(patient?.devices) || null);
  const [newDevice, setNewDevice] = useState(initialNew || proposedNew || DEFAULT_NEW);
  const [picker, setPicker] = useState(null); // 'old' | 'new' | null
  // When the patient flagged environments, the chart opens showing ONLY those
  // rows (the ones the conversation is actually about) with an expander for
  // the full nine. No flags → all nine, no expander.
  const [showAllEnvs, setShowAllEnvs] = useState(false);

  // Follow the caller's live pick (the wizard passes its configured device as
  // proposedNew) so the bars track the device actually being selected. Only
  // fires when a real device is proposed — deconfiguring keeps the last pick.
  useEffect(() => {
    if (proposedNew) setNewDevice(proposedNew);
  }, [proposedNew?.display, proposedNew?.tierRank]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    loadLegacyDevices().then(d => alive && setLegacyList(d || [])).catch(() => {});
    loadProductCatalogTiers().then(d => {
      if (!alive) return;
      const tiers = d || [];
      setCatalogTiers(tiers);
      const pick = pickDefaultNewTier(tiers);
      // Only override the placeholder — never clobber a provider's or caller's pick.
      if (pick) setNewDevice(prev => (prev && prev.kind === "default") ? catalogTierToDevice(pick) : prev);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const flagged = flaggedEnvs instanceof Set ? flaggedEnvs : new Set();
  const rows = useMemo(
    () => compareCoverage(oldDevice, newDevice, { currentYear: CURRENT_YEAR }),
    [oldDevice, newDevice]
  );
  const ready = oldDevice?.tierRank != null && newDevice?.tierRank != null;
  const headlineGain = useMemo(() => averageGain(rows, flagged.size ? flagged : null), [rows, flagged]);
  const upgrades = useMemo(() => specUpgrades(oldDevice, newDevice), [oldDevice, newDevice]);

  // Flagged environments float to the top, emphasized — matches EnvironmentCoverage.
  const orderedRows = useMemo(() => {
    if (!flagged.size) return rows.map(r => ({ ...r, prominent: false }));
    const yes = [], no = [];
    for (const r of rows) (flagged.has(r.id) ? yes : no).push({ ...r, prominent: flagged.has(r.id) });
    return [...yes, ...no];
  }, [rows, flagged]);

  // Collapsed view = just the flagged rows (matches the headline-gain scope).
  const collapsible = flagged.size > 0 && flagged.size < orderedRows.length;
  const visibleRows = collapsible && !showAllEnvs
    ? orderedRows.filter(r => r.prominent)
    : orderedRows;
  const hiddenCount = orderedRows.length - visibleRows.length;

  const wrap = variant === "standalone"
    ? { maxWidth: 860, margin: "0 auto", padding: "24px 20px" }
    : { padding: 0 };

  return (
    <div style={{ fontFamily: FONT.ui, color: COLOR.ink, ...wrap }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 700 }}>Then vs. Now</div>
          <div style={{ fontSize: 13, color: COLOR.ink2, marginTop: 2 }}>
            How today's technology compares to the current hearing aids, environment by environment.
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${COLOR.line}`,
            borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: COLOR.ink2 }}>
            Close
          </button>
        )}
      </div>

      {/* Device cards */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        <DeviceCard side="old" device={oldDevice} onChange={() => setPicker(picker === "old" ? null : "old")} />
        <DeviceCard side="new" device={newDevice} onChange={() => setPicker(picker === "new" ? null : "new")} />
      </div>

      {picker === "old" && (
        <OldPicker legacyList={legacyList}
          onPick={d => { setOldDevice(d); setPicker(null); }} onClose={() => setPicker(null)} />
      )}
      {picker === "new" && (
        <NewPicker catalogTiers={catalogTiers}
          onPick={d => { setNewDevice(d); setPicker(null); }} onClose={() => setPicker(null)} />
      )}

      {/* Headline gain */}
      {ready && headlineGain != null && (
        <div style={{ background: COLOR.cream, border: `1px solid ${COLOR.brassSoft}`, borderRadius: 12,
          padding: "14px 18px", marginTop: 16, display: "flex", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 34, fontWeight: 700, color: COLOR.brass }}>
            +{headlineGain}%
          </div>
          <div style={{ fontSize: 13, color: COLOR.ink2 }}>
            average improvement{flagged.size ? " in the environments this patient flagged" : " across everyday listening"}
            {" "}with {newDevice.display}.
          </div>
        </div>
      )}

      {/* Comparison bars */}
      {ready ? (
        <div style={{ background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
          padding: 16, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: COLOR.ink2 }}>
              Listening environment
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 10, color: COLOR.ink2 }}>
              <span><span style={{ display: "inline-block", width: 10, height: 6, background: coverageColor(80),
                opacity: 0.5, filter: "saturate(0.45)", borderRadius: 2, marginRight: 4 }} />Current (faded)</span>
              <span><span style={{ display: "inline-block", width: 10, height: 6, background: coverageColor(80),
                borderRadius: 2, marginRight: 4 }} />New</span>
              <span style={{ fontWeight: 700 }}>Gain</span>
            </div>
          </div>
          {visibleRows.map(r => (
            <PairedRow key={r.id} label={r.label} oldPct={r.old} newPct={r.new} delta={r.delta} prominent={r.prominent} />
          ))}
          {collapsible && (
            <button onClick={() => setShowAllEnvs(v => !v)}
              style={{ marginTop: 10, width: "100%", background: "transparent",
                border: `1px dashed ${COLOR.line}`, borderRadius: 8, padding: "7px 12px",
                cursor: "pointer", fontSize: 12, fontWeight: 600, color: COLOR.ink2 }}>
              {showAllEnvs
                ? "Show fewer — just the flagged environments"
                : `Show all ${orderedRows.length} environments (${hiddenCount} more)`}
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: COLOR.paper, border: `1px dashed ${COLOR.line}`, borderRadius: 12,
          padding: 24, marginTop: 16, textAlign: "center", color: COLOR.ink2, fontSize: 13 }}>
          {oldDevice?.tierRank == null
            ? "Set the current device to see the comparison."
            : "Choose a new device to compare."}
        </div>
      )}

      {/* What the new devices add */}
      {ready && upgrades.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
            color: COLOR.tealInk, marginBottom: 8 }}>What the new devices add</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {upgrades.map((u, i) => <Chip key={i} tone="teal">{u}</Chip>)}
          </div>
        </div>
      )}

      {/* Honesty footnote */}
      <div style={{ fontSize: 11, color: COLOR.ink3, marginTop: 18, paddingTop: 12,
        borderTop: `1px solid ${COLOR.line}`, lineHeight: 1.5 }}>
        Estimated from technology generation and documented specifications — a clinician's
        comparison, not a measured lab result. Bars show expected coverage of each environment;
        {" "}<span style={{ color: "#16a34a", fontWeight: 700 }}>green</span> is fully covered,
        {" "}<span style={{ color: "#dc2626", fontWeight: 700 }}>red</span> is where even the best
        technology has limits.
      </div>
    </div>
  );
}
