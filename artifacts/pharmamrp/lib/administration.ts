import { z } from "zod";
import type { SavedCase } from "./storage";

export const ADMINISTRATION_KEY = "pharmamrp-administration-v1";
const text = z.string().trim().min(1).max(1000).nullable();
const timestamp = z.string().datetime();
const entrySchema = z.object({
  id: z.string().min(1),
  caseId: z.string().min(1),
  medicationId: z.string().min(1),
  status: z.enum(["given", "missed"]),
  scheduledAt: timestamp.nullable(),
  administeredAt: timestamp.nullable(),
  dose: text,
  unit: text,
  route: text,
  reason: text,
  notes: text,
  recordedAt: timestamp,
}).strict().superRefine((entry, ctx) => {
  if (entry.status === "given" && (!entry.administeredAt || !entry.dose)) {
    ctx.addIssue({ code: "custom", message: "Enter the actual dose and administration time." });
  }
  if (entry.status === "missed" &&
      (!entry.reason || entry.administeredAt !== null || entry.dose !== null ||
        entry.unit !== null || entry.route !== null)) {
    ctx.addIssue({ code: "custom", message: "A missed dose needs a reason and cannot have administered-dose details." });
  }
});

export type AdministrationEntry = z.infer<typeof entrySchema>;
export type AdministrationDraft = Omit<AdministrationEntry, "id" | "recordedAt">;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type BrowserStorage = Pick<Storage, "getItem" | "setItem">;

export function readAdministrations(storage?: BrowserStorage): Result<AdministrationEntry[]> {
  try {
    const raw = (storage ?? localStorage).getItem(ADMINISTRATION_KEY);
    const entries = raw === null ? [] : z.array(entrySchema).parse(JSON.parse(raw));
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error();
    return { ok: true, value: entries.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)) };
  } catch {
    return { ok: false, error: "Administration history could not be read. Browser storage may be blocked or damaged. Existing data has not been replaced." };
  }
}

export function saveAdministration(
  draft: AdministrationDraft,
  cases: SavedCase[],
  storage?: BrowserStorage,
): Result<AdministrationEntry[]> {
  try {
    const record = cases.find(item => item.id === draft.caseId);
    const medication = record?.review.medications.find(item => item.id === draft.medicationId);
    if (!record || !medication) {
      return { ok: false, error: "This case or medication is no longer available. Reload the cases before recording a dose." };
    }
    if (draft.status === "given" && medication.orderStatus === "stopped") {
      return { ok: false, error: "This medication is marked stopped. A given dose cannot be recorded against this order." };
    }
    const now = Date.now();
    const parsed = entrySchema.safeParse({
      ...draft, id: crypto.randomUUID(), recordedAt: new Date(now).toISOString(),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the dose details." };
    if (parsed.data.administeredAt && Date.parse(parsed.data.administeredAt) > now) {
      return { ok: false, error: "Administration time cannot be in the future." };
    }
    if (parsed.data.status === "missed" && parsed.data.scheduledAt &&
        Date.parse(parsed.data.scheduledAt) > now) {
      return { ok: false, error: "A future scheduled dose cannot be recorded as missed." };
    }
    const existing = readAdministrations(storage);
    if (!existing.ok) return existing;
    const entries = [parsed.data, ...existing.value];
    (storage ?? localStorage).setItem(ADMINISTRATION_KEY, JSON.stringify(entries));
    return { ok: true, value: entries };
  } catch {
    return { ok: false, error: "The dose record could not be saved. Browser storage may be full or blocked. Your entered details have been retained; retry after allowing storage." };
  }
}
