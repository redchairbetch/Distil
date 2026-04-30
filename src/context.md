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
2. Follow-up queue — dedicated view with priority buckets:
   - Warranty expiring within 90 days
   - No visit in 12+ months
   - Fit but never returned for follow-up
   - Devices off warranty with no upgrade conversation noted
3. Fields needed: `last_visit_date`, `follow_up_contacted` (with date)
4. L&D tracking: **not a separate benefit** — covered under warranty; warranty widget handles it
5. Regimented care calendar: full 4–5 year appointment arc scheduled at fitting
6. Upgrade tracking fields: `care_plan_start_date`, `upgrade_tier_offered`, `upgrade_outcome`, `donation_recipient`
7. Insurance Plans management screen (deferred pending Supabase migration testing)
8. **Narrative Thread UX** — five-chapter patient education / device selection / close flow (design complete, build pending)
9. **Pricing Reveal component** — Chapter 3 of narrative thread (data model complete, `db.js` function ready, UI build pending)
10. **Referral pipeline — name the referrer** — intake kiosk "Friend or family referral" should reveal a text box for the referrer's name so the clinic can close the loop (thank-you card, referral credit, cross-reference to the existing patient record). Low-priority polish; revisit when fleshing out the referral pipeline.
11. **Branding / logo for Distil** — current favicon is a generic 🩺 emoji. Need a real wordmark/icon for the provider CRM. Tie to a brand system that also covers Aided and (eventually) Lima Charlie.
12. **Text-selectable kiosk intake PDF** — current archive uses `jsPDF.html()` (html2canvas under the hood) which produces an image-based PDF: visually identical to the printable HTML and legally fine for compliance, but not text-searchable. Build a parallel jsPDF generator that lays out the intake fields directly (similar to `generatePurchaseAgreement.js`) so the archived signed-intake PDFs are searchable, smaller, and copy-pasteable. Replace the `htmlToPdfBlob()` helper in `IntakeKiosk.jsx` with the new generator once it's ready.
13. **`linkIntakeToPatient` same-clinic enforcement** — when a provider accepts a kiosk intake and links it to a patient, `db.js` updates `intakes.patient_id` and backfills `patient_documents.patient_id` but doesn't verify that the supplied `patient_id` belongs to the same clinic as the intake. Not reachable through the current UI (staff only see their own clinic's patients), but a hardening item: add a clinic check to the update so a stray API call can't cross-link a kiosk PDF to another clinic's patient. Likely an explicit `.eq('clinic_id', myClinicId)` on both updates.
14. **Document signed-URL refresh on click** — the patient-detail Documents card pre-signs URLs at fetch time with a 1-hour TTL. If the page sits open past the TTL the "Open ↗" link 401s instead of falling into the "link expired" placeholder (which only renders when the URL is null at fetch time). Bind the anchor's onClick to call `getDocumentSignedUrl(storage_path)` and re-sign when the cached URL is older than ~50 minutes.
15. **Orphan storage sweeper for failed kiosk archives** — `uploadPatientDocument`'s table-insert failure path tries `storage.remove([storagePath])` but anon has no DELETE policy, so kiosk-side orphans silently pile up. Need a periodic sweep (edge function or pg_cron) that lists `storage.objects` under `clinics/*/intakes/*/` and deletes any object with no matching `patient_documents` row. Low impact today (kiosk archive itself is best-effort), but worth a janitor pass quarterly.

### Aided
10. **PWA conversion** ✅ DONE (Apr 2026) — installable on home screen, scoped to `/aided`, hand-rolled service worker, SVG icons, safe-area insets for standalone display. Placeholder 🎧-on-navy icon in use until real branding lands.
11. **Branding / logo for Aided** — placeholder 🎧 emoji on dark navy `#0a1628` is in place from the PWA conversion. Need a proper Aided wordmark + icon system; coordinate with Distil branding so the two read as a family. Inputs: dark navy is the established primary, hearing/sound/clarity is the conceptual core, audience is older adults (legibility matters more than cleverness).
12. **Push notifications** — patient engagement reminders (cleaning, appointments, warranty alerts, year-4 upgrade conversation). Phased delivery:
    - **Phase 1** ✅ DONE (Apr 2026) — VAPID keys generated, `push_subscriptions` table (migration 003), SW `push`/`notificationclick`/`pushsubscriptionchange` handlers, cache bumped to `aided-v2`.
    - **Phase 2** ✅ DONE (Apr 2026) — `subscribe-push` edge fn (POST upsert / DELETE deactivate), DOB gate on first launch (3 attempts → 60s lockout), contextual opt-in card on Schedule tab, all-or-nothing toggle in Help tab. Reconciliation on patient change re-POSTs the current endpoint to handle browser-rotated subscriptions.
    - **Phase 3** — `send-push` edge fn + manual "Send notification" button in Distil CRM patient detail.
    - **Phase 4** — pg_cron scheduled scan: appointment reminder 24h ahead, monthly cleaning prompt, warranty 90d/30d/expired, year-4 upgrade ping. 410-response handling marks subscriptions inactive.
13. Patient engagement: educational content, short videos
14. Year 4 Donate & Upgrade pathway — punch card incentive, charity donation flow
15. Year 5 Loyalty discount pathway
16. Video upload/record flow: donor message → recipient response → social share with consent

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
