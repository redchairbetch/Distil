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

// ── Coverage bars — shared listening-environment performance chart ───────────
// The per-environment coverage bars first built into the Technology Tier step
// (views/TierSelection.jsx), lifted here so the Device Selection screen can
// surface the same comparison next to price + recommendation.
// (context.md Distil #25: "Reuse the environment data from TierSelection.jsx.")
//
// Single source for the red→green gradient so the two screens can't drift.
// Colors come from the Clinical-luxe tokens (src/theme.js); the bar fill is a
// fixed semantic gradient and intentionally theme-independent.
import { COLOR } from "../theme.js";
import { ENVIRONMENTS, COVERAGE_BY_RANK } from "../listeningSituations.js";

// Red (≤50%) → Yellow (75%) → Green (100%) gradient. Linear RGB
// interpolation between anchors so adjacent percentages read as
// distinct shades — easier to scan than a 4-bucket palette.
export function coverageColor(pct) {
  const RED = [220, 38, 38];   // #dc2626
  const YEL = [234, 179, 8];   // #eab308
  const GRN = [22, 163, 74];   // #16a34a
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const mix = (c1, c2, t) =>
    `rgb(${lerp(c1[0], c2[0], t)}, ${lerp(c1[1], c2[1], t)}, ${lerp(c1[2], c2[2], t)})`;
  if (pct <= 50) return `rgb(${RED.join(",")})`;
  if (pct >= 100) return `rgb(${GRN.join(",")})`;
  if (pct <= 75) return mix(RED, YEL, (pct - 50) / 25);
  return mix(YEL, GRN, (pct - 75) / 25);
}

// A single environment row: label · gradient bar · percentage. `prominent`
// is used for the patient's own flagged environments (larger, darker).
export function CoverageRow({ label, pct, prominent = false }) {
  const fillColor = coverageColor(pct);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, fontSize: prominent ? 12 : 11 }}>
      <div style={{ flex:1, color: prominent ? COLOR.ink : COLOR.ink2, fontWeight: prominent ? 600 : 500 }}>
        {label}
      </div>
      <div style={{ flex:"0 0 70px", height:6, background:COLOR.line, borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:fillColor, transition:"width 0.2s" }} />
      </div>
      <div style={{ flex:"0 0 32px", textAlign:"right", fontSize:10, color: prominent ? COLOR.ink : COLOR.ink3, fontWeight:600 }}>
        {pct}%
      </div>
    </div>
  );
}

// The full per-tier coverage chart: the patient's flagged ("most challenging")
// environments first, then everything else. `rank` is an engine tier rank
// (5/3/1/0/-1); `flagged` is a Set of environment ids from
// flaggedEnvironments(). Renders nothing when the rank has no coverage map.
export function EnvironmentCoverage({ rank, flagged }) {
  const coverage = rank != null ? COVERAGE_BY_RANK[rank] : null;
  if (!coverage) return null;

  const hasFlagged = flagged && flagged.size > 0;
  const flaggedEnvs = hasFlagged ? ENVIRONMENTS.filter(e => flagged.has(e.id)) : [];
  const otherEnvs   = hasFlagged ? ENVIRONMENTS.filter(e => !flagged.has(e.id)) : ENVIRONMENTS;

  return (
    <div>
      {flaggedEnvs.length > 0 && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:COLOR.tealInk, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
            Your most challenging environments
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 }}>
            {flaggedEnvs.map(env => (
              <CoverageRow key={env.id} label={env.label} pct={coverage[env.id]} prominent />
            ))}
          </div>
        </>
      )}
      <div style={{ fontSize:10, fontWeight:700, color:COLOR.ink2, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
        {flaggedEnvs.length > 0 ? "Other environments" : "All listening environments"}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {otherEnvs.map(env => (
          <CoverageRow key={env.id} label={env.label} pct={coverage[env.id]} />
        ))}
      </div>
    </div>
  );
}
