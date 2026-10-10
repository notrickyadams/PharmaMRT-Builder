import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === configUrl) return {
      format: "module", shortCircuit: true,
      source: `export const GEMINI_MODEL = "gemini-3.8-flash";
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
async function finishAfterDelay(t, promise) {
  let resolved = false;
  promise.then(() => { resolved = true; });
  t.mock.timers.tick(1999);
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
  test(`fictional pair ${example} waits two seconds, never calls Gemini and preserves references`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const scanResponse = await finishAfterDelay(t, scan.POST(request("scan", example)));
    const analyzeResponse = await finishAfterDelay(t, analyze.POST(request("analyze", example)));
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
    assert.ok(scanned.prescription.labs.length > 0);
    assert.match(scanned.demoNotice, /Not extracted from your image/);
    assert.equal(analyzed.problems.length, 2);
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
test("requests without a selector return the first paired example", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const scanned = await (await finishAfterDelay(t, scan.POST(request("scan")))).json();
  const analyzed = await (await finishAfterDelay(t, analyze.POST(request("analyze")))).json();
  assert.equal(scanned.exampleId, "demo-1");
  assert.equal(analyzed.prescriptionId, scanned.prescription.id);
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
test("when demo is off, analyze is explicitly unavailable and scan still validates live input", async () => {
  config.setDemoMode(false);
  const response = await analyze.POST(request("analyze"));
  const result = await response.json();
  assert.equal(result.source, "failed");
  assert.equal(result.problems, null);
  assert.match(result.error, /Live analysis is not implemented/);
  const warn = console.warn;
  console.warn = () => {};
  try {
    const scanned = await (await scan.POST(request("scan"))).json();
    assert.equal(scanned.source, "failed");
    assert.equal(scanned.prescription, null);
    assert.match(scanned.error, /image request is invalid/);
  } finally {
    console.warn = warn;
  }
});
