import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const modelURL = new URL("../lib/administration-instructions.ts", import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    if (url === modelURL) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
const { INSTRUCTIONS_KEY, readInstructions, saveInstructions, removeInstructions } = await import(modelURL);
const cases = [{ id: "training-case", review: { medications: [{ id: "medication" }] } }];
function storage(initial = null) {
  let raw = initial;
  return {
    getItem(key) { assert.equal(key, INSTRUCTIONS_KEY); return raw; },
    setItem(key, value) { assert.equal(key, INSTRUCTIONS_KEY); raw = value; },
  };
}
function draft(overrides = {}) {
  return {
    caseId: "training-case", medicationId: "medication",
    route: null, ivMethod: null, diluentType: null, diluentVolumeMl: null,
    infusionDurationMinutes: null, mealTiming: null, ...overrides,
  };
}
test("IV infusion instructions persist exactly and updates replace only that medication", () => {
  const store = storage();
  const original = JSON.stringify(cases);
  const initial = saveInstructions(draft({
    route: "iv", ivMethod: "infusion", diluentType: "Documented training diluent",
    diluentVolumeMl: 100, infusionDurationMinutes: 30,
  }), cases, store);
  assert.equal(initial.ok, true);
  assert.equal(readInstructions(store).value[0].diluentVolumeMl, 100);
  const update = saveInstructions(draft({ route: "iv", ivMethod: "bolus" }), cases, store);
  assert.equal(update.ok, true);
  assert.equal(update.value.length, 1);
  assert.equal(update.value[0].id, initial.value[0].id);
  assert.equal(update.value[0].createdAt, initial.value[0].createdAt);
  assert.equal(update.value[0].diluentType, null);
  assert.equal(update.value[0].infusionDurationMinutes, null);
  assert.equal(JSON.stringify(cases), original);
});
test("oral before/after meals and unspecified instructions round trip without guessing", () => {
  const store = storage();
  for (const mealTiming of ["before_meals", "after_meals", null]) {
    const result = saveInstructions(draft({ route: "oral", mealTiming }), cases, store);
    assert.equal(result.ok, true);
    assert.equal(readInstructions(store).value[0].mealTiming, mealTiming);
    assert.equal(result.value[0].ivMethod, null);
  }
  const unknown = saveInstructions(draft(), cases, store);
  assert.equal(unknown.ok, true);
  assert.equal(unknown.value[0].route, null);
  assert.equal(unknown.value[0].diluentVolumeMl, null);
});
test("inapplicable hidden fields and invalid amounts cannot be saved", () => {
  for (const invalid of [
    { route: "oral", ivMethod: "infusion" },
    { route: "iv", ivMethod: "bolus", diluentVolumeMl: 100 },
    { route: "iv", ivMethod: "infusion", mealTiming: "before_meals" },
    { route: "iv", ivMethod: "infusion", infusionDurationMinutes: 0 },
    { route: "iv", ivMethod: "infusion", diluentVolumeMl: -5 },
    { route: "iv", ivMethod: "infusion", diluentVolumeMl: Number.NaN },
    { route: "iv", ivMethod: "infusion", infusionDurationMinutes: Infinity },
  ]) assert.equal(saveInstructions(draft(invalid), cases, storage()).ok, false);
});
test("missing case/medication references fail explicitly", () => {
  assert.equal(saveInstructions(draft({ caseId: "missing" }), cases, storage()).ok, false);
  assert.equal(saveInstructions(draft({ medicationId: "missing" }), cases, storage()).ok, false);
});
test("removal persists and never writes to the legacy dose log or reviewed cases", () => {
  const store = storage();
  saveInstructions(draft({ route: "iv", ivMethod: "bolus" }), cases, store);
  const removed = removeInstructions("training-case", "medication", store);
  assert.equal(removed.ok, true);
  assert.deepEqual(readInstructions(store).value, []);
});
test("malformed and duplicate entries are not overwritten", () => {
  const store = storage("{invalid");
  assert.equal(readInstructions(store).ok, false);
  assert.equal(saveInstructions(draft(), cases, store).ok, false);
  assert.equal(removeInstructions("training-case", "medication", store).ok, false);
  assert.equal(store.getItem(INSTRUCTIONS_KEY), "{invalid");
  const valid = storage();
  const entry = saveInstructions(draft(), cases, valid).value[0];
  assert.equal(readInstructions(storage(JSON.stringify([entry, entry]))).ok, false);
});
test("storage failures retain drafts and report the failure", () => {
  const input = draft({ route: "oral", mealTiming: "after_meals" });
  const original = JSON.stringify(input);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() {} };
  const full = { getItem() { return null; }, setItem() { throw new Error("full"); } };
  assert.equal(saveInstructions(input, cases, blocked).ok, false);
  assert.equal(saveInstructions(input, cases, full).ok, false);
  assert.equal(JSON.stringify(input), original);
});
