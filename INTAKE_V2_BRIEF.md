# Distil Intake V2 — Implementation Brief

**For Claude Code at home. Kurt — paste this whole file to Claude Code when you start at home, or point it at this file. Paired with `CLAUDE.md` and `src/context.md`, it's everything needed to execute without re-asking the clarifying questions we already answered.**

---

## What we're building

Eleven improvements to the patient intake kiosk (`IntakeKiosk.jsx`) and how its output flows into the provider CRM (`Distil.jsx`). The big-picture goal isn't just form polish — it's turning intake responses into a persistent clinical artifact that lives on the patient profile and powers a new **Health History** step in the wizard between Patient and Testing. Provider walks through the responses with the patient during Health History to get them vocalizing pain points before testing begins.

## Decisions already locked — do NOT re-ask these

- **Device:** iPad kiosk. Use three dropdowns (month/day/year) for DOB, not the native calendar picker. Calendar picker is brutal for elderly patients who have to navigate backward 60+ years.
- **Phone formatting:** auto-format to `(XXX) XXX-XXXX` as the user types. Apply to all phone fields (home, mobile, work, spouse, emergency).
- **State dropdown:** US states with 2-letter codes stored. Default to UT (MHC is Utah-based).
- **Intake storage:** already persists in Supabase `intakes` table as JSONB `answers`. Don't rebuild — extend.
- **Versioning:** each intake submission is its own row in `intakes`. History is preserved. Never overwrite.
- **Provider edit access during Health History:** full edit on responses, plus a `＋` button next to each that reveals a provider-note textarea. Patient's original answer stays editable; provider notes stored separately in a new `provider_notes` JSONB column.
- **Patient review of past intakes via Aided app:** parked in backlog. NOT building now. Do not touch `Aided.jsx` in this sprint.
- **PDF approach:** keep the current HTML-download + CSS `@page` / page-break rules. Do NOT introduce `jsPDF` or `pdf-lib` in this sprint. If page-break CSS doesn't give sufficient typography control, revisit in a follow-up.
- **Family history:** multi-select. Split grandparents into maternal/paternal. Don't split parents or siblings by side.
- **Banned patient-facing terms:** "Neurotechnology," "Trial," "Demo" (use "adaptation period," "evaluation"). Standard `CLAUDE.md` rules apply to all new UI copy.

## Before you start — worktree setup

The main checkout on the office machine had OneDrive-induced `.git/*.lock` files that blocked worktree creation from a Linux sandbox. You (Claude Code running natively on Windows) should not hit this. Run:

```bash
cd ~/OneDrive/Documents/GitHub/Distil
git fetch origin
git worktree add .claude/worktrees/intake-v2 -b feature/intake-v2 origin/main
cd .claude/worktrees/intake-v2
```

All work happens in that worktree on branch `feature/intake-v2`. Push to origin so Kurt can see commits in GitHub Desktop.

**Caveat:** the office session had to rewrite `.git/config` to recover from a corrupted state. The minimal recovery covers core + origin remote + main tracking. If you see anything weird in config on the home machine (it shouldn't — the corruption was on the Cowork sandbox side of the OneDrive mount), tell Kurt.

**Do not touch the 27 uncommitted changes on `main`.** They're from a prior sprint for a regional director demo. The worktree is isolated off `origin/main` and has none of them. Keep it that way.

## The plan — four phases, execute in order

Each phase = its own commit(s). Every commit must leave the app rendering. Don't skip ahead.

---

### Phase 1 — Schema + persistence plumbing

Foundation for item 11. Without this, form UX improvements collect beautiful data into a JSONB blob that never reaches the patient profile.

**Supabase migration (via MCP, use `apply_migration`):**

```sql
-- Link intake to patient (nullable: dismissed intakes have no patient)
ALTER TABLE intakes ADD COLUMN patient_id UUID REFERENCES patients(id) ON DELETE SET NULL;
CREATE INDEX idx_intakes_patient_id ON intakes(patient_id);

-- Provider notes keyed by response field name
-- Shape: { "med_pain": "Discussed, patient elaborated on left ear", "hear_mumble": "..." }
ALTER TABLE intakes ADD COLUMN provider_notes JSONB DEFAULT '{}'::jsonb NOT NULL;
```

Run `get_advisors` after migration. Fix any RLS or security issues flagged.

**`src/db.js` additions (append to the INTAKE QUEUE section around line 856):**

- `linkIntakeToPatient(intakeId, patientId)` — sets `intakes.patient_id`
- `loadIntakesForPatient(patientId)` — returns all intakes for a patient, ordered by `submitted_at` DESC
- `updateIntakeAnswers(intakeId, answers)` — writes edits back to `intakes.answers`
- `updateIntakeProviderNotes(intakeId, notes)` — writes `intakes.provider_notes`

**`src/Distil.jsx` modification:**

Find `handleAcceptIntake` around line 2359. Currently it maps 6 fields (`firstName`, `lastName`, `dob`, `phone`, `email`, `payType`) into the new-patient form and writes the intake ID as a note string. The full JSONB `answers` is lost.

Change: after the new patient record is created and has an ID, call `linkIntakeToPatient(intake._meta.intakeId, newPatient.id)`. The intake row now persistently points at the patient, and `loadIntakesForPatient()` can retrieve it forever.

**Verification:**
- `get_advisors` clean
- Manually submit a test intake from the kiosk, accept it in the provider CRM, query `intakes` table, verify `patient_id` is set on that row
- App still renders

**Commit:** `feat(intake): link intakes to patients; add provider_notes schema`

---

### Phase 2 — Form UX overhaul (items 1–9)

All work in `src/IntakeKiosk.jsx`. Build reusable sub-components, use them across steps. Match the inline-style pattern already in the file — don't introduce CSS modules or Tailwind.

#### 2a — Three-dropdown DOB component

Replace `dob` field around line 264 and `spouseDob` around line 285. Component: three side-by-side dropdowns (Month with full names, Day 1–31, Year). Store as `YYYY-MM-DD` string in `answers.dob` for DB compatibility. Year range: current year – 99 down to current year – 10 (patient can be a minor).

Reuse the same component for spouse DOB.

#### 2b — State dropdown

Replace `state` text input around line 272. Full US state list (50 states + DC + territories as needed). Store 2-letter code. Default value: `UT`.

#### 2c — Phone auto-formatter

Add a shared `formatPhone(raw)` helper that strips non-digits, caps at 10, and returns `(XXX) XXX-XXXX` as they type. Wire to `homePhone`, `mobilePhone`, `workPhone` (around lines 276–280), `spousePhone` (line 284), `emergencyPhone` (line 287). Store the formatted string (not raw digits) in answers so `generateHTML()` prints it correctly.

#### 2d — "How did you hear about us" button grid

Replace `referral` text field around line 292 with a button grid. Options (store English key regardless of display language):

- `current_patient` — "Current patient"
- `friend_family` — "Friend or family referral"
- `doctor` — "Doctor referral"
- `google` — "Google search"
- `social` — "Social media"
- `tv_radio` — "TV or radio"
- `direct_mail` — "Direct mail"
- `event` — "Event or health fair"
- `walkin` — "Walk-in"
- `other` — "Other"

Selecting `other` reveals a text field. Store selected option as `answers.referralSource`, free text as `answers.referralOther`.

#### 2e — Family history multi-select

Replace `med_family` text step around line 306 with a multi-select button grid. Options:

- `mother`
- `father`
- `grandparent_maternal` — "Maternal grandparent"
- `grandparent_paternal` — "Paternal grandparent"
- `siblings`
- `children`
- `aunt_uncle`
- `none` — "None known"
- `unsure`

Store `answers.medFamilyHistory` as an array of selected keys. Clicking `none` or `unsure` deselects all others. Clicking any other option deselects `none` and `unsure`.

#### 2f — Recreational noise exposure (item 8, fixes the auto-advance bug)

Current `med_noise` is a yesno that auto-advances on yes, bypassing the follow-up text field. That's the bug. Fix:

- When "yes" is selected, do NOT auto-advance. Show the follow-up below.
- Follow-up is a multi-select button grid + optional text:
  - `firearms` — "Firearms or hunting"
  - `power_tools` — "Power tools"
  - `motorcycles` — "Motorcycles or ATVs"
  - `concerts` — "Concerts or live music"
  - `lawn` — "Lawn or yard equipment"
  - `woodworking` — "Woodworking"
  - `machinery` — "Loud machinery at work"
  - `other` — "Other"
- Store `answers.noiseExposureTypes` (array) and `answers.noiseExposureOther` (text for Other).
- Advance only when user taps Next.

#### 2g — Resistance points (item 9)

Replace `hear_prevented` free-text step around line 327 with a multi-select button grid:

- `cost` — "Cost or affordability"
- `cosmetics` — "Cosmetics or appearance"
- `denial` — "Didn't feel ready"
- `bad_experience` — "Past bad experience"
- `stigma` — "Stigma"
- `dont_know` — "Didn't know where to start"
- `fear_dependence` — "Fear of becoming dependent"
- `other` — "Other"

Store `answers.resistancePoints` (array) + `answers.resistancePointsOther` (text).

#### 2h — Auto-advance bug audit

Search the file for all `autoAdvance()` calls. Any step with a `followUp` or `followUps` configured must NOT auto-advance on yes. Inspect `med_noise`, `med_doctor`, `med_diabetic` specifically. Fix the `yesno` renderer around line 764 to suppress auto-advance when a follow-up exists regardless of answer.

**Also update `generateHTML()` around line 344** — any answer keys you've changed (from strings to arrays, new keys like `referralSource`) need to render correctly in the intake PDF. Arrays should join as comma-separated strings in the HTML output.

**Verification per sub-item:**
- Touch-test at iPad viewport (DevTools device emulation, 768×1024 portrait)
- Bracket balance check on `IntakeKiosk.jsx` after each edit
- `generateHTML()` still produces valid HTML with the new answer shape

**Commits:** consider grouping — one commit for DOB+phone+state ("contact inputs"), one for the multi-selects ("structured response buckets"), one for the noise-exposure bug fix.

---

### Phase 3 — Privacy + insurance verbiage on intake output (item 10)

File: `src/IntakeKiosk.jsx`, function `generateHTML()` around line 344.

Current template: page 1 prints header + patient info + medical Yes/No list + hearing history + aids (if any) + certification above signature. Page 2 is mostly blank. Privacy and insurance text are shown on the kiosk but NOT printed to the output.

Add the full privacy policy text (`T.en.privacyIntro` + `T.en.privacyBullets`) and full insurance acknowledgment text (`T.en.insText`) to the HTML template. Structure:

- Page 1: patient info + medical + hearing + aids
- Page 2: privacy policy (top) → insurance acknowledgment (middle) → certification text (above signature) → signature image (bottom)

Use CSS:

```css
.consent-section { page-break-before: always; }
@page { margin: 15mm; size: letter; }
```

Signature must anchor near the bottom of page 2. If the content is too short to fill page 2, use padding or margin-top: auto on the signature block inside a flex container.

**Test:** open the downloaded `.html` file in the browser, Cmd/Ctrl-P, Save as PDF. Verify page break happens exactly where expected and signature sits at the bottom of page 2 with the consent text above it.

**Commit:** `feat(intake): render privacy and insurance verbiage on page 2 of intake output`

---

### Phase 4 — Health History wizard step + clinical review UI (item 11)

Biggest change. New file to avoid adding ~500 lines to the 6,753-line `Distil.jsx` monolith. Matches `CLAUDE.md` guidance on extracting new features to `src/views/`.

#### 4a — Create `src/views/HealthHistory.jsx`

Props:

- `intake` — the loaded intake record `{ answers, provider_notes, _meta }`
- `onUpdateAnswer(key, value)` — writes to `intakes.answers` via `updateIntakeAnswers`
- `onToggleNote(key)` — reveals or hides the note field for a response
- `onUpdateNote(key, text)` — writes to `intakes.provider_notes` via `updateIntakeProviderNotes`

Render sections matching the intake form structure:

- **About You** — name, DOB, address, contact, emergency contact, spouse
- **Medical History** — pain/drainage/sudden/ringing/dizzy/full, doctor visits, surgery, medications, diabetic, family history, noise exposure
- **Hearing History** — tested before, best ear, symptoms, scale rating, resistance points, ready-for-help
- **Current Hearing Aids** — only if `answers.aids_q === true`

Each response: patient's answer as an editable input (appropriate type — text, radio group, multi-select), with a small `＋` button next to the label. Click `＋` reveals a textarea below the response for a provider note. Note textareas have a distinct visual style (teal left border, muted background) to distinguish from patient answers.

Save strategy: per-field save on blur (keep Kurt's clinical flow frictionless). Show a small saved indicator.

#### 4b — Insert Health History as step 1 in the wizard (`src/Distil.jsx`)

Find the wizard state at line 1517: `const [step, setStep] = useState(0);`

Find `canProceed` array at line 3213. Currently 6 entries:
```js
[
  form.firstName && form.lastName && form.dob && form.phone,   // 0 Patient
  true,                                                         // 1 Testing
  true,                                                         // 2 Results
  (isSideConfigured("left") || isSideConfigured("right")),     // 3 Devices
  form.payType === "private" || !!form.carePlan,               // 4 Care Plan
  true,                                                         // 5 Review
][step]
```

Insert a new entry at index 1 for Health History (always proceedable — review-only step):
```js
[
  form.firstName && form.lastName && form.dob && form.phone,   // 0 Patient
  true,                                                         // 1 Health History  ← NEW
  true,                                                         // 2 Testing
  true,                                                         // 3 Results
  (isSideConfigured("left") || isSideConfigured("right")),     // 4 Devices
  form.payType === "private" || !!form.carePlan,               // 5 Care Plan
  true,                                                         // 6 Review
][step]
```

**Critical:** grep the entire `Distil.jsx` for `step === 1`, `step === 2`, `step === 3`, `step === 4`, `step === 5` and shift each by +1 where it refers to wizard steps (Testing/Results/Devices/Care Plan/Review). This is the most error-prone part — expect to miss one or two on the first pass. Verify by walking the wizard end-to-end in the browser.

Update the step dot labels in the wizard UI — search for `wizard-step` and `step-name` around line 2529–2537 for the CSS, and wherever the step labels array is defined.

#### 4c — Load intake in Health History step

When `handleAcceptIntake` runs (Phase 1 already added the linkage), store the accepted intake ID in state so step 1 can render it. Alternatively, call `loadIntakesForPatient(selectedPatient.id)` on demand and use the most recent.

#### 4d — Patient detail accordion

In `renderPatientDetail()` around line 5169, add an expandable "Intake Responses" section. Default: show most recent intake. If the patient has multiple versioned intakes, show a dropdown/selector. All fields render read-only in this view — edits happen only in the Health History wizard step.

Include a "Show older intakes" toggle if there's more than one.

**Verification:**
- End-to-end: submit an intake on kiosk → accept in queue → Health History step renders responses → edit a response → add a provider note → advance to Testing → go to patient detail → confirm intake visible in accordion
- Bracket balance on `Distil.jsx` after the step-index shift
- No console errors in DevTools

**Commits:** one per sub-item (4a, 4b, 4c, 4d) in order. 4b is the riskiest; expect to revisit after 4c and 4d uncover missed `step === N` comparisons.

---

## Verification checklist per phase

- After any DDL: `get_advisors` clean
- After any `Distil.jsx` or `IntakeKiosk.jsx` edit: grep for unclosed JSX braces / tags
- After any answer-shape change: `generateHTML()` in `IntakeKiosk.jsx` still produces valid HTML
- After Phase 4: walk the full wizard end-to-end with a test patient

## Questions to ask Kurt before Phase 4

- Per-field blur save vs. explicit "Save" button in Health History? (Claude's instinct: per-field blur save.)
- Patient detail accordion: older intakes visible by default or hidden behind a "show older" toggle? (Claude's instinct: hidden, with a toggle.)
- When a patient re-intakes at a later visit, should the Health History step show only the newest intake, both old and new for comparison, or let the provider choose? (Claude's instinct: newest only, with a compare button.)

## Guardrails

- **Don't break the wizard.** Every commit renders.
- **Don't touch the 27 uncommitted changes on `main`.** Worktree is isolated; keep it that way.
- **Supabase migrations via MCP only.** Use `apply_migration`. Run `get_advisors` after DDL.
- **No new dependencies** without Kurt's approval. Stack is React + Vite + Supabase JS.
- **Banned terms check before shipping UI copy:** Neurotechnology → devices. Trial/Demo → adaptation period/evaluation.
- **Small, reviewable commits.** Kurt merges via GitHub Desktop.
- **Ask clarifying questions** on anything not covered here. Kurt explicitly wants to be consulted on design decisions rather than have you guess.

## When you're done

- Push `feature/intake-v2` to origin
- Update `src/context.md` with one bullet in the backlog noting the annual-exam pre-populate idea for follow-up visits (a deferred feature from this conversation): *"On annual check-in, pre-populate intake form with last-visit answers for patient review + fresh privacy/insurance signatures."*
- This file (`INTAKE_V2_BRIEF.md`) can be deleted after the feature ships, or kept as a reference. Kurt's call.

---

*Brief written 2026-04-22 from a Cowork session that hit OneDrive sandbox file-lock issues. All investigation findings (line numbers, current data flow, schema state) verified against `src/IntakeKiosk.jsx`, `src/db.js`, `src/Distil.jsx`, and `src/context.md` at commit `ff1dc53`.*
