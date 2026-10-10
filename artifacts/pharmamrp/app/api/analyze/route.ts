import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import {
  CAUSE_CODES,
  INTERVENTION_CODES,
  PROBLEM_CODES,
} from "@/lib/classification";
import { GEMINI_ANALYZE_MODEL } from "@/lib/config";
import type {
  AcceptanceCode,
  CauseCode,
  InterventionCode,
  ProblemCode,
} from "@/lib/classification";
import type {
  Medication,
  Problem,
  ProblemSeverity,
} from "@/lib/types";

export const runtime = "nodejs";

const nullableString = z.string().nullable();
const medicationSchema = z
  .object({
    id: z.string().min(1),
    name: nullableString,
    genericName: nullableString,
    dose: nullableString,
    unit: nullableString,
    frequency: nullableString,
    route: nullableString,
    duration: nullableString,
    confidence: z.enum(["high", "low"]).nullable(),
    conditions: z.array(z.string()).nullable(),
    startDate: nullableString,
    orderStatus: z.enum(["active", "stopped", "modified", "unknown"]),
    sourceText: nullableString,
  })
  .strict();
const labOrderSchema = z
  .object({
    test: nullableString,
    date: nullableString,
    sourceText: nullableString,
  })
  .strict();
const AnalyzeRequestSchema = z
  .object({
    medications: z.array(medicationSchema).max(200),
    labOrders: z.array(labOrderSchema).max(200),
    ward: nullableString,
    patientAge: z.number().int().nonnegative().nullable(),
    patientGender: nullableString,
  })
  .strict();

const modelResultSchema = z
  .object({
    problems: z.array(
      z
        .object({
          medicationIndexes: z.array(z.number().int().nonnegative()).min(1),
          problemCode: z
            .enum(PROBLEM_CODES.map(({ code }) => code) as [string, ...string[]])
            .nullable(),
          causeCode: z
            .enum(CAUSE_CODES.map(({ code }) => code) as [string, ...string[]])
            .nullable(),
          explanation: nullableString,
          severity: z.enum(["low", "moderate", "high"]).nullable(),
          suggestedIntervention: z
            .enum(INTERVENTION_CODES.map(({ code }) => code) as [string, ...string[]])
            .nullable(),
          highlights: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

const nullableText = { type: Type.STRING, nullable: true };
const modelResponseSchema = {
  type: Type.OBJECT,
  properties: {
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          medicationIndexes: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
          problemCode: {
            type: Type.STRING,
            enum: PROBLEM_CODES.map(({ code }) => code),
            nullable: true,
          },
          causeCode: {
            type: Type.STRING,
            enum: CAUSE_CODES.map(({ code }) => code),
            nullable: true,
          },
          explanation: nullableText,
          severity: {
            type: Type.STRING,
            enum: ["low", "moderate", "high"],
            nullable: true,
          },
          suggestedIntervention: {
            type: Type.STRING,
            enum: INTERVENTION_CODES.map(({ code }) => code),
            nullable: true,
          },
          highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "medicationIndexes",
          "problemCode",
          "causeCode",
          "explanation",
          "severity",
          "suggestedIntervention",
          "highlights",
        ],
      },
    },
  },
  required: ["problems"],
};

function failure(error = "Analysis could not be completed. Please check the scanned details and try again.") {
  return Response.json({ source: "failed", error }, { status: 200 });
}

function toProblems(
  result: z.infer<typeof modelResultSchema>,
  medications: Medication[],
  labOrders: z.infer<typeof labOrderSchema>[],
): Problem[] {
  return result.problems.map((suggestion) => {
    if (
      suggestion.medicationIndexes.some(
        (index) => index < 0 || index >= medications.length,
      )
    ) {
      throw new Error("Invalid medication reference.");
    }

    const referencedMedications = suggestion.medicationIndexes.map(
      (index) => medications[index]!,
    );
    const citedText = [
      ...referencedMedications.map((medication) => medication.sourceText),
      ...labOrders.map((order) => order.sourceText),
    ].filter((text): text is string => Boolean(text));

    if (
      suggestion.highlights.some(
        (highlight) => !citedText.some((text) => text.includes(highlight)),
      )
    ) {
      throw new Error("A source highlight did not match the supplied prescription text.");
    }

    return {
      id: crypto.randomUUID(),
      medicationIds: referencedMedications.map((medication) => medication.id),
      problemCode: suggestion.problemCode as ProblemCode | null,
      causeCode: suggestion.causeCode as CauseCode | null,
      explanation: suggestion.explanation,
      severity: suggestion.severity as ProblemSeverity | null,
      suggestedIntervention: suggestion.suggestedIntervention as
        | InterventionCode
        | null,
      finalIntervention: null,
      acceptance: null as AcceptanceCode | null,
      reviewStatus: "suggested",
      highlights: suggestion.highlights,
      notes: null,
    };
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini is not configured.");
    }

    const body = AnalyzeRequestSchema.parse(await request.json());
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_ANALYZE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Analyze the confirmed medication orders and lab orders below for clear medication-related problems. Return only the requested structured fields.",
                "Suggest a problem only when the supplied medication, lab, ward, age, or gender information gives a clear reason. If there is no clear issue, return an empty problems array.",
                "Never invent drug interactions, infer facts not provided, or use unsupported external clinical assumptions. Treat this as decision support: the pharmacist makes the final decision.",
                "Use only these broad PCNE codes: " +
                  PROBLEM_CODES.map(({ code, label }) => `${code}=${label}`).join(", ") +
                  "; causes: " +
                  CAUSE_CODES.map(({ code, label }) => `${code}=${label}`).join(", ") +
                  "; interventions: " +
                  INTERVENTION_CODES.map(({ code, label }) => `${code}=${label}`).join(", ") +
                  ".",
                "For medicationIndexes use zero-based indexes into the medications array. Link every problem to one or more relevant medications. Each highlight must be an exact contiguous quote from the supplied medication or lab sourceText. If a code, explanation, or severity is uncertain, return null for that field. Do not include patient names or file numbers.",
                JSON.stringify({
                  medications: body.medications,
                  labOrders: body.labOrders,
                  ward: body.ward,
                  patientAge: body.patientAge,
                  patientGender: body.patientGender,
                }),
              ].join(" "),
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: modelResponseSchema,
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned no structured result.");
    }

    const parsed = modelResultSchema.parse(JSON.parse(response.text));
    const problems = toProblems(parsed, body.medications, body.labOrders);
    return Response.json({ problems, source: "ai" });
  } catch {
    return failure();
  }
}
