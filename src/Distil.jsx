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
} from "./db.js";


// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const DEFAULT_CLINIC = {
  name: "My Hearing Centers",
  address: "1234 N Hearing Ave, Phoenix, AZ 85012",
  phone: "(602) 555-0100",
  accent: "#16a34a", // green
};


const INSURANCE_PLANS = [
  { carrier:"Anthem", planGroup:"Medicare Preferred PPO; Medicare Supplement; Prefix MBL; Prefix VOD/YFZ; Prefix L7Q; Prefix VOC/YGZ; Anthem Empire Mediblue Freedom (PPO); Anthem Dual Advantage (HMO D-SNP); NV Anthem Medicare Advantage (HMO); NV Anthem I Carelon Chronic Care (HMO-POS C-SNP); KY Anthem Medicare Advantage HMO POS", tpa:"TruHearing", tiers:[{label:"Level 1",price:499}, {label:"Level 2",price:699}, {label:"Level 3",price:999}, {label:"Level 5",price:1399}, {label:"Level 7",price:1799}] },
  { carrier:"Anthem", planGroup:"Prefix JRG / JRI", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Anthem", planGroup:"Sheet Metal Workers' Union Local 33 Cleveland District via OH PPO/EPO Blue Access Local/Natl", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Anthem", planGroup:"Prefix XMM", tpa:"TruHearing", tiers:[{label:"Level 2",price:699}, {label:"Level 3",price:999}, {label:"Level 5",price:1399}, {label:"Level 7",price:1799}] },
  { carrier:"Anthem", planGroup:"Mediblue Access PPO; Preferred Provider Option; Prefix EAU", tpa:"TruHearing", tiers:[{label:"Level 1",price:1095}, {label:"Level 2",price:1400}, {label:"Level 3",price:1700}, {label:"Level 5",price:2095}, {label:"Level 7",price:2600}] },
  { carrier:"Anthem", planGroup:"Plumbers & Pipefitters Union Local No. 525", tpa:"TruHearing", tiers:[{label:"Level 3",price:1195}, {label:"Level 5",price:1495}, {label:"Level 7",price:1895}] },
  { carrier:"BCBS", planGroup:"BCBS Montana Medicare Advantage PPO", tpa:"TruHearing", tiers:[{label:"Level 3",price:1495}, {label:"Level 5",price:1895}, {label:"Level 7",price:2195}] },
  { carrier:"BCBS", planGroup:"Arkansas Choice; Prefix PBHAB; BCBS Arkansas Medicare Advantage HMO", tpa:"TruHearing", tiers:[{label:"Level 3",price:445}, {label:"Level 5",price:745}, {label:"Level 7",price:1145}] },
  { carrier:"BCBS", planGroup:"Arkansas Medipak; Prefix PBHF; Prefix XCM", tpa:"TruHearing", notes:"Select option only", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"AR Blue Medicare Saver Choice PPO; Prefix MCMAB; Medicare Advantage Optimum (PPO) MT", tpa:"TruHearing", tiers:[{label:"Level 1",price:695}, {label:"Level 2",price:895}, {label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"BCBS", planGroup:"AR BlueMedicare Advantage Premier Choice; AR BlueMedicare Advantage Premier HMO; AR BlueMedicare Advantage Classic Plus; AR Blue Medicare Advantage Classic", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Prefix XMC, XMX; True Blue Special Needs Plan (Idaho)", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"TN Blue Advantage Garnet", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS", planGroup:"Blue Care Plus TN", tpa:"TruHearing", notes:"Select option only", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"BCBS", planGroup:"Montana BCBS", tpa:"TruHearing", notes:"3IX / 5IX / 7IX pricing", tiers:[{label:"Level 3",price:1499}, {label:"Level 5",price:1899}, {label:"Level 7",price:2199}] },
  { carrier:"BCBS", planGroup:"BCBS of Michigan Prefix XYL", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"BCBS Idaho", planGroup:"Prefix XMM, XMA (Idaho)", tpa:"TruHearing", tiers:[{label:"Level 1",price:695}, {label:"Level 2",price:895}, {label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"BCBS", planGroup:"Prefix X2B (Idaho)", tpa:"TruHearing", notes:"Signia Level 1 only – No Cost to Patient", tiers:[{label:"Level 1",price:0}] },
  { carrier:"BCBS of Idaho", planGroup:"Idaho Medicaid Plus", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Standard",price:399}, {label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"CareSource Ohio", planGroup:"Dual Advantage Medicare/Medicaid", tpa:"TruHearing", notes:"No Cost to Patient; TH Private Label Advanced tech only", tiers:[{label:"Advanced",price:0}] },
  { carrier:"CareSource Ohio", planGroup:"Marketplace Bronze First", tpa:"TruHearing", notes:"Choice Options", tiers:[{label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"Central Midwest", planGroup:"Central Midwest Carpenters Welfare Fund", tpa:"TruHearing", notes:"Choice Options", tiers:[{label:"Level 1",price:695}, {label:"Level 2",price:895}, {label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"CIGNA", planGroup:"True Choice Medicare PPO MNPS; Cigna Med Adv Health Spring Tru Choice PPO; Cigna HealthSpring Preferred (HMO); Cigna HealthSpring Premier (HMO-POS)", tpa:"TruHearing", notes:"No Cost to Patient; Select options Advanced only", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Cleveland Bakers & Teamsters", planGroup:"Health and Welfare Fund", tpa:"TruHearing", notes:"Choice Options", tiers:[{label:"Level 1",price:695}, {label:"Level 2",price:895}, {label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"Devoted Health", planGroup:"Prime Ohio HMO; Premium Ohio HMO", tpa:"TruHearing", notes:"Standard/Select: Beltone Rexton only; Level 7 Not Available", tiers:[{label:"Level 2",price:999}, {label:"Level 3",price:1399}, {label:"Level 5",price:1599}] },
  { carrier:"Devoted Health", planGroup:"Choice Extra Ohio PPO; Core TN HMO; Choice Ohio PPO; Core OH HMO", tpa:"TruHearing", tiers:[{label:"Level 2",price:699}, {label:"Level 3",price:999}, {label:"Level 5",price:1399}, {label:"Level 7",price:1799}] },
  { carrier:"Devoted Health", planGroup:"Ohio Giveback HMO", tpa:"TruHearing", notes:"No Cost to Patient", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Devoted Health", planGroup:"Ohio Giveback HMO (based on zip code); Dual Plus OH", tpa:"TruHearing", tiers:[{label:"Level 2",price:899}, {label:"Level 3",price:1199}, {label:"Level 5",price:1299}, {label:"Level 7",price:1499}] },
  { carrier:"DMBA", planGroup:"Deseret Secure; Deseret Alliance", tpa:"TruHearing", tiers:[{label:"Level 2",price:899}, {label:"Level 3",price:1199}, {label:"Level 5",price:1299}, {label:"Level 7",price:1499}] },
  { carrier:"EMI Educators Mutual Association", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Level 2",price:745}, {label:"Level 3",price:1025}, {label:"Level 5",price:1500}, {label:"Level 7",price:1800}] },
  { carrier:"GEHA", planGroup:"UHC Choice Plus Plan", tpa:"TruHearing", tiers:[{label:"Level 1",price:399}, {label:"Level 2",price:745}, {label:"Level 3",price:1025}, {label:"Level 5",price:1500}, {label:"Level 7",price:1800}] },
  { carrier:"Highmark", planGroup:"Prefix T3B", tpa:"TruHearing", tiers:[{label:"Level 2",price:1049}, {label:"Level 3",price:1349}, {label:"Level 5",price:1699}, {label:"Level 7",price:2099}] },
  { carrier:"Highmark", planGroup:"Prefix HRT", tpa:"TruHearing", tiers:[{label:"Level 1",price:599}, {label:"Level 2",price:899}, {label:"Level 3",price:1099}, {label:"Level 5",price:1499}, {label:"Level 7",price:1899}] },
  { carrier:"Highmark", planGroup:"Prefix HRF", tpa:"TruHearing", tiers:[{label:"Advanced",price:199}, {label:"Premium",price:499}] },
  { carrier:"Highmark", planGroup:"Prefix C4K", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Highmark", planGroup:"Prefix ZWD", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Humana", planGroup:"Medicare Advantage", tpa:"TruHearing", notes:"Advanced at Zero Copay", tiers:[{label:"Advanced",price:0}, {label:"Premium",price:299}] },
  { carrier:"Humana", planGroup:"Humana Choice Diabetes and Heart (PPO C-SNP)", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Humana", planGroup:"USAA Honor Giveback PPO; Humana Essentials Plus Giveback (PPO); Humana Honor PPO; Humana Choice Giveback (PPO); Humana Cleveland Clinic Preferred (HMO-POS); Full Access PPO; Total Complete HMO", tpa:"TruHearing", tiers:[{label:"Level 1",price:695}, {label:"Level 2",price:895}, {label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"Humana", planGroup:"USAA Honor Giveback (HMO)", tpa:"TruHearing", tiers:[{label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"Humana", planGroup:"Choice PPO", tpa:"TruHearing", notes:"Select option only", tiers:[{label:"Advanced",price:99}, {label:"Premium",price:399}] },
  { carrier:"Humana", planGroup:"Value Plus PPO; Dual Select HMO; Dual Select PPO; Gold Plus HMO (based on zip code)", tpa:"TruHearing", notes:"Select option only; *Copay may vary depending on zip code", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Humana", planGroup:"Gold Plus HMO (based on zip code); Gold Plus Diabetes and Heart (HMO CSNP); Value Choice PPO", tpa:"TruHearing", notes:"Select option only", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Humana", planGroup:"Gold Plus Giveback HMO", tpa:"TruHearing", notes:"Select options only", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:799}] },
  { carrier:"Humana Medicare", planGroup:"Employer PPO Ohio CARP. Health Plan", tpa:"TruHearing", notes:"Select option only", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Humana Medicare", planGroup:"Humana Medicare Employer PPO University of Oklahoma; Humana NW Laborers Employee Plan; Humana Medicare Employer PPO International Associates", tpa:"TruHearing", notes:"Level 7 Not Available", tiers:[{label:"Level 2",price:1325}, {label:"Level 3",price:1575}, {label:"Level 5",price:1925}] },
  { carrier:"Humana Medicare", planGroup:"Humana Medicare Employer PPO Board of Pensions", tpa:"TruHearing", notes:"Standard/Select: Beltone Rexton only", tiers:[{label:"Level 2",price:970}, {label:"Level 3",price:1270}, {label:"Level 5",price:1570}, {label:"Level 7",price:1970}] },
  { carrier:"Lineco", planGroup:"Lineco", tpa:"TruHearing", notes:"Standard/Select: Beltone Rexton only; Level 7 Not Available", tiers:[{label:"Level 2",price:975}, {label:"Level 3",price:1275}, {label:"Level 5",price:1575}] },
  { carrier:"Medical Mutual", planGroup:"Medicare Advantage Plans", tpa:"TruHearing", tiers:[{label:"Level 3",price:1645}, {label:"Level 5",price:1950}, {label:"Level 7",price:2350}] },
  { carrier:"Moda", planGroup:"Medicare Supplement", tpa:"TruHearing", tiers:[{label:"Level 1",price:695}, {label:"Level 2",price:895}, {label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"Moda", planGroup:"Moda Health Central PPO", tpa:"TruHearing", notes:"Select (TH Private Label)", tiers:[{label:"Standard",price:299}, {label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Pacific Source", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Primetime Health", planGroup:"Medicare Advantage HMO", tpa:"TruHearing", tiers:[{label:"Standard",price:599}, {label:"Advanced",price:799}, {label:"Premium",price:999}] },
  { carrier:"Prominence", planGroup:"Prominence Plus HMO", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Prominence", planGroup:"Prominence Plans", tpa:"TruHearing", notes:"*Copays may vary based on patient", tiers:[{label:"Advanced",price:299}, {label:"Premium",price:599}] },
  { carrier:"Providence", planGroup:"Choice Plan; Medicare Advantage", tpa:"TruHearing", notes:"Advanced – Zero Copay; some zipcodes under Gold Plus may have a zero copay", tiers:[{label:"Advanced",price:0}] },
  { carrier:"Providence", planGroup:"Medicare Flex; Providence Medicare Align HMO", tpa:"TruHearing", notes:"Some zipcodes under Gold Plus may have a zero copay", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Regence", planGroup:"Medicare Supplement Bridge Plan N; Prefix ZVU; Prefix ZVY and XNH; UAW", tpa:"TruHearing", tiers:[{label:"Advanced",price:499}, {label:"Premium",price:799}] },
  { carrier:"Regence", planGroup:"Medicare Advantage PPO; Prefix ZVX, ZVW, ZVH, ZVU, ZHO; Medicare Supplement Bridge Plan G (Prefix YVO)", tpa:"TruHearing", tiers:[{label:"Level 2",price:699}, {label:"Level 3",price:999}, {label:"Level 5",price:1399}, {label:"Level 7",price:1799}] },
  { carrier:"Saint Alphonsus HMO", planGroup:"Medicare Advantage", tpa:"TruHearing", tiers:[{label:"Level 3",price:1250}, {label:"Level 5",price:1595}, {label:"Level 7",price:2050}] },
  { carrier:"SCAN", planGroup:"Prefix 40028942101; Prefix 40045778801; Prefix 40010939801", tpa:"TruHearing", tiers:[{label:"Advanced",price:99}, {label:"Premium",price:399}] },
  { carrier:"SCAN", planGroup:"SCAN Classic HMO; SCAN Venture HMO", tpa:"TruHearing", tiers:[{label:"Level 3",price:1495}, {label:"Level 5",price:1895}, {label:"Level 7",price:2195}] },
  { carrier:"Select Health Choice", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Level 1",price:600}, {label:"Level 2",price:850}, {label:"Level 3",price:1100}, {label:"Level 5",price:1350}, {label:"Level 7",price:1500}] },
  { carrier:"Select Health Advantage", planGroup:"All Plans", tpa:"TruHearing", notes:"*Copays may vary based on patient", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Select Health", planGroup:"Medicare + Kroger HMO; Medicare Choice (PPO); Medicare Essential (HMO); Medicare Classic (HMO); Medicare", tpa:"TruHearing", tiers:[{label:"Advanced",price:399}, {label:"Premium",price:699}] },
  { carrier:"Summit Health", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:599}, {label:"Premium",price:899}] },
  { carrier:"Surebridge", planGroup:"Dental Wise Plus", tpa:"TruHearing", tiers:[{label:"Level 2",price:1325}, {label:"Level 3",price:1575}, {label:"Level 5",price:1925}, {label:"Level 7",price:2325}] },
  { carrier:"UAW", planGroup:"UAW Retiree; UAW Trust", tpa:"TruHearing", tiers:[{label:"Level 2",price:475}, {label:"Level 3",price:775}, {label:"Level 5",price:1075}, {label:"Level 7",price:1475}] },
  { carrier:"UCLA Health", planGroup:"MA Prestige Plan", tpa:"TruHearing", tiers:[{label:"Level 1",price:600}, {label:"Level 2",price:850}, {label:"Level 3",price:1100}, {label:"Level 5",price:1350}, {label:"Level 7",price:1500}] },
  { carrier:"UMR", planGroup:"Teachers Health Trust", tpa:"TruHearing", tiers:[{label:"Standard",price:499}, {label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"Vision Service Plan (VSP)", planGroup:"Vision Service Plan (VSP)", tpa:"TruHearing", tiers:[{label:"Level 1",price:700}, {label:"Level 2",price:975}, {label:"Level 3",price:1250}, {label:"Level 5",price:1450}, {label:"Level 7",price:1800}] },
  { carrier:"Wellcare / Wellcare Healthnet / Healthnet", planGroup:"All Plans", tpa:"TruHearing", notes:"Choice plan", tiers:[{label:"Level 1",price:1250}, {label:"Level 2",price:1350}, {label:"Level 3",price:1595}, {label:"Level 5",price:1950}, {label:"Level 7",price:2325}] },
  { carrier:"Wellcare", planGroup:"Wellcare Dual Select HMO D SNP", tpa:"TruHearing", tiers:[{label:"Level 1",price:650}, {label:"Level 2",price:750}, {label:"Level 3",price:995}, {label:"Level 5",price:1350}, {label:"Level 7",price:1725}] },
  { carrier:"Wellpoint (also known as Amerigroup)", planGroup:"All Plans", tpa:"TruHearing", tiers:[{label:"Advanced",price:699}, {label:"Premium",price:999}] },
  { carrier:"AARP Medicare", planGroup:"AARP Medicare Advantage Choice Plan / AARP Medicare Advantage Choice Plan 1 / AARP Medicare Advantage Choice Plan 2 / AARP Medicare Advantage Choice Plan 3", tpa:"United Healthcare Hearing", notes:"UHCH Branded Relate Product $399", tiers:[{label:"Level 2",price:800}, {label:"Level 3",price:800}, {label:"Level 5",price:1225}] },
  { carrier:"AARP Medicare", planGroup:"AARP Medicare Advantage Plan 1", tpa:"United Healthcare Hearing", tiers:[{label:"Level 3",price:1399}, {label:"Level 7",price:1899}] },
  { carrier:"AARP Medicare Advantage", planGroup:"AARP Medicare Advantage Choice PPO / AARP Medicare Advantage PPO / AARP Medicare Advantage HMO POS / AARP Medicare Advantage Essentials HMO POS / AARP Medicare Advantage Extras HMO POS / Patriot / AARP Medicare Advantage Giveback from UHC UT PPO / AARP Medicare Adv. Extra Value HMO POS / AARP Medicare Advantage Plan 2", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:599}, {label:"Level 3",price:829}, {label:"Level 5",price:1249}] },
  { carrier:"AARP Medicare Advantage", planGroup:"Medicare Supplement Plan C / Medicare Supplement Plan G / Medicare Supplement Plan L / Medicare Supplement Plan N", tpa:"United Healthcare Hearing", tiers:[{label:"Level 3",price:1299}, {label:"Level 7",price:1649}] },
  { carrier:"AARP United Healthcare", planGroup:"Medicare Supplement", tpa:"United Healthcare Hearing", notes:"UHCH Branded Relate Product $399 or $699", tiers:[{label:"Level 3",price:1349}, {label:"Level 5",price:1749}, {label:"Level 7",price:2199}] },
  { carrier:"AARP United Healthcare", planGroup:"AARP Medicare Advantage Walgreens (HMO POS)", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:599}, {label:"Level 3",price:829}, {label:"Level 5",price:1249}] },
  { carrier:"AARP United Healthcare", planGroup:"AARP Medicare Advantage UHC OH (HMO POS) / Medicare Advantage from CA - 004P (HMO) / AARP Medicare Extra Value / AARP Medicare Adv Essential", tpa:"United Healthcare Hearing", notes:"UHCH Branded Relate Product $399", tiers:[{label:"Level 2",price:599}, {label:"Level 3",price:829}, {label:"Level 5",price:1249}] },
  { carrier:"Anthem Blue Cross", planGroup:"Los Angeles County Fire Fighters Local 1014 Health & Welfare Plan", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:1149}, {label:"Level 3",price:1449}, {label:"Level 5",price:1949}, {label:"Level 7",price:2299}] },
  { carrier:"Blue Shield California", planGroup:"Prefix XEE / XEM", tpa:"United Healthcare Hearing", notes:"Level designations use IX suffix", tiers:[{label:"Level 3",price:1499}, {label:"Level 5",price:1899}, {label:"Level 7",price:2199}] },
  { carrier:"CIGNA Union", planGroup:"Ironworkers Intermountain H&W", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:1049}, {label:"Level 3",price:1349}, {label:"Level 5",price:1699}, {label:"Level 7",price:2099}] },
  { carrier:"United Healthcare", planGroup:"United Health Chronic Complete Assure / United Healthcare Dual Complete Choice DSNP / United Health Dual Complete Choice / UHC Dual Complete Full Plan G / Washington Dual Complete Plan G / UHC Nursing Home Plan / UHC Dual Complete OH / UHC Care Advantage UT / WA PPO I SNP", tpa:"United Healthcare Hearing", tiers:[{label:"Level 3",price:1249}, {label:"Level 5",price:1799}, {label:"Level 7",price:2249}] },
  { carrier:"United Healthcare", planGroup:"UHC Dual Complete HMO POS / UHC Dual Complete Choice Select PPO D SNP / UHC Complete Care AR-0005 PPO C SNP / UHC Complete Care AR-V001 PPO D SNP / UHC Complete Care HMO / UHC Dual Complete OH-V001 (HMO POS D-SNP) / UHC Dual Complete WA (PPO DSNP)", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:599}, {label:"Level 3",price:829}, {label:"Level 5",price:1249}] },
  { carrier:"United Healthcare", planGroup:"UHC Dual Complete PPO / UHC Dual Complete Choice PPO / UHC Dual Complete HMO (D-SNP) / UHC Dual Complete OH Plan OH DSNP / UHC Dual Complete OH-S2 (HMO-POS D SNP) / UHC Dual Complete OH-S3 (HMO-POS D-SNP) / UHC Dual Complete WA (HMO POS D SNP) / UHC Dual Complete Choice - SH PPO D SNP / UHC Assisted Living Plan PPO / UHC Care Advantage PPO / UHC Dual Complete AR-S2 (PPO D-SNP) / UHC Dual Complete ID-Y1 (HMO-POS D-SNP) / UHC Dual Complete WA S1 PPO", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:1099}, {label:"Level 3",price:1249}, {label:"Level 5",price:1599}, {label:"Level 7",price:2199}] },
  { carrier:"United Healthcare", planGroup:"UHC Medicare Direct", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:999}, {label:"Level 3",price:1249}, {label:"Level 5",price:1799}, {label:"Level 7",price:2249}] },
  { carrier:"United Healthcare", planGroup:"UHC The Villages Medicare Advantage / UHC Rocky Mountain Medicare Advantage", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:599}, {label:"Level 3",price:829}, {label:"Level 5",price:1249}] },
  { carrier:"United Healthcare", planGroup:"UHC Complete Care Support OR-1 A PPO C SNP / UHC Complete Care Support ID-1A (PPO C-SNP) / United Health Chronic Complete Assure / UHC Dual Complete WY-S001 (PPO D-SNP)", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:1099}, {label:"Level 3",price:1249}, {label:"Level 5",price:1599}, {label:"Level 7",price:2199}] },
  { carrier:"United Healthcare", planGroup:"UHC Signature HMO", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:1199}, {label:"Level 3",price:1499}, {label:"Level 5",price:1899}, {label:"Level 7",price:2199}] },
  { carrier:"United Healthcare", planGroup:"UHC Choice Plus", tpa:"United Healthcare Hearing", tiers:[{label:"Level 3",price:1399}, {label:"Level 7",price:1999}] },
  { carrier:"United Healthcare", planGroup:"UHC AT&T Group Medicare Adv. PPO *Plus / UHC AT&T Group Medicare Adv. PPO / UHC Group Medicare Adv PEBB Complete PPO / UHC GEHA Group Medicare Advantage / United Healthcare Group Medicare Advantage PPO / UHC Group Medicare Advantage (PPO) APWU Health Plan / UHC Lumen Retiree Medicare Advantage (PPO) / UHC Group Medicare Adv PPO UAW Retiree", tpa:"United Healthcare Hearing", tiers:[{label:"Level 3",price:1399}, {label:"Level 7",price:1899}] },
  { carrier:"WM Medicare", planGroup:"White Motor Retiree Trust", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:1149}, {label:"Level 3",price:1449}, {label:"Level 5",price:1899}, {label:"Level 7",price:2299}] },
  { carrier:"Surest via UHC Choice+", planGroup:"Surest via UHC Choice+", tpa:"United Healthcare Hearing", tiers:[{label:"Level 2",price:1199}, {label:"Level 3",price:1499}, {label:"Level 5",price:1899}, {label:"Level 7",price:2199}] },
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
  // TruHearing 7 = Premium tier (Signia 7IX equivalent)
  // TruHearing 5 = Standard tier (Signia 5IX equivalent)
  // TruHearing 3 = Essential tier (Signia 3IX equivalent)
  // Model naming: "TruHearing [number] Li-Ion" (rechargeable) or "TruHearing [number]" (312)
  // Tech level labels use TruHearing's own tier names per their portal
  { id:"th-ric-liion", manufacturer:"TruHearing", generation:"IX",
    family:"TruHearing RIC Li-Ion", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["Premium","Standard","Essential"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Rechargeable"], active:true,
    notes:"Private-label Signia IX RIC rechargeable. Ordered through TruHearing portal. Premium=$999, Standard=$699, Essential=$499 per aid (provider pricing)." },


  { id:"th-ric-312", manufacturer:"TruHearing", generation:"IX",
    family:"TruHearing RIC 312", styles:["ric"],
    variants:["Standard","CROS"],
    techLevels:["Premium","Standard","Essential"],
    colors:["Black","Graphite","Dark Champagne","Silver","Pearl White","Fine Gold","Deep Brown","Sandy Brown","Rose Gold","Beige"],
    battery:["Size 312"], active:true,
    notes:"Private-label Signia IX RIC with 312 battery. Same platform as Li-Ion variant." },


  { id:"th-custom", manufacturer:"TruHearing", generation:"IX",
    family:"TruHearing Custom", styles:["ite","itc","cic"],
    variants:["ITE","ITC","CIC"],
    techLevels:["Premium","Standard","Essential"],
    colors:["Beige","Sandy Brown","Dark Brown","Deep Brown","Black"],
    battery:["Size 13","Size 312","Size 10"], active:true,
    notes:"Private-label Signia IX custom products ordered through TruHearing portal." },
];
const RECEIVER_LENGTHS = ["0","1","2","3","4"];


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


function genId() { return Math.random().toString(36).slice(2,9).toUpperCase(); }
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


function AudigramSVG({rightT={},leftT={},interactive=false,onSet,activeEar="right"}){
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
    const cur=activeEar==="right"?rightT:leftT;
    onSet?.(activeEar,freq,cur[freq]===clamped?null:clamped);
  };


  const pts=thr=>AUDIG_FREQS.map((f,i)=>thr[f]!=null?`${fx(i)},${dy(thr[f])}`:null).filter(Boolean);
  const rPts=pts(rightT), lPts=pts(leftT);


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
            stroke={db===0?"#374151":"#e5e7eb"} strokeWidth={db===0?1.5:1}
            strokeDasharray={db===0?"":""}/>
          <text x={ML-6} y={dy(db)+4} fontSize="10" fill="#6b7280" textAnchor="end">{db}</text>
        </g>
      ))}
      <text x={ML-38} y={MT+PH/2} fontSize="10" fill="#9ca3af" textAnchor="middle"
        transform={`rotate(-90,${ML-38},${MT+PH/2})`}>Hearing Level (dB HL)</text>
      <text x={ML+PW/2} y={H-2} fontSize="10" fill="#9ca3af" textAnchor="middle">Frequency (Hz)</text>
      {rPts.length>1&&<polyline points={rPts.join(" ")} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeOpacity="0.7"/>}
      {lPts.length>1&&<polyline points={lPts.join(" ")} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeOpacity="0.7"/>}
      {AUDIG_FREQS.map((f,i)=>rightT[f]!=null&&(
        <circle key={"r"+f} cx={fx(i)} cy={dy(rightT[f])} r={interactive&&activeEar==="right"?7:6}
          fill="white" stroke="#dc2626" strokeWidth="2.5"/>
      ))}
      {AUDIG_FREQS.map((f,i)=>leftT[f]!=null&&(
        <g key={"l"+f}>
          <line x1={fx(i)-6} y1={dy(leftT[f])-6} x2={fx(i)+6} y2={dy(leftT[f])+6} stroke="#2563eb" strokeWidth="2.5"/>
          <line x1={fx(i)+6} y1={dy(leftT[f])-6} x2={fx(i)-6} y2={dy(leftT[f])+6} stroke="#2563eb" strokeWidth="2.5"/>
        </g>
      ))}
      <circle cx={ML+8} cy={MT-26} r="5" fill="white" stroke="#dc2626" strokeWidth="2"/>
      <text x={ML+18} y={MT-22} fontSize="10" fill="#dc2626" fontWeight="600">Right (O)</text>
      <line x1={ML+78} y1={MT-30} x2={ML+88} y2={MT-20} stroke="#2563eb" strokeWidth="2.5"/>
      <line x1={ML+88} y1={MT-30} x2={ML+78} y2={MT-20} stroke="#2563eb" strokeWidth="2.5"/>
      <text x={ML+94} y={MT-22} fontSize="10" fill="#2563eb" fontWeight="600">Left (X)</text>
      {interactive&&(
        <text x={ML+PW/2} y={MT-22} fontSize="10" fill="#9ca3af" textAnchor="middle">
          Click to plot threshold · Click existing point to clear
        </text>
      )}
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
const STEPS = ["Patient","Testing","Results","Treatment Options","Coverage","Schedule","Review"];


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
  const [punchData, setPunchData] = useState({ cleanings: 0, appointments: 0, log: [] });
  const [punchConfirm, setPunchConfirm] = useState(null);
  const [punchSuccess, setPunchSuccess] = useState(null);

  // ── Intake queue state ────────────────────────────────────────────────
  const [pendingIntakes,  setPendingIntakes]  = useState([]);
  const [intakeToast,     setIntakeToast]     = useState(null);
  const [showIntakeQueue, setShowIntakeQueue] = useState(false);
  const seenIntakeIds = useRef(new Set());


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
    techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:""
  });


  // New patient form state
  const [form, setForm] = useState({
    firstName:"", lastName:"", dob:"", phone:"", email:"",
    payType:"insurance",
    carrier:"", planGroup:"", tpa:"", tier:"", tierPrice:null,
    left: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:""},
    right: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:""},
    audiology: { rightT:{}, leftT:{}, unaidedR:null, unaidedL:null, aidedR:null, aidedL:null, sinBin:null },
    carePlan:"",
    fittingDate: new Date().toISOString().split("T")[0],
    appointments:[],
    notes:"",
  });


  const [activeSide, setActiveSide] = useState("left");
  const [audEar, setAudEar] = useState("right");


  const upd = (k,v) => setForm(f => ({...f,[k]:v}));
  const updSide = (side, k, v) => setForm(f => ({...f, [side]: {...f[side], [k]: v}}));
  const resetSide = (side, partial={}) => setForm(f => ({...f, [side]: {style:"", manufacturer:"", generation:"", familyId:"", variant:"", techLevel:"", color:"", battery:"", receiverLength:"", receiverPower:"", dome:"", ...partial}}));


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
    })();
  }, [clinicId]);


  const refreshPatients = async () => {
    const p = await loadAllPatients();
    setPatients(p);
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


  // Clear non-TruHearing device selections when a private-label plan is chosen
  useEffect(() => {
    if (!isPrivateLabel) return;
    const emptySide = {style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:""};
    setForm(f => ({
      ...f,
      left:  (f.left.manufacturer && f.left.manufacturer !== "TruHearing")  ? {...emptySide} : f.left,
      right: (f.right.manufacturer && f.right.manufacturer !== "TruHearing") ? {...emptySide} : f.right,
    }));
  }, [isPrivateLabel]); // eslint-disable-line react-hooks/exhaustive-deps


  const buildSideRecord = (s) => {
    if (!s.familyId && s.manufacturer !== "TruHearing") return null;
    if (s.manufacturer === "TruHearing" && !s.techLevel) return null;
    if (s.manufacturer === "TruHearing") return {
      manufacturer: "TruHearing", generation: "Select", family: "TruHearing Select",
      variant: "", techLevel: s.techLevel, style: "ric",
      color: "", battery: "", receiverLength: "", receiverPower: "", receiver: "", dome: "",
    };
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


  const handleSave = async () => {
    const leftRec = buildSideRecord(form.left);
    const rightRec = buildSideRecord(form.right);
    const primary = leftRec || rightRec;
    const isCROS = [leftRec, rightRec].some(r => r?.variant?.toLowerCase().includes("cros"));
    const fittingType = leftRec && rightRec ? (isCROS ? "CROS/BiCROS" : "Bilateral") : leftRec ? "Monaural Left" : "Monaural Right";
    const years = form.payType === "insurance" && form.carePlan === "complete" ? 4 : 3;
    const patient = {
      id: genId(),
      location: clinic.name,
      createdAt: new Date().toISOString(),
      name: [form.firstName, form.lastName].filter(Boolean).join(" "),
      dob: form.dob,
      phone: form.phone,
      email: form.email,
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
        fittingDate: form.fittingDate,
        warrantyExpiry: warrantyDate(form.fittingDate, years),
        serialLeft: genId(),
        serialRight: genId(),
      },
      audiology: form.audiology,
      carePlan: form.payType === "insurance" ? form.carePlan : null,
      appointments: form.appointments,
      notes: form.notes,
    };
    await savePatient(patient, staffId, clinicId);
    setSaved(true);
    await refreshPatients();
    setSelectedPatient(patient);
    setPunchData({ cleanings: 0, appointments: 0, log: [] });
    setView("patient");
  };


  const startNew = () => {
    setForm({ firstName:"",lastName:"",dob:"",phone:"",email:"",payType:"insurance",carrier:"",planGroup:"",tpa:"",tier:"",tierPrice:null,left:{style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:""},right:{style:"",manufacturer:"",generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:""},audiology:{rightT:{},leftT:{},unaidedR:null,unaidedL:null,aidedR:null,aidedL:null,sinBin:null},carePlan:"",fittingDate:new Date().toISOString().split("T")[0],appointments:[],notes:"" });
    setActiveSide("left");
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
        </div>
        <button className="btn-primary green" onClick={startNew}>＋ New Patient</button>
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
                  const fillClass = days < 30 ? "exp" : days < 90 ? "warn" : "";
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
                        <div style={{fontSize:12,color: days<30?"#ef4444":days<90?"#f59e0b":"#16a34a",fontWeight:600}}>
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

  // Private-label (TruHearing Select) plan detection
  const isPrivateLabelPlan = (plan) =>
    plan?.tiers?.length > 0 && plan.tiers.every(t => ["Standard","Advanced","Premium"].includes(t.label));
  const selectedInsurancePlan = INSURANCE_PLANS.find(p => p.carrier === form.carrier && p.planGroup === form.planGroup);
  const isPrivateLabel = form.payType === "insurance" && isPrivateLabelPlan(selectedInsurancePlan);
  const privateLabelTiers = isPrivateLabel ? (selectedInsurancePlan?.tiers || []) : [];


  // Catalog-driven cascade derived values (side-aware)
  const sd = form[activeSide]; // active side data shorthand
  const activeCatalog = catalog.filter(e => e.active);
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
  const otherSide = activeSide === "left" ? "right" : "left";


  const isSideConfigured = (s) => {
    const d = form[s];
    if (d.manufacturer === "TruHearing") return !!(d.techLevel); // private label: tech level alone is sufficient
    const fam = catalog.find(e => e.id === d.familyId);
    const vReq = (fam?.variants?.length || 0) > 1;
    return !!(d.familyId && d.techLevel && (!vReq || d.variant));
  };


  const canProceed = [
    form.firstName && form.lastName && form.dob && form.phone,
    true, // Testing — always skippable
    true, // Results — always skippable
    (isSideConfigured("left") || isSideConfigured("right")) && (form.payType !== "insurance" || form.carePlan),
    form.payType === "private" || (form.carrier && form.planGroup && form.tier),
    true,
    true,
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
      const setThreshold=(ear,freq,val)=>{
        const key=ear==="right"?"rightT":"leftT";
        const next={...form.audiology[key]};
        if(val==null) delete next[freq]; else next[freq]=val;
        updAud(key,next);
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
              Switch ears using the toggle below. Pure tone average (PTA) calculates automatically from 500, 1000, and 2000 Hz.
            </div>
            <div className="side-tabs" style={{marginBottom:14}}>
              {["right","left"].map(ear=>(
                <button key={ear} className={`side-tab ${audEar===ear?"active":""}`}
                  onClick={()=>setAudEar(ear)}>
                  <div className="side-tab-label">{ear==="right"?"🔴 Right Ear (O)":"Left Ear (X) 🔵"}</div>
                  <div className="side-tab-sub">
                    {ear==="right"
                      ?(rPTA!=null?`PTA: ${rPTA} dB HL`:"No thresholds plotted")
                      :(lPTA!=null?`PTA: ${lPTA} dB HL`:"No thresholds plotted")}
                  </div>
                </button>
              ))}
            </div>
            <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 8px"}}>
              <AudigramSVG
                rightT={form.audiology.rightT} leftT={form.audiology.leftT}
                interactive={true} onSet={setThreshold} activeEar={audEar}/>
            </div>
            {(rPTA!=null||lPTA!=null)&&(
              <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
                {rPTA!=null&&(
                  <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 14px",fontSize:12}}>
                    <span style={{color:"#dc2626",fontWeight:700}}>Right PTA: {rPTA} dB HL</span>


                  </div>
                )}
                {lPTA!=null&&(
                  <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"8px 14px",fontSize:12}}>
                    <span style={{color:"#2563eb",fontWeight:700}}>Left PTA: {lPTA} dB HL</span>


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
                <AudigramSVG rightT={aud.rightT||{}} leftT={aud.leftT||{}} interactive={false}/>
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
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#16a34a",marginBottom:2}}>CCT Aided</div>
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
    if (step === 3) return (
      <>
        <div className="card">
          <div className="card-title">Treatment Options</div>


          {/* ── Side Tabs ── */}
          <div className="side-tabs">
            {["left","right"].map(side => {
              const configured = isSideConfigured(side);
              const sideData = form[side];
              const fam = catalog.find(e => e.id === sideData.familyId);
              const subLabel = configured
                ? (sideData.manufacturer === "TruHearing"
                    ? `TruHearing Select · ${sideData.techLevel}`
                    : `${fam?.family || ""} · ${sideData.techLevel}`)
                : "Not configured";
              return (
                <button key={side} className={`side-tab ${activeSide===side?"active":""} ${configured?"configured":""}`}
                  onClick={()=>setActiveSide(side)}>
                  <div className="side-tab-label">{side==="left"?"👂 Left Ear":"Right Ear 👂"}</div>
                  <div className="side-tab-sub">{subLabel}</div>
                </button>
              );
            })}
          </div>


          {/* ── Private-label plan notice ── */}
          {isPrivateLabel && (
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1e40af",fontWeight:600}}>
              🏷️ This plan uses TruHearing Select devices — device selection is limited to the technology tiers covered by this plan.
            </div>
          )}

          {/* ── 1. Body Style (standard plans only) ── */}
          {!isPrivateLabel && (
          <div className="field" style={{marginBottom:16}}><label>Body Style</label>
            <div className="style-grid">
              {BODY_STYLES.map(s=>(
                <div key={s.id} className={`style-card ${sd.style===s.id?"active":""}`}
                  onClick={()=>resetSide(activeSide,{style:s.id})}>
                  <div className="style-id">{s.label}</div>
                  <div className="style-desc">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
          )}


          {/* ── 2–6. Standard catalog cascade ── */}
          {!isPrivateLabel && (<>

          {/* ── 2. Manufacturer ── */}
          {sd.style && availMfrs.length > 0 && (
            <div className="field" style={{marginBottom:16}}><label>Manufacturer</label>
              <div className="radio-group">
                {availMfrs.map(m=>(
                  <div key={m} className={`radio-pill ${sd.manufacturer===m?"active":""}`}
                    onClick={()=>setForm(f=>({...f,[activeSide]:{...f[activeSide],manufacturer:m,generation:"",familyId:"",variant:"",techLevel:"",color:"",battery:""}}))}>
                    <div className="radio-pill-label">{m}</div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* ── 3. Generation ── */}
          {sd.manufacturer && availGens.length > 0 && (
            <div className="field" style={{marginBottom:16}}><label>Platform / Generation</label>
              <div className="radio-group">
                {availGens.map(g=>(
                  <div key={g} className={`radio-pill ${sd.generation===g?"active":""}`}
                    onClick={()=>setForm(f=>({...f,[activeSide]:{...f[activeSide],generation:g,familyId:"",variant:"",techLevel:"",color:"",battery:""}}))}>
                    <div className="radio-pill-label">{g}</div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* ── 4. Model Family ── */}
          {sd.generation && availFamilies.length > 0 && (
            <div className="field" style={{marginBottom:16}}><label>Model Family</label>
              <div className="plan-select-list">
                {availFamilies.map(fam=>(
                  <div key={fam.id} className={`plan-row ${sd.familyId===fam.id?"active":""}`}
                    onClick={()=>{
                      const autoVar = fam.variants.length===1 ? fam.variants[0] : "";
                      const autoBat = fam.battery.length===1 ? fam.battery[0] : "";
                      setForm(f=>({...f,[activeSide]:{...f[activeSide],familyId:fam.id,variant:autoVar,techLevel:"",color:"",battery:autoBat}}));
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


          {/* ── 5. Variant ── */}
          {selectedFamily && selectedFamily.variants.length > 1 && (
            <div className="field" style={{marginBottom:16}}><label>Variant</label>
              <div className="radio-group">
                {selectedFamily.variants.map(v=>(
                  <div key={v} className={`radio-pill ${sd.variant===v?"active":""}`} onClick={()=>updSide(activeSide,"variant",v)}>
                    <div className="radio-pill-label">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* ── 6. Tech Level ── */}
          {selectedFamily && (sd.variant || !variantRequired) && (
            <div className="field" style={{marginBottom:16}}><label>Technology Level</label>
              <div className="radio-group">
                {selectedFamily.techLevels.map(t=>(
                  <div key={t} className={`radio-pill ${sd.techLevel===t?"active":""}`} onClick={()=>updSide(activeSide,"techLevel",t)}>
                    <div className="radio-pill-label">{t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          </>)} {/* end standard cascade */}

          {/* ── Private-label tech picker ── */}
          {isPrivateLabel && (
            <div className="field" style={{marginBottom:16}}><label>Technology Level</label>
              <div className="plan-select-list">
                {privateLabelTiers.map(t => {
                  const isActive = sd.manufacturer === "TruHearing" && sd.techLevel === t.label;
                  return (
                    <div key={t.label} className={`plan-row ${isActive?"active":""}`}
                      onClick={()=>setForm(f=>({...f,[activeSide]:{...f[activeSide],manufacturer:"TruHearing",techLevel:t.label,generation:"",familyId:"",variant:"",color:"",battery:"",receiverLength:"",receiverPower:"",dome:""}}))}>
                      <div className="plan-row-top">
                        <div className="plan-row-name">{t.label}</div>
                        <div style={{fontWeight:700,color:"#0a1628"}}>{t.price===0?"No Charge":`$${t.price.toLocaleString()} / aid`}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* ── 7–9. Color / Battery / Receiver (standard plans only) ── */}
          {!isPrivateLabel && (<>

          {/* ── 7. Color ── */}
          {sd.techLevel && availColors.length > 0 && (
            <div className="field" style={{marginBottom:16}}><label>Color</label>
              <div className="color-swatches">
                {availColors.map(c=>(
                  <div key={c} className={`color-swatch ${sd.color===c?"active":""}`} onClick={()=>updSide(activeSide,"color",c)}>{c}</div>
                ))}
              </div>
            </div>
          )}


          {/* ── 8. Battery (multi-option only) ── */}
          {sd.techLevel && availBatteries.length > 1 && (
            <div className="field" style={{marginBottom:16}}><label>Battery Type</label>
              <div className="radio-group">
                {availBatteries.map(b=>(
                  <div key={b} className={`radio-pill ${sd.battery===b?"active":""}`} onClick={()=>updSide(activeSide,"battery",b)}>
                    <div className="radio-pill-label">{b}</div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* ── 9. Receiver + Dome (RIC only) ── */}
          {sd.style === "ric" && sd.techLevel && availPowers.length > 0 && (
            <>
              <div style={{height:1,background:"#f3f4f6",margin:"4px 0 16px"}} />
              <div className="field-grid" style={{marginBottom:0}}>
                <div className="field"><label>Receiver Length</label>
                  <select value={sd.receiverLength} onChange={e=>updSide(activeSide,"receiverLength",e.target.value)}>
                    <option value="">Select…</option>
                    {RECEIVER_LENGTHS.map(l=><option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="field"><label>Receiver Power</label>
                  <select value={sd.receiverPower} onChange={e=>{
                    const pw=e.target.value;
                    updSide(activeSide,"receiverPower",pw);
                    if((RECEIVER_POWERS[sd.manufacturer]||[]).find(p=>p.id===pw)?.earmold) updSide(activeSide,"dome","");
                  }}>
                    <option value="">Select…</option>
                    {availPowers.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              {sd.receiverPower && (
                <div className="field" style={{marginBottom:0,marginTop:12}}>
                  {requiresEarmold ? (
                    <div style={{background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#854d0e",fontWeight:600}}>
                      🦻 Earmold required — dome selector not applicable for this receiver
                    </div>
                  ) : (
                    <><label>Dome Type</label>
                      <select value={sd.dome} onChange={e=>updSide(activeSide,"dome",e.target.value)}>
                        <option value="">Select…</option>
                        {availDomes.map(d=><option key={d}>{d}</option>)}
                      </select>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          </>)} {/* end color/battery/receiver standard-only block */}

          {/* ── Per-device pricing callout ── */}
          {form.tierPrice != null && isSideConfigured(activeSide) && (() => {
            const leftOk = isSideConfigured("left");
            const rightOk = isSideConfigured("right");
            const bothDone = leftOk && rightOk;
            const total = form.tierPrice * (bothDone ? 2 : 1);
            return (
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"12px 16px",marginTop:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div style={{fontSize:13,color:"#166534"}}>
                  <span style={{fontWeight:700}}>
                    {form.tier} · ${form.tierPrice.toLocaleString()} / aid
                  </span>
                  {bothDone && <span style={{color:"#16a34a",marginLeft:8}}>· Both ears configured</span>}
                </div>
                <div style={{fontWeight:800,fontSize:18,color:"#0a1628"}}>
                  {bothDone
                    ? <>${total.toLocaleString()} <span style={{fontSize:12,fontWeight:400,color:"#6b7280"}}>total (2 aids)</span></>
                    : <>${form.tierPrice.toLocaleString()} <span style={{fontSize:12,fontWeight:400,color:"#6b7280"}}>per aid</span></>
                  }
                </div>
              </div>
            );
          })()}

          {/* ── Side Action Buttons ── */}
          {isSideConfigured(activeSide) && (
            <div className="side-actions">
              <button className="side-action-btn" onClick={()=>{
                const src = form[activeSide];
                setForm(f=>({...f,[otherSide]:{...src}}));
                setActiveSide(otherSide);
              }}>
                {activeSide==="left" ? "Copy to Right Ear →" : "← Copy to Left Ear"}
              </button>
              {hasCROSVariant && (
                <button className="side-action-btn cros" onClick={()=>{
                  const src = form[activeSide];
                  const crosFam = catalog.find(e => e.id === src.familyId);
                  const crosVariant = crosFam?.variants.find(v=>v.toLowerCase().includes("cros")) || "CROS";
                  setForm(f=>({...f,[otherSide]:{
                    ...src,
                    variant: crosVariant,
                    receiverLength:"", receiverPower:"", dome:""
                  }}));
                  setActiveSide(otherSide);
                }}>
                  📡 Set {otherSide==="left"?"Left":"Right"} as CROS Transmitter
                </button>
              )}
            </div>
          )}
        </div>


        {/* ── Care Plan (insurance only) ── */}
        {form.payType === "insurance" && (
          <div className="card">
            <div className="card-title">Care Plan</div>
            <div className="plan-select-list">
              {CARE_PLANS.map(cp=>(
                <div key={cp.id} className={`plan-row ${form.carePlan===cp.id?"active":""}`} onClick={()=>upd("carePlan",cp.id)}>
                  <div className="plan-row-top">
                    <div className="plan-row-name">{cp.label}</div>
                    <div style={{fontWeight:700,color:"#0a1628"}}>{cp.price}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Total Investment Summary ── */}
            {form.carePlan && form.tierPrice != null && (() => {
              const leftOk  = isSideConfigured("left");
              const rightOk = isSideConfigured("right");
              const aidCount = (leftOk ? 1 : 0) + (rightOk ? 1 : 0);
              const aidTotal = form.tierPrice * aidCount;
              const carePlanObj = CARE_PLANS.find(c => c.id === form.carePlan);
              const cpCost = form.carePlan === "paygo" ? 0
                : form.carePlan === "punch" ? 575
                : 1250;
              const grandTotal = aidTotal + cpCost;
              return (
                <div style={{marginTop:20,borderTop:"2px solid #e5e7eb",paddingTop:16}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af",marginBottom:12}}>Total Patient Investment</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151"}}>
                      <span>Hearing aids ({aidCount} aid{aidCount!==1?"s":""} · {form.tier})</span>
                      <span style={{fontWeight:600}}>{aidTotal===0?"No Charge":`$${aidTotal.toLocaleString()}`}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151"}}>
                      <span>{carePlanObj?.label}</span>
                      <span style={{fontWeight:600}}>{cpCost===0?"Pay-as-you-go":`$${cpCost.toLocaleString()}`}</span>
                    </div>
                    <div style={{height:1,background:"#e5e7eb",margin:"4px 0"}} />
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <span style={{fontSize:14,fontWeight:700,color:"#0a1628"}}>Total</span>
                      <span style={{fontSize:26,fontWeight:800,color:"#0a1628"}}>
                        {grandTotal===0?"No Charge":`$${grandTotal.toLocaleString()}`}
                        {form.carePlan==="paygo" && <span style={{fontSize:12,fontWeight:400,color:"#9ca3af",marginLeft:6}}>+ $65/visit</span>}
                      </span>
                    </div>
                    {aidCount===1 && (
                      <div style={{fontSize:11,color:"#9ca3af",textAlign:"right"}}>One ear configured — configure second ear to update total</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </>
    );
    if (step === 4) return (
      <div className="card">
        <div className="card-title">{form.payType === "private" ? "Private Pay – Standard of Care" : "Insurance Plan Selection"}</div>
        {form.payType === "private" ? (
          <div style={{color:"#374151",fontSize:14,lineHeight:1.7}}>
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
        ) : (
          <>
            <div className="field-grid" style={{marginBottom:16}}>
              <div className="field"><label>Insurance Carrier</label>
                <select value={form.carrier} onChange={e=>{upd("carrier",e.target.value);upd("planGroup","");upd("tier","");upd("tierPrice",null);}}>
                  <option value="">Select carrier…</option>
                  {carriersForType.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {form.carrier && (
              <div className="plan-select-list">
                {plansForCarrier.map(plan => (
                  <div key={plan.planGroup} className={`plan-row ${form.planGroup===plan.planGroup?"active":""}`} onClick={()=>{upd("planGroup",plan.planGroup);upd("tpa",plan.tpa);upd("tier","");upd("tierPrice",null);}}>
                    <div className="plan-row-top">
                      <div>
                        <div className="plan-row-name">{plan.planGroup}</div>
                        <div className="plan-row-tpa">via {plan.tpa}</div>
                      </div>
                    </div>
                    {form.planGroup===plan.planGroup && (
                      <div className="tier-pills">
                        {plan.tiers.map(t=>(
                          <div key={t.label} className={`tier-pill ${form.tier===t.label?"active":""}`}
                            onClick={e=>{e.stopPropagation();upd("tier",t.label);upd("tierPrice",t.price);}}>
                            {t.label} · {t.price===0?"No Charge":`$${t.price.toLocaleString()}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
    if (step === 5) return (
      <div className="card">
        <div className="card-title">Schedule Appointments</div>
        <div className="field" style={{marginBottom:8}}><label>Fitting Date</label>
          <input type="date" value={form.fittingDate} onChange={e=>upd("fittingDate",e.target.value)} />
        </div>
        <div style={{height:1,background:"#f3f4f6",margin:"20px 0"}} />
        <div className="card-title" style={{fontSize:14}}>Additional Appointments</div>
        <div className="appt-list">
          {form.appointments.map((a,i)=>(
            <div className="appt-row" key={i}>
              <span>📅 {fmtDate(a.date)}</span>
              <span>· {a.type}</span>
              <button className="appt-del" onClick={()=>upd("appointments",form.appointments.filter((_,j)=>j!==i))}>×</button>
            </div>
          ))}
        </div>
        <div className="add-appt-row">
          <div className="field"><label>Date</label><input type="date" value={newApptDate} onChange={e=>setNewApptDate(e.target.value)} /></div>
          <div className="field"><label>Type</label>
            <select value={newApptType} onChange={e=>setNewApptType(e.target.value)}>
              {VISIT_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn-primary" style={{marginTop:22}} onClick={addAppt}>Add</button>
        </div>
        <div style={{marginTop:16}}>
          <div className="field"><label>Notes</label><textarea value={form.notes} onChange={e=>upd("notes",e.target.value)} rows={3} placeholder="Special considerations, hearing test results, etc." /></div>
        </div>
      </div>
    );
    if (step === 6) {
      const ReviewSide = ({side, label}) => {
        const d = form[side];
        const fam = catalog.find(e => e.id === d.familyId);
        if (!d.familyId) return (
          <div className="review-row"><span className="review-key">{label}</span><span className="review-val" style={{color:"#9ca3af"}}>Not configured</span></div>
        );
        const pwrLabel = (RECEIVER_POWERS[d.manufacturer]||[]).find(p=>p.id===d.receiverPower)?.label||"—";
        const isEm = (RECEIVER_POWERS[d.manufacturer]||[]).find(p=>p.id===d.receiverPower)?.earmold;
        return (
          <>
            <div className="review-row" style={{background:"#f8fafc",borderRadius:6,padding:"6px 10px",margin:"4px 0"}}>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>{label}</span>
            </div>
            {[
              [d.manufacturer,"Manufacturer"],
              [d.generation,"Platform"],
              [fam?.family||"","Model Family"],
              [d.variant||"—","Variant"],
              [d.techLevel,"Tech Level"],
              [d.color||"N/A","Color"],
              [d.battery||"N/A","Battery"],
              ...(d.style==="ric" ? [
                [d.receiverLength||"—","Receiver Length"],
                [pwrLabel,"Receiver Power"],
                [isEm?"Custom Earmold":(d.dome||"—"),"Dome / Coupling"],
              ] : []),
            ].map(([v,k])=>(
              <div className="review-row" key={k}><span className="review-key">{k}</span><span className="review-val">{v}</span></div>
            ))}
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
              [[form.carrier,"Carrier"],[form.planGroup,"Plan"],[form.tpa,"TPA"],[`${form.tier} · $${form.tierPrice?.toLocaleString()}/aid`,"Selected Tier"],[CARE_PLANS.find(c=>c.id===form.carePlan)?.label||"","Care Plan"]].map(([v,k])=>(
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
          <div className="review-section">
            <div className="review-label">Schedule</div>
            <div className="review-row"><span className="review-key">Fitting Date</span><span className="review-val">{fmtDate(form.fittingDate)}</span></div>
            <div className="review-row"><span className="review-key">Additional Appointments</span><span className="review-val">{form.appointments.length}</span></div>
          </div>
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
            <div className="topbar-sub">Patient ID: {p.id} · {p.location} · Added {fmtDate(p.createdAt)}</div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button className="btn-ghost" onClick={()=>setView("dashboard")}>← Back</button>
          </div>
        </div>
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
            <div className="qr-id">{p.id}</div>
            <div className="qr-inst">Patient ID · Used to sync with app</div>
          </div>


          <div className="detail-grid">
            <div className="detail-card">
              <div className="detail-card-title">Contact Information</div>
              {[["Name",p.name],["Date of Birth",p.dob?fmtDate(p.dob):"—"],["Phone",p.phone||"—"],["Email",p.email||"—"]].map(([k,v])=>(
                <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v}</span></div>
              ))}
            </div>
            <div className="detail-card">
              <div className="detail-card-title">Coverage</div>
              {p.payType==="insurance" ? [
                ["Carrier",p.insurance?.carrier],["Plan",p.insurance?.planGroup],["TPA",p.insurance?.tpa],["Tier",p.insurance?.tier],["Copay",`$${p.insurance?.tierPrice?.toLocaleString()}/aid`]
              ].map(([k,v])=>(
                <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v||"—"}</span></div>
              )) : (
                <div className="detail-row"><span className="detail-key">Type</span><span className="detail-val">Private Pay – $5,500</span></div>
              )}
              {p.payType === "insurance" && <div className="detail-row"><span className="detail-key">Care Plan</span><span className="detail-val">{CARE_PLANS.find(c=>c.id===p.carePlan)?.label||"—"}</span></div>}
            </div>
            <div className="detail-card full">
              <div className="detail-card-title">Device Specifications</div>
              <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#9ca3af"}}>Fitting Type</span>
                <span style={{fontSize:12,fontWeight:700,color:"#0a1628",background:"#f3f4f6",borderRadius:6,padding:"2px 8px"}}>{p.devices?.fittingType||"Bilateral"}</span>
              </div>
              {[p.devices?.left, p.devices?.right].map((side, idx) => {
                const sideLabel = idx===0 ? "👂 Left Ear" : "Right Ear 👂";
                if (!side) return (
                  <div key={idx} style={{color:"#9ca3af",fontSize:13,padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>{sideLabel} — Not configured</div>
                );
                const pwrLabel = (RECEIVER_POWERS[side.manufacturer]||[]).find(pw=>pw.id===side.receiverPower)?.label || side.receiverPower;
                const isEm = (RECEIVER_POWERS[side.manufacturer]||[]).find(pw=>pw.id===side.receiverPower)?.earmold;
                return (
                  <div key={idx} style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:6,paddingBottom:4,borderBottom:"1px solid #e5e7eb"}}>{sideLabel}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
                      {[["Manufacturer",side.manufacturer],["Platform",side.generation||"—"],["Model Family",side.family||"—"],["Variant",side.variant||"—"],["Tech Level",side.techLevel||"—"],["Body Style",BODY_STYLES.find(s=>s.id===side.style)?.label||side.style],["Color",side.color||"N/A"],["Battery",side.battery||"—"],
                        ...(side.style==="ric" ? [["Receiver Length",side.receiverLength||"—"],["Receiver Power",pwrLabel||"—"],["Dome / Coupling",isEm?"Custom Earmold":(side.dome||"N/A")]] : []),
                      ].map(([k,v])=>(
                        <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val">{v||"—"}</span></div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div style={{borderTop:"1px solid #f3f4f6",paddingTop:12,display:"grid",gridTemplateColumns:"1fr 1fr"}}>
                {[["Serial (L)",p.devices?.serialLeft],["Serial (R)",p.devices?.serialRight],["Fitting Date",fmtDate(p.devices?.fittingDate||p.createdAt)],["Warranty Expires",fmtDate(p.devices?.warrantyExpiry)],["Warranty Status",days<0?"Expired":`${days} days remaining`]].map(([k,v])=>(
                  <div className="detail-row" key={k}><span className="detail-key">{k}</span><span className="detail-val" style={k==="Warranty Status"?{color:days<0?"#ef4444":days<90?"#f59e0b":"#16a34a"}:{}}>{v||"—"}</span></div>
                ))}
              </div>
            </div>
            {/* ── AUDIOGRAM & EDUCATION PANEL ── */}
            {p.audiology && (getPTA(p.audiology.rightT)!=null || getPTA(p.audiology.leftT)!=null || p.audiology.unaidedR!=null || p.audiology.sinBin!=null) && (() => {
              const aud = p.audiology;
              const sections = generateCounseling(aud);
              const rPTA = getPTA(aud.rightT);
              const lPTA = getPTA(aud.leftT);
              return (
                <>
                  {/* Audiogram display */}
                  <div className="detail-card full">
                    <div className="detail-card-title">Audiogram</div>
                    <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 8px",marginBottom:12}}>
                      <AudigramSVG rightT={aud.rightT||{}} leftT={aud.leftT||{}} interactive={false}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                      {rPTA!=null&&(
                        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px"}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#dc2626",marginBottom:3}}>Right PTA</div>
                          <div style={{fontSize:18,fontWeight:800,color:"#0a1628"}}>{rPTA} <span style={{fontSize:11,fontWeight:400,color:"#9ca3af"}}>dB HL</span></div>
                          <div style={{fontSize:11,color:"#dc2626",fontWeight:600,marginTop:2}}>{getDegreeName(rPTA)}</div>
                        </div>
                      )}
                      {lPTA!=null&&(
                        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"10px 14px"}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#2563eb",marginBottom:3}}>Left PTA</div>
                          <div style={{fontSize:18,fontWeight:800,color:"#0a1628"}}>{lPTA} <span style={{fontSize:11,fontWeight:400,color:"#9ca3af"}}>dB HL</span></div>
                          <div style={{fontSize:11,color:"#2563eb",fontWeight:600,marginTop:2}}>{getDegreeName(lPTA)}</div>
                        </div>
                      )}
                      {(aud.unaidedR!=null||aud.unaidedL!=null)&&(
                        <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px"}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:3}}>CCT Unaided</div>
                          {aud.unaidedR!=null&&<div style={{fontSize:12,color:"#0a1628",fontWeight:600}}>R: {aud.unaidedR}%</div>}
                          {aud.unaidedL!=null&&<div style={{fontSize:12,color:"#0a1628",fontWeight:600}}>L: {aud.unaidedL}%</div>}
                        </div>
                      )}
                      {aud.sinBin!=null&&(
                        <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"10px 14px"}}>
                          <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"#6b7280",marginBottom:3}}>QuickSIN SNR Loss</div>
                          <div style={{fontSize:18,fontWeight:800,color:"#0a1628"}}>{aud.sinBin} <span style={{fontSize:11,fontWeight:400,color:"#9ca3af"}}>dB</span></div>
                          <div style={{fontSize:11,fontWeight:600,marginTop:2,
                            color:aud.sinBin<=2?"#16a34a":aud.sinBin<=7?"#ca8a04":aud.sinBin<=15?"#ea580c":"#dc2626"}}>
                            {aud.sinBin<=2?"Near-normal":aud.sinBin<=7?"Mild":aud.sinBin<=15?"Moderate":"Severe"} difficulty in noise
                          </div>
                        </div>
                      )}
                    </div>
                  </div>


                  {/* Patient education narrative */}
                  {sections&&sections.length>0&&(
                    <div className="detail-card full">
                      <div className="detail-card-title" style={{marginBottom:4}}>Patient Counseling Guide</div>
                      <div style={{fontSize:11,color:"#9ca3af",marginBottom:18}}>
                        Generated from test results · Use as a conversation guide during the appointment
                      </div>
                      {sections.map((s,i)=>(
                        <div key={i} style={{marginBottom:i<sections.length-1?20:0,paddingBottom:i<sections.length-1?20:0,borderBottom:i<sections.length-1?"1px solid #f3f4f6":"none"}}>
                          <div style={{fontSize:12,fontWeight:700,color:"#0a1628",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:16}}>{["🎯","💬","✅","🔊"][i]}</span>
                            {s.heading}
                          </div>
                          <div style={{fontSize:13,color:"#374151",lineHeight:1.75}}>{s.body}</div>
                        </div>
                      ))}


                      {/* Research highlights — positive outcomes framing */}
                      <div style={{marginTop:24,background:"linear-gradient(135deg,#f0fdf4,#f0f9ff)",border:"1px solid #d1fae5",borderRadius:12,padding:"18px 20px"}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"#059669",marginBottom:14}}>
                          📚 Why Treatment Matters — Evidence Summary
                        </div>
                        {[
                          {icon:"🧠", title:"Cognitive load", body:"Untreated hearing loss forces the brain to devote extra resources to decoding sound — leaving less capacity for memory, comprehension, and attention. Hearing aids reduce this processing burden significantly. Studies consistently show improved working memory performance in consistent aid users."},
                          {icon:"😴", title:"Fatigue & quality of life", body:"Listening fatigue is real and measurable. Patients with treated hearing loss report substantially lower rates of social withdrawal, depression, and daily exhaustion. The effort of following conversation in noise is genuinely tiring — correcting the input changes that equation."},
                          {icon:"🗣️", title:"Relationships & connection", body:"Communication difficulty strains relationships in ways patients often don't articulate directly. Spouses and family members frequently report more satisfaction and less frustration after treatment begins. This is often the most immediate and tangible benefit."},
                          {icon:"🔈", title:"Auditory plasticity", body:"The auditory system adapts to deprivation over time — pathways that go unstimulated become less efficient. Early treatment preserves those pathways. This is why fitting sooner rather than later produces better long-term outcomes, even when patients feel they're 'managing fine.'"},
                        ].map(r=>(
                          <div key={r.title} style={{display:"flex",gap:12,marginBottom:14,paddingBottom:14,borderBottom:"1px solid rgba(0,0,0,0.05)"}}>
                            <span style={{fontSize:20,flexShrink:0}}>{r.icon}</span>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:"#0a1628",marginBottom:4}}>{r.title}</div>
                              <div style={{fontSize:12,color:"#374151",lineHeight:1.65}}>{r.body}</div>
                            </div>
                          </div>
                        ))}
                        <div style={{fontSize:11,color:"#9ca3af",marginTop:4,fontStyle:"italic"}}>
                          Sources: Hearing Health Foundation, JAMA; Journal of the American Academy of Audiology; The Lancet Commission on Dementia Prevention
                        </div>
                      </div>
                    </div>
                  )}
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
            {[["🏠","Dashboard","dashboard"],["👥","Patients","patients"],["📅","Schedule","schedule"],["📊","Reports","reports"],["📋","Product Catalog","catalog"],["⚙️","Settings","settings"]].map(([icon,label,id])=>(
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
                  <div className="wizard-nav">
                    <button className="btn-ghost" onClick={()=>step===0?setView("dashboard"):setStep(s=>s-1)}>
                      {step===0?"Cancel":"← Back"}
                    </button>
                    {step < STEPS.length-1 ? (
                      <button className="btn-primary" disabled={!canProceed} style={{opacity:canProceed?1:0.4}} onClick={()=>setStep(s=>s+1)}>
                        Continue →
                      </button>
                    ) : (
                      <button className="btn-primary green" onClick={handleSave}>
                        ✓ Create Patient Profile
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}