# Cowork Sprint Instructions — Distil / Aided
**Project:** Distil (provider CRM) + Aided (patient companion app)  
**Demo deadline:** April 13, 2026  
**Owner:** Kurt  
**Stack:** React + Vite + Supabase + Vercel  
**Repo structure:** Monorepo. Distil is the primary app. Aided.jsx lives in `/src/`. Supabase client is at `/src/supabase.js`.

---

## YOUR ROLE

You are a senior full-stack engineer executing a focused pre-demo sprint. Work methodically through each task in order. Do not skip ahead. After completing each task, verify your work before moving to the next. If you encounter an ambiguity that requires a product decision (not a technical decision), stop and leave a clearly labeled `// COWORK: NEEDS DECISION` comment rather than guessing.

Do not rewrite working code unless the task explicitly requires it. Preserve existing functionality. The goal is addition and migration, not refactoring.

---

## TASK 1: DATABASE SCHEMA MIGRATION
**Estimated time:** 20–30 minutes  
**Where to work:** Create a new file at `/supabase/migrations/002_tns_and_lifecycle.sql`

Write a complete SQL migration file that adds the following tables and columns to the existing Supabase schema. The existing schema (for context) includes: `organizations`, `clinics`, `staff`, `product_catalog`, `insurance_plans`, `patients`, `insurance_coverage`, `audiograms`, `audiogram_thresholds`, `device_fittings`, `device_sides`, `appointments`. Row Level Security is already enabled on all existing tables.

### 1A — Add status tracking to patients table

```sql
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS patient_status text NOT NULL DEFAULT 'prospect'
    CHECK (patient_status IN ('prospect', 'active', 'tns', 'lapsed', 'churned')),
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz DEFAULT now();
```

- `prospect` = intake completed, not yet fitted
- `active` = fitted, current patient
- `tns` = did not proceed at point of sale
- `lapsed` = active patient who has gone silent / missed appointments
- `churned` = confirmed gone to competitor or deceased

### 1B — TNS outcomes table

Captures the provider-selected reason why a patient did not proceed, logged after the patient leaves.

```sql
CREATE TABLE tns_outcomes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id       uuid NOT NULL REFERENCES clinics(id),
  logged_by       uuid REFERENCES staff(id),
  outcome_reason  text NOT NULL CHECK (outcome_reason IN (
                    'needs_spouse_consult',
                    'cost_barrier',
                    'needs_more_research',
                    'not_ready_emotionally',
                    'prior_bad_experience',
                    'pain_not_acute_enough',
                    'insurance_confusion',
                    'other'
                  )),
  outcome_notes   text,
  quote_amount    integer,
  follow_up_date  date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON tns_outcomes(patient_id);
CREATE INDEX ON tns_outcomes(clinic_id);
CREATE INDEX ON tns_outcomes(outcome_reason);
ALTER TABLE tns_outcomes ENABLE ROW LEVEL SECURITY;
```

### 1C — Nurture enrollment table

Tracks which campaign sequence a TNS patient is enrolled in and their progress through it.

```sql
CREATE TABLE nurture_enrollment (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id           uuid NOT NULL REFERENCES clinics(id),
  campaign_type       text NOT NULL CHECK (campaign_type IN (
                        'tns_denial',
                        'tns_cost',
                        'tns_skeptic',
                        'tns_emotional',
                        'tns_research',
                        'tns_general',
                        'active_upgrade_y3',
                        'active_upgrade_y4',
                        'active_upgrade_y5_lima_charlie'
                      )),
  enrolled_at         timestamptz NOT NULL DEFAULT now(),
  current_touchpoint  integer NOT NULL DEFAULT 1,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'converted', 'unsubscribed')),
  converted_at        timestamptz,
  notes               text
);

CREATE INDEX ON nurture_enrollment(patient_id);
CREATE INDEX ON nurture_enrollment(clinic_id);
CREATE INDEX ON nurture_enrollment(campaign_type);
ALTER TABLE nurture_enrollment ENABLE ROW LEVEL SECURITY;
```

### 1D — Lima Charlie events table

Records hearing aid donation events and links them to the donating patient's lifetime record.

```sql
CREATE TABLE lima_charlie_events (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id             uuid NOT NULL REFERENCES clinics(id),
  fitting_id            uuid REFERENCES device_fittings(id),
  event_type            text NOT NULL CHECK (event_type IN ('donation', 'recipient')),
  certificate_number    text UNIQUE,
  certificate_issued_at timestamptz,
  donor_message         text,
  recipient_thank_you   text,
  social_consent        boolean NOT NULL DEFAULT false,
  swag_shipped          boolean NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON lima_charlie_events(patient_id);
CREATE INDEX ON lima_charlie_events(clinic_id);
ALTER TABLE lima_charlie_events ENABLE ROW LEVEL SECURITY;
```

### 1E — Patient achievements table

Stores earned badges/milestones per patient for display in Aided.

```sql
CREATE TABLE patient_achievements (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  achievement   text NOT NULL CHECK (achievement IN (
                  'first_fitting',
                  'one_year_anniversary',
                  'three_year_anniversary',
                  'five_year_anniversary',
                  'six_year_survivor',
                  'care_plan_streak_6',
                  'care_plan_streak_12',
                  'lima_charlie_donor',
                  'early_upgrader',
                  'serial_upgrader',
                  'two_sets_one_year',
                  'hearing_champion'
                )),
  earned_at     timestamptz NOT NULL DEFAULT now(),
  acknowledged  boolean NOT NULL DEFAULT false
);

CREATE INDEX ON patient_achievements(patient_id);
ALTER TABLE patient_achievements ENABLE ROW LEVEL SECURITY;
```

### 1F — RLS Policies for all new tables

Apply the same RLS pattern used in the existing schema. Staff can read/write records belonging to their clinic. Patients (via Aided) can read only their own records.

```sql
-- TNS outcomes: staff access by clinic
CREATE POLICY "Staff access tns_outcomes by clinic"
  ON tns_outcomes FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  ));

-- Nurture enrollment: staff access by clinic
CREATE POLICY "Staff access nurture_enrollment by clinic"
  ON nurture_enrollment FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  ));

-- Lima Charlie: staff access by clinic
CREATE POLICY "Staff access lima_charlie_events by clinic"
  ON lima_charlie_events FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM staff WHERE id = auth.uid()
  ));

-- Patient achievements: patients can read their own
CREATE POLICY "Patients read own achievements"
  ON patient_achievements FOR SELECT
  USING (patient_id = auth.uid());

-- Patient achievements: staff can read/write by clinic
CREATE POLICY "Staff manage patient achievements"
  ON patient_achievements FOR ALL
  USING (patient_id IN (
    SELECT id FROM patients WHERE clinic_id IN (
      SELECT clinic_id FROM staff WHERE id = auth.uid()
    )
  ));
```

**After writing this file:** Do NOT run it against Supabase directly. Leave a comment at the top of the file: `-- READY TO APPLY: Run this in Supabase SQL editor or via CLI migration`. Kurt will apply it manually so he can verify each step.

---

## TASK 2: SET UP AIDED AS A SEPARATE DEPLOYABLE APP
**Estimated time:** 45–60 minutes  
**Goal:** Aided should be deployable to its own Vercel URL from the same repo, as a PWA that installs to a phone home screen.

### 2A — Create the Aided app directory

Create a new top-level directory: `/aided/`

Inside it, create the following structure:
```
/aided/
  index.html
  vite.config.js
  public/
    manifest.json
    sw.js
    icon-192.png   ← placeholder, see note below
    icon-512.png   ← placeholder, see note below
```

**Note on icons:** If no icon files exist, create a simple SVG placeholder and note `// COWORK: NEEDS DESIGN - replace icon-192.png and icon-512.png with branded Aided icons before launch`. Do not block progress on this.

### 2B — Create `/aided/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0a1628" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Aided" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <title>Aided</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main-aided.jsx"></script>
  </body>
</html>
```

### 2C — Create `/aided/vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
})
```

### 2D — Create `/aided/public/manifest.json`

```json
{
  "name": "Aided — Hearing Care",
  "short_name": "Aided",
  "description": "Your personal hearing care companion",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a1628",
  "theme_color": "#0a1628",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### 2E — Create `/aided/public/sw.js` (basic service worker)

```javascript
const CACHE_NAME = 'aided-v1';
const STATIC_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
```

### 2F — Create `/src/main-aided.jsx`

This is the Aided entry point that registers the service worker and mounts the app.

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PatientApp from './Aided.jsx'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PatientApp />
  </StrictMode>
)
```

---

## TASK 3: MIGRATE AIDED FROM WINDOW.STORAGE TO SUPABASE
**Estimated time:** 60–90 minutes  
**File to modify:** `/src/Aided.jsx`  
**Supabase client:** Import from `./supabase.js`

### Context

Aided currently uses `window.storage` (a Claude artifact sandbox API) for all data persistence. This does not exist in real browsers. Replace all `window.storage` / `storage.get` / `storage.set` / `storage.list` calls with Supabase queries. The existing DEMO patient object should be kept as a fallback when no authenticated patient is found.

### 3A — Add Supabase import

At the top of Aided.jsx, add:
```javascript
import { supabase } from './supabase.js'
```

Remove the line:
```javascript
const storage = window.storage;
```

### 3B — Replace patient loading logic

The current patient loading logic (in the `useEffect` that calls `storage.get('active_patient_id')`) should be replaced with a Supabase query. The new logic should:

1. Check if there is an authenticated Supabase session via `supabase.auth.getSession()`
2. If a session exists, query the patient record joined with insurance_coverage, device_fittings, device_sides, and upcoming appointments
3. If no session or no patient found, fall back to the DEMO patient object
4. Store the loaded patient in the existing `patient` state variable

Use this query pattern:
```javascript
const { data: sessionData } = await supabase.auth.getSession()
if (sessionData?.session?.user) {
  const patientId = sessionData.session.user.id

  const { data: patientData } = await supabase
    .from('patients')
    .select(`
      *,
      insurance_coverage(*),
      device_fittings(
        *,
        device_sides(*)
      ),
      appointments(*)
    `)
    .eq('id', patientId)
    .single()

  if (patientData) {
    // Map Supabase shape to the existing patient object shape Aided expects
    // Keep mapping as close to the existing DEMO object structure as possible
    // so the rest of the render functions require minimal changes
    const mapped = mapSupabasePatientToAidedShape(patientData)
    setPatient(mapped)
    return
  }
}
// Fall back to DEMO
setPatient(DEMO)
```

Write the `mapSupabasePatientToAidedShape` function above the component. It should translate the Supabase join result into the flat patient shape the existing render functions expect — matching the structure of the DEMO object at lines 6–29 of the current file.

### 3C — Replace punch card storage

The `savePunch` function currently writes to `window.storage`. Replace it with a Supabase upsert to a `punch_card_usage` table.

**Note:** This table does not exist in the current schema. Add it to the migration file from Task 1 as an addendum (1G):

```sql
CREATE TABLE punch_card_usage (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  cleanings     integer NOT NULL DEFAULT 0,
  appointments  integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);
ALTER TABLE punch_card_usage ENABLE ROW LEVEL SECURITY;
```

The new `savePunch` should upsert:
```javascript
const savePunch = async (next) => {
  setPunchUsed(next)
  if (!patient || patient.id === 'DEMO01') return // Don't persist demo data
  try {
    await supabase.from('punch_card_usage').upsert({
      patient_id: patient.id,
      cleanings: next.cleanings,
      appointments: next.appointments,
      updated_at: new Date().toISOString()
    }, { onConflict: 'patient_id' })
  } catch (err) {
    console.warn('Punch card save failed:', err)
  }
}
```

### 3D — Replace clinic name loading

Replace the `storage.get('clinic_name')` and `storage.get('clinic_settings')` calls with a Supabase query:

```javascript
// Load clinic name from clinics table using patient's clinic_id
if (patientData?.clinic_id) {
  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', patientData.clinic_id)
    .single()
  if (clinic?.name) setClinicName(clinic.name)
}
```

### 3E — Preserve demo fallback behavior

After all migrations, verify that when `patient.id === 'DEMO01'`:
- No Supabase writes occur
- The app renders fully using the hardcoded DEMO object
- No console errors appear related to missing auth or missing data

---

## TASK 4: ACHIEVEMENTS DISPLAY IN AIDED
**Estimated time:** 30 minutes  
**File to modify:** `/src/Aided.jsx`

Add a simple achievements section to the Home tab (`renderHome` function). It should:

1. Load the patient's earned achievements from the `patient_achievements` table on mount
2. Display earned badges in a horizontally scrollable row below the care plan status card
3. Each badge should show an emoji, a short title, and the earned date
4. If no achievements exist (demo patient or new patient), show nothing — do not show empty states for this in the demo

Use this badge display map:
```javascript
const ACHIEVEMENT_DISPLAY = {
  first_fitting:         { emoji: '🎧', label: 'First Fitting' },
  one_year_anniversary:  { emoji: '🎂', label: '1 Year Strong' },
  three_year_anniversary:{ emoji: '🏆', label: '3 Year Veteran' },
  five_year_anniversary: { emoji: '⭐', label: '5 Year Champion' },
  six_year_survivor:     { emoji: '🦴', label: 'Stubborn Survivor' },
  care_plan_streak_6:    { emoji: '🔥', label: '6-Month Streak' },
  care_plan_streak_12:   { emoji: '💎', label: 'Full Year Streak' },
  lima_charlie_donor:    { emoji: '🎖️', label: 'Lima Charlie Donor' },
  early_upgrader:        { emoji: '⚡', label: 'Early Upgrader' },
  serial_upgrader:       { emoji: '🚀', label: 'Serial Upgrader' },
  two_sets_one_year:     { emoji: '😅', label: 'Overachiever' },
  hearing_champion:      { emoji: '👑', label: 'Hearing Champion' },
}
```

---

## TASK 5: VERCEL DEPLOYMENT CONFIGURATION
**Estimated time:** 15 minutes  
**Files to create/modify:** `/vercel.json` (root level)

Create or update `vercel.json` to support two separate deployments from the same repo. Distil deploys from root; Aided deploys from `/aided/`.

```json
{
  "projects": [
    {
      "name": "distil",
      "rootDirectory": ".",
      "buildCommand": "vite build",
      "outputDirectory": "dist",
      "framework": "vite"
    },
    {
      "name": "aided",
      "rootDirectory": "aided",
      "buildCommand": "vite build",
      "outputDirectory": "dist",
      "framework": "vite"
    }
  ]
}
```

**Note for Kurt:** In the Vercel dashboard, you will need to manually create a second project pointing to the same GitHub repo with `aided` as the root directory. Set the following environment variables on the Aided project:
- `VITE_SUPABASE_URL` — same value as Distil
- `VITE_SUPABASE_ANON_KEY` — same value as Distil

Leave a clearly marked `// COWORK: VERCEL DASHBOARD STEP REQUIRED` comment in the vercel.json file.

---

## TASK 6: CLEANUP AND VERIFICATION
**Estimated time:** 15 minutes

1. Search the entire `/src/Aided.jsx` file for any remaining references to `window.storage`, `storage.get`, `storage.set`, or `storage.list`. If any remain, replace them or leave a `// COWORK: NEEDS MIGRATION` comment.

2. Verify the DEMO patient fallback renders without errors by tracing through `renderHome`, `renderDevices`, `renderCare`, `renderSchedule`, and `renderHelp` with `patient = DEMO`.

3. Confirm all new files are saved and no import paths are broken.

4. Create a file at `/SPRINT_STATUS.md` and populate it with:
   - Which tasks were completed
   - Which tasks were partially completed and what remains
   - Any decisions that were flagged as `COWORK: NEEDS DECISION`
   - Any blockers encountered

---

## WHAT THIS DOCUMENT DOES NOT COVER
The following items are being handled by Kurt and Claude in parallel and should NOT be touched by Cowork:

- TNS branching UI in Distil (new screens for quote generation, patient status forking, provider review queue)
- Nurture campaign display screens in Distil
- Lima Charlie event UI
- Demo data population
- Purchase agreement and quote generator modifications
- Any changes to the Distil main app flow

---

## ENVIRONMENT NOTES
- Node version: use whatever is currently installed in the repo
- Package manager: check for `yarn.lock` or `package-lock.json` and use the matching one
- Do not install new npm packages unless absolutely required. If a new package is genuinely needed, note it in SPRINT_STATUS.md and explain why.
- Supabase environment variables are in `.env` at the repo root. Do not commit this file or expose its contents.
- The Supabase anon key is safe for client-side use — it is not a secret key.

---

*Document prepared April 6, 2026. Questions: leave COWORK: NEEDS DECISION comments inline.*
