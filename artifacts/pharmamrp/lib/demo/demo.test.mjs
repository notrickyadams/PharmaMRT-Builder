import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const configUrl = "demo-test:config";
const providerUrl = "demo-test:provider";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/config") return { url: configUrl, shortCircuit: true };
    if (specifier === "@google/genai") return { url: providerUrl, shortCircuit: true };
    if (specifier.startsWith("@/"))
      return { url: new URL(`${specifier.slice(2)}.ts`, root).href, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith(root.href)) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === configUrl) return {
      format: "module", shortCircuit: true,
      source: `export const GEMINI_MODEL = "gemini-3.8-flash";
        export const GEMINI_PROVIDER = "managed";
        export let DEMO_MODE = true;
        export function setDemoMode(enabled) { DEMO_MODE = enabled; }`,
    };
    if (url === providerUrl) return {
      format: "module", shortCircuit: true,
      source: `export const Type = { STRING: "STRING", INTEGER: "INTEGER", ARRAY: "ARRAY", OBJECT: "OBJECT" };
        export class GoogleGenAI {
          constructor() { throw new Error("Demo must never instantiate the Gemini client."); }
        }`,
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
const config = await import(configUrl);
const scan = await import("../../app/api/scan/route.ts");
const analyze = await import("../../app/api/analyze/route.ts");
beforeEach(() => config.setDemoMode(true));

const request = (kind, example) => new Request(
  `http://localhost/api/${kind}${example === undefined ? "" : `?example=${example}`}`,
  { method: "POST", body: "An ignored fictional demo upload" },
);
async function finishAfterDelay(t, promise, milliseconds) {
  let resolved = false;
  promise.then(() => { resolved = true; });
  // JSON selection may need a microtask before scheduling the demo timer.
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(milliseconds - 1);
  await Promise.resolve();
  assert.equal(resolved, false);
  t.mock.timers.tick(1);
  return promise;
}

test("DEMO_MODE stays enabled regardless of the environment setting", async () => {
  const previous = process.env.DEMO_MODE;
  const source = ts.transpileModule(readFileSync(new URL("../config.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
  try {
    for (const setting of [undefined, "false", "TRUE", "true"]) {
      if (setting === undefined) delete process.env.DEMO_MODE;
      else process.env.DEMO_MODE = setting;
      const module = await import(`data:text/javascript;base64,${Buffer.from(source + `\n// ${setting}`).toString("base64")}`);
      assert.equal(module.DEMO_MODE, true);
    }
  } finally {
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  }
});

for (const example of [1, 2, 3]) {
  test(`fictional pair ${example} waits 5s/3s, never calls Gemini and preserves references`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const scanResponse = await finishAfterDelay(t, scan.POST(request("scan", example)), 5_000);
    const analyzeResponse = await finishAfterDelay(t, analyze.POST(request("analyze", example)), 3_000);
    const scanned = await scanResponse.json();
    const analyzed = await analyzeResponse.json();
    assert.equal(scanned.source, "demo");
    assert.equal(analyzed.source, "demo");
    assert.equal(scanResponse.status, 200);
    assert.equal(analyzeResponse.status, 200);
    assert.equal(scanResponse.headers.get("cache-control"), "no-store");
    assert.equal(scanned.exampleId, analyzed.exampleId);
    assert.equal(scanned.prescription.id, analyzed.prescriptionId);
    assert.match(scanned.prescription.patientName, /^Fictional /);
    assert.match(scanned.prescription.fileNumber, /^DEMO-FILE-/);
    assert.ok(scanned.prescription.medications.length > 0);
    assert.ok((scanned.prescription.labOrders ?? scanned.prescription.labs).length > 0);
    assert.match(scanned.demoNotice, /Not extracted from your image/);
    assert.ok(analyzed.problems.length >= 2 && analyzed.problems.length <= 3);
    assert.ok(analyzed.problems.some(({ notes }) => notes?.includes("reject")),
      "Every presentation example includes an explicitly rejectable suggestion.");
    for (const problem of analyzed.problems) {
      const cited = problem.medicationIds.map((id) => {
        const medication = scanned.prescription.medications.find((medication) => medication.id === id);
        assert.ok(medication, "Every reference points to a medication in its paired scan.");
        return medication.sourceText;
      });
      assert.ok(problem.highlights.length > 0);
      for (const highlight of problem.highlights)
        assert.ok(cited.some((text) => text.includes(highlight)), "Highlights are exact source quotes.");
      assert.equal(problem.reviewStatus, "suggested");
      assert.equal(problem.finalIntervention, null);
      assert.equal(problem.acceptance, null);
      assert.ok(["P1", "P2", "P3"].includes(problem.problemCode));
      assert.ok(["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9"].includes(problem.causeCode));
      assert.ok(["I0", "I1", "I2", "I3", "I4"].includes(problem.suggestedIntervention));
    }
  });
}
test("standalone requests rotate through all three matched pairs, then wrap to the first", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const example of [1, 2, 3, 1]) {
    const scanned = await (await finishAfterDelay(t, scan.POST(request("scan")), 5_000)).json();
    const analyzed = await (await finishAfterDelay(t, analyze.POST(request("analyze")), 3_000)).json();
    assert.equal(scanned.exampleId, `demo-${example}`);
    assert.equal(analyzed.exampleId, scanned.exampleId);
    assert.equal(analyzed.prescriptionId, scanned.prescription.id);
  }
});

test("explicit selectors do not consume the rotation", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await finishAfterDelay(t, scan.POST(request("scan", 3)), 5_000);
  const scanned = await (await finishAfterDelay(t, scan.POST(request("scan")), 5_000)).json();
  assert.equal(scanned.exampleId, "demo-2");
});

test("analyze follows a supplied fictional prescription, including out-of-order scans", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scanned = await (await finishAfterDelay(t, scan.POST(request("scan", 3)), 5_000)).json();
  for (const body of [
    { prescription: scanned.prescription },
    { prescriptionId: scanned.prescription.id },
  ]) {
    const analyzed = await (await finishAfterDelay(t, analyze.POST(new Request(
      "http://localhost/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    )), 3_000)).json();
    assert.equal(analyzed.exampleId, scanned.exampleId);
    assert.equal(analyzed.prescriptionId, scanned.prescription.id);
  }
  const next = await (await finishAfterDelay(t, analyze.POST(request("analyze")), 3_000)).json();
  assert.equal(next.exampleId, "demo-1");
});

test("concurrent scans reserve distinct examples before the delay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = [scan.POST(request("scan")), scan.POST(request("scan")), scan.POST(request("scan"))];
  const responses = await finishAfterDelay(t, Promise.all(pending), 5_000);
  const results = await Promise.all(responses.map((response) => response.json()));
  assert.deepEqual(results.map(({ exampleId }) => exampleId), ["demo-3", "demo-1", "demo-2"]);
});

test("unknown or malformed analyze input remains fictional and never calls a provider", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const body of ["{", JSON.stringify({ prescription: { id: "unknown" } })]) {
    const result = await (await finishAfterDelay(t, analyze.POST(new Request(
      "http://localhost/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      },
    )), 3_000)).json();
    assert.equal(result.source, "demo");
    assert.match(result.prescriptionId, /^demo-prescription-[123]$/);
  }
});

test("the chest-ward example preserves supplied medication text, statuses, confidence and lab orders", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { prescription } = await (await finishAfterDelay(t, scan.POST(request("scan", 1)), 5_000)).json();
  assert.equal(prescription.ward, "ع. صدرية (Chest ward)");
  assert.equal(prescription.patientAge, null);
  assert.equal(prescription.patientGender, null);
  assert.equal(prescription.patientName, "Fictional Patient Alpha");
  assert.equal(prescription.fileNumber, "DEMO-FILE-001");
  assert.deepEqual(prescription.medications.map(({ sourceText }) => sourceText), [
    "Rocephin 2 gm IV after sens-", "Tavanic 750 mg T", "Dexa 8 mg amp", "ACC 600 eff",
    "clexane 60 unit sc", "lasix 20 mg amp if BP > 90/60", "Controloc 40 mg IV",
    "nebulize atrovent + Farcolin", "nebulize atrovent + Farcolin", "nebulize Pulmicort",
    "unasyn 1.5 gm IV", "Rivarospire 10 mg tab",
  ]);
  assert.equal(prescription.medications[0].orderStatus, "stopped");
  assert.equal(prescription.medications[4].orderStatus, "modified");
  assert.equal(prescription.medications[4].unit, "unit");
  assert.equal(prescription.medications[5].conditions, "if BP > 90/60");
  assert.equal(prescription.medications[11].confidence, "low");
  assert.equal(prescription.medications[11].genericName, null);
  assert.deepEqual(prescription.labOrders.map(({ test, date, sourceText }) => [test, date, sourceText]), [
    ["CBC", "19/2", "CBC"], ["Chem", "19/2", "Chem"], ["CRP", "19/2", "CRP"],
    ["CK-mb, hs trop", "19/2", "CK-mb, hs trop"], ["Virology", "19/2", "Virology"],
    ["s-albumin", "19/2", "s-albumin"], ["CBC", "20/2", "CBC"], ["Chem", "20/2", "Chem"],
    ["CRP", "20/2", "CRP"], ["PT, PTT, INR", "20/2", "PT,PTT,INR"],
    ["Total & Direct Bilirubin", "20/2", "Total & Direct Bilirubin"], ["Virology", "20/2", "Virology"],
    ["CBC", "21/2", "CBC"], ["Chem", "21/2", "Chem"], ["Total Protein", "22/2", "Total Protein"],
    ["Albumin", "22/2", "Albumin"],
  ]);
});
test("invalid selectors fail explicitly rather than selecting a different example", async () => {
  for (const example of ["0", "4", "2.0", "unexpected"]) {
    const scanned = await (await scan.POST(request("scan", example))).json();
    const analyzed = await (await analyze.POST(request("analyze", example))).json();
    assert.equal(scanned.source, "failed");
    assert.equal(scanned.prescription, null);
    assert.equal(analyzed.source, "failed");
    assert.equal(analyzed.problems, null);
  }
});
test("status endpoint reports the server flag without caching or provider calls", async () => {
  for (const enabled of [true, false]) {
    config.setDemoMode(enabled);
    const response = scan.GET();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { demoMode: enabled });
  }
});
test("when demo is off, both unchanged live routes validate input without any Gemini call", async () => {
  config.setDemoMode(false);
  const warn = console.warn;
  console.warn = () => {};
  try {
    const result = await (await analyze.POST(request("analyze"))).json();
    assert.equal(result.source, "failed");
    assert.equal(result.problems, null);
    assert.match(result.error, /analysis request is invalid/);
    const scanned = await (await scan.POST(request("scan"))).json();
    assert.equal(scanned.source, "failed");
    assert.equal(scanned.prescription, null);
    assert.match(scanned.error, /image request is invalid/);
  } finally {
    console.warn = warn;
  }
});
