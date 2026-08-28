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

// Catalog + device-configuration constants shared by the provider CRM.
// Extracted verbatim from Distil.jsx (backlog #40a — monolith decomposition).

// ── Body style imagery — real Signia packshots ──
// Resolved through the shared device-photo store (deviceImages.js) so a body
// style and the catalog rows for that shell show the same file. Two keys are
// still awaiting manual sourcing (signia-motion → BTE, signia-insio-itc →
// ITC); until those files land in src/assets/devices/, the old silhouette
// fills in — drop the .webp there and the silhouette retires itself.
import { deviceImageUrl } from "../deviceImages.js";
import imgBTEFallback from "../assets/body-styles/bte.png";
import imgITCFallback from "../assets/body-styles/ITC.png";

// ── Manufacturer logos ──
import logoOticon from "../assets/logos/Oticon.png";
import logoPhonak from "../assets/logos/Phonak.png";
import logoResound from "../assets/logos/Resound.png";
import logoRexton from "../assets/logos/Rexton.png";
import logoSignia from "../assets/logos/Signia.png";
import logoStarkey from "../assets/logos/Starkey.png";
import logoTruHearing from "../assets/logos/TruHearing.png";
import logoWidex from "../assets/logos/Widex.png";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
export const DEFAULT_CLINIC = {
  name: "My Hearing Centers",
  address: "1234 N Hearing Ave, Phoenix, AZ 85012",
  phone: "(602) 555-0100",
  accent: "#16a34a", // green
};

export const BODY_STYLES = [
  { id:"ric", label:"RIC / miniRITE", desc:"Receiver-in-canal · Most popular", hasReceiver:true,  hasColor:true,  hasDome:true  },
  { id:"bte", label:"BTE", desc:"Behind-the-ear · Maximum power",              hasReceiver:false, hasColor:true,  hasDome:false },
  { id:"ite", label:"ITE", desc:"In-the-ear · Full shell",                     hasReceiver:false, hasColor:false, hasDome:false },
  { id:"itc", label:"ITC", desc:"In-the-canal · Half shell",                   hasReceiver:false, hasColor:false, hasDome:false },
  { id:"cic", label:"CIC", desc:"Completely-in-canal",                          hasReceiver:false, hasColor:false, hasDome:false },
  { id:"iic", label:"IIC", desc:"Invisible-in-canal",                           hasReceiver:false, hasColor:false, hasDome:false },
  { id:"if",  label:"IF",  desc:"Instant Fit · Dome only, no separate receiver", hasReceiver:false, hasColor:true,  hasDome:true  },
];
export const SKIN_TONES = ["Light Beige","Medium Beige","Medium-Dark Beige","Dark Beige","Invisible Matte"];

export const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// ── BODY STYLE IMAGE LOOKUP ──────────────────────────────────────────────────
// One representative Signia packshot per shell (IF uses Silk — the instant-fit
// shell the TruHearing IF white-labels). Keys are deviceImages image_keys.
export const BODY_STYLE_PHOTO_KEY = {
  ric: "signia-pure-ax",
  bte: "signia-motion",
  ite: "signia-insio-ite",
  itc: "signia-insio-itc",
  cic: "signia-insio-cic",
  iic: "signia-insio-iic",
  if:  "signia-silk",
};
const BODY_STYLE_FALLBACK = { bte: imgBTEFallback, itc: imgITCFallback };
export const BODY_STYLE_IMG = Object.fromEntries(
  Object.entries(BODY_STYLE_PHOTO_KEY).map(([id, key]) =>
    [id, deviceImageUrl(key) ?? BODY_STYLE_FALLBACK[id] ?? null])
);

// ── MANUFACTURER LOGO LOOKUP ─────────────────────────────────────────────────
export const MFR_LOGO = {
  "Oticon":logoOticon, "Phonak":logoPhonak, "Resound":logoResound, "ReSound":logoResound,
  "Rexton":logoRexton, "Signia":logoSignia, "Starkey":logoStarkey,
  "TruHearing":logoTruHearing, "Widex":logoWidex,
};

// ── COLOR HEX MAP ────────────────────────────────────────────────────────────
// Maps hearing aid color names → hex values for visual swatches
export const COLOR_HEX_MAP = {
  // ── Neutrals (shared across many brands) ──
  "Black":            "#1a1a1a",
  "Graphite":         "#4a4a4a",
  "Silver":           "#b0b0b0",
  "Beige":            "#d4b896",
  "Dark Brown":       "#4a2c17",
  "Deep Brown":       "#3d1f0e",
  "Sandy Brown":      "#c4a47a",
  "Dark Champagne":   "#b89f7a",
  "Champagne":        "#d4c5a0",
  "Mocha":            "#6b4226",
  "Brown":            "#6b3e26",
  "Chestnut":         "#7b3f00",
  "Tan":              "#c8a882",

  // ── Signia specific ──
  "Pearl White":      "#f0ece4",
  "Fine Gold":        "#c5a55a",
  "Rose Gold":        "#c49a8a",
  "Galactic Blue":    "#2a4b7c",
  "Pearl Pink":       "#e8c4c4",
  "Sporty Red":       "#c0392b",
  "Turquoise":        "#40b5ad",
  "Cosmic Blue":      "#1a3a5c",
  "Snow White":       "#f5f0ea",

  // ── Signia multi-tone (primary color used) ──
  "Black/Black Gloss":"#1a1a1a",
  "Black/Graphite":   "#1a1a1a",
  "Black/Silver":     "#1a1a1a",
  "Black/Chrome":     "#1a1a1a",
  "Black/White":      "#1a1a1a",
  "Black/Champagne":  "#1a1a1a",
  "Cosmic Blue/Rose Gold":"#1a3a5c",
  "Snow White/Rose Gold":"#f5f0ea",
  "Snow White/Silver":"#f5f0ea",
  "Snow White/Snow White Gloss":"#f5f0ea",
  "White/White":      "#f5f0ea",
  "White/Champagne":  "#f5f0ea",
  "Sterling Silver":  "#c0c0c0",
  "White":            "#f5f0ea",

  // ── Oticon specific ──
  "Steel Blue":       "#4682b4",
  "Dust Rose":        "#c4918a",
  "Cobalt Black":     "#1c1c2e",
  "Midnight Black":   "#1a1a2e",
  "Terracotta":       "#c67044",
  "Silver Grey":      "#a8a8a8",
  "Steel Grey":       "#6e6e6e",
  "Chroma Beige":     "#c8b898",

  // ── Phonak specific ──
  "Sand Beige":       "#d4c4a0",
  "Sandalwood":       "#a67b5b",
  "Slate":            "#6e7b8b",
  "Khaki":            "#b8a88a",
  "Anthracite":       "#383838",
  "Cinnamon":         "#8b4513",

  // ── ReSound specific ──
  "Warm Beige":       "#d4b88c",
  "Dark Granite":     "#4a4a50",
  "Sterling":         "#b8b8c0",

  // ── Starkey specific ──
  "Carbon Black":     "#1e1e1e",
  "Sandstone":        "#c4b090",
  "Pewter":           "#8e8e8e",
  "Pearl":            "#e8e0d4",
  "Dark Silver":      "#808088",
  "Brushed Titanium": "#9a9a9a",
  "Ivory":            "#eae0cc",

  // ── Widex specific ──

  // ── Rexton (shares Signia palette mostly) ──

  // ── TruHearing specific ──
  "Granite":          "#6b6b6b",

  // ── Skin tones (ITE/ITC/CIC/IIC) ──
  "Light Beige":      "#e8d4b8",
  "Medium Beige":     "#cdb08a",
  "Medium-Dark Beige":"#b08c60",
  "Dark Beige":       "#8c6840",
  "Invisible Matte":  "#c4a880",

  // ── TruHearing faceplate/shell ──
  "Red/Blue":         "#c0392b",
};

// Extract the secondary color from multi-tone names like "Black/Silver"
export function getMultiToneColors(name){
  if(!name.includes("/"))return null;
  const parts=name.split("/").map(s=>s.trim());
  const c1=COLOR_HEX_MAP[parts[0]]||"#888";
  const c2=COLOR_HEX_MAP[parts[1]]||"#888";
  return[c1,c2];
}

// ── PRODUCT CATALOG SEED ──────────────────────────────────────────────────────
// Loaded into storage on first launch. Editable via the Product Catalog screen.
// Schema: { id, manufacturer, generation, family, styles[], variants[],
//           techLevels[], colors[], battery[], active, notes }
export const CATALOG_DEFAULT = [
  // ── RELATE (UHCH-exclusive private-label Unitron) — staged inactive ───────
  // tpa:"UHCH" keeps these visible only to UHCH patients (see visibleCatalog).
  // active:false until the exclusivity filter ships; flip on at go-live.
  { id:"relate-40-ric", manufacturer:"Relate", generation:"4.0",
    family:"Relate 4.0 RIC", styles:["ric"], variants:[],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)","Size 312"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive until exclusivity filter deploys." },
  { id:"relate-40-bte", manufacturer:"Relate", generation:"4.0",
    family:"Relate 4.0 BTE", styles:["bte"], variants:["Standard BTE","UP BTE"],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive." },
  { id:"relate-50-ric", manufacturer:"Relate", generation:"5.0",
    family:"Relate 5.0 RIC", styles:["ric"], variants:[],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive." },
  { id:"relate-50-custom", manufacturer:"Relate", generation:"5.0",
    family:"Relate 5.0 Custom", styles:["ite","itc","cic"], variants:[],
    techLevels:["Platinum","Gold"], colors:[],
    battery:["Rechargeable (Li-Ion)","Size 10"], tpa:"UHCH", active:false, notes:"UHCH-exclusive. Staged inactive." },

  // ── SIGNIA IX (2023–present) ─────────────────────────────────────────────
  { id:"sig-pure-ix", manufacturer:"Signia", generation:"IX",
    family:"Pure Charge&Go IX", styles:["ric"],
    variants:["Standard","T (Telecoil)","BCT (Bluetooth Classic)","CROS"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BCT & T variants launched Feb 2025." },


  { id:"sig-styletto-ix", manufacturer:"Signia", generation:"IX",
    family:"Styletto IX", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black/Black Gloss","Black/Graphite","Black/Silver","Cosmic Blue/Rose Gold","Snow White/Rose Gold","Snow White/Silver","Snow White/Snow White Gloss"],
    battery:["Rechargeable"], active:true, notes:"Slim RIC. Launched March 2024." },


  { id:"sig-motion-ix", manufacturer:"Signia", generation:"IX",
    family:"Motion Charge&Go IX", styles:["bte"],
    variants:["M (Medium)","P (Power)","SP (Super Power)"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black","Beige","Dark Champagne","Deep Brown","Fine Gold","Galactic Blue","Graphite","Pearl Pink","Pearl White","Rose Gold","Sandy Brown","Silver","Sporty Red","Turquoise"],
    battery:["Rechargeable"], active:true, notes:"SP for severe-profound. All variants include telecoil." },


  { id:"sig-silk-ix", manufacturer:"Signia", generation:"IX",
    family:"Silk Charge&Go IX", styles:["if"],
    variants:["Standard","CROS"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Black","Mocha"], faceplate:true,
    battery:["Rechargeable"], active:true, notes:"Instant-fit. No Bluetooth streaming. Faceplate Black/Mocha; shell red (right)/blue (left)." },


  { id:"sig-insio-iic-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX IIC", styles:["iic"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Mocha","Black","Deep Brown"],
    battery:["Size 10"], active:true, notes:"Launched Dec 2024. Binaural OneMic Directionality 2.0." },


  { id:"sig-insio-cic-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX CIC", styles:["cic"],
    variants:["Standard","Rechargeable (Insio C&G IX)"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:["Mocha","Black","Deep Brown"],
    battery:["Size 10","Rechargeable"], active:true, notes:"Rechargeable CIC variant is world's first. Launched 2024." },


  { id:"sig-insio-itc-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX ITC", styles:["itc"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:SKIN_TONES,
    battery:["Size 312"], active:true, notes:"Launched Aug 2025." },


  { id:"sig-insio-ite-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX ITE", styles:["ite"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX","2IX","1IX"],
    colors:SKIN_TONES,
    battery:["Size 13"], active:true, notes:"Launched Aug 2025." },


  { id:"sig-active-ix", manufacturer:"Signia", generation:"IX",
    family:"Active IX", styles:["if"],
    variants:[],
    techLevels:["7IX","1IX"],
    techLevelLabels:{ "7IX":"Active Pro IX (7IX — full feature set)", "1IX":"Active IX (1IX — entry level)" },
    colors:["Black","White","Champagne"],
    battery:["Rechargeable"], active:true, notes:"Earbud-style instant fit. Active Pro scored top 5% at HearAdvisor." },


  // ── SIGNIA AX (2021–present, still dispensed) ────────────────────────────
  { id:"sig-pure-ax", manufacturer:"Signia", generation:"AX",
    family:"Pure Charge&Go AX", styles:["ric"],
    variants:["Standard","T (Telecoil)","CROS"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Launched May 2021. Still widely dispensed." },


  { id:"sig-pure312-ax", manufacturer:"Signia", generation:"AX",
    family:"Pure 312 AX", styles:["ric"],
    variants:["Standard","T (Telecoil)"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Size 312"], active:true, notes:"Disposable battery RIC option on AX platform." },


  { id:"sig-styletto-ax", manufacturer:"Signia", generation:"AX",
    family:"Styletto AX", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black/Chrome","Black/White","Black/Champagne","Sterling Silver","White/White","White/Champagne","Cosmic Blue"],
    battery:["Rechargeable"], active:true, notes:"Slim RIC on AX platform. Colors approximate — verify with rep." },


  { id:"sig-motion-ax", manufacturer:"Signia", generation:"AX",
    family:"Motion Charge&Go AX", styles:["bte"],
    variants:["M (Medium)","P (Power)","SP (Super Power)"],
    techLevels:["7AX","5AX","3AX","2AX","1AX"],
    colors:["Black","Beige","Dark Champagne","Deep Brown","Graphite","Pearl White","Rose Gold","Sandy Brown","Silver"],
    battery:["Rechargeable"], active:true, notes:"" },


  { id:"sig-silk-ax", manufacturer:"Signia", generation:"AX",
    family:"Silk Charge&Go AX", styles:["if"],
    variants:["Standard"],
    techLevels:["7AX","5AX","3AX"],
    colors:["Black","Mocha"], faceplate:true,
    battery:["Rechargeable"], active:true, notes:"Instant-fit on AX platform. Faceplate Black/Mocha; shell red (right)/blue (left)." },


  { id:"sig-insio-cg-ax-ite", manufacturer:"Signia", generation:"AX",
    family:"Insio Charge&Go AX ITE", styles:["ite"],
    variants:["Standard"],
    techLevels:["7AX","5AX","3AX"],
    colors:SKIN_TONES,
    battery:["Rechargeable"], active:true, notes:"Rechargeable custom ITE — still active line alongside IX customs." },


  { id:"sig-insio-cg-ax-itc", manufacturer:"Signia", generation:"AX",
    family:"Insio Charge&Go AX ITC", styles:["itc"],
    variants:["Standard"],
    techLevels:["7AX","5AX","3AX"],
    colors:SKIN_TONES,
    battery:["Rechargeable"], active:true, notes:"Rechargeable custom ITC — still active line." },


  // ── PHONAK Infinio (2024–present) ────────────────────────────────────────
  { id:"pho-sphere-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Audéo Sphere Infinio", styles:["ric"],
    variants:["Ultra Sphere","Sphere","Standard"],
    techLevels:["90","70","50"],
    colors:["Silver","Champagne","Sandalwood","Slate","Midnight Black","Chestnut","Beige"],
    battery:["Rechargeable"], active:true, notes:"Ultra Sphere = dual-chip AI noise. Launched Aug 2024." },


  { id:"pho-audeo-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Audéo Infinio", styles:["ric"],
    variants:["Standard","RT (Rechargeable + Telecoil)","312 (Size 312)","CROS"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Champagne","Sandalwood","Slate","Midnight Black","Chestnut","Beige"],
    battery:["Rechargeable","Size 312"], active:true, notes:"" },


  { id:"pho-naida-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Naída Infinio", styles:["bte"],
    variants:["P","UP","SP"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Beige","Anthracite","Brown","Cinnamon"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"Power BTE. P/UP/SP receiver variants." },


  { id:"pho-virto-infinio", manufacturer:"Phonak", generation:"Infinio",
    family:"Virto Infinio", styles:["ite","itc","cic","iic"],
    variants:["Standard","Titanium (IIC only)"],
    techLevels:["90","70","50"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, notes:"Titanium IIC is ultra-small and durable." },


  // ── PHONAK Lumity (2022–present) ─────────────────────────────────────────
  { id:"pho-audeo-lumity", manufacturer:"Phonak", generation:"Lumity",
    family:"Audéo Lumity", styles:["ric"],
    variants:["Standard","Life (waterproof)","RT (Rechargeable + Telecoil)","312","CROS"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Champagne","Sandalwood","Slate","Midnight Black","Chestnut","Beige","Khaki"],
    battery:["Rechargeable","Size 312"], active:true, notes:"Life variant is IP68 waterproof." },


  { id:"pho-naida-lumity", manufacturer:"Phonak", generation:"Lumity",
    family:"Naída Lumity", styles:["bte"],
    variants:["P","UP"],
    techLevels:["90","70","50","30"],
    colors:["Silver","Beige","Anthracite","Brown"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"" },


  // ── OTICON Intent (2024–present) ─────────────────────────────────────────
  { id:"oti-intent", manufacturer:"Oticon", generation:"Intent",
    family:"Intent", styles:["ric"],
    variants:["miniRITE R","miniRITE R T (Telecoil)","mRITE R (more power)","CROS"],
    techLevels:["1","2","3","4"],
    colors:["Silver","Chestnut","Dust Rose","Champagne","Midnight Black","Beige","Steel Blue"],
    battery:["Rechargeable"], active:true, notes:"Intent 1 = premium, scales down to 4. mRITE R for moderate-severe loss." },


  { id:"oti-own-intent", manufacturer:"Oticon", generation:"Intent",
    family:"Own", styles:["ite","itc","cic","iic"],
    variants:["Standard"],
    techLevels:["1","2","3","4"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, notes:"Custom styles on Intent platform." },


  // Nations-covered LEGACY Own (pre-Intent) — Nations-only, distinct from the
  // Intent-gen Own above. Own 1/2 → Specialty, 3 → Advanced Plus, 4/5 → Superior Plus.
  { id:"oti-own", manufacturer:"Oticon", generation:"Own",
    family:"Own", styles:["cic","iic","itc","ite"],
    variants:["Standard"],
    techLevels:["1","2","3","4","5"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, tpa:"Nations",
    notes:"Nations-covered legacy Own custom line (pre-Intent, Nations-only)." },


  { id:"oti-xceed", manufacturer:"Oticon", generation:"Intent",
    family:"Xceed", styles:["bte"],
    variants:["SP","UP"],
    techLevels:["1","2","3"],
    colors:["Silver","Beige","Dark Brown","Cobalt Black"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"Super/Ultra power BTE." },


  // ── OTICON Real (2023) ───────────────────────────────────────────────────
  { id:"oti-real", manufacturer:"Oticon", generation:"Real",
    family:"Real", styles:["ric"],
    variants:["miniRITE R","miniRITE R T (Telecoil)","mRITE R","CROS"],
    techLevels:["1","2","3"],
    colors:["Silver","Chestnut","Dust Rose","Champagne","Midnight Black","Beige"],
    battery:["Rechargeable"], active:true, notes:"Previous generation, still dispensed. 1 = premium, scales down." },


  // ── STARKEY Genesis AI (2023–present) ────────────────────────────────────
  { id:"sta-genesis-ric", manufacturer:"Starkey", generation:"Genesis AI",
    family:"Genesis AI mRIC R", styles:["ric"],
    variants:["Standard","Omega AI (smaller form)"],
    techLevels:["24","20","16","12"],
    colors:["Silver","Black","Rose Gold","Champagne","Mocha","Brushed Titanium","Pewter"],
    battery:["Rechargeable","Size 312"], active:true, notes:"Omega AI launched 2025 — adds AI fall detection." },


  { id:"sta-genesis-bte", manufacturer:"Starkey", generation:"Genesis AI",
    family:"Genesis AI BTE", styles:["bte"],
    variants:["Standard","Power"],
    techLevels:["24","20","16","12"],
    colors:["Silver","Black","Beige","Dark Brown"],
    battery:["Rechargeable","Size 13"], active:true, notes:"" },


  { id:"sta-genesis-custom", manufacturer:"Starkey", generation:"Genesis AI",
    family:"Genesis AI Custom", styles:["ite","itc","cic","iic"],
    variants:["ITE","ITC","CIC","IIC","IIC Rechargeable"],
    techLevels:["24","20","16","12"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13","Rechargeable"], active:true, notes:"" },


  // ── WIDEX Moment (current) ───────────────────────────────────────────────
  { id:"wid-moment-sheer", manufacturer:"Widex", generation:"Moment",
    family:"Moment Sheer", styles:["ric"],
    variants:["sRIC RD (Rechargeable)","312 D (Size 312)","CROS"],
    techLevels:["440","330","220","110"],
    colors:["Silver","Dark Silver","Rose Gold","Pearl","Carbon Black","Sandstone","Champagne","Pewter"],
    battery:["Rechargeable","Size 312"], active:true, notes:"" },


  { id:"wid-moment-bte", manufacturer:"Widex", generation:"Moment",
    family:"Moment BTE", styles:["bte"],
    variants:["Power","Super Power"],
    techLevels:["440","330","220","110"],
    colors:["Silver","Dark Silver","Beige","Carbon Black"],
    battery:["Rechargeable","Size 13"], active:true, notes:"" },


  { id:"wid-moment-custom", manufacturer:"Widex", generation:"Moment",
    family:"Moment Custom", styles:["ite","itc","cic","iic"],
    variants:["ITE","ITC","CIC","IIC"],
    techLevels:["440","330","220","110"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, notes:"" },


  // ── RESOUND Nexia / Vivia (current) ──────────────────────────────────────
  { id:"res-vivia", manufacturer:"Resound", generation:"Nexia",
    family:"Vivia microRIE", styles:["ric"],
    variants:["Standard","MultiMic+"],
    techLevels:["9","7","5","3"],
    colors:["Silver","Champagne","Rose Gold","Chestnut","Carbon Black","Ivory","Slate"],
    battery:["Rechargeable"], active:true, notes:"Launched 2024. Successor to Nexia RIC. One of smallest RICs available." },


  { id:"res-nexia-ric", manufacturer:"Resound", generation:"Nexia",
    family:"Nexia RIE", styles:["ric"],
    variants:["Standard","CROS","BICROS"],
    techLevels:["9","7","5","3"],
    colors:["Silver","Champagne","Rose Gold","Dark Brown","Carbon Black","Ivory"],
    battery:["Rechargeable","Size 312"], active:true, notes:"" },


  // ── RESOUND Nations value lines (Nations-only, no OOP options) ────────────
  { id:"res-key-ric", manufacturer:"Resound", generation:"Key",
    family:"Key", styles:["ric","bte"],
    variants:["Standard"],
    techLevels:["4","3"],
    colors:["Silver","Champagne","Rose Gold","Dark Brown","Carbon Black","Ivory"],
    battery:["Rechargeable","Size 312","Size 13"], active:true, tpa:"Nations",
    notes:"Nations value line (Nations-only). Key 3 → Standard, Key 4 → Select. No-OOP option." },


  { id:"res-key-custom", manufacturer:"Resound", generation:"Key",
    family:"Key Custom", styles:["itc","ite"],
    variants:["Standard"],
    techLevels:["4","3"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, tpa:"Nations",
    notes:"Nations value line customs (Nations-only). Key 3/4 → Superior Plus." },


  { id:"res-savi-ric", manufacturer:"Resound", generation:"Savi",
    family:"Savi", styles:["ric","bte"],
    variants:["Standard"],
    techLevels:["3","2"],
    colors:["Silver","Champagne","Rose Gold","Dark Brown","Carbon Black","Ivory"],
    battery:["Rechargeable","Size 312","Size 13"], active:true, tpa:"Nations",
    notes:"Nations value line (Nations-only). Savi 2 → Standard, Savi 3 → Select. No-OOP option. Customs excluded." },


  { id:"res-enzo-q", manufacturer:"Resound", generation:"Nexia",
    family:"ENZO Q", styles:["bte"],
    variants:["Standard","CROS"],
    techLevels:["9","7","5","3"],
    colors:["Silver","Beige","Dark Brown","Anthracite"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"Super power BTE." },


  { id:"res-nexia-custom", manufacturer:"Resound", generation:"Nexia",
    family:"Nexia Custom", styles:["ite","itc","cic","iic"],
    variants:["ITE","ITC","CIC"],
    techLevels:["9","7","5","3"],
    colors:SKIN_TONES,
    battery:["Size 13","Size 312","Size 10"], active:true, notes:"" },


  // ── REXTON (WSAudiology sister brand to Signia) ───────────────────────────
  // Rexton (WSAudiology's value brand; Rexton-only per CLAUDE.md — no Beltone
  // proprietary auth). `generation` (IX / AX) is kept purely as the dome key —
  // getDomeOptions routes Rexton through the Signia Gen-3 sleeve set. The
  // patient-facing platform name (Reach / BiCore) lives in the DB's
  // display_generation column and is rendered on the #16 device screen, not
  // from this fallback. MHC dispenses tech levels 80/60/40/20 only (no 30).
  // Mirrors migration 023 — keep in sync (this is a fallback; the live screen
  // reads the DB via loadProductCatalog).
  { id:"rex-reach-plus", manufacturer:"Rexton", generation:"IX",
    family:"Reach R Plus", styles:["ric"],
    variants:["Standard","T (Telecoil)","BC (Bluetooth Classic)","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Sister product to Signia Pure BCT IX." },
  { id:"rex-reach-r", manufacturer:"Rexton", generation:"IX",
    family:"Reach R", styles:["ric"],
    variants:["Standard","T (Telecoil)","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Standard RIC." },
  { id:"rex-reach-styleline", manufacturer:"Rexton", generation:"IX",
    family:"Reach Style Line", styles:["ric"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Slim-RIC form factor. Premium tiers only." },
  { id:"rex-reach-inox-cic", manufacturer:"Rexton", generation:"IX",
    family:"Reach inoX CIC", styles:["if"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Beige","Brown","Black"],
    battery:["Rechargeable"], active:true, notes:"Reach platform (current). Instant-fit CIC. No direct wireless audio streaming. Premium tiers only." },


  { id:"rex-bicore", manufacturer:"Rexton", generation:"AX",
    family:"BiCore R-Li", styles:["ric"],
    variants:["Standard","T (Telecoil)","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Lithium-ion RIC; R-Li T adds telecoil." },
  { id:"rex-bicore-r312", manufacturer:"Rexton", generation:"AX",
    family:"BiCore R 312", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Size 312"], active:true, notes:"BiCore platform (predecessor). Size 312 zinc-air RIC." },
  { id:"rex-bicore-slim-ric", manufacturer:"Rexton", generation:"AX",
    family:"BiCore Slim-RIC", styles:["ric"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Slim-RIC form factor. Premium tiers only." },
  { id:"rex-bicore-bte", manufacturer:"Rexton", generation:"AX",
    family:"BiCore BTE", styles:["bte"],
    variants:["M","P","HP"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Standard/Power BTE (M/P/HP)." },
  { id:"rex-bicore-custom", manufacturer:"Rexton", generation:"AX",
    family:"BiCore Custom", styles:["ite","itc"],
    variants:["ITE","ITC"],
    techLevels:["80","60","40","20"],
    colors:[],
    battery:["Rechargeable"], active:true, notes:"BiCore platform (predecessor). Custom ITE/ITC, rechargeable." },
  { id:"rex-bicore-inox-cic", manufacturer:"Rexton", generation:"AX",
    family:"BiCore inoX Click CIC", styles:["if"],
    variants:["Standard"],
    techLevels:["80","60","40"],
    colors:["Beige","Brown","Black"],
    battery:["Size 10"], active:true, notes:"BiCore platform (predecessor). Instant-fit Click CIC, size 10 zinc-air. No direct wireless streaming. Premium tiers only." },


  // ── TRUHEARING SELECT (Private-label WSAudiology products) ─────────────────
  // Two orthogonal axes — never conflate them:
  //   · Model number = PLATFORM generation: TH7 = Signia IX, TH6 = AX, TH5 = X.
  //   · Plan tier (Premium/Advanced/Standard) = TECHNOLOGY LEVEL (≈ Signia
  //     7/5/3 prefix), chosen in the Technology Tier step.
  // "TruHearing 7 Li Premium" ≈ Signia Pure Charge&Go 7IX. Tier×model is
  // many-to-many (see TH_AVAILABILITY) — these coarse entries group each
  // series at its most common tier for legacy paths, but they are NOT a
  // tier→product mapping. The card flow runs on TH_MODELS/TH_AVAILABILITY.
  // TH5 BTE is always available regardless of plan tier — the plan price
  // covers whatever the clinician fits.

  // ── TH7 Premium · Signia IX · 48ch ── planTierKey:"Premium" ──────────────
  { id:"th7-prem-ric-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — RIC Rechargeable", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX platform · Rechargeable Li-Ion." },

  { id:"th7-prem-sr-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — SR Rechargeable (Super Power RIC)", styles:["ric"],
    variants:["Standard"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX · Super-power RIC · Rechargeable Li-Ion. For severe-profound loss." },

  { id:"th7-prem-if-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — Instant Fit Rechargeable", styles:["ite"],
    variants:["Standard"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX · IF Li-Ion custom · Rechargeable Li-Ion." },

  { id:"th7-prem-custom", manufacturer:"TruHearing", tpa:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — Custom (IIC / CIC / ITC)", styles:["ite","itc","cic","iic"],
    variants:["IIC","CIC","ITC / HS / FS"], techLevels:["Premium"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 10","Size 312"], active:true,
    notes:"48ch · IX · Non-wireless custom. No Li-Ion upcharge." },

  // ── TH6 Advanced · Signia AX · 32ch ── planTierKey:"Advanced" ────────────
  { id:"th6-adv-ric-312", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — RIC 312", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Advanced"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 312"], active:true,
    notes:"32ch · AX platform · Non-rechargeable RIC. No Li-Ion upcharge." },

  { id:"th6-adv-ric-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — RIC Rechargeable", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX platform · Rechargeable Li-Ion." },

  { id:"th6-adv-sr-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — SR Rechargeable (Super Power RIC)", styles:["ric"],
    variants:["Standard"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX · Super-power RIC · Rechargeable Li-Ion. Severe-profound loss." },

  { id:"th6-adv-custom-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — Custom Rechargeable (ITC)", styles:["ite","itc"],
    variants:["ITC / HS / FS"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX · ITC Li-Ion custom · Rechargeable Li-Ion." },

  // ── TH5 · Signia X ── planTierKey:"Standard"; BTE always available ────────
  { id:"th5-if", manufacturer:"TruHearing", tpa:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Premium — Instant Fit", styles:["ite"],
    variants:["Standard"], techLevels:["Standard"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 10"], active:true,
    notes:"48ch · X platform · Non-wireless IF custom. No Li-Ion upcharge." },

  { id:"th5-bte-adv-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Advanced — BTE Rechargeable (32ch)", styles:["bte"],
    variants:["Standard BTE (Thin-tube)","Standard BTE (Earhook)","Power BTE (Thin-tube)","Power BTE (Earhook)","SP BTE"],
    techLevels:["Standard"], rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · X platform · BTE Li-Ion · Rechargeable Li-Ion. Always available regardless of plan tier." },

  { id:"th5-bte-prem-li", manufacturer:"TruHearing", tpa:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Premium — BTE Rechargeable (48ch)", styles:["bte"],
    variants:["Standard BTE (Thin-tube)","Standard BTE (Earhook)","Power BTE (Thin-tube)","Power BTE (Earhook)","SP BTE"],
    techLevels:["Standard"], rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · X platform · BTE Li-Ion · Rechargeable Li-Ion. Always available regardless of plan tier." },
];
export const RECEIVER_LENGTHS = ["0","1","2","3","4","5"];

// Per-manufacturer receiver power options. earmold:true = auto-requires earmold, no dome
export const RECEIVER_POWERS = {
  Signia:  [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  TruHearing:[{id:"S", label:"Standard (S)",   earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Rexton:  [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Phonak:  [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Unitron: [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Oticon:  [{id:"60", label:"60 Gain",        earmold:false},
            {id:"85", label:"85 Gain",         earmold:false},
            {id:"100",label:"100 Gain",        earmold:false},
            {id:"105",label:"105 Gain (Earmold)",earmold:true}],
  Resound: [{id:"LP",label:"Low Power (LP)",  earmold:false},
            {id:"MP",label:"Medium Power (MP)",earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:false},
            {id:"UP",label:"Ultra Power (UP)", earmold:true }],
  Starkey: [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
  Widex:   [{id:"S", label:"Standard (S)",    earmold:false},
            {id:"M", label:"Medium (M)",       earmold:false},
            {id:"P", label:"Power (P)",        earmold:false},
            {id:"HP",label:"High Power (HP)",  earmold:true }],
};


// Signia/Rexton receiver generation sets:
//   2.0 (X, NX, PX): Click Sleeves + Vented Sleeves
//   3.0 (AX, IX):    Sized open/tulip domes + Vented/Closed/Power sleeves
export const SIGNIA_DOMES_GEN2 = [
  "Click Sleeve Open XS","Click Sleeve Open S","Click Sleeve Open M","Click Sleeve Open L",
  "Click Sleeve Closed XS","Click Sleeve Closed S","Click Sleeve Closed M","Click Sleeve Closed L",
  "Click Sleeve Power S","Click Sleeve Power M","Click Sleeve Power L",
  "Vented Sleeve XS","Vented Sleeve S","Vented Sleeve M","Vented Sleeve L",
];
export const SIGNIA_DOMES_GEN3 = [
  "5mm Open","7mm Open","10mm Open",
  "7mm Tulip","10mm Tulip",
  "Vented Sleeve XS","Vented Sleeve S","Vented Sleeve M","Vented Sleeve L",
  "Closed Sleeve XS","Closed Sleeve S","Closed Sleeve M","Closed Sleeve L",
  "Power Sleeve XS","Power Sleeve S","Power Sleeve M","Power Sleeve L",
];
export const SIGNIA_GEN3_PLATFORMS = ["AX","IX"];


// Returns dome options for a given manufacturer + generation
export function getDomeOptions(manufacturer, generation) {
  if (manufacturer === "Signia" || manufacturer === "Rexton" || manufacturer === "TruHearing") {
    return SIGNIA_GEN3_PLATFORMS.includes(generation) ? SIGNIA_DOMES_GEN3 : SIGNIA_DOMES_GEN2;
  }
  const DOME_MAP = {
    Phonak:  ["Open Dome S","Open Dome M","Open Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Vented Dome S","Vented Dome M","Vented Dome L",
              "Power Dome M","Power Dome L"],
    Unitron: ["Open Dome S","Open Dome M","Open Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Vented Dome S","Vented Dome M","Vented Dome L",
              "Power Dome M","Power Dome L"],
    Oticon:  ["Open BasePad S","Open BasePad M","Open BasePad L",
              "Closed BasePad S","Closed BasePad M","Closed BasePad L",
              "Double BasePad S","Double BasePad M","Double BasePad L",
              "Power BasePad S","Power BasePad M"],
    Resound: ["Open Dome S","Open Dome M","Open Dome L",
              "Tulip Dome S","Tulip Dome M","Tulip Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Power Dome S","Power Dome M","Power Dome L"],
    Starkey: ["Open Dome S","Open Dome M","Open Dome L",
              "Closed Dome S","Closed Dome M","Closed Dome L",
              "Power Dome M","Power Dome L"],
    Widex:   ["Open Dome S","Open Dome M","Open Dome L",
              "Tulip Dome S","Tulip Dome M",
              "Closed Dome S","Closed Dome M","Closed Dome L"],
  };
  return DOME_MAP[manufacturer] || [];
}
// Internal IDs preserved for backward compatibility with existing patient
// records and downstream code (quote/PA generation, db.js, seed data).
// Labels reflect the current Care Plan screen vocabulary.
export const CARE_PLANS = [
  { id:"paygo", label:"Standard Billing", price:"$65 per visit" },
  { id:"complete", label:"Complete Care+", price:"$1,250" },
  { id:"punch", label:"MHC Punch Card", price:"$575" },
];
export const VISIT_TYPES = ["New Fitting","2-Week Follow-Up","4-Week Follow-Up","Quarterly Clean & Check","Annual Exam","Triage / Adjustment","Repair Appointment","Other"];
