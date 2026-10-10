import { GoogleGenAI, Type } from "@google/genai";
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

function failure(error = "Scan could not be completed. Please check the image and try again.") {
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
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini is not configured.");
    }

    const body = ScanRequestSchema.parse(await request.json());
    const imageBytes = Buffer.from(body.imageBase64, "base64");
    if (imageBytes.length === 0 || imageBytes.length > 21_000_000) {
      throw new Error("Invalid image size.");
    }

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
                "Extract medication orders from the Treatment column. Read their frequencies from the Date/frequency column, and set startDate only when a date explicitly applies to that medication. Extract ward, patient age, and gender only when explicitly legible. Unknown or unreadable values must be null; never guess.",
                "Each medication sourceText must be an exact contiguous quote from the Treatment column for that order. Split combined lines into separate medication entries while keeping the same exact sourceText on each entry.",
                "Preserve brand names as written in name and provide genericName only when the mapping is clear. Known mappings: Rocephin=ceftriaxone, Tavanic=levofloxacin, Dexa=dexamethasone, ACC=acetylcysteine, Clexane=enoxaparin, Lasix=furosemide, Controloc=pantoprazole, Atrovent=ipratropium, Farcolin=salbutamol, Pulmicort=budesonide, Unasyn=ampicillin/sulbactam. Never silently correct a medication name.",
                "Set confidence to low when a name is not recognized or the dose/unit is unusual for the drug; otherwise use high only when the medication and dose are clearly legible.",
                "Keep conditions exactly as written, such as after sensitivity test or if BP > 90/60. Use null when no condition is recorded.",
                "Abbreviations: amp=ampoule, tab=tablet, eff=effervescent, SC=subcutaneous, IV=intravenous, neb/nebulize=inhalation. Infer route from form only when clear: tab/eff/syrup=oral, nebulize=inhalation, SC=subcutaneous, amp=injection. For amp, specify IV or IM only if written; otherwise use injection and low confidence.",
                "Normalize frequency only for clear shorthand: /24h=once daily, /12h=twice daily, /8h=three times daily, /6h=four times daily. Normalize gm to g. Keep unclear values null.",
                "Read lab orders only from Other Recommendations, including CBC, chemistry, CRP, PT, INR, virology, albumin, and similar tests. Include each test's date when legible. Each lab sourceText must be an exact contiguous quote from that column. Use null for unknown test/date/sourceText values.",
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
      throw new Error("Gemini returned no structured result.");
    }

    const parsed = modelResultSchema.parse(JSON.parse(response.text));
    const prescription = toPrescription(parsed);
    return Response.json({ prescription, source: "ai" });
  } catch {
    return failure();
  }
}
