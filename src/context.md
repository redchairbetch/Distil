# Distil — Project Context Brief
*Paste this at the top of every new Claude chat session*

---

## Who I Am
Kurt — hearing care specialist, affiliated with My Hearing Centers (a WSAudiology/WSA subsidiary). Self-described new developer. I value directness over encouragement. Be opinionated. Explain reasoning before writing code. Ask clarifying questions before large tasks.

---

## The Projects

### Distil
Provider-facing React CRM for hearing instrument specialists.
- Patient intake, audiometric testing, device selection, insurance plan management, care plan pricing
- Built for My Hearing Centers / WSAudiology ecosystem initially
- Strategic path: pitch as licensed enterprise tool to MHC corporate

### Aided
Companion patient-facing app.
- Longitudinal hearing profile tracking
- Appointment management (reschedule *requests* routed to staff — NOT direct calendar access)
- Year-over-year audiogram comparisons
- Eventually: push notifications, educational content, video exchange for donation program

---

## Tech Stack
- **Frontend**: React, Vite, JSX (single large component file `Distil.jsx`)
- **Backend**: Supabase (Postgres + Realtime), `db.js` data layer
- **Deployment**: Vercel (`vercel.json` rewrite rule required for SPA routing on `/intake`)
- **Version control**: GitHub Desktop, repo `redchairbetch/Distil` (main branch)
- **Live URLs**: `distil-lime.vercel.app` (CRM), `distil-lime.vercel.app/intake` (IntakeKiosk)

---

## Current State
- `Distil.jsx` migrated from `window.storage` to Supabase
- `Login.jsx` passes `staffId` and `clinicId` as props to `ProviderCRM`
- `db.js` data layer intact
- TruHearing Select catalog: 11 granular entries, five-step cascade UI (tier → product/power → Li-Ion upcharge → variant → CROS toggle)
- Real insurance plan data integrated: ~60 TruHearing Third Party Exclusive Plans, 22 UHCH plan groups
- Warranty countdown widget: color-coded progress bar (red <90d, yellow <360d, green 360d+)
- Calendar feature: **deliberately dropped** — clinics have existing scheduling tools; Distil adds a simple `next_appointment_date` field only

---

## Critical Architecture Rules
- **Plan tier ≠ device generation**: Standard/Advanced/Premium are pricing sophistication labels. Device generation (X/AX/IX) is derived from TH series selection. Conflating these caused a major architectural bug previously.
- **Supabase migration is fragile**: Verify correct file version before every edit. Git discipline critical.
- **TH5 BTE**: Always available regardless of plan tier
- **312-powered RICs**: Uncommon on TruHearing plans, mostly Standard tier
- **Beltone**: Requires proprietary software authorization we don't have — use Rexton-only designation
- **Normal hearing threshold**: 20 dB (not 25 dB)
- **Audiogram counseling language**: Avoid percentage improvement framing; focus on aided word recognition score and treatment implications
- **Intake IDs**: Format `MHC-YYYYMMDD-XXXXX`
- **HIPAA consent**: Verbatim MHC legal language, scroll-to-bottom gating
- **"Neurotechnology" is trademarked** — owned by former Intermountain Audiology. Never use in app copy or patient-facing UI. Use "devices" instead.
- **"Trial" and "demo" are banned** — use "adaptation period" and "evaluation."

---

## Editing Workflow
1. Kurt uploads current `Distil.jsx`
2. Claude copies to `/home/claude/Distil.jsx` as working file
3. All edits use Python `str_replace` via bash heredoc (NOT the str_replace tool — fails on JSX escaped quotes)
4. Run verification greps after every significant edit
5. Run bracket balance check before finalizing
6. Copy to `/mnt/user-data/outputs/Distil.jsx` only after verification passes
7. Kurt downloads → replaces in local `src/` → commit/push via GitHub Desktop → Vercel auto-deploys (~60s)
8. Start new chat proactively when context window approaches limit

---

## Helper Functions (Insurance Plans)
- `signiaLevelToTier`
- `getPlanPriceForTech`
- `getPlanAllowedMfrs`
- `getProductTypeLabel`
- `resolveActivePlan`

---

## Narrative Thread — UX Architecture

The patient education / device selection / care plan flow is structured as five sequential chapters. Each chapter opens with a one-line carry-forward from the previous, keeping the patient's story continuous from intake through close. The intake kiosk pre-loads Chapter 1 before the provider enters the room.

| Chapter | Moment | Thread contribution |
|---|---|---|
| 1 — Patient story | Intake kiosk | Chief complaint · motivation score · soft commitment status |
| 2 — Evidence | Post-testing | Diagnosis · WR gap · SNR loss · auto-mapped to stated complaints |
| 3 — Recommendation | Device selection | Device rec · lifestyle rationale · insurance applied · patient cost only |
| 4 — Investment | Care plan selection | Selected care plan · total investment · Complete Care+ pre-selected by default |
| 5 — Commitment | Close | Treatment plan document · adaptation notes · provider checklist · day-2 call prompt |

**Key design rules:**
- Patient cost shown first, always. Retail price shown as "full retail value" for anchoring only.
- Never show retail price without the insurance savings alongside it.
- Care plan default = Complete Care+ (opt-out, not opt-in).
- Provider-facing "prompter" sidebar shows talking points, soft commitment status, and close-readiness signal derived from motivation score + WR gap + severity.
- The complaint carry-forward quote (patient's own words from intake) appears at the top of the pricing reveal.

---

## Pricing Reveal — Data Model

### New table: `clinic_retail_anchors`
Stores the clinic's private-pay retail anchor prices by technology tier. Editable from clinic settings.

```
id            text        PK (composite with clinic_id) — slug: 'select' | 'advanced' | 'standard' | 'level2' | 'level1'
clinic_id     uuid        FK → clinics.id
label         text        Patient-facing label (never "Premium")
price_per_aid numeric     Clinic's full retail price per aid
sort_order    integer
updated_at    timestamptz
```

**Seeded values (clinic ae14da3e):**

| id | label | price/aid |
|---|---|---|
| `select` | Select | $3,997.50 |
| `advanced` | Advanced | $3,497.50 |
| `standard` | Standard | $2,997.50 |
| `level2` | Level 2 | $2,497.50 |
| `level1` | Level 1 | $1,997.50 |

### New column: `insurance_plans.retail_anchor_key`
Text slug linking each plan tier row to a `clinic_retail_anchors` entry.

**Mapping logic (all 295 rows populated):**

| tier_label in insurance_plans | → retail_anchor_key |
|---|---|
| Premium, Level 7 | `select` |
| Advanced, Level 5 | `advanced` |
| Standard, Level 3 | `standard` |
| Level 2 | `level2` |
| Level 1 | `level1` |

### New column: `insurance_coverage.insurance_plan_id`
UUID FK → `insurance_plans.id`. Links a patient's coverage record to a specific plan row. Currently NULL on existing rows — must be populated when a patient's plan is selected in the UI.

### `db.js` function: `loadPricingReveal(clinicId, patientId)`
Ready to add — not yet in codebase.

```javascript
export async function loadPricingReveal(clinicId, patientId) {
  const { data, error } = await supabase
    .from('insurance_coverage')
    .select(`
      tier_price_per_aid,
      tier,
      insurance_plan_id,
      insurance_plans (
        tier_label,
        retail_anchor_key
      )
    `)
    .eq('patient_id', patientId)
    .eq('active', true)
    .single();

  if (error || !data) return null;

  const anchorKey = data.insurance_plans?.retail_anchor_key;
  if (!anchorKey) return null;

  const { data: anchor } = await supabase
    .from('clinic_retail_anchors')
    .select('label, price_per_aid')
    .eq('id', anchorKey)
    .eq('clinic_id', clinicId)
    .single();

  if (!anchor) return null;

  const retailPerAid  = parseFloat(anchor.price_per_aid);
  const copayPerAid   = data.tier_price_per_aid;
  const savingsPerAid = retailPerAid - copayPerAid;
  const savingsPct    = Math.round((savingsPerAid / retailPerAid) * 100);

  return {
    tierLabel:    anchor.label,
    retailPerAid,
    copayPerAid,
    savingsPerAid,
    savingsPct
  };
}
```

**Coding session TODO for pricing reveal:**
1. Add `loadPricingReveal()` to `db.js`
2. Wire `insurance_coverage.insurance_plan_id` FK write when patient plan is selected in UI
3. Build `PricingReveal` component in Chapter 3 of narrative thread using output of `loadPricingReveal()`
4. Component shows: full retail value · plan covers amount · your investment (pair default, per-aid toggle) · savings badge ($ + %)

---

## Active Feature Backlog (Priority Order)

### Distil
1. ~~Warranty color threshold~~ ✅ DONE (red <90d, yellow <360d, green 360d+)
2. ~~Follow-up queue~~ ✅ DONE — dedicated view in `views/FollowUpQueue.jsx` with four priority buckets (warranty expiring <90d · off warranty no upgrade · fit no return · stale visit). Sidebar nav badge shows count.
3. ~~Fields `last_visit_date`, `follow_up_contacted`~~ ✅ DONE — `patients.last_visit_date` mirrored from `savePunch` appointment entries; `follow_up_status`/`follow_up_contacted_date`/`follow_up_notes` already existed and are now wired.
4. L&D tracking: **not a separate benefit** — covered under warranty; warranty widget handles it
5. Regimented care calendar: full 4–5 year appointment arc scheduled at fitting
6. ~~Upgrade tracking fields~~ ✅ DONE — `care_plan_start_date` (auto-stamped at finalize from fittingDate), `upgrade_tier_offered`, `upgrade_outcome`, `donation_recipient` on `patients`. UI in patient-detail "Upgrade Tracking" card; setting any outcome removes the patient from the follow-up queue's off-warranty bucket.
7. Insurance Plans management screen (deferred pending Supabase migration testing)
8. **Narrative Thread UX** — five-chapter patient education / device selection / close flow. **PR 1 ✅ DONE** — `ChapterIntro` overlay fired between wizard step transitions; **removed after field testing (see #22)**. The lasting PR 1 contribution: Chapter 1 captures provider-assessed `motivation_score` (1-10) and `soft_commitment` (high|medium|low|unknown) on `intakes` (migration `007_add_intake_assessment_fields.sql`), surfaced via the new "Provider Assessment" section in `HealthHistory.jsx` and read by `loadPersonalizationInputs`. **PR 2 ✅ DONE** — provider "prompter" sidebar (`src/components/PrompterSidebar.jsx`): toggleable right drawer (open by default, vertical handle on right edge) showing chapter-keyed talking points (static `PROMPTER_CONTENT` with `base` + conditional points filtered by motivation/soft-commit/severity/WR-gap context), soft-commitment badge, and a 3-state close-readiness pill (Close-ready / Warming up / Not yet) computed from motivation + WR gap + severity with a one-line rationale. Provider-only; no DB changes. **PR 3 (pending)**: Chapter 5 deliverables — re-label step 7 as "Commitment", insert day-2 follow-up `appointments` row at finalize, render provider checklist (no new PDF, no new schema for adaptation notes — use existing `notes`).
9. ~~Pricing Reveal component~~ ✅ DONE — `loadPricingReveal()` in `db.js`, wired in `views/DeviceSelection.jsx` and `Distil.jsx`.
10. **Referral pipeline — name the referrer** — intake kiosk "Friend or family referral" should reveal a text box for the referrer's name so the clinic can close the loop (thank-you card, referral credit, cross-reference to the existing patient record). Low-priority polish; revisit when fleshing out the referral pipeline.
11. **Branding / logo for Distil** — current favicon is a generic 🩺 emoji. Need a real wordmark/icon for the provider CRM. Tie to a brand system that also covers Aided and (eventually) Lima Charlie.
12. **Text-selectable kiosk intake PDF** — current archive uses `jsPDF.html()` (html2canvas under the hood) which produces an image-based PDF: visually identical to the printable HTML and legally fine for compliance, but not text-searchable. Build a parallel jsPDF generator that lays out the intake fields directly (similar to `generatePurchaseAgreement.js`) so the archived signed-intake PDFs are searchable, smaller, and copy-pasteable. Replace the `htmlToPdfBlob()` helper in `IntakeKiosk.jsx` with the new generator once it's ready. **Note (2026-05-14)**: visual layout overhaul (3-col patient info / 2-col medical+hearing history / 1-col consent + signature, real logo header, autoPaging fix) landed separately — current PDF is image-based but now professionally laid out. This item remains specifically for the text-searchable conversion.
13. ~~`linkIntakeToPatient` same-clinic enforcement~~ ✅ DONE — both updates now constrained by `clinic_id`; callers pass clinicId explicitly.
14. ~~Document signed-URL refresh on click~~ ✅ DONE — Documents card re-signs via `getDocumentSignedUrl` if cached URL is older than 50 minutes.
15. **Orphan storage sweeper for failed kiosk archives** — `uploadPatientDocument`'s table-insert failure path tries `storage.remove([storagePath])` but anon has no DELETE policy, so kiosk-side orphans silently pile up. Need a periodic sweep (edge function or pg_cron) that lists `storage.objects` under `clinics/*/intakes/*/` and deletes any object with no matching `patient_documents` row. Low impact today (kiosk archive itself is best-effort), but worth a janitor pass quarterly.
12. ~~**Audit `clinic_retail_anchors` 'standard' rows**~~ ✅ SUPERSEDED by PR #81 — standard-class rows are confirmed live as the manufacturer-agnostic baseline for private-pay (bootstrap loads both `'signia'` for insurance flows and `'standard'` for private-pay; `TierSelection` + `pricingRevealData` branch on `payType` accordingly). Top-tier label normalized from `"Select"` to `"Premium"` via migration `rename_select_tier_label_to_premium` so private-pay vocabulary matches TruHearing's Premium / Advanced / Standard / Level 2 / Level 1. No longer a hygiene question — the standard rows are the answer.
13. ~~**Private-pay quote: bundled care plan + tier-aware pricing**~~ ✅ DONE — `generateQuote.js` and `generatePurchaseAgreement.js` switch the care plan section to "INCLUDED CARE PLAN" when `payType === "private"`, render Complete Care+ as a zero-charge line ("Bundled with your device purchase — no separate charge"), and stop double-counting in totals. Wizard quote/PA handlers feed `form.tierPrice` (set by `TierSelection` from `clinic_retail_anchors`). The private-pay tier + per-aid price are now persisted on `patients.private_pay_tier` / `patients.private_pay_price_per_aid` (migration `006_add_private_pay_pricing.sql`), surfaced as `p.privatePay` in `assemblePatient`, written by `createPatientDraft` / `savePatient` / `finalizePatient`, and read by both patient-list handlers. Legacy private-pay records (pre-migration) fall back to $2,750.
16. **Device Selection & Pricing Screen v1 — full spec build** — five-zone patient-facing screen (clinical context strip · recommendation + provider-editable rationale · within-family tier comparison · expandable detail panels for specs/what's-included/cross-mfr comparison/fit confirmation · purchase configuration + pricing). Recommendation engine inverts industry default — top tier is the starting point, the engine computes a down-tier justification score (0–4 / 5–8 / 9+) from audiometric + intake signals; rationale generated per-patient and provider-editable. Includes conditional "Available Rebates" panel (seasonal promo / mfr rebate / qualifying program), formal price-adjustment authorization modal with reason codes + manager-auth threshold + audit log, bundled/unbundled Complete Care+ purchase model with clinic-level default, payment options section with deferred-interest + equal-pay calculators (Allegro / CareCredit / HealthiPlan; Allegro down-payment shown as a separate line), provider adjustment-history reflection view, and three intake verbiage refinements (`hear`→`understand` in noisy-places, `sometimes`→`often` in speech-in-noise, split occupational vs recreational noise exposure). New schema: `device_catalog`, `cross_manufacturer_equivalence`, `rebate_promo`, `price_adjustment_log`, `purchase_configuration`, `purchase_line_item`, `clinic_settings` additions (`default_bundle_mode`, `override_manager_auth_threshold_percent`, `financing_partners`). Full spec lives at `OneDrive\Borderline Artistic\Distil\Distil.md` (v1.2, 2026-04-21). Multi-PR initiative — sequence per spec §12. Open dependencies: pricing-source-of-truth audit, intake→engine data pipeline, CC+ SKU structure, cross-mfr equivalence table population, financing partner URLs, adjustment-history view placement. v2 parks: provider-default-price, automated catalog sync, richer lifestyle modeling, discount analytics dashboards.
17. **Catalog editor in Distil (insurance plans + retail anchors)** — Full CRUD (create / read / update / delete) UI in Settings for both `insurance_plans` (carrier × plan group × TPA × tier × allowance/copay) and `clinic_retail_anchors` (per-aid retail by tier, per manufacturer class). Retail anchors editor partially exists today; insurance plans is read-only. Include clinic-level override capability so a clinic can deviate from the corporate-default insurance row without forking the table (likely a separate `clinic_insurance_plan_overrides` table joined on plan id + clinic id, or a nullable `clinic_id` on the main row with a fallback resolver). Provider-facing in Settings → Catalog for now; gate behind an admin role in a later pass — MHC corporate will want pricing changes out of provider hands long-term. Open questions: schema shape for overrides, audit log requirements (who changed what, when), whether providers can add brand-new carriers/plans or only edit existing ones, how to surface "this row is overridden at clinic level" vs. corporate default in the UI. Universalize tier label vocabulary as part of this work — Premium / Advanced / Standard / Level 2 / Level 1 across all manufacturer classes, with manufacturer-specific generations (Signia 7 IX, Phonak Infinio 90, Starkey Evolv AI 2400) as device-level metadata that maps to the universal tier rather than being the tier label itself.
18. ~~**Manufacturer- and tech-level-aware pricing on device-selection screen**~~ ✅ DONE — shipped by PR #82 (this entry predated it); audited & verified 2026-05-16. `deriveEarPrice` resolves each ear from manufacturer class × tech-level rank against `clinic_retail_anchors`; the `baseline` useEffect re-resolves `form.tierPrice` on device pick (private-pay); `pricingRevealData` + `handleGenerateQuote` carry per-ear prices through to the quote. Verified end-to-end: private-pay Signia 5IX → $3,497.50 (Signia rank-4 anchor), not the standard $4,997.50. Insurance stays manufacturer-agnostic by design (carrier copay). Step-4 tier cards show no price, so the open (c) UX question is moot. The only real remaining gap was #19's data.
19. ~~**Catalog tech-level completeness audit**~~ ✅ DONE — migration `010_sync_catalog_tech_levels.sql`. Root cause: migration 008 added the 2IX/1IX `product_catalog_tier` pricing rows but never updated `product_catalog.tech_levels` (the column that drives the device-selection cascade). Fixed: 7 Signia IX families (Insio IX CIC/IIC/ITC/ITE, Motion/Pure/Styletto IX) extended to the full 7/5/3/2/1 ladder; Oticon Real's phantom tier "4" dropped (3-tier line, no pricing row); stale catalog-editor stub "Pure Charge & Go UX" deactivated (no pricing rows, zero `device_sides` references). Audit confirmed the 4-tier classes (Phonak/Starkey/Widex/ReSound/Rexton) are genuinely complete and `clinic_retail_anchors` has matching rows for every manufacturer class. Note: `CATALOG_DEFAULT` in `Distil.jsx` is a fallback only — the live catalog loads from the DB — and its IX arrays are already 5-tier.
20. **Manufacturer logo standardization for legibility** — The manufacturer card row on the device-selection screen renders each brand's native logo at native aspect ratio, which means some are wordmarks (oticon, widex, phonak), some are stylized marks (Signia's red dot, Rexton's dark badge), and the visual weight is wildly inconsistent — several are nearly illegible at the card size used in clinic. Options: (a) commission a unified-style icon set (slower, design ask), (b) generate consistent monochrome SVG wordmarks (fast, less branded), (c) enforce a fixed bounding box per logo with padding rules so each brand's mark fills the same visual footprint without being shrunk to illegibility (middle ground). Lowest-effort path is probably (c) plus a one-pass touch-up on the worst offenders. Coordinate with the Aided branding work (#11 in the Aided section) so manufacturer logos read consistently across both apps if Aided ever surfaces them.
21. ~~**Defer tier price display until full device selection**~~ ✅ DONE — step-5 Pricing Reveal now gated on at least one ear being fully configured (`leftConfigured || rightConfigured` via `isSideConfigured`); a "Select a device to see your investment" placeholder shows until then, so the bare tier baseline no longer surfaces pre-device. Bug (b) (Premium → `$4,497.50`) was **already resolved** — the `standard`-class `clinic_retail_anchors` are correct (Premium = `$4,997.50`, matched by label in `pricingRevealData`) and the recommendation engine emits the same sparse 5/3/1 rank scale as `tierLabelToRank`, so there is no live tier→rank mismap. The 2026-05-12 symptom was a data-state artifact resolved by the `rename_select_tier_label_to_premium` migration / PR #81.
22. ~~**Remove `ChapterIntro` overlay pop-ups from Narrative Thread**~~ ✅ DONE — deleted `src/components/ChapterIntro.jsx`, its import, the overlay render block, and the `chaptersSeen` state + its two resets. Kept PR 1's intake `motivation_score`/`soft_commitment` fields and PR 2's Prompter Sidebar; `STEP_TO_CHAPTER`/`CHAPTER_TITLES` retained — they key the sidebar to the current chapter. Narrative Thread chapter structure can now be re-evaluated without the per-chapter intro overlay.
23. **Upgrade Patient Journey (established-patient flow)** — Today the only path through the wizard is the new-patient flow: every field from name to insurance to audiogram entered from scratch. Established patients returning for a follow-up visit or upgrade conversation get force-marched through the same 8-step form even though most of the patient-info fields haven't changed. Need a dedicated established-patient flow that:
    - **Quick-confirm of stable fields**: opens with a "Is this information still correct?" review card showing DOB, address, phone, email, emergency contact, PCP, referrer, insurance carrier — patient/provider taps a single "Yes, all correct" affirmation or selects individual fields to edit. Mirrors the kiosk intake structure but folded into a confirm-don't-retype UX. Stable answers from the original intake (medical history Y/N panel, occupational/recreational noise, family history) presented the same way — "Anything changed since last visit?" with per-question opt-in to revise.
    - **Weighted upgrade-readiness questionnaire**: a new short questionnaire tuned to upgrade readiness rather than first-fit motivation. Score weighted across: years since last fitting, self-reported satisfaction with current aids (1–10), specific listening environments where they're struggling now that weren't an issue at fit, anticipated lifestyle changes (retirement, grandchildren, travel), feature-gap awareness (rechargeability, streaming, hands-free calls, fall detection, etc.), warranty/L&D status, financial readiness (insurance benefit cycle, HSA balance). Roll up to a 1–5 upgrade-readiness band that drives the consultation framing.
    - **Current-aid performance level assessment**: provider-side intake captures objective measures of how the current aids are performing — REM-aided WRS or speech-in-noise vs. unaided baseline, real-world satisfaction tags (`feedback`, `low-volume`, `streaming-fails`, `won't-charge`, etc.), care plan utilization (cleanings logged, drop-offs for service). Outputs a "current aid performance" tier (Excellent / Adequate / Marginal / Failing) that pairs with upgrade-readiness for the recommendation logic.
    - **5-year hearing-journey infographic integration**: the care-plan selection screen already displays a multi-year hearing-journey infographic. In the upgrade flow, the infographic is anchored at the patient's actual timeline position (e.g. "Year 3.5 of your current aids") with performance level overlaid so the patient sees where they are vs. where the journey predicts they'd be. Becomes the visual centerpiece of the upgrade consultation instead of the new-patient pricing reveal.
    - **Consultation flow redesign**: skip the first-fit narrative (chief complaint, motivation, soft commitment — all already known). Lead with timeline + current performance, then frame the choice as reprogramming vs. upgrading. Care plan / pricing comes at the end if upgrade is chosen, sourced from the same `clinic_retail_anchors` infrastructure.
    - **Reprogramming-vs-upgrading decision logic**: once a patient has a baseline audiogram on file from the original fit + a new audiogram from this visit, the delta (PTA shift, WRS change, SNR loss progression) feeds a decision-aid score. Small delta + adequate current performance → reprogramming recommended; large delta or marginal current performance → upgrade recommended; in-between → provider judgment with both paths presented. Surfaces alongside the consultation infographic.
    - **Entry points**: the "Start a New Visit" button in the patient profile header (shipped separately) drops the clinician into this flow when the patient already has a saved fitting. New patients keep the existing 8-step wizard. May need a "Visit type" selector at flow entry (annual check / upgrade conversation / device evaluation / fit follow-up) that picks which subset of the established-patient flow renders.
    - **Open questions**: where does the established-patient flow live — same wizard with conditional steps, or a parallel `views/UpgradeWizard.jsx`? How does the reprogramming-vs-upgrade decision interact with the existing recommendation engine (which is tuned for first-fit)? Should the upgrade-readiness questionnaire be patient-facing (kiosk-style intake before the appointment) or provider-administered during the visit, or both? Ties to backlog #5 (regimented care calendar — the 4–5 year arc this flow sits inside), #8 (Narrative Thread — needs a separate established-patient narrative), and the existing `upgrade_tier_offered` / `upgrade_outcome` fields on `patients` (#6, already shipped).

24. **Audiogram speech banana — missing "T" + unmapped legend** — The speech-banana overlay on the audiogram is missing the "T" speech sound, and "T" isn't mapped to the example sentence shown beneath the audiogram. Add the "T" marker at its correct frequency/intensity position and wire it into the letter→sentence mapping.
25. **Carry the listening-environment tier comparison onto the device-selection screen** — Part of the Device Selection v1 build (see #16). Wizard step 4 (Technology Tier, `views/TierSelection.jsx`) shows a rich per-tier "All Listening Environments" performance comparison — color-coded bars per environment. The device-selection screen (`views/DeviceSelection.jsx`) lets the patient re-select a tier and shows per-tier pricing + the starred recommendation, but lacks that environment frame-of-reference; and because the tier chosen on the Technology Tier step isn't locked, the patient can change it here. When a tech level is selected on the device-selection screen, surface the same environment-performance comparison so the patient sees environment performance next to price and the recommendation. Reuse the environment data from `TierSelection.jsx`. Lands with the Zone 4 detail-panels PR.

26. **Care Plan wizard step — scroll to top on entry** — Advancing to the Care Plan step lands the page scrolled partway down, hiding the selected devices and most of the "Your Hearing Journey" infographic. Scroll the step to the top on entry so the patient sees it from the devices down (wizard step 6, `Distil.jsx`). Related: the green→yellow→orange→red gradient for that infographic is backlog #17.
27. **Private pay — generate purchase agreement + quote on the device-selection screen** — Insurance patients can generate a purchase agreement and a quote from the device-selection screen; private-pay patients can't. Add the same two actions for private pay, plus a short "Complete Care+ included" blurb (private-pay CC+ is bundled — see #13). `generateQuote.js` / `generatePurchaseAgreement.js` already handle `payType === 'private'`, so this is mainly surfacing the actions in the UI. Confirm the target screen when picked up — the wizard's step-5 "Treatment Options" vs. `views/DeviceSelection.jsx`.

28. **Rexton platform/generations are wrong on the device-selection screen** — Rexton's catalog rows carry Signia's generation codes instead of Rexton's own platform branding, and the tier ladder looks truncated. Live `product_catalog` (project `gznvccnxlsbnvsunoxna`, verified 2026-05-19) has exactly two Rexton rows: `rex-reach-plus` (`generation:"IX"`, `tech_levels:["80","60","40"]`) and `rex-bicore` (`generation:"AX"`, `tech_levels:["80","60","40","20"]`), both `styles:["ric"]`. Two distinct problems: **(a)** the `generation` field holds Signia's `IX`/`AX` codes, not Rexton's platform names (Reach / BiCore), so the cascade surfaces Signia branding under Rexton; **(b)** the newer Reach Plus (IX-era, "sister product to Signia Pure BCT IX," launched Oct 2025) exposes only 3 tech levels while the *older* BiCore exposes 4 — and every Signia IX family carries the full 5-tier ladder — so Reach Plus's ladder is almost certainly truncated. Rexton's numeric `80/60/40` vocabulary is also entirely distinct from Signia's `7IX/5IX/3IX/2IX/1IX`; confirm it resolves cleanly against the universal tier ranks used by `deriveEarPrice` / `tierLabelToRank` (#18, #21) and the recommendation engine. `CATALOG_DEFAULT` (`Distil.jsx:633-646`) mirrors the DB exactly and must be kept in sync — it is a fallback only; the live screen reads the DB (#19). **Caveat:** `getDomeOptions()` (`Distil.jsx:944`) keys on `generation ∈ {"AX","IX"}` (`SIGNIA_GEN3_PLATFORMS`) to pick the Gen-3 dome set for Signia/Rexton/TruHearing, so `generation` doubles as a dome-resolution key — relabelling Rexton's generation for display would break dome resolution unless `getDomeOptions` is updated too or a separate display field is added. Action: confirm Rexton's actual platform names + per-platform tier ladders with Kurt, then sync `product_catalog` + `CATALOG_DEFAULT`.

29. **Signia Active Pro instant-fit schema fix + new "IF" body-style category** — Signia Active Pro is an instant-fit device (no receivers, no domes) but is mis-configured as a RIC, so the device-selection flow wrongly forces receiver-power + dome selection for it.
    - **The bug:** live `product_catalog` row `sig-active-ix` ("Active IX / Active Pro IX") has `styles:["ric"]`. RIC is the only `BODY_STYLES` entry flagged `hasReceiver:true` (`Distil.jsx:204`), which is what surfaces the receiver-power (`RECEIVER_POWERS`, `Distil.jsx:884`) and dome (`getDomeOptions`, `Distil.jsx:944`) pickers — Active Pro inherits that flag.
    - **New `IF` body style:** `BODY_STYLES` (`Distil.jsx:203-210`) holds `ric/bte/ite/itc/cic/iic` — no `if`. Add an `if` entry with `hasReceiver:false` (mirrors `cic`/`iic` — this flag is what removes the receiver/dome requirement) and add `if:imgIIC` to `BODY_STYLE_IMG` (`Distil.jsx:215`), reusing the existing IIC image as Kurt asked. Precedent: TruHearing already has its own `if` style (`TH_BODY_STYLES`, `Distil.jsx:778`) reusing `imgIIC`.
    - **Re-map devices to `if`:** Active Pro `["ric"]→["if"]` (the actual functional fix) and Silk Charge&Go `["cic"]→["if"]`. The Silk is already `cic` (`hasReceiver:false`), so moving it is organizational — its own category + image — not a behavior fix.
    - **Apply to both layers:** the live `product_catalog` rows (`sig-active-ix`, `sig-silk-ix` — note the DB has *no* `sig-silk-ax` row) **and** `CATALOG_DEFAULT` in `Distil.jsx` (`sig-active-ix` ~L400, `sig-silk-ix` ~L360, seed-only `sig-silk-ax` ~L441). The live screen reads the DB; `CATALOG_DEFAULT` is the fallback (#19) — keep both in sync. Use the Settings → Catalog editor (#17) for the DB edit if it exposes a body-style field, otherwise a small migration.

30. **DOB — and every date-only field — displays one day early (`fmtDate` UTC-parse bug)** — Kurt created a patient with DOB 05/05/1955; the patient profile shows 05/04/1955. Root cause: `fmtDate(d)` = `new Date(d).toLocaleDateString("en-US",{...})`, defined identically in `Distil.jsx:1013` **and** `Aided.jsx:32`. `new Date("1955-05-05")` parses a bare `YYYY-MM-DD` string as **UTC midnight**, and `.toLocaleDateString()` then renders it in the machine's local US (negative-offset) timezone — rolling back to the previous calendar day.
    - **Scope is wider than DOB.** Every `date`-typed column passed to `fmtDate` shifts a day in US timezones. Verified `date` columns and their call sites: `patients.dob` (`Distil.jsx:6312`); `device_fittings.fitting_date` (`Distil.jsx:3448,6602`; `Aided.jsx:833,1079`); `device_fittings.warranty_expiry` and `insurance_coverage.warranty_expiry` (`Distil.jsx:6405,6602`; `Aided.jsx:720,843`); `patients.care_plan_start_date` (`Distil.jsx:6798`); `campaign_deliveries.scheduled_date` (`Distil.jsx:5765,6957`); `patient_campaigns.trigger_date` (`Distil.jsx:6941`). So warranty-expiry and fitting dates are also rendering a day early — DOB is just where Kurt happened to catch it. *Not* affected: `created_at` / `earned_at` / `patients.last_visit_date` are `timestamptz` and parse correctly.
    - **Aided's DOB gate is fine.** It compares the raw `<input type="date">` ISO string directly against the stored `dob` string (`Aided.jsx:~183`) with no `Date` parsing, so the true 05/05/1955 still unlocks. No gate change needed — the hazard is only that a provider trusting the wrong profile display would confirm the wrong date.
    - **Fix:** stop parsing date-only strings with `new Date()` — construct from split parts (`new Date(y, m-1, d)`) or format straight off the `YYYY-MM-DD` string. Since `fmtDate` is also (correctly) used for `timestamptz` values, either make it detect date-only input or add a separate `fmtDateOnly`. Patch both copies (`Distil.jsx:1013`, `Aided.jsx:32`). Also check the warranty day-count math at `Distil.jsx:6602` for its own off-by-one, and confirm the type of the appointments date column behind `fmtDate(a.date)` (`Distil.jsx:6709`, `Aided.jsx:1062`).

### Aided
10. **PWA conversion** ✅ DONE (Apr 2026) — installable on home screen, scoped to `/aided`, hand-rolled service worker, SVG icons, safe-area insets for standalone display. Placeholder 🎧-on-navy icon in use until real branding lands.
11. **Branding / logo for Aided** — placeholder 🎧 emoji on dark navy `#0a1628` is in place from the PWA conversion. Need a proper Aided wordmark + icon system; coordinate with Distil branding so the two read as a family. Inputs: dark navy is the established primary, hearing/sound/clarity is the conceptual core, audience is older adults (legibility matters more than cleverness).
12. **Push notifications** — patient engagement reminders (cleaning, appointments, warranty alerts, year-4 upgrade conversation). Phased delivery:
    - **Phase 1** ✅ DONE (Apr 2026) — VAPID keys generated, `push_subscriptions` table (migration 003), SW `push`/`notificationclick`/`pushsubscriptionchange` handlers, cache bumped to `aided-v2`.
    - **Phase 2** ✅ DONE (Apr 2026) — `subscribe-push` edge fn (POST upsert / DELETE deactivate), DOB gate on first launch (3 attempts → 60s lockout), contextual opt-in card on Schedule tab, all-or-nothing toggle in Help tab. Reconciliation on patient change re-POSTs the current endpoint to handle browser-rotated subscriptions.
    - **Phase 3** ✅ DONE (2026-05-18) — `send-push` edge fn (VAPID-signed Web Push to a patient's active subscriptions; retires dead 404/410 endpoints; rejects callers without a real provider session). `sendPushNotification` in `db.js` + `SendNotificationModal` + a "Notify Patient" button in Distil patient detail. **Deployed** — verified 2026-05-19: `send-push` is ACTIVE and edge-function logs show it returning a successful 200 for an authenticated provider call, so the VAPID secrets are in place and `verify_jwt:true` is correct here (callers are authenticated providers). End-to-end the feature is still dead, though — see Aided #18: `subscribe-push` 401s, so no subscriptions exist for `send-push` to target.
    - **Phase 4** ✅ DONE (2026-05-18) — `notification-cron` edge fn + a daily `pg_cron` scan. Migration 011 adds the `notification_log` dedup ledger and `get_due_notifications()` (appointment-tomorrow, monthly cleaning, warranty 90/30/0, year-4 upgrade); each reminder claims a log row so it fires once. Send logic shared via `_shared/webpush.ts` (`send-push` refactored onto it). **Deployed and working** ✅ — verified 2026-05-19: `notification-cron` v3 is ACTIVE, migrations `notification_log` + `schedule_notification_cron` + `notification_cron_auth_helper` applied, `aided-daily-notifications` pg_cron job scheduled (`0 14 * * *`). Manual test invocation returned 200 `{ok:true,due:0,sent:0}`. Fix details (Vault value + new `get_cron_auth_secret()` RPC + `verify_jwt:false`) under Aided #18.
13. Patient engagement: educational content, short videos
14. Year 4 Donate & Upgrade pathway — punch card incentive, charity donation flow
15. Year 5 Loyalty discount pathway
16. Video upload/record flow: donor message → recipient response → social share with consent
17. ~~**"Your Hearing Journey" graph color gradient**~~ ✅ DONE (2026-05-18) — restyled `views/CareJourney.jsx`. The trend line now carries a vertical green → yellow → orange → red gradient keyed to hearing ability (a `userSpaceOnUse` SVG `linearGradient` — green at the 0.95 "normal hearing" mark, warming as ability drops below it); milestone rings pick up the same gradient and the palette is unified to the Distil warranty greens/ambers/reds. Added a navy "You are here" marker on the line (optional `position` prop, 0–1, default 0 = journey start) and a warranty-coverage bar under the timeline (optional `warrantyYears` prop, default 4). Stays propless-compatible — `<CareJourney />` in Distil's care-plan step is unchanged.

18. ~~**Notification toggle / push pipeline**~~ ✅ DONE (2026-05-19) — Two compounding `verify_jwt` bugs broke the whole push stack since Phase 2; both fixed and end-to-end verified.
    - **`subscribe-push` (the toggle):** deployed with `verify_jwt: true`, so Supabase's gateway 401'd every Aided POST before the function body ran (Aided patients have no auth session). `push_subscriptions` had 0 rows, ever. **Fixed:** redeployed `subscribe-push` v3 with `verify_jwt: false`. The function self-authenticates (service role + patient-existence check), matching its sibling `aided-patient-feed`. Verified end-to-end — iPhone PWA toggle turns green and a `push_subscriptions` row lands (Apple push endpoint, iOS 18.7).
    - **`notification-cron` (the daily scan):** same gateway issue *plus* a wrong Vault `service_role_key` value (an 88-char non-key string). The project is on the new `sb_secret_` key format, which isn't a JWT, so the original `verify_jwt:true` gate would have 401'd it even with the right Vault value. **Fixed:** (1) reset the Vault secret to the real `sb_secret_` key; (2) added migration `notification_cron_auth_helper` introducing `public.get_cron_auth_secret()` (SECURITY DEFINER, service_role only) which reads the Vault secret; (3) redeployed `notification-cron` v3 with `verify_jwt: false` and the auth check rewritten to compare the incoming token against that RPC's return — so the cron and the function always agree regardless of key format. Tested via `net.http_post`: status **200**, body `{ok:true,due:0,sent:0}`.
    - **`send-push` untouched** — `verify_jwt: true` is correct there (callers are authenticated providers); logs show clean 200s.
    - **Still open (minor hardening):** `postSubscription` (`Aided.jsx:94-109`) only checks `resp.ok`, and a failed subscribe gives the user no UI feedback — the toggle silently snaps back to off. Surface the failure reason so a future stuck toggle isn't silent.

---

## Lima Charlie (Nonprofit Concept — Separate from Distil)
Veterans hearing nonprofit. Not a coding project yet — ideation phase.
- **Mission**: Get hearing aids to veterans failed by VA wait times
- **Model**: Donated aids from year-4 upgraders → fitted to veterans → donor/recipient video exchange
- **Voice**: Deadpan military humor, Dollar Shave Club energy, DEFCON-level absurdity
- **Hero campaign**: "I've Got Aids" misdirect series; "Find Your Gerald" donor CTA
- **Tagline**: *Loud and Clear — for the ones who've waited long enough*
- **Governance note**: 501(c)(3) formation needed; employment attorney review of IP assignment before any MHC corporate pitch

---

## Longer Horizon
- Noah module integration (WSA is HIMSA member — verify internally; Noah 4 requires C#/.NET in Visual Studio)
- Master user dashboard with multi-tenancy architecture
- Enterprise pitch to MHC corporate (one-pager drafted; IP review needed first)
- Email/report delivery for audiogram results to patients

---

## Reference Files in Project
- `TruHearing_Third_Party_Exclusive_Plans.xlsx`
- `UHCH_Third_Party_Exclusive_Plans.xlsx`
- `TruHearing_Select_2_Tier_Product_Catalog_2026.pdf`
- `TruHearing_Select_3_Tier_Product_Catalog_2026.pdf`
- `TruHearing_Choice_Product_Matrix_2026.pdf`
- `Scripting_and_Power_Phrases.docx`
- `Hearing_Industry_Map.pdf`
