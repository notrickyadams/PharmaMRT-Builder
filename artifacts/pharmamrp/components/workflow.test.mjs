import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root.href) && url.endsWith(".json")) return {
      format: "module", shortCircuit: true,
      source: `export default ${readFileSync(fileURLToPath(url), "utf8")}`,
    };
    if (url.startsWith(root.href) && url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
const { normalizeScan, apiPrescription, parseProblems, emptyReview, blankMedication, validProblem, validReview } = await import("./review-model.ts");
const { readCases, resetDemo, saveCase, STORAGE_KEY } = await import("../lib/storage.ts");
const scans = [1, 2, 3].map(i => JSON.parse(readFileSync(new URL(`../lib/demo/scan-${i}.json`, import.meta.url), "utf8")));
const analyses = [1, 2, 3].map(i => JSON.parse(readFileSync(new URL(`../lib/demo/analyze-${i}.json`, import.meta.url), "utf8")));
let data;
beforeEach(() => {
  data = new Map();
  globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
});
test("all fixtures normalize without names, preserving only exact fictional file numbers", () => {
  scans.forEach((scan, i) => {
    const review = normalizeScan(scan.prescription, scan.source);
    assert.equal(review.fileNumber, `DEMO-FILE-00${i + 1}`);
    assert.equal("patientName" in review, false);
    assert.doesNotMatch(JSON.stringify(review), /Fictional Patient/);
    assert.equal(parseProblems(analyses[i].problems, review).length, 3);
  });
  const raw = { ...scans[0].prescription, fileNumber: "REAL-ID", patientName: "not-retained" };
  assert.equal(normalizeScan(raw, "demo").fileNumber, null);
  assert.equal(normalizeScan(scans[0].prescription, "ai").fileNumber, null);
  assert.throws(() => normalizeScan({ medications: [] }, "demo"));
});
test("nullable medication extensions and undated result/order semantics are preserved", () => {
  const first = normalizeScan(scans[0].prescription, "demo");
  assert.equal(first.medications[0].orderStatus, "stopped");
  assert.equal(first.medications[4].confidence, "low");
  assert.ok(first.labs.every(l => l.kind === "order" && l.value === null));
  const second = normalizeScan(scans[1].prescription, "demo");
  assert.equal(second.medications[0].genericName, null);
  assert.equal(second.medications[0].confidence, null);
  assert.equal(second.medications[0].orderStatus, null);
  assert.ok(second.labs.every(l => l.kind === "result" && l.date === null));
});
test("analysis request projects only unchanged API contract fields, preserving fixture ID and source", () => {
  const review = normalizeScan(scans[0].prescription, "demo");
  review.medications[4].dose = "pharmacist correction";
  const body = apiPrescription(review);
  assert.equal(body.id, "demo-prescription-1");
  assert.deepEqual(Object.keys(body).sort(), ["id", "scannedAt", "ward", "patientAge", "patientGender", "medications", "problems", "status"].sort());
  assert.deepEqual(Object.keys(body.medications[0]).sort(), ["id", "name", "dose", "unit", "frequency", "route", "duration", "sourceText"].sort());
  assert.equal(body.medications[4].sourceText, "clexane 60 unit sc");
  assert.deepEqual(body.problems, []);
});
test("incompatible medication references, duplicate problem IDs and inexact quotations fail closed", () => {
  const review = normalizeScan(scans[0].prescription, "demo");
  assert.throws(() => parseProblems(analyses[1].problems, review));
  assert.throws(() => parseProblems(analyses[0].problems, emptyReview()));
  assert.throws(() => parseProblems([analyses[0].problems[0], analyses[0].problems[0]], review));
  assert.throws(() => parseProblems([{ ...analyses[0].problems[0], highlights: ["invented quote"] }], review));
});
test("reset creates exactly three reviewed fictional cases, excludes flawed suggestions and leaves outcome unspecified", () => {
  assert.equal(resetDemo().ok, true);
  const result = readCases();
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 3);
  for (const c of result.value) {
    assert.equal(c.status, "reviewed");
    assert.equal(c.problems.length, 2);
    assert.ok(c.problems.every(p => p.reviewStatus === "accepted" && p.acceptance === null));
    assert.ok(c.problems.every(p => !p.id.endsWith("problem-3")));
  }
  assert.doesNotMatch(data.get(STORAGE_KEY), /patientName|Fictional Patient/);
  assert.equal(resetDemo().value.length, 3);
  assert.equal(readCases().value.length, 3);
});
test("zero-problem cases survive reload; duplicate save IDs do not duplicate records; newest first", () => {
  const c = { id: "case-one", savedAt: "2026-10-10T12:00:00.000Z", status: "reviewed", review: emptyReview(), problems: [] };
  assert.equal(saveCase(c).ok, true);
  assert.equal(saveCase(c).ok, true);
  assert.equal(readCases().value.length, 1);
  assert.equal(saveCase({ ...c, id: "case-two", savedAt: "2026-10-10T13:00:00.000Z" }).ok, true);
  assert.equal(readCases().value[0].id, "case-two");
});
test("storage refuses undecided/rejected/invalid edited problems", () => {
  const review = normalizeScan(scans[0].prescription, "demo");
  const p = parseProblems(analyses[0].problems, review)[0];
  const c = { id: "invalid", savedAt: new Date().toISOString(), status: "reviewed", review, problems: [p] };
  assert.equal(saveCase(c).ok, false);
  assert.equal(saveCase({ ...c, problems: [{ ...p, reviewStatus: "rejected" }] }).ok, false);
  assert.equal(validProblem({ ...p, reviewStatus: "edited", explanation: "" }, review), false);
  assert.equal(validReview({ ...emptyReview(), medications: [blankMedication()] }), false);
  assert.equal(validReview(emptyReview()), true);
});
test("malformed/unavailable/full storage fails explicitly without replacing existing records", () => {
  data.set(STORAGE_KEY, "{broken");
  assert.equal(readCases().ok, false);
  const c = { id: "one", savedAt: new Date().toISOString(), status: "reviewed", review: emptyReview(), problems: [] };
  assert.equal(saveCase(c).ok, false);
  assert.equal(data.get(STORAGE_KEY), "{broken");
  data.clear();
  globalThis.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(saveCase(c).ok, false);
  assert.equal(readCases().value.length, 0);
  globalThis.localStorage.getItem = () => { throw new Error("SecurityError"); };
  assert.equal(readCases().ok, false);
});
test("storage strips injected patient names and nonfixture file numbers", () => {
  const review = normalizeScan(scans[0].prescription, "demo");
  const c = { id: "privacy", savedAt: new Date().toISOString(), status: "reviewed",
    patientName: "DO_NOT_STORE", review: { ...review, patientName: "DO_NOT_STORE", fileNumber: "REAL-ID" }, problems: [] };
  assert.equal(saveCase(c).ok, true);
  assert.equal(readCases().value[0].review.fileNumber, null);
  assert.doesNotMatch(data.get(STORAGE_KEY), /DO_NOT_STORE|patientName|REAL-ID/);
});
