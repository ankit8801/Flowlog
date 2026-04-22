# Focus Tracker

Focus Tracker is a privacy-first productivity system with two parts:

- A Chrome extension that tracks browsing sessions, classifies activity, and enforces focus mode.
- A Next.js dashboard that visualizes focus analytics, session history, and cognitive insights.

All data is stored locally on the user device. No backend server is required for core functionality.

## What this project does

- Tracks active tab sessions and logs site, duration, and category.
- Classifies sites as productive or distracting using:
  - user labels,
  - behavior heuristics,
  - and category fallback rules.
- Supports focus sessions with blocked sites and warnings.
- Shows analytics in a dashboard:
  - focus score,
  - category breakdown,
  - usage graph,
  - top sites,
  - session history,
  - AI-style insight summary,
  - productivity pet,
  - cognitive state timeline.
- Includes extension packaging automation so the dashboard can serve a downloadable zip.

## Tech stack

- Dashboard: Next.js 14 (App Router), React 18, Zustand, Recharts, Tailwind CSS
- Extension: Chrome Extension Manifest V3 (service worker + content scripts)
- Storage: IndexedDB (shared schema name across app and extension)
- Deployment: Vercel (configured from repo root via vercel.json)

## Repository structure

- dashboard/: Next.js dashboard app
- extension/: Chrome extension source
- vercel.json: root-level Vercel build routing into dashboard/

Key files:

- dashboard/app/page.jsx: main UI shell and tabbed dashboard
- dashboard/app/lib/store.js: Zustand global state and orchestration
- dashboard/app/lib/db.js: IndexedDB wrapper used by dashboard
- dashboard/app/lib/focusMode.js: focus mode settings/session operations + extension sync bridge
- extension/background.js: session tracking, classification, focus enforcement, event logging
- extension/content.js: page-level blocking/warning behavior
- extension/bridge.js: postMessage bridge between localhost dashboard and extension storage queues
- extension/popup/popup.js: popup controls for quick focus session actions
- dashboard/scripts/zip-extension.js: builds extension zip into dashboard/public

## Architecture and data flow

1. Extension service worker tracks browsing sessions from active tabs.
2. It writes session/activity records into extension IndexedDB and queues data in chrome.storage.local.
3. On dashboard pages, bridge.js flushes queued records into the page via window.postMessage.
4. Dashboard listeners persist those records into dashboard IndexedDB.
5. Zustand store loads and processes logs into metrics and insight cards.
6. Focus settings changed in dashboard are posted back through bridge.js and persisted to chrome.storage.local so extension scripts react immediately.

## Prerequisites

- Node.js 18.18+ (recommended Node 20 LTS)
- npm 9+
- Google Chrome or another Chromium browser that supports Manifest V3

## Local development

### 1) Install dependencies

From the repository root:

```powershell
cd dashboard
npm install
```

### 2) Run dashboard

```powershell
npm run dev
```

Dashboard URL:

- http://localhost:3000

### 3) Build extension zip (optional for local, automatic before production build)

```powershell
npm run zip:extension
```

Output file:

- dashboard/public/focus-tracker-extension.zip

### 4) Auto-rebuild extension zip during extension changes (optional)

```powershell
npm run zip:watch
```

## Load the browser extension

Recommended local workflow (Load unpacked):

1. Open chrome://extensions
2. Enable Developer mode
3. Click Load unpacked
4. Select the extension/ folder

Alternative workflow:

- Use the dashboard download button to get focus-tracker-extension.zip and add it in Developer Mode.

## Available scripts (dashboard/package.json)

- npm run dev: start Next.js dev server
- npm run build: production build (runs prebuild first)
- npm run start: start production server
- npm run lint: run linting
- npm run zip:extension: generate extension zip in public/
- npm run zip:watch: regenerate zip on extension file changes
- npm run prebuild: auto-hook that runs zip:extension before build

## Data model and privacy

Database name used by both parts:

- focus_tracker_db

Main object stores:

- activity_log: site usage analytics
- sessions: detailed session records
- focus_events: focus warnings/blocks/session events/cognitive snapshots
- settings: focus mode configuration
- user_labels: user overrides for domain classification

Privacy model:

- No remote API is required for normal operation.
- All tracking data remains in local browser storage.
- Clearing demo data keeps real extension-tracked data intact.

## Deployment (Vercel)

This repo is configured so Vercel can point at root while running commands inside dashboard/.

- installCommand: cd dashboard && npm ci
- buildCommand: cd dashboard && npm run build
- devCommand: cd dashboard && npm run dev

Before build, prebuild creates dashboard/public/focus-tracker-extension.zip so production includes extension download.

## Troubleshooting

### Dashboard shows demo data only

- Ensure extension is installed and active.
- Browse a few sites with the extension enabled.
- Return to dashboard and refresh.
- If needed, use Clear Demo Data in the dashboard notice.

### Focus settings are not applied on tabs

- Confirm you opened the dashboard on http://localhost:3000 so bridge.js runs.
- Ensure extension has host permission for localhost URLs (already in manifest).
- Toggle focus mode off/on from dashboard and test again.

### Extension popup says inactive or no stats

- Reload extension on chrome://extensions.
- Make sure at least one browsing session has occurred.
- Check that the extension service worker is running in extension details.

### Zip download missing in dashboard

- Run npm run zip:extension in dashboard/.
- Confirm file exists at dashboard/public/focus-tracker-extension.zip.

## Current limitations

- Browser support is currently focused on Chrome/Chromium extension APIs.
- Local dashboard integration is tuned for localhost URLs listed in extension/manifest.json.
- There is no cloud sync or account system yet.

## Suggested next improvements

- Add automated tests for classification and focus mode rules.
- Add import/export for user labels and settings.
- Add release packaging workflow for Chrome Web Store submission.
