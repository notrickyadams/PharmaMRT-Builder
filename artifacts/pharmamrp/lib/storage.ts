import { z } from "zod";
import { fictionalFiles, normalizeScan, parseProblems, reviewSchema, validProblem, type Review } from "@/components/review-model";
import type { Problem } from "./types";
import scan1 from "./demo/scan-1.json";
import scan2 from "./demo/scan-2.json";
import scan3 from "./demo/scan-3.json";
import analyze1 from "./demo/analyze-1.json";
import analyze2 from "./demo/analyze-2.json";
import analyze3 from "./demo/analyze-3.json";

export const STORAGE_KEY = "pharmamrp-reviewed-v1";
export type SavedCase = { id: string; savedAt: string; status: "reviewed"; review: Review; problems: Problem[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
function cleanCase(raw: unknown): SavedCase {
  const c = z.object({
    id: z.string().min(1), savedAt: z.string().datetime(), status: z.literal("reviewed"),
    review: reviewSchema, problems: z.array(z.unknown()),
  }).parse(raw);
  const review: Review = { ...c.review,
    fileNumber: c.review.fictional && c.review.fileNumber === fictionalFiles[c.review.id]
      ? c.review.fileNumber : null };
  if (new Set(review.medications.map(m => m.id)).size !== review.medications.length) throw new Error();
  const problems = parseProblems(c.problems, review);
  if (problems.some(p => !["accepted", "edited", "added"].includes(p.reviewStatus) || !validProblem(p, review))) throw new Error();
  return { id: c.id, savedAt: c.savedAt, status: "reviewed", review, problems };
}
export function readCases(): Result<SavedCase[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ok: true, value: [] };
    const cases = z.array(z.unknown()).parse(JSON.parse(raw)).map(cleanCase);
    if (new Set(cases.map(c => c.id)).size !== cases.length) throw new Error();
    return { ok: true, value: cases.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) };
  } catch {
    return { ok: false, error: "Saved records could not be read. Browser storage may be unavailable or damaged. Existing data has not been replaced." };
  }
}
function writeCases(cases: SavedCase[]): Result<SavedCase[]> {
  try {
    const safe = cases.map(cleanCase);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return { ok: true, value: safe };
  } catch {
    return { ok: false, error: "Your case could not be saved. Browser storage may be full or blocked. Your current review is still here; free space or allow storage and retry." };
  }
}
export function saveCase(c: SavedCase): Result<SavedCase[]> {
  const existing = readCases();
  if (!existing.ok) return existing;
  if (existing.value.some(item => item.id === c.id)) return existing;
  return writeCases([c, ...existing.value]);
}
export function resetDemo(): Result<SavedCase[]> {
  const now = Date.now();
  const cases = [scan1, scan2, scan3].map((scan, index): SavedCase => {
    const review = normalizeScan(scan.prescription, "demo");
    // Explicit fictional review: clarify the two supported issues; reject the third
    // deliberately flawed suggestion (including the already-stopped antibiotic).
    const problems = parseProblems([analyze1, analyze2, analyze3][index]!.problems.slice(0, 2), review)
      .map((p): Problem => ({ ...p, reviewStatus: "accepted",
        finalIntervention: p.suggestedIntervention, acceptance: null,
        notes: "Fictional training case: pharmacist review recorded; intervention outcome unspecified." }));
    return { id: crypto.randomUUID(), savedAt: new Date(now - index * 1000).toISOString(),
      status: "reviewed", review, problems };
  });
  return writeCases(cases);
}
