# PharmaMRP
AI documentation assistant for clinical pharmacists. Hackathon demo.

## Problem
Clinical pharmacists find medication-related problems (MRPs) in prescriptions, such as drug
interactions, wrong doses or duplicate therapy, and make interventions. They document every case
by hand on paper and count them manually for a monthly report. It takes hours and data gets lost.

## Solution
Photograph a prescription. The AI lists the medications and suggests MRPs with categories.
The pharmacist accepts, edits or rejects each one. One click generates the monthly report.
Core rule: the AI suggests, the pharmacist decides.

## Main features
1. Scan prescription → editable medication list
2. AI MRP suggestions, each citing the exact prescription text it came from
3. Pharmacist review: accept, edit, reject, or add a missed problem
4. Records log
5. Monthly report with .xlsx export
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
Structured JSON output, validated. On failure, return a failed-result envelope and keep manual entry as fallback. Never crash.
Storage: localStorage in try/catch, plus a "Reset demo" button.

## Rules
- Patient name and file number are stored locally only, masked on screen by default, and never sent to the analyze step. The demo uses fictional patients only.
- Never invent interactions or facts. Demo uses fictional prescriptions only.
- Arabic renders right-to-left. Mobile first (375px).
- Smallest change that does the job. No extra libraries unless asked.

## Implemented foundation
- The Next.js App Router app is in `artifacts/pharmamrp`.
- `/test` is a bare two-step scan-and-analyze page. It resizes images to a maximum dimension of about 2400px, displays low-confidence medication rows and lab orders, masks identifiers by default, and shows raw JSON for both steps.
- `POST /api/scan` uses `@google/genai` on the server with `GEMINI_API_KEY`, structured JSON output, and Zod validation. It extracts identifiers, medications, and lab orders; it does not generate problems.
- Scan uses `gemini-3-flash-preview` and streams JSON-compatible whitespace keepalives while Gemini works, without a custom scan timeout or persistent server-side result storage. The test page checks HTTP status, content type, and response shape and reports gateway/connection failures without displaying HTML or raw parsing errors.
- `POST /api/analyze` accepts only medications, lab orders, ward, age, and gender. It uses the configured analyze model, validates structured PCNE suggestions, and never receives patientName or fileNumber.
- `lib/types.ts` includes nullable scan fields, medication confidence/order details, and lab orders. `lib/config.ts` exposes separate scan and analyze Gemini models. Missing or uncertain values remain null; problems require exact source highlights.
- This step adds only the app foundation and scan test surface. Records, pharmacist review, manual-entry workflow, local persistence, and reports are not implemented yet.
