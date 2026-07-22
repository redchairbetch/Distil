/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL. This source code is the exclusive property of
 * the copyright holder. Unauthorized copying, distribution, modification, or
 * use of this file, in whole or in part, via any medium, is strictly
 * prohibited without the prior written permission of the copyright holder.
 * See the LICENSE file at the repository root for full terms.
 */

// ── CapabilityComparison — the two-delta catalog comparison ──────────────────
// Renders the upgrade patient's situation as two separate, true stories:
//   1. Platform generations — how far the manufacturer's platform line has
//      moved since their device, as accumulated manufacturer-named innovations.
//   2. Technology tier — the manufacturer-named feature gates between where
//      their device sat on the ladder and the recommended level.
// Above both: a capability spectrum — a horizontal positioning of the two
// devices driven by internal score/rank. No numbers on it patient-side.
//
// Patient-facing rules enforced here (build brief §3):
//   • Zero percentages, zero composite scores visible to patients.
//   • Only verification_status='verified' rows make patient-facing claims;
//     the provider toggle reveals unverified/conflict items with badges,
//     internal scores, ladder positions, and source/notes detail.
//   • "Premium" never renders patient-side — displayed as "Select".
//   • Cross-brand comparisons render capability categories, never spec races.
// Data access via catalog.js; all comparison logic in catalogComparison.js.
// Distil.jsx only imports and mounts this — no logic lives in the monolith.
import React, { useState, useEffect, useMemo } from "react";
import { COLOR, FONT } from "../theme.js";
import { loadDeviceCatalog, loadNewestCatalogFitting } from "../catalog.js";
import { deviceImageUrl } from "../deviceImages.js";
import {
  indexCatalog, compareDevices, resolveBase, ladderOf, CATEGORY_LABELS,
} from "../catalogComparison.js";

const CURRENT = "current";

// Patient-facing tier label: "Premium" is banned copy — the top tier is "Select".
export function tierDisplayLabel(designation) {
  return String(designation || "").toLowerCase() === "premium" ? "Select" : designation;
}

// Position → patient-facing words. Exact positions are provider-view detail.
function positionPhrase(pos, ladderSize) {
  if (pos <= 1) return "the top technology level";
  if (pos >= ladderSize) return "the entry technology level";
  if (pos === 2 && ladderSize >= 4) return "an upper technology level";
  return "a middle technology level";
}

// ── Small atoms ──────────────────────────────────────────────────────────────
function Badge({ status }) {
  if (status === "verified") return null;
  const tone = status === "conflict"
    ? { bg: COLOR.dangerSoft, fg: COLOR.dangerInk, label: "conflict" }
    : { bg: COLOR.paper2, fg: COLOR.ink3, label: "unverified" };
  return (
    <span style={{ background: tone.bg, color: tone.fg, fontSize: 9, fontWeight: 700,
      letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 6px",
      borderRadius: 999, marginLeft: 6, whiteSpace: "nowrap" }}>
      {tone.label}
    </span>
  );
}

function Chip({ children, muted = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center",
      background: muted ? COLOR.paper2 : COLOR.tealSoft,
      color: muted ? COLOR.ink2 : COLOR.tealInk,
      fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999 }}>
      {children}
    </span>
  );
}

// Claim items: verified renders always; unverified/conflict only in provider view.
function ClaimChips({ items, provider }) {
  const visible = (items || []).filter(i => provider || i.status === "verified");
  if (visible.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {visible.map((i, k) => (
        <Chip key={k} muted={i.status !== "verified"}>
          {i.text}{provider && <Badge status={i.status} />}
        </Chip>
      ))}
    </div>
  );
}

// ── Device cascade picker (manufacturer → platform → tier) ───────────────────
// Doubles as catalog validation: what the front desk can't find here is a
// catalog gap. Shared by both sides and by the legacy fast-path form.
export function DeviceCascade({ idx, value, onChange, allowEmptyTier = false }) {
  const { platformId = "", tierId = "" } = value || {};
  const platform = idx.platformsById.get(platformId) || null;
  const manufacturer = platform?.manufacturer || value?.manufacturer || "";

  const manufacturers = useMemo(
    () => [...new Set(idx.platforms.map(p => p.manufacturer))].sort(),
    [idx]
  );
  const platforms = useMemo(
    () => idx.platforms.filter(p => p.manufacturer === manufacturer),
    [idx, manufacturer]
  );
  const ladder = platform ? ladderOf(platform, idx) : [];

  const field = { flex: 1, minWidth: 0, padding: "8px 10px", border: `1px solid ${COLOR.line}`,
    borderRadius: 8, fontSize: 13, color: COLOR.ink, background: COLOR.card };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select style={field} value={manufacturer}
        onChange={e => onChange({ manufacturer: e.target.value, platformId: "", tierId: "" })}>
        <option value="">Manufacturer…</option>
        {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select style={field} value={platformId} disabled={!manufacturer}
        onChange={e => onChange({ manufacturer, platformId: e.target.value, tierId: "" })}>
        <option value="">Platform…</option>
        {platforms.map(p => (
          <option key={p.id} value={p.id}>
            {p.platformName}{p.releaseYear ? ` (${p.releaseYear})` : ""}{p.deviceClass === "otc" ? " · OTC" : ""}
          </option>
        ))}
      </select>
      <select style={field} value={tierId} disabled={!platformId}
        onChange={e => onChange({ manufacturer, platformId, tierId: e.target.value })}>
        <option value="">{allowEmptyTier ? "Level (if known)…" : "Level…"}</option>
        {ladder.map(t => (
          <option key={t.id} value={t.id}>{tierDisplayLabel(t.tierDesignation)}</option>
        ))}
      </select>
    </div>
  );
}

function DeviceCard({ side, platform, tier, freetext, provider, onChangeClick }) {
  const isRec = side === "recommended";
  const img = deviceImageUrl(platform?.imageKey);
  const name = freetext
    || (platform ? `${platform.manufacturer} ${platform.platformName}` : null);
  const sub = platform
    ? [tier ? tierDisplayLabel(tier.tierDesignation) : null,
       platform.releaseYear || null,
       platform.deviceClass === "otc" ? "over-the-counter" : null,
      ].filter(Boolean).join(" · ")
    : freetext ? "not yet matched to the catalog" : null;
  return (
    <div style={{ flex: 1, minWidth: 0, background: COLOR.card, border: `1px solid ${COLOR.line}`,
      borderRadius: 12, padding: 16, borderTop: `3px solid ${isRec ? COLOR.teal : COLOR.ink3}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: isRec ? COLOR.tealInk : COLOR.ink3, marginBottom: 6 }}>
        {isRec ? "Recommended" : "Current devices"}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT.display, fontSize: 19, fontWeight: 700, color: COLOR.ink, lineHeight: 1.15 }}>
            {name || (isRec ? "Pick a device" : "No device on record")}
          </div>
          {sub && <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 3 }}>{sub}</div>}
        </div>
        {img && <img src={img} alt="" style={{ width: 56, height: 56, objectFit: "contain", flexShrink: 0 }} />}
      </div>
      {provider && platform && (
        <div style={{ marginTop: 6 }}><Badge status={platform.verificationStatus} />
          {tier && <Badge status={tier.verificationStatus} />}
        </div>
      )}
      {onChangeClick && (
        <button onClick={onChangeClick} style={{ marginTop: 12, background: "transparent",
          border: `1px solid ${COLOR.line}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer",
          fontSize: 12, fontWeight: 600, color: COLOR.ink2 }}>
          Change
        </button>
      )}
    </div>
  );
}

// ── Capability spectrum ──────────────────────────────────────────────────────
// Two markers on one horizontal band. Positions come from the internal score;
// the scale carries no ticks, no units, no numbers patient-side. The distance
// does the talking.
function Spectrum({ result, provider, patientLabel, recLabel }) {
  const p = result?.spectrum?.patient;
  const r = result?.spectrum?.recommended;
  const clamp = v => Math.max(4, Math.min(96, v));
  const marker = (pct, label, color, above, score) => (
    <div style={{ position: "absolute", left: `${clamp(pct)}%`, transform: "translateX(-50%)",
      [above ? "bottom" : "top"]: 14, textAlign: "center", whiteSpace: "nowrap" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: above ? 4 : 0, marginTop: above ? 0 : 4 }}>
        {label}{provider && score != null ? ` · ${score}` : ""}
      </div>
    </div>
  );
  return (
    <div style={{ background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
      padding: "38px 24px 38px", marginTop: 16, position: "relative" }}>
      <div style={{ position: "relative", height: 10, borderRadius: 5,
        background: `linear-gradient(90deg, ${COLOR.paper2}, ${COLOR.tealSoft} 55%, ${COLOR.teal})` }}>
        {p != null && (
          <div style={{ position: "absolute", left: `${clamp(p)}%`, top: "50%",
            transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%",
            background: COLOR.card, border: `4px solid ${COLOR.ink3}` }} />
        )}
        {r != null && (
          <div style={{ position: "absolute", left: `${clamp(r)}%`, top: "50%",
            transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%",
            background: COLOR.card, border: `5px solid ${COLOR.teal}` }} />
        )}
        {p != null && marker(p, patientLabel || "Today", COLOR.ink2, false, provider ? p : null)}
        {r != null && marker(r, recLabel || "Recommended", COLOR.tealInk, true, provider ? r : null)}
      </div>
    </div>
  );
}

// ── Story sections ───────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.07em", color: COLOR.tealInk, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function GenerationStory({ result, provider }) {
  const { platformDelta, patient, recommended } = result;
  if (!platformDelta) return null;
  const countIsSolid = provider ||
    (patient.base.verificationStatus === "verified" && recommended.base.verificationStatus === "verified");
  const gens = platformDelta.generations;
  const headline = gens === 0
    ? "Same platform generation"
    : countIsSolid && gens != null
      ? `${gens} platform generation${gens === 1 ? "" : "s"} newer`
      : "A newer platform generation";
  return (
    <div style={{ background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
      padding: 16, marginTop: 16 }}>
      <SectionTitle>The platform — what changed underneath</SectionTitle>
      <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: COLOR.ink }}>
        {headline}
      </div>
      {gens === 0 && (
        <div style={{ fontSize: 13, color: COLOR.ink2, marginTop: 6 }}>
          The current devices run on the same platform generation — the difference lives in the technology level below.
        </div>
      )}
      {platformDelta.steps.map(step => {
        const items = (step.innovations || []).map(text => ({ text, status: step.verificationStatus }));
        const anyVisible = provider || items.some(i => i.status === "verified");
        return (
          <div key={step.platform.id} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLOR.line2}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.ink }}>
              {step.platform.platformName}
              {step.platform.releaseYear && (
                <span style={{ color: COLOR.ink3, fontWeight: 500 }}> · {step.platform.releaseYear}</span>
              )}
              {provider && <Badge status={step.verificationStatus} />}
            </div>
            <div style={{ marginTop: 6 }}>
              {anyVisible
                ? <ClaimChips items={items} provider={provider} />
                : <div style={{ fontSize: 12, color: COLOR.ink3 }}>Details pending verification.</div>}
            </div>
            {provider && step.platform.notes && (
              <div style={{ fontSize: 11, color: COLOR.ink3, marginTop: 6 }}>{step.platform.notes}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TierStory({ result, provider }) {
  const td = result.tierDelta;
  if (!td) return null;
  let body;
  if (!td.applicable) {
    const line = {
      "patient-single-level-line":
        "This line came in a single technology level — the platform story above carries the whole comparison.",
      "single-level-recommendation":
        "The recommended line comes in one level, so there is no tier ladder to climb.",
      "unknown-patient-tier":
        "The current devices' technology level isn't on record — set it to complete this part of the story.",
      "no-recommended-tier":
        "Pick a recommended level to complete this part of the story.",
    }[td.reason] || null;
    body = line && <div style={{ fontSize: 13, color: COLOR.ink2 }}>{line}</div>;
  } else if (!td.moved) {
    body = (
      <div style={{ fontSize: 13, color: COLOR.ink2 }}>
        The current devices sat at the same relative level when they were new — the platform
        story above is the whole story.
      </div>
    );
  } else {
    body = (
      <>
        <div style={{ fontFamily: FONT.display, fontSize: 20, fontWeight: 700, color: COLOR.ink }}>
          From {positionPhrase(td.patientPos, td.ladderSize)} to {positionPhrase(td.recPos, td.ladderSize)}
        </div>
        {provider && (
          <div style={{ fontSize: 11, color: COLOR.ink3, marginTop: 4 }}>
            position {td.patientPos} → {td.recPos} of {td.ladderSize}
            {td.viaBase && ` · evaluated on ${td.ladderPlatform.manufacturer} ${td.ladderPlatform.platformName} ladder`}
          </div>
        )}
        {td.gates.map(g => {
          const items = (g.gates || []).map(text => ({ text, status: g.verificationStatus }));
          const anyVisible = provider || items.some(i => i.status === "verified");
          return (
            <div key={g.tier.id} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLOR.line2}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.ink }}>
                At {tierDisplayLabel(g.tier.tierDesignation)}
                {provider && <Badge status={g.verificationStatus} />}
              </div>
              <div style={{ marginTop: 6 }}>
                {anyVisible
                  ? <ClaimChips items={items} provider={provider} />
                  : <div style={{ fontSize: 12, color: COLOR.ink3 }}>Details pending verification.</div>}
              </div>
            </div>
          );
        })}
      </>
    );
  }
  return (
    <div style={{ background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
      padding: 16, marginTop: 16 }}>
      <SectionTitle>The technology level — what the recommended tier unlocks</SectionTitle>
      {body}
    </div>
  );
}

// Cross-brand & OTC: capability categories side by side. Named capabilities
// only — never a spec-number race.
function CategoryGrid({ result, provider }) {
  const cats = result.categories;
  if (!cats) return null;
  const otc = result.mode === "otc";
  const limits = result.patient.platform.notableLimits;
  const limitsVisible = limits && (provider || result.patient.platform.verificationStatus === "verified");
  return (
    <div style={{ background: COLOR.card, border: `1px solid ${COLOR.line}`, borderRadius: 12,
      padding: 16, marginTop: 16 }}>
      <SectionTitle>
        {otc ? "Over-the-counter device vs. prescription device — capability by capability"
             : "Different manufacturers — capability by capability"}
      </SectionTitle>
      {CATEGORY_LABELS.map(([key, label]) => {
        const pItems = cats.patient?.[key] || [];
        const rItems = cats.recommended?.[key] || [];
        const pVisible = pItems.filter(i => provider || i.status === "verified");
        const rVisible = rItems.filter(i => provider || i.status === "verified");
        if (pVisible.length === 0 && rVisible.length === 0) return null;
        return (
          <div key={key} style={{ display: "flex", gap: 16, padding: "12px 0",
            borderTop: `1px solid ${COLOR.line2}` }}>
            <div style={{ flex: "0 0 130px", fontSize: 12, fontWeight: 700, color: COLOR.ink2 }}>{label}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {pVisible.length
                ? <ClaimChips items={pItems.map(i => ({ ...i }))} provider={provider} />
                : <div style={{ fontSize: 12, color: COLOR.ink3 }}>—</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {rVisible.length
                ? <ClaimChips items={rItems.map(i => ({ ...i }))} provider={provider} />
                : <div style={{ fontSize: 12, color: COLOR.ink3 }}>—</div>}
            </div>
          </div>
        );
      })}
      {limitsVisible && (
        <div style={{ fontSize: 12, color: COLOR.ink2, marginTop: 10, paddingTop: 10,
          borderTop: `1px solid ${COLOR.line2}` }}>
          {limits}{provider && <Badge status={result.patient.platform.verificationStatus} />}
        </div>
      )}
    </div>
  );
}

// ── Default recommendation: vertical first ───────────────────────────────────
// The current flagship of the patient's own lineage (resolved through private
// labels), falling back to Signia IX 7IX — the practice's core platform.
function defaultRecommendation(patientPlatform, idx) {
  const pickTop = platform => {
    const ladder = ladderOf(platform, idx);
    return { platformId: platform.id, tierId: ladder[0]?.id || "" };
  };
  if (patientPlatform) {
    const base = resolveBase(patientPlatform, idx);
    const lineage = idx.lineages.get(base.manufacturer) || [];
    const current = [...lineage].reverse().find(p => p.status === CURRENT && ladderOf(p, idx).length > 1)
      || [...lineage].reverse().find(p => p.status === CURRENT);
    if (current) return pickTop(current);
  }
  const signiaIX = idx.platforms.find(p => p.manufacturer === "Signia" && p.platformName === "IX");
  return signiaIX ? pickTop(signiaIX) : { platformId: "", tierId: "" };
}

// ── Main component ───────────────────────────────────────────────────────────
// Minimal prop surface (build brief §6): the patient device reference, the
// recommendation reference, and the provider-mode flag. Everything else is
// internal. patientId lets the component pull the newest fast-path/catalog
// fitting itself so callers don't have to.
export default function CapabilityComparison({
  patientId = null,
  patientDeviceRef = null,     // { platformId, tierId, freetext? }
  recommendationRef = null,    // { platformId, tierId }
  providerMode = false,
  variant = "standalone",
  onClose = null,
}) {
  const [catalog, setCatalog] = useState(null);
  const [patientSel, setPatientSel] = useState(patientDeviceRef || { platformId: "", tierId: "" });
  const [recSel, setRecSel] = useState(recommendationRef || { platformId: "", tierId: "" });
  const [freetext, setFreetext] = useState(patientDeviceRef?.freetext || null);
  const [picker, setPicker] = useState(null); // 'patient' | 'recommended' | null
  const [provider, setProvider] = useState(!!providerMode);

  useEffect(() => {
    let alive = true;
    loadDeviceCatalog().then(c => alive && setCatalog(c)).catch(() => {});
    return () => { alive = false; };
  }, []);

  // No explicit device ref → pull the patient's newest catalog-linked fitting.
  useEffect(() => {
    if (patientDeviceRef || !patientId) return;
    let alive = true;
    loadNewestCatalogFitting(patientId).then(f => {
      if (!alive || !f) return;
      setPatientSel({ platformId: f.platform_id || "", tierId: f.tier_id || "" });
      setFreetext(f.device_freetext || null);
    }).catch(() => {});
    return () => { alive = false; };
  }, [patientId, patientDeviceRef]);

  const idx = useMemo(
    () => catalog ? indexCatalog(catalog.platforms, catalog.tiers) : null,
    [catalog]
  );

  // Default the recommendation once the catalog (and maybe the patient device)
  // are known — never clobber an explicit ref or a provider's pick.
  useEffect(() => {
    if (!idx || recSel.platformId) return;
    const patientPlatform = idx.platformsById.get(patientSel.platformId) || null;
    setRecSel(defaultRecommendation(patientPlatform, idx));
  }, [idx, patientSel.platformId]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => {
    if (!idx) return null;
    return compareDevices({
      patientPlatformId: patientSel.platformId,
      patientTierId: patientSel.tierId,
      recommendedPlatformId: recSel.platformId,
      recommendedTierId: recSel.tierId,
    }, idx);
  }, [idx, patientSel, recSel]);

  const wrap = variant === "standalone"
    ? { maxWidth: 860, margin: "0 auto", padding: "24px 20px" }
    : { padding: 0 };

  if (!catalog) {
    return <div style={{ ...wrap, fontFamily: FONT.ui, color: COLOR.ink3, fontSize: 13 }}>Loading catalog…</div>;
  }

  const patientPlatform = idx.platformsById.get(patientSel.platformId) || null;
  const patientTier = idx.tiersById.get(patientSel.tierId) || null;
  const recPlatform = idx.platformsById.get(recSel.platformId) || null;
  const recTier = idx.tiersById.get(recSel.tierId) || null;

  return (
    <div style={{ fontFamily: FONT.ui, color: COLOR.ink, ...wrap }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: FONT.display, fontSize: 24, fontWeight: 700 }}>What's Changed</div>
          <div style={{ fontSize: 13, color: COLOR.ink2, marginTop: 2 }}>
            What the recommended devices do that the current ones cannot — by platform generation, then by technology level.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setProvider(v => !v)} style={{ background: provider ? COLOR.pine : "transparent",
            color: provider ? "#fff" : COLOR.ink2, border: `1px solid ${provider ? COLOR.pine : COLOR.line}`,
            borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Provider view
          </button>
          {onClose && (
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${COLOR.line}`,
              borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: COLOR.ink2 }}>
              Close
            </button>
          )}
        </div>
      </div>

      {/* Device cards */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        <DeviceCard side="patient" platform={patientPlatform} tier={patientTier} freetext={freetext}
          provider={provider} onChangeClick={() => setPicker(picker === "patient" ? null : "patient")} />
        <DeviceCard side="recommended" platform={recPlatform} tier={recTier}
          provider={provider} onChangeClick={() => setPicker(picker === "recommended" ? null : "recommended")} />
      </div>

      {picker && (
        <div style={{ background: COLOR.paper, border: `1px solid ${COLOR.line}`, borderRadius: 12,
          padding: 14, marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: COLOR.ink, fontSize: 14, marginBottom: 10 }}>
            {picker === "patient" ? "Set the current device" : "Choose the recommended device"}
          </div>
          <DeviceCascade idx={idx}
            value={picker === "patient" ? patientSel : recSel}
            onChange={v => {
              if (picker === "patient") { setPatientSel(v); if (v.platformId) setFreetext(null); }
              else setRecSel(v);
              if (v.tierId) setPicker(null);
            }} />
        </div>
      )}

      {freetext && !patientPlatform && (
        <div style={{ background: COLOR.paper, border: `1px dashed ${COLOR.line}`, borderRadius: 12,
          padding: 16, marginTop: 16, fontSize: 13, color: COLOR.ink2 }}>
          The current device is on record as “{freetext}” but isn't matched to the catalog yet —
          match it above to tell this story. (An unmatchable device is a catalog gap worth logging.)
        </div>
      )}

      {result && (
        <>
          <Spectrum result={result} provider={provider}
            patientLabel={patientPlatform ? patientPlatform.platformName : "Today"}
            recLabel={recPlatform ? recPlatform.platformName : "Recommended"} />
          {(result.mode === "vertical" || result.mode === "same-platform") && (
            <GenerationStory result={result} provider={provider} />
          )}
          {(result.mode === "cross-brand" || result.mode === "otc") && (
            <CategoryGrid result={result} provider={provider} />
          )}
          <TierStory result={result} provider={provider} />
        </>
      )}

      {!result && !freetext && (
        <div style={{ background: COLOR.paper, border: `1px dashed ${COLOR.line}`, borderRadius: 12,
          padding: 24, marginTop: 16, textAlign: "center", color: COLOR.ink2, fontSize: 13 }}>
          Set the current device to tell the story.
        </div>
      )}

      {/* Honesty footnote */}
      <div style={{ fontSize: 11, color: COLOR.ink3, marginTop: 18, paddingTop: 12,
        borderTop: `1px solid ${COLOR.line}`, lineHeight: 1.5 }}>
        Capabilities shown are the manufacturers' own published feature names, drawn from
        spec sheets and product guides. Where something couldn't be confirmed against a
        source, it isn't shown here.
      </div>
    </div>
  );
}
