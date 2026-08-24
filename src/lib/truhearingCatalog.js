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

// TruHearing device-configuration tables. Extracted verbatim from Distil.jsx
// (backlog #40a — monolith decomposition).

import imgRIC from "../assets/body-styles/RIC.png";
import imgBTE from "../assets/body-styles/bte.png";
import imgITE from "../assets/body-styles/ITE.png";
import imgITC from "../assets/body-styles/ITC.png";
import imgCIC from "../assets/body-styles/cic.png";
import imgIIC from "../assets/body-styles/IIC.png";

// ── TRUHEARING DEVICE CONFIG ──────────────────────────────────────────────────
// Encodes the TruHearing website's model/tier/style availability, gain/matrix
// options, color schemes, battery types, and dome options. Drives the private-label
// cascade in Step 3 to mirror the TruHearing ordering portal exactly.

export const TH_STYLES = [
  { id:"if",     label:"IF (Instant Fit)" },
  { id:"iic",    label:"IIC (Invisible In the Canal)" },
  { id:"cic",    label:"CIC (Completely In the Canal)" },
  { id:"itc",    label:"ITC (In The Canal)" },
  { id:"hs",     label:"HS (Half Shell)" },
  { id:"fs",     label:"FS (Full Shell)" },
  { id:"s_bte",  label:"S BTE (Standard Behind The Ear)" },
  { id:"p_bte",  label:"P BTE (Power Behind The Ear)" },
  { id:"sp_bte", label:"SP BTE (Super Power Behind The Ear)" },
  { id:"ric",    label:"RIC (Receiver In Canal)" },
  { id:"ric_bct",label:"RIC + BCT" },
  { id:"sr",     label:"SR (Slim RIC)" },
];

// Body-style categories for the TH card picker. Borrows private-pay imagery
// (BODY_STYLE_IMG). IF uses the IIC image. Each category maps to one or more
// specific TH_STYLES ids — when multiple, a Variant sub-picker appears after Model.
export const TH_BODY_STYLES = [
  { id:"ric", label:"RIC", desc:"Receiver-in-canal · Most popular", img:imgRIC, thStyleIds:["ric","ric_bct","sr"] },
  { id:"bte", label:"BTE", desc:"Behind-the-ear · Maximum power",    img:imgBTE, thStyleIds:["s_bte","p_bte","sp_bte"] },
  { id:"ite", label:"ITE", desc:"In-the-ear · Full / half shell",    img:imgITE, thStyleIds:["hs","fs"] },
  { id:"itc", label:"ITC", desc:"In-the-canal · Half shell",         img:imgITC, thStyleIds:["itc"] },
  { id:"cic", label:"CIC", desc:"Completely-in-canal",                img:imgCIC, thStyleIds:["cic"] },
  { id:"iic", label:"IIC", desc:"Invisible-in-canal",                 img:imgIIC, thStyleIds:["iic"] },
  { id:"if",  label:"IF",  desc:"Instant Fit",                        img:imgIIC, thStyleIds:["if"] },
];
export const TH_STYLE_TO_BODY = Object.fromEntries(
  TH_BODY_STYLES.flatMap(b => b.thStyleIds.map(sid => [sid, b.id]))
);

// The model NUMBER is the platform generation (TH7 = Signia IX, TH6 = AX,
// TH5 = X) — NOT a technology level. The tech level is the plan tier
// (Premium/Advanced/Standard ≈ Signia's 7/5/3 prefix), chosen in the
// Technology Tier step. "TruHearing 7 Li Premium" ≈ Signia Pure Charge&Go
// 7IX. The two axes are orthogonal — never collapse the model pick into
// the tier pick.
export const TH_MODELS = [
  { id:"th7",   label:"TruHearing 7",    li:false, series:"TH7", platform:"IX" },
  { id:"th7li", label:"TruHearing 7 Li", li:true,  series:"TH7", platform:"IX" },
  { id:"th6",   label:"TruHearing 6",    li:false, series:"TH6", platform:"AX" },
  { id:"th6li", label:"TruHearing 6 Li", li:true,  series:"TH6", platform:"AX" },
  { id:"th5",   label:"TruHearing 5",    li:false, series:"TH5", platform:"X"  },
  { id:"th5li", label:"TruHearing 5 Li", li:true,  series:"TH5", platform:"X"  },
];
// Patient-facing subtitle for the model pills — names the platform axis so
// the number doesn't read as a Signia-style "7 = top tier" tech level.
export const TH_PLATFORM_NOTE = {
  IX: "IX platform · newest generation",
  AX: "AX platform",
  X:  "X platform",
};

// model|techLevel → [style IDs]. Deliberately many-to-many: the model is the
// platform generation, the techLevel is the plan tier, and most combinations
// exist (th7|Standard customs, th6|Premium RIC). th5li BTE is listed under
// every tier — TH5 BTE is always available regardless of plan tier
// (non-negotiable domain rule; the plan price covers whatever is fitted).
export const TH_AVAILABILITY = {
  "th7|Standard":   ["iic","cic"],
  "th7|Advanced":   ["cic","itc","hs","fs"],
  "th7|Premium":    ["iic","cic","itc","hs","fs"],
  "th7li|Advanced": ["ric","ric_bct"],
  "th7li|Premium":  ["ric","ric_bct","sr","if"],
  "th6|Standard":   ["ric"],
  "th6|Advanced":   ["ric"],
  "th6|Premium":    ["ric"],
  "th6li|Advanced": ["itc","hs","fs"],
  "th6li|Premium":  ["itc","hs","fs","sr"],
  "th5|Premium":    ["if"],
  "th5li|Standard": ["s_bte","p_bte","sp_bte"],
  "th5li|Advanced": ["s_bte","p_bte","sp_bte"],
  "th5li|Premium":  ["s_bte","p_bte","sp_bte"],
};

// model+style → gain/matrix options; earmold:true means HP encased earmold
export const TH_GAIN_MATRIX = {
  "th7|iic":       [{id:"113/50 (S)", label:"113/50 (S)"}],
  "th7|cic":       [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7|itc":       [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7|hs":        [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7|fs":        [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th7li|ric":     [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"},{id:"131/75 (HP)", label:"131/75 (HP)", earmold:true}],
  "th7li|ric_bct": [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"},{id:"131/75 (HP)", label:"131/75 (HP)", earmold:true}],
  "th7li|sr":      [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"}],
  "th7li|if":      [{id:"114/50", label:"114/50"}],
  "th6|ric":       [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"},{id:"131/75 (HP)", label:"131/75 (HP)", earmold:true}],
  "th6li|itc":     [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th6li|hs":      [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th6li|fs":      [{id:"113/50 (S)", label:"113/50 (S)"},{id:"118/55 (M)", label:"118/55 (M)"},{id:"124/65 (P)", label:"124/65 (P)"}],
  "th6li|sr":      [{id:"110/46 (S)", label:"110/46 (S)"},{id:"119/60 (M)", label:"119/60 (M)"},{id:"122/65 (P)", label:"122/65 (P)"}],
  "th5|if":        [{id:"113/50", label:"113/50"}],
  "th5li|s_bte":   [{id:"125/50 Thin-Tube", label:"125/50 Thin-Tube"},{id:"133/60 Earhook", label:"133/60 Earhook"}],
  "th5li|p_bte":   [{id:"130/66 Thin-Tube", label:"130/66 Thin-Tube"},{id:"135/77 Earhook", label:"135/77 Earhook"}],
  "th5li|sp_bte":  [{id:"140/82 Earhook", label:"140/82 Earhook"}],
};

// Color schemes by style category
export const TH_COLORS = {
  ric_bte:  ["Beige","Dark Brown","Black","Granite","Sandy Brown"],
  slim_ric: ["Snow White/Rose Gold","Cosmic Blue/Rose Gold","Black/Silver","White","Black"],
  if_faceplate: ["Mocha","Black"],
  if_shell: ["Red/Blue"],
  custom_faceplate: ["Beige","Tan","Mocha","Brown","Dark Brown","Black"],
  custom_shell: ["Beige","Tan","Mocha","Brown","Dark Brown","Black"],
};

// Which style category each TH style belongs to (for color logic)
export const TH_STYLE_COLOR_CATEGORY = {
  ric:"ric_bte", ric_bct:"ric_bte", s_bte:"ric_bte", p_bte:"ric_bte", sp_bte:"ric_bte",
  sr:"slim_ric",
  if:"if",
  iic:"custom", cic:"custom", itc:"custom", hs:"custom", fs:"custom",
};

// Battery type auto-determined by model+style
export const TH_BATTERY = {
  "th7|iic":"Size 10 (Disposable)", "th7|cic":"Size 10 (Disposable)",
  "th7|itc":"Size 312 (Disposable)", "th7|hs":"Size 312 (Disposable)", "th7|fs":"Size 312 (Disposable)",
  "th7li|ric":"Rechargeable (Li-Ion)", "th7li|ric_bct":"Rechargeable (Li-Ion)", "th7li|sr":"Rechargeable (Li-Ion)", "th7li|if":"Rechargeable (Li-Ion)",
  "th6|ric":"Size 312 (Disposable)",
  "th6li|itc":"Rechargeable (Li-Ion)", "th6li|hs":"Rechargeable (Li-Ion)", "th6li|fs":"Rechargeable (Li-Ion)", "th6li|sr":"Rechargeable (Li-Ion)",
  "th5|if":"Size 10 (Disposable)",
  "th5li|s_bte":"Rechargeable (Li-Ion)", "th5li|p_bte":"Rechargeable (Li-Ion)", "th5li|sp_bte":"Rechargeable (Li-Ion)",
};

// TruHearing dome options — two-step: category → sizes
export const TH_DOMES = {
  "Open":   ["5mm","7mm","10mm"],
  "Tulip":  ["8mm","12mm"],
  "Vented": ["XS","S","M","L","XL"],
  "Closed": ["XS","S","M","L","XL"],
  "Power":  ["XS","S","M","L","XL"],
};

// Styles that show receiver length + dome selection
export const TH_RECEIVER_STYLES = ["ric","ric_bct","sr"];

// TH styles that can anchor a CROS fitting. TruHearing sells its CROS
// transmitter only alongside RIC-form aids (TH7 Li RIC / RIC+BCT, TH6 RIC —
// the granular catalog entries carrying a "CROS" variant); SR, BTE, and
// customs have no companion transmitter on the TH portal.
export const TH_CROS_STYLES = ["ric","ric_bct"];

// Patient-facing benefit copy for TruHearing tier rows. Each tier is framed
// as capable on its own; the next tier adds capability in noisier / more
// complex listening environments. Avoid disparaging lower tiers. These are
// the secondary FEATURE lines — the effort story lives exclusively in
// TIER_EFFORT_COPY (listeningSituations.js), so no effort claims here.
export const TH_TIER_BLURBS = {
  Standard: "Clear, automatic hearing for quieter, one-on-one settings — home, small groups, TV.",
  Advanced: "Adds active noise management and directional focus — restaurants, gatherings, and conversations over background noise become easier to follow.",
  Premium:  "The most sophisticated processing offered — the strongest speech-from-noise separation available, richer spatial awareness, and steadier streaming."
};
