import { Type } from "@google/genai";
import { z } from "zod";
import {
  ACCEPTANCE_CODES, CAUSE_CODES, INTERVENTION_CODES, PROBLEM_CODES,
} from "@/lib/classification";
import type { Medication, Problem } from "@/lib/types";

const text = z.string().max(8_000).nullable();
const problemCode = z.enum(PROBLEM_CODES.map(({ code }) => code) as [string, ...string[]]).nullable();
const causeCode = z.enum(CAUSE_CODES.map(({ code }) => code) as [string, ...string[]]).nullable();
const intervention = z.enum(INTERVENTION_CODES.map(({ code }) => code) as [string, ...string[]]).nullable();
const severity = z.enum(["low", "moderate", "high"]).nullable();
const identifier = z.string().min(1).max(128);

const medicationSchema = z.object({
  id: identifier,
  name: text, dose: text, unit: text, frequency: text, route: text, duration: text,
  sourceText: z.string().min(1).max(8_000).nullable(),
}).strict();

const submittedProblemSchema = z.object({
  id: identifier,
  medicationIds: z.array(identifier).min(1).max(100),
  problemCode, causeCode, explanation: text, severity,
  suggestedIntervention: intervention, finalIntervention: intervention,
  acceptance: z.enum(ACCEPTANCE_CODES.map(({ code }) => code) as [string, ...string[]]).nullable(),
  reviewStatus: z.enum(["suggested", "accepted", "edited", "rejected", "added"]),
  highlights: z.array(z.string().max(8_000)).max(100),
  notes: text,
}).strict();

/**
 * POST /api/analyze accepts { prescription: Prescription } with every field of
 * the scanned Prescription contract, no extra fields, unique medication IDs,
 * and at least one nonblank sourceText. Existing problems are validated but not
 * sent to Gemini. Only indexed medication sourceText is sent for analysis.
 * Returns { prescriptionId, problems: Problem[], source: "ai" }, or
 * { problems: null, source: "failed", error: string } (HTTP 200).
 */
export const analyzeRequestSchema = z.object({
  prescription: z.object({
    id: identifier,
    scannedAt: z.string().datetime(),
    ward: text,
    patientAge: z.number().int().nonnegative().nullable(),
    patientGender: text,
    medications: z.array(medicationSchema).min(1).max(100),
    problems: z.array(submittedProblemSchema).max(200),
    status: z.enum(["pending", "reviewed"]),
  }).strict().superRefine((prescription, context) => {
    const ids = new Set(prescription.medications.map(({ id }) => id));
    if (ids.size !== prescription.medications.length ||
      !prescription.medications.some(({ sourceText }) => sourceText?.trim())) {
      context.addIssue({ code: "custom", message: "Invalid medication context." });
    }
    for (const problem of prescription.problems) {
      const sources = prescription.medications
        .filter(({ id }) => problem.medicationIds.includes(id))
        .map(({ sourceText }) => sourceText);
      if (problem.medicationIds.some((id) => !ids.has(id)) ||
        problem.highlights.some((quote) => !sources.some((source) => source?.includes(quote)))) {
        context.addIssue({ code: "custom", message: "Invalid problem context." });
      }
    }
  }),
}).strict();

// Same model Problem fields, nullability, enums, and exact-citation rules as scan.
export const analyzeResultSchema = z.object({
  problems: z.array(z.object({
    medicationIndexes: z.array(z.number().int().nonnegative()).min(1),
    problemCode, causeCode, explanation: z.string().nullable(), severity,
    suggestedIntervention: intervention,
    highlights: z.array(z.string()),
  }).strict()),
}).strict();

const nullableText = { type: Type.STRING, nullable: true };
export const analyzeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          medicationIndexes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          problemCode: { ...nullableText, enum: PROBLEM_CODES.map(({ code }) => code) },
          causeCode: { ...nullableText, enum: CAUSE_CODES.map(({ code }) => code) },
          explanation: nullableText,
          severity: { ...nullableText, enum: ["low", "moderate", "high"] },
          suggestedIntervention: { ...nullableText, enum: INTERVENTION_CODES.map(({ code }) => code) },
          highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "medicationIndexes", "problemCode", "causeCode", "explanation",
          "severity", "suggestedIntervention", "highlights",
        ],
      },
    },
  },
  required: ["problems"],
};

export class AnalyzeError extends Error {
  constructor(readonly reason: "timeout" | "empty_output" | "invalid_reference" | "invalid_highlight") {
    super(reason);
  }
}

export function toProblems(
  result: z.infer<typeof analyzeResultSchema>,
  medications: Medication[],
): Problem[] {
  return result.problems.map((problem) => {
    if (problem.medicationIndexes.some((index) => index >= medications.length)) {
      throw new AnalyzeError("invalid_reference");
    }
    const cited = problem.medicationIndexes.map((index) => medications[index]!);
    if (!cited.some(({ sourceText }) => sourceText?.trim()) ||
      problem.highlights.some((quote) => !cited.some(({ sourceText }) => sourceText?.includes(quote)))) {
      throw new AnalyzeError("invalid_highlight");
    }
    return {
      id: crypto.randomUUID(),
      medicationIds: cited.map(({ id }) => id),
      problemCode: problem.problemCode as Problem["problemCode"],
      causeCode: problem.causeCode as Problem["causeCode"],
      explanation: problem.explanation,
      severity: problem.severity,
      suggestedIntervention: problem.suggestedIntervention as Problem["suggestedIntervention"],
      finalIntervention: null,
      acceptance: null,
      reviewStatus: "suggested",
      highlights: problem.highlights,
      notes: null,
    };
  });
}
