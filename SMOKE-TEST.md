# Flora PR #3 isolated test setup

Based on PR #3 commit 4da108f56d7a1b123ee6aa5ebb456bdc78fc16c0.
The existing frontend components are unmodified. Vite aliases Firebase imports
only in this test harness. Gemini requests are intercepted and return a clearly
labelled fixture; this is not live Firebase/Gemini verification.

## Run (Windows ARM, macOS, Linux)
Install Node.js 22.12+ (24 LTS recommended), open a terminal here, then:

```
npm ci
npm test
npm run dev
```
Open http://127.0.0.1:5173. `npm run build` verifies the entire React dependency
graph. Bindings are localhost only. No API key, Firebase account or deployment
is required. No service worker is installed. Test records persist in this
browser under the unique flora-pr3-smoke-v1 key; Reset test data clears only it.
Clearing browser storage also removes test records. Large image storage can
hit browser quota; use small PNG/JPEG images. The original uploader limit is 1MB.

## Minimal UI smoke pass
1. Add `ZZ Smoke` species `Aloe`, interval 7; then `AA Smoke` species `Pothos`,
   interval 2. Reload and check persistence.
2. Mark watered on one card and the other detail view. Edit one from its card,
   the other from detail, changing name/species/interval. Reload and confirm.
3. Search name and species, then nonsense; Clear search restores the list.
   Cycle newest/oldest/name/species/watering-due and check expected order.
4. Open a plant, Log health update, choose a small PNG, Analyze with AI.
   Confirm SIMULATED text. Save, reload, expand entry and edit notes.
   Repeat with JPEG. With browser developer tools, inspect
   window.__lastSmokeGeminiRequest to check PNG/JPEG MIME and endpoint.
5. Enable Simulate Gemini failure; analyze again. Confirm visible error,
   disable failure and retry successfully. Save a second entry and delete it.
6. Cancel plant deletion once. Delete one plant from card, the other from
   detail while it still has a health entry. Confirm dashboard returns and
   reload stays empty. localStorage['flora-pr3-smoke-v1'] should equal '{}'.

## Scope and release gate
Node tests cover watering date boundaries, MIME detection and simulated store
behavior. A successful build is compile evidence, not a browser test. Record UI
results independently. Test double cannot prove Firebase authorization, cloud
persistence, concurrency, Gemini key eligibility, model availability, networking
or schema compatibility. No claim of a passed real-host test is made.

Before PR #3 merges, run the same UI sequence in its actual configured host,
confirm cloud persistence and health-log cascade, and get a real successful PNG
Gemini response. The model in frontend/utils/ai.js is Gemini 3.5 Flash-Lite; the former
preview model was shut down. Real model availability and schema compatibility
still require a successful live request.
Do not put real keys into this harness: it always uses aliases and fixtures.
Live integration should be configured separately with Firebase rules and a
server-side Gemini credential; browser-exposed keys require deliberate controls.

Known existing limitation: plant deletion uses one batch for all children plus
parent. The test double enforces the documented 500-operation assumption; it
is not a substitute for testing current Firestore behavior on large collections.

## Changes
Adds runnable Vite + React/Tailwind entry point, local test doubles, failure
control, reset, lockfile and actual CI build/tests. Product frontend preserved.
Do not deploy this simulation as the production plant tracker.

## Verification recorded 2026-10-25
- `npm test`: 3 passing tests.
- `npm run build`: passed, Vite 7.3.7, 1600 modules transformed.
- Browser automation attempted but unavailable: Playwright's Chromium executable
  is not installed in the executor. Manual UI checklist above remains unchecked.
- Real Firebase/Gemini host test remains blocked by missing host/configuration.
