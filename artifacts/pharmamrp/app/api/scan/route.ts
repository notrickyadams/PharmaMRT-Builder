import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { GEMINI_SCAN_MODEL } from "@/lib/config";
import type { Confidence, LabOrder, Medication, MedicationOrderStatus, Prescription } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BASE64_LENGTH = 28_000_000;
const supportedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const ScanRequestSchema = z
  .object({
    imageBase64: z.string().min(1).max(MAX_BASE64_LENGTH),
    mimeType: z.enum(supportedMimeTypes),
  })
  .strict();

const nullableString = z.string().nullable();
const confidenceSchema = z.enum(["high", "low"]).nullable();
const orderStatusSchema = z.enum(["active", "stopped", "modified", "unknown"]);

const modelResultSchema = z
  .object({
    ward: nullableString,
    patientAge: z.number().int().nonnegative().nullable(),
    patientGender: nullableString,
    patientName: nullableString,
    fileNumber: nullableString,
    identifierConfidence: confidenceSchema,
    medications: z.array(
      z
        .object({
          name: nullableString,
          genericName: nullableString,
          dose: nullableString,
          unit: nullableString,
          frequency: nullableString,
          route: nullableString,
          duration: nullableString,
          confidence: confidenceSchema,
          conditions: z.array(z.string()).nullable(),
          startDate: nullableString,
          orderStatus: orderStatusSchema,
          sourceText: nullableString,
        })
        .strict(),
    ),
    labOrders: z.array(
      z
        .object({
          test: nullableString,
          date: nullableString,
          sourceText: nullableString,
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
    patientName: nullableText,
    fileNumber: nullableText,
    identifierConfidence: {
      type: Type.STRING,
      enum: ["high", "low"],
      nullable: true,
    },
    medications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: nullableText,
          genericName: nullableText,
          dose: nullableText,
          unit: nullableText,
          frequency: nullableText,
          route: nullableText,
          duration: nullableText,
          confidence: {
            type: Type.STRING,
            enum: ["high", "low"],
            nullable: true,
          },
          conditions: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
          startDate: nullableText,
          orderStatus: {
            type: Type.STRING,
            enum: ["active", "stopped", "modified", "unknown"],
          },
          sourceText: nullableText,
        },
        required: [
          "name",
          "genericName",
          "dose",
          "unit",
          "frequency",
          "route",
          "duration",
          "confidence",
          "conditions",
          "startDate",
          "orderStatus",
          "sourceText",
        ],
      },
    },
    labOrders: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          test: nullableText,
          date: nullableText,
          sourceText: nullableText,
        },
        required: ["test", "date", "sourceText"],
      },
    },
  },
  required: [
    "ward",
    "patientAge",
    "patientGender",
    "patientName",
    "fileNumber",
    "identifierConfidence",
    "medications",
    "labOrders",
  ],
};

function failure(error: string) {
  return Response.json({ source: "failed", error }, { status: 200 });
}

function toPrescription(result: z.infer<typeof modelResultSchema>): Prescription {
  const medications: Medication[] = result.medications.map((medication) => ({
    id: crypto.randomUUID(),
    ...medication,
    confidence: medication.confidence as Confidence | null,
    orderStatus: medication.orderStatus as MedicationOrderStatus,
  }));
  const labOrders: LabOrder[] = result.labOrders;

  return {
    id: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    ward: result.ward,
    patientAge: result.patientAge,
    patientGender: result.patientGender,
    patientName: result.patientName,
    fileNumber: result.fileNumber,
    identifierConfidence: result.identifierConfidence as Confidence | null,
    medications,
    labOrders,
    problems: [],
    status: "pending",
  };
}

export async function POST(request: Request) {
  let stage: "request" | "gemini" | "json" | "validation" | "result" = "request";
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return failure("The scan service is missing its Gemini API configuration.");
    }

    const body = ScanRequestSchema.parse(await request.json());
    const imageBytes = Buffer.from(body.imageBase64, "base64");
    if (imageBytes.length === 0 || imageBytes.length > 21_000_000) {
      return failure("The uploaded image is empty or exceeds the scan size limit.");
    }

    stage = "gemini";
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_SCAN_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "This is an Egyptian hospital treatment sheet. Return only the requested structured fields. The page may have a header with patient name and file number, and columns labeled Physician, Other Recommendations, Treatment, and Date/frequency.",
                "Extract patientName and fileNumber only into their dedicated fields. Do not repeat either in ward, medication fields, lab fields, or any other value. Never include them in sourceText.",
                "Extract medication orders from the Treatment column. Read their frequencies from the Date/frequency column. Copy every day/month date digit-for-digit and carefully check both parts (for example, 19/12, not 19/2). If the header has an admission date, use its year for dates that omit a year; otherwise leave the year out. Set startDate only when a date explicitly applies to that medication. Extract ward, patient age, and gender only when explicitly legible. Unknown or unreadable values must be null; never guess.",
                "Each medication sourceText must be an exact contiguous quote from the Treatment column for that order. Split combined lines into separate medication entries while keeping the same exact sourceText on each entry.",
                "Preserve brand names as written in name and provide genericName only when the mapping is clear. Known mappings: Rocephin=ceftriaxone, Tavanic=levofloxacin, Dexa=dexamethasone, ACC=acetylcysteine, Clexane=enoxaparin, Lasix=furosemide, Controloc=pantoprazole, Atrovent=ipratropium, Farcolin=salbutamol, Pulmicort=budesonide, Unasyn=ampicillin/sulbactam. Never silently correct a medication name.",
                "Set confidence to low when a name is not recognized or the dose/unit is unusual for the drug; otherwise use high only when the medication and dose are clearly legible.",
                "Keep conditions exactly as written, such as after sensitivity test or if BP > 90/60. Use null when no condition is recorded.",
                "Abbreviations: amp=ampoule, tab=tablet, eff=effervescent, T after a dose=tablet, SC=subcutaneous, IV=intravenous, neb/nebulize=inhalation. Infer route from form only when clear: tab/T/eff/syrup=oral, nebulize=inhalation, SC=subcutaneous, amp=injection. For amp, specify IV or IM only if written; otherwise use injection and low confidence.",
                "Normalize frequency only for clear shorthand: /24h=once daily, /12h=twice daily, /8h=three times daily, /6h=four times daily. Normalize gm to g. Keep unclear values null.",
                "Read every line of Other Recommendations as a possible lab or diagnostic order; include blood tests, imaging, microbiology, and other tests such as CBC, chemistry, CRP, PT, INR, virology, albumin, ultrasound, sputum, AFB smear, and pleural fluid. Do not limit extraction to blood tests or skip a line. Include each test's date when legible, carefully preserving the full day/month and applying the header admission year only when present; otherwise leave the year out. Each lab sourceText must be an exact contiguous quote from that column. Use null for unknown test/date/sourceText values.",
                "Physician-column marks: DS means stopped (discontinued); Mod means modified (dose or frequency changed). Set active only when the sheet explicitly indicates a medication is current and has no DS/Mod mark; use unknown when status cannot be determined or a mark is illegible or conflicting.",
                "Ignore stamps, signatures, and handwritten Arabic notes. Do not make any medication-problem suggestions during this scan step.",
              ].join(" "),
            },
            { inlineData: { mimeType: body.mimeType, data: body.imageBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: modelResponseSchema,
      },
    });

    if (!response.text) {
      return failure("Gemini returned no scan data. No prescription was extracted.");
    }

    stage = "json";
    const json = JSON.parse(response.text);
    stage = "validation";
    const parsed = modelResultSchema.parse(json);
    stage = "result";
    const prescription = toPrescription(parsed);
    return Response.json({ prescription, source: "ai" });
  } catch (error) {
    // Return only safe categories and schema paths, never provider messages or patient data.
    if (error instanceof ApiError) {
      if (error.status === 429) {
        return failure("Gemini rate limit or quota exceeded (HTTP 429). Please wait or check your API quota.");
      }
      if (error.status === 401 || error.status === 403) {
        return failure(`Gemini denied access (HTTP ${error.status}). Check the API key's permissions.`);
      }
      if (error.status === 404) {
        return failure("The configured scan model is unavailable to this Gemini API key (HTTP 404).");
      }
      if (error.status >= 500) {
        return failure(`Gemini's scan service failed (HTTP ${error.status}). This is a service error, not an image-quality result. Please try again later.`);
      }
      if (error.status === 400) {
        return failure("Gemini rejected the scan request (HTTP 400). The image format or structured-output schema may be unsupported.");
      }
      return failure(`Gemini could not process the scan (HTTP ${error.status}).`);
    }
    if (error instanceof z.ZodError) {
      if (stage === "request") {
        return failure("The image upload request is invalid. Expected a base64 image with a JPEG, PNG, or WebP MIME type.");
      }
      const fields = [...new Set(error.issues.map((issue) => issue.path.join(".") || "root"))];
      return failure(`Gemini returned scan data that failed validation at: ${fields.slice(0, 8).join(", ")}. No prescription was accepted.`);
    }
    if (error instanceof SyntaxError) {
      return failure(stage === "request"
        ? "The upload request was not valid JSON."
        : "Gemini returned invalid JSON. No prescription was accepted.");
    }
    if (stage === "gemini") {
      return failure("Could not complete the connection to Gemini. Please try again later.");
    }
    return failure(`Scan failed during the ${stage} step. No prescription was accepted.`);
  }
}
