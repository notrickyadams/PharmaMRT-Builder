import { z } from "zod";
import type { SavedCase } from "./storage";

export const INSTRUCTIONS_KEY = "pharmamrp-administration-instructions-v1";
const optionalText = z.string().trim().min(1).max(1000).nullable();
const optionalAmount = z.number().finite().positive().max(1_000_000).nullable();
const draftSchema = z.object({
  caseId: z.string().min(1),
  medicationId: z.string().min(1),
  route: z.enum(["iv", "oral"]).nullable(),
  ivMethod: z.enum(["bolus", "infusion"]).nullable(),
  diluentType: optionalText,
  diluentVolumeMl: optionalAmount,
  infusionDurationMinutes: optionalAmount,
  mealTiming: z.enum(["before_meals", "after_meals"]).nullable(),
}).strict();
const instructionSchema = draftSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((instruction, context) => {
  const hasInfusionDetails = instruction.diluentType !== null ||
    instruction.diluentVolumeMl !== null || instruction.infusionDurationMinutes !== null;
  if ((instruction.route !== "iv" && instruction.ivMethod !== null) ||
      (hasInfusionDetails && !(instruction.route === "iv" && instruction.ivMethod === "infusion")) ||
      (instruction.route !== "oral" && instruction.mealTiming !== null)) {
    context.addIssue({ code: "custom", message: "Only fill the instructions for the selected route and IV method." });
  }
});
export type AdministrationInstruction = z.infer<typeof instructionSchema>;
export type InstructionDraft = z.infer<typeof draftSchema>;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type BrowserStorage = Pick<Storage, "getItem" | "setItem">;

export function readInstructions(storage?: BrowserStorage): Result<AdministrationInstruction[]> {
  try {
    const raw = (storage ?? localStorage).getItem(INSTRUCTIONS_KEY);
    const entries = raw === null ? [] : z.array(instructionSchema).parse(JSON.parse(raw));
    const pairs = entries.map(entry => JSON.stringify([entry.caseId, entry.medicationId]));
    if (new Set(pairs).size !== pairs.length ||
        new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error();
    return { ok: true, value: entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
  } catch {
    return { ok: false, error: "Administration instructions could not be read. Storage may be blocked or damaged. Existing data has not been replaced." };
  }
}

export function saveInstructions(
  draft: InstructionDraft,
  cases: SavedCase[],
  storage?: BrowserStorage,
): Result<AdministrationInstruction[]> {
  try {
    const record = cases.find(item => item.id === draft.caseId);
    if (!record?.review.medications.some(medication => medication.id === draft.medicationId)) {
      return { ok: false, error: "This case or medication is no longer available. Reload the reviewed cases." };
    }
    const existing = readInstructions(storage);
    if (!existing.ok) return existing;
    const previous = existing.value.find(entry => entry.caseId === draft.caseId && entry.medicationId === draft.medicationId);
    const now = new Date().toISOString();
    const validated = instructionSchema.safeParse({
      ...draft, id: previous?.id ?? crypto.randomUUID(),
      createdAt: previous?.createdAt ?? now, updatedAt: now,
    });
    if (!validated.success) {
      return { ok: false, error: validated.error.issues[0]?.message ?? "Check the administration instructions." };
    }
    const entries = [validated.data, ...existing.value.filter(entry => entry.id !== validated.data.id)];
    (storage ?? localStorage).setItem(INSTRUCTIONS_KEY, JSON.stringify(entries));
    return { ok: true, value: entries };
  } catch {
    return { ok: false, error: "Instructions could not be saved. Browser storage may be full or blocked. Your entered instructions have been retained." };
  }
}

export function removeInstructions(
  caseId: string,
  medicationId: string,
  storage?: BrowserStorage,
): Result<AdministrationInstruction[]> {
  try {
    const existing = readInstructions(storage);
    if (!existing.ok) return existing;
    const entries = existing.value.filter(entry => !(entry.caseId === caseId && entry.medicationId === medicationId));
    (storage ?? localStorage).setItem(INSTRUCTIONS_KEY, JSON.stringify(entries));
    return { ok: true, value: entries };
  } catch {
    return { ok: false, error: "Instructions could not be removed. Existing data has not been changed; allow browser storage and retry." };
  }
}
