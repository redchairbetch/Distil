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

// Body-style picker — the patient-facing opener of Device Selection, now a
// forked path (Kurt, 2026-08-29): Behind The Ear vs In The Ear, then the
// coupling family (RIC/RIE/miniRITE vs Traditional BTE; Instant Fit vs
// Custom Molded), then the style cards themselves. The taxonomy lives in
// catalogConstants.js (STYLE_CATEGORIES / STYLE_SUBCATEGORIES) keyed by the
// same style ids both catalogs use, so the TruHearing flow's tier-scoped
// subset prunes branches automatically. One click on a style still seeds
// BOTH ears; the per-ear cascades keep their compact "Change" escape hatch
// for CROS and asymmetric fits. Style-card images cycle packshot ↔ on-ear
// photo via side arrows (onEarImageUrl).

import React, { useEffect, useMemo, useState } from "react";
import {
  BODY_STYLE_STATS, STAT_KEYS, recommendBodyStyles,
} from "../lib/bodyStyleRec.js";
import {
  STYLE_CATEGORIES, STYLE_SUBCATEGORIES, STYLE_BRANCH, onEarImageUrl,
} from "../lib/catalogConstants.js";

const STATUS_PILL = {
  recommended: { background: "#ecfdf5", border: "#bbf7d0", color: "#15803d" },
  caution:     { background: "#fef9c3", border: "#fde047", color: "#854d0e" },
  blocked:     { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
};

// Roll the engine's per-style annotations up to a branch (category or
// subcategory): blocked only when every leaf is blocked, recommended when any
// leaf is, caution when any leaf is. Badge text borrows the deciding leaf's.
function aggregateAnn(leafAnns) {
  const anns = leafAnns.filter(Boolean);
  if (!anns.length) return null;
  if (anns.every(a => a.status === "blocked")) {
    return { status: "blocked", badge: anns.find(a => a.badge)?.badge || "Not a match today" };
  }
  const rec = anns.find(a => a.status === "recommended");
  if (rec) return { status: "recommended", badge: rec.badge || "Recommended" };
  const caut = anns.find(a => a.status === "caution" && a.badge);
  if (caut) return { status: "caution", badge: caut.badge };
  return null;
}

function Pill({ ann }) {
  const pill = ann && ann.badge ? STATUS_PILL[ann.status] : null;
  if (!pill) return null;
  return (
    <div style={{
      margin: "8px auto 0", width: "fit-content", maxWidth: "100%",
      background: pill.background, border: `1px solid ${pill.border}`, color: pill.color,
      borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {ann.badge}
    </div>
  );
}

function StatBar({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 9.5, color: "#9AA39B", width: 76, flexShrink: 0, textAlign: "right", lineHeight: 1.2 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 2, flex: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{
            height: 5, flex: 1, borderRadius: 2,
            background: i <= value ? "#0B4A42" : "#EAE6DA",
          }} />
        ))}
      </div>
    </div>
  );
}

// Packshot ↔ on-ear carousel. Arrows only render with 2+ images and swallow
// the click so they never select the card underneath.
function ImageCarousel({ images, alt, blocked }) {
  const [idx, setIdx] = useState(0);
  const safeIdx = images.length ? idx % images.length : 0;
  const step = (e, delta) => {
    e.stopPropagation();
    setIdx((safeIdx + delta + images.length) % images.length);
  };
  if (!images.length) {
    return (
      <div style={{ width: 72, height: 72, margin: "0 auto 8px", borderRadius: 10, background: "#F0EDE3",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9AA39B" }}>
        photo soon
      </div>
    );
  }
  const onEarShot = safeIdx > 0; // index 0 is always the packshot
  const arrowStyle = (side) => ({
    position: "absolute", top: "50%", [side]: 2, transform: "translateY(-50%)",
    width: 20, height: 20, borderRadius: "50%", border: "1px solid #E4E0D5",
    background: "rgba(255,255,255,0.92)", color: "#0B4A42", fontSize: 11, fontWeight: 800,
    lineHeight: "18px", textAlign: "center", cursor: "pointer", padding: 0, zIndex: 1,
  });
  return (
    <div style={{ position: "relative", margin: "0 auto 8px", width: "100%", maxWidth: 150 }}>
      <img src={images[safeIdx]} alt={onEarShot ? `${alt} worn on the ear` : alt}
        style={{
          display: "block", margin: "0 auto", width: onEarShot ? "100%" : 72, height: 72,
          objectFit: onEarShot ? "cover" : "contain", borderRadius: onEarShot ? 8 : 0,
          filter: blocked ? "grayscale(1)" : "none",
        }} />
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => step(e, -1)} style={arrowStyle("left")}>‹</button>
          <button type="button" aria-label="Next photo" onClick={(e) => step(e, 1)} style={arrowStyle("right")}>›</button>
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 4 }}>
            {images.map((_, i) => (
              <span key={i} style={{ width: 5, height: 5, borderRadius: "50%",
                background: i === safeIdx ? "#0B4A42" : "#D8D3C6" }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Fork cards — one component for both fork levels (category + subcategory).
function BranchCard({ label, desc, img, imgCover, ann, selected, dimmed, onClick }) {
  const blocked = ann?.status === "blocked";
  return (
    <div
      onClick={blocked ? undefined : onClick}
      style={{
        flex: "1 1 220px", minWidth: 200, maxWidth: 380,
        border: `2px solid ${selected ? "#0B4A42" : ann?.status === "recommended" ? "#1B8A7A" : "#E4E0D5"}`,
        borderRadius: 12, padding: "14px 16px",
        background: selected ? "#FBF9F3" : "#fff",
        cursor: blocked ? "not-allowed" : "pointer",
        opacity: blocked ? 0.55 : dimmed ? 0.6 : 1,
        boxShadow: selected ? "0 4px 14px rgba(11,74,66,0.12)" : "0 1px 2px rgba(0,0,0,0.03)",
        transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
        position: "relative", textAlign: "center",
      }}
    >
      {img && (
        <img src={img} alt="" aria-hidden="true"
          style={{ display: "block", margin: "0 auto 10px",
            width: imgCover ? "100%" : 64, height: imgCover ? 96 : 64,
            objectFit: imgCover ? "cover" : "contain", borderRadius: imgCover ? 8 : 0,
            filter: blocked ? "grayscale(1)" : "none" }} />
      )}
      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0a1628" }}>{label}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
      <Pill ann={ann} />
      {selected && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%",
          background: "#0B4A42", color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: "18px", textAlign: "center" }}>
          ✓
        </div>
      )}
    </div>
  );
}

function StyleCard({ style, ann, selected, onSelect }) {
  const blocked = ann?.status === "blocked";
  const stats = BODY_STYLE_STATS[style.id];
  const images = [style.img, onEarImageUrl(style.id)].filter(Boolean);
  return (
    <div
      onClick={blocked ? undefined : onSelect}
      title={blocked ? ann.notes[0] : undefined}
      style={{
        flex: "1 1 150px", minWidth: 140, maxWidth: 240, position: "relative",
        border: `2px solid ${selected ? "#0B4A42" : ann?.status === "recommended" ? "#1B8A7A" : "#E4E0D5"}`,
        borderRadius: 12, padding: "14px 12px 12px",
        background: selected ? "#FBF9F3" : "#fff",
        cursor: blocked ? "not-allowed" : "pointer",
        opacity: blocked ? 0.55 : 1,
        boxShadow: selected ? "0 4px 14px rgba(11,74,66,0.12)" : "0 1px 2px rgba(0,0,0,0.03)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <ImageCarousel images={images} alt={style.label} blocked={blocked} />
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0a1628", textAlign: "center" }}>{style.label}</div>
      <div style={{ fontSize: 10.5, color: "#6b7280", textAlign: "center", marginTop: 2, lineHeight: 1.35 }}>{style.desc}</div>
      <Pill ann={ann} />
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {STAT_KEYS.map((k) => <StatBar key={k.id} label={k.label} value={stats?.[k.id] ?? 0} />)}
      </div>
      {selected && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%",
          background: "#0B4A42", color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: "18px", textAlign: "center" }}>
          ✓
        </div>
      )}
    </div>
  );
}

export default function BodyStylePicker({ styles, selectedId, onSelect, audiology, subtitle }) {
  const rec = useMemo(() => recommendBodyStyles(audiology), [audiology]);
  const selectedStyle = styles.find((s) => s.id === selectedId) || null;
  const selectedAnn = selectedId ? rec.byStyle[selectedId] : null;

  // Branches available given the (possibly tier-scoped) styles prop. A
  // subcategory with no styles present disappears; a category with no
  // subcategories left disappears with it.
  const availableIds = useMemo(() => new Set(styles.map((s) => s.id)), [styles]);
  const subs = useMemo(
    () => STYLE_SUBCATEGORIES
      .map(sub => ({ ...sub, styleIds: sub.styleIds.filter(id => availableIds.has(id)) }))
      .filter(sub => sub.styleIds.length > 0),
    [availableIds]
  );
  const categories = useMemo(
    () => STYLE_CATEGORIES.filter(cat => subs.some(sub => sub.categoryId === cat.id)),
    [subs]
  );

  // Fork state. Follows an external selection (draft restore, per-ear Change
  // chips) so the open branch always contains the selected style.
  const [categoryId, setCategoryId] = useState(() => selectedId ? STYLE_BRANCH[selectedId]?.categoryId ?? null : null);
  const [subId, setSubId] = useState(() => selectedId ? STYLE_BRANCH[selectedId]?.id ?? null : null);
  useEffect(() => {
    if (!selectedId) return;
    const branch = STYLE_BRANCH[selectedId];
    if (branch) { setCategoryId(branch.categoryId); setSubId(branch.id); }
  }, [selectedId]);
  // A lone surviving category (e.g. a TruHearing tier with no customs) skips
  // its fork level entirely.
  useEffect(() => {
    if (!categoryId && categories.length === 1) setCategoryId(categories[0].id);
  }, [categoryId, categories]);

  const categorySubs = subs.filter(sub => sub.categoryId === categoryId);
  const activeSub = categorySubs.find(sub => sub.id === subId) || null;
  const leafStyles = activeSub ? styles.filter(s => activeSub.styleIds.includes(s.id)) : [];

  const pickCategory = (cat) => {
    setCategoryId(cat.id);
    const catSubs = subs.filter(sub => sub.categoryId === cat.id);
    setSubId(catSubs.length === 1 ? catSubs[0].id : null);
  };
  const pickSub = (sub) => {
    setSubId(sub.id);
    // One-style branches (RIC family, Traditional BTE, Instant Fit) choose
    // for you — same single click a flat card used to be.
    if (sub.styleIds.length === 1 && rec.byStyle[sub.styleIds[0]]?.status !== "blocked") {
      onSelect(sub.styleIds[0]);
    }
  };

  const annForSub = (sub) => aggregateAnn(sub.styleIds.map(id => rec.byStyle[id]));
  const annForCategory = (cat) =>
    aggregateAnn(subs.filter(sub => sub.categoryId === cat.id)
      .flatMap(sub => sub.styleIds.map(id => rec.byStyle[id])));

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0a1628" }}>Choose a style together</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {subtitle || "One choice sets both ears — either ear can be changed on its own below."}
        </div>
      </div>

      {/* Narratable engine banner — "From today's test results…" */}
      {rec.summary && (
        <div style={{ background: "#E7F1EE", borderLeft: "4px solid #1B8A7A", borderRadius: 6,
          padding: "10px 14px", margin: "10px 0 0", fontSize: 12.5, color: "#16201D", lineHeight: 1.5 }}>
          {rec.summary}
        </div>
      )}

      {/* Fork 1 — where the device lives */}
      {categories.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {categories.map((cat) => (
            <BranchCard
              key={cat.id}
              label={cat.label}
              desc={cat.desc}
              img={onEarImageUrl(cat.onEarStyleId)}
              imgCover
              ann={annForCategory(cat)}
              selected={categoryId === cat.id}
              dimmed={!!categoryId && categoryId !== cat.id}
              onClick={() => pickCategory(cat)}
            />
          ))}
        </div>
      )}

      {/* Fork 2 — coupling family within the chosen half */}
      {categoryId && categorySubs.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {categorySubs.map((sub) => {
            const repStyle = styles.find(s => sub.styleIds.includes(s.id));
            return (
              <BranchCard
                key={sub.id}
                label={sub.label}
                desc={sub.desc}
                img={repStyle?.img || null}
                ann={annForSub(sub)}
                selected={subId === sub.id}
                dimmed={!!subId && subId !== sub.id}
                onClick={() => pickSub(sub)}
              />
            );
          })}
        </div>
      )}

      {/* The style cards for the open branch */}
      {activeSub && leafStyles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {leafStyles.map((s) => (
            <StyleCard
              key={s.id}
              style={s}
              ann={rec.byStyle[s.id]}
              selected={selectedId === s.id}
              onSelect={() => onSelect(s.id)}
            />
          ))}
        </div>
      )}

      {/* Detail panel — full sentences for whatever's selected */}
      {selectedStyle && (
        <div style={{ marginTop: 12, background: "#FBF9F3", border: "1px solid #E4E0D5", borderRadius: 10,
          padding: "12px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0B4A42", marginBottom: 4 }}>
            {selectedStyle.label} — {selectedStyle.desc}
          </div>
          <div style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.55 }}>
            {selectedAnn && selectedAnn.notes.length > 0
              ? selectedAnn.notes.join(" ")
              : "Today's test results place no restriction on this style — the fit can follow comfort, dexterity, and how visible the patient wants it to be."}
          </div>
        </div>
      )}
    </div>
  );
}
