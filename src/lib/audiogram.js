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

// Tested No Loss (TNL) detection. Domain rule: normal hearing threshold is
// 20 dB (NOT 25). A visit qualifies for the TNL path when both ears were
// tested and every entered air-conduction threshold sits at or under that
// line. This only ever SUGGESTS the path — the provider confirms, because
// thresholds alone can't rule out a red flag (poor word recognition,
// asymmetry, medical history).

export const NORMAL_HEARING_MAX_DB = 20;

// Entered thresholds only — an empty string or null cell means "not tested
// at this frequency", not "normal". Non-numeric junk disqualifies rather
// than passes, so a data-entry glitch can never manufacture a TNL suggestion.
function enteredThresholds(ear) {
  if (!ear || typeof ear !== "object") return [];
  return Object.values(ear)
    .filter(v => v !== null && v !== undefined && v !== "")
    .map(Number);
}

// audiology is the wizard's form.audiology shape; rightT/leftT are the
// air-conduction threshold maps keyed by frequency.
export function isTestedNoLoss(audiology) {
  if (!audiology) return false;
  const right = enteredThresholds(audiology.rightT);
  const left = enteredThresholds(audiology.leftT);
  if (!right.length || !left.length) return false; // both ears must be tested
  return [...right, ...left].every(v => Number.isFinite(v) && v <= NORMAL_HEARING_MAX_DB);
}

// The annual-retest recall a TNL close schedules: today + 12 months, built in
// local time (same UTC-parse guard as lib/careArc.js — toISOString on a
// UTC-midnight date can render a day early in US timezones).
export const TNL_RETEST_TYPE = "Annual Hearing Retest";
export const TNL_RETEST_NOTE =
  "Baseline within normal limits at last test — annual monitoring retest to track any change year over year.";

export function buildTnlRetestAppointment(fromDate = new Date()) {
  const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  d.setFullYear(d.getFullYear() + 1);
  const pad = n => String(n).padStart(2, "0");
  return {
    type: TNL_RETEST_TYPE,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    note: TNL_RETEST_NOTE,
  };
}


// ── AUDIOGRAM METRICS ────────────────────────────────────────────────────────
// PTA / slope / worst-threshold helpers + the roster audiogram summary line.
// Extracted verbatim from Distil.jsx (backlog #40a — monolith decomposition).
export const AUDIG_FREQS = [250,500,750,1000,1500,2000,3000,4000,6000,8000];
// Canonical clinical PTA: 500/1k/2k. Inter-octaves (750/1500) never enter it.
export function getPTA(t){
  const fs=[500,1000,2000];
  const v=fs.map(f=>t?.[f]).filter(x=>x!=null);
  return v.length?Math.round(v.reduce((a,b)=>a+b)/v.length):null;
}
// Four-frequency PTA (adds 4k) — shown alongside canonical PTA, labeled PTA4.
export function getPTA4(t){
  const fs=[500,1000,2000,4000];
  const v=fs.map(f=>t?.[f]).filter(x=>x!=null);
  return v.length?Math.round(v.reduce((a,b)=>a+b)/v.length):null;
}
export function getSlope(t){
  if(!t||t[500]==null||t[4000]==null)return"";
  return(t[4000]-t[500])>30?"sloping":(t[4000]-t[500])<-10?"rising":"flat";
}


// ── WORST-THRESHOLD SEVERITY (Change 4) ──────────────────────────────────────
export function getWorstThresholdSeverity(thresholds){
  if(!thresholds)return null;
  const vals=Object.values(thresholds).filter(v=>v!=null);
  if(!vals.length)return null;
  const worst=Math.max(...vals);
  if(worst<=20)return"Normal"; if(worst<=40)return"Mild";
  if(worst<=55)return"Moderate"; if(worst<=70)return"Moderately Severe";
  if(worst<=90)return"Severe"; return"Profound";
}
export function getWorstThreshold(thresholds){
  if(!thresholds)return null;
  const vals=Object.values(thresholds).filter(v=>v!=null);
  return vals.length?Math.max(...vals):null;
}

export const summarizeAudiogram = (p) => {
  if (!p.audiology) return null;
  const { rightT, leftT } = p.audiology;
  const avgThreshold = (ear) => {
    if (!ear) return null;
    const freqs = [1000, 2000, 4000];
    const vals = freqs.map(f => ear[f]).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const classify = (avg) => {
    if (avg === null) return "\u2014";
    if (avg <= 25) return "Normal";
    if (avg <= 40) return "Mild";
    if (avg <= 55) return "Moderate";
    if (avg <= 70) return "Mod-Severe";
    if (avg <= 90) return "Severe";
    return "Profound";
  };
  const rAvg = avgThreshold(rightT);
  const lAvg = avgThreshold(leftT);
  const wrsR = p.audiology.unaidedR ? `${p.audiology.unaidedR}%` : "\u2014";
  const wrsL = p.audiology.unaidedL ? `${p.audiology.unaidedL}%` : "\u2014";
  return {
    severity: `${classify(rAvg)} R \u00B7 ${classify(lAvg)} L`,
    wrs: `WRS ${wrsR} R / ${wrsL} L`,
  };
};
