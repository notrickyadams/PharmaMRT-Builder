import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";
import ts from "typescript";

// Only the SDK is mocked. Both real routes, Zod, and converters run unchanged.
// TEST_PROVIDER exercises the deliberate config selection in an isolated process.
const root = new URL("../../../", import.meta.url);
const provider = process.env.TEST_PROVIDER ?? "managed";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@google/genai") return { url: "gemini-test:sdk", shortCircuit: true };
    if (specifier.startsWith("@/")) {
      return { url: new URL(`${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith(root.href)) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "gemini-test:sdk") return {
      format: "module", shortCircuit: true,
      source: `export const Type = { STRING:"STRING", INTEGER:"INTEGER", ARRAY:"ARRAY", OBJECT:"OBJECT" };
        export class GoogleGenAI {
          constructor(options) {
            globalThis.geminiTest.options.push(options);
            this.models = { generateContent: async (request) => {
              globalThis.geminiTest.calls.push(request);
              return globalThis.geminiTest.generate(request);
            }};
          }
        }`,
    };
    if (url.startsWith(root.href) && url.endsWith(".ts")) {
      let source = readFileSync(fileURLToPath(url), "utf8");
      if (url === new URL("lib/config.ts", root).href && provider === "personal") {
        source = source.replace('= "managed";', '= "personal";');
      }
      return {
        format: "module", shortCircuit: true,
        source: ts.transpileModule(source, {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
    }
    return next(url, context);
  },
});

const scan = await import("../scan/route.ts");
const analyze = await import("../analyze/route.ts");
const { analyzeRequestSchema } = await import("../analyze/validation.ts");
const med = {
  id: "fictional-medication", name: "Amoxicillin", dose: "500", unit: "mg",
  frequency: "three times daily", route: "oral", duration: null,
  sourceText: "Amoxicillin 500 mg oral three times daily; duration not specified.",
};
const prescription = () => ({
  id: "fictional-prescription", scannedAt: "2026-01-01T12:00:00.000Z",
  ward: null, patientAge: null, patientGender: null,
  medications: [{ ...med }], problems: [], status: "pending",
});
const scanOutput = () => {
  const { id, ...medication } = med;
  return { ward: null, patientAge: null, patientGender: null, medications: [medication], problems: [] };
};
const problem = () => ({
  medicationIndexes: [0], problemCode: null, causeCode: null, explanation: null,
  severity: null, suggestedIntervention: null, highlights: ["duration not specified"],
});
const input = { imageBase64: "aW1hZ2U=", mimeType: "image/png" };
const request = (body) => new Request("http://localhost/api/test", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});
const originalWarn = console.warn;
beforeEach(() => {
  // Synthetic keys only, in this process. Never read inherited secret values.
  process.env.GEMINI_API_KEY = "synthetic-personal";
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "synthetic-managed";
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = "https://managed.invalid";
  globalThis.geminiTest = {
    calls: [], options: [], logs: [],
    generate: async () => ({ text: JSON.stringify(scanOutput()) }),
  };
  console.warn = (...args) => globalThis.geminiTest.logs.push(args);
});
process.on("exit", () => { console.warn = originalWarn; });

async function failure(route, req, stage, reason) {
  const response = await route.POST(req);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.source, "failed");
  assert.equal(route === scan ? payload.prescription : payload.problems, null);
  assert.equal(typeof payload.error, "string");
  const diagnostic = globalThis.geminiTest.logs.at(-1)[1];
  assert.equal(diagnostic.stage, stage);
  assert.equal(diagnostic.reason, reason);
  assert.deepEqual(Object.keys(diagnostic).sort(),
    ("providerStatus" in diagnostic ? ["providerStatus", "reason", "stage"] : ["reason", "stage"]));
  assert.doesNotMatch(JSON.stringify([payload, globalThis.geminiTest.logs]),
    /synthetic-|PRIVATE_PROVIDER_BODY|PRIVATE_PATIENT_TEXT/);
  return payload;
}

test(`${provider}: both endpoints use only the selected provider, one attempt and JSON contract`, async () => {
  assert.deepEqual(await scan.GET().json(), { demoMode: false });
  const { prescription: output, source } = await (await scan.POST(request(input))).json();
  assert.equal(source, "ai");
  assert.equal(output.status, "pending");
  assert.equal(output.medications[0].dose, "500");
  globalThis.geminiTest.generate = async () => ({ text: JSON.stringify({ problems: [problem()] }) });
  const result = await (await analyze.POST(request({ prescription: output }))).json();
  assert.equal(result.source, "ai");
  assert.equal(result.prescriptionId, output.id);
  const suggested = result.problems[0];
  assert.deepEqual(suggested.medicationIds, [output.medications[0].id]);
  assert.deepEqual(suggested.highlights, ["duration not specified"]);
  for (const field of ["problemCode", "causeCode", "explanation", "severity", "suggestedIntervention",
    "finalIntervention", "acceptance", "notes"]) assert.equal(suggested[field], null);
  assert.equal(suggested.reviewStatus, "suggested");
  assert.match(suggested.id, /^[\da-f-]{36}$/);
  for (const options of globalThis.geminiTest.options) {
    assert.equal(options.apiKey, `synthetic-${provider}`);
    assert.equal(options.httpOptions.timeout, 15000);
    assert.equal(options.httpOptions.retryOptions.attempts, 1);
    assert.equal(options.httpOptions.baseUrl, provider === "managed" ? "https://managed.invalid" : undefined);
    assert.equal(options.httpOptions.apiVersion, provider === "managed" ? "" : undefined);
  }
  for (const call of globalThis.geminiTest.calls) {
    assert.equal(call.model, "gemini-3.8-flash");
    assert.equal(call.config.responseMimeType, "application/json");
    assert.equal("responseSchema" in call.config, provider === "personal");
    assert.equal(call.config.abortSignal.aborted, false);
    const prompt = call.contents[0].parts[0].text;
    assert.match(prompt, /Do not invent drug interactions/);
    assert.match(prompt, /Every highlight must be an exact quote/);
    assert.equal(prompt.includes("JSON field/type/enum contract"), provider === "managed");
  }
  assert.equal(globalThis.geminiTest.calls.length, 2);
});

test("analyze sends only indexed medication source text, not patient context or prior suggestions", async () => {
  const value = prescription();
  value.ward = "PRIVATE_PATIENT_TEXT";
  value.medications[0].name = "PRIVATE_PATIENT_TEXT";
  globalThis.geminiTest.generate = async () => ({ text: '{"problems":[]}' });
  const result = await (await analyze.POST(request({ prescription: value }))).json();
  assert.deepEqual(result, { prescriptionId: value.id, problems: [], source: "ai" });
  const content = globalThis.geminiTest.calls[0].contents;
  assert.doesNotMatch(JSON.stringify(content), /PRIVATE_PATIENT_TEXT|fictional-medication|fictional-prescription/);
  assert.deepEqual(JSON.parse(content[0].parts[1].text), {
    medications: [{ medicationIndex: 0, sourceText: med.sourceText }],
  });
});

test("missing selected credentials fails without using the other available provider", async () => {
  delete process.env[provider === "managed" ? "AI_INTEGRATIONS_GEMINI_API_KEY" : "GEMINI_API_KEY"];
  await failure(scan, request(input), "configuration", "configuration");
  await failure(analyze, request({ prescription: prescription() }), "configuration", "configuration");
  assert.equal(globalThis.geminiTest.calls.length, 0);
});

test("managed also requires its base URL even when the personal key exists", async () => {
  if (provider !== "managed") return;
  delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  await failure(scan, request(input), "configuration", "configuration");
  assert.equal(globalThis.geminiTest.calls.length, 0);
});

test("scan accepts 7,999,999 bytes, rejects 8,000,000 bytes and overlong base64 before generation", async () => {
  for (const bytes of [7_999_999, 8_000_000, 8_000_001, 8_000_002]) {
    const data = { ...input, imageBase64: Buffer.alloc(bytes, 65).toString("base64") };
    if (bytes < 8_000_000) {
      assert.equal((await (await scan.POST(request(data))).json()).source, "ai");
    } else await failure(scan, request(data), "input", "invalid_input");
  }
  assert.equal(globalThis.geminiTest.calls.length, 1);
});

test("malformed or noncanonical scan input never generates", async () => {
  for (const body of [
    {}, { ...input, mimeType: "application/pdf" }, { ...input, imageBase64: "%%%" },
    { ...input, imageBase64: "" }, { ...input, imageBase64: "aW1hZ2U=garbage" },
    { ...input, extra: "PRIVATE_PATIENT_TEXT" },
  ]) await failure(scan, request(body), "input", "invalid_input");
  await failure(scan, new Request("http://localhost/api/scan", { method: "POST", body: "{" }),
    "input", "invalid_input");
  assert.equal(globalThis.geminiTest.calls.length, 0);
});

test("bounded body reads reject actual and declared excess sizes without generation", async () => {
  const req = request({ prescription: prescription() });
  req.headers.set("content-length", "256001");
  await failure(analyze, req, "input", "invalid_input");
  const scanReq = request(input);
  scanReq.headers.set("content-length", "10667693");
  await failure(scan, scanReq, "input", "invalid_input");
  await failure(analyze, new Request("http://localhost/api/analyze", {
    method: "POST", body: " ".repeat(256_001),
  }), "input", "invalid_input");
  await failure(scan, new Request("http://localhost/api/scan", {
    method: "POST", body: " ".repeat(10_667_693),
  }), "input", "invalid_input");
  assert.equal(globalThis.geminiTest.calls.length, 0);
});

test("strict analyze context rejects wrong shape, unknown fields, missing text, duplicate IDs and bad citations", async () => {
  const variants = [
    {}, { prescription: {} }, { prescription: prescription(), extra: true },
    { prescription: { ...prescription(), patientName: "PRIVATE_PATIENT_TEXT" } },
    { prescription: { ...prescription(), medications: [] } },
    { prescription: { ...prescription(), medications: [{ ...med, sourceText: null }] } },
    { prescription: { ...prescription(), medications: [{ ...med, sourceText: " " }] } },
    { prescription: { ...prescription(), medications: [{ ...med }, { ...med }] } },
    { prescription: { ...prescription(), patientAge: -1 } },
    { prescription: { ...prescription(), scannedAt: "invalid" } },
    { prescription: { ...prescription(), medications: [{ ...med, dose: undefined }] } },
  ];
  for (const body of variants) await failure(analyze, request(body), "input", "invalid_input");
  const baseProblem = {
    id: "fictional-problem", medicationIds: [med.id], problemCode: null, causeCode: null,
    explanation: null, severity: null, suggestedIntervention: null, finalIntervention: null,
    acceptance: null, reviewStatus: "suggested", highlights: ["500 mg"], notes: null,
  };
  assert.equal(analyzeRequestSchema.safeParse({
    prescription: { ...prescription(), problems: [baseProblem] },
  }).success, true);
  for (const altered of [
    { ...baseProblem, medicationIds: ["missing"] },
    { ...baseProblem, highlights: ["500mg"] },
    { ...baseProblem, severity: "extreme" },
  ]) await failure(analyze, request({ prescription: { ...prescription(), problems: [altered] } }),
    "input", "invalid_input");
  assert.equal(globalThis.geminiTest.calls.length, 0);
});

for (const route of [scan, analyze]) {
  const name = route === scan ? "scan" : "analyze";
  const req = () => request(route === scan ? input : { prescription: prescription() });
  const output = (problems) => route === scan ? { ...scanOutput(), problems } : { problems };

  for (const [status, reason] of [
    [400, "provider_request"], [401, "provider_access"], [403, "provider_access"],
    [404, "provider_request"], [429, "provider_quota"], [503, "provider_unavailable"],
  ]) test(`${name}: provider ${status} is safe and never triggers fallback or a second attempt`, async () => {
    globalThis.geminiTest.generate = async () => {
      throw Object.assign(new Error("PRIVATE_PROVIDER_BODY PRIVATE_PATIENT_TEXT synthetic-personal"), { status });
    };
    await failure(route, req(), "generation", reason);
    assert.equal(globalThis.geminiTest.calls.length, 1);
    assert.equal(globalThis.geminiTest.options.length, 1);
  });

  test(`${name}: malformed JSON, missing output and invalid model schemas fail explicitly`, async () => {
    for (const [response, stage, reason] of [
      [{}, "generation", "empty_output"],
      [{ text: "{" }, "json", "invalid_json"],
      [{ text: JSON.stringify({ ...output([]), patientName: "PRIVATE_PATIENT_TEXT" }) }, "schema", "invalid_schema"],
      [{ text: JSON.stringify(output([{ ...problem(), problemCode: "P999" }])) }, "schema", "invalid_schema"],
      [{ text: JSON.stringify(output([{ ...problem(), medicationIndexes: [] }])) }, "schema", "invalid_schema"],
      [{ text: JSON.stringify(output([{ ...problem(), explanation: undefined }])) }, "schema", "invalid_schema"],
    ]) {
      globalThis.geminiTest.generate = async () => response;
      await failure(route, req(), stage, reason);
    }
  });

  test(`${name}: out-of-range references and non-exact highlights remain unusable`, async () => {
    for (const [altered, reason] of [
      [{ ...problem(), medicationIndexes: [1] }, "invalid_reference"],
      [{ ...problem(), highlights: ["500mg"] }, "invalid_highlight"],
      [{ ...problem(), highlights: ["PRIVATE_PATIENT_TEXT"] }, "invalid_highlight"],
    ]) {
      globalThis.geminiTest.generate = async () => ({ text: JSON.stringify(output([altered])) });
      await failure(route, req(), "conversion", reason);
    }
  });

  test(`${name}: 15-second deadline aborts exactly one generation`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    globalThis.geminiTest.generate = () => new Promise(() => {});
    const pending = failure(route, req(), "generation", "timeout");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(globalThis.geminiTest.calls.length, 1);
    t.mock.timers.tick(15_000);
    await pending;
    assert.equal(globalThis.geminiTest.calls[0].config.abortSignal.aborted, true);
  });

  test(`${name}: slow upload deadline cannot cause generation after the response`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const stream = new ReadableStream({ start() {} });
    const pending = failure(route, new Request("http://localhost/api/test", {
      method: "POST", body: stream, duplex: "half",
    }), "input", "timeout");
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(15_000);
    await pending;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(globalThis.geminiTest.calls.length, 0);
  });

  test(`${name}: SDK abort and unknown failures are sanitized`, async () => {
    globalThis.geminiTest.generate = async () => {
      throw Object.assign(new Error("PRIVATE_PROVIDER_BODY"), { name: "AbortError" });
    };
    await failure(route, req(), "generation", "timeout");
    globalThis.geminiTest.generate = async () => { throw new Error("PRIVATE_PROVIDER_BODY"); };
    await failure(route, req(), "generation", "unexpected");
  });
}
