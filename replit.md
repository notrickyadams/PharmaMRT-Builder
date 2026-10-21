# PharmaMRP
Documentation assistant for clinical pharmacists. Hackathon demo.

## Problem
Clinical pharmacists find medication-related problems (MRPs) in prescriptions, such as drug
interactions, wrong doses or duplicate therapy, and make interventions. They document every case
by hand on paper and count them manually for a monthly report. It takes hours and data gets lost.

## Solution
Photograph a prescription. The AI lists the medications and suggests MRPs with categories.
The pharmacist accepts, edits or rejects each one, then saves a reviewed case.
Monthly reports and Excel export are planned, not implemented.
Core rule: the AI suggests, the pharmacist decides.

## Main features
1. Scan prescription → editable medication list
2. AI MRP suggestions, each citing the exact prescription text it came from
3. Pharmacist review: accept, edit, reject, or add a missed problem
4. Records log
5. Monthly report with .xlsx export (planned; outside the current review flow)
6. Manual entry form if the scan or AI fails

## Data (lib/types.ts)
Prescription: id, scannedAt, ward, patientAge, patientGender, medications, problems, status (pending | reviewed).
Medication: id, name, dose, unit, frequency, route, duration, sourceText.
Problem: id, medicationIds, problemCode, causeCode, explanation, severity (low | moderate | high),
suggestedIntervention, finalIntervention, acceptance, reviewStatus
(suggested | accepted | edited | rejected | added), highlights (exact source text), notes.

## Classification (lib/classification.ts)
PCNE: Problems P1–P3, Causes C1–C9, Interventions I0–I4, Acceptance A1–A3.

## Hub and spoke
Hub files: replit.md, lib/types.ts, lib/classification.ts. Never edit them unless I ask.
Each task only changes the folder named in its prompt.

## Stack
Next.js App Router, TypeScript, Tailwind, Framer Motion, SheetJS.
AI: Gemini via @google/genai, key in GEMINI_API_KEY (server only), model name in lib/config.ts.
Structured JSON output, validated. On failure or timeout, fall back to manual entry. Never crash.
Storage: localStorage in try/catch, plus a "Reset demo" button.

## Rules
- Never store patient names or real patient IDs. Patient is always displayed as `unspecified`,
  with no Show control or name-entry field. Only the existing explicitly fictional
  `DEMO-FILE-001`–`DEMO-FILE-003` identifiers may be displayed/stored, matched to their
  original fictional prescription IDs. Missing, mismatched and nonfictional identifiers
  remain unspecified. Internal case/medication IDs are not patient identifiers.
- Never invent interactions or facts. Demo uses fictional prescriptions only.
- Arabic renders right-to-left. Mobile first (375px).
- Smallest change that does the job. No extra libraries unless asked.

## Implemented workflow
- The Next.js App Router app is in `artifacts/pharmamrp`.
- `/` shows PharmaMRP, Scan a treatment sheet, Records, and Reset demo.
  Reset explicitly confirms replacement of all locally saved cases with exactly three
  fictional reviewed cases; it does not call an API. The two supported clarification
  problems in each fixture are marked reviewed; the deliberately flawed third
  suggestion is excluded, including the duplicate-antibiotic suggestion for stopped
  Rocephin. Intervention acceptance remains unspecified, independently of review status.
- `/scan` accepts camera/image uploads (`image/*`, environment capture), prepares a JPEG
  at maximum dimension 1600px, and shows “Reading the sheet…” during conversion/request.
  Scan errors, HTTP errors, invalid envelopes, timeouts and image-conversion failures
  offer Enter manually. If a sheet is already entered, manual fallback preserves it.
- Medication rows can be edited by keyboard or touch; medication name, generic name,
  dose/unit, frequency, route, duration and order status remain unspecified when absent.
  Low-confidence rows are amber with “Check this”; stopped names are struck through.
  Pharmacists can add/remove rows. Original source text is retained unchanged after
  corrections. Manual rows lacking source text receive a transparent, labelled
  transcription of supplied fields at confirmation; no clinical facts are inferred.
- Lab orders appear as chips grouped by their supplied dates. Explicit fixture lab
  results are kept separately as results; undated labs remain undated. Orders are never
  interpreted as results. Lab correction and manual order/result entry are supported.
- “I have checked the medications and labs” gates analysis and manual completion.
  Subsequent changes invalidate confirmation without discarding existing decisions
  or in-progress problem edits. Empty added medication/lab rows must be completed or
  removed. A pharmacist can complete a zero-problem review without an AI request.
- Problem cards show involved drugs (including stopped status), explanations, exact
  quotations where supplied, readable PCNE labels, severity, notes and
  “AI suggestion — needs pharmacist review”. All suggestions require Accept, Edit or
  Reject. Edits/additions require medications, explanation, PCNE problem/cause,
  severity and final intervention. Intervention outcome is optional and is not
  inferred from accepting a problem. Save is disabled during an unfinished edit.
- Save persists only accepted, edited and pharmacist-added problems, never rejected
  or undecided suggestions. All-rejected and zero-problem cases can be saved.
  Successful save exposes Scan next sheet and View records. A stable per-review
  saved-case ID and submission locks prevent duplicate saves. Failed writes retain
  the current review and never display success.
- `/records` lists locally saved cases newest first; `/records/[id]` shows verified
  medications/labs, original evidence and saved decisions. Loading, empty, missing,
  malformed, unavailable and full-storage states are handled explicitly.
  Records survive reload on the same browser; storage/focus events refresh records.
- Scoped component styles/fonts use teal, off-white, white cards, red high severity,
  amber moderate severity, neutral grey low severity, green success, Rubik headings
  and Inter body. Tables scroll within their own containers at 375px; Arabic text uses
  automatic direction. Layout, globals, dependencies and configuration are unchanged.
- `/test` remains an untouched diagnostic page, outside the new navigation.
  New workflow pages do not display raw JSON, debug/source fields or “Demo mode”.

## Persistence and privacy limits
- Storage is browser-only `localStorage` under `pharmamrp-reviewed-v1`. There is no
  server persistence, authentication, backup or cross-device synchronization.
  Clearing browser storage loses records. Reset is an explicitly destructive replacement.
- Input/storage models project explicit allowlisted fields, immediately dropping
  `patientName` and unknown identity properties. File numbers are allowlisted against
  the three fictional fixtures. Never upload or enter real patient information,
  including into free-text medication evidence, ward, explanation or notes.
  Free text is not a general-purpose de-identification system.
- Storage reads validate records and fail explicitly rather than silently erasing
  malformed data. Writes are guarded against unavailable/full storage; a failed
  read prevents appending over damaged records.

## Unchanged API contracts and demo limitations
- `POST /api/scan` still accepts exactly `{ imageBase64, mimeType }`. Its response
  is `{ prescription, source }`, or an HTTP-200 failed envelope with a null
  prescription and error. Client code also checks HTTP errors and invalid payloads.
- `POST /api/analyze` still accepts exactly `{ prescription: Prescription }`.
  The client submits only the original shared Prescription/Medication fields,
  without file numbers, names, generic/order/confidence/lab UI extensions.
  Original fictional prescription IDs are preserved for fixture pairing.
  Analysis responses must have a matching prescription ID, valid medication
  references and exact quotations; unrelated fixture medications are never remapped
  to manual entries. Failures offer manual pharmacist review.
- `DEMO_MODE` remains true. Existing endpoints return fixed fictional fixtures and
  do not read uploaded images or analyze clinical corrections. This limitation is
  stated visibly on scanned fictional cases. Fixture-only generic names, confidence,
  order status, file numbers and labs are supported client-side, but the unchanged
  production scan contract does not supply those extensions; absent values remain null.
- Provider configuration, prompts, schemas, shared types/classification, fixtures,
  API routes and `/test` are unchanged. No live Gemini requests are permitted during
  verification; use demo fixtures or fully mocked responses/provider calls only.

## Verification
- Use the existing Node.js/shell toolchain for checks. Invoking an absent runtime
  can automatically add a language module to `.replit` in this workspace; keep
  scope-limited work free of incidental runtime/configuration changes.
- `pnpm --filter @workspace/pharmamrp typecheck` checks the app.
- `node --test artifacts/pharmamrp/components/workflow.test.mjs` checks client
  normalization/privacy, exact API projection, all three fixtures, incompatible
  suggestions, reset review decisions, zero-problem/idempotent saves and malformed,
  unavailable/full storage with mocked browser storage (no network).
- The inherited `pnpm --filter @workspace/pharmamrp test` runner currently fails
  resolving an extensionless import in the unchanged API test loader. Its expectations
  also predate the current demo/provider configuration. Protected test/API files are
  intentionally not modified by this review-flow implementation.
- An in-memory compatibility harness (extension resolution and entirely synthetic
  provider/config mocks; no app configuration changes) ran the inherited scan suite:
  17 of 18 checks passed. The remaining assertion expects the obsolete
  “check the Gemini API key” wording instead of the current provider/access guidance.
- At 375×812, browser verification passed fixture-one upload/loading, Arabic/unspecified
  identity, contained table scroll, stopped/low-confidence cues, medication/lab correction
  with original evidence retained, confirmation invalidation, accept/edit/reject/add,
  unfinished-draft save gating, duplicate-save protection and records/detail reload.
- Remaining mobile checks passed fixture-two all-rejected saving, fixture-three
  HTTP-200 analysis-failure/manual saving with work retained, scan HTTP/network/invalid
  payload and pre-request image-conversion failures, manual medication/lab add/correct/
  remove, storage write failure with retained review and a single successful retry,
  malformed-record recovery without erasure, and reset/reload/detail of all three
  newest-first fictional cases. Each reset case retained exactly two supported problems.
  Unavailable-storage behavior is also covered by the mocked storage checks above.
