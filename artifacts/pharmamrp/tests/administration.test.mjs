import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const modelURL = new URL("../lib/administration.ts", import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    if (url === modelURL) {
      return {
        format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { ADMINISTRATION_KEY, readAdministrations, saveAdministration } = await import(modelURL);
const cases = [{
  id: "training-case",
  review: { medications: [
    { id: "active-medication", orderStatus: "active" },
    { id: "stopped-medication", orderStatus: "stopped" },
  ] },
}];
function storage(initial = null) {
  let raw = initial;
  return {
    getItem(key) { assert.equal(key, ADMINISTRATION_KEY); return raw; },
    setItem(key, value) { assert.equal(key, ADMINISTRATION_KEY); raw = value; },
  };
}
function draft(overrides = {}) {
  return {
    caseId: "training-case", medicationId: "active-medication",
    status: "given", administeredAt: new Date(Date.now() - 60_000).toISOString(),
    scheduledAt: null, dose: "500", unit: "mg", route: null,
    reason: null, notes: null, ...overrides,
  };
}

test("given and missed doses persist separately without changing prescription records", () => {
  const store = storage();
  const original = JSON.stringify(cases);
  assert.deepEqual(readAdministrations(store), { ok: true, value: [] });
  const given = saveAdministration(draft(), cases, store);
  assert.equal(given.ok, true);
  assert.equal(given.value[0].route, null);
  const missed = saveAdministration(draft({
    status: "missed", administeredAt: null, dose: null, unit: null,
    reason: "Fictional training: dose not available.",
  }), cases, store);
  assert.equal(missed.ok, true);
  assert.equal(readAdministrations(store).value.length, 2);
  assert.equal(new Set(missed.value.map(entry => entry.id)).size, 2);
  assert.equal(missed.value[0].status, "missed");
  assert.equal(JSON.stringify(cases), original);
});

test("actual dose and administration time must be supplied for given doses", () => {
  for (const changes of [{ dose: null }, { administeredAt: null }, { dose: "" }]) {
    assert.equal(saveAdministration(draft(changes), cases, storage()).ok, false);
  }
});

test("missed entries require a reason and cannot claim administration details", () => {
  const missed = { status: "missed", administeredAt: null, dose: null, unit: null, route: null };
  assert.equal(saveAdministration(draft({ ...missed, reason: null }), cases, storage()).ok, false);
  assert.equal(saveAdministration(draft({ ...missed, reason: "Missed", dose: "500" }), cases, storage()).ok, false);
});

test("missing case/medication, stopped orders and future events fail explicitly", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  for (const changes of [
    { caseId: "missing" }, { medicationId: "missing" },
    { medicationId: "stopped-medication" }, { administeredAt: future },
    { administeredAt: "not-a-date" },
    { status: "missed", dose: null, unit: null, administeredAt: null, scheduledAt: future, reason: "Missed" },
  ]) {
    assert.equal(saveAdministration(draft(changes), cases, storage()).ok, false);
  }
});

test("corrupt or duplicate stored entries are never silently overwritten", () => {
  const corrupt = storage("{invalid");
  assert.equal(readAdministrations(corrupt).ok, false);
  assert.equal(saveAdministration(draft(), cases, corrupt).ok, false);
  assert.equal(corrupt.getItem(ADMINISTRATION_KEY), "{invalid");
  const store = storage();
  const entry = saveAdministration(draft(), cases, store).value[0];
  const duplicate = storage(JSON.stringify([entry, entry]));
  assert.equal(readAdministrations(duplicate).ok, false);
});

test("blocked and full storage fail without changing the entered draft", () => {
  const input = draft();
  const original = JSON.stringify(input);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() {} };
  assert.equal(readAdministrations(blocked).ok, false);
  assert.equal(saveAdministration(input, cases, blocked).ok, false);
  const full = { getItem() { return null; }, setItem() { throw new Error("full"); } };
  assert.equal(saveAdministration(input, cases, full).ok, false);
  assert.equal(JSON.stringify(input), original);
});
