# Sprint Status — Cowork Pre-Demo Sprint
**Date:** April 6, 2026
**Demo deadline:** April 13, 2026

---

## Completed Tasks

### Task 1: Database Schema Migration ✅
- Created `supabase/migrations/002_tns_and_lifecycle.sql`
- All tables implemented: `tns_outcomes`, `nurture_enrollment`, `lima_charlie_events`, `patient_achievements`, `punch_card_usage`
- Added `patient_status` and `status_updated_at` columns to `patients` table
- RLS policies applied to all new tables (staff by clinic, patients read own)
- **Not yet applied** — file is marked `READY TO APPLY` for Kurt to run manually

### Task 2: Aided PWA App Structure ✅
- Created `/aided/` directory with `index.html`, `vite.config.js`
- Created `/aided/public/` with `manifest.json`, `sw.js`, placeholder icons
- Created `/src/main-aided.jsx` as the Aided entry point with service worker registration
- Vite config uses `@` alias pointing to `../src/` so Aided shares source with Distil
- Placeholder icons generated (dark blue/green) — needs branded replacements before launch

### Task 3: Aided Storage Migration ✅
- Replaced all `window.storage` / `storage.get` / `storage.set` / `storage.list` calls with Supabase queries
- Patient loading now checks `supabase.auth.getSession()` first, falls back to DEMO
- Punch card persistence now uses `punch_card_usage` table via upsert
- Clinic name loaded from `clinics` table via patient's `clinic_id`
- Added `mapSupabasePatientToAidedShape()` mapping function for Supabase → Aided object shape
- DEMO fallback verified: no Supabase writes when `patient.id === 'DEMO01'`
- **Zero remaining references** to `window.storage` in Aided.jsx

### Task 4: Achievements Display ✅
- Added `ACHIEVEMENT_DISPLAY` constant with all 12 badge types (emoji + label)
- Added `achievements` state and Supabase loading effect
- Horizontally scrollable badge row added to `renderHome`, below Care Plan section
- Shows nothing for demo patient or patients with no achievements (no empty state)

### Task 5: Vercel Deployment Configuration ✅
- Updated `vercel.json` with `projects` array for dual deployment (Distil + Aided)
- Preserved existing SPA rewrite rule and `installCommand`
- **VERCEL DASHBOARD STEP REQUIRED:** Kurt needs to manually create a second Vercel project pointing to the same GitHub repo with `aided` as the root directory, and set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` environment variables

### Task 6: Cleanup & Verification ✅
- Confirmed zero `window.storage` references remaining in Aided.jsx
- Bracket balance verified (braces, parens, brackets all balanced)
- All new file paths verified to exist
- Import paths verified (main-aided.jsx → Aided.jsx, aided/index.html → ../src/main-aided.jsx)

---

## Decisions Flagged

No `COWORK: NEEDS DECISION` comments were needed — all tasks had clear enough specifications to proceed.

---

## Notes for Kurt

1. **Icon placeholders:** `aided/public/icon-192.png` and `icon-512.png` are auto-generated placeholders. Replace with branded Aided icons before launch.

2. **Vercel dual deployment:** JSON doesn't support comments, so the `COWORK: VERCEL DASHBOARD STEP REQUIRED` note lives here instead of in `vercel.json`. You need to create a second Vercel project in the dashboard with `aided` as root directory.

3. **Migration file:** `002_tns_and_lifecycle.sql` includes a section 1G (punch_card_usage) that was called out in Task 3C. This table is needed for the Aided storage migration to work with real patients.

4. **No new npm packages installed.** The migration uses only existing dependencies (react, supabase-js).

5. **Aided.jsx is now 864 lines** (was 720). The additions are the mapping function (~50 lines), achievement display constant (~15 lines), achievement state/effect (~15 lines), and achievement render section (~20 lines).

---

## Blockers

None encountered.
