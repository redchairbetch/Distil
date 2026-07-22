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

import React, { useMemo, useState } from "react";
import { HA_CATALOG, HA_CATALOG_META, COSTCO_TIMELINE } from "../hearing_aid_catalog_data.js";

// Market Catalog: read-only reference view over the full US hearing aid market
// (Big Five private practice + Costco channel + UHCH private label, ~3
// generations). Not admin-gated — its everyday job is chairside: identifying
// what a walk-in patient currently wears and knowing the Costco competition
// cold. Pure static data (src/hearing_aid_catalog_data.js) — nothing here
// feeds pricing, the device cascade, or the old-vs-new comparator.

const CHANNELS = ["Private Practice", "Costco", "Private Label"];

const STATUS_CHIP = {
  current: { label: "Current", color: "#0e7490", bg: "#ecfeff" },
  legacy: { label: "Legacy", color: "#b45309", bg: "#fef3c7" },
  discontinued: { label: "Discontinued", color: "#6b7280", bg: "#f3f4f6" },
};

// Big Five first (the brands MHC actually competes with head-on), then the
// Costco/private-label brands in the order they appear in the sheet.
const BRAND_PRIORITY = ["Signia", "Starkey", "ReSound", "Phonak", "Oticon"];

export default function HearingAidCatalog() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [brand, setBrand] = useState("all");
  const [status, setStatus] = useState("all");
  const [showTimeline, setShowTimeline] = useState(false);

  const brands = useMemo(() => {
    const set = new Set(
      HA_CATALOG.filter((r) => channel === "all" || r.channel === channel).map((r) => r.brand)
    );
    return [...set].sort((a, b) => {
      const pa = BRAND_PRIORITY.indexOf(a), pb = BRAND_PRIORITY.indexOf(b);
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      return a.localeCompare(b);
    });
  }, [channel]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return HA_CATALOG.filter((r) =>
      (channel === "all" || r.channel === channel) &&
      (brand === "all" || r.brand === brand) &&
      (status === "all" || r.statusKind === status) &&
      (!q ||
        [r.model, r.family, r.platform, r.brand, r.bodyStyle, r.techLevels, r.keyFeatures]
          .some((f) => f.toLowerCase().includes(q))));
  }, [search, channel, brand, status]);

  // Group by brand for section headers; within a brand the sheet is already
  // ordered newest generation first, so row order is preserved.
  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.brand)) map.set(r.brand, []);
      map.get(r.brand).push(r);
    });
    return [...map.entries()];
  }, [rows]);

  const pillStyle = (active) => ({
    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "'Sora',sans-serif", border: "1px solid " + (active ? "#0a1628" : "#e5e7eb"),
    background: active ? "#0a1628" : "#fff", color: active ? "#fff" : "#374151",
  });

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Market Catalog</div>
          <div className="topbar-sub">
            US hearing aids · Big Five + Costco · {HA_CATALOG.length} models across ~3 generations · reference only — quoting stays in the device cascade
          </div>
        </div>
      </div>

      <div className="content">
        {/* Filters */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model, family, platform, feature… (e.g. KS10, Lumity, Auracast)"
            style={{ flex: "1 1 260px", maxWidth: 360, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontFamily: "'Sora',sans-serif", fontSize: 13, outline: "none" }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={pillStyle(channel === "all")} onClick={() => { setChannel("all"); setBrand("all"); }}>All channels</button>
            {CHANNELS.map((c) => (
              <button key={c} style={pillStyle(channel === c)} onClick={() => { setChannel(channel === c ? "all" : c); setBrand("all"); }}>{c}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(STATUS_CHIP).map(([k, s]) => (
              <button key={k} style={{ ...pillStyle(status === k), ...(status === k ? { background: s.color, borderColor: s.color } : {}) }}
                onClick={() => setStatus(status === k ? "all" : k)}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <button style={pillStyle(brand === "all")} onClick={() => setBrand("all")}>All brands</button>
          {brands.map((b) => (
            <button key={b} style={pillStyle(brand === b)} onClick={() => setBrand(brand === b ? "all" : b)}>{b}</button>
          ))}
        </div>

        {/* Costco channel history — collapsed accordion; the timeline explains
            why KS wearers can't be serviced at Costco anymore. */}
        {(channel === "all" || channel === "Costco") && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
            <div onClick={() => setShowTimeline(!showTimeline)}
              style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1628" }}>
                Costco channel history 2019–2026
                <span style={{ fontWeight: 500, color: "#6b7280", marginLeft: 8, fontSize: 12 }}>
                  who sold what, when, and why they left — incl. the end of Kirkland
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{showTimeline ? "▲ collapse" : "▼ expand"}</span>
            </div>
            {showTimeline && COSTCO_TIMELINE.map((t) => (
              <div key={t.brand} style={{ padding: "9px 14px", borderTop: "1px solid #f3f4f6", display: "grid", gridTemplateColumns: "230px 170px 1fr", gap: 12, fontSize: 12.5, alignItems: "start" }}>
                <div style={{ fontWeight: 600, color: "#0a1628" }}>{t.brand}</div>
                <div style={{ color: "#6b7280" }}>{t.period}</div>
                <div style={{ color: "#374151", lineHeight: 1.5 }}>{t.notes}</div>
              </div>
            ))}
          </div>
        )}

        {rows.length === 0 && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "22px 14px", fontSize: 13, color: "#6b7280" }}>
            No devices match. Clear the search or filters.
          </div>
        )}

        {grouped.map(([b, models]) => (
          <div key={b} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "4px 2px 8px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0a1628" }}>{b}</div>
              <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{models[0].mfgGroup} · {models.length} model{models.length === 1 ? "" : "s"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 10 }}>
              {models.map((r) => {
                const chip = STATUS_CHIP[r.statusKind];
                return (
                  <div key={r.brand + r.model + r.bodyStyle} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", gap: 12 }}>
                    {r.imageUrl && (
                      <img src={r.imageUrl} alt={r.model} loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, background: "#f9fafb", flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0a1628" }}>{r.model}</span>
                        <span title={r.status} style={{ fontSize: 10, fontWeight: 700, color: chip.color, background: chip.bg, borderRadius: 10, padding: "1px 7px" }}>{chip.label}</span>
                        {r.verifyFlag && (
                          <span title={r.notes} style={{ fontSize: 10, fontWeight: 700, color: "#b45309", background: "#fef3c7", borderRadius: 10, padding: "1px 7px" }}>VERIFY</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                        {r.platform} · {r.releaseYear}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#374151", marginTop: 3, lineHeight: 1.45 }}>{r.bodyStyle}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                        Tech levels: <span style={{ color: "#374151", fontWeight: 600 }}>{r.techLevels}</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: r.rechargeable === "no" ? "#9ca3af" : "#0e7490", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 10, padding: "1px 7px" }}>
                          {r.rechargeable === "both" ? "Rechargeable + battery" : r.rechargeable === "yes" ? "Rechargeable" : "Disposable battery"}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: r.bluetooth === "yes" ? "#0e7490" : "#9ca3af", background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 10, padding: "1px 7px" }}>
                          {r.bluetooth === "yes" ? "Bluetooth" : "No Bluetooth"}
                        </span>
                        {r.channel !== "Private Practice" && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#7c3aed", background: "#f5f3ff", borderRadius: 10, padding: "1px 7px" }}>{r.channel}</span>
                        )}
                      </div>
                      <FeatureText text={r.keyFeatures} />
                      {r.sourceUrl && (
                        <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 4, display: "inline-block" }}>source ↗</a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10, lineHeight: 1.6 }}>
          Source: {HA_CATALOG_META.source}, compiled {HA_CATALOG_META.compiled} from manufacturer sites, press releases,
          HearingTracker, Soundly, Hearing Review, and FDA GUDID listings. Entries flagged VERIFY carry lower confidence
          (exact launch months, tech-level spreads on brand-new models). Images hotlink manufacturer CDNs and may
          occasionally fail to load.
        </div>
      </div>
    </>
  );
}

// Key-features strings run long; clamp to two lines with tap-to-expand so the
// card grid stays scannable.
function FeatureText({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div onClick={() => setOpen(!open)} title={open ? "" : "tap to expand"}
      style={{
        fontSize: 11, color: "#6b7280", marginTop: 6, lineHeight: 1.5, cursor: "pointer",
        ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }),
      }}>
      {text}
    </div>
  );
}
