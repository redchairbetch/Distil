import { useState, useEffect, useMemo, useCallback, useRef } from "react";


import {
  loadAllPatients,
  savePatient,
  loadPunch,
  savePunch,
  loadClinicSettings,
  saveClinicSettings,
  loadProductCatalog,
  saveProductCatalog,
  loadPendingIntakes,
  subscribeToIntakes,
  acceptIntake as dbAcceptIntake,
  dismissIntake,
  signOut,
  enrollPatientInCampaign,
  loadPatientCampaigns,
  seedDefaultCampaign,
  backfillCampaignEnrollment,
  loadInsurancePlans,
  resolveInsurancePlanId,
  loadPricingReveal,
  loadRetailAnchors,
  updatePatientContact,
  updateInsuranceCoverage,
  updateDeviceFitting,
  updateDeviceSide,
  updatePatientCampaign,
  updateDeliveryDate,
  loadStaffProfile,
} from "./db.js";
import { downloadPurchaseAgreement } from "./generatePurchaseAgreement.js";
import { downloadQuote } from "./generateQuote.js";

import ContentLibrary from "./views/ContentLibrary.jsx";
import CampaignManager from "./views/CampaignManager.jsx";
import LimaCharlie from "./views/LimaCharlie.jsx";


// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const DEFAULT_CLINIC = {
  name: "My Hearing Centers",
  address: "1234 N Hearing Ave, Phoenix, AZ 85012",
  phone: "(602) 555-0100",
  accent: "#16a34a", // green
};


const INSURANCE_PLANS = [
  { carrier:"Anthem", planGroup:"Prefix XMM", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Anthem", planGroup:"MediBlue Access PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Anthem", planGroup:"Preferred Provider Option", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Anthem", planGroup:"Prefix EAU", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"BCBS", planGroup:"BCBS Montana Medicare Advantage PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Arkansas Medipak", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix PBHF", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix XCM", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"AR Blue Medicare Saver Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix MCMAB", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Medicare Advantage Optimum PPO MT", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS Idaho", planGroup:"Prefix XMM Idaho", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS Idaho", planGroup:"Prefix XMA Idaho", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix X2B Idaho", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"TN Blue Advantage Garnet", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"BCBS of Michigan Prefix XYL", tpa:"TruHearing", tiers:[{label:"Standard",price:399}, {label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"BCBS", planGroup:"Blue Care Plus TN", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"BCBS of Idaho", planGroup:"Idaho Medicaid Plus", tpa:"TruHearing", tiers:[{label:"Standard",price:399}, {label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"BCBS of Michigan", planGroup:"Prefix XYL", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"CareSource Ohio", planGroup:"Dual Advantage Medicare/Medicaid", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"CIGNA", planGroup:"True Choice Medicare PPO MNPS; Cigna Med Adv Health Spring products", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Devoted Health", planGroup:"Prime Ohio HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:199}, {label:"Premium",price:499}] },
  { carrier:"Devoted Health", planGroup:"Premium Ohio HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:199}, {label:"Premium",price:499}] },
  { carrier:"Devoted Health", planGroup:"Choice Extra Ohio PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Core TN HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Choice Ohio PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Core OH HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Devoted Health", planGroup:"Ohio Giveback HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Devoted Health", planGroup:"Dual Plus OH", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}, {label:"Premium",price:299}] },
  { carrier:"DMBA", planGroup:"Deseret Secure", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"DMBA", planGroup:"Deseret Alliance", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Highmark", planGroup:"Prefix T3B", tpa:"TruHearing", tiers:[{label:"Advanced",price:99}, {label:"Premium",price:399}] },
  { carrier:"Highmark", planGroup:"Prefix HRT", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Highmark", planGroup:"Prefix HRF", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Highmark", planGroup:"Prefix C4K", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:799}] },
  { carrier:"Highmark", planGroup:"Prefix ZWD", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"USAA Honor Giveback PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Humana Essentials Plus Giveback PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"USAA Honor PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Humana Choice Giveback PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Humana Cleveland Clinic Preferred HMO-POS", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Full Access PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Total Complete HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"USAA Honor Giveback HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Humana", planGroup:"Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:299}, {label:"Premium",price:599}] },
  { carrier:"Humana", planGroup:"Value Plus PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Humana", planGroup:"Dual Select HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Humana", planGroup:"Dual Select PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Humana", planGroup:"Gold Plus HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Gold Plus Diabetes and Heart HMO CSNP", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Value Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Medicare Advantage (most plans)", tpa:"TruHearing", tiers:[{label:"Advanced",price:0}, {label:"Premium",price:299}] },
  { carrier:"Humana", planGroup:"Humana Choice Diabetes and Heart PPO C-SNP", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Humana", planGroup:"Gold Plus Diabetes HMO CSNP", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana", planGroup:"Gold Plus Giveback HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Humana Medicare", planGroup:"Humana Medicare Employer PPO Board of Pensions", tpa:"TruHearing", tiers:[{label:"Advanced",price:99}, {label:"Premium",price:399}] },
  { carrier:"Medical Mutual", planGroup:"Medicare Advantage Plans", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Moda", planGroup:"Medicare Supplement", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Moda", planGroup:"Moda Health Central PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Pacific Source", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Standard",price:599}, {label:"Advanced",price:799}, {label:"Premium",price:999}] },
  { carrier:"Primetime Health", planGroup:"Medicare Advantage HMO", tpa:"TruHearing", tiers:[{label:"Standard",price:599}, {label:"Advanced",price:799}, {label:"Premium",price:999}] },
  { carrier:"Providence", planGroup:"Choice Plan", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Providence", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Providence", planGroup:"Medicare Flex", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Providence", planGroup:"Providence Medicare Align HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Regence", planGroup:"Prefix ZVX", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZVW", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZVH", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZVU", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Prefix ZHO", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Medicare Supplement Bridge Plan G Prefix YVO", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"SCAN", planGroup:"Prefix 40028942101", tpa:"TruHearing", tiers:[{label:"Advanced",price:450}, {label:"Premium",price:750}] },
  { carrier:"SCAN", planGroup:"Prefix 40045778801", tpa:"TruHearing", tiers:[{label:"Advanced",price:450}, {label:"Premium",price:750}] },
  { carrier:"SCAN", planGroup:"Prefix 40010939801", tpa:"TruHearing", tiers:[{label:"Advanced",price:450}, {label:"Premium",price:750}] },
  { carrier:"SCAN", planGroup:"SCAN Classic HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:550}, {label:"Premium",price:850}] },
  { carrier:"SCAN", planGroup:"SCAN Venture HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:550}, {label:"Premium",price:850}] },
  { carrier:"Select Health Advantage", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Standard",price:99}, {label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Select Health", planGroup:"Medicare + Kroger HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Essential HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Classic HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Summit Health", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"UMR", planGroup:"Teachers Health Trust", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Wellpoint / Amerigroup", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
];


const BODY_STYLES = [
  { id:"ric", label:"RIC / miniRITE", desc:"Receiver-in-canal · Most popular", hasReceiver:true, hasColor:true },
  { id:"bte", label:"BTE", desc:"Behind-the-ear · Maximum power", hasReceiver:false, hasColor:true },
  { id:"ite", label:"ITE", desc:"In-the-ear · Full shell", hasReceiver:false, hasColor:false },
  { id:"itc", label:"ITC", desc:"In-the-canal · Half shell", hasReceiver:false, hasColor:false },
  { id:"cic", label:"CIC", desc:"Completely-in-canal", hasReceiver:false, hasColor:false },
  { id:"iic", label:"IIC", desc:"Invisible-in-canal", hasReceiver:false, hasColor:false },
];
const SKIN_TONES = ["Light Beige","Medium Beige","Medium-Dark Beige","Dark Beige","Invisible Matte"];


// ── PRODUCT CATALOG SEED ──────────────────────────────────────────────────────
// Loaded into storage on first launch. Editable via the Product Catalog screen.
// Schema: { id, manufacturer, generation, family, styles[], variants[],
//           techLevels[], colors[], battery[], active, notes }
const CATALOG_DEFAULT = [
  // ── SIGNIA IX (2023–present) ─────────────────────────────────────────────
  { id:"sig-pure-ix", manufacturer:"Signia", generation:"IX",
    family:"Pure Charge&Go IX", styles:["ric"],
    variants:["Standard","T (Telecoil)","BCT (Bluetooth Classic)","CROS"],
    techLevels:["7IX","5IX","3IX"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"BCT & T variants launched Feb 2025." },


  { id:"sig-styletto-ix", manufacturer:"Signia", generation:"IX",
    family:"Styletto IX", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["7IX","5IX","3IX"],
    colors:["Black/Black Gloss","Black/Graphite","Black/Silver","Cosmic Blue/Rose Gold","Snow White/Rose Gold","Snow White/Silver","Snow White/Snow White Gloss"],
    battery:["Rechargeable"], active:true, notes:"Slim RIC. Launched March 2024." },


  { id:"sig-motion-ix", manufacturer:"Signia", generation:"IX",
    family:"Motion Charge&Go IX", styles:["bte"],
    variants:["M (Medium)","P (Power)","SP (Super Power)"],
    techLevels:["7IX","5IX","3IX"],
    colors:["Black","Beige","Dark Champagne","Deep Brown","Fine Gold","Galactic Blue","Graphite","Pearl Pink","Pearl White","Rose Gold","Sandy Brown","Silver","Sporty Red","Turquoise"],
    battery:["Rechargeable"], active:true, notes:"SP for severe-profound. All variants include telecoil." },


  { id:"sig-silk-ix", manufacturer:"Signia", generation:"IX",
    family:"Silk Charge&Go IX", styles:["cic"],
    variants:["Standard","CROS"],
    techLevels:["7IX","5IX","3IX"],
    colors:SKIN_TONES,
    battery:["Rechargeable"], active:true, notes:"Instant-fit CIC. No Bluetooth streaming." },


  { id:"sig-insio-iic-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX IIC", styles:["iic"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX"],
    colors:["Mocha","Black","Deep Brown"],
    battery:["Size 10"], active:true, notes:"Launched Dec 2024. Binaural OneMic Directionality 2.0." },


  { id:"sig-insio-cic-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX CIC", styles:["cic"],
    variants:["Standard","Rechargeable (Insio C&G IX)"],
    techLevels:["7IX","5IX","3IX"],
    colors:["Mocha","Black","Deep Brown"],
    battery:["Size 10","Rechargeable"], active:true, notes:"Rechargeable CIC variant is world's first. Launched 2024." },


  { id:"sig-insio-itc-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX ITC", styles:["itc"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX"],
    colors:SKIN_TONES,
    battery:["Size 312"], active:true, notes:"Launched Aug 2025." },


  { id:"sig-insio-ite-ix", manufacturer:"Signia", generation:"IX",
    family:"Insio IX ITE", styles:["ite"],
    variants:["Standard"],
    techLevels:["7IX","5IX","3IX"],
    colors:SKIN_TONES,
    battery:["Size 13"], active:true, notes:"Launched Aug 2025." },


  { id:"sig-active-ix", manufacturer:"Signia", generation:"IX",
    family:"Active IX / Active Pro IX", styles:["ric"],
    variants:["Active Pro IX (7IX — full feature set)","Active IX (1IX — entry level)"],
    techLevels:["7IX","1IX"],
    colors:["Black","White","Champagne"],
    battery:["Rechargeable"], active:true, notes:"Earbud-style RIC. Active Pro scored top 5% at HearAdvisor." },


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
    family:"Silk Charge&Go AX", styles:["cic"],
    variants:["Standard"],
    techLevels:["7AX","5AX","3AX"],
    colors:SKIN_TONES,
    battery:["Rechargeable"], active:true, notes:"Instant-fit CIC on AX platform." },


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
    techLevels:["4","3","2","1"],
    colors:["Silver","Chestnut","Dust Rose","Champagne","Midnight Black","Beige","Steel Blue"],
    battery:["Rechargeable"], active:true, notes:"Intent 4 = premium. mRITE R for moderate-severe loss." },


  { id:"oti-own-intent", manufacturer:"Oticon", generation:"Intent",
    family:"Own", styles:["ite","itc","cic","iic"],
    variants:["Standard"],
    techLevels:["4","3","2","1"],
    colors:SKIN_TONES,
    battery:["Size 312","Size 10","Size 13"], active:true, notes:"Custom styles on Intent platform." },


  { id:"oti-xceed", manufacturer:"Oticon", generation:"Intent",
    family:"Xceed", styles:["bte"],
    variants:["SP","UP"],
    techLevels:["3","2","1"],
    colors:["Silver","Beige","Dark Brown","Cobalt Black"],
    battery:["Rechargeable","Size 13","Size 675"], active:true, notes:"Super/Ultra power BTE." },


  // ── OTICON Real (2023) ───────────────────────────────────────────────────
  { id:"oti-real", manufacturer:"Oticon", generation:"Real",
    family:"Real", styles:["ric"],
    variants:["miniRITE R","miniRITE R T (Telecoil)","mRITE R","CROS"],
    techLevels:["1","2","3"],
    colors:["Silver","Chestnut","Dust Rose","Champagne","Midnight Black","Beige"],
    battery:["Rechargeable"], active:true, notes:"Previous generation, still dispensed. Tech levels ordered low→high." },


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
  { id:"rex-reach-plus", manufacturer:"Rexton", generation:"IX",
    family:"Reach Plus", styles:["ric"],
    variants:["Standard","T (Telecoil)","BC (Bluetooth Classic)","CROS"],
    techLevels:["80","60","40"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true, notes:"Sister product to Signia Pure BCT IX. Launched Oct 2025." },


  { id:"rex-bicore", manufacturer:"Rexton", generation:"AX",
    family:"BiCore", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["80","60","40","20"],
    colors:["Black","Graphite","Silver","Pearl White","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable","Size 312"], active:true, notes:"Previous generation AX-equivalent platform." },


  // ── TRUHEARING (Private-label Signia IX platform) ─────────────────────────
  // ── TRUHEARING SELECT (Private-label WSAudiology products) ─────────────────
  // Plan tier → product (one-to-one): "Premium"→TH7 Premium (48ch·IX), "Advanced"→TH6 Advanced (32ch·AX), "Standard"→TH5 (X)
  // TH5 BTE is always available regardless of plan tier — the plan price covers whatever the clinician fits.

  // ── TH7 Premium · Signia IX · 48ch ── planTierKey:"Premium" ──────────────
  { id:"th7-prem-ric-li", manufacturer:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — RIC Rechargeable", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX platform · Rechargeable Li-Ion." },

  { id:"th7-prem-sr-li", manufacturer:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — SR Rechargeable (Super Power RIC)", styles:["ric"],
    variants:["Standard"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX · Super-power RIC · Rechargeable Li-Ion. For severe-profound loss." },

  { id:"th7-prem-if-li", manufacturer:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — Instant Fit Rechargeable", styles:["ite"],
    variants:["Standard"], techLevels:["Premium"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · IX · IF Li-Ion custom · Rechargeable Li-Ion." },

  { id:"th7-prem-custom", manufacturer:"TruHearing", generation:"IX",
    thSeries:"TH7", planTierKey:"Premium",
    family:"TH7 Premium — Custom (IIC / CIC / ITC)", styles:["ite","itc","cic","iic"],
    variants:["IIC","CIC","ITC / HS / FS"], techLevels:["Premium"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 10","Size 312"], active:true,
    notes:"48ch · IX · Non-wireless custom. No Li-Ion upcharge." },

  // ── TH6 Advanced · Signia AX · 32ch ── planTierKey:"Advanced" ────────────
  { id:"th6-adv-ric-312", manufacturer:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — RIC 312", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Advanced"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 312"], active:true,
    notes:"32ch · AX platform · Non-rechargeable RIC. No Li-Ion upcharge." },

  { id:"th6-adv-ric-li", manufacturer:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — RIC Rechargeable", styles:["ric"],
    variants:["Standard","CROS"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX platform · Rechargeable Li-Ion." },

  { id:"th6-adv-sr-li", manufacturer:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — SR Rechargeable (Super Power RIC)", styles:["ric"],
    variants:["Standard"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX · Super-power RIC · Rechargeable Li-Ion. Severe-profound loss." },

  { id:"th6-adv-custom-li", manufacturer:"TruHearing", generation:"AX",
    thSeries:"TH6", planTierKey:"Advanced",
    family:"TH6 Advanced — Custom Rechargeable (ITC)", styles:["ite","itc"],
    variants:["ITC / HS / FS"], techLevels:["Advanced"],
    rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · AX · ITC Li-Ion custom · Rechargeable Li-Ion." },

  // ── TH5 · Signia X ── planTierKey:"Standard"; BTE always available ────────
  { id:"th5-if", manufacturer:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Premium — Instant Fit", styles:["ite"],
    variants:["Standard"], techLevels:["Standard"],
    rechargeable:false, liUpcharge:0,
    battery:["Size 10"], active:true,
    notes:"48ch · X platform · Non-wireless IF custom. No Li-Ion upcharge." },

  { id:"th5-bte-adv-li", manufacturer:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Advanced — BTE Rechargeable (32ch)", styles:["bte"],
    variants:["Standard BTE (Thin-tube)","Standard BTE (Earhook)","Power BTE (Thin-tube)","Power BTE (Earhook)","SP BTE"],
    techLevels:["Standard"], rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"32ch · X platform · BTE Li-Ion · Rechargeable Li-Ion. Always available regardless of plan tier." },

  { id:"th5-bte-prem-li", manufacturer:"TruHearing", generation:"X",
    thSeries:"TH5", planTierKey:"Standard",
    family:"TH5 Premium — BTE Rechargeable (48ch)", styles:["bte"],
    variants:["Standard BTE (Thin-tube)","Standard BTE (Earhook)","Power BTE (Thin-tube)","Power BTE (Earhook)","SP BTE"],
    techLevels:["Standard"], rechargeable:true, liUpcharge:0,
    battery:["Rechargeable (Li-Ion)"], active:true,
    notes:"48ch · X platform · BTE Li-Ion · Rechargeable Li-Ion. Always available regardless of plan tier." },
];
const RECEIVER_LENGTHS = ["0","1","2","3","4","5"];


// ── TRUHEARING DEVICE CONFIG ──────────────────────────────────────────────────
// Encodes the TruHearing website's model/tier/style availability, gain/matrix
// options, color schemes, battery types, and dome options. Drives the private-label
// cascade in Step 3 to mirror the TruHearing ordering portal exactly.

const TH_STYLES = [
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

const TH_MODELS = [
  { id:"th7",   label:"TruHearing 7",    li:false },
  { id:"th7li", label:"TruHearing 7 Li", li:true },
  { id:"th6",   label:"TruHearing 6",    li:false },
  { id:"th6li", label:"TruHearing 6 Li", li:true },
  { id:"th5",   label:"TruHearing 5",    li:false },
  { id:"th5li", label:"TruHearing 5 Li", li:true },
];

// model|techLevel → [style IDs]
const TH_AVAILABILITY = {
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
  "th5li|Advanced": ["s_bte","p_bte","sp_bte"],
  "th5li|Premium":  ["s_bte","p_bte","sp_bte"],
};

// model+style → gain/matrix options; earmold:true means HP encased earmold
const TH_GAIN_MATRIX = {
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
const TH_COLORS = {
  ric_bte:  ["Beige","Dark Brown","Black","Granite","Sandy Brown"],
  slim_ric: ["Snow White/Rose Gold","Cosmic Blue/Rose Gold","Black/Silver","White","Black"],
  if_faceplate: ["Mocha","Black"],
  if_shell: ["Red/Blue"],
  custom_faceplate: ["Beige","Tan","Mocha","Brown","Dark Brown","Black"],
  custom_shell: ["Beige","Tan","Mocha","Brown","Dark Brown","Black"],
};

// Which style category each TH style belongs to (for color logic)
const TH_STYLE_COLOR_CATEGORY = {
  ric:"ric_bte", ric_bct:"ric_bte", s_bte:"ric_bte", p_bte:"ric_bte", sp_bte:"ric_bte",
  sr:"slim_ric",
  if:"if",
  iic:"custom", cic:"custom", itc:"custom", hs:"custom", fs:"custom",
};

// Battery type auto-determined by model+style
const TH_BATTERY = {
  "th7|iic":"Size 10 (Disposable)", "th7|cic":"Size 10 (Disposable)",
  "th7|itc":"Size 312 (Disposable)", "th7|hs":"Size 312 (Disposable)", "th7|fs":"Size 312 (Disposable)",
  "th7li|ric":"Rechargeable (Li-Ion)", "th7li|ric_bct":"Rechargeable (Li-Ion)", "th7li|sr":"Rechargeable (Li-Ion)", "th7li|if":"Rechargeable (Li-Ion)",
  "th6|ric":"Size 312 (Disposable)",
  "th6li|itc":"Rechargeable (Li-Ion)", "th6li|hs":"Rechargeable (Li-Ion)", "th6li|fs":"Rechargeable (Li-Ion)", "th6li|sr":"Rechargeable (Li-Ion)",
  "th5|if":"Size 10 (Disposable)",
  "th5li|s_bte":"Rechargeable (Li-Ion)", "th5li|p_bte":"Rechargeable (Li-Ion)", "th5li|sp_bte":"Rechargeable (Li-Ion)",
};

// TruHearing dome options — two-step: category → sizes
const TH_DOMES = {
  "Open":   ["5mm","7mm","10mm"],
  "Tulip":  ["8mm","12mm"],
  "Vented": ["XS","S","M","L","XL"],
  "Closed": ["XS","S","M","L","XL"],
  "Power":  ["XS","S","M","L","XL"],
};

// Styles that show receiver length + dome selection
const TH_RECEIVER_STYLES = ["ric","ric_bct","sr"];


// Per-manufacturer receiver power options. earmold:true = auto-requires earmold, no dome
const RECEIVER_POWERS = {
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
const SIGNIA_DOMES_GEN2 = [
  "Click Sleeve Open XS","Click Sleeve Open S","Click Sleeve Open M","Click Sleeve Open L",
  "Click Sleeve Closed XS","Click Sleeve Closed S","Click Sleeve Closed M","Click Sleeve Closed L",
  "Click Sleeve Power S","Click Sleeve Power M","Click Sleeve Power L",
  "Vented Sleeve XS","Vented Sleeve S","Vented Sleeve M","Vented Sleeve L",
];
const SIGNIA_DOMES_GEN3 = [
  "5mm Open","7mm Open","10mm Open",
  "7mm Tulip","10mm Tulip",
  "Vented Sleeve XS","Vented Sleeve S","Vented Sleeve M","Vented Sleeve L",
  "Closed Sleeve XS","Closed Sleeve S","Closed Sleeve M","Closed Sleeve L",
  "Power Sleeve XS","Power Sleeve S","Power Sleeve M","Power Sleeve L",
];
const SIGNIA_GEN3_PLATFORMS = ["AX","IX"];


// Returns dome options for a given manufacturer + generation
function getDomeOptions(manufacturer, generation) {
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
const CARE_PLANS = [
  { id:"paygo", label:"Pay-As-You-Go", price:"$65/visit" },
  { id:"complete", label:"Complete Care+", price:"$1,250" },
  { id:"punch", label:"Treatment Punch Card", price:"$575" },
];
const VISIT_TYPES = ["New Fitting","2-Week Follow-Up","4-Week Follow-Up","Quarterly Clean & Check","Annual Exam","Triage / Adjustment","Repair Appointment","Other"];


function genId() { return crypto.randomUUID(); }
function fmtDate(d) { return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function warrantyDate(fittingDate, years=3) {
  const d = new Date(fittingDate);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split("T")[0];
}
function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}


// ── AUDIOGRAM CONSTANTS ───────────────────────────────────────────────────────
const AUDIG_FREQS = [250,500,1000,2000,3000,4000,6000,8000];
const DEGREE_REGIONS = [
  {label:"Normal",       from:-10, to:20,  fill:"rgba(220,252,231,0.55)", color:"#16a34a"},
  {label:"Mild",         from:25,  to:40,  fill:"rgba(254,249,195,0.7)",  color:"#ca8a04"},
  {label:"Moderate",     from:40,  to:55,  fill:"rgba(254,215,170,0.7)",  color:"#ea580c"},
  {label:"Mod-Severe",   from:55,  to:70,  fill:"rgba(254,202,202,0.7)",  color:"#dc2626"},
  {label:"Severe",       from:70,  to:90,  fill:"rgba(252,165,165,0.6)",  color:"#b91c1c"},
  {label:"Profound",     from:90,  to:120, fill:"rgba(239,68,68,0.18)",   color:"#7f1d1d"},
];
function getPTA(t){
  const fs=[500,1000,2000,4000];
  const v=fs.map(f=>t?.[f]).filter(x=>x!=null);
  return v.length?Math.round(v.reduce((a,b)=>a+b)/v.length):null;
}
function getDegreeName(pta){
  if(pta==null)return null;
  if(pta<=20)return"Normal"; if(pta<=40)return"Mild";
  if(pta<=55)return"Moderate"; if(pta<=70)return"Moderately Severe";
  if(pta<=90)return"Severe"; return"Profound";
}
function getSlope(t){
  if(!t||t[500]==null||t[4000]==null)return"";
  return(t[4000]-t[500])>30?"sloping":(t[4000]-t[500])<-10?"rising":"flat";
}


function AudigramSVG({rightT={},leftT={},rightBC={},leftBC={},rightMask={},leftMask={},rightBCMask={},leftBCMask={},interactive=false,onSet,activeEar="right",activeTestType="AC",maskMode=false}){
  const W=600,H=340,ML=52,MT=42,MR=88,MB=24;
  const PW=W-ML-MR, PH=H-MT-MB;
  const fx=i=>ML+i*(PW/(AUDIG_FREQS.length-1));
  const dy=db=>MT+(db-(-10))/130*PH;

  const handleClick=e=>{
    if(!interactive)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const svgX=(e.clientX-rect.left)*(W/rect.width);
    const svgY=(e.clientY-rect.top)*(H/rect.height);
    const fi=Math.round((svgX-ML)/(PW/(AUDIG_FREQS.length-1)));
    if(fi<0||fi>=AUDIG_FREQS.length)return;
    const db=Math.round(((svgY-MT)/PH*130+(-10))/5)*5;
    const clamped=Math.max(-10,Math.min(120,db));
    const freq=AUDIG_FREQS[fi];
    const curMap=activeTestType==="BC"
      ?(activeEar==="right"?rightBC:leftBC)
      :(activeEar==="right"?rightT:leftT);
    onSet?.(activeEar,freq,curMap[freq]===clamped?null:clamped,activeTestType,maskMode);
  };

  const pts=thr=>AUDIG_FREQS.map((f,i)=>thr[f]!=null?`${fx(i)},${dy(thr[f])}`:null).filter(Boolean);
  const rPts=pts(rightT), lPts=pts(leftT);
  const rBCPts=pts(rightBC), lBCPts=pts(leftBC);

  // Symbol renderers
  const acRightSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(rightT[f]), s=interactive&&activeEar==="right"&&activeTestType==="AC"?7:6;
    const masked=rightMask[f];
    if(masked) return(
      <g key={"r"+f}>
        <polygon points={`${cx_},${cy_-s} ${cx_+s},${cy_+s} ${cx_-s},${cy_+s}`}
          fill="white" stroke="#dc2626" strokeWidth="2.5"/>
      </g>
    );
    return <circle key={"r"+f} cx={cx_} cy={cy_} r={s} fill="white" stroke="#dc2626" strokeWidth="2.5"/>;
  };

  const acLeftSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(leftT[f]), s=interactive&&activeEar==="left"&&activeTestType==="AC"?7:6;
    const masked=leftMask[f];
    if(masked) return(
      <g key={"l"+f}>
        <rect x={cx_-s} y={cy_-s} width={s*2} height={s*2}
          fill="white" stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
    return(
      <g key={"l"+f}>
        <line x1={cx_-s} y1={cy_-s} x2={cx_+s} y2={cy_+s} stroke="#2563eb" strokeWidth="2.5"/>
        <line x1={cx_+s} y1={cy_-s} x2={cx_-s} y2={cy_+s} stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
  };

  const bcRightSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(rightBC[f]), s=6;
    const masked=rightBCMask[f];
    if(masked) return(
      <g key={"rb"+f}>
        <path d={`M${cx_+s},${cy_-s} L${cx_-s+2},${cy_-s} L${cx_-s+2},${cy_+s} L${cx_+s},${cy_+s}`}
          fill="none" stroke="#dc2626" strokeWidth="2.5"/>
      </g>
    );
    return(
      <g key={"rb"+f}>
        <path d={`M${cx_+3},${cy_-s} L${cx_-s+2},${cy_} L${cx_+3},${cy_+s}`}
          fill="none" stroke="#dc2626" strokeWidth="2.5"/>
      </g>
    );
  };

  const bcLeftSymbol=(f,i)=>{
    const cx_=fx(i), cy_=dy(leftBC[f]), s=6;
    const masked=leftBCMask[f];
    if(masked) return(
      <g key={"lb"+f}>
        <path d={`M${cx_-s},${cy_-s} L${cx_+s-2},${cy_-s} L${cx_+s-2},${cy_+s} L${cx_-s},${cy_+s}`}
          fill="none" stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
    return(
      <g key={"lb"+f}>
        <path d={`M${cx_-3},${cy_-s} L${cx_+s-2},${cy_} L${cx_-3},${cy_+s}`}
          fill="none" stroke="#2563eb" strokeWidth="2.5"/>
      </g>
    );
  };

  return(
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{cursor:interactive?"crosshair":"default",fontFamily:"Sora,sans-serif",display:"block"}}
      onClick={handleClick}>
      {DEGREE_REGIONS.map(r=>(
        <rect key={r.label} x={ML} y={dy(r.from)} width={PW}
          height={Math.max(0,dy(Math.min(r.to,120))-dy(r.from))} fill={r.fill}/>
      ))}
      {DEGREE_REGIONS.map(r=>(
        <text key={r.label+"t"} x={ML+PW+5} y={dy((r.from+Math.min(r.to,120))/2)+4}
          fontSize="9" fill={r.color} fontWeight="700">{r.label}</text>
      ))}
      {AUDIG_FREQS.map((f,i)=>(
        <g key={f}>
          <line x1={fx(i)} y1={MT} x2={fx(i)} y2={MT+PH} stroke="#e5e7eb" strokeWidth="1"/>
          <text x={fx(i)} y={MT-12} fontSize="10" fill="#374151" textAnchor="middle" fontWeight="600">
            {f>=1000?f/1000+"k":f}
          </text>
          <text x={fx(i)} y={MT-2} fontSize="8" fill="#9ca3af" textAnchor="middle">Hz</text>
        </g>
      ))}
      {[-10,0,10,20,30,40,50,60,70,80,90,100,110,120].map(db=>(
        <g key={db}>
          <line x1={ML} y1={dy(db)} x2={ML+PW} y2={dy(db)}
            stroke={db===0?"#374151":"#e5e7eb"} strokeWidth={db===0?1.5:1}/>
          <text x={ML-6} y={dy(db)+4} fontSize="10" fill="#6b7280" textAnchor="end">{db}</text>
        </g>
      ))}
      <text x={ML-38} y={MT+PH/2} fontSize="10" fill="#9ca3af" textAnchor="middle"
        transform={`rotate(-90,${ML-38},${MT+PH/2})`}>Hearing Level (dB HL)</text>
      <text x={ML+PW/2} y={H-2} fontSize="10" fill="#9ca3af" textAnchor="middle">Frequency (Hz)</text>
      {/* AC polylines */}
      {rPts.length>1&&<polyline points={rPts.join(" ")} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeOpacity="0.7"/>}
      {lPts.length>1&&<polyline points={lPts.join(" ")} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.7"/>}
      {/* BC polylines (dashed) */}
      {rBCPts.length>1&&<polyline points={rBCPts.join(" ")} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 3"/>}
      {lBCPts.length>1&&<polyline points={lBCPts.join(" ")} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 3"/>}
      {/* AC symbols */}
      {AUDIG_FREQS.map((f,i)=>rightT[f]!=null&&acRightSymbol(f,i))}
      {AUDIG_FREQS.map((f,i)=>leftT[f]!=null&&acLeftSymbol(f,i))}
      {/* BC symbols */}
      {AUDIG_FREQS.map((f,i)=>rightBC[f]!=null&&bcRightSymbol(f,i))}
      {AUDIG_FREQS.map((f,i)=>leftBC[f]!=null&&bcLeftSymbol(f,i))}
      {/* Legend */}
      <circle cx={ML+4} cy={MT-26} r="4" fill="white" stroke="#dc2626" strokeWidth="2"/>
      <text x={ML+12} y={MT-22} fontSize="9" fill="#dc2626" fontWeight="600">R AC</text>
      <g transform={`translate(${ML+44},${MT-26})`}>
        <line x1={-4} y1={-4} x2={4} y2={4} stroke="#2563eb" strokeWidth="2"/>
        <line x1={4} y1={-4} x2={-4} y2={4} stroke="#2563eb" strokeWidth="2"/>
      </g>
      <text x={ML+52} y={MT-22} fontSize="9" fill="#2563eb" fontWeight="600">L AC</text>
      <path d={`M${ML+92},${MT-31} L${ML+84},${MT-26} L${ML+92},${MT-21}`} fill="none" stroke="#dc2626" strokeWidth="2"/>
      <text x={ML+96} y={MT-22} fontSize="9" fill="#dc2626" fontWeight="600">R BC</text>
      <path d={`M${ML+128},${MT-31} L${ML+136},${MT-26} L${ML+128},${MT-21}`} fill="none" stroke="#2563eb" strokeWidth="2"/>
      <text x={ML+140} y={MT-22} fontSize="9" fill="#2563eb" fontWeight="600">L BC</text>
    </svg>
  );
}


// ── COUNSELING NARRATIVE GENERATOR ─────────────────────────────────────────
function generateCounseling(aud){
  if(!aud)return null;
  const rPTA=getPTA(aud.rightT), lPTA=getPTA(aud.leftT);
  const rDeg=getDegreeName(rPTA), lDeg=getDegreeName(lPTA);
  const rSlope=getSlope(aud.rightT), lSlope=getSlope(aud.leftT);
  const hasPT=rPTA!=null||lPTA!=null;
  const hasCCT=aud.unaidedR!=null||aud.unaidedL!=null;
  const hasAided=aud.aidedR!=null||aud.aidedL!=null;
  const hasSIN=aud.sinBin!=null;
  if(!hasPT&&!hasCCT&&!hasSIN)return null;


  const slopeSentence=slope=>slope==="sloping"
    ?" The loss drops significantly toward the high frequencies — this affects the consonants that carry meaning (S, F, TH, SH, K), which is why speech often sounds muffled even when it's loud enough.":"";


  const ptaSection=()=>{
    if(!hasPT)return null;
    const both=rDeg&&lDeg;
    const desc=both&&rDeg===lDeg
      ?`a ${rDeg.toLowerCase()} hearing loss in both ears`
      :[rDeg&&`a ${rDeg.toLowerCase()} loss in the right ear`,lDeg&&`a ${lDeg.toLowerCase()} loss in the left ear`].filter(Boolean).join(" and ");
    const maxPTA=Math.max(rPTA??0,lPTA??0);
    return{
      heading:"What your audiogram shows",
      body:`Your results indicate ${desc}.${slopeSentence(rSlope)} Sounds need to be approximately ${maxPTA} dB louder than normal before they register clearly — that's not a small gap. What we're looking at here isn't just "needing the TV up a bit." This is the measurable reason conversations feel like work.`
    };
  };


  const cctSection=()=>{
    if(!hasCCT)return null;
    const r=aud.unaidedR, l=aud.unaidedL;
    const worst=Math.min(r??100,l??100);
    const gap=100-worst;
    const earStr=r!=null&&l!=null?`right (${r}%) and left (${l}%)`
      :r!=null?`right ear: ${r}%`:`left ear: ${l}%`;
    return{
      heading:"How your loss affects word clarity",
      body:`At 45 dB — the softest level at which someone with normal hearing scores 100% on this assessment — you scored ${earStr}. Think of this as the audiological equivalent of the 20/20 line at an eye exam. The ${gap}% gap${gap>25?" isn't subtle — it represents real, measurable difficulty with everyday speech clarity. Not volume, but clarity. Letters and words that sound similar become genuinely hard to separate.":gap>10?" shows meaningful impact on speech clarity, particularly in less-than-ideal conditions.":" reflects very good word recognition ability given the degree of loss."}`
    };
  };


  const aidedSection=()=>{
    if(!hasAided)return null;
    const r=aud.aidedR, l=aud.aidedL;
    const ur=aud.unaidedR, ul=aud.unaidedL;
    const rDelta=r!=null&&ur!=null?r-ur:null;
    const lDelta=l!=null&&ul!=null?l-ul:null;
    const bestDelta=Math.max(rDelta??0,lDelta??0);
    const earStr=r!=null&&l!=null?`right (${r}%) and left (${l}%)`
      :r!=null?`right ear: ${r}%`:`left ear: ${l}%`;
    return{
      heading:"Your potential with correction",
      body:`At your most comfortable listening level — with properly fitted amplification — you scored ${earStr} on speech recognition. ${(r??0)>=85||(l??0)>=85?"This is an excellent result. Your word recognition potential is strong, which means you'll adapt well and get substantial benefit from treatment.":((r??0)>=70||(l??0)>=70)?"This is a solid result and reflects good potential with hearing aids.":"This score, combined with your audiogram, helps us select technology that best suits your pattern of loss."}`
    };
  };


  const sinSection=()=>{
    if(!hasSIN)return null;
    const snr=aud.sinBin;
    if(snr==null)return null;
    const label=snr<=2?"near-normal":snr<=7?"mild":snr<=15?"moderate":"severe";
    const body=snr<=2
      ?`Your ability to separate speech from background noise is near-normal — you have a real advantage here compared to most patients I see. Noisy environments may still feel tiring, but technology will provide meaningful support.`
      :snr<=7
      ?`You need about ${snr} dB more signal-to-noise separation than someone with normal hearing. This quantifies exactly why restaurants, meetings, and group conversations feel like hard work — your auditory system is doing extra processing just to keep up. Modern hearing aids with directional processing and noise management can recover a meaningful portion of this gap.`
      :snr<=15
      ?`You need ${snr} dB more separation between speech and noise than normal — this is a significant deficit that explains why noisy environments feel genuinely exhausting, not just inconvenient. Most patients are relieved to have this validated. Premium technology with advanced noise management provides real improvement, though complex environments will remain the hardest situation regardless of technology.`
      :`With an SNR Loss of ${snr} dB, competing noise creates serious difficulty that goes well beyond what most people experience. Understanding this upfront is important — it sets honest expectations. What technology does here is reduce fatigue, extend your effective range, and make the best situations better. That's a meaningful quality-of-life change even if the hardest environments remain hard.`;
    return{heading:`Background noise: ${label} difficulty (${snr} dB SNR Loss)`,body};
  };


  return[ptaSection(),cctSection(),aidedSection(),sinSection()].filter(Boolean);
}


// ── WIZARD STEPS ──────────────────────────────────────────────────────────────
const STEPS = ["Patient","Testing","Results","Device Selection","Care Plan","Review"];


// ── ROLE CHECK UTILITY ─────────────────────────────────────────────────────────
// Role categories: 'care_coordinator' | 'provider' | 'admin'
// TODO: Wire up real restrictions — replace body with:
//   return Array.isArray(allowedRoles) && allowedRoles.includes(staffRole)
// Currently returns true for all roles so all staff can do everything.
// eslint-disable-next-line no-unused-vars
function checkRole(_staffRole, _allowedRoles) {
  return true; // TODO: enforce when roles are configured
}


export default function ProviderCRM({ staffId, clinicId }) {
  const [clinic, setClinic] = useState(DEFAULT_CLINIC);
  const [clinicDraft, setClinicDraft] = useState(DEFAULT_CLINIC);
  const [clinicSaved, setClinicSaved] = useState(false);
  const [view, setView] = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [punchData, setPunchData] = useState({ cleanings: 0, appointments: 0, log: [] });
  const [punchConfirm, setPunchConfirm] = useState(null);
  const [punchSuccess, setPunchSuccess] = useState(null);

  // ── Patient detail inline edit state ─────────────────────────────────────
  // editSection: 'contact' | 'coverage' | 'devices' | 'campaign' | null
  const [editSection,    setEditSection]    = useState(null);
  const [editDraft,      setEditDraft]      = useState(null);
  const [editSaving,     setEditSaving]     = useState(false);
  const [editError,      setEditError]      = useState(null);
  const [editSuccess,    setEditSuccess]    = useState(null);
  const [patientCampaigns, setPatientCampaigns] = useState([]);
  const [editPlanSearch, setEditPlanSearch] = useState("");

  // ── Intake queue state ────────────────────────────────────────────────
  const [pendingIntakes,  setPendingIntakes]  = useState([]);
  const [intakeToast,     setIntakeToast]     = useState(null);
  const [showIntakeQueue, setShowIntakeQueue] = useState(false);
  const seenIntakeIds = useRef(new Set());


  // Insurance plans from Supabase + retail anchors for pricing reveal
  const [insurancePlans, setInsurancePlans] = useState([]);
  const [retailAnchors, setRetailAnchors] = useState([]);
  const [pricingReveal, setPricingReveal] = useState(null);

  // ── Purchase Agreement state ──────────────────────────────────────────
  const [staffProfile, setStaffProfile] = useState(null);
  const [showPurchaseAgreement, setShowPurchaseAgreement] = useState(false);
  const [paSignatureName, setPaSignatureName] = useState("");
  const [paStep, setPaStep] = useState("sign"); // 'sign' | 'delivery' | 'done'
  const [paDeliveryName, setPaDeliveryName] = useState("");
  const [paDeliveryDate, setPaDeliveryDate] = useState("");

  // ── Wizard PA / Quote fork state ─────────────────────────────────────
  const [showWizardPaModal, setShowWizardPaModal] = useState(false);
  const [wizardPaSigned, setWizardPaSigned] = useState(false);
  const [wizardPaSignatureDate, setWizardPaSignatureDate] = useState(null);

  // Product catalog state
  const [catalog, setCatalog] = useState(CATALOG_DEFAULT);
  const [catEditId, setCatEditId] = useState(null);      // which entry is open for editing
  const [catDraft, setCatDraft] = useState(null);         // draft of entry being edited
  const [catAddChip, setCatAddChip] = useState({});       // { fieldKey: inputValue } for chip editors
  const [catSearch, setCatSearch] = useState("");
  const [catNewEntry, setCatNewEntry] = useState(false);



  const saveCatalog = async (next) => {
    setCatalog(next);
    try { await saveProductCatalog(next); } catch {}
  };


  const EMPTY_SIDE = () => ({
    style:"", manufacturer:"", generation:"", familyId:"", variant:"",
    techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false,
    thModel:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:""
  });


  // New patient form state
  const [form, setForm] = useState({
    firstName:"", lastName:"", dob:"", phone:"", email:"", address:"",
    payType:"insurance",
    carrier:"", planGroup:"", tpa:"", tier:"", tierPrice:null,
    left: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false, thModel:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:""},
    right: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false, thModel:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:""},
    audiology: { rightT:{}, leftT:{}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:null, unaidedL:null, aidedR:null, aidedL:null, sinBin:null },
    carePlan:"",
    appointments:[],
    notes:"",
  });


  const [activeSide, setActiveSide] = useState("left");
  const [audEar, setAudEar] = useState("right");
  const [audTestType, setAudTestType] = useState("AC");
  const [maskMode, setMaskMode] = useState(false);

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressOpen, setAddressOpen] = useState(false);
  const addressTimer = useRef(null);
  const addressRef = useRef(null);

  const searchAddress = (query) => {
    clearTimeout(addressTimer.current);
    upd("address", query);
    if (query.length < 4) { setAddressSuggestions([]); setAddressOpen(false); return; }
    addressTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=us&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        setAddressSuggestions(data);
        setAddressOpen(data.length > 0);
      } catch (e) { console.error("Address search:", e); }
    }, 300);
  };

  const selectAddress = (item) => {
    upd("address", item.display_name);
    setAddressOpen(false);
    setAddressSuggestions([]);
  };

  useEffect(() => {
    const close = (e) => { if (addressRef.current && !addressRef.current.contains(e.target)) setAddressOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);


  const upd = (k,v) => setForm(f => ({...f,[k]:v}));
  const updSide = (side, k, v) => setForm(f => ({...f, [side]: {...f[side], [k]: v}}));
  const resetSide = (side, partial={}) => setForm(f => ({...f, [side]: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", isCROS:false, thModel:"", faceplateColor:"", shellColor:"", gainMatrix:"", domeCategory:"", domeSize:"", ...partial}}));

  // Private-label (TruHearing Select) plan detection — must be defined before useEffects that reference it
  const isPrivateLabelPlan = (plan) =>
    plan?.tiers?.length > 0 && plan.tiers.every(t => ["Standard","Advanced","Premium"].includes(t.label));
  const selectedInsurancePlan = INSURANCE_PLANS.find(p => p.carrier === form.carrier && p.planGroup === form.planGroup);
  const isPrivateLabel = form.payType === "insurance" && isPrivateLabelPlan(selectedInsurancePlan);
  const privateLabelTiers = isPrivateLabel ? (selectedInsurancePlan?.tiers || []) : [];


  useEffect(() => {
    loadAllPatients().then(p => { setPatients(p); setLoading(false); });
    (async () => {
      try {
        if (clinicId) {
          const saved = await loadClinicSettings(clinicId);
          if (saved) { setClinic(saved); setClinicDraft(saved); }
        }
      } catch {}
      try {
        const cat = await loadProductCatalog();
        if (cat?.length) setCatalog(cat);
      } catch {}
      try {
        const plans = await loadInsurancePlans();
        if (plans?.length) setInsurancePlans(plans);
      } catch {}
      try {
        if (clinicId) {
          const anchors = await loadRetailAnchors(clinicId);
          if (anchors?.length) setRetailAnchors(anchors);
        }
      } catch {}
      try {
        if (staffId) {
          const profile = await loadStaffProfile(staffId);
          if (profile) setStaffProfile(profile);
        }
      } catch {}
    })();
  }, [clinicId]);


  const refreshPatients = async () => {
    const p = await loadAllPatients();
    setPatients(p);
  };


  // ── Patient detail edit handlers ──────────────────────────────────────────

  const cancelEdit = () => {
    setEditSection(null);
    setEditDraft(null);
    setEditError(null);
    setEditSuccess(null);
  };

  const startEditContact = () => {
    const p = selectedPatient;
    const parts = (p.name || "").trim().split(/\s+/);
    const lastName  = parts.length > 1 ? parts.pop() : "";
    const firstName = parts.join(" ");
    setEditDraft({ firstName, lastName, phone: p.phone || "", email: p.email || "", dob: p.dob || "", payType: p.payType || "insurance", notes: p.notes || "" });
    setEditSection("contact");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditContact = async () => {
    setEditSaving(true); setEditError(null);
    try {
      await updatePatientContact(selectedPatient.id, {
        first_name: editDraft.firstName,
        last_name:  editDraft.lastName,
        phone:      editDraft.phone  || null,
        email:      editDraft.email  || null,
        dob:        editDraft.dob    || null,
        pay_type:   editDraft.payType,
        notes:      editDraft.notes  || null,
      });
      const newName = [editDraft.firstName, editDraft.lastName].filter(Boolean).join(" ");
      setSelectedPatient(p => ({ ...p, name: newName, phone: editDraft.phone, email: editDraft.email, dob: editDraft.dob, payType: editDraft.payType, notes: editDraft.notes }));
      setPatients(prev => prev.map(pt => pt.id === selectedPatient.id ? { ...pt, name: newName, phone: editDraft.phone, email: editDraft.email } : pt));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const startEditCoverage = () => {
    const p = selectedPatient;
    setEditDraft({
      carrier:        p.insurance?.carrier    || "",
      planGroup:      p.insurance?.planGroup  || "",
      tpa:            p.insurance?.tpa        || "",
      tier:           p.insurance?.tier       || "",
      tierPrice:      p.insurance?.tierPrice  ?? null,
      carePlanType:   p.carePlan              || "",
      warrantyExpiry: p.devices?.warrantyExpiry || "",
    });
    setEditPlanSearch("");
    setEditSection("coverage");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditCoverage = async () => {
    setEditSaving(true); setEditError(null);
    try {
      const planId = await resolveInsurancePlanId(
        editDraft.carrier, editDraft.planGroup, editDraft.tier
      );
      await updateInsuranceCoverage(
        selectedPatient.id,
        {
          carrier:            editDraft.carrier        || null,
          plan_group:         editDraft.planGroup      || null,
          tpa:                editDraft.tpa            || null,
          tier:               editDraft.tier           || null,
          tier_price_per_aid: editDraft.tierPrice != null ? Math.round(editDraft.tierPrice * 100) : null,
          insurance_plan_id:  planId,
          care_plan_type:     editDraft.carePlanType   || null,
          warranty_expiry:    editDraft.warrantyExpiry || null,
        },
        selectedPatient._ids?.coverageId || null
      );
      setSelectedPatient(p => ({
        ...p,
        carePlan: editDraft.carePlanType,
        insurance: { ...p.insurance, carrier: editDraft.carrier, planGroup: editDraft.planGroup, tpa: editDraft.tpa, tier: editDraft.tier, tierPrice: editDraft.tierPrice },
        devices: p.devices ? { ...p.devices, warrantyExpiry: editDraft.warrantyExpiry } : p.devices,
        _ids: { ...p._ids, coverageId: p._ids?.coverageId || "pending" },
      }));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const startEditDevices = () => {
    const d = selectedPatient.devices || {};
    const resolveFamily = (side) => {
      if (!side) return EMPTY_SIDE();
      const match = catalog.find(e =>
        e.family === side.family &&
        e.manufacturer === side.manufacturer &&
        e.generation === side.generation
      );
      return {
        style:          side.style          || "",
        manufacturer:   side.manufacturer   || "",
        generation:     side.generation     || "",
        familyId:       match?.id           || "",
        variant:        side.variant        || "",
        techLevel:      side.techLevel      || "",
        color:          side.color          || "",
        battery:        side.battery        || "",
        receiverLength: side.receiverLength || "",
        receiverPower:  side.receiverPower  || "",
        dome:           side.dome           || "",
        isCROS:         false,
        thModel:        side.thModel        || "",
        faceplateColor: side.faceplateColor || "",
        shellColor:     side.shellColor     || "",
        gainMatrix:     side.gainMatrix     || "",
        domeCategory:   side.domeCategory   || "",
        domeSize:       side.domeSize       || "",
      };
    };
    setEditDraft({
      serialLeft:     d.serialLeft     || "",
      serialRight:    d.serialRight    || "",
      warrantyExpiry: d.warrantyExpiry || "",
      fittingType:    d.fittingType    || "Bilateral",
      left:  resolveFamily(d.left),
      right: resolveFamily(d.right),
    });
    setEditSection("devices");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditDevices = async () => {
    setEditSaving(true); setEditError(null);
    try {
      const { fittingId, leftSideId, rightSideId } = selectedPatient._ids || {};
      if (fittingId) {
        await updateDeviceFitting(fittingId, {
          serial_left:     editDraft.serialLeft     || null,
          serial_right:    editDraft.serialRight    || null,
          warranty_expiry: editDraft.warrantyExpiry || null,
          fitting_type:    editDraft.fittingType    || null,
        });
      }
      const buildSideFields = (s) => ({
        manufacturer:    s.manufacturer    || null,
        family:          catalog.find(e => e.id === s.familyId)?.family || s.family || null,
        generation:      s.generation      || null,
        variant:         s.variant         || null,
        tech_level:      s.techLevel       || null,
        style:           s.style           || null,
        color:           s.color           || null,
        battery:         s.battery         || null,
        receiver_length: s.receiverLength  || null,
        receiver_power:  s.receiverPower   || null,
        dome:            s.dome            || null,
        th_model:        s.thModel         || null,
        faceplate_color: s.faceplateColor  || null,
        shell_color:     s.shellColor      || null,
        gain_matrix:     s.gainMatrix      || null,
        dome_category:   s.domeCategory    || null,
        dome_size:       s.domeSize        || null,
      });
      if (leftSideId  && editDraft.left)  await updateDeviceSide(leftSideId,  buildSideFields(editDraft.left));
      if (rightSideId && editDraft.right) await updateDeviceSide(rightSideId, buildSideFields(editDraft.right));
      const resolveLeft = editDraft.left ? { ...editDraft.left, family: catalog.find(e=>e.id===editDraft.left.familyId)?.family || editDraft.left.family || "" } : null;
      const resolveRight = editDraft.right ? { ...editDraft.right, family: catalog.find(e=>e.id===editDraft.right.familyId)?.family || editDraft.right.family || "" } : null;
      setSelectedPatient(p => ({
        ...p,
        devices: { ...p.devices, serialLeft: editDraft.serialLeft, serialRight: editDraft.serialRight, warrantyExpiry: editDraft.warrantyExpiry, fittingType: editDraft.fittingType, left: resolveLeft || p.devices?.left, right: resolveRight || p.devices?.right },
      }));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const startEditCampaign = (campaign) => {
    const deliveries = (campaign.campaign_deliveries || [])
      .sort((a, b) => (a.campaign_steps?.step_order ?? 0) - (b.campaign_steps?.step_order ?? 0))
      .map(d => ({ id: d.id, stepOrder: d.campaign_steps?.step_order ?? 0, delayDays: d.campaign_steps?.delay_days ?? 0, channel: d.campaign_steps?.delivery_channel || "", status: d.status, scheduledDate: d.scheduled_date || "" }));
    setEditDraft({ campaignId: campaign.id, status: campaign.status, triggerDate: campaign.trigger_date || "", deliveries });
    setEditSection("campaign");
    setEditError(null);
    setEditSuccess(null);
  };

  const saveEditCampaign = async () => {
    setEditSaving(true); setEditError(null);
    try {
      await updatePatientCampaign(editDraft.campaignId, { status: editDraft.status, trigger_date: editDraft.triggerDate || null });
      for (const d of (editDraft.deliveries || [])) {
        if (d.scheduledDate) await updateDeliveryDate(d.id, d.scheduledDate);
      }
      setPatientCampaigns(prev => prev.map(c => c.id === editDraft.campaignId ? { ...c, status: editDraft.status, trigger_date: editDraft.triggerDate } : c));
      setEditSuccess("Saved");
      setTimeout(() => { setEditSection(null); setEditSuccess(null); }, 1400);
    } catch (err) {
      setEditError(err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Intake toast + Supabase Realtime subscription ─────────────────────
  const fireIntakeToast = useCallback((intake) => {
    const id = intake._meta?.intakeId;
    if (!id || seenIntakeIds.current.has(id)) return;
    seenIntakeIds.current.add(id);
    const name = `${intake.answers?.firstName || ""} ${intake.answers?.lastName || ""}`.trim() || "New Patient";
    setIntakeToast({ name, intakeId: id });
    let flashing = true;
    const orig = document.title;
    const flashInterval = setInterval(() => {
      document.title = flashing ? `● New Intake — Distil` : orig;
      flashing = !flashing;
    }, 800);
    setTimeout(() => { clearInterval(flashInterval); document.title = orig; }, 12000);
  }, []);

  useEffect(() => {
    loadPendingIntakes().then(pending => {
      setPendingIntakes(pending);
      pending.forEach(fireIntakeToast);
    });
    if (!clinicId) return;
    const unsubscribe = subscribeToIntakes(clinicId, (intake) => {
      setPendingIntakes(prev => [...prev, intake]);
      fireIntakeToast(intake);
    });
    return unsubscribe;
  }, [clinicId, fireIntakeToast]);


  // Load campaigns whenever the patient detail view is opened
  useEffect(() => {
    if (view === "patient" && selectedPatient?.id) {
      setPatientCampaigns([]);
      loadPatientCampaigns(selectedPatient.id).then(setPatientCampaigns).catch(() => {});
    }
    // Reset edit state when navigating away from patient
    if (view !== "patient") {
      setEditSection(null);
      setEditDraft(null);
    }
  }, [view, selectedPatient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear non-TruHearing device selections when a private-label plan is chosen
  useEffect(() => {
    if (!isPrivateLabel) return;
    const emptySide = {style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:"",isCROS:false};
    setForm(f => ({
      ...f,
      left:  (f.left.manufacturer && f.left.manufacturer !== "TruHearing")  ? {...emptySide} : f.left,
      right: (f.right.manufacturer && f.right.manufacturer !== "TruHearing") ? {...emptySide} : f.right,
    }));
  }, [isPrivateLabel]); // eslint-disable-line react-hooks/exhaustive-deps


  const buildSideRecord = (s) => {
    if (!s.familyId && s.manufacturer !== "TruHearing") return null;
    if (s.manufacturer === "TruHearing" && (!s.techLevel || !s.thModel)) return null;
    if (s.manufacturer === "TruHearing") {
      const thMod = TH_MODELS.find(m => m.id === s.thModel);
      const isRIC = ["ric","ric_bct","sr"].includes(s.style);
      const thGainLabel = s.gainMatrix || s.receiverPower || "";
      const thGainEntry = s.thModel && s.style ? (TH_GAIN_MATRIX[`${s.thModel}|${s.style}`]||[]).find(g=>g.id===s.gainMatrix) : null;
      const thIsEarmold = thGainEntry?.earmold || false;
      const thDome = thIsEarmold ? "Custom Earmold" : (s.domeCategory && s.domeSize ? `${s.domeCategory} ${s.domeSize}` : s.domeCategory || s.dome || "");
      return {
        manufacturer: "TruHearing",
        generation: "IX",
        family: thMod?.label || "TruHearing Select",
        thModel: s.thModel || "",
        thSeries: "",
        rechargeable: thMod?.li || false,
        liUpcharge: 0,
        variant: s.isCROS ? "CROS Transmitter" : (s.variant || ""),
        techLevel: s.techLevel, style: s.style || "ric",
        color: "", battery: s.battery || "",
        receiverLength: isRIC ? (s.receiverLength || "") : "",
        receiverPower: isRIC ? thGainLabel : "",
        gainMatrix: s.gainMatrix || "",
        domeCategory: s.domeCategory || "",
        domeSize: s.domeSize || "",
        receiver: isRIC && s.receiverLength && thGainLabel
          ? `Length ${s.receiverLength} · ${thGainLabel}` : "",
        dome: isRIC ? thDome : "",
      };
    }
    const fam = catalog.find(e => e.id === s.familyId);
    const pwrLabel = (RECEIVER_POWERS[s.manufacturer]||[]).find(p=>p.id===s.receiverPower)?.label || s.receiverPower;
    const isEarmold = (RECEIVER_POWERS[s.manufacturer]||[]).find(p=>p.id===s.receiverPower)?.earmold;
    return {
      manufacturer: s.manufacturer, generation: s.generation, family: fam?.family || "",
      variant: s.variant, techLevel: s.techLevel, style: s.style,
      color: s.color, battery: s.battery,
      receiverLength: s.style==="ric" ? s.receiverLength : "",
      receiverPower: s.style==="ric" ? s.receiverPower : "",
      receiver: s.style==="ric" && s.receiverLength && s.receiverPower ? `Length ${s.receiverLength} · ${pwrLabel}` : "",
      dome: s.style==="ric" ? (isEarmold ? "Custom Earmold" : s.dome) : "",
    };
  };

  // ── Generate Quote PDF from wizard state ─────────────────────────────
  const handleGenerateQuote = () => {
    const leftRec = buildSideRecord(form.left);
    const rightRec = buildSideRecord(form.right);
    const isCROS = [leftRec, rightRec].some(r => r?.variant?.toLowerCase().includes("cros")) || form.left.isCROS || form.right.isCROS;
    const fittingType = leftRec && rightRec ? (isCROS ? "cros_bicros" : "bilateral") : leftRec ? "monaural_left" : "monaural_right";
    const counselingSections = generateCounseling(form.audiology); // returns array of {heading,body} or null
    downloadQuote({
      patient: { name: [form.firstName, form.lastName].filter(Boolean).join(" "), phone: form.phone },
      devices: { fittingType, left: leftRec, right: rightRec },
      pricePerAid: form.tierPrice || 0,
      selectedCarePlan: form.carePlan || "complete",
      payType: form.payType,
      tpa: form.tpa,
      carrier: form.carrier,
      audiology: form.audiology,
      counselingSections: counselingSections,
      clinic: staffProfile?.clinic || clinic,
      provider: { fullName: staffProfile?.fullName || "Provider", activeLicense: staffProfile?.activeLicense || "" },
    });
  };


  const handleSave = async () => {
    setSaveError(null);
    const leftRec = buildSideRecord(form.left);
    const rightRec = buildSideRecord(form.right);
    const primary = leftRec || rightRec;
    const isCROS = [leftRec, rightRec].some(r => r?.variant?.toLowerCase().includes("cros"))
      || form.left.isCROS || form.right.isCROS;
    const fittingType = leftRec && rightRec ? (isCROS ? "CROS/BiCROS" : "Bilateral") : leftRec ? "Monaural Left" : "Monaural Right";
    const years = form.payType === "insurance" && form.carePlan === "complete" ? 4 : 3;
    // Warranty starts 14 days after PA signature (average fitting lead time), or today if no PA signed
    const warrantyStart = wizardPaSignatureDate
      ? new Date(new Date(wizardPaSignatureDate).getTime() + 14 * 86400000).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    const patient = {
      id: genId(),
      location: clinic.name,
      createdAt: new Date().toISOString(),
      name: [form.firstName, form.lastName].filter(Boolean).join(" "),
      dob: form.dob,
      phone: form.phone,
      email: form.email,
      address: form.address,
      payType: form.payType,
      insurance: form.payType === "insurance" ? { carrier: form.carrier, planGroup: form.planGroup, tpa: form.tpa, tier: form.tier, tierPrice: form.tierPrice } : null,
      devices: {
        left: leftRec,
        right: rightRec,
        fittingType,
        manufacturer: primary?.manufacturer || "",
        family: primary?.family || "",
        techLevel: primary?.techLevel || "",
        style: primary?.style || "",
        color: primary?.color || "",
        battery: primary?.battery || "",
        fittingDate: warrantyStart,
        warrantyExpiry: wizardPaSigned ? warrantyDate(warrantyStart, years) : null,
        serialLeft: genId(),
        serialRight: genId(),
      },
      audiology: form.audiology,
      carePlan: form.payType === "insurance" ? form.carePlan : null,
      appointments: form.appointments,
      notes: form.notes,
    };
    try {
      await savePatient(patient, staffId, clinicId);
      setSaved(true);
      await refreshPatients();
      setSelectedPatient(patient);
      setPunchData({ cleanings: 0, appointments: 0, log: [] });
      setView("patient");
    } catch (err) {
      console.error("savePatient error:", err);
      setSaveError(err?.message || err?.toString() || "Unknown error — check console");
    }
  };


  const startNew = () => {
    setForm({ firstName:"",lastName:"",dob:"",phone:"",email:"",payType:"insurance",carrier:"",planGroup:"",tpa:"",tier:"",tierPrice:null,left:{style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:"",isCROS:false},right:{style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:"",isCROS:false},audiology:{rightT:{},leftT:{},rightBC:{},leftBC:{},rightMask:{},leftMask:{},rightBCMask:{},leftBCMask:{},tinnitusRight:false,tinnitusLeft:false,unaidedR:null,unaidedL:null,aidedR:null,aidedL:null,sinBin:null},carePlan:"",appointments:[],notes:"" });
    setActiveSide("left");
    setShowWizardPaModal(false); setWizardPaSigned(false); setWizardPaSignatureDate(null);
    setStep(0); setSaved(false); setView("new");
  };


  // ── Intake queue handlers ────────────────────────────────────────────
  const handleAcceptIntake = (intake) => {
    const a = intake.answers || {};
    const phone = a.phone || "";
    const digits = phone.replace(/\D/g,"").slice(0,10);
    let fmt = digits;
    if (digits.length >= 7) fmt = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    else if (digits.length >= 4) fmt = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    else if (digits.length > 0) fmt = `(${digits}`;
    setForm(f => ({
      ...f,
      firstName:  a.firstName  || "",
      lastName:   a.lastName   || "",
      dob:        a.dob        || "",
      phone:      fmt,
      email:      a.email      || "",
      payType:    a.payType    || "insurance",
      carrier:    a.carrier    || "",
      notes: [f.notes, intake._meta?.intakeId ? `Intake ID: ${intake._meta.intakeId}` : ""].filter(Boolean).join("\n"),
    }));
    try { dbAcceptIntake(intake._meta.intakeId); } catch {}
    setPendingIntakes(prev => prev.filter(i => i._meta?.intakeId !== intake._meta?.intakeId));
    setShowIntakeQueue(false);
    setStep(0); setSaved(false); setView("new");
  };

  const handleDismissIntake = async (intakeId) => {
    try { await dismissIntake(intakeId); } catch {}
    setPendingIntakes(prev => prev.filter(i => i._meta?.intakeId !== intakeId));
  };


  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState(null);
  const handleSeedPatients = async () => {
    setSeeding(true); setSeedError(null);
    const seeds = [
      {
        id: genId(), location: clinic.name, createdAt: new Date().toISOString(),
        name: "Margaret Thornton", dob: "1948-03-12", phone: "(435) 555-0191", email: "margaret.thornton@email.com",
        payType: "insurance",
        insurance: { carrier: "Humana", planGroup: "Medicare Advantage", tpa: "TruHearing", tier: "Advanced", tierPrice: 0 },
        devices: {
          left: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"7", style:"ric", color:"Silver", battery:"Rechargeable", receiverLength:"2", receiverPower:"M", receiver:"Length 2 · Medium (M)", dome:"7mm Open" },
          right: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"7", style:"ric", color:"Silver", battery:"Rechargeable", receiverLength:"2", receiverPower:"M", receiver:"Length 2 · Medium (M)", dome:"7mm Open" },
          fittingType:"Bilateral", manufacturer:"Signia", family:"Pure Charge&Go IX", techLevel:"7", style:"ric", color:"Silver", battery:"Rechargeable",
          fittingDate: "2025-01-15", warrantyExpiry: warrantyDate("2025-01-15", 4), serialLeft: genId(), serialRight: genId(),
        },
        audiology: { rightT:{500:35,1000:40,2000:50,4000:65,8000:70}, leftT:{500:30,1000:40,2000:45,4000:60,8000:65}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:72, unaidedL:78, aidedR:92, aidedL:94, sinBin:7 },
        carePlan: "complete", appointments: [{ date:"2025-01-29", type:"2-Week Follow-Up" },{ date:"2025-02-12", type:"4-Week Follow-Up" }], notes: "Patient reports excellent satisfaction. Prefers telephone streaming.",
      },
      {
        id: genId(), location: clinic.name, createdAt: new Date().toISOString(),
        name: "Robert Hatch", dob: "1955-07-22", phone: "(435) 555-0347", email: "",
        payType: "insurance",
        insurance: { carrier: "DMBA", planGroup: "Deseret Secure; Deseret Alliance", tpa: "TruHearing", tier: "Level 3", tierPrice: 1199 },
        devices: {
          left: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"5", style:"ric", color:"Graphite", battery:"Rechargeable", receiverLength:"2", receiverPower:"P", receiver:"Length 2 · Power (P)", dome:"Closed Sleeve M" },
          right: { manufacturer:"Signia", generation:"IX", family:"Pure Charge&Go IX", variant:"Standard", techLevel:"5", style:"ric", color:"Graphite", battery:"Rechargeable", receiverLength:"3", receiverPower:"P", receiver:"Length 3 · Power (P)", dome:"Closed Sleeve M" },
          fittingType:"Bilateral", manufacturer:"Signia", family:"Pure Charge&Go IX", techLevel:"5", style:"ric", color:"Graphite", battery:"Rechargeable",
          fittingDate: "2025-03-03", warrantyExpiry: warrantyDate("2025-03-03", 3), serialLeft: genId(), serialRight: genId(),
        },
        audiology: { rightT:{500:45,1000:55,2000:65,4000:75,8000:80}, leftT:{500:50,1000:60,2000:70,4000:80,8000:85}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:58, unaidedL:52, aidedR:84, aidedL:80, sinBin:12 },
        carePlan: "punch", appointments: [], notes: "Moderate-to-severe bilateral. Needs follow-up on left dome fit.",
      },
      {
        id: genId(), location: clinic.name, createdAt: new Date().toISOString(),
        name: "Linda Espinoza", dob: "1962-11-05", phone: "(435) 555-0528", email: "linda.espinoza@gmail.com",
        payType: "private",
        insurance: null,
        devices: {
          left: { manufacturer:"Phonak", generation:"Infinio", family:"Audéo Infinio", variant:"Standard", techLevel:"90", style:"ric", color:"Champagne", battery:"Rechargeable", receiverLength:"1", receiverPower:"S", receiver:"Length 1 · Standard (S)", dome:"Open Dome M" },
          right: { manufacturer:"Phonak", generation:"Infinio", family:"Audéo Infinio", variant:"Standard", techLevel:"90", style:"ric", color:"Champagne", battery:"Rechargeable", receiverLength:"1", receiverPower:"S", receiver:"Length 1 · Standard (S)", dome:"Open Dome M" },
          fittingType:"Bilateral", manufacturer:"Phonak", family:"Audéo Infinio", techLevel:"90", style:"ric", color:"Champagne", battery:"Rechargeable",
          fittingDate: "2024-11-20", warrantyExpiry: warrantyDate("2024-11-20", 4), serialLeft: genId(), serialRight: genId(),
        },
        audiology: { rightT:{500:20,1000:25,2000:35,4000:55,8000:65}, leftT:{500:20,1000:25,2000:30,4000:50,8000:60}, rightBC:{}, leftBC:{}, rightMask:{}, leftMask:{}, rightBCMask:{}, leftBCMask:{}, tinnitusRight:false, tinnitusLeft:false, unaidedR:88, unaidedL:90, aidedR:98, aidedL:98, sinBin:4 },
        carePlan: null, appointments: [{ date:"2025-12-01", type:"Annual Exam" }], notes: "Private pay. High-functioning loss, excellent word recognition. Very tech-savvy.",
      },
    ];
    let errors = [];
    for (const p of seeds) {
      try { await savePatient(p, staffId, clinicId); }
      catch (e) { errors.push(`${p.name}: ${e?.message||e}`); }
    }
    if (errors.length) { setSeedError(errors.join(" | ")); }
    else { await refreshPatients(); }
    setSeeding(false);
  };

  const statsData = useMemo(() => ({
    total: patients.length,
    fittingsThisMonth: patients.filter(p => {
      const d = new Date(p.devices?.fittingDate||0);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    warrantiesExpiring: patients.filter(p => {
      const days = daysUntil(p.devices?.warrantyExpiry||"");
      return days >= 0 && days <= 90;
    }).length,
    upcomingAppts: patients.reduce((acc,p) => acc + (p.appointments||[]).filter(a => daysUntil(a.date) >= 0).length, 0),
  }), [patients]);


  // ── STYLES ────────────────────────────────────────────────────────────────
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sora', sans-serif; background: #f0f2f5; }
    .app { display: flex; height: 100vh; overflow: hidden; }
    /* SIDEBAR */
    .sidebar { width: 260px; background: #0a1628; display: flex; flex-direction: column; flex-shrink: 0; }
    .sidebar-logo { padding: 24px 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .logo-badge { font-size: 10px; font-weight: 600; letter-spacing: 2px; color: #4ade80; text-transform: uppercase; margin-bottom: 6px; }
    .logo-name { font-size: 18px; font-weight: 700; color: white; line-height: 1.2; }
    .logo-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; }
    .location-select { margin: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 10px; color: white; font-size: 11px; font-family: 'Sora',sans-serif; width: calc(100% - 28px); cursor: pointer; }
    .sidebar-nav { flex: 1; padding: 8px 0; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,0.5); transition: all 0.15s; border-left: 3px solid transparent; }
    .nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
    .nav-item.active { background: rgba(74,222,128,0.1); color: #4ade80; border-left-color: #4ade80; }
    .nav-icon { font-size: 16px; width: 20px; text-align: center; }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.07); font-size: 11px; color: rgba(255,255,255,0.3); }
    /* MAIN */
    .main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
    .topbar { background: white; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
    .topbar-title { font-size: 20px; font-weight: 700; color: #0a1628; }
    .topbar-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .btn-primary { background: #0a1628; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; display: flex; align-items: center; gap: 8px; transition: background 0.15s; }
    .btn-primary:hover { background: #1a3050; }
    .btn-primary.green { background: #16a34a; }
    .btn-primary.green:hover { background: #15803d; }
    .btn-ghost { background: transparent; border: 1px solid #e5e7eb; color: #6b7280; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: 'Sora',sans-serif; }
    .content { padding: 28px; flex: 1; }
    /* STATS */
    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 28px; }
    .stat-card { background: white; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb; }
    .stat-icon { font-size: 22px; margin-bottom: 10px; }
    .stat-val { font-size: 32px; font-weight: 700; color: #0a1628; line-height: 1; }
    .stat-label { font-size: 12px; color: #9ca3af; margin-top: 6px; }
    .stat-card.highlight { background: #0a1628; }
    .stat-card.highlight .stat-val { color: #4ade80; }
    .stat-card.highlight .stat-label { color: rgba(255,255,255,0.4); }
    /* PATIENT TABLE */
    .table-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
    .table-header { padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f3f4f6; }
    .table-title { font-size: 14px; font-weight: 600; color: #0a1628; }
    .search-input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; font-size: 13px; font-family: 'Sora',sans-serif; width: 220px; outline: none; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; background: #f9fafb; }
    td { padding: 12px 16px; font-size: 13px; color: #374151; border-top: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; cursor: pointer; }
    .patient-name { font-weight: 600; color: #0a1628; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge.insurance { background: #dbeafe; color: #1d4ed8; }
    .badge.private { background: #fef3c7; color: #92400e; }
    .badge.complete { background: #dcfce7; color: #16a34a; }
    .badge.punch { background: #e0f2fe; color: #0c4a6e; }
    .badge.paygo { background: #f3f4f6; color: #6b7280; }
    .warranty-bar { height: 4px; background: #e5e7eb; border-radius: 2px; margin-top: 4px; overflow: hidden; width: 80px; }
    .warranty-fill { height: 100%; border-radius: 2px; background: #16a34a; }
    .warranty-fill.warn { background: #f59e0b; }
    .warranty-fill.exp { background: #ef4444; }
    /* WIZARD */
    .wizard-wrap { max-width: 760px; }
    .wizard-steps { display: flex; gap: 0; margin-bottom: 32px; }
    .wizard-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
    .wizard-step:not(:last-child)::after { content:''; position: absolute; top: 14px; left: 50%; width: 100%; height: 2px; background: #e5e7eb; z-index: 0; }
    .wizard-step.done::after { background: #16a34a; }
    .step-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #e5e7eb; background: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #9ca3af; z-index: 1; position: relative; }
    .step-dot.active { border-color: #0a1628; background: #0a1628; color: white; }
    .step-dot.done { border-color: #16a34a; background: #16a34a; color: white; }
    .step-name { font-size: 10px; color: #9ca3af; margin-top: 6px; font-weight: 500; letter-spacing: 0.5px; }
    .step-name.active { color: #0a1628; font-weight: 700; }
    .card { background: white; border-radius: 14px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 20px; }
    .card-title { font-size: 16px; font-weight: 700; color: #0a1628; margin-bottom: 20px; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field.full { grid-column: 1/-1; }
    label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
    input, select, textarea { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: 'Sora',sans-serif; outline: none; transition: border 0.15s; width: 100%; background: white; }
    input:focus, select:focus, textarea:focus { border-color: #0a1628; }
    .radio-group { display: flex; gap: 10px; }
    .radio-pill { flex: 1; border: 2px solid #e5e7eb; border-radius: 10px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.15s; }
    .radio-pill.active { border-color: #0a1628; background: #0a1628; color: white; }
    .radio-pill-label { font-size: 13px; font-weight: 600; }
    .radio-pill-sub { font-size: 11px; opacity: 0.6; margin-top: 2px; }
    .plan-select-list { display: flex; flex-direction: column; gap: 8px; }
    .plan-row { border: 2px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.15s; }
    .plan-row:hover { border-color: #9ca3af; }
    .plan-row.active { border-color: #0a1628; background: #f8fafc; }
    .plan-row-top { display: flex; justify-content: space-between; }
    .plan-row-name { font-size: 14px; font-weight: 600; color: #0a1628; }
    .plan-row-tpa { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .tier-pills { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .tier-pill { padding: 5px 14px; border-radius: 20px; border: 1px solid #e5e7eb; font-size: 12px; cursor: pointer; transition: all 0.15s; }
    .tier-pill:hover { border-color: #0a1628; }
    .tier-pill.active { background: #0a1628; color: white; border-color: #0a1628; }
    .style-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
    .style-card { border: 2px solid #e5e7eb; border-radius: 10px; padding: 14px 12px; text-align: center; cursor: pointer; transition: all 0.15s; }
    .style-card:hover { border-color: #9ca3af; }
    .style-card.active { border-color: #0a1628; background: #f8fafc; }
    .style-id { font-size: 14px; font-weight: 700; color: #0a1628; }
    .style-desc { font-size: 10px; color: #9ca3af; margin-top: 3px; line-height: 1.3; }
    .color-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
    .color-swatch { padding: 6px 14px; border-radius: 20px; border: 2px solid #e5e7eb; font-size: 12px; cursor: pointer; transition: all 0.15s; }
    .color-swatch.active { border-color: #0a1628; background: #0a1628; color: white; }
    .appt-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .appt-row { display: flex; gap: 8px; align-items: center; background: #f9fafb; border-radius: 8px; padding: 10px 12px; }
    .appt-row span { font-size: 12px; color: #374151; }
    .appt-del { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; margin-left: auto; }
    .add-appt-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
    .wizard-nav { display: flex; justify-content: space-between; margin-top: 8px; }
    /* REVIEW */
    .review-section { margin-bottom: 20px; }
    .review-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; color: #9ca3af; text-transform: uppercase; margin-bottom: 10px; }
    .review-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    .review-key { color: #6b7280; }
    .review-val { font-weight: 600; color: #0a1628; }
    /* PATIENT DETAIL */
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .detail-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 20px; }
    .detail-card.full { grid-column: 1/-1; }
    .detail-card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 14px; }
    .detail-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f9fafb; font-size: 13px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-key { color: #9ca3af; }
    .detail-val { font-weight: 500; color: #0a1628; }
    .qr-prompt { background: linear-gradient(135deg, #0a1628, #1a3050); color: white; border-radius: 14px; padding: 28px; text-align: center; margin-bottom: 20px; }
    .qr-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .qr-sub { font-size: 13px; opacity: 0.65; margin-bottom: 20px; }
    .qr-box { background: white; border-radius: 12px; width: 120px; height: 120px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
    .qr-grid { display: grid; grid-template-columns: repeat(8,10px); gap: 2px; }
    .qr-cell { width: 10px; height: 10px; border-radius: 2px; }
    .qr-id { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; color: #4ade80; letter-spacing: 3px; margin-bottom: 4px; }
    .qr-inst { font-size: 12px; opacity: 0.5; }
    .warranty-ring { position: relative; display: inline-flex; align-items: center; justify-content:: center; }
    .empty-state { text-align: center; padding: 60px; color: #9ca3af; }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }
    .empty-title { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 8px; }
    .empty-sub { font-size: 14px; }
    /* SETTINGS */
    .settings-wrap { max-width: 560px; }
    .settings-section { background: white; border-radius: 14px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 20px; }
    .settings-title { font-size: 16px; font-weight: 700; color: #0a1628; margin-bottom: 20px; }
    .settings-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .settings-field:last-child { margin-bottom: 0; }
    .settings-preview { background: #0a1628; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .settings-preview-logo { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.5px; }
    .settings-preview-sub { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; }
    .color-options { display: flex; gap: 10px; flex-wrap: wrap; }
    .color-option { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.15s; }
    .color-option.active { border-color: #0a1628; transform: scale(1.15); }
    .save-success { background: #dcfce7; color: #16a34a; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .distil-badge { font-size: 9px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 2px; }
    /* PUNCH CARD */
    .punch-panel { background: linear-gradient(135deg, #0a1628 0%, #1a3050 100%); border-radius: 14px; padding: 24px; color: white; }
    .punch-panel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .punch-panel-title { font-size: 16px; font-weight: 700; }
    .punch-panel-sub { font-size: 12px; opacity: 0.45; margin-top: 3px; }
    .punch-remaining { text-align: right; }
    .punch-remaining-num { font-size: 32px; font-weight: 800; color: #4ade80; line-height: 1; }
    .punch-remaining-label { font-size: 10px; opacity: 0.45; margin-top: 2px; letter-spacing: 1px; text-transform: uppercase; }
    .punch-row { margin-bottom: 20px; }
    .punch-row-label { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.45; margin-bottom: 10px; display: flex; justify-content: space-between; }
    .punch-row-label span { color: #4ade80; opacity: 1; }
    .punch-dots { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .punch-dot { width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .punch-dot.used { background: #4ade80; border-color: #4ade80; color: #0a1628; }
    .punch-actions { display: flex; align-items: center; gap: 10px; }
    .punch-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; color: white; cursor: pointer; font-family: 'Sora',sans-serif; transition: background 0.15s; }
    .punch-btn:hover { background: rgba(255,255,255,0.18); }
    .punch-btn:disabled { opacity: 0.25; cursor: default; }
    .punch-btn.confirm { background: #4ade80; color: #0a1628; border-color: #4ade80; }
    .punch-btn.confirm:hover { background: #22c55e; }
    .punch-undo { font-size: 11px; color: rgba(255,255,255,0.3); cursor: pointer; text-decoration: underline; }
    .punch-success { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 700; color: #4ade80; display: flex; align-items: center; gap: 8px; }
    .punch-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 16px 0; }
    .punch-log-title { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.35; margin-bottom: 10px; }
    .punch-log-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 12px; }
    .punch-log-row:last-child { border-bottom: none; }
    .punch-log-type { opacity: 0.6; }
    .punch-log-date { opacity: 0.35; font-size: 11px; }
    /* CATALOG EDITOR */
    .catalog-wrap { max-width: 860px; }
    .catalog-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; }
    .catalog-search { flex: 1; padding: 9px 14px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 13px; font-family: 'Sora',sans-serif; }
    .catalog-mfr-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
    .catalog-mfr-tab { padding: 5px 14px; border-radius: 20px; border: 1px solid #e5e7eb; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; background: white; color: #6b7280; }
    .catalog-mfr-tab:hover { border-color: #9ca3af; }
    .catalog-mfr-tab.active { background: #0a1628; color: white; border-color: #0a1628; }
    .catalog-entry { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 10px; transition: box-shadow 0.15s; }
    .catalog-entry:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
    .catalog-entry-header { display: flex; align-items: center; gap: 12px; }
    .catalog-entry-badge { font-size: 10px; font-weight: 700; letter-spacing: 1px; background: #f3f4f6; color: #6b7280; border-radius: 4px; padding: 2px 7px; text-transform: uppercase; }
    .catalog-entry-badge.active-badge { background: #dcfce7; color: #16a34a; }
    .catalog-entry-name { font-size: 14px; font-weight: 700; color: #0a1628; flex: 1; }
    .catalog-entry-gen { font-size: 11px; color: #9ca3af; margin-top: 1px; }
    .catalog-entry-actions { display: flex; gap: 6px; }
    .cat-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; background: white; color: #374151; transition: all 0.12s; }
    .cat-btn:hover { border-color: #9ca3af; background: #f9fafb; }
    .cat-btn.danger { color: #dc2626; border-color: #fecaca; }
    .cat-btn.danger:hover { background: #fef2f2; }
    .cat-btn.primary { background: #0a1628; color: white; border-color: #0a1628; }
    .cat-btn.primary:hover { background: #1a3050; }
    .catalog-edit-panel { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 14px; }
    .cat-field { display: flex; flex-direction: column; gap: 5px; }
    .cat-field label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #9ca3af; }
    .cat-field input, .cat-field textarea, .cat-field select { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: 'Sora',sans-serif; }
    .cat-field textarea { resize: vertical; min-height: 58px; }
    .chip-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .chip { display: flex; align-items: center; gap: 4px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 20px; padding: 3px 10px; font-size: 12px; color: #374151; }
    .chip-del { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
    .chip-del:hover { color: #dc2626; }
    .chip-add-input { padding: 4px 10px; border: 1px dashed #d1d5db; border-radius: 20px; font-size: 12px; font-family: 'Sora',sans-serif; width: 130px; }
    .chip-add-input:focus { outline: none; border-color: #0a1628; }
    .cat-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .catalog-add-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border: 2px dashed #d1d5db; border-radius: 12px; color: #6b7280; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; background: none; width: 100%; font-family: 'Sora',sans-serif; margin-bottom: 16px; }
    .catalog-add-btn:hover { border-color: #0a1628; color: #0a1628; background: #f8fafc; }
    .cat-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .cat-toggle-track { width: 36px; height: 20px; border-radius: 10px; background: #e5e7eb; position: relative; transition: background 0.15s; }
    .cat-toggle-track.on { background: #16a34a; }
    .cat-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: white; transition: left 0.15s; }
    .cat-toggle-track.on .cat-toggle-thumb { left: 18px; }
    .cat-toggle-label { font-size: 13px; color: #374151; }
    .cat-save-row { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
    /* AUDIOLOGY */
    .audig-pta-chips { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
    /* SIDE TABS */
    .side-tabs { display: flex; gap: 0; border-radius: 10px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 20px; background: #f9fafb; }
    .side-tab { flex: 1; padding: 12px 16px; text-align: center; cursor: pointer; transition: all 0.15s; border: none; font-family: 'Sora',sans-serif; font-size: 13px; font-weight: 600; background: transparent; color: #6b7280; }
    .side-tab:not(:last-child) { border-right: 1px solid #e5e7eb; }
    .side-tab.active { background: #0a1628; color: white; }
    .side-tab.configured { color: #16a34a; }
    .side-tab.active.configured { background: #0a1628; color: #4ade80; }
    .side-tab-label { font-size: 13px; font-weight: 700; }
    .side-tab-sub { font-size: 10px; opacity: 0.65; margin-top: 2px; font-weight: 400; line-height: 1.3; }
    .side-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .side-action-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; color: #374151; transition: all 0.15s; }
    .side-action-btn:hover { border-color: #9ca3af; background: #f9fafb; }
    .side-action-btn.cros { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; }
    .side-action-btn.cros:hover { background: #e0e7ff; }
    /* TWO-COLUMN DEVICE LAYOUT */
    .device-columns { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0; margin-bottom: 16px; }
    .device-col { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background: white; min-width: 0; transition: border-color 0.15s; }
    .device-col.active { border-color: #93c5fd; box-shadow: 0 0 0 2px rgba(59,130,246,0.12); }
    .device-col-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #f3f4f6; }
    .device-col-header .ear-label { font-size: 14px; font-weight: 700; color: #0a1628; }
    .device-col-header .ear-status { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
    .device-col-header .ear-status.configured { background: #dcfce7; color: #16a34a; }
    .device-col-header .ear-status.empty { background: #f3f4f6; color: #9ca3af; }
    .copy-actions { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 0 10px; }
    .copy-btn { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 8px; border: 1px solid #e5e7eb; background: white; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; color: #374151; transition: all 0.15s; white-space: nowrap; }
    .copy-btn:hover { border-color: #9ca3af; background: #f9fafb; }
    .copy-btn.cros { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; font-size: 10px; }
    .copy-btn.cros:hover { background: #e0e7ff; }
    .copy-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    @media (max-width: 860px) {
      .device-columns { grid-template-columns: 1fr; }
      .copy-actions { flex-direction: row; padding: 10px 0; }
    }
    /* INTAKE TOAST */
    .intake-toast { position: fixed; bottom: 28px; right: 28px; z-index: 9000; background: #0a1628; color: white; border-radius: 14px; padding: 16px 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.28); display: flex; align-items: center; gap: 14px; min-width: 300px; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .intake-toast-dot { width: 10px; height: 10px; border-radius: 50%; background: #4ade80; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(74,222,128,0.25); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px rgba(74,222,128,0.25); } 50% { box-shadow: 0 0 0 7px rgba(74,222,128,0.1); } }
    .intake-toast-body { flex: 1; }
    .intake-toast-title { font-size: 13px; font-weight: 700; }
    .intake-toast-sub { font-size: 11px; opacity: 0.55; margin-top: 2px; }
    .intake-toast-btn { background: #4ade80; color: #0a1628; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Sora',sans-serif; flex-shrink: 0; }
    .intake-toast-btn:hover { background: #22c55e; }
    .intake-toast-dismiss { background: none; border: none; color: rgba(255,255,255,0.35); font-size: 18px; cursor: pointer; padding: 0 0 0 6px; line-height: 1; }
    .intake-toast-dismiss:hover { color: white; }
    /* INTAKE QUEUE MODAL */
    .intake-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .queue-modal-overlay { position: fixed; inset: 0; z-index: 8000; background: rgba(0,0,0,0.5); display: flex; align-items: flex-start; justify-content: flex-end; padding: 20px; }
    .queue-modal { background: white; border-radius: 16px; width: 480px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
    .queue-modal-header { padding: 20px 24px 16px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; border-radius: 16px 16px 0 0; }
    .queue-modal-title { font-size: 16px; font-weight: 700; color: #0a1628; }
    .queue-modal-close { background: none; border: none; font-size: 22px; color: #9ca3af; cursor: pointer; line-height: 1; }
    .queue-card { margin: 12px 16px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
    .queue-card-name { font-size: 15px; font-weight: 700; color: #0a1628; }
    .queue-card-meta { font-size: 11px; color: #9ca3af; margin-top: 3px; }
    .queue-card-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 10px 0; }
    .queue-card-field { font-size: 12px; color: #374151; }
    .queue-card-field span { color: #9ca3af; display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .queue-card-actions { display: flex; gap: 8px; margin-top: 12px; }
    .queue-accept { flex: 1; background: #16a34a; color: white; border: none; border-radius: 8px; padding: 9px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Sora',sans-serif; }
    .queue-accept:hover { background: #15803d; }
    .queue-dismiss { background: white; border: 1px solid #e5e7eb; color: #9ca3af; border-radius: 8px; padding: 9px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; }
    .queue-dismiss:hover { border-color: #9ca3af; color: #374151; }
  `;


  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const [tableSearch, setTableSearch] = useState("");
  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(tableSearch.toLowerCase()) ||
    p.devices?.manufacturer?.toLowerCase().includes(tableSearch.toLowerCase())
  );


  const renderDashboard = () => (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Patient Dashboard</div>
          <div className="topbar-sub">{clinic.name} · {patients.length} active patients</div>
          {seedError && <div style={{fontSize:11,color:"#dc2626",marginTop:4}}>Seed error: {seedError}</div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {patients.length === 0 && (
            <button className="btn-ghost" style={{fontSize:12}} onClick={handleSeedPatients} disabled={seeding}>
              {seeding ? "Seeding…" : "🌱 Add Test Patients"}
            </button>
          )}
          <button className="btn-primary green" onClick={startNew}>＋ New Patient</button>
        </div>
      </div>
      <div className="content">
        <div className="stats-grid">
          <div className="stat-card highlight">
            <div className="stat-icon">👥</div>
            <div className="stat-val">{statsData.total}</div>
            <div className="stat-label">Total Patients</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎧</div>
            <div className="stat-val">{statsData.fittingsThisMonth}</div>
            <div className="stat-label">Fittings This Month</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-val">{statsData.upcomingAppts}</div>
            <div className="stat-label">Upcoming Appointments</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div className="stat-val">{statsData.warrantiesExpiring}</div>
            <div className="stat-label">Warranties Expiring (90d)</div>
          </div>
        </div>


        <div className="table-card">
          <div className="table-header">
            <div className="table-title">All Patients</div>
            <input className="search-input" placeholder="Search patients…" value={tableSearch} onChange={e => setTableSearch(e.target.value)} />
          </div>
          {filteredPatients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎧</div>
              <div className="empty-title">No patients yet</div>
              <div className="empty-sub">Click "New Patient" to add your first patient record.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Patient</th><th>Device</th><th>Coverage</th><th>Care Plan</th><th>Warranty</th><th>Fitting Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => {
                  const days = daysUntil(p.devices?.warrantyExpiry||"");
                  const total = p.carePlan === "complete" ? 4 * 365 : 3 * 365;
                  const pct = Math.max(0, Math.min(100, (days / total) * 100));
                  const fillClass = days < 90 ? "exp" : days < 360 ? "warn" : "";
                  return (
                    <tr key={p.id} onClick={() => { setSelectedPatient(p); setView("patient"); }}>
                      <td>
                        <div className="patient-name">{p.name}</div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.phone}</div>
                      </td>
                      <td>
                        <div style={{fontWeight:500}}>{p.devices?.manufacturer} {p.devices?.family||p.devices?.model}</div>
                        <div style={{fontSize:11,color:"#9ca3af"}}>{p.devices?.fittingType||"Bilateral"} · {p.devices?.techLevel||""} {p.devices?.color ? "· "+p.devices.color : ""}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.payType === "insurance" ? "insurance" : "private"}`}>
                          {p.payType === "insurance" ? p.insurance?.carrier || "Insurance" : "Private Pay"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.carePlan}`}>{CARE_PLANS.find(c=>c.id===p.carePlan)?.label||p.carePlan}</span>
                      </td>
                      <td>
                        <div style={{fontSize:12,color: days<90?"#ef4444":days<360?"#f59e0b":"#16a34a",fontWeight:600}}>
                          {days < 0 ? "Expired" : `${days}d left`}
                        </div>
                        <div className="warranty-bar"><div className={`warranty-fill ${fillClass}`} style={{width:`${pct}%`}} /></div>
                      </td>
                      <td style={{fontSize:12,color:"#6b7280"}}>{fmtDate(p.devices?.fittingDate||p.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );


  // ── WIZARD ────────────────────────────────────────────────────────────────
  const [newApptDate, setNewApptDate] = useState("");
  const [newApptType, setNewApptType] = useState(VISIT_TYPES[0]);
  const addAppt = () => {
    if (!newApptDate) return;
    upd("appointments", [...form.appointments, { date: newApptDate, type: newApptType }]);
    setNewApptDate("");
  };


  const carriersForType = [...new Set(INSURANCE_PLANS.map(p => p.carrier))];
  const plansForCarrier = INSURANCE_PLANS.filter(p => p.carrier === form.carrier);


  // Catalog-driven cascade derived values — computed per side
  const activeCatalog = catalog.filter(e => e.active);
  const getSideDerived = (sd) => {
    const availMfrs = [...new Set(activeCatalog.filter(e => !sd.style || e.styles.includes(sd.style)).map(e => e.manufacturer))].sort();
    const availGens = [...new Set(activeCatalog.filter(e => e.styles.includes(sd.style) && e.manufacturer === sd.manufacturer).map(e => e.generation))];
    const availFamilies = activeCatalog.filter(e => e.styles.includes(sd.style) && e.manufacturer === sd.manufacturer && e.generation === sd.generation);
    const selectedFamily = catalog.find(e => e.id === sd.familyId);
    const availColors = selectedFamily?.colors || [];
    const availBatteries = selectedFamily?.battery || [];
    const availPowers = sd.manufacturer ? (RECEIVER_POWERS[sd.manufacturer] || []) : [];
    const availDomes  = sd.manufacturer ? getDomeOptions(sd.manufacturer, sd.generation) : [];
    const selectedPower = availPowers.find(p => p.id === sd.receiverPower);
    const requiresEarmold = selectedPower?.earmold === true;
    const variantRequired = (selectedFamily?.variants?.length || 0) > 1;
    const hasCROSVariant = selectedFamily?.variants?.some(v => v.toLowerCase().includes("cros")) || false;

    // ── TruHearing cascade derived values ──
    const tierLabels = privateLabelTiers.map(t => t.label);

    // Models available for selected tech level
    const thAvailModels = sd.techLevel
      ? TH_MODELS.filter(m => TH_AVAILABILITY[`${m.id}|${sd.techLevel}`]?.length > 0)
      : [];

    // Styles available for selected model+techLevel
    const thAvailStyles = sd.thModel && sd.techLevel
      ? (TH_AVAILABILITY[`${sd.thModel}|${sd.techLevel}`] || [])
          .map(sid => TH_STYLES.find(s => s.id === sid)).filter(Boolean)
      : [];

    // Gain/Matrix for selected model+style
    const thGainOptions = sd.thModel && sd.style
      ? (TH_GAIN_MATRIX[`${sd.thModel}|${sd.style}`] || [])
      : [];

    // Color category
    const thColorCategory = TH_STYLE_COLOR_CATEGORY[sd.style] || null;

    // Battery (auto)
    const thBattery = sd.thModel && sd.style
      ? (TH_BATTERY[`${sd.thModel}|${sd.style}`] || "")
      : "";

    // Is rechargeable?
    const thIsLi = TH_MODELS.find(m => m.id === sd.thModel)?.li || false;

    // Earmold required from gain/matrix selection
    const thSelectedGain = thGainOptions.find(g => g.id === sd.gainMatrix);
    const thRequiresEarmold = thSelectedGain?.earmold === true;

    // Has receiver (RIC/RIC+BCT/SR)
    const thHasReceiver = TH_RECEIVER_STYLES.includes(sd.style);

    // Pricing
    const thTierPrice = privateLabelTiers.find(t => t.label === sd.techLevel)?.price ?? 0;
    return { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries,
      availPowers, availDomes, selectedPower, requiresEarmold, variantRequired, hasCROSVariant,
      thAvailModels, thAvailStyles, thGainOptions, thColorCategory, thBattery, thIsLi,
      thRequiresEarmold, thHasReceiver, thTierPrice };
  };
  const leftDerived = getSideDerived(form.left);
  const rightDerived = getSideDerived(form.right);

  // ── Pricing Reveal — compute from form state + retail anchors ──
  const TIER_TO_ANCHOR = { "Premium":"select","Level 7":"select","Advanced":"advanced","Level 5":"advanced","Standard":"standard","Level 3":"standard","Level 2":"level2","Level 1":"level1" };
  const pricingRevealData = useMemo(() => {
    if (form.tierPrice == null || !form.tier) return null;
    const anchorKey = TIER_TO_ANCHOR[form.tier];
    if (!anchorKey) return null;
    const anchor = retailAnchors.find(a => a.id === anchorKey);
    if (!anchor) return null;
    const retailPerAid = parseFloat(anchor.price_per_aid);
    const copayPerAid = form.tierPrice;
    const savingsPerAid = retailPerAid - copayPerAid;
    const savingsPct = Math.round((savingsPerAid / retailPerAid) * 100);
    return { tierLabel: anchor.label, retailPerAid, copayPerAid, savingsPerAid, savingsPct };
  }, [form.tier, form.tierPrice, retailAnchors]);

  // Device family lookups
  const leftFamily = catalog.find(e => e.id === form.left.familyId);
  const rightFamily = catalog.find(e => e.id === form.right.familyId);

  // Keep sd / otherSide for backward compat with non-step-3 code
  const sd = form[activeSide];
  const otherSide = activeSide === "left" ? "right" : "left";


  const isSideConfigured = (s) => {
    const d = form[s];
    if (d.manufacturer === "TruHearing") return !!(d.style && d.techLevel && d.thModel && d.gainMatrix);
    return !!(d.familyId && d.techLevel);
  };


  const canProceed = [
    form.firstName && form.lastName && form.dob && form.phone,
    true, // Testing — always skippable
    true, // Results — always skippable
    (isSideConfigured("left") || isSideConfigured("right")),
    form.payType === "private" || !!form.carePlan,
    true, // Review — always valid
  ][step];


  const renderStep = () => {
    if (step === 0) return (
      <div className="card">
        <div className="card-title">Patient Information</div>
        <div className="field-grid">
          <div className="field"><label>First Name *</label><input value={form.firstName} onChange={e=>upd("firstName",e.target.value)} placeholder="Jane" /></div>
          <div className="field"><label>Last Name *</label><input value={form.lastName} onChange={e=>upd("lastName",e.target.value)} placeholder="Smith" /></div>
          <div className="field"><label>Date of Birth *</label><input type="date" value={form.dob} onChange={e=>upd("dob",e.target.value)} /></div>
          <div className="field"><label>Phone *</label><input value={form.phone} onChange={e=>{
            const digits = e.target.value.replace(/\D/g,"").slice(0,10);
            let fmt = digits;
            if (digits.length >= 7) fmt = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
            else if (digits.length >= 4) fmt = `(${digits.slice(0,3)}) ${digits.slice(3)}`;
            else if (digits.length > 0) fmt = `(${digits}`;
            upd("phone", fmt);
          }} placeholder="(555) 555-5555" /></div>
          <div className="field full"><label>Email</label><input value={form.email} onChange={e=>upd("email",e.target.value)} placeholder="patient@email.com" /></div>
          <div className="field full" ref={addressRef} style={{position:"relative"}}>
            <label>Address</label>
            <input value={form.address} onChange={e=>searchAddress(e.target.value)} onFocus={()=>{ if (addressSuggestions.length) setAddressOpen(true); }} placeholder="Start typing an address..." autoComplete="off" />
            {addressOpen && addressSuggestions.length > 0 && (
              <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:"white",border:"1px solid #e5e7eb",borderRadius:8,marginTop:4,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",maxHeight:220,overflowY:"auto"}}>
                {addressSuggestions.map((s,i)=>(
                  <div key={i} onClick={()=>selectAddress(s)} style={{padding:"10px 14px",fontSize:13,cursor:"pointer",borderBottom:i<addressSuggestions.length-1?"1px solid #f3f4f6":"none",color:"#0a1628",lineHeight:1.4}}
                    onMouseOver={e=>e.currentTarget.style.background="#f9fafb"} onMouseOut={e=>e.currentTarget.style.background="white"}>
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field full"><label>Payment Type</label>
            <div className="radio-group">
              {["insurance","private"].map(t => (
                <div key={t} className={`radio-pill ${form.payType===t?"active":""}`} onClick={()=>upd("payType",t)}>
                  <div className="radio-pill-label">{t==="insurance"?"Insurance":"Private Pay"}</div>
                  <div className="radio-pill-sub">{t==="insurance"?"Carrier + TPA plan":"Standard of Care – $5,500"}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Inline insurance plan search when Insurance selected */}
          {form.payType === "insurance" && (
            <div className="field full" style={{marginTop:4}}>
              <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:12}}>Insurance Plan</div>
                <input
                  placeholder="Search by carrier or plan name…"
                  value={form._planSearch||""}
                  onChange={e=>upd("_planSearch",e.target.value)}
                  style={{width:"100%",marginBottom:10,fontSize:13}}
                />
                <div style={{maxHeight:220,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,paddingRight:4}}>
                  {INSURANCE_PLANS
                    .filter(p=>{
                      const q=(form._planSearch||"").toLowerCase();
                      return !q||p.carrier.toLowerCase().includes(q)||p.planGroup.toLowerCase().includes(q)||p.tpa.toLowerCase().includes(q);
                    })
                    .sort((a,b)=>a.planGroup.localeCompare(b.planGroup))
                    .map(plan=>(
                      <div key={plan.planGroup}
                        className={`plan-row ${form.planGroup===plan.planGroup?"active":""}`}
                        onClick={()=>{
                          upd("planGroup",plan.planGroup);
                          upd("carrier",plan.carrier);
                          upd("tpa",plan.tpa);
                          upd("tier","");
                          upd("tierPrice",null);
                        }}>
                        <div className="plan-row-name">{plan.planGroup}</div>
                        <div className="plan-row-tpa">{plan.carrier} · via {plan.tpa}</div>
                      </div>
                    ))
                  }
                </div>
                {form.planGroup && (
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #e5e7eb",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>TPA</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#f3f4f6",borderRadius:6,padding:"3px 10px"}}>{form.tpa}</span>
                    <button style={{marginLeft:"auto",fontSize:11,color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0}}
                      onClick={()=>{upd("planGroup","");upd("carrier","");upd("tpa","");upd("tier","");upd("tierPrice",null);}}>
                      ✕ Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
    if (step === 1) {
      const updAud=(k,v)=>upd("audiology",{...form.audiology,[k]:v});
      const setThreshold=(ear,freq,val,testType="AC",isMasked=false)=>{
        const key=testType==="BC"
          ?(ear==="right"?"rightBC":"leftBC")
          :(ear==="right"?"rightT":"leftT");
        const maskKey=testType==="BC"
          ?(ear==="right"?"rightBCMask":"leftBCMask")
          :(ear==="right"?"rightMask":"leftMask");
        const next={...form.audiology[key]};
        const nextMask={...form.audiology[maskKey]};
        if(val==null){ delete next[freq]; delete nextMask[freq]; }
        else{ next[freq]=val; if(isMasked) nextMask[freq]=true; else delete nextMask[freq]; }
        upd("audiology",{...form.audiology,[key]:next,[maskKey]:nextMask});
      };
      const copyToOtherEar=()=>{
        const src=audEar, dst=src==="right"?"left":"right";
        const patch={};
        // AC thresholds + masks
        patch[dst==="right"?"rightT":"leftT"]={...(src==="right"?form.audiology.rightT:form.audiology.leftT)};
        patch[dst==="right"?"rightMask":"leftMask"]={...(src==="right"?form.audiology.rightMask:form.audiology.leftMask)};
        // BC thresholds + masks
        patch[dst==="right"?"rightBC":"leftBC"]={...(src==="right"?form.audiology.rightBC:form.audiology.leftBC)};
        patch[dst==="right"?"rightBCMask":"leftBCMask"]={...(src==="right"?form.audiology.rightBCMask:form.audiology.leftBCMask)};
        upd("audiology",{...form.audiology,...patch});
      };
      const rPTA=getPTA(form.audiology.rightT);
      const lPTA=getPTA(form.audiology.leftT);
      const rDeg=getDegreeName(rPTA);
      const lDeg=getDegreeName(lPTA);
      return(
        <>
          {/* ── Pure Tone Audiometry ── */}
          <div className="card">
            <div className="card-title">Pure Tone Audiometry</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
              Click directly on the audiogram to plot thresholds. Click an existing symbol to clear it.
              Switch ears, test type (AC/BC), and masking mode using the controls below.
              PTA calculates automatically from 500, 1000, and 2000 Hz.
            </div>
            {/* Ear toggle + Copy button */}
            <div style={{display:"flex",alignItems:"stretch",gap:8,marginBottom:10}}>
              <div className="side-tabs" style={{flex:1,marginBottom:0}}>
                {["right","left"].map(ear=>(
                  <button key={ear} className={`side-tab ${audEar===ear?"active":""}`}
                    onClick={()=>setAudEar(ear)}>
                    <div className="side-tab-label">{ear==="right"?"Right Ear":"Left Ear"}</div>
                    <div className="side-tab-sub">
                      {ear==="right"
                        ?(rPTA!=null?`PTA: ${rPTA} dB HL`:"No thresholds")
                        :(lPTA!=null?`PTA: ${lPTA} dB HL`:"No thresholds")}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={copyToOtherEar}
                style={{padding:"6px 14px",borderRadius:8,border:"1px solid #d1d5db",background:"#f9fafb",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}
                title={`Copy all thresholds from ${audEar} ear to ${audEar==="right"?"left":"right"} ear`}>
                Copy {audEar==="right"?"→ Left":"← Right"}
              </button>
            </div>
            {/* AC/BC toggle + Mask mode + Tinnitus */}
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"#374151"}}>
                <span>Test:</span>
                {["AC","BC"].map(t=>(
                  <button key={t} onClick={()=>setAudTestType(t)}
                    style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",
                      border:audTestType===t?"2px solid #6366f1":"1px solid #d1d5db",
                      background:audTestType===t?"#eef2ff":"#fff",
                      color:audTestType===t?"#4f46e5":"#6b7280"}}>
                    {t==="AC"?"Air (AC)":"Bone (BC)"}
                  </button>
                ))}
              </div>
              <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,color:maskMode?"#7c3aed":"#6b7280",cursor:"pointer"}}>
                <input type="checkbox" checked={maskMode} onChange={e=>setMaskMode(e.target.checked)}
                  style={{accentColor:"#7c3aed"}}/>
                Masked
              </label>
              <div style={{borderLeft:"1px solid #e5e7eb",paddingLeft:12,display:"flex",alignItems:"center",gap:12}}>
                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#dc2626",fontWeight:600,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.audiology.tinnitusRight}
                    onChange={e=>updAud("tinnitusRight",e.target.checked)}
                    style={{accentColor:"#dc2626"}}/>
                  Tinnitus R
                </label>
                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#2563eb",fontWeight:600,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.audiology.tinnitusLeft}
                    onChange={e=>updAud("tinnitusLeft",e.target.checked)}
                    style={{accentColor:"#2563eb"}}/>
                  Tinnitus L
                </label>
              </div>
            </div>
            <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 8px"}}>
              <AudigramSVG
                rightT={form.audiology.rightT} leftT={form.audiology.leftT}
                rightBC={form.audiology.rightBC} leftBC={form.audiology.leftBC}
                rightMask={form.audiology.rightMask} leftMask={form.audiology.leftMask}
                rightBCMask={form.audiology.rightBCMask} leftBCMask={form.audiology.leftBCMask}
                interactive={true} onSet={setThreshold} activeEar={audEar}
                activeTestType={audTestType} maskMode={maskMode}/>
            </div>
            {(rPTA!=null||lPTA!=null)&&(
              <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
                {rPTA!=null&&(
                  <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 14px",fontSize:12}}>
                    <span style={{color:"#dc2626",fontWeight:700}}>Right PTA: {rPTA} dB HL</span>
                    {rDeg&&<span style={{color:"#9ca3af",marginLeft:6}}>({rDeg})</span>}
                  </div>
                )}
                {lPTA!=null&&(
                  <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"8px 14px",fontSize:12}}>
                    <span style={{color:"#2563eb",fontWeight:700}}>Left PTA: {lPTA} dB HL</span>
                    {lDeg&&<span style={{color:"#9ca3af",marginLeft:6}}>({lDeg})</span>}
                  </div>
                )}
              </div>
            )}
          </div>


          {/* ── CCT Unaided ── */}
          <div className="card">
            <div className="card-title">Unaided Speech Discrimination</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
              California Consonant Test at <strong>45 dB</strong> — monaurally. 45 dB is the softest level
              at which a listener with normal hearing scores 100%. This is the audiological equivalent
              of the 20/20 line.
            </div>
            <div className="field-grid">
              <div className="field">
                <label>Right Ear Score (%)</label>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0" max="100" step="2" placeholder="e.g. 72"
                    value={form.audiology.unaidedR??""} style={{width:90}}
                    onChange={e=>updAud("unaidedR",e.target.value===""?null:Number(e.target.value))}/>
                  {form.audiology.unaidedR!=null&&(
                    <span style={{fontSize:11,fontWeight:700,color:"#6b7280"}}>
                      {100-form.audiology.unaidedR}% below normal hearing
                    </span>
                  )}
                </div>
              </div>
              <div className="field">
                <label>Left Ear Score (%)</label>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0" max="100" step="2" placeholder="e.g. 64"
                    value={form.audiology.unaidedL??""} style={{width:90}}
                    onChange={e=>updAud("unaidedL",e.target.value===""?null:Number(e.target.value))}/>
                  {form.audiology.unaidedL!=null&&(
                    <span style={{fontSize:11,fontWeight:700,color:"#6b7280"}}>
                      {100-form.audiology.unaidedL}% below normal hearing
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* ── Aided Discrimination ── */}
          <div className="card">
            <div className="card-title">Aided Speech Discrimination</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
              Speech discrimination at the patient's <strong>most comfortable level (MCL)</strong>.
              This reflects realistic word recognition with amplification in quiet.
            </div>
            <div className="field-grid">
              <div className="field">
                <label>Right Ear Score (%)</label>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0" max="100" step="2" placeholder="e.g. 88"
                    value={form.audiology.aidedR??""} style={{width:90}}
                    onChange={e=>updAud("aidedR",e.target.value===""?null:Number(e.target.value))}/>


                </div>
              </div>
              <div className="field">
                <label>Left Ear Score (%)</label>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0" max="100" step="2" placeholder="e.g. 92"
                    value={form.audiology.aidedL??""} style={{width:90}}
                    onChange={e=>updAud("aidedL",e.target.value===""?null:Number(e.target.value))}/>


                </div>
              </div>
            </div>
          </div>


          {/* ── QuickSIN ── */}
          <div className="card">
            <div className="card-title">Signal-to-Noise Ratio Assessment — QuickSIN</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:14,lineHeight:1.6}}>
              Administered <strong>binaurally at the patient's MCL</strong>. Enter the SNR Loss result in dB.
              0–2 = normal · 3–7 = mild · 8–15 = moderate · 15+ = severe.
              <span style={{display:"block",marginTop:6,color:"#9ca3af",fontStyle:"italic"}}>
                Tip: normalize the experience before administering — most patients feel like they crash and burn even when they do reasonably well.
              </span>
            </div>
            <div className="field" style={{maxWidth:320}}>
              <label>Binaural SNR Loss (dB)</label>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <input type="number" min="0" max="30" step="0.5" placeholder="e.g. 9.5"
                  value={form.audiology.sinBin??""} style={{width:110}}
                  onChange={e=>updAud("sinBin",e.target.value===""?null:Number(e.target.value))}/>
                {form.audiology.sinBin!=null&&(
                  <div>
                    <span style={{fontSize:13,fontWeight:700,
                      color:form.audiology.sinBin<=2?"#16a34a":form.audiology.sinBin<=7?"#ca8a04":form.audiology.sinBin<=15?"#ea580c":"#dc2626"}}>
                      {form.audiology.sinBin<=2?"Near-normal":form.audiology.sinBin<=7?"Mild":form.audiology.sinBin<=15?"Moderate":"Severe"} difficulty in noise
                    </span>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>
                      {form.audiology.sinBin<=2?"Minimal impact from background noise expected."
                      :form.audiology.sinBin<=7?"Modern directional processing can recover much of this gap."
                      :form.audiology.sinBin<=15?"Noise will remain the hardest situation — technology provides meaningful relief."
                      :"Complex noise environments will be genuinely difficult regardless of technology — sets honest expectations."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      );
    }
    if (step === 2) {
      const aud = form.audiology;
      const rPTA = getPTA(aud.rightT);
      const lPTA = getPTA(aud.leftT);
      const sections = generateCounseling(aud);
      const hasAnyData = rPTA!=null || lPTA!=null || aud.unaidedR!=null || aud.unaidedL!=null || aud.aidedR!=null || aud.sinBin!=null;
      return (
        <>
          {/* ── Audiogram Summary ── */}
          {(rPTA!=null||lPTA!=null) && (
            <div className="card">
              <div className="card-title">Your Audiogram</div>
              <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 8px",marginBottom:14}}>
                <AudigramSVG rightT={aud.rightT||{}} leftT={aud.leftT||{}} rightBC={aud.rightBC||{}} leftBC={aud.leftBC||{}} rightMask={aud.rightMask||{}} leftMask={aud.leftMask||{}} rightBCMask={aud.rightBCMask||{}} leftBCMask={aud.leftBCMask||{}} interactive={false}/>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {rPTA!=null&&(
                  <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 16px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:2}}>Right Ear — PTA</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628"}}>{rPTA} <span style={{fontSize:12,color:"#9ca3af",fontWeight:400}}>dB HL</span></div>
                  </div>
                )}
                {lPTA!=null&&(
                  <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 16px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:2}}>Left Ear — PTA</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628"}}>{lPTA} <span style={{fontSize:12,color:"#9ca3af",fontWeight:400}}>dB HL</span></div>
                  </div>
                )}
                {(aud.unaidedR!=null||aud.unaidedL!=null)&&(
                  <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 16px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>CCT Unaided</div>
                    {aud.unaidedR!=null&&<div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>R: {aud.unaidedR}%</div>}
                    {aud.unaidedL!=null&&<div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>L: {aud.unaidedL}%</div>}
                  </div>
                )}
                {(aud.aidedR!=null||aud.aidedL!=null)&&(
                  <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 16px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#16a34a",marginBottom:2}}>WRS @ MCL</div>
                    {aud.aidedR!=null&&<div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>R: {aud.aidedR}%</div>}
                    {aud.aidedL!=null&&<div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>L: {aud.aidedL}%</div>}
                  </div>
                )}
                {aud.sinBin!=null&&(
                  <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 16px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>QuickSIN SNR Loss</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628"}}>{aud.sinBin} <span style={{fontSize:12,color:"#9ca3af",fontWeight:400}}>dB</span></div>
                    <div style={{fontSize:11,fontWeight:600,marginTop:2,
                      color:aud.sinBin<=2?"#16a34a":aud.sinBin<=7?"#ca8a04":aud.sinBin<=15?"#ea580c":"#dc2626"}}>
                      {aud.sinBin<=2?"Near-normal":aud.sinBin<=7?"Mild":aud.sinBin<=15?"Moderate":"Severe"} difficulty in noise
                    </div>
                  </div>
                )}
                {(aud.tinnitusRight||aud.tinnitusLeft)&&(
                  <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,padding:"10px 16px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#92400e",marginBottom:2}}>Tinnitus</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>
                      {aud.tinnitusRight&&aud.tinnitusLeft?"Bilateral":aud.tinnitusRight?"Right Ear":"Left Ear"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* ── Counseling Narrative ── */}
          {sections && sections.length > 0 && (
            <div className="card">
              <div className="card-title">Understanding Your Results</div>
              <div style={{fontSize:12,color:"#9ca3af",marginBottom:18}}>Walk through this with your patient — each section explains one aspect of their hearing profile in plain language.</div>
              {sections.map((s,i)=>(
                <div key={i} style={{marginBottom:i<sections.length-1?22:0,paddingBottom:i<sections.length-1?22:0,borderBottom:i<sections.length-1?"1px solid #f3f4f6":"none"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0a1628",marginBottom:8,display:"flex",alignItems:"flex-start",gap:10}}>
                    <span style={{fontSize:18,lineHeight:1}}>{["🎯","💬","✅","🔊"][i]||"📋"}</span>
                    <span>{s.heading}</span>
                  </div>
                  <div style={{fontSize:13,color:"#374151",lineHeight:1.8,paddingLeft:28}}>{s.body}</div>
                </div>
              ))}
            </div>
          )}


          {/* ── Why Treatment Matters ── */}
          <div className="card">
            <div className="card-title">Why This Matters</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:18,lineHeight:1.65}}>
              Evidence-based outcomes for patients who treat their hearing loss — framed around quality of life, not fear.
            </div>
            {[
              {icon:"🗣️", color:"#0a1628", title:"Relationships & connection",
               body:"Communication difficulty strains relationships in ways patients often don't name directly. Spouses, children, and colleagues consistently report higher satisfaction and less frustration after treatment begins. For most patients, this is the most immediate and tangible benefit they notice."},
              {icon:"🧠", color:"#4f46e5", title:"Reducing cognitive load",
               body:"Untreated hearing loss forces the brain to divert resources away from memory and comprehension just to decode sound. Research consistently shows that hearing aid users demonstrate better working memory performance and experience less cognitive fatigue during conversation."},
              {icon:"😴", color:"#0891b2", title:"Listening fatigue",
               body:"Listening fatigue is real, measurable, and often underreported. Patients describe it as a kind of exhaustion that sneaks up on them — especially after crowded environments, work meetings, or social events. Correcting the input signal reduces this burden substantially."},
              {icon:"🔈", color:"#059669", title:"Auditory plasticity — the case for acting now",
               body:"Hearing pathways that go unstimulated over time become less efficient. This is why fitting sooner rather than later consistently produces better long-term outcomes, even in patients who feel they're managing fine. The brain adapts to what it receives — give it more to work with."},
              {icon:"🧬", color:"#dc2626", title:"Cognitive health — one piece of a larger picture",
               body:"Large-scale studies, including the Lancet Commission on Dementia Prevention, have identified untreated hearing loss as one of the largest modifiable risk factors for cognitive decline in midlife. This doesn't mean hearing loss causes dementia — it means treating it is one of the more impactful preventive steps available. Worth knowing, not worth catastrophizing."},
            ].map(r=>(
              <div key={r.title} style={{display:"flex",gap:14,marginBottom:18,paddingBottom:18,borderBottom:"1px solid #f3f4f6"}}>
                <span style={{fontSize:22,flexShrink:0,lineHeight:1.3}}>{r.icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:r.color,marginBottom:5}}>{r.title}</div>
                  <div style={{fontSize:13,color:"#374151",lineHeight:1.75}}>{r.body}</div>
                </div>
              </div>
            ))}
            <div style={{fontSize:11,color:"#9ca3af",fontStyle:"italic",marginTop:4}}>
              Sources: Lancet Commission on Dementia Prevention (2024); JAMA; Journal of the American Academy of Audiology; Hearing Health Foundation
            </div>
          </div>


          {!hasAnyData && (
            <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:16,fontWeight:600,color:"#374151",marginBottom:8}}>No test data recorded yet</div>
              <div style={{fontSize:13}}>Go back to the Testing step to enter audiogram and speech scores, or continue to treatment options.</div>
            </div>
          )}
        </>
      );
    }
    if (step === 3) {

      const renderSideColumn = (side) => {
        const s = form[side];
        const d = side === "left" ? leftDerived : rightDerived;
        const { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries,
          availPowers, availDomes, requiresEarmold, variantRequired } = d;

        return (
          <div className={`device-col ${activeSide===side?"active":""}`} onClick={()=>setActiveSide(side)}>
            <div className="device-col-header">
              <span className="ear-label">{side==="left"?"👂 Left Ear":"Right Ear 👂"}</span>
              <span className={`ear-status ${isSideConfigured(side)?"configured":"empty"}`}>
                {isSideConfigured(side)?"Configured":"Not set"}
              </span>
            </div>

            {/* ── 1. Body Style (standard catalog only — TH uses its own style picker) ── */}
            {!isPrivateLabel && (
              <div className="field" style={{marginBottom:16}}><label>Body Style</label>
                <div className="style-grid">
                  {BODY_STYLES.map(bs=>(
                    <div key={bs.id} className={`style-card ${s.style===bs.id?"active":""}`}
                      onClick={()=>resetSide(side,{style:bs.id})}>
                      <div className="style-id">{bs.label}</div>
                      <div className="style-desc">{bs.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 2–6. Standard catalog cascade ── */}
            {!isPrivateLabel && (<>
              {s.style && availMfrs.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Manufacturer</label>
                  <div className="radio-group">
                    {availMfrs.map(m=>(
                      <div key={m} className={`radio-pill ${s.manufacturer===m?"active":""}`}
                        onClick={()=>setForm(f=>({...f,[side]:{...f[side],manufacturer:m,generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:""}}))}>
                        <div className="radio-pill-label">{m}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s.manufacturer && availGens.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Platform / Generation</label>
                  <div className="radio-group">
                    {availGens.map(g=>(
                      <div key={g} className={`radio-pill ${s.generation===g?"active":""}`}
                        onClick={()=>setForm(f=>({...f,[side]:{...f[side],generation:g,familyId:"",variant:"",techLevel:"",color:"",battery:""}}))}>
                        <div className="radio-pill-label">{g}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {s.generation && availFamilies.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Model Family</label>
                  <div className="plan-select-list">
                    {availFamilies.map(fam=>(
                      <div key={fam.id} className={`plan-row ${s.familyId===fam.id?"active":""}`}
                        onClick={()=>{
                          const autoVar = fam.variants.length===1 ? fam.variants[0] : "";
                          const autoBat = fam.battery.length===1 ? fam.battery[0] : "";
                          setForm(f=>({...f,[side]:{...f[side],familyId:fam.id,variant:autoVar,techLevel:"",color:"",battery:autoBat}}));
                        }}>
                        <div className="plan-row-top">
                          <div>
                            <div className="plan-row-name">{fam.family}</div>
                            {fam.notes && <div className="plan-row-tpa">{fam.notes}</div>}
                          </div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                            {fam.techLevels.slice(0,4).map(t=>(
                              <span key={t} style={{fontSize:10,background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:4,padding:"2px 5px",color:"#6b7280"}}>{t}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedFamily && selectedFamily.variants.length > 1 && (
                <div className="field" style={{marginBottom:16}}><label>Variant</label>
                  <div className="radio-group">
                    {selectedFamily.variants.map(v=>(
                      <div key={v} className={`radio-pill ${s.variant===v?"active":""}`} onClick={()=>updSide(side,"variant",v)}>
                        <div className="radio-pill-label">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedFamily && (s.variant || !variantRequired) && (
                <div className="field" style={{marginBottom:16}}><label>Technology Level</label>
                  <div className="radio-group">
                    {selectedFamily.techLevels.map(t=>(
                      <div key={t} className={`radio-pill ${s.techLevel===t?"active":""}`} onClick={()=>updSide(side,"techLevel",t)}>
                        <div className="radio-pill-label">{t}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>)}

            {/* ── Private-label: TruHearing cascade ── */}
            {isPrivateLabel && (<>
              {/* 1. Technology Tier */}
              <div className="field" style={{marginBottom:16}}><label>Technology Tier</label>
                <div className="plan-select-list">
                  {privateLabelTiers.map(t => (
                    <div key={t.label} className={`plan-row ${s.techLevel===t.label?"active":""}`}
                      onClick={()=>setForm(f=>({...f, tier:t.label, tierPrice:t.price, [side]:{...EMPTY_SIDE(), manufacturer:"TruHearing", techLevel:t.label}}))}>
                      <div className="plan-row-top">
                        <div><div className="plan-row-name">{t.label}</div></div>
                        <div style={{fontWeight:700,color:"#0a1628"}}>
                          {t.price===0 ? "No Charge" : `$${t.price.toLocaleString()} / aid`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Model */}
              {s.techLevel && d.thAvailModels.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Model</label>
                  <div className="radio-group" style={{flexWrap:"wrap"}}>
                    {d.thAvailModels.map(m=>(
                      <div key={m.id} className={`radio-pill ${s.thModel===m.id?"active":""}`}
                        onClick={()=>setForm(f=>({...f,[side]:{...f[side], thModel:m.id, style:"", color:"", faceplateColor:"", shellColor:"", gainMatrix:"", battery:"", receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:"", familyId:"", variant:"", generation:""}}))}>
                        <div className="radio-pill-label">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Style */}
              {s.thModel && d.thAvailStyles.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Style</label>
                  <div className="radio-group" style={{flexWrap:"wrap"}}>
                    {d.thAvailStyles.map(st=>{
                      const autoBattery = TH_BATTERY[`${s.thModel}|${st.id}`] || "";
                      const autoGainOptions = TH_GAIN_MATRIX[`${s.thModel}|${st.id}`] || [];
                      const autoGain = autoGainOptions.length === 1 ? autoGainOptions[0].id : "";
                      const autoShell = st.id === "if" ? "Red/Blue" : "";
                      return (
                        <div key={st.id} className={`radio-pill ${s.style===st.id?"active":""}`}
                          onClick={()=>setForm(f=>({...f,[side]:{...f[side], style:st.id, color:"", faceplateColor:"", shellColor:autoShell, gainMatrix:autoGain, battery:autoBattery, receiverLength:"", receiverPower:"", dome:"", domeCategory:"", domeSize:""}}))}>
                          <div className="radio-pill-label">{st.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Color — conditional by style category */}
              {s.style && d.thColorCategory === "ric_bte" && (
                <div className="field" style={{marginBottom:16}}><label>Color</label>
                  <div className="color-swatches">
                    {TH_COLORS.ric_bte.map(c=>(
                      <div key={c} className={`color-swatch ${s.color===c?"active":""}`} onClick={()=>updSide(side,"color",c)}>{c}</div>
                    ))}
                  </div>
                </div>
              )}
              {s.style && d.thColorCategory === "slim_ric" && (
                <div className="field" style={{marginBottom:16}}><label>Color</label>
                  <div className="color-swatches">
                    {TH_COLORS.slim_ric.map(c=>(
                      <div key={c} className={`color-swatch ${s.color===c?"active":""}`} onClick={()=>updSide(side,"color",c)}>{c}</div>
                    ))}
                  </div>
                </div>
              )}
              {s.style && d.thColorCategory === "if" && (
                <div className="field-grid" style={{marginBottom:16}}>
                  <div className="field"><label>Faceplate Color</label>
                    <select value={s.faceplateColor} onChange={e=>updSide(side,"faceplateColor",e.target.value)}>
                      <option value="">Select...</option>
                      {TH_COLORS.if_faceplate.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Shell Color</label>
                    <select value={s.shellColor} onChange={e=>updSide(side,"shellColor",e.target.value)} disabled={true}>
                      <option value="Red/Blue">Red/Blue</option>
                    </select>
                  </div>
                </div>
              )}
              {s.style && d.thColorCategory === "custom" && (
                <div className="field-grid" style={{marginBottom:16}}>
                  <div className="field"><label>Faceplate Color</label>
                    <select value={s.faceplateColor} onChange={e=>updSide(side,"faceplateColor",e.target.value)}>
                      <option value="">Select...</option>
                      {TH_COLORS.custom_faceplate.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Shell Color</label>
                    <select value={s.shellColor} onChange={e=>updSide(side,"shellColor",e.target.value)}>
                      <option value="">Select...</option>
                      {TH_COLORS.custom_shell.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 5. Battery Type (auto-populated, read-only) */}
              {s.style && d.thBattery && (
                <div className="field" style={{marginBottom:16}}><label>Battery Type</label>
                  <div style={{padding:"8px 12px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,color:"#374151"}}>
                    {d.thBattery}
                  </div>
                </div>
              )}

              {/* 6. Receiver Length (RIC/RIC+BCT/SR only) */}
              {s.style && d.thHasReceiver && (
                <div className="field" style={{marginBottom:16}}><label>Receiver Length</label>
                  <select value={s.receiverLength} onChange={e=>updSide(side,"receiverLength",e.target.value)}>
                    <option value="">Select...</option>
                    {RECEIVER_LENGTHS.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}

              {/* 7. Gain/Matrix */}
              {s.style && d.thGainOptions.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Receiver Gain / Matrix</label>
                  {d.thGainOptions.length === 1 ? (
                    <div style={{padding:"8px 12px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,color:"#374151"}}>
                      {d.thGainOptions[0].label}
                    </div>
                  ) : (
                    <select value={s.gainMatrix} onChange={e=>updSide(side,"gainMatrix",e.target.value)}>
                      <option value="">Select...</option>
                      {d.thGainOptions.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* 8. Domes (RIC/RIC+BCT/SR — not for earmold) */}
              {s.style && d.thHasReceiver && s.gainMatrix && (
                d.thRequiresEarmold ? (
                  <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#854d0e",fontWeight:600}}>
                    🦻 Earmold required — dome not applicable (HP encased receiver)
                  </div>
                ) : (
                  <div className="field-grid" style={{marginBottom:16}}>
                    <div className="field"><label>Dome Category</label>
                      <select value={s.domeCategory} onChange={e=>setForm(f=>({...f,[side]:{...f[side], domeCategory:e.target.value, domeSize:""}}))}>
                        <option value="">Select...</option>
                        {Object.keys(TH_DOMES).map(cat=><option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    {s.domeCategory && TH_DOMES[s.domeCategory] && (
                      <div className="field"><label>Dome Size</label>
                        <select value={s.domeSize} onChange={e=>updSide(side,"domeSize",e.target.value)}>
                          <option value="">Select...</option>
                          {TH_DOMES[s.domeCategory].map(sz=><option key={sz} value={sz}>{sz}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )
              )}
            </>)}

            {/* ── 7–8. Color / Battery (standard catalog only) ── */}
            {!isPrivateLabel && (<>
              {s.techLevel && availColors.length > 0 && (
                <div className="field" style={{marginBottom:16}}><label>Color</label>
                  <div className="color-swatches">
                    {availColors.map(c=>(
                      <div key={c} className={`color-swatch ${s.color===c?"active":""}`} onClick={()=>updSide(side,"color",c)}>{c}</div>
                    ))}
                  </div>
                </div>
              )}
              {s.techLevel && availBatteries.length > 1 && (
                <div className="field" style={{marginBottom:16}}><label>Battery Type</label>
                  <div className="radio-group">
                    {availBatteries.map(b=>(
                      <div key={b} className={`radio-pill ${s.battery===b?"active":""}`} onClick={()=>updSide(side,"battery",b)}>
                        <div className="radio-pill-label">{b}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>)}

            {/* ── 9. Receiver + Dome (RIC — standard catalog only) ── */}
            {!isPrivateLabel && s.style === "ric" && s.techLevel && availPowers.length > 0 && (
              <>
                <div style={{height:1,background:"#f3f4f6",margin:"4px 0 16px"}} />
                <div className="field-grid" style={{marginBottom:0}}>
                  <div className="field"><label>Receiver Length</label>
                    <select value={s.receiverLength} onChange={e=>updSide(side,"receiverLength",e.target.value)}>
                      <option value="">Select…</option>
                      {RECEIVER_LENGTHS.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>Receiver Power</label>
                    <select value={s.receiverPower} onChange={e=>{
                      const pw=e.target.value;
                      updSide(side,"receiverPower",pw);
                      if((RECEIVER_POWERS[s.manufacturer]||[]).find(p=>p.id===pw)?.earmold) updSide(side,"dome","");
                    }}>
                      <option value="">Select…</option>
                      {availPowers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                {s.receiverPower && (
                  <div className="field" style={{marginBottom:0,marginTop:12}}>
                    {requiresEarmold ? (
                      <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#854d0e",fontWeight:600}}>
                        🦻 Earmold required — dome not applicable
                      </div>
                    ) : (
                      <><label>Dome Type</label>
                        <select value={s.dome} onChange={e=>updSide(side,"dome",e.target.value)}>
                          <option value="">Select…</option>
                          {availDomes.map(dm=><option key={dm}>{dm}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      };

      const leftConfigured = isSideConfigured("left");
      const rightConfigured = isSideConfigured("right");
      const leftHasCROS = leftDerived.hasCROSVariant;
      const rightHasCROS = rightDerived.hasCROSVariant;

      return (
        <>
          <div className="card">
            <div className="card-title">Treatment Options</div>

            {isPrivateLabel && (
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1e40af",fontWeight:600}}>
                🏷️ TruHearing Select — choose technology tier, model, and style to configure the device.
              </div>
            )}

            <div className="device-columns">
              {/* ── Left Column ── */}
              {renderSideColumn("left")}

              {/* ── Center Copy Buttons ── */}
              <div className="copy-actions">
                <button className="copy-btn" disabled={!leftConfigured}
                  onClick={()=>{ setForm(f=>({...f,right:{...f.left}})); setActiveSide("right"); }}
                  title="Copy left ear settings to right ear">
                  Copy to Right →
                </button>
                {leftHasCROS && (
                  <button className="copy-btn cros" disabled={!leftConfigured}
                    onClick={()=>{
                      const src = form.left;
                      const crosFam = catalog.find(e => e.id === src.familyId);
                      const crosVariant = crosFam?.variants.find(v=>v.toLowerCase().includes("cros")) || "CROS";
                      setForm(f=>({...f,right:{...src, variant:crosVariant, receiverLength:"", receiverPower:"", dome:""}}));
                      setActiveSide("right");
                    }}
                    title="Copy as CROS transmitter to right ear">
                    📡 CROS →
                  </button>
                )}
                <div style={{height:1,width:24,background:"#e5e7eb",margin:"4px 0"}} />
                <button className="copy-btn" disabled={!rightConfigured}
                  onClick={()=>{ setForm(f=>({...f,left:{...f.right}})); setActiveSide("left"); }}
                  title="Copy right ear settings to left ear">
                  ← Copy to Left
                </button>
                {rightHasCROS && (
                  <button className="copy-btn cros" disabled={!rightConfigured}
                    onClick={()=>{
                      const src = form.right;
                      const crosFam = catalog.find(e => e.id === src.familyId);
                      const crosVariant = crosFam?.variants.find(v=>v.toLowerCase().includes("cros")) || "CROS";
                      setForm(f=>({...f,left:{...src, variant:crosVariant, receiverLength:"", receiverPower:"", dome:""}}));
                      setActiveSide("left");
                    }}
                    title="Copy as CROS transmitter to left ear">
                    ← CROS 📡
                  </button>
                )}
              </div>

              {/* ── Right Column ── */}
              {renderSideColumn("right")}
            </div>

            {/* ── Pricing Reveal ── */}
            {(() => {
              const bothDone = leftConfigured && rightConfigured;
              const aidCount = (leftConfigured ? 1 : 0) + (rightConfigured ? 1 : 0);

              // Null state — plan not linked
              if (!pricingRevealData || form.tierPrice == null) {
                if (!(leftConfigured || rightConfigured)) return null;
                return (
                  <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px 24px",marginTop:12,textAlign:"center",color:"#9ca3af",fontSize:13}}>
                    Select a plan to see your investment.
                  </div>
                );
              }

              const { tierLabel, retailPerAid, copayPerAid, savingsPerAid, savingsPct } = pricingRevealData;
              const investmentPair = copayPerAid * aidCount;
              const retailPair = retailPerAid * aidCount;
              const planCoversPair = retailPair - investmentPair;

              // Chief complaint carry-forward quote
              const chiefComplaint = form.notes || "";

              return (
                <div style={{background:"linear-gradient(135deg,#f0fdf4 0%,#f8fafc 100%)",border:"1px solid #bbf7d0",borderRadius:12,padding:"20px 24px",marginTop:12}}>
                  {/* Chief complaint quote */}
                  {chiefComplaint && (
                    <div style={{fontSize:13,color:"#374151",fontStyle:"italic",borderLeft:"3px solid #16a34a",paddingLeft:12,marginBottom:16,lineHeight:1.5}}>
                      "{chiefComplaint}"
                    </div>
                  )}

                  {/* Technology tier label */}
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#9ca3af",marginBottom:12}}>
                    {tierLabel} Technology
                  </div>

                  {/* Your Investment Today — headline */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#6b7280",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>Your Investment Today</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <span style={{fontSize:28,fontWeight:800,color:"#0a1628"}}>${investmentPair.toLocaleString()}</span>
                      <span style={{fontSize:12,color:"#6b7280"}}>{bothDone ? `pair (${aidCount} aids)` : "per aid"}</span>
                    </div>
                    {/* Per-aid toggle when pair is shown */}
                    {bothDone && (
                      <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>
                        ${copayPerAid.toLocaleString()} / aid
                      </div>
                    )}
                  </div>

                  {/* Plan covers */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:"1px solid #e5e7eb",fontSize:13}}>
                    <span style={{color:"#6b7280"}}>Plan covers</span>
                    <span style={{fontWeight:600,color:"#16a34a"}}>${planCoversPair.toLocaleString()}</span>
                  </div>

                  {/* Full retail value */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:"1px solid #e5e7eb",fontSize:13}}>
                    <span style={{color:"#9ca3af"}}>Full retail value</span>
                    <span style={{color:"#9ca3af",textDecoration:"line-through"}}>${retailPair.toLocaleString()}</span>
                  </div>

                  {/* Savings badge */}
                  <div style={{background:"#dcfce7",borderRadius:8,padding:"10px 14px",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#166534"}}>
                      You save ${(savingsPerAid * aidCount).toLocaleString()}
                    </span>
                    <span style={{background:"#16a34a",color:"white",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                      {savingsPct}% off
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      );
    }
    if (step === 4) {
      const leftOk  = isSideConfigured("left");
      const rightOk = isSideConfigured("right");
      const aidCount = (leftOk ? 1 : 0) + (rightOk ? 1 : 0);
      const aidBase = form.tierPrice != null ? form.tierPrice * aidCount : null;
      const aidTotal = aidBase;
      const isTruHearing = form.tpa === "TruHearing";
      const isUHCH = form.tpa === "United Healthcare Hearing";
      const isTruHearingTPA = isTruHearing || isUHCH;

      const cpCostFor = (id) =>
        id === "paygo"    ? (isTruHearing ? 975 : isUHCH ? 1235 : 0)
        : id === "punch"  ? 575
        : 1250;

      const DeviceSummary = () => {
        if (!leftOk && !rightOk) return null;
        const renderSide = (side, label) => {
          const d = form[side];
          if (!isSideConfigured(side)) return null;
          const fam = catalog.find(e => e.id === d.familyId);
          const name = d.manufacturer === "TruHearing"
            ? `TruHearing Select · ${d.techLevel}`
            : `${fam?.family || ""} · ${d.techLevel}`;
          return (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f3f4f6"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#0a1628"}}>{label}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{name}</div>
              </div>
              {form.tierPrice != null && (
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#0a1628"}}>
                    {form.tierPrice===0?"No Charge":`$${form.tierPrice.toLocaleString()}`}
                  </div>
                  <div style={{fontSize:10,color:"#9ca3af"}}>per aid</div>
                </div>
              )}
            </div>
          );
        };
        return (
          <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:10,padding:"14px 16px",marginBottom:20}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:8}}>Selected Devices</div>
            {renderSide("left","👂 Left Ear")}
            {renderSide("right","Right Ear 👂")}
            {aidBase != null && (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingTop:10,borderTop:"2px solid #e5e7eb"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0a1628"}}>Device Total</div>
                    <div style={{fontSize:11,color:"#6b7280"}}>{aidCount} aid{aidCount!==1?"s":""} · {form.tier} tier</div>
                  </div>
                  <div style={{background:"#0a1628",color:"white",borderRadius:8,padding:"8px 16px",textAlign:"right"}}>
                    <div style={{fontSize:20,fontWeight:800,lineHeight:1}}>
                      {aidTotal===0?"No Charge":`$${aidTotal.toLocaleString()}`}
                    </div>
                    {aidCount===1 && <div style={{fontSize:10,opacity:0.6,marginTop:2}}>one ear · add second to update</div>}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      };

      // Comparison table data
      const PLAN_COMPARE = [
        {
          category: "Cost",
          paygo:    isTruHearing ? "$975 est." : isUHCH ? "$1,235 est." : "$65 / visit",
          punch:    "$575",
          complete: "$1,250",
        },
        {
          category: "Office Visits",
          paygo:    "Billed per visit · $65 each",
          punch:    "All visits · 4-year period",
          complete: "Unlimited · 5-year period",
        },
        {
          category: "Cleanings",
          paygo:    isTruHearingTPA ? "Yr 1 covered by plan" : "$65 each",
          punch:    "All included · 4-year period",
          complete: "Unlimited · 5-year period",
        },
        {
          category: "Adjustments & Triage",
          paygo:    isTruHearingTPA ? "Yr 1 covered by plan" : "$65 each",
          punch:    "All included · 4-year period",
          complete: "Unlimited · 5-year period",
        },
        {
          category: "Warranty",
          paygo:    "3 years · Yr 4 repair $250/aid",
          punch:    "3 years · Yr 4 repair $250/aid",
          complete: "5 years · repairs covered",
        },
        {
          category: "Loss & Damage",
          paygo:    "$275 / aid deductible · 3 years",
          punch:    "$275 / aid deductible · 3 years",
          complete: "$275 / aid deductible · 5 years",
        },
      ];

      const LIFECYCLE_VISITS = 20;
      const paygo4yr = isTruHearing ? 975 : isUHCH ? 1235 : LIFECYCLE_VISITS * 65;
      const savingsVsPaygo = (id) => {
        if (id === "paygo") return null;
        const s = paygo4yr - cpCostFor(id);
        return s > 0 ? s : 0;
      };
      const planCovData = {
        paygo:    {v1:"oop",v2:"oop",v3:"oop",v4:"oop",v5:"oop",v6:"oop",v7:"oop",v8:"oop",v9:"oop"},
        punch:    {v1:"inc",v2:"inc",v3:"inc",v4:"inc",v5:"inc",v6:"inc",v7:"inc",v8:"inc",v9:"oop"},
        complete: {v1:"inc",v2:"inc",v3:"inc",v4:"inc",v5:"inc",v6:"inc",v7:"inc",v8:"inc",v9:"inc"},
      };
      const dFill   = {inc:"#16a34a",par:"#d97706",oop:"transparent",cred:"#7c3aed"};
      const dStroke = {inc:"#15803d",par:"#b45309",oop:"#d1d5db",    cred:"#6d28d9"};
      const JourneyViz = () => {
        const activePlan = form.carePlan || "complete";
        const cov = planCovData[activePlan] || planCovData.complete;
        const vizDots = [
          {id:"v1",cx:88, cy:145},{id:"v2",cx:147,cy:130},{id:"v3",cx:198,cy:100},
          {id:"v4",cx:260,cy:57,star:true},{id:"v5",cx:318,cy:54},{id:"v6",cx:363,cy:54},
          {id:"v7",cx:408,cy:53},{id:"v8",cx:460,cy:53},{id:"v9",cx:565,cy:32},
        ];
        return (
          <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px 10px",marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:3}}>Hearing journey · 4-year lifecycle</div>
            <div style={{fontSize:12,color:"#6b7280",marginBottom:8,lineHeight:1.5}}>Each dot is a clinic visit. Color shows what your selected care plan covers.</div>
            <svg viewBox="0 0 680 215" width="100%" style={{display:"block"}}>
              <line x1="72" y1="145" x2="640" y2="145" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 6"/>
              <line x1="72" y1="55"  x2="640" y2="55"  stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 6"/>
              <text x="68" y="145" textAnchor="end" dominantBaseline="central" style={{fontSize:11,fill:"#9ca3af"}}>First fit</text>
              <text x="68" y="55"  textAnchor="end" dominantBaseline="central" style={{fontSize:11,fill:"#9ca3af"}}>At target</text>
              {[118,288,508].map(x=>(<line key={x} x1={x} y1="22" x2={x} y2="175" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3 5"/>))}
              <rect x="508" y="22" width="130" height="153" fill="#fef9c3" opacity="0.5"/>
              <text x="573" y="16" textAnchor="middle" style={{fontSize:11,fill:"#92400e",opacity:0.8}}>upgrade window</text>
              {/* Warranty cliff: 3-yr standard ends at x≈508, CC+ extends to x≈548 (yr 4) */}
              <line x1="508" y1="22" x2="508" y2="155" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55"/>
              <line x1="548" y1="22" x2="548" y2="155" stroke="#1d4ed8" strokeWidth="1.5" strokeDasharray="4 3" opacity={form.carePlan === "complete" ? "0.7" : "0.2"}/>
              {/* Warranty labels */}
              <text x="508" y="11" textAnchor="middle" style={{fontSize:9,fill:"#dc2626",opacity:0.85,fontWeight:600}}>3-yr</text>
              <text x="548" y="11" textAnchor="middle" style={{fontSize:9,fill:"#1d4ed8",opacity: form.carePlan === "complete" ? 0.9 : 0.35,fontWeight:600}}>CC+ yr 4</text>
              <path d="M 88,145 C 113,138 130,134 147,130 C 164,126 180,112 198,100 C 215,88 240,65 260,57 C 278,51 302,53 358,54 C 383,54 430,53 458,53 L 508,53 C 526,53 538,47 553,40 C 564,33 583,32 628,32" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="72" y1="175" x2="640" y2="175" stroke="#e5e7eb" strokeWidth="0.5"/>
              {vizDots.map(d=>(
                <g key={d.id}>
                  <circle cx={d.cx} cy={d.cy} r={d.star?9:7} fill={dFill[cov[d.id]]} stroke={dStroke[cov[d.id]]} strokeWidth="2" style={{transition:"fill 0.25s,stroke 0.25s"}}/>
                  {d.star && <text x={d.cx} y={d.cy} textAnchor="middle" dominantBaseline="central" style={{fontSize:10,fill:"white",pointerEvents:"none",fontWeight:500}}>★</text>}
                </g>
              ))}
              {[{x:93,l:"First fit",s:"Day 1"},{x:203,l:"Adaptation",s:"Wks 1–8"},{x:398,l:"Maintenance",s:"Quarterly"},{x:573,l:"Next chapter",s:"Yr 3–6"}].map(p=>(
                <g key={p.x}>
                  <text x={p.x} y="190" textAnchor="middle" style={{fontSize:12,fontWeight:500,fill:"#374151"}}>{p.l}</text>
                  <text x={p.x} y="205" textAnchor="middle" style={{fontSize:11,fill:"#9ca3af"}}>{p.s}</text>
                </g>
              ))}
            </svg>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:6}}>
              {[{c:"#16a34a",l:"Included"},{c:"#d97706",l:"Partial"},{c:"transparent",b:"#d1d5db",l:"Out of pocket"},{c:"#7c3aed",l:"Upgrade credit"}].map(item=>(
                <span key={item.l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#6b7280"}}>
                  <svg width="11" height="11"><circle cx="5.5" cy="5.5" r="4.5" fill={item.c} stroke={item.b||item.c} strokeWidth={item.b?"1.5":"1"}/></svg>
                  {item.l}
                </span>
              ))}
            </div>
          </div>
        );
      };
      const planCols = [
        {id:"paygo",   label:"Pay-As-You-Go",         color:"#6b7280", bg:"#f9fafb"},
        {id:"punch",   label:"Treatment Punch Card",   color:"#0c4a6e", bg:"#e0f2fe"},
        {id:"complete",label:"Complete Care+",         color:"#15803d", bg:"#dcfce7"},
      ];

      if (form.payType === "private") return (
        <div className="card">
          <div className="card-title">Private Pay – Standard of Care</div>
          <div style={{background:"linear-gradient(135deg,#0a1628,#1a3050)",color:"white",borderRadius:12,padding:"20px 24px",marginBottom:16}}>
            <div style={{fontSize:22,fontWeight:700,marginBottom:4}}>Standard of Care Package</div>
            <div style={{fontSize:32,fontWeight:700,color:"#4ade80"}}>$5,500</div>
            <div style={{fontSize:12,opacity:0.6,marginTop:4}}>Total investment · All-inclusive</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {["Two top-tier hearing aids (any manufacturer)","Custom earmolds if needed","Unlimited office visits for life of aids","4-year comprehensive warranty","One-time replacement per device ($275 deductible)"].map(i=>(
              <div key={i} style={{display:"flex",gap:10,fontSize:13,color:"#374151"}}><span style={{color:"#16a34a"}}>✓</span>{i}</div>
            ))}
          </div>
        </div>
      );

      const selectedPlan = CARE_PLANS.find(c => c.id === form.carePlan);
      const cpCost = form.carePlan ? cpCostFor(form.carePlan) : null;
      const grandTotal = aidTotal != null && cpCost != null
        ? aidTotal + cpCost
        : aidTotal != null ? aidTotal
        : cpCost != null ? cpCost
        : null;

      return (
        <>
          {/* Device summary */}
          <DeviceSummary />

          {/* Plan cards */}
          <div className="card">
            <div className="card-title">Choose a Care Plan</div>
            <JourneyViz />
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:24}}>
              {planCols.map(col => {
                const cp = CARE_PLANS.find(c => c.id === col.id);
                const cpCost = cpCostFor(col.id);
                const isSelected = form.carePlan === col.id;
                const savings = savingsVsPaygo(col.id);
                return (
                  <div key={col.id}
                    onClick={()=>upd("carePlan", col.id)}
                    style={{
                      border: isSelected ? `2px solid ${col.color}` : "2px solid #e5e7eb",
                      borderRadius:12, padding:"14px 12px", cursor:"pointer",
                      background: isSelected ? col.bg : "white",
                      transition:"all 0.15s", position:"relative",
                      display:"flex", flexDirection:"column",
                    }}>
                    {col.id === "complete" && (
                      <div style={{fontSize:10,fontWeight:700,color:"#15803d",background:"#dcfce7",borderRadius:6,padding:"2px 8px",display:"inline-block",marginBottom:5,letterSpacing:0.3,alignSelf:"flex-start"}}>Most comprehensive</div>
                    )}
                    <div style={{fontSize:11,fontWeight:700,color:col.color,marginBottom:4,lineHeight:1.3}}>{cp.label}</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0a1628",lineHeight:1}}>
                      {col.id === "paygo"
                        ? (isTruHearing ? "$975" : isUHCH ? "$1,235" : "$65")
                        : `$${cpCost.toLocaleString()}`}
                    </div>
                    <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>
                      {col.id === "paygo"
                        ? (isTruHearingTPA ? "est. over 4 yrs" : "per visit")
                        : "one-time"}
                    </div>
                    {savings !== null && savings > 0 && col.id !== "complete" && (
                      <div style={{marginTop:7,fontSize:10,fontWeight:700,color:"#15803d",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 7px",display:"inline-block",alignSelf:"flex-start"}}>
                        Save ${savings.toLocaleString()} vs pay-as-you-go
                      </div>
                    )}
                    {col.id === "complete" && (() => {
                      const repairVal = aidCount * 250;
                      const visitSavings = savings > 0 ? savings : 0;
                      const totalVal = visitSavings + repairVal;
                      return (
                        <div style={{marginTop:7,display:"flex",flexDirection:"column",gap:4}}>
                          {visitSavings > 0 && (
                            <div style={{fontSize:10,fontWeight:700,color:"#15803d",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 7px",display:"inline-block",alignSelf:"flex-start"}}>
                              Save ${visitSavings.toLocaleString()} on visits
                            </div>
                          )}
                          <div style={{fontSize:10,fontWeight:700,color:"#1d4ed8",background:"#dbeafe",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 7px",display:"inline-block",alignSelf:"flex-start"}}>
                            +${repairVal.toLocaleString()} yr 4 repair protection
                          </div>
                          {totalVal > 0 && (
                            <div style={{fontSize:10,color:"#6b7280",marginTop:1}}>
                              Up to ${totalVal.toLocaleString()} total value
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {isSelected && <div style={{marginTop:8,fontSize:11,fontWeight:700,color:col.color}}>&#10003; Selected</div>}
                  </div>
                );
              })}
            </div>

            {/* Comparison table */}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"#f9fafb"}}>
                    <th style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:"#6b7280",fontSize:11,letterSpacing:1,textTransform:"uppercase",borderBottom:"2px solid #e5e7eb",width:"28%"}}>Feature</th>
                    {planCols.map(col=>(
                      <th key={col.id} style={{padding:"10px 12px",textAlign:"center",fontWeight:700,color:col.color,fontSize:11,letterSpacing:0.5,borderBottom:`2px solid ${form.carePlan===col.id?col.color:"#e5e7eb"}`,background:form.carePlan===col.id?col.bg:"#f9fafb"}}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLAN_COMPARE.map((row, i) => (
                    <tr key={row.category} style={{background:i%2===0?"white":"#fafafa"}}>
                      <td style={{padding:"9px 12px",fontWeight:600,color:"#374151",borderBottom:"1px solid #f3f4f6"}}>{row.category}</td>
                      {planCols.map(col=>(
                        <td key={col.id} style={{
                          padding:"9px 12px",textAlign:"center",color:"#374151",
                          borderBottom:"1px solid #f3f4f6",lineHeight:1.4,
                          background:form.carePlan===col.id?col.bg:undefined,
                          fontWeight:form.carePlan===col.id?600:400,
                        }}>
                          {row[col.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total investment */}
            {(aidTotal != null || form.carePlan) && (
              <div style={{marginTop:20,borderTop:"2px solid #e5e7eb",paddingTop:16}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:10}}>Total Patient Investment</div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                  {aidTotal != null && (
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151"}}>
                      <span>Hearing aids ({aidCount} aid{aidCount!==1?"s":""} · {form.tier})</span>
                      <span style={{fontWeight:600}}>{aidTotal===0?"No Charge":`$${aidTotal.toLocaleString()}`}</span>
                    </div>
                  )}
                  {form.carePlan && (
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151"}}>
                      <span>{selectedPlan?.label}</span>
                      <span style={{fontWeight:600}}>
                        {form.carePlan==="paygo"
                          ? (isTruHearing?"$975 est.":isUHCH?"$1,235 est.":"$65/visit")
                          : `$${cpCost.toLocaleString()}`}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{background:"linear-gradient(135deg,#0a1628,#1a3050)",borderRadius:12,padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"rgba(255,255,255,0.45)"}}>Total Investment</div>
                    {aidCount===1 && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>One ear · configure second to update</div>}
                    {form.carePlan==="paygo" && (
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:2}}>
                        {isTruHearing?"est. · yr 1 covered, 15 visits yrs 2–4":isUHCH?"est. · first 3 mo. covered, 19 visits remaining":"care plan billed per visit"}
                      </div>
                    )}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:32,fontWeight:800,color:"#4ade80",lineHeight:1}}>
                      {grandTotal===0?"No Charge":`$${grandTotal.toLocaleString()}`}
                    </div>
                    {form.carePlan==="paygo" && isTruHearingTPA && (
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:3}}>estimated</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Fork: Sign PA / Generate Quote / Continue ────────── */}
            <div style={{marginTop:24,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
              <div style={{display:"flex",gap:12,width:"100%",justifyContent:"center"}}>
                <button
                  disabled={!(form.payType === "private" || !!form.carePlan)}
                  style={{background:"#15803d",color:"white",border:"none",borderRadius:8,padding:"12px 24px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",opacity:(form.payType === "private" || !!form.carePlan)?1:0.4,display:"flex",alignItems:"center",gap:8}}
                  onClick={()=>{ setPaSignatureName(""); setPaStep("review"); setShowWizardPaModal(true); }}
                >
                  <span style={{fontSize:16}}>📝</span> Sign Purchase Agreement
                </button>
                <button
                  disabled={!(form.payType === "private" || !!form.carePlan)}
                  style={{background:"#1e40af",color:"white",border:"none",borderRadius:8,padding:"12px 24px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",opacity:(form.payType === "private" || !!form.carePlan)?1:0.4,display:"flex",alignItems:"center",gap:8}}
                  onClick={handleGenerateQuote}
                >
                  <span style={{fontSize:16}}>📄</span> Generate Quote
                </button>
              </div>
              <button
                disabled={!(form.payType === "private" || !!form.carePlan)}
                style={{background:"none",border:"none",color:"#9ca3af",fontFamily:"'Sora',sans-serif",fontSize:12,cursor:"pointer",padding:"4px 12px",opacity:(form.payType === "private" || !!form.carePlan)?1:0.4}}
                onClick={()=>setStep(5)}
              >
                Continue to review →
              </button>
            </div>
          </div>
        </>
      );
    }
    if (step === 5) {
      const ReviewSide = ({side, label}) => {
        const d = form[side];
        const fam = catalog.find(e => e.id === d.familyId);
        const isTH = d.manufacturer === "TruHearing";
        if (!d.familyId && !isTH) return (
          <div className="review-row"><span className="review-key">{label}</span><span className="review-val" style={{color:"#9ca3af"}}>Not configured</span></div>
        );
        if (isTH && (!d.techLevel || !d.thModel)) return (
          <div className="review-row"><span className="review-key">{label}</span><span className="review-val" style={{color:"#9ca3af"}}>Not configured</span></div>
        );
        const pwrLabel = (RECEIVER_POWERS[d.manufacturer]||[]).find(p=>p.id===d.receiverPower)?.label||"—";
        const isEm = (RECEIVER_POWERS[d.manufacturer]||[]).find(p=>p.id===d.receiverPower)?.earmold;
        const styleLabel = BODY_STYLES.find(s=>s.id===d.style)?.label || d.style || "—";
        const thGen = fam?.generation || d.generation || "—";
        const thSeries = fam?.thSeries || "";
        const isLi = fam?.rechargeable || false;
        const planTierPrice = INSURANCE_PLANS.find(p=>p.carrier===form.carrier&&p.planGroup===form.planGroup)
          ?.tiers?.find(t=>t.label===d.techLevel)?.price ?? null;
        return (
          <>
            <div className="review-row" style={{background:"#f8fafc",borderRadius:6,padding:"6px 10px",margin:"4px 0"}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>{label}</span>
            </div>
            {[
              [d.manufacturer, "Manufacturer"],
              [isTH ? `${thGen} · TruHearing Select` : d.generation, "Platform"],
              [isTH ? (fam?.family || "TruHearing Select") : (fam?.family||""), "Model Family"],
              ...(isTH ? [
                [thSeries ? `${thSeries} · ${d.techLevel}` : d.techLevel, "Series / Tier"],
                [styleLabel, "Body Style"],
                ...(d.variant ? [[d.variant, "Variant / Style"]] : []),
                [d.isCROS ? "CROS Transmitter" : "Standard", "CROS"],
                [isLi ? "Rechargeable (Li-Ion) ♻" : (d.battery||"—"), "Battery"],
              ] : [
                [d.variant||"—", "Variant"],
                [d.color||"N/A", "Color"],
                [d.battery||"N/A", "Battery"],
              ]),
              ...(isTH ? [] : [[d.techLevel, "Tech Level"]]),
              ...(d.style==="ric" ? [
                [d.receiverLength||"—", "Receiver Length"],
                [pwrLabel, "Receiver Power"],
                [isEm?"Custom Earmold":(d.dome||"—"), "Dome / Coupling"],
              ] : []),
            ].map(([v,k])=>(
              <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
            ))}
            {isTH && planTierPrice !== null && (
              <div className="review-row" style={{background:"#f0fdf4",borderRadius:6,padding:"6px 10px",marginTop:4}}>
                <span className="review-key">Patient Cost</span>
                <span className="review-val" style={{fontWeight:700,color:"#15803d"}}>
                  {planTierPrice === 0 ? "No Charge" : `$${planTierPrice.toLocaleString()} / aid`}
                </span>
              </div>
            )}
          </>
        );
      };
      return (
        <div className="card">
          <div className="card-title">Review & Create Profile</div>
          <div className="review-section">
            <div className="review-label">Patient</div>
            {[[[form.firstName,form.lastName].filter(Boolean).join(" "),"Name"],[form.dob,"Date of Birth"],[form.phone,"Phone"],[form.email||"—","Email"]].map(([v,k])=>(
              <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
            ))}
          </div>
          <div className="review-section">
            <div className="review-label">Coverage</div>
            {form.payType==="insurance" ? (
              [[form.carrier,"Carrier"],[form.planGroup,"Plan"],[form.tpa,"TPA"],[CARE_PLANS.find(c=>c.id===form.carePlan)?.label||"","Care Plan"]].map(([v,k])=>(
                <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
              ))
            ) : (
              <div className="review-row"><span className="review-key">Type</span><span className="review-val">Private Pay – $5,500 Standard of Care</span></div>
            )}
          </div>
          <div className="review-section">
            <div className="review-label">Devices</div>
            <ReviewSide side="left" label="👂 Left Ear" />
            <div style={{height:8}} />
            <ReviewSide side="right" label="Right Ear 👂" />
          </div>
          {wizardPaSigned && (
            <div style={{background:"#ecfdf5",border:"1px solid #bbf7d0",borderRadius:8,padding:"12px 16px",marginTop:12,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>✓</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#15803d"}}>Purchase Agreement signed</div>
                <div style={{fontSize:11,color:"#16a34a"}}>Warranty begins 14 days from signature date</div>
              </div>
            </div>
          )}
          <div className="field" style={{marginTop:16}}><label>Notes</label><textarea value={form.notes} onChange={e=>upd("notes",e.target.value)} rows={3} placeholder="Special considerations, follow-up notes, etc." /></div>
        </div>
      );
    }
    };


  // Load punch data when patient changes
  useEffect(() => {
    if (selectedPatient?.id) {
      loadPunch(selectedPatient.id).then(setPunchData);
      setPunchConfirm(null);
      setPunchSuccess(null);
    }
  }, [selectedPatient?.id]);


  const handlePunch = async (type) => {
    const key = type === "cleaning" ? "cleanings" : "appointments";
    const limit = type === "cleaning" ? 12 : 16;
    if (punchData[key] >= limit) return;
    const entry = { type, date: new Date().toISOString(), by: location };
    const next = { ...punchData, [key]: punchData[key] + 1, log: [...(punchData.log||[]), entry] };
    await savePunch(selectedPatient.id, next);
    setPunchData(next);
    setPunchConfirm(null);
    setPunchSuccess(type);
    setTimeout(() => setPunchSuccess(null), 2500);
  };


  const handleUndoPunch = async (type) => {
    const key = type === "cleaning" ? "cleanings" : "appointments";
    if (punchData[key] <= 0) return;
    const log = [...(punchData.log||[])];
    // Remove last entry of this type
    const lastIdx = log.map(e=>e.type).lastIndexOf(type);
    if (lastIdx > -1) log.splice(lastIdx, 1);
    const next = { ...punchData, [key]: punchData[key] - 1, log };
    await savePunch(selectedPatient.id, next);
    setPunchData(next);
  };


  // ── SETTINGS ──────────────────────────────────────────────────────────────
  const ACCENT_COLORS = [
    { label:"Green",   value:"#16a34a" },
    { label:"Blue",    value:"#2563eb" },
    { label:"Violet",  value:"#7c3aed" },
    { label:"Rose",    value:"#e11d48" },
    { label:"Amber",   value:"#d97706" },
    { label:"Teal",    value:"#0d9488" },
  ];


  const handleClinicSave = async () => {
    setClinic(clinicDraft);
    try { await saveClinicSettings(clinicId, clinicDraft); } catch {}
    setClinicSaved(true);
    setTimeout(() => setClinicSaved(false), 3000);
  };


  const renderSettings = () => (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Clinic Settings</div>
          <div className="topbar-sub">Customize how Distil appears to your team and patients</div>
        </div>
      </div>
      <div className="content">
        <div className="settings-wrap">
          {clinicSaved && <div className="save-success">✓ Settings saved — patient app updated</div>}


          <div className="settings-section">
            <div className="settings-title">Clinic Preview</div>
            <div className="settings-preview">
              <div>
                <div className="distil-badge">Distil</div>
                <div className="settings-preview-logo">{clinicDraft.name || "Your Clinic"}</div>
                <div className="settings-preview-sub">{clinicDraft.address}</div>
              </div>
              <div style={{marginLeft:"auto",width:16,height:16,borderRadius:"50%",background:clinicDraft.accent,flexShrink:0}} />
            </div>


            <div className="settings-field">
              <label>Clinic Name</label>
              <input value={clinicDraft.name} onChange={e=>setClinicDraft(d=>({...d,name:e.target.value}))} placeholder="Your Hearing Clinic" />
            </div>
            <div className="settings-field">
              <label>Address</label>
              <input value={clinicDraft.address} onChange={e=>setClinicDraft(d=>({...d,address:e.target.value}))} placeholder="123 Main St, City, ST 00000" />
            </div>
            <div className="settings-field">
              <label>Phone</label>
              <input value={clinicDraft.phone} onChange={e=>setClinicDraft(d=>({...d,phone:e.target.value}))} placeholder="(555) 555-5555" />
            </div>
            <div className="settings-field">
              <label>Accent Color</label>
              <div className="color-options">
                {ACCENT_COLORS.map(c=>(
                  <div key={c.value} className={`color-option ${clinicDraft.accent===c.value?"active":""}`}
                    style={{background:c.value}} title={c.label}
                    onClick={()=>setClinicDraft(d=>({...d,accent:c.value}))} />
                ))}
              </div>
            </div>
          </div>


          <div className="settings-section">
            <div className="settings-title">Campaign Administration</div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:12}}>Set up the default nurture campaign and backfill existing patients.</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="btn-primary" onClick={async ()=>{
                const result = await seedDefaultCampaign(clinicId, staffId);
                if (result) alert("Default campaign seeded! Check the Campaigns view.");
                else alert("Campaign already exists or error occurred.");
              }}>Seed Default Campaign</button>
              <button className="btn-ghost" onClick={async ()=>{
                const result = await backfillCampaignEnrollment(clinicId, staffId);
                alert(`Backfill complete: ${result.enrolled} enrolled, ${result.skipped} skipped.${result.error ? ' ' + result.error : ''}`);
              }}>Backfill Existing Patients</button>
            </div>
          </div>


          <div className="settings-section">
            <div className="settings-title">About Distil</div>
            {[["Version","1.0 Prototype"],["Patient App","Aided"],["Noah Integration","Coming soon — Noah ES API"],["HIPAA","Data stored locally in this session"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f3f4f6",fontSize:13}}>
                <span style={{color:"#9ca3af"}}>{k}</span>
                <span style={{fontWeight:500,color:"#374151"}}>{v}</span>
              </div>
            ))}
          </div>


          <button className="btn-primary green" onClick={handleClinicSave} style={{width:"100%",justifyContent:"center"}}>
            Save Settings
          </button>
        </div>
      </div>
    </>
  );


  // ── PATIENT CAMPAIGN CARD (embedded in patient detail) ────────────────────
  function PatientCampaignCard({ patient, staffId: sid }) {
    const [campaigns, setCampaigns] = useState([]);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
      if (patient?.id) loadPatientCampaigns(patient.id).then(c => { setCampaigns(c); setLoaded(true); });
    }, [patient?.id]);
    if (!loaded) return null;
    const CAT_COLORS = { welcome:"#16a34a", education:"#1d4ed8", maintenance:"#92400e", lima_charlie:"#4338ca", upgrade:"#be185d", general:"#6b7280" };
    return (
      <div className="detail-card full">
        <div className="detail-card-title">Campaign Journey</div>
        {campaigns.length === 0 ? (
          <div style={{color:"#9ca3af",fontSize:13,padding:"12px 0"}}>No active campaigns. Patient will be auto-enrolled when saved with device data.</div>
        ) : campaigns.map(c => {
          const deliveries = c.campaign_deliveries || [];
          const delivered = deliveries.filter(d => d.status === "delivered").length;
          const total = deliveries.length;
          const pct = total ? (delivered / total) * 100 : 0;
          const next = deliveries.filter(d => d.status === "pending").sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];
          return (
            <div key={c.id} style={{marginBottom:16,padding:14,background:"#f9fafb",borderRadius:10,border:"1px solid #e5e7eb"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:13,color:"#0a1628"}}>{c.campaign_templates?.name || "Campaign"}</div>
                <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:12,
                  background:c.status==="active"?"#dcfce7":c.status==="paused"?"#fef3c7":"#f3f4f6",
                  color:c.status==="active"?"#16a34a":c.status==="paused"?"#92400e":"#6b7280"}}>{c.status}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{flex:1,height:4,background:"#e5e7eb",borderRadius:2,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:"#16a34a",borderRadius:2}} />
                </div>
                <span style={{fontSize:11,color:"#9ca3af",whiteSpace:"nowrap"}}>{delivered}/{total} delivered</span>
              </div>
              {next && (
                <div style={{fontSize:11,color:"#6b7280"}}>
                  Next: <strong>{next.campaign_steps?.campaign_content?.title || "—"}</strong> on {fmtDate(next.scheduled_date)}
                </div>
              )}
              {/* Recent timeline */}
              <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:4}}>
                {deliveries.slice(0, 12).map((d, i) => {
                  const cat = d.campaign_steps?.campaign_content?.category || "general";
                  return (
                    <div key={i} title={`${d.campaign_steps?.campaign_content?.title || ""} (${d.status})`} style={{
                      width:8,height:8,borderRadius:"50%",
                      background: d.status==="delivered" ? (CAT_COLORS[cat] || "#6b7280") : d.status==="pending" ? "#e5e7eb" : "#fecaca",
                    }} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── PATIENT DETAIL ────────────────────────────────────────────────────────
  const renderPatientDetail = () => {
    const p = selectedPatient;
    if (!p) return null;
    const days = daysUntil(p.devices?.warrantyExpiry||"");
    const qrPattern = Array.from({length:64},(_,i)=> [0,7,8,15,16,17,24,31,32,33,40,47,48,55,56,63].includes(i%16) || (i>8&&i<15) || (i>48&&i<55) || (i%8===0&&i<32));
    return (
      <>
        <div className="topbar">
          <div>
            <div className="topbar-title">{p.name}</div>
            <div className="topbar-sub">Patient ID: {p.id.slice(0,8).toUpperCase()} · {p.location} · Added {fmtDate(p.createdAt)}</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {p.devices && p.carePlan && (
              <button
                style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                onClick={() => { setPaSignatureName(""); setPaDeliveryName(""); setPaDeliveryDate(""); setPaStep("sign"); setShowPurchaseAgreement(true); }}
              >
                <span style={{fontSize:14}}>📄</span> Purchase Agreement
              </button>
            )}
            <button className="btn-ghost" onClick={()=>setView("dashboard")}>← Back</button>
          </div>
        </div>

        {/* ── PURCHASE AGREEMENT MODAL ──────────────────────────────────── */}
        {showPurchaseAgreement && (() => {
          const cpId = p.carePlan;
          const hasDevices = p.devices?.left || p.devices?.right;
          const canGenerate = paSignatureName.trim().length > 2;

          const handleGeneratePDF = (includeDelivery = false) => {
            const pricePerAid = p.insurance?.tierPrice || 0;
            downloadPurchaseAgreement({
              patient: { name: p.name, address: p.address, phone: p.phone, dob: p.dob },
              devices: {
                fittingType: p.devices?.fittingType || 'bilateral',
                left: p.devices?.left || null,
                right: p.devices?.right || null,
              },
              carePlan: cpId,
              pricePerAid,
              clinic: staffProfile?.clinic || clinic,
              provider: {
                fullName: staffProfile?.fullName || 'Provider',
                activeLicense: staffProfile?.activeLicense || '',
                signatureUrl: staffProfile?.signatureUrl || null,
              },
              patientSignature: paSignatureName.trim(),
              patientSignatureDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
              deliverySignature: includeDelivery ? paDeliveryName.trim() || null : null,
              deliveryDate: includeDelivery ? paDeliveryDate || null : null,
              signatureImageBase64: null, // Will be populated once signature is uploaded to Supabase Storage
            });
            setShowPurchaseAgreement(false);
          };

          return (
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(10,22,40,0.55)",backdropFilter:"blur(4px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowPurchaseAgreement(false)}>
              <div style={{background:"white",borderRadius:16,padding:32,width:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div>
                    <div style={{fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:18,color:"#0a1628"}}>Purchase Agreement</div>
                    <div style={{fontFamily:"'Sora',sans-serif",fontSize:12,color:"#6b7280",marginTop:2}}>{p.name}</div>
                  </div>
                  <button onClick={()=>setShowPurchaseAgreement(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#9ca3af",padding:4}}>✕</button>
                </div>

                {/* Summary */}
                <div style={{background:"#f8fafc",borderRadius:10,padding:16,marginBottom:20,border:"1px solid #e5e7eb"}}>
                  <div style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:11,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,marginBottom:8}}>Agreement Summary</div>
                  {hasDevices && (
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#374151"}}>{p.devices?.left?.manufacturer || p.devices?.right?.manufacturer} {p.devices?.left?.family || p.devices?.right?.family} ({p.devices?.fittingType === 'bilateral' ? 'pair' : 'single'})</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,color:"#0a1628"}}>${((p.insurance?.tierPrice||0) * (p.devices?.fittingType === 'bilateral' || p.devices?.fittingType === 'cros_bicros' ? 2 : 1)).toLocaleString('en-US',{minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  {cpId && cpId !== 'paygo' && (
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#374151"}}>{cpId === 'complete' ? 'Complete Care+' : 'Treatment Punch Card'}</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,color:"#0a1628"}}>{cpId === 'complete' ? '$1,250.00' : '$575.00'}</span>
                    </div>
                  )}
                  {cpId === 'paygo' && (
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#6b7280",fontStyle:"italic"}}>Pay-As-You-Go (est. 5-yr: $1,625)</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#6b7280"}}>$0.00</span>
                    </div>
                  )}
                  <div style={{borderTop:"1px solid #e5e7eb",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"'Sora',sans-serif",fontSize:14,fontWeight:700,color:"#0a1628"}}>Total</span>
                    <span style={{fontFamily:"'Sora',sans-serif",fontSize:14,fontWeight:700,color:"#0a1628"}}>${(((p.insurance?.tierPrice||0) * (p.devices?.fittingType === 'bilateral' || p.devices?.fittingType === 'cros_bicros' ? 2 : 1)) + (cpId === 'complete' ? 1250 : cpId === 'punch' ? 575 : 0)).toLocaleString('en-US',{minimumFractionDigits:2})}</span>
                  </div>
                </div>

                {paStep === "sign" && (
                  <>
                    {/* Adopt and Sign */}
                    <div style={{marginBottom:20}}>
                      <div style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:11,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,marginBottom:8}}>Patient Signature — Adopt and Sign</div>
                      <div style={{fontFamily:"'Sora',sans-serif",fontSize:12,color:"#6b7280",marginBottom:10}}>Type your full legal name to electronically sign this agreement.</div>
                      <input
                        value={paSignatureName}
                        onChange={e => setPaSignatureName(e.target.value)}
                        placeholder="Full legal name"
                        autoFocus
                        style={{width:"100%",padding:"12px 14px",border:"1px solid #e5e7eb",borderRadius:10,fontFamily:"'Sora',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}}
                      />
                      {paSignatureName.trim().length > 2 && (
                        <div style={{marginTop:12,padding:"14px 18px",background:"#f8fafc",borderRadius:10,border:"1px dashed #d1d5db"}}>
                          <div style={{fontFamily:"'Georgia','Times New Roman',serif",fontSize:24,fontStyle:"italic",color:"#0a1628",letterSpacing:0.5}}>{paSignatureName}</div>
                          <div style={{fontFamily:"'Sora',sans-serif",fontSize:10,color:"#9ca3af",marginTop:4}}>Electronic signature preview</div>
                        </div>
                      )}
                    </div>

                    <div style={{display:"flex",gap:10}}>
                      <button
                        disabled={!canGenerate}
                        onClick={() => handleGeneratePDF(false)}
                        style={{flex:1,background:canGenerate?"#0a1628":"#d1d5db",color:"white",border:"none",borderRadius:10,padding:"12px 20px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:canGenerate?"pointer":"not-allowed",transition:"all 0.15s"}}
                      >
                        Adopt, Sign & Download
                      </button>
                      <button
                        onClick={() => setPaStep("delivery")}
                        style={{background:"none",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",color:"#6b7280",whiteSpace:"nowrap"}}
                      >
                        + Delivery
                      </button>
                    </div>
                  </>
                )}

                {paStep === "delivery" && (
                  <>
                    {/* Show patient signature as confirmed */}
                    <div style={{background:"#ecfdf5",borderRadius:10,padding:12,marginBottom:16,border:"1px solid #a7f3d0",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:"#16a34a",fontSize:16}}>✓</span>
                      <span style={{fontFamily:"'Sora',sans-serif",fontSize:13,color:"#065f46"}}>Purchase signed by {paSignatureName}</span>
                    </div>

                    <div style={{marginBottom:16}}>
                      <div style={{fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:11,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,marginBottom:8}}>Delivery Acknowledgement</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                        <div>
                          <label style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Patient Name</label>
                          <input
                            value={paDeliveryName}
                            onChange={e => setPaDeliveryName(e.target.value)}
                            placeholder="Full legal name"
                            autoFocus
                            style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                        <div>
                          <label style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#6b7280",display:"block",marginBottom:4}}>Delivery Date</label>
                          <input
                            type="date"
                            value={paDeliveryDate}
                            onChange={e => setPaDeliveryDate(e.target.value)}
                            style={{width:"100%",padding:"10px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{display:"flex",gap:10}}>
                      <button
                        onClick={() => setPaStep("sign")}
                        style={{background:"none",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 16px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",color:"#6b7280"}}
                      >
                        ← Back
                      </button>
                      <button
                        onClick={() => handleGeneratePDF(true)}
                        disabled={!paDeliveryName.trim() || !paDeliveryDate}
                        style={{flex:1,background:(paDeliveryName.trim()&&paDeliveryDate)?"#0a1628":"#d1d5db",color:"white",border:"none",borderRadius:10,padding:"12px 20px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:(paDeliveryName.trim()&&paDeliveryDate)?"pointer":"not-allowed",transition:"all 0.15s"}}
                      >
                        Sign & Download with Delivery
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        <div className="content">
          <div className="qr-prompt">
            <div className="qr-title">Patient App QR Code</div>
            <div className="qr-sub">Patient scans this to load their profile in the Aided companion app</div>
            <div className="qr-box">
              <div className="qr-grid">
                {Array.from({length:64},(_,i)=>(
                  <div key={i} className="qr-cell" style={{background: (qrPattern[i]||(Math.random()>0.5&&i>8&&i<55)) ? "#0a1628":"transparent"}} />
                ))}
              </div>
            </div>
            <div className="qr-id">{p.id.slice(0,8).toUpperCase()}</div>
            <div className="qr-inst">Patient ID · Used to sync with app</div>
          </div>


          <div className="detail-grid">
            {/* ── CONTACT INFORMATION ─────────────────────────────────────── */}
            <div className="detail-card">
              <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                <div className="detail-card-title" style={{marginBottom:0}}>Contact Information</div>
                {/* TODO: restrict to care_coordinator, provider, admin once checkRole is enforced */}
                {editSection !== "contact" && checkRole(null, ["care_coordinator","provider","admin"]) && (
                  <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={startEditContact}>Edit</button>
                )}
              </div>
              {editSection === "contact" ? (
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>First Name</label><input value={editDraft.firstName} onChange={e=>setEditDraft(d=>({...d,firstName:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Last Name</label><input value={editDraft.lastName} onChange={e=>setEditDraft(d=>({...d,lastName:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Date of Birth</label><input type="date" value={editDraft.dob} onChange={e=>setEditDraft(d=>({...d,dob:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Phone</label><input value={editDraft.phone} onChange={e=>setEditDraft(d=>({...d,phone:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Email</label><input value={editDraft.email} onChange={e=>setEditDraft(d=>({...d,email:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:6}}>Pay Type</label>
                    <div style={{display:"flex",gap:8}}>
                      {[["insurance","Insurance"],["private","Private Pay"]].map(([val,label])=>(
                        <div key={val} onClick={()=>setEditDraft(d=>({...d,payType:val}))} style={{flex:1,border:`2px solid ${editDraft.payType===val?"#0a1628":"#e5e7eb"}`,borderRadius:10,padding:"10px",cursor:"pointer",textAlign:"center",background:editDraft.payType===val?"#f8fafc":"white",transition:"all 0.15s"}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#0a1628"}}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{marginBottom:4}}>
                    <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Notes</label>
                    <textarea value={editDraft.notes} onChange={e=>setEditDraft(d=>({...d,notes:e.target.value}))} rows={3} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"}} />
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                    <button onClick={saveEditContact} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                    <button onClick={cancelEdit} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                    {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                    {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                  </div>
                </div>
              ) : (
                <div>
                  {[["Name",p.name],["Date of Birth",p.dob?fmtDate(p.dob):"—"],["Phone",p.phone||"—"],["Email",p.email||"—"]].map(([k,v])=>(
                    <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
                  ))}
                  {p.payType && <div className="detail-row"><span className="detail-key">Pay Type</span><span className="detail-val">{p.payType==="insurance"?"Insurance":"Private Pay"}</span></div>}
                  {p.notes && <div className="detail-row"><span className="detail-key">Notes</span><span className="detail-val" style={{whiteSpace:"pre-wrap"}}>{p.notes}</span></div>}
                </div>
              )}
            </div>

            {/* ── COVERAGE ────────────────────────────────────────────────── */}
            <div className="detail-card">
              <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                <div className="detail-card-title" style={{marginBottom:0}}>Coverage</div>
                {/* TODO: restrict to care_coordinator, provider, admin once checkRole is enforced */}
                {editSection !== "coverage" && checkRole(null, ["care_coordinator","provider","admin"]) && (
                  <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={startEditCoverage}>Edit</button>
                )}
              </div>
              {editSection === "coverage" ? (
                <div>
                  {/* Insurance plan search — reuses same component pattern as Step 0 of new patient form */}
                  <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:10}}>Insurance Plan Search</div>
                    <input
                      placeholder="Search carrier or plan name…"
                      value={editPlanSearch}
                      onChange={e=>setEditPlanSearch(e.target.value)}
                      style={{width:"100%",marginBottom:8,padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}}
                    />
                    <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,paddingRight:2}}>
                      {(insurancePlans.length ? insurancePlans : INSURANCE_PLANS)
                        .filter(plan=>{const q=(editPlanSearch||"").toLowerCase();return !q||plan.carrier.toLowerCase().includes(q)||plan.planGroup.toLowerCase().includes(q)||(plan.tpa||"").toLowerCase().includes(q);})
                        .sort((a,b)=>a.planGroup.localeCompare(b.planGroup))
                        .slice(0,30)
                        .map(plan=>(
                          <div key={plan.planGroup}
                            className={`plan-row ${editDraft.planGroup===plan.planGroup?"active":""}`}
                            onClick={()=>setEditDraft(d=>({...d,carrier:plan.carrier,planGroup:plan.planGroup,tpa:plan.tpa||"",tier:"",tierPrice:null}))}>
                            <div className="plan-row-name">{plan.planGroup}</div>
                            <div className="plan-row-tpa">{plan.carrier} · via {plan.tpa}</div>
                          </div>
                        ))}
                    </div>
                    {editDraft.planGroup && (
                      <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #e5e7eb",display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>TPA</span>
                        <span style={{fontSize:13,fontWeight:600,color:"#374151",background:"#f3f4f6",borderRadius:6,padding:"3px 10px"}}>{editDraft.tpa}</span>
                        <button style={{marginLeft:"auto",fontSize:11,color:"#9ca3af",background:"none",border:"none",cursor:"pointer",padding:0}}
                          onClick={()=>setEditDraft(d=>({...d,carrier:"",planGroup:"",tpa:"",tier:"",tierPrice:null}))}>✕ Clear</button>
                      </div>
                    )}
                  </div>
                  {/* Individual field overrides */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Carrier</label><input value={editDraft.carrier} onChange={e=>setEditDraft(d=>({...d,carrier:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>TPA</label><input value={editDraft.tpa} onChange={e=>setEditDraft(d=>({...d,tpa:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Tier</label><input value={editDraft.tier} onChange={e=>setEditDraft(d=>({...d,tier:e.target.value}))} placeholder="e.g. Level 3" style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Copay ($/aid)</label><input type="number" value={editDraft.tierPrice??""} onChange={e=>setEditDraft(d=>({...d,tierPrice:e.target.value?Number(e.target.value):null}))} placeholder="e.g. 999" style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Warranty Expiry</label><input type="date" value={editDraft.warrantyExpiry} onChange={e=>setEditDraft(d=>({...d,warrantyExpiry:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Care Plan</label>
                      <select value={editDraft.carePlanType} onChange={e=>setEditDraft(d=>({...d,carePlanType:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",background:"white",boxSizing:"border-box"}}>
                        <option value="">— None —</option>
                        {CARE_PLANS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                    <button onClick={saveEditCoverage} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                    <button onClick={cancelEdit} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                    {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                    {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                  </div>
                </div>
              ) : (
                <div>
                  {p.payType==="insurance" ? [
                    ["Carrier",p.insurance?.carrier],["Plan",p.insurance?.planGroup],["TPA",p.insurance?.tpa],["Tier",p.insurance?.tier],["Copay",p.insurance?.tierPrice!=null?`$${p.insurance.tierPrice.toLocaleString()}/aid`:null]
                  ].map(([k,v])=>(
                    <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v||"—"}</span></div>
                  )) : (
                    <div className="detail-row"><span className="detail-key">Type</span><span className="detail-val">Private Pay – $5,500</span></div>
                  )}
                  {p.payType === "insurance" && <div className="detail-row"><span className="detail-key">Care Plan</span><span className="detail-val">{CARE_PLANS.find(c=>c.id===p.carePlan)?.label||"—"}</span></div>}
                  {p.devices?.warrantyExpiry && <div className="detail-row"><span className="detail-key">Warranty Expiry</span><span className="detail-val">{fmtDate(p.devices.warrantyExpiry)}</span></div>}
                </div>
              )}
            </div>

            {/* ── DEVICE SPECIFICATIONS ────────────────────────────────────── */}
            <div className="detail-card full">
              <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                <div className="detail-card-title" style={{marginBottom:0}}>Device Specifications</div>
                {/* TODO: restrict to provider, admin once checkRole is enforced */}
                {editSection !== "devices" && checkRole(null, ["provider","admin"]) && (
                  <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={startEditDevices}>Edit</button>
                )}
              </div>
              {editSection === "devices" ? (
                <div>
                  {/* Fitting-level fields */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:8}}>Fitting Info</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Fitting Type</label>
                        <select value={editDraft.fittingType} onChange={e=>setEditDraft(d=>({...d,fittingType:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",background:"white",boxSizing:"border-box"}}>
                          {["Bilateral","Monaural Left","Monaural Right","CROS/BiCROS"].map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Serial (L)</label><input value={editDraft.serialLeft} onChange={e=>setEditDraft(d=>({...d,serialLeft:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Serial (R)</label><input value={editDraft.serialRight} onChange={e=>setEditDraft(d=>({...d,serialRight:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                      <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Warranty Expiry</label><input type="date" value={editDraft.warrantyExpiry} onChange={e=>setEditDraft(d=>({...d,warrantyExpiry:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>
                    </div>
                  </div>
                  {/* Per-side device fields — cascading dropdowns */}
                  {[["left","👂 Left Ear"],["right","Right Ear 👂"]].map(([side, sideLabel])=>{
                    const sd = editDraft[side] || {};
                    const hasSide = !!(side==="left" ? selectedPatient._ids?.leftSideId : selectedPatient._ids?.rightSideId);
                    if (!hasSide && !sd.manufacturer && !sd.style) return null;
                    const derived = getSideDerived(sd);
                    const { availMfrs, availGens, availFamilies, selectedFamily, availColors, availBatteries, availPowers, availDomes } = derived;
                    const requiresEarmold = availPowers.find(p=>p.id===sd.receiverPower)?.earmold === true;
                    const variantRequired = (selectedFamily?.variants?.length || 0) > 1;
                    const selSty = {width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none",background:"white",boxSizing:"border-box"};
                    const lblSty = {fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4};
                    const updSD = (updates) => setEditDraft(d=>({...d,[side]:{...d[side],...updates}}));
                    return (
                      <div key={side} style={{marginBottom:14,paddingBottom:14,borderTop:"1px solid #f3f4f6",paddingTop:14}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:8}}>{sideLabel}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>

                          {/* Body Style */}
                          <div><label style={lblSty}>Body Style</label>
                            <select value={sd.style||""} onChange={e=>updSD({style:e.target.value,manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:""})} style={selSty}>
                              <option value="">Select…</option>
                              {BODY_STYLES.map(bs=><option key={bs.id} value={bs.id}>{bs.label}</option>)}
                            </select>
                          </div>

                          {/* Manufacturer */}
                          <div><label style={lblSty}>Manufacturer</label>
                            <select value={sd.manufacturer||""} onChange={e=>updSD({manufacturer:e.target.value,generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:""})} style={selSty} disabled={!sd.style}>
                              <option value="">Select…</option>
                              {availMfrs.map(m=><option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>

                          {/* Platform / Generation */}
                          <div><label style={lblSty}>Platform</label>
                            <select value={sd.generation||""} onChange={e=>updSD({generation:e.target.value,familyId:"",variant:"",techLevel:"",color:"",battery:""})} style={selSty} disabled={!sd.manufacturer}>
                              <option value="">Select…</option>
                              {availGens.map(g=><option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>

                          {/* Model Family */}
                          <div><label style={lblSty}>Model Family</label>
                            <select value={sd.familyId||""} onChange={e=>{
                              const fam = catalog.find(f=>f.id===e.target.value);
                              const autoVar = fam?.variants?.length===1 ? fam.variants[0] : "";
                              const autoBat = fam?.battery?.length===1 ? fam.battery[0] : "";
                              updSD({familyId:e.target.value,variant:autoVar,techLevel:"",color:"",battery:autoBat});
                            }} style={selSty} disabled={!sd.generation}>
                              <option value="">Select…</option>
                              {availFamilies.map(fam=><option key={fam.id} value={fam.id}>{fam.family}</option>)}
                            </select>
                          </div>

                          {/* Variant (only if multiple) */}
                          {variantRequired && (
                            <div><label style={lblSty}>Variant</label>
                              <select value={sd.variant||""} onChange={e=>updSD({variant:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {selectedFamily.variants.map(v=><option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                          )}

                          {/* Tech Level */}
                          <div><label style={lblSty}>Tech Level</label>
                            <select value={sd.techLevel||""} onChange={e=>updSD({techLevel:e.target.value})} style={selSty} disabled={!sd.familyId}>
                              <option value="">Select…</option>
                              {(selectedFamily?.techLevels||[]).map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          {/* Color */}
                          {availColors.length > 0 && (
                            <div><label style={lblSty}>Color</label>
                              <select value={sd.color||""} onChange={e=>updSD({color:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {availColors.map(c=><option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          )}

                          {/* Battery (only if multiple) */}
                          {availBatteries.length > 1 && (
                            <div><label style={lblSty}>Battery</label>
                              <select value={sd.battery||""} onChange={e=>updSD({battery:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {availBatteries.map(b=><option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                          )}

                          {/* RIC: Receiver Length, Power, Dome */}
                          {sd.style === "ric" && sd.techLevel && (<>
                            <div><label style={lblSty}>Receiver Length</label>
                              <select value={sd.receiverLength||""} onChange={e=>updSD({receiverLength:e.target.value})} style={selSty}>
                                <option value="">Select…</option>
                                {RECEIVER_LENGTHS.map(l=><option key={l} value={l}>{l}</option>)}
                              </select>
                            </div>
                            <div><label style={lblSty}>Receiver Power</label>
                              <select value={sd.receiverPower||""} onChange={e=>{updSD({receiverPower:e.target.value,dome:""});}} style={selSty}>
                                <option value="">Select…</option>
                                {availPowers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                              </select>
                            </div>
                            {sd.receiverPower && !requiresEarmold && (
                              <div><label style={lblSty}>Dome / Coupling</label>
                                <select value={sd.dome||""} onChange={e=>updSD({dome:e.target.value})} style={selSty}>
                                  <option value="">Select…</option>
                                  {availDomes.map(dm=><option key={dm} value={dm}>{dm}</option>)}
                                </select>
                              </div>
                            )}
                            {sd.receiverPower && requiresEarmold && (
                              <div style={{display:"flex",alignItems:"center",fontSize:12,color:"#854d0e",fontWeight:600,background:"#fef9c3",borderRadius:8,padding:"8px 12px"}}>
                                Earmold required
                              </div>
                            )}
                          </>)}

                        </div>
                      </div>
                    );
                  })}
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                    <button onClick={saveEditDevices} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                    <button onClick={cancelEdit} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                    {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                    {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>Fitting Type</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#0a1628",background:"#f3f4f6",borderRadius:6,padding:"2px 8px"}}>{p.devices?.fittingType||"Bilateral"}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  {[p.devices?.left, p.devices?.right].map((side, idx) => {
                    const sideLabel = idx===0 ? "👂 Left Ear" : "Right Ear 👂";
                    if (!side) return (
                      <div key={idx}><div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:6,paddingBottom:4,borderBottom:"1px solid #e5e7eb"}}>{sideLabel}</div><div style={{color:"#9ca3af",fontSize:13,padding:"8px 0"}}>Not configured</div></div>
                    );
                    const isTH = side.manufacturer === "TruHearing";
                    const pwrLabel = isTH
                      ? (side.gainMatrix || side.receiverPower || "—")
                      : ((RECEIVER_POWERS[side.manufacturer]||[]).find(pw=>pw.id===side.receiverPower)?.label || side.receiverPower || "—");
                    const isEm = isTH
                      ? false
                      : (RECEIVER_POWERS[side.manufacturer]||[]).find(pw=>pw.id===side.receiverPower)?.earmold;
                    const domeVal = isTH
                      ? (side.domeCategory && side.domeSize ? `${side.domeCategory} ${side.domeSize}` : side.domeCategory || side.dome || "N/A")
                      : (isEm ? "Custom Earmold" : (side.dome || "N/A"));
                    return (
                      <div key={idx}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:6,paddingBottom:4,borderBottom:"1px solid #e5e7eb"}}>{sideLabel}</div>
                        {[["Manufacturer",side.manufacturer],["Model",side.family||"—"],["Tech Level",side.techLevel||"—"],["Body Style",BODY_STYLES.find(s=>s.id===side.style)?.label||side.style],["Color",side.color||"N/A"],["Battery",side.battery||"—"],
                          ...(side.style==="ric"||side.style==="ric_bct"||side.style==="sr" ? [["Receiver Length",side.receiverLength||"—"],["Receiver Power",pwrLabel],["Dome / Coupling",domeVal]] : []),
                        ].map(([k,v])=>(
                          <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v||"—"}</span></div>
                        ))}
                      </div>
                    );
                  })}
                  </div>
                  <div style={{borderTop:"1px solid #f3f4f6",paddingTop:12,display:"grid",gridTemplateColumns:"1fr 1fr"}}>
                    {[["Serial (L)",p.devices?.serialLeft],["Serial (R)",p.devices?.serialRight],["Fitting Date",fmtDate(p.devices?.fittingDate||p.createdAt)],["Warranty Expires",fmtDate(p.devices?.warrantyExpiry)],["Warranty Status",days<0?"Expired":`${days} days remaining`]].map(([k,v])=>(
                      <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val" style={k==="Warranty Status"?{color:days<0?"#ef4444":days<90?"#f59e0b":"#16a34a"}:{}}>{v||"—"}</span></div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* ── AUDIOGRAM & EDUCATION PANEL ── */}
            {p.audiology && (getPTA(p.audiology.rightT)!=null || getPTA(p.audiology.leftT)!=null || p.audiology.unaidedR!=null || p.audiology.sinBin!=null) && (() => {
              const aud = p.audiology;
              const sections = generateCounseling(aud);
              const rPTA = getPTA(aud.rightT);
              const lPTA = getPTA(aud.leftT);
              return (
                <>
                  {/* Audiogram display — two-column: scores left, chart right */}
                  <div className="detail-card full">
                    <div className="detail-card-title">Hearing Evaluation</div>
                    <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:16}}>
                      {/* Left column: score cards stacked */}
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {rPTA!=null&&(
                          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:2}}>Right PTA</div>
                            <div style={{fontSize:20,fontWeight:800,color:"#0a1628",lineHeight:1}}>{rPTA} <span style={{fontSize:10,fontWeight:400,color:"#9ca3af"}}>dB HL</span></div>
                            <div style={{fontSize:10,color:"#dc2626",fontWeight:600,marginTop:2}}>{getDegreeName(rPTA)}</div>
                          </div>
                        )}
                        {lPTA!=null&&(
                          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:2}}>Left PTA</div>
                            <div style={{fontSize:20,fontWeight:800,color:"#0a1628",lineHeight:1}}>{lPTA} <span style={{fontSize:10,fontWeight:400,color:"#9ca3af"}}>dB HL</span></div>
                            <div style={{fontSize:10,color:"#2563eb",fontWeight:600,marginTop:2}}>{getDegreeName(lPTA)}</div>
                          </div>
                        )}
                        {(aud.unaidedR!=null||aud.unaidedL!=null)&&(
                          <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>CCT Unaided</div>
                            {aud.unaidedR!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>R: {aud.unaidedR}%</div>}
                            {aud.unaidedL!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>L: {aud.unaidedL}%</div>}
                          </div>
                        )}
                        {(aud.wrMclR!=null||aud.wrMclL!=null)&&(
                          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#16a34a",marginBottom:2}}>WR @ MCL</div>
                            {aud.wrMclR!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>R: {aud.wrMclR}%</div>}
                            {aud.wrMclL!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>L: {aud.wrMclL}%</div>}
                          </div>
                        )}
                        {(aud.aidedR!=null||aud.aidedL!=null)&&(
                          <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>WRS @ MCL</div>
                            {aud.aidedR!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>R: {aud.aidedR}%</div>}
                            {aud.aidedL!=null&&<div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>L: {aud.aidedL}%</div>}
                          </div>
                        )}
                        {aud.sinBin!=null&&(
                          <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:2}}>QuickSIN</div>
                            <div style={{fontSize:20,fontWeight:800,color:"#0a1628",lineHeight:1}}>{aud.sinBin} <span style={{fontSize:10,fontWeight:400,color:"#9ca3af"}}>dB SNR</span></div>
                            <div style={{fontSize:10,fontWeight:600,marginTop:2,
                              color:aud.sinBin<=2?"#16a34a":aud.sinBin<=7?"#ca8a04":aud.sinBin<=15?"#ea580c":"#dc2626"}}>
                              {aud.sinBin<=2?"Near-normal":aud.sinBin<=7?"Mild":aud.sinBin<=15?"Moderate":"Severe"}
                            </div>
                          </div>
                        )}
                        {(aud.tinnitusRight||aud.tinnitusLeft)&&(
                          <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,padding:"10px 12px"}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#92400e",marginBottom:2}}>Tinnitus</div>
                            <div style={{fontSize:13,color:"#0a1628",fontWeight:600}}>
                              {aud.tinnitusRight&&aud.tinnitusLeft?"Bilateral":aud.tinnitusRight?"Right":"Left"}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Right column: audiogram chart */}
                      <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 8px"}}>
                        <AudigramSVG rightT={aud.rightT||{}} leftT={aud.leftT||{}} rightBC={aud.rightBC||{}} leftBC={aud.leftBC||{}} rightMask={aud.rightMask||{}} leftMask={aud.leftMask||{}} rightBCMask={aud.rightBCMask||{}} leftBCMask={aud.leftBCMask||{}} interactive={false}/>
                      </div>
                    </div>
                  </div>


                </>
              );
            })()}


            {p.appointments?.length > 0 && (
              <div className="detail-card full">
                <div className="detail-card-title">Appointment Schedule</div>
                {p.appointments.sort((a,b)=>new Date(a.date)-new Date(b.date)).map((a,i)=>(
                  <div className="detail-row" key={i}><span className="detail-key">{a.type}</span><span className="detail-val">{fmtDate(a.date)}</span></div>
                ))}
              </div>
            )}


            {/* ── CAMPAIGN JOURNEY ─────────────────────────────────────────────────── */}
            {/* TODO: restrict campaign edits to care_coordinator, admin once checkRole is enforced */}
            {patientCampaigns.length > 0 && patientCampaigns.map(campaign => {
              const deliveries = (campaign.campaign_deliveries || [])
                .sort((a,b) => (a.campaign_steps?.step_order ?? 0) - (b.campaign_steps?.step_order ?? 0));
              const completedCount = deliveries.filter(d => d.status === "sent" || d.status === "delivered").length;
              const totalCount = deliveries.length;
              const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const isEditingThis = editSection === "campaign" && editDraft?.campaignId === campaign.id;
              return (
                <div key={campaign.id} className="detail-card full">
                  <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
                    <div className="detail-card-title" style={{marginBottom:0}}>
                      Nurture Campaign
                      <span style={{fontSize:11,fontWeight:400,color:"#9ca3af",marginLeft:8}}>{campaign.campaign_templates?.name || "Campaign"}</span>
                    </div>
                    {/* TODO: restrict to care_coordinator, admin when enforcing roles */}
                    {!isEditingThis && checkRole(null, ["care_coordinator","admin"]) && (
                      <button className="btn-ghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={()=>startEditCampaign(campaign)}>Edit</button>
                    )}
                  </div>

                  {isEditingThis ? (
                    <div>
                      {/* Status control */}
                      <div style={{marginBottom:14}}>
                        <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:6}}>Campaign Status</label>
                        <div style={{display:"flex",gap:8}}>
                          {[["active","▶ Active"],["paused","⏸ Paused"],["cancelled","✕ Cancelled"]].map(([val,label])=>(
                            <div key={val} onClick={()=>setEditDraft(d=>({...d,status:val}))} style={{padding:"8px 16px",border:`2px solid ${editDraft.status===val?"#0a1628":"#e5e7eb"}`,borderRadius:10,cursor:"pointer",background:editDraft.status===val?"#f8fafc":"white",transition:"all 0.15s",fontSize:13,fontWeight:600,color:editDraft.status===val?"#0a1628":"#6b7280"}}>
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Trigger date */}
                      <div style={{marginBottom:14}}>
                        <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>Trigger Date (campaign start anchor)</label>
                        <input type="date" value={editDraft.triggerDate} onChange={e=>setEditDraft(d=>({...d,triggerDate:e.target.value}))} style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"'Sora',sans-serif",fontSize:13,outline:"none"}} />
                        <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>Changing this date shifts all pending deliveries forward or backward relative to their original schedule.</div>
                      </div>
                      {/* Per-delivery scheduled dates */}
                      {editDraft.deliveries?.length > 0 && (
                        <div style={{marginBottom:14}}>
                          <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:8}}>Delivery Schedule</label>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {editDraft.deliveries.map((d,i) => (
                              <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#f9fafb",borderRadius:8,border:"1px solid #e5e7eb"}}>
                                <span style={{fontSize:11,fontWeight:700,color:"#9ca3af",width:20,flexShrink:0}}>#{d.stepOrder}</span>
                                <span style={{fontSize:12,color:"#374151",flex:1}}>{d.channel || "Message"} · Day {d.delayDays}</span>
                                <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:600,background:d.status==="sent"||d.status==="delivered"?"#dcfce7":d.status==="pending"?"#fef9c3":"#fee2e2",color:d.status==="sent"||d.status==="delivered"?"#16a34a":d.status==="pending"?"#854d0e":"#dc2626"}}>{d.status}</span>
                                <input type="date" value={d.scheduledDate} onChange={e=>{const ds=[...editDraft.deliveries];ds[i]={...ds[i],scheduledDate:e.target.value};setEditDraft(dd=>({...dd,deliveries:ds}));}} style={{padding:"5px 8px",border:"1px solid #e5e7eb",borderRadius:6,fontFamily:"'Sora',sans-serif",fontSize:12,outline:"none"}} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10}}>
                        <button onClick={saveEditCampaign} disabled={editSaving} style={{background:"#0a1628",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:editSaving?"wait":"pointer",opacity:editSaving?0.7:1}}>{editSaving?"Saving…":"Save Changes"}</button>
                        <button onClick={cancelEdit} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 14px",fontFamily:"'Sora',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
                        {editError && <span style={{fontSize:12,color:"#ef4444"}}>{editError}</span>}
                        {editSuccess && <span style={{fontSize:12,color:"#16a34a",fontWeight:600}}>✓ {editSuccess}</span>}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Status + progress bar */}
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                        <span style={{fontSize:12,fontWeight:700,padding:"3px 12px",borderRadius:20,border:"1px solid",background:campaign.status==="active"?"#dcfce7":campaign.status==="paused"?"#fef9c3":"#f3f4f6",color:campaign.status==="active"?"#16a34a":campaign.status==="paused"?"#854d0e":"#6b7280",borderColor:campaign.status==="active"?"#bbf7d0":campaign.status==="paused"?"#fde68a":"#e5e7eb"}}>
                          {campaign.status==="active"?"▶ Active":campaign.status==="paused"?"⏸ Paused":"✕ Cancelled"}
                        </span>
                        <span style={{fontSize:12,color:"#6b7280"}}>{completedCount} of {totalCount} steps completed</span>
                        {campaign.trigger_date && <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>Started {fmtDate(campaign.trigger_date)}</span>}
                      </div>
                      {totalCount > 0 && (
                        <div style={{background:"#f3f4f6",borderRadius:20,height:6,marginBottom:14,overflow:"hidden"}}>
                          <div style={{height:"100%",background:"#16a34a",borderRadius:20,width:`${progressPct}%`,transition:"width 0.3s"}} />
                        </div>
                      )}
                      {/* Delivery timeline */}
                      {deliveries.length > 0 && (
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {deliveries.map(d => (
                            <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#f9fafb",borderRadius:8,border:"1px solid #e5e7eb"}}>
                              <div style={{width:20,height:20,borderRadius:"50%",background:d.status==="sent"||d.status==="delivered"?"#16a34a":d.status==="pending"?"#e5e7eb":"#ef4444",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                {(d.status==="sent"||d.status==="delivered") && <span style={{color:"white",fontSize:10,fontWeight:700}}>✓</span>}
                              </div>
                              <span style={{fontSize:12,color:"#374151",flex:1}}>{d.campaign_steps?.delivery_channel || "Message"} · Day {d.campaign_steps?.delay_days ?? "?"}</span>
                              <span style={{fontSize:11,color:"#9ca3af"}}>{d.scheduled_date ? fmtDate(d.scheduled_date) : "—"}</span>
                              <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:600,background:d.status==="sent"||d.status==="delivered"?"#dcfce7":d.status==="pending"?"#fef9c3":"#fee2e2",color:d.status==="sent"||d.status==="delivered"?"#16a34a":d.status==="pending"?"#854d0e":"#dc2626"}}>{d.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* PUNCH CARD PANEL — only for punch plan patients */}
            {p.carePlan === "punch" && (() => {
              const cleanLeft = 12 - punchData.cleanings;
              const apptLeft = 16 - punchData.appointments;
              const totalLeft = cleanLeft + apptLeft;
              const recentLog = [...(punchData.log||[])].reverse().slice(0, 6);
              return (
                <div className="detail-card full">
                  <div className="detail-card-title">Punch Card</div>
                  <div className="punch-panel">
                    <div className="punch-panel-header">
                      <div>
                        <div className="punch-panel-title">Treatment Punch Card</div>
                        <div className="punch-panel-sub">Log a visit during the appointment · Patient sees balance update live</div>
                      </div>
                      <div className="punch-remaining">
                        <div className="punch-remaining-num">{totalLeft}</div>
                        <div className="punch-remaining-label">visits left</div>
                      </div>
                    </div>


                    {/* CLEANINGS */}
                    <div className="punch-row">
                      <div className="punch-row-label">
                        🧹 Cleanings
                        <span>{punchData.cleanings}/12 used · {cleanLeft} remaining</span>
                      </div>
                      <div className="punch-dots">
                        {Array.from({length:12},(_,i)=>(
                          <div key={i} className={`punch-dot ${i < punchData.cleanings ? "used":""}`}>{i < punchData.cleanings ? "✓":""}</div>
                        ))}
                      </div>
                      <div className="punch-actions">
                        {punchSuccess === "cleaning" ? (
                          <div className="punch-success">✓ Cleaning visit punched!</div>
                        ) : punchConfirm === "cleaning" ? (
                          <>
                            <button className="punch-btn confirm" onClick={()=>handlePunch("cleaning")}>Confirm punch</button>
                            <button className="punch-btn" onClick={()=>setPunchConfirm(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="punch-btn" disabled={cleanLeft === 0} onClick={()=>setPunchConfirm("cleaning")}>
                              {cleanLeft === 0 ? "All used" : "Punch cleaning visit"}
                            </button>
                            {punchData.cleanings > 0 && <span className="punch-undo" onClick={()=>handleUndoPunch("cleaning")}>undo last</span>}
                          </>
                        )}
                      </div>
                    </div>


                    <div className="punch-divider" />


                    {/* APPOINTMENTS */}
                    <div className="punch-row" style={{marginBottom:0}}>
                      <div className="punch-row-label">
                        📅 Appointments
                        <span>{punchData.appointments}/16 used · {apptLeft} remaining</span>
                      </div>
                      <div className="punch-dots">
                        {Array.from({length:16},(_,i)=>(
                          <div key={i} className={`punch-dot ${i < punchData.appointments ? "used":""}`}>{i < punchData.appointments ? "✓":""}</div>
                        ))}
                      </div>
                      <div className="punch-actions">
                        {punchSuccess === "appointment" ? (
                          <div className="punch-success">✓ Appointment visit punched!</div>
                        ) : punchConfirm === "appointment" ? (
                          <>
                            <button className="punch-btn confirm" onClick={()=>handlePunch("appointment")}>Confirm punch</button>
                            <button className="punch-btn" onClick={()=>setPunchConfirm(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="punch-btn" disabled={apptLeft === 0} onClick={()=>setPunchConfirm("appointment")}>
                              {apptLeft === 0 ? "All used" : "Punch appointment visit"}
                            </button>
                            {punchData.appointments > 0 && <span className="punch-undo" onClick={()=>handleUndoPunch("appointment")}>undo last</span>}
                          </>
                        )}
                      </div>
                    </div>


                    {/* VISIT LOG */}
                    {recentLog.length > 0 && (
                      <>
                        <div className="punch-divider" />
                        <div className="punch-log-title">Recent Visit Log</div>
                        {recentLog.map((entry,i)=>(
                          <div className="punch-log-row" key={i}>
                            <span className="punch-log-type">{entry.type === "cleaning" ? "🧹 Cleaning" : "📅 Appointment"}</span>
                            <span className="punch-log-date">{new Date(entry.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</span>
                          </div>
                        ))}
                      </>
                    )}


                    {totalLeft === 0 && (
                      <div style={{marginTop:16,background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#4ade80",fontWeight:600,textAlign:"center"}}>
                        All 28 visits used · Discuss renewal options with patient
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </>
    );
  };


  // ── PRODUCT CATALOG ───────────────────────────────────────────────────────
  const [catMfrFilter, setCatMfrFilter] = useState("All");


  const ChipEditor = ({ field, values }) => {
    const key = `${catDraft?.id}-${field}`;
    const inputVal = catAddChip[key] || "";
    return (
      <div className="chip-row">
        {values.map((v,i) => (
          <div className="chip" key={i}>
            {v}
            <button className="chip-del" onClick={() => setCatDraft(d => ({...d, [field]: d[field].filter((_,j)=>j!==i)}))}>×</button>
          </div>
        ))}
        <input
          className="chip-add-input"
          placeholder="+ add…"
          value={inputVal}
          onChange={e => setCatAddChip(c => ({...c, [key]: e.target.value}))}
          onKeyDown={e => {
            if ((e.key === "Enter" || e.key === ",") && inputVal.trim()) {
              e.preventDefault();
              setCatDraft(d => ({...d, [field]: [...(d[field]||[]), inputVal.trim()]}));
              setCatAddChip(c => ({...c, [key]: ""}));
            }
          }}
        />
      </div>
    );
  };


  const allMfrs = [...new Set(catalog.map(e => e.manufacturer))].sort();
  const filteredCatalog = catalog.filter(e => {
    const mfrOk = catMfrFilter === "All" || e.manufacturer === catMfrFilter;
    const searchOk = !catSearch || e.family.toLowerCase().includes(catSearch.toLowerCase()) || e.generation.toLowerCase().includes(catSearch.toLowerCase());
    return mfrOk && searchOk;
  });


  const startNewCatalogEntry = () => {
    const newEntry = {
      id: "entry-" + Date.now(),
      manufacturer: catMfrFilter !== "All" ? catMfrFilter : "",
      generation: "", family: "",
      styles: [], variants: [], techLevels: [], colors: [], battery: [],
      active: true, notes: "",
    };
    setCatDraft(newEntry);
    setCatEditId("__new__");
    setCatNewEntry(true);
  };


  const saveEditEntry = async () => {
    let next;
    if (catNewEntry) {
      next = [...catalog, catDraft];
    } else {
      next = catalog.map(e => e.id === catDraft.id ? catDraft : e);
    }
    await saveCatalog(next);
    setCatEditId(null); setCatDraft(null); setCatNewEntry(false);
  };


  const deleteEntry = async (id) => {
    const next = catalog.filter(e => e.id !== id);
    await saveCatalog(next);
    if (catEditId === id) { setCatEditId(null); setCatDraft(null); }
  };


  const toggleActive = async (id) => {
    const next = catalog.map(e => e.id === id ? {...e, active: !e.active} : e);
    await saveCatalog(next);
  };


  const resetToDefaults = async () => {
    if (window.confirm("Reset catalog to factory defaults? This cannot be undone.")) {
      await saveCatalog(CATALOG_DEFAULT);
      setCatEditId(null); setCatDraft(null); setCatNewEntry(false);
    }
  };


  const STYLE_OPTS = BODY_STYLES.map(s => s.id);


  const renderCatalog = () => (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Product Catalog</div>
          <div className="topbar-sub">{catalog.filter(e=>e.active).length} active families · {catalog.length} total</div>
        </div>
        <button className="cat-btn" style={{fontSize:12,padding:"7px 14px"}} onClick={resetToDefaults}>↺ Reset to Defaults</button>
      </div>
      <div className="content">
        <div className="catalog-wrap">
          <div className="catalog-toolbar">
            <input className="catalog-search" placeholder="Search families…" value={catSearch} onChange={e=>setCatSearch(e.target.value)} />
            <button className="cat-btn primary" onClick={startNewCatalogEntry}>＋ Add Family</button>
          </div>


          <div className="catalog-mfr-tabs">
            {["All",...allMfrs].map(m => (
              <div key={m} className={`catalog-mfr-tab ${catMfrFilter===m?"active":""}`} onClick={()=>setCatMfrFilter(m)}>{m}</div>
            ))}
          </div>


          {/* New entry form at top */}
          {catNewEntry && catDraft && (
            <div className="catalog-entry" style={{border:"2px solid #0a1628"}}>
              <div className="catalog-entry-header">
                <div style={{flex:1,fontWeight:700,color:"#0a1628",fontSize:14}}>New Entry</div>
              </div>
              <div className="catalog-edit-panel">
                <div className="cat-field-row">
                  <div className="cat-field"><label>Manufacturer</label>
                    <input value={catDraft.manufacturer} onChange={e=>setCatDraft(d=>({...d,manufacturer:e.target.value}))} placeholder="e.g. Signia" />
                  </div>
                  <div className="cat-field"><label>Generation / Platform</label>
                    <input value={catDraft.generation} onChange={e=>setCatDraft(d=>({...d,generation:e.target.value}))} placeholder="e.g. IX" />
                  </div>
                </div>
                <div className="cat-field"><label>Family Name</label>
                  <input value={catDraft.family} onChange={e=>setCatDraft(d=>({...d,family:e.target.value}))} placeholder="e.g. Pure Charge&Go IX" />
                </div>
                <div className="cat-field"><label>Body Styles</label>
                  <div className="chip-row">
                    {STYLE_OPTS.map(s=>(
                      <div key={s} className={`chip ${catDraft.styles.includes(s)?"":"opacity:0.4"}`}
                        style={{cursor:"pointer",background:catDraft.styles.includes(s)?"#0a1628":"#f3f4f6",color:catDraft.styles.includes(s)?"white":"#374151",border:catDraft.styles.includes(s)?"1px solid #0a1628":"1px solid #e5e7eb"}}
                        onClick={()=>setCatDraft(d=>({...d,styles:d.styles.includes(s)?d.styles.filter(x=>x!==s):[...d.styles,s]}))}>
                        {s.toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="cat-field"><label>Variants <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(one per line, Enter to add)</span></label>
                  <ChipEditor field="variants" values={catDraft.variants} />
                </div>
                <div className="cat-field"><label>Technology Levels</label>
                  <ChipEditor field="techLevels" values={catDraft.techLevels} />
                </div>
                <div className="cat-field"><label>Colors</label>
                  <ChipEditor field="colors" values={catDraft.colors} />
                </div>
                <div className="cat-field"><label>Battery</label>
                  <ChipEditor field="battery" values={catDraft.battery} />
                </div>
                <div className="cat-field"><label>Notes (internal)</label>
                  <textarea value={catDraft.notes} onChange={e=>setCatDraft(d=>({...d,notes:e.target.value}))} />
                </div>
                <div className="cat-save-row">
                  <button className="cat-btn" onClick={()=>{setCatNewEntry(false);setCatEditId(null);setCatDraft(null);}}>Cancel</button>
                  <button className="cat-btn primary" onClick={saveEditEntry}>Save Entry</button>
                </div>
              </div>
            </div>
          )}


          {filteredCatalog.length === 0 && (
            <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No entries found</div></div>
          )}


          {filteredCatalog.map(entry => {
            const isEditing = catEditId === entry.id && !catNewEntry;
            return (
              <div className="catalog-entry" key={entry.id} style={isEditing?{border:"2px solid #0a1628"}:{}}>
                <div className="catalog-entry-header">
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div className="catalog-entry-name">{entry.family}</div>
                      <span className={`catalog-entry-badge ${entry.active?"active-badge":""}`}>{entry.active?"Active":"Inactive"}</span>
                    </div>
                    <div className="catalog-entry-gen">{entry.manufacturer} · {entry.generation} · {entry.styles.map(s=>s.toUpperCase()).join(", ")} · {entry.techLevels.join(" / ")}</div>
                  </div>
                  <div className="catalog-entry-actions">
                    <button className="cat-btn" onClick={()=>toggleActive(entry.id)}>{entry.active?"Deactivate":"Activate"}</button>
                    <button className="cat-btn" onClick={()=>{
                      if (isEditing) { setCatEditId(null); setCatDraft(null); }
                      else { setCatEditId(entry.id); setCatDraft({...entry, variants:[...entry.variants], techLevels:[...entry.techLevels], colors:[...entry.colors], battery:[...entry.battery], styles:[...entry.styles]}); }
                    }}>{isEditing?"Cancel":"Edit"}</button>
                    <button className="cat-btn danger" onClick={()=>deleteEntry(entry.id)}>Delete</button>
                  </div>
                </div>


                {isEditing && catDraft && (
                  <div className="catalog-edit-panel">
                    <div className="cat-field-row">
                      <div className="cat-field"><label>Manufacturer</label>
                        <input value={catDraft.manufacturer} onChange={e=>setCatDraft(d=>({...d,manufacturer:e.target.value}))} />
                      </div>
                      <div className="cat-field"><label>Generation / Platform</label>
                        <input value={catDraft.generation} onChange={e=>setCatDraft(d=>({...d,generation:e.target.value}))} />
                      </div>
                    </div>
                    <div className="cat-field"><label>Family Name</label>
                      <input value={catDraft.family} onChange={e=>setCatDraft(d=>({...d,family:e.target.value}))} />
                    </div>
                    <div className="cat-field"><label>Body Styles</label>
                      <div className="chip-row">
                        {STYLE_OPTS.map(s=>(
                          <div key={s}
                            style={{cursor:"pointer",display:"flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:12,border:catDraft.styles.includes(s)?"1px solid #0a1628":"1px solid #e5e7eb",background:catDraft.styles.includes(s)?"#0a1628":"#f3f4f6",color:catDraft.styles.includes(s)?"white":"#374151"}}
                            onClick={()=>setCatDraft(d=>({...d,styles:d.styles.includes(s)?d.styles.filter(x=>x!==s):[...d.styles,s]}))}>
                            {s.toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="cat-field"><label>Variants</label>
                      <ChipEditor field="variants" values={catDraft.variants} />
                    </div>
                    <div className="cat-field"><label>Technology Levels</label>
                      <ChipEditor field="techLevels" values={catDraft.techLevels} />
                    </div>
                    <div className="cat-field"><label>Colors</label>
                      <ChipEditor field="colors" values={catDraft.colors} />
                    </div>
                    <div className="cat-field"><label>Battery</label>
                      <ChipEditor field="battery" values={catDraft.battery} />
                    </div>
                    <div className="cat-field"><label>Notes (internal)</label>
                      <textarea value={catDraft.notes} onChange={e=>setCatDraft(d=>({...d,notes:e.target.value}))} />
                    </div>
                    <div className="cat-save-row">
                      <button className="cat-btn" onClick={()=>{setCatEditId(null);setCatDraft(null);}}>Cancel</button>
                      <button className="cat-btn primary" onClick={saveEditEntry}>Save Changes</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );


  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>

      {/* ── Intake toast notification ── */}
      {intakeToast && (
        <div className="intake-toast">
          <div className="intake-toast-dot" />
          <div className="intake-toast-body">
            <div className="intake-toast-title">New intake — {intakeToast.name}</div>
            <div className="intake-toast-sub">Completed kiosk check-in · waiting in queue</div>
          </div>
          <button className="intake-toast-btn" onClick={() => { setShowIntakeQueue(true); setIntakeToast(null); }}>
            View
          </button>
          <button className="intake-toast-dismiss" onClick={() => setIntakeToast(null)}>×</button>
        </div>
      )}

      {/* ── Intake queue modal ── */}
      {showIntakeQueue && (
        <div className="queue-modal-overlay" onClick={() => setShowIntakeQueue(false)}>
          <div className="queue-modal" onClick={e => e.stopPropagation()}>
            <div className="queue-modal-header">
              <div className="queue-modal-title">
                Intake Queue
                {pendingIntakes.length > 0 && (
                  <span style={{marginLeft:8,background:"#ef4444",color:"white",borderRadius:20,
                    padding:"2px 8px",fontSize:11,fontWeight:700}}>
                    {pendingIntakes.length}
                  </span>
                )}
              </div>
              <button className="queue-modal-close" onClick={() => setShowIntakeQueue(false)}>×</button>
            </div>
            {pendingIntakes.length === 0 ? (
              <div style={{padding:"40px 24px",textAlign:"center",color:"#9ca3af"}}>
                <div style={{fontSize:32,marginBottom:12}}>✓</div>
                <div style={{fontSize:14,fontWeight:600,color:"#374151"}}>Queue is clear</div>
                <div style={{fontSize:12,marginTop:4}}>No pending intakes right now</div>
              </div>
            ) : (
              pendingIntakes.map(intake => {
                const a = intake.answers || {};
                const submitted = intake._meta?.submittedAt
                  ? new Date(intake._meta.submittedAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})
                  : "—";
                return (
                  <div className="queue-card" key={intake._meta?.intakeId}>
                    <div className="queue-card-name">
                      {[a.firstName, a.lastName].filter(Boolean).join(" ") || "Unknown"}
                    </div>
                    <div className="queue-card-meta">Submitted {submitted}</div>
                    <div className="queue-card-fields">
                      <div className="queue-card-field"><span>DOB</span>{a.dob || "—"}</div>
                      <div className="queue-card-field"><span>Phone</span>{a.phone || "—"}</div>
                      <div className="queue-card-field"><span>Coverage</span>{a.payType === "insurance" ? (a.carrier || "Insurance") : "Private Pay"}</div>
                      <div className="queue-card-field"><span>Email</span>{a.email || "—"}</div>
                    </div>
                    {a.chiefComplaint && (
                      <div style={{fontSize:12,color:"#374151",background:"white",borderRadius:8,
                        padding:"8px 10px",border:"1px solid #f3f4f6",marginBottom:8}}>
                        <span style={{fontSize:10,fontWeight:700,color:"#9ca3af",display:"block",
                          textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>Chief Complaint</span>
                        {a.chiefComplaint}
                      </div>
                    )}
                    <div className="queue-card-actions">
                      <button className="queue-accept" onClick={() => handleAcceptIntake(intake)}>
                        ✓ Accept &amp; Start Intake
                      </button>
                      <button className="queue-dismiss" onClick={() => handleDismissIntake(intake._meta?.intakeId)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="app">
        <div className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-badge">Distil</div>
            <div className="logo-name">{clinic.name}</div>
            <div className="logo-sub">{clinic.phone}</div>
          </div>
          <div style={{margin:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",marginBottom:3}}>Clinic</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:500,lineHeight:1.3}}>{clinic.address}</div>
          </div>
          <div className="sidebar-nav">
            {[["🏠","Dashboard","dashboard"],["👥","Patients","patients"],["📅","Schedule","schedule"],["📊","Reports","reports"],["📬","Campaigns","campaigns"],["📚","Content Library","content"],["🎖️","Lima Charlie","lima-charlie"],["📋","Product Catalog","catalog"],["⚙️","Settings","settings"]].map(([icon,label,id])=>(
              <div key={id} className={`nav-item ${view===id||(id==="dashboard"&&view==="new")||(id==="patients"&&(view==="dashboard"||view==="patient"))?"active":""}`}
                onClick={()=>{
                  if(id==="dashboard"||id==="patients") setView("dashboard");
                  else setView(id);
                }}>
                <span className="nav-icon">{icon}</span>{label}
              </div>
            ))}
          </div>
          {/* Intake queue button */}
          <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
            <button onClick={() => setShowIntakeQueue(true)} style={{
              width:"100%", background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.25)",
              borderRadius:8, padding:"10px 14px", cursor:"pointer", display:"flex",
              alignItems:"center", justifyContent:"space-between", fontFamily:"'Sora',sans-serif",
            }}>
              <span style={{fontSize:12,fontWeight:700,color:"#4ade80"}}>📋 Intake Queue</span>
              {pendingIntakes.length > 0 && (
                <span style={{background:"#ef4444",color:"white",borderRadius:20,
                  padding:"2px 8px",fontSize:11,fontWeight:700}}>
                  {pendingIntakes.length}
                </span>
              )}
            </button>
          </div>
          <div className="sidebar-footer">
            Distil · Hearing Care Platform<br/>HIPAA-compliant · v1.0
          </div>
        </div>


        <div className="main">
          {(view === "dashboard" || view === "patients") && renderDashboard()}
          {view === "patient" && renderPatientDetail()}
          {view === "settings" && renderSettings()}
          {view === "catalog" && renderCatalog()}
          {view === "campaigns" && <CampaignManager clinicId={clinicId} staffId={staffId} patients={patients} />}
          {view === "content" && <ContentLibrary clinicId={clinicId} staffId={staffId} />}
          {view === "lima-charlie" && <LimaCharlie clinicId={clinicId} staffId={staffId} />}
          {view === "new" && (
            <>
              <div className="topbar">
                <div>
                  <div className="topbar-title">New Patient</div>
                  <div className="topbar-sub">Step {step+1} of {STEPS.length} · {STEPS[step]}</div>
                </div>
                <button className="btn-ghost" onClick={()=>setView("dashboard")}>Cancel</button>
              </div>
              <div className="content">
                <div className="wizard-wrap">
                  <div className="wizard-steps">
                    {STEPS.map((s,i)=>(
                      <div key={s} className={`wizard-step ${i<step?"done":""}`}>
                        <div className={`step-dot ${i===step?"active":i<step?"done":""}`}>{i<step?"✓":i+1}</div>
                        <div className={`step-name ${i===step?"active":""}`}>{s}</div>
                      </div>
                    ))}
                  </div>
                  {renderStep()}
                  {saveError && (
                    <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"12px 16px",marginBottom:8,fontSize:13,color:"#dc2626"}}>
                      <strong>Save failed:</strong> {saveError}
                      <div style={{fontSize:11,color:"#9ca3af",marginTop:4}}>
                        staffId: {staffId||"(none)"} · clinicId: {clinicId||"(none)"}
                      </div>
                    </div>
                  )}
                  <div className="wizard-nav">
                    <button className="btn-ghost" onClick={()=>step===0?setView("dashboard"):setStep(s=>s-1)}>
                      {step===0?"Cancel":"← Back"}
                    </button>
                    {step < STEPS.length-1 ? (
                      step === 4 ? null : (
                        <button className="btn-primary" disabled={!canProceed} style={{opacity:canProceed?1:0.4}} onClick={()=>setStep(s=>s+1)}>
                          Continue →
                        </button>
                      )
                    ) : (
                      <button className="btn-primary green" onClick={handleSave}>
                        ✓ Create Patient Profile
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── WIZARD PURCHASE AGREEMENT — FULL-PAGE REVIEW ────── */}
              {showWizardPaModal && (() => {
                const pName = [form.firstName,form.lastName].filter(Boolean).join(" ");
                const leftRec = buildSideRecord(form.left);
                const rightRec = buildSideRecord(form.right);
                const isCROS = [leftRec,rightRec].some(r=>r?.variant?.toLowerCase().includes("cros")) || form.left.isCROS || form.right.isCROS;
                const fType = leftRec && rightRec ? (isCROS?"cros_bicros":"bilateral") : leftRec?"monaural_left":"monaural_right";
                const ac = (fType==="bilateral"||fType==="cros_bicros")?2:1;
                const devTotal = (form.tierPrice||0)*ac;
                const cpId = form.carePlan||"complete";
                const cpLabel = cpId==="complete"?"Complete Care+":(cpId==="punch"?"Treatment Punch Card":"Pay-As-You-Go");
                const cpPrice = cpId==="complete"?1250:(cpId==="punch"?575:0);
                const cpWarranty = cpId==="complete"?5:3;
                const cpDesc = cpId==="complete"?"Unlimited visits, cleanings, adjustments, and repairs for 5 years":(cpId==="punch"?"All visits and cleanings covered for 4 years · 3-year manufacturer warranty":"$65/visit · Annual exams covered");
                const total = devTotal+cpPrice;
                const provName = staffProfile?.fullName||"Provider";
                const provLic = staffProfile?.activeLicense||"";
                const clinicObj = staffProfile?.clinic||clinic;
                const ss = {section:{fontSize:10,fontWeight:700,color:"#0a1628",letterSpacing:0.5,textTransform:"uppercase",marginBottom:6,marginTop:18},body:{fontSize:13,color:"#374151",lineHeight:1.7}};
                return (
                  <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(10,22,40,0.92)",zIndex:9999,overflowY:"auto"}}>
                    <div style={{background:"white",width:700,margin:"0 auto",padding:"40px 48px 80px",boxShadow:"0 0 80px rgba(0,0,0,0.4)"}}>
                      {/* Header */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div>
                          <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:16,color:"#0a1628"}}>MY HEARING CENTERS</div>
                          <div style={{fontSize:11,color:"#6b7280"}}>{clinicObj?.address}  ·  {clinicObj?.phone}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:14,color:"#0a1628"}}>HEARING AID PURCHASE AGREEMENT</div>
                          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Date: {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
                        </div>
                        <button onClick={()=>setShowWizardPaModal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#9ca3af",padding:"0 0 0 12px",lineHeight:1}}>✕</button>
                      </div>
                      <div style={{height:1,background:"#e5e7eb",margin:"12px 0"}}/>

                      {/* Patient */}
                      <div style={ss.section}>Patient Information</div>
                      <div style={{display:"flex",gap:40,fontSize:13,color:"#374151"}}>
                        <div><span style={{color:"#9ca3af",fontSize:11}}>Name</span><br/>{pName}</div>
                        <div><span style={{color:"#9ca3af",fontSize:11}}>Phone</span><br/>{form.phone||"—"}</div>
                        <div><span style={{color:"#9ca3af",fontSize:11}}>Address</span><br/>{form.address||"—"}</div>
                      </div>

                      {/* Devices */}
                      <div style={ss.section}>Device Specifications</div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:"#0a1628",color:"white",fontSize:11}}>
                          {["","Manufacturer","Model","Style","Battery","Price"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {[["Right",rightRec],["Left",leftRec]].map(([label,d],i)=> d && (
                            <tr key={label} style={{background:i%2===0?"#f8fafc":"white"}}>
                              <td style={{padding:"6px 8px",fontWeight:600,color:"#0a1628"}}>{label}</td>
                              <td style={{padding:"6px 8px"}}>{d.manufacturer||"—"}</td>
                              <td style={{padding:"6px 8px"}}>{[d.family,d.variant,d.techLevel].filter(Boolean).join(" ")||"—"}</td>
                              <td style={{padding:"6px 8px"}}>{d.style||"—"}</td>
                              <td style={{padding:"6px 8px"}}>{d.battery||"—"}</td>
                              <td style={{padding:"6px 8px",fontWeight:700}}>${(form.tierPrice||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                            </tr>
                          ))}
                          <tr style={{background:"#e5e7eb"}}>
                            <td colSpan={5} style={{padding:"6px 8px",fontWeight:700,color:"#0a1628"}}>Device Total ({ac===2?"pair":"single"})</td>
                            <td style={{padding:"6px 8px",fontWeight:700,color:"#0a1628"}}>${devTotal.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Care Plan */}
                      <div style={ss.section}>Care Plan</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px"}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13,color:"#0a1628"}}>{cpLabel}</div>
                          <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{cpDesc}</div>
                        </div>
                        {cpPrice > 0 && <div style={{fontWeight:700,fontSize:14,color:"#0a1628"}}>${cpPrice.toLocaleString('en-US',{minimumFractionDigits:2})}</div>}
                      </div>

                      {/* Total */}
                      <div style={{background:"#0a1628",borderRadius:8,padding:"12px 16px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{color:"white",fontWeight:700,fontSize:14}}>TOTAL PURCHASE PRICE</div>
                        <div style={{color:"white",fontWeight:800,fontSize:18}}>${total.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                      </div>

                      {/* Terms */}
                      <div style={ss.section}>Warranty</div>
                      <div style={ss.body}>The manufacturer warrants patient's hearing aid(s) to be free from defects in workmanship and materials for a period of {cpWarranty} year(s) from date of delivery and agrees to make all necessary repairs without charge to patient during the warranty period. The manufacturer provides a one-time loss and damage replacement during the warranty period at a cost of $275 per hearing aid.</div>

                      <div style={ss.section}>100% Satisfaction Guaranteed</div>
                      <div style={ss.body}>Patient has a right to cancel this agreement for any reason within 60 days. Patient is entitled to receive a full refund of any payment made for the hearing aid within 30 days of returning the hearing aid to MHC in normal working condition. MHC may refuse to provide a refund for a hearing aid that has been lost or damaged beyond repair while in the patient's possession.</div>

                      <div style={ss.section}>Patient Responsibility</div>
                      <div style={ss.body}>Patient is responsible to carefully follow all rehabilitation instructions and communicate with the provider on the progress with adjustments. During this time MHC may make any needed adjustments on the hearing aid(s) for the benefit of the patient's listening and hearing comfort. Patient should realize that adjusting to hearing aids is not an overnight experience and may take time. Patient also agrees to allow themselves time to adjust and allows MHC to assist them in their hearing rehabilitation. If MHC believes that, during the rehabilitation period, a different choice of circuitry, model, or choice of hearing aid(s) is better suited to the patient's needs, no extra cost will be incurred by the patient unless an upgrade of quality, model, or style is chosen. Suggested rehabilitation time is a minimum of 30 days. Additional time may be granted subject to approval by MHC.</div>

                      {/* Signature section */}
                      <div style={{height:1,background:"#e5e7eb",margin:"24px 0"}}/>

                      {paStep !== "sign" ? (
                        <div style={{textAlign:"center",padding:"20px 0"}}>
                          <button
                            style={{background:"#15803d",color:"white",border:"none",borderRadius:8,padding:"14px 32px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer"}}
                            onClick={()=>setPaStep("sign")}
                          >
                            Adopt and Sign
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>Patient Signature — Type to Sign</div>
                          <input
                            type="text" placeholder="Type your full legal name" value={paSignatureName} onChange={e=>setPaSignatureName(e.target.value)}
                            style={{width:"100%",padding:"12px 14px",borderRadius:8,border:"1px solid #d1d5db",fontFamily:"'Sora',sans-serif",fontSize:15,boxSizing:"border-box"}}
                          />
                          {paSignatureName.trim().length > 2 && (
                            <div style={{marginTop:12,padding:"14px 18px",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:10}}>
                              <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:6}}>Signature Preview</div>
                              <div style={{fontFamily:"Georgia,serif",fontStyle:"italic",fontSize:28,color:"#0a1628"}}>{paSignatureName}</div>
                            </div>
                          )}
                          <button
                            disabled={paSignatureName.trim().length<=2}
                            style={{width:"100%",marginTop:16,background:paSignatureName.trim().length>2?"#15803d":"#d1d5db",color:"white",border:"none",borderRadius:8,padding:"14px 20px",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:paSignatureName.trim().length>2?"pointer":"not-allowed"}}
                            onClick={()=>{
                              const sigDate = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
                              downloadPurchaseAgreement({
                                patient:{name:pName,address:form.address,phone:form.phone,dob:form.dob},
                                devices:{fittingType:fType,left:leftRec,right:rightRec},
                                carePlan:cpId, pricePerAid:form.tierPrice||0,
                                clinic:clinicObj,
                                provider:{fullName:provName,activeLicense:provLic,signatureUrl:staffProfile?.signatureUrl||null},
                                patientSignature:paSignatureName.trim(), patientSignatureDate:sigDate,
                                deliverySignature:null, deliveryDate:null, signatureImageBase64:null,
                              });
                              setWizardPaSigned(true);
                              setWizardPaSignatureDate(new Date().toISOString());
                              setShowWizardPaModal(false);
                              setPaStep("review");
                              setStep(5);
                            }}
                          >
                            Sign & Proceed
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </>
  );
}