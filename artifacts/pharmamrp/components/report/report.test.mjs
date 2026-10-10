import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return { url: new URL(`${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith(root.href))
      return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(root.href) && url.endsWith(".json"))
      return { format: "module", shortCircuit: true, source: `export default ${readFileSync(fileURLToPath(url), "utf8")}` };
    if (url.startsWith(root.href) && url.endsWith(".ts"))
      return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
    return nextLoad(url, context);
  },
});
const { resetDemo, readCases } = await import("../../lib/storage.ts");
const { buildReport, monthKey, workbookData } = await import("./model.ts");
const { buildWorkbook } = await import("./excel.ts");
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
});
function fixtures() {
  assert.equal(resetDemo().ok, true);
  return readCases().value;
}
test("unchanged Reset demo yields complete, truthful monthly aggregates", () => {
  const cases = fixtures(), original = JSON.stringify(cases);
  const report = buildReport(cases, monthKey());
  assert.equal(report.caseCount, 3);
  assert.equal(report.problemCount, 6);
  assert.equal(report.interventionCount, 6);
  assert.equal(report.acceptanceRate, null);
  assert.equal(report.answered, 0);
  assert.equal(report.problemTypes.find(row => row.code === "P3").count, 5);
  assert.equal(report.wards.length, 3);
  assert.equal(report.acceptance[0].label, "Unspecified");
  assert.equal(report.acceptance[0].count, 6);
  for (const values of [report.problemTypes, report.causes, report.interventions, report.acceptance, report.wards, report.medications])
    assert.ok(values.every((row, index) => !index || values[index - 1].count >= row.count));
  assert.equal(JSON.stringify(cases), original);
});
test("only saved dates in selected local month count, including year boundaries", () => {
  const cases = fixtures();
  cases[0].savedAt = new Date(2025, 11, 31, 23, 59, 59).toISOString();
  cases[1].savedAt = new Date(2026, 0, 1, 0, 0, 0).toISOString();
  cases[2].savedAt = new Date(2026, 0, 31, 23, 59, 59).toISOString();
  assert.equal(buildReport(cases, "2025-12").caseCount, 1);
  assert.equal(buildReport(cases, "2026-01").caseCount, 2);
  assert.equal(buildReport(cases, "2026-02").caseCount, 0);
  assert.equal(buildReport(cases, "").caseCount, 0);
  assert.equal(buildReport(cases, "2026-13").caseCount, 0);
});
test("acceptance uses recorded A answers, never review status, and excludes missing answers", () => {
  const cases = fixtures();
  cases[0].problems[0].acceptance = "A1";
  cases[0].problems[1].acceptance = "A2";
  cases[1].problems[0].acceptance = "A3";
  cases[1].problems[1].finalIntervention = "I0";
  cases[2].problems[0].finalIntervention = null;
  const report = buildReport(cases, monthKey());
  assert.equal(report.answered, 3);
  assert.equal(report.accepted, 1);
  assert.ok(Math.abs(report.acceptanceRate - 100 / 3) < 0.0001);
  assert.equal(report.interventionCount, 4);
});
test("zero-problem reviewed cases still count, without misleading acceptance", () => {
  const cases = fixtures().map(record => ({ ...record, problems: [] }));
  const report = buildReport(cases, monthKey());
  assert.equal(report.caseCount, 3); assert.equal(report.problemCount, 0);
  assert.equal(report.acceptanceRate, null); assert.equal(report.medications.length, 0);
});
test("medication counts deduplicate each generic within a problem and flag absent generics", () => {
  const [record] = fixtures();
  record.review.medications = [
    { id: "m1", genericName: "Example generic", name: "Brand one" },
    { id: "m2", genericName: " example GENERIC ", name: "Brand two" },
    { id: "m3", genericName: null, name: "Unknown brand" },
  ];
  record.problems[0].medicationIds = ["m1", "m2", "m3"];
  record.problems[1].medicationIds = ["m2"];
  const report = buildReport([record], monthKey());
  assert.equal(report.medications[0].count, 2);
  assert.equal(report.medications[1].label, "Unknown brand (generic unspecified)");
  assert.equal(report.medications[1].count, 1);
});
test("workbook is a real ZIP with required sheets and text-safe formula-like content", () => {
  const cases = fixtures();
  cases[0].problems[0].notes = '=HYPERLINK("bad") & <ملاحظة>';
  const report = buildReport(cases, monthKey()), sheets = workbookData(report);
  assert.deepEqual(sheets.map(sheet => sheet.name), ["Summary", "Problems", "Counts"]);
  assert.equal(sheets[1].rows.length, 7);
  assert.equal(sheets[1].rows[0].length, 9);
  const bytes = buildWorkbook(sheets);
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  const content = new TextDecoder().decode(bytes);
  assert.ok(content.includes("inlineStr"));
  assert.ok(content.includes("=HYPERLINK(&quot;bad&quot;) &amp; &lt;ملاحظة&gt;"));
  assert.ok(!content.includes("<f>"));
  assert.ok(!content.includes("patientName"));
  writeFileSync("/tmp/pharmamrp-report-validation.xlsx", bytes);
});
test("storage failures do not become empty or invented reports", () => {
  globalThis.localStorage = { getItem() { throw new Error("blocked"); } };
  assert.equal(readCases().ok, false);
});
