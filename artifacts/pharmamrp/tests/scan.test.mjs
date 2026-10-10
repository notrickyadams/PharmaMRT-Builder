import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { after, beforeEach, test } from "node:test";
import ts from "typescript";

// Run the real route without Next.js or a new testing dependency. Only the
// provider is mocked; schema validation and prescription conversion stay real.
const root = new URL("../", import.meta.url);
const mockProviderUrl = "scan-test:provider";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@google/genai")
      return { url: mockProviderUrl, shortCircuit: true };
    if (specifier.startsWith("@/"))
      return { url: new URL(`${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith(root.href))
      return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    // Exercise the personal-provider scan contract entirely against the mock.
    // The app itself stays in demo mode; these tests never make a network call.
    if (url === new URL("lib/config.ts", root).href) return {
      format: "module", shortCircuit: true,
      source: `export const DEMO_MODE = false;
        export const GEMINI_PROVIDER = "personal";
        export const GEMINI_MODEL = "synthetic-test-model";`,
    };
    if (url === mockProviderUrl) return {
      format: "module",
      shortCircuit: true,
      source: `export const Type = { STRING: "STRING", INTEGER: "INTEGER", ARRAY: "ARRAY", OBJECT: "OBJECT" };
        export class GoogleGenAI {
          constructor(options) {
            globalThis.scanTest.options = options;
            this.models = { generateContent: async (request) => {
              globalThis.scanTest.calls.push(request);
              return globalThis.scanTest.generate(request);
            }};
          }
        }`,
    };
    if (url.startsWith(root.href) && url.endsWith(".ts")) return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
const { POST } = await import("../app/api/scan/route.ts");
// Preserve the inherited configuration without displaying its value.
const originalKey = process.env.GEMINI_API_KEY;
const originalWarn = console.warn;
after(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  console.warn = originalWarn;
  delete globalThis.scanTest;
});

const medication = {
  name: "Amoxicillin", dose: "500", unit: "mg", frequency: "three times daily",
  route: "oral", duration: "5 days",
  sourceText: "Amoxicillin 500 mg oral three times daily for 5 days",
};
const valid = () => ({
  ward: null, patientAge: null, patientGender: null,
  medications: [{ ...medication }], problems: [],
});
const problem = () => ({
  medicationIndexes: [0], problemCode: null, causeCode: null,
  explanation: null, severity: null, suggestedIntervention: null,
  highlights: ["500 mg"],
});
const input = { imageBase64: "aW1hZ2U=", mimeType: "image/png" };
const request = (body = input) => new Request("http://localhost/api/scan", {
  method: "POST", body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
});
beforeEach(() => {
  process.env.GEMINI_API_KEY = "synthetic-unit-test-key";
  globalThis.scanTest = {
    calls: [], logs: [], generate: async () => ({ text: JSON.stringify(valid()) }),
  };
  console.warn = (...args) => globalThis.scanTest.logs.push(args);
});
async function failed(req, stage, reason, message) {
  const response = await POST(req);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.prescription, null);
  assert.equal(payload.source, "failed");
  assert.match(payload.error, message);
  assert.equal(globalThis.scanTest.logs.length, 1);
  const [label, diagnostic] = globalThis.scanTest.logs[0];
  assert.equal(label, "[prescription-scan]");
  assert.equal(diagnostic.stage, stage);
  assert.equal(diagnostic.reason, reason);
  assert.deepEqual(Object.keys(diagnostic).sort(),
    ("providerStatus" in diagnostic ? ["stage", "reason", "providerStatus"] : ["stage", "reason"]).sort());
  assert.doesNotMatch(JSON.stringify([payload, globalThis.scanTest.logs]),
    /synthetic-unit-test-key|PRIVATE_PROVIDER_BODY|PATIENT_SECRET/);
  return diagnostic;
}

test("valid output preserves nullable values, exact citations, references and pending review", async () => {
  const output = valid();
  output.problems.push(problem());
  globalThis.scanTest.generate = async () => ({ text: JSON.stringify(output) });
  const response = await POST(request());
  const { prescription, source } = await response.json();
  assert.equal(source, "ai");
  assert.equal(prescription.ward, null);
  assert.equal(prescription.patientAge, null);
  assert.equal(prescription.patientGender, null);
  assert.equal(prescription.status, "pending");
  assert.deepEqual(prescription.problems[0].medicationIds, [prescription.medications[0].id]);
  assert.deepEqual(prescription.problems[0].highlights, ["500 mg"]);
  assert.equal(prescription.problems[0].reviewStatus, "suggested");
  assert.equal(prescription.problems[0].finalIntervention, null);
  assert.equal(prescription.medications[0].sourceText, medication.sourceText);
  assert.equal(globalThis.scanTest.logs.length, 0);
  assert.equal(globalThis.scanTest.calls.length, 1);
  assert.equal(globalThis.scanTest.options.httpOptions.retryOptions.attempts, 1);
  assert.equal(globalThis.scanTest.options.httpOptions.timeout, 15000);
  const sent = globalThis.scanTest.calls[0];
  assert.equal(sent.config.responseMimeType, "application/json");
  assert.deepEqual(sent.config.responseSchema.required,
    ["ward", "patientAge", "patientGender", "medications", "problems"]);
  assert.match(sent.contents[0].parts[0].text, /Never return patient names or ID numbers/);
});

test("invalid input never calls Gemini", async () => {
  for (const body of [
    {}, { ...input, mimeType: "application/pdf" }, { ...input, imageBase64: "%%%" },
    { ...input, imageBase64: "" }, { ...input, imageBase64: "aW1hZ2U=garbage" },
    { ...input, extra: "PATIENT_SECRET" },
  ]) {
    globalThis.scanTest.logs = [];
    await failed(request(body), "input", "invalid_input", /image request is invalid/);
  }
  globalThis.scanTest.logs = [];
  await failed(new Request("http://localhost/api/scan", { method: "POST", body: "{" }),
    "input", "invalid_input", /image request is invalid/);
  assert.equal(globalThis.scanTest.calls.length, 0);
});

test("missing configuration is actionable and sanitized", async () => {
  delete process.env.GEMINI_API_KEY;
  await failed(request(), "configuration", "configuration", /check the selected Gemini provider/);
  assert.equal(globalThis.scanTest.calls.length, 0);
});

for (const [status, reason, pattern] of [
  [503, "provider_unavailable", /temporarily unavailable/],
  [504, "provider_unavailable", /temporarily unavailable/],
  [429, "provider_quota", /generation quota/],
  [401, "provider_access", /model permissions/],
  [403, "provider_access", /model permissions/],
  [400, "provider_request", /scan configuration/],
  [404, "provider_request", /scan configuration/],
]) test(`provider rejection ${status} retains envelope without private error details`, async () => {
  globalThis.scanTest.generate = async () => {
    throw Object.assign(new Error("PRIVATE_PROVIDER_BODY PATIENT_SECRET synthetic-unit-test-key"), { status });
  };
  const diagnostic = await failed(request(), "generation", reason, pattern);
  assert.equal(diagnostic.providerStatus, status);
  assert.equal(globalThis.scanTest.calls.length, 1);
});

test("unknown errors do not disclose raw exception details", async () => {
  globalThis.scanTest.generate = async () => { throw new Error("PRIVATE_PROVIDER_BODY"); };
  await failed(request(), "generation", "unexpected", /could not be completed/);
});
test("no structured output is unusable", async () => {
  globalThis.scanTest.generate = async () => ({});
  await failed(request(), "generation", "empty_output", /unusable scan result/);
});
test("invalid JSON is distinguished from schema failure", async () => {
  globalThis.scanTest.generate = async () => ({ text: "PRIVATE_PROVIDER_BODY {" });
  await failed(request(), "json", "invalid_json", /unusable scan result/);
});
test("schema rejects extra patient fields, invalid codes and nonnullable omissions", async () => {
  for (const output of [
    { ...valid(), patientName: "PATIENT_SECRET" },
    { ...valid(), patientAge: -1 },
    { ...valid(), problems: [{ ...problem(), problemCode: "P999" }] },
    { ...valid(), problems: [{ ...problem(), medicationIndexes: [] }] },
    { ...valid(), medications: [{ ...medication, dose: undefined }] },
  ]) {
    globalThis.scanTest.logs = [];
    globalThis.scanTest.generate = async () => ({ text: JSON.stringify(output) });
    await failed(request(), "schema", "invalid_schema", /unusable scan result/);
  }
});
test("out-of-range medication references are rejected", async () => {
  globalThis.scanTest.generate = async () => ({
    text: JSON.stringify({ ...valid(), problems: [{ ...problem(), medicationIndexes: [1] }] }),
  });
  await failed(request(), "conversion", "invalid_reference", /unusable scan result/);
});
test("normalized, invented or nonreferenced source highlights are rejected", async () => {
  for (const output of [
    { ...valid(), problems: [{ ...problem(), highlights: ["500mg"] }] },
    { ...valid(), problems: [{ ...problem(), highlights: ["PATIENT_SECRET"] }] },
    { ...valid(), medications: [{ ...medication, sourceText: null }], problems: [problem()] },
    { ...valid(), medications: [{ ...medication }, { ...medication, sourceText: "elsewhere" }],
      problems: [{ ...problem(), highlights: ["elsewhere"] }] },
  ]) {
    globalThis.scanTest.logs = [];
    globalThis.scanTest.generate = async () => ({ text: JSON.stringify(output) });
    await failed(request(), "conversion", "invalid_highlight", /unusable scan result/);
  }
});
test("15-second deadline aborts generation and returns one safe failure", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.scanTest.generate = () => new Promise(() => {});
  const pending = failed(request(), "generation", "timeout", /timed out after 15 seconds/);
  // Allow request.json() and generation to start before advancing the deadline.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(globalThis.scanTest.calls.length, 1);
  t.mock.timers.tick(15000);
  await pending;
  assert.equal(globalThis.scanTest.calls[0].config.abortSignal.aborted, true);
});
test("provider aborts also use the timeout envelope", async () => {
  globalThis.scanTest.generate = async () => {
    throw Object.assign(new Error("PRIVATE_PROVIDER_BODY"), { name: "AbortError" });
  };
  await failed(request(), "generation", "timeout", /timed out after 15 seconds/);
});
