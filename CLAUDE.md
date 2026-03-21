# Distil

Provider-facing React CRM for hearing instrument specialists at My Hearing Centers (WSAudiology subsidiary). Handles patient intake, audiometric testing, device selection, insurance plan management, and care plan pricing.

## Tech Stack

- **Frontend**: React 18, Vite, JSX (no TypeScript)
- **Backend**: Supabase (Postgres + Realtime), data layer in `src/db.js`
- **Deployment**: Vercel with auto-deploy on push to `main`
- **Live**: `distil-lime.vercel.app` (CRM), `distil-lime.vercel.app/intake` (kiosk)

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (Vite, port 5173)
npm run build      # Production build to dist/
npm run preview    # Preview production build locally
```

No test runner, linter, or formatter is configured.

## Project Structure

```
src/
  main.jsx           # App entry point, routing (/ → CRM, /intake → kiosk)
  Distil.jsx          # Main CRM component (~3700 lines)
  IntakeKiosk.jsx     # Patient intake form (no auth)
  Login.jsx           # Provider auth UI
  db.js               # Supabase data layer (all queries)
  supabase.js         # Supabase client init
  views/              # Modular feature components
    CampaignDetail.jsx
    CampaignManager.jsx
    ContentLibrary.jsx
    LimaCharlie.jsx
```

## Architecture Rules

- **Plan tier ≠ device generation**: Standard/Advanced/Premium are pricing labels. Device generation (X/AX/IX) comes from TH series selection. Do not conflate.
- **Li-Ion upcharge**: $50/aid added to displayed patient cost
- **TH5 BTE**: Always available regardless of plan tier
- **Beltone**: Use Rexton-only designation (no proprietary auth)
- **Normal hearing threshold**: 20 dB (not 25 dB)
- **Intake IDs**: Format `MHC-YYYYMMDD-XXXXX`
- **HIPAA consent**: Verbatim MHC legal language required

## Conventions

- All environment variables prefixed with `VITE_` (required by Vite)
- Supabase credentials in `.env` — never commit secrets
- SPA routing handled via `vercel.json` rewrite rules
- Be direct and opinionated. Explain reasoning before writing code. Ask clarifying questions before large tasks.
