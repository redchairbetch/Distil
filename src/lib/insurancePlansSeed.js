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

// Insurance plan seed/fallback data. Extracted verbatim from Distil.jsx
// (backlog #40a — monolith decomposition).


// Source of truth: Supabase insurance_plans table — editable in Admin →
// Insurance Plans, consumed via loadInsurancePlansGrouped(). This array is
// the offline/seed fallback if the DB load fails; verified at full parity
// with the table (85/85 plans, all tiers + prices) on 2026-06-10.
export const INSURANCE_PLANS = [
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
  { carrier:"Select Health Advantage", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Standard",price:99}, {label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Select Health", planGroup:"Medicare Kroger HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Choice PPO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Essential HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare Classic HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Summit Health", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"UMR", planGroup:"Teachers Health Trust", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Wellpoint / Amerigroup", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  // United Healthcare Hearing — single generic Medicare Supplement plan. NOT a
  // private-label plan (Gold/Platinum tiers keep isPrivateLabelPlan false), so it
  // uses the generic device cascade. Prices in DOLLARS (per-aid). The patient's
  // actual copay is device-driven via UHCH_COVERAGE: a mainstream device resolves
  // to Premium/Standard, a Relate device to Platinum/Gold, off-plan → retail.
  { carrier:"United Healthcare Hearing", planGroup:"Medicare Supplement", tpa:"UHCH", tiers:[{label:"Premium",price:1649}, {label:"Standard",price:1299}, {label:"Platinum",price:1249}, {label:"Gold",price:949}] },
  // NationsBenefits (Nations Hearing) — single generic plan nested under Aetna
  // (~90% of MHC's Nations patients). Device-driven flat copay, same shape as
  // UHCH: the chosen device resolves to a Nations tier via NATIONS_COVERAGE
  // (lib/pricing.js), and that tier's flat per-aid price IS the patient cost.
  // Nations keeps its own 6-rung ladder; prices in DOLLARS per aid. Devices
  // outside Nations' catalog → standard retail + acknowledgement form (see
  // deriveEarPrice 'nations-offplan'). Seed/offline fallback — the live values
  // come from the insurance_plans table (Aetna · Nations Hearing · tpa=Nations).
  { carrier:"Aetna", planGroup:"Nations Hearing", tpa:"Nations", tiers:[{label:"Standard",price:600}, {label:"Select",price:800}, {label:"Superior Plus",price:1150}, {label:"Advanced",price:1450}, {label:"Advanced Plus",price:1625}, {label:"Specialty",price:2000}] },
  // Molina Medicare Complete Care (HMO D-SNP), contract H5628-001-000 — also
  // NationsBenefits-administered (no relation to the Complete Care+ care plan).
  // Same covered-device catalog as the Aetna plan, but Molina renames all six
  // rungs and re-prices the flat copays: nationsCoverageTier() still resolves
  // the canonical rung, then NATIONS_PLAN_TIER_ALIASES (lib/pricing.js) maps it
  // to these labels. NOTE Molina's 'Advanced'/'Premium' are DIFFERENT rungs
  // than Aetna's 'Advanced' / TruHearing's 'Premium'. Tiers listed bottom rung
  // first; prices in DOLLARS per aid ($0 Entry is real — no member cost).
  { carrier:"Molina", planGroup:"Medicare Complete Care HMO D-SNP", tpa:"Nations", tiers:[{label:"Entry",price:0}, {label:"Basic",price:175}, {label:"Prime",price:475}, {label:"Preferred",price:775}, {label:"Advanced",price:1075}, {label:"Premium",price:1475}] },
];
