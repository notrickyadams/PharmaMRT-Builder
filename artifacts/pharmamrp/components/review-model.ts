import { z } from "zod";
import type { Prescription, Problem } from "@/lib/types";
import { ACCEPTANCE_CODES, CAUSE_CODES, INTERVENTION_CODES, PROBLEM_CODES } from "@/lib/classification";

const text = z.string().max(8000).nullable();
const id = z.string().min(1).max(128);
const code = (values: readonly { code: string }[]) =>
  z.string().refine(value => values.some(item => item.code === value)).nullable();
export const medicationSchema = z.object({
  id, name: text, dose: text, unit: text, frequency: text, route: text,
  duration: text, sourceText: text,
  genericName: text.default(null),
  orderStatus: z.enum(["active", "stopped", "modified"]).nullable().default(null),
  confidence: z.enum(["high", "moderate", "low"]).nullable().default(null),
});
export const problemSchema = z.object({
  id, medicationIds: z.array(id).min(1), problemCode: code(PROBLEM_CODES),
  causeCode: code(CAUSE_CODES), explanation: text,
  severity: z.enum(["high", "moderate", "low"]).nullable(),
  suggestedIntervention: code(INTERVENTION_CODES),
  finalIntervention: code(INTERVENTION_CODES), acceptance: code(ACCEPTANCE_CODES),
  reviewStatus: z.enum(["suggested", "accepted", "edited", "rejected", "added"]),
  highlights: z.array(z.string().min(1).max(8000)), notes: text,
});
export type ReviewMedication = z.infer<typeof medicationSchema>;
export type Lab = {
  id: string; kind: "order" | "result"; name: string | null; date: string | null;
  value: string | null; unit: string | null; sourceText: string | null;
};
export type Review = {
  id: string; scannedAt: string; ward: string | null; patientAge: number | null;
  patientGender: string | null; medications: ReviewMedication[]; labs: Lab[];
  fileNumber: string | null; fictional: boolean;
};
const coreSchema = z.object({
  id, scannedAt: z.string().datetime(), ward: text,
  patientAge: z.number().int().nonnegative().nullable(), patientGender: text,
  medications: z.array(medicationSchema).max(100),
});
export const labSchema = z.object({
  id, kind: z.enum(["order", "result"]), name: text, date: text, value: text, unit: text, sourceText: text,
});
export const reviewSchema = coreSchema.extend({
  labs: z.array(labSchema).max(200), fileNumber: text, fictional: z.boolean(),
});
export const fictionalFiles: Record<string, string> = {
  "demo-prescription-1": "DEMO-FILE-001",
  "demo-prescription-2": "DEMO-FILE-002",
  "demo-prescription-3": "DEMO-FILE-003",
};
export function normalizeScan(raw: unknown, source: unknown): Review {
  const core = coreSchema.parse(raw); // Explicit projection drops identity fields immediately.
  const extra = z.object({
    fileNumber: text.optional(),
    labOrders: z.array(z.object({ test: text, date: text, sourceText: text })).optional(),
    labs: z.array(z.object({
      name: text, value: z.union([z.string(), z.number()]).nullable(),
      unit: text, sourceText: text, date: text.optional(),
    })).optional(),
  }).parse(raw);
  const fictional = source === "demo" && !!fictionalFiles[core.id];
  return {
    ...core, fictional,
    fileNumber: fictional && extra.fileNumber === fictionalFiles[core.id] ? extra.fileNumber : null,
    labs: [
      ...(extra.labOrders ?? []).map((lab, i): Lab => ({
        id: `order-${i}`, kind: "order", name: lab.test, date: lab.date,
        value: null, unit: null, sourceText: lab.sourceText,
      })),
      ...(extra.labs ?? []).map((lab, i): Lab => ({
        id: `result-${i}`, kind: "result", name: lab.name, date: lab.date ?? null,
        value: lab.value === null ? null : String(lab.value), unit: lab.unit, sourceText: lab.sourceText,
      })),
    ],
  };
}
export function emptyReview(): Review {
  return { id: crypto.randomUUID(), scannedAt: new Date().toISOString(), ward: null,
    patientAge: null, patientGender: null, medications: [], labs: [], fileNumber: null, fictional: false };
}
export function blankMedication(): ReviewMedication {
  return medicationSchema.parse({ id: crypto.randomUUID(), name: null, dose: null,
    unit: null, frequency: null, route: null, duration: null, sourceText: null });
}
export const display = (value: string | null | undefined) => value?.trim() || "unspecified";
export const nullable = (value: string) => value.trim() || null;
export function validReview(review: Review) {
  return review.medications.length <= 100 && review.labs.length <= 200 &&
    review.medications.every(m => [m.name, m.genericName, m.dose, m.unit, m.frequency, m.route, m.duration, m.sourceText].some(v => v?.trim())) &&
    review.labs.every(l => !!l.name?.trim() || !!l.sourceText?.trim());
}
export function apiPrescription(review: Review): Prescription {
  return {
    id: review.id, scannedAt: review.scannedAt, ward: review.ward,
    patientAge: review.patientAge, patientGender: review.patientGender,
    medications: review.medications.map(({ id, name, dose, unit, frequency, route, duration, sourceText }) =>
      ({ id, name, dose, unit, frequency, route, duration, sourceText })),
    problems: [], status: "pending",
  };
}
export function parseProblems(raw: unknown, review: Review): Problem[] {
  const parsed = z.array(problemSchema).max(200).parse(raw) as Problem[];
  if (new Set(parsed.map(p => p.id)).size !== parsed.length) throw new Error("Duplicate problems");
  for (const p of parsed) {
    const meds = review.medications.filter(m => p.medicationIds.includes(m.id));
    if (p.medicationIds.some(id => !meds.some(m => m.id === id)) ||
      p.highlights.some(quote => !meds.some(m => m.sourceText?.includes(quote)))) {
      throw new Error("Suggestions do not match the verified medication sources.");
    }
  }
  return parsed;
}
export function validProblem(p: Problem, review: Review) {
  return !!p.explanation?.trim() && !!p.problemCode && !!p.causeCode && !!p.severity &&
    !!p.finalIntervention && p.medicationIds.length > 0 &&
    p.medicationIds.every(id => review.medications.some(m => m.id === id)) &&
    p.highlights.every(quote => review.medications.some(m =>
      p.medicationIds.includes(m.id) && m.sourceText?.includes(quote)));
}
export function codeLabel(values: readonly { code: string; label: string }[], code: string | null) {
  return values.find(value => value.code === code)?.label ?? "unspecified";
}
