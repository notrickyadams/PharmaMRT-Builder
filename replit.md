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
Structured JSON output, validated. On failure or timeout, fall back to manual entry. Never crash.
Storage: localStorage in try/catch, plus a "Reset demo" button.

## Rules
- Never store patient names or IDs. Only ward, age, gender, medications.
- Never invent interactions or facts. Demo uses fictional prescriptions only.
- Arabic renders right-to-left. Mobile first (375px).
- Smallest change that does the job. No extra libraries unless asked.
