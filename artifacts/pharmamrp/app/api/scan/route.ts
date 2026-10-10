import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { CAUSE_CODES, INTERVENTION_CODES, PROBLEM_CODES } from "@/lib/classification";
import { DEMO_MODE, GEMINI_MODEL } from "@/lib/config";
import { demoResponse } from "@/lib/demo/index";
import type { Medication, Prescription, Problem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 20;

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BASE64_LENGTH = 18_000_000;
const supportedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const ScanRequestSchema = z
  .object({
    imageBase64: z.string().min(1).max(MAX_BASE64_LENGTH),
    mimeType: z.enum(supportedMimeTypes),
  })
  .strict();

const nullableString = z.string().nullable();
const modelResultSchema = z
  .object({
    ward: nullableString,
    patientAge: z.number().int().nonnegative().nullable(),
    patientGender: nullableString,
    medications: z.array(
      z
        .object({
          name: nullableString,
          dose: nullableString,
          unit: nullableString,
          frequency: nullableString,
          route: nullableString,
          duration: nullableString,
          sourceText: nullableString,
        })
        .strict(),
    ),
    problems: z.array(
      z
        .object({
          medicationIndexes: z.array(z.number().int().nonnegative()).min(1),
          problemCode: z.enum(PROBLEM_CODES.map(({ code }) => code) as [string, ...string[]]).nullable(),
          causeCode: z.enum(CAUSE_CODES.map(({ code }) => code) as [string, ...string[]]).nullable(),
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
    ward: nullableText,
    patientAge: { type: Type.INTEGER, nullable: true },
    patientGender: nullableText,
    medications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: nullableText,
          dose: nullableText,
          unit: nullableText,
          frequency: nullableText,
          route: nullableText,
          duration: nullableText,
          sourceText: nullableText,
        },
        required: ["name", "dose", "unit", "frequency", "route", "duration", "sourceText"],
      },
    },
    problems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          medicationIndexes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
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
  required: ["ward", "patientAge", "patientGender", "medications", "problems"],
};

function failure(error = "Scan could not be completed. Please use manual entry.") {
  return Response.json(
    { prescription: null, source: "failed", error },
    { status: 200 },
  );
}

type ScanStage = "input" | "configuration" | "generation" | "json" | "schema" | "conversion";

class ScanError extends Error {
  constructor(readonly reason: "timeout" | "empty_output" | "invalid_reference" | "invalid_highlight") {
    super(reason);
  }
}

function describeFailure(error: unknown, stage: ScanStage, timedOut: boolean) {
  // Never log exception messages, stacks, Zod issues, or provider bodies: they can
  // contain the upload, extracted patient data, or credentials.
  const candidateStatus =
    typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  const status = typeof candidateStatus === "number" && Number.isInteger(candidateStatus) &&
    candidateStatus >= 400 && candidateStatus <= 599 ? candidateStatus : undefined;
  let reason: string = "unexpected";
  let message = "Scan could not be completed. Please use manual entry.";
  if (timedOut || (error instanceof ScanError && error.reason === "timeout") ||
    (stage === "generation" && error instanceof Error &&
      ["AbortError", "TimeoutError"].includes(error.name))) {
    reason = "timeout";
    message = "Scan timed out after 15 seconds. Please retry or use manual entry.";
  } else if (stage === "input") {
    reason = "invalid_input";
    message = "The image request is invalid. Please upload a JPEG, PNG, or WebP image and retry.";
  } else if (stage === "configuration") {
    reason = "configuration";
    message = "Scanning is not configured. Ask the app administrator to check the Gemini API key.";
  } else if (stage === "generation" && status) {
    reason = status === 429 ? "provider_quota" :
      [401, 403].includes(status) ? "provider_access" :
      status >= 500 ? "provider_unavailable" : "provider_request";
    message = status === 429
      ? "Gemini rejected the scan because of a rate or quota limit. Ask the administrator to check generation quota, or retry later."
      : [401, 403].includes(status)
        ? "Gemini denied access. Ask the administrator to check the API key and model permissions."
        : status >= 500
          ? "Gemini is temporarily unavailable. Please retry later or use manual entry."
          : "Gemini rejected the scan request. Ask the administrator to check the scan configuration.";
  } else if (["json", "schema", "conversion"].includes(stage) ||
    (error instanceof ScanError && error.reason === "empty_output")) {
    reason = error instanceof ScanError ? error.reason : stage === "json" ? "invalid_json" : "invalid_schema";
    message = "Gemini returned an unusable scan result. Please retry with a clearer image or use manual entry.";
  }
  console.warn("[prescription-scan]", { stage, reason, ...(status ? { providerStatus: status } : {}) });
  return message;
}

function toPrescription(result: z.infer<typeof modelResultSchema>): Prescription {
  const medicationIds = result.medications.map(() => crypto.randomUUID());
  const medications: Medication[] = result.medications.map((medication, index) => ({
    id: medicationIds[index]!,
    ...medication,
  }));

  const problems: Problem[] = result.problems.map((problem) => {
    if (
      problem.medicationIndexes.some((index) => index < 0 || index >= medications.length)
    ) {
      throw new ScanError("invalid_reference");
    }

    const medicationIdsForProblem = problem.medicationIndexes.map((index) => medicationIds[index]!);
    const citedSourceText = medicationIdsForProblem
      .map((id) => medications.find((medication) => medication.id === id)?.sourceText)
      .filter((text): text is string => Boolean(text));

    if (problem.highlights.some((highlight) => !citedSourceText.some((text) => text.includes(highlight)))) {
      throw new ScanError("invalid_highlight");
    }

    return {
      id: crypto.randomUUID(),
      medicationIds: medicationIdsForProblem,
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

  return {
    id: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    ward: result.ward,
    patientAge: result.patientAge,
    patientGender: result.patientGender,
    medications,
    problems,
    status: "pending",
  };
}

export async function POST(request: Request) {
  if (DEMO_MODE) return demoResponse(request, "scan");

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  let stage: ScanStage = "input";

  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new ScanError("timeout"));
      }, REQUEST_TIMEOUT_MS);
    });

    const work = (async () => {
      const body = ScanRequestSchema.parse(await request.json());
      const imageBytes = Buffer.from(body.imageBase64, "base64");
      if (imageBytes.length === 0 || imageBytes.length > 13_500_000 ||
        imageBytes.toString("base64") !== body.imageBase64) {
        throw new Error("Invalid image size.");
      }

      stage = "configuration";
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini is not configured.");
      }
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        // SDK retries turn a fast overload rejection into a deadline failure.
        // Keep one generation attempt inside the scan's bounded timeout.
        httpOptions: { timeout: REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
      });
      stage = "generation";
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Read this prescription image and return only the requested structured fields.",
                  "Copy medication names, doses, units, frequencies, routes, durations, and sourceText only when legible. Use null for absent or uncertain values; never guess or normalize uncertain text.",
                  "Extract ward, patient age, and gender only if explicitly visible. Never return patient names or ID numbers in any field.",
                  "Each medication sourceText must be an exact contiguous transcription of only that medication's prescription text.",
                  "Suggest a medication-related problem only when the prescription itself gives a clear reason. Do not invent drug interactions, infer facts not visible in the image, or use unsupported external clinical assumptions. Return an empty problems array if there is no clear issue.",
                  "Use only the supplied broad PCNE codes: P1 treatment effectiveness, P2 treatment safety, P3 other; C1 drug selection, C2 drug form, C3 dose selection, C4 treatment duration, C5 drug use process, C6 logistics, C7 patient, C8 patient transfer related, C9 other; I0 no intervention, I1 prescriber, I2 patient, I3 drug, I4 other.",
                  "For medicationIndexes use zero-based indexes into the medications array. Every highlight must be an exact quote from the sourceText of one of the referenced medications. Do not place names or ID numbers in explanations or highlights.",
                  "If a code, severity, or explanation is not clear, return null for that value.",
                ].join(" "),
              },
              { inlineData: { mimeType: body.mimeType, data: body.imageBase64 } },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: modelResponseSchema,
          abortSignal: controller.signal,
        },
      });

      if (!response.text) {
        throw new ScanError("empty_output");
      }

      stage = "json";
      const json: unknown = JSON.parse(response.text);
      stage = "schema";
      const parsed = modelResultSchema.parse(json);
      stage = "conversion";
      const prescription = toPrescription(parsed);
      return Response.json({ prescription, source: "ai" });
    })();

    return await Promise.race([work, timeout]);
  } catch (error) {
    return failure(describeFailure(error, stage, controller.signal.aborted));
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function GET() {
  return Response.json({ demoMode: DEMO_MODE }, {
    headers: { "Cache-Control": "no-store" },
  });
}
