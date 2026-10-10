"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Shell from "@/components/Shell";
import { display } from "@/components/review-model";
import { readCases, type SavedCase } from "@/lib/storage";
import {
  readInstructions,
  removeInstructions,
  saveInstructions,
  type AdministrationInstruction,
  type InstructionDraft,
} from "@/lib/administration-instructions";
import styles from "./administration.module.css";

type FormValues = {
  route: "" | "iv" | "oral";
  ivMethod: "" | "bolus" | "infusion";
  diluentType: string;
  diluentVolumeMl: string;
  infusionDurationMinutes: string;
  mealTiming: "" | "before_meals" | "after_meals";
};

const emptyForm: FormValues = {
  route: "", ivMethod: "", diluentType: "", diluentVolumeMl: "",
  infusionDurationMinutes: "", mealTiming: "",
};

function fromInstruction(entry?: AdministrationInstruction): FormValues {
  if (!entry) return { ...emptyForm };
  return {
    route: entry.route ?? "",
    ivMethod: entry.ivMethod ?? "",
    diluentType: entry.diluentType ?? "",
    diluentVolumeMl: entry.diluentVolumeMl === null ? "" : String(entry.diluentVolumeMl),
    infusionDurationMinutes: entry.infusionDurationMinutes === null ? "" : String(entry.infusionDurationMinutes),
    mealTiming: entry.mealTiming ?? "",
  };
}

function amountValue(value: string, label: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    throw new Error(`${label} must be a finite positive number.`);
  }
  return amount;
}

function caseLabel(item: SavedCase) {
  if (!item.review.fictional) return "Reviewed case";
  const file = display(item.review.fileNumber);
  const ward = display(item.review.ward);
  return `Training file ${file} · ${ward}`;
}

function routeSummary(entry: AdministrationInstruction | undefined) {
  if (!entry) return "No instruction saved";
  if (!entry.route) return "Route unspecified";
  if (entry.route === "oral") {
    const timing = entry.mealTiming === "before_meals" ? "Before meals" :
      entry.mealTiming === "after_meals" ? "After meals" : "Meal timing unspecified";
    return `Oral · ${timing}`;
  }
  if (entry.ivMethod === "bolus") return "IV · Bolus";
  if (entry.ivMethod === "infusion") {
    const parts = ["IV · Infusion"];
    if (entry.diluentType) parts.push(`Diluent: ${entry.diluentType}`);
    if (entry.diluentVolumeMl !== null) parts.push(`${entry.diluentVolumeMl} mL`);
    if (entry.infusionDurationMinutes !== null) parts.push(`${entry.infusionDurationMinutes} min`);
    return parts.join(" · ");
  }
  return "IV · Method unspecified";
}

export default function Administration() {
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [instructions, setInstructions] = useState<AdministrationInstruction[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [medicationId, setMedicationId] = useState("");
  const [form, setForm] = useState<FormValues>({ ...emptyForm });
  const [baseline, setBaseline] = useState(JSON.stringify(emptyForm));
  const [loaded, setLoaded] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const submitLock = useRef(false);
  const queryApplied = useRef(false);
  const selectionRef = useRef({ caseId: selectedCaseId, medicationId });
  selectionRef.current = { caseId: selectedCaseId, medicationId };
  const dirtyRef = useRef(JSON.stringify(form) !== baseline);
  dirtyRef.current = JSON.stringify(form) !== baseline;

  const selectedCase = cases.find(item => item.id === selectedCaseId);
  const medications = selectedCase?.review.medications ?? [];
  const selectedMedication = medications.find(item => item.id === medicationId);
  const selectedInstruction = instructions.find(item =>
    item.caseId === selectedCaseId && item.medicationId === medicationId);
  const selectedSummary = useMemo(() => {
    if (!selectedCase) return [];
    return selectedCase.review.medications.map(med => ({
      medication: med,
      instruction: instructions.find(item => item.caseId === selectedCase.id && item.medicationId === med.id),
    }));
  }, [selectedCase, instructions]);

  const applySelection = useCallback((caseId: string, medId: string, list: AdministrationInstruction[]) => {
    const match = list.find(item => item.caseId === caseId && item.medicationId === medId);
    const next = fromInstruction(match);
    setSelectedCaseId(caseId);
    setMedicationId(medId);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setSaveError(null);
    setSuccess("");
    setConfirmRemove(false);
  }, []);

  const refresh = useCallback(() => {
    const caseResult = readCases();
    if (caseResult.ok) {
      setCases(caseResult.value);
      setCasesError(null);
    } else {
      setCasesError(caseResult.error);
    }
    const result = readInstructions();
    if (result.ok) {
      setInstructions(result.value);
      setInstructionsError(null);
      if (!queryApplied.current) {
        queryApplied.current = true;
        const requestedCase = new URLSearchParams(window.location.search).get("case") ?? "";
        const requestedMedication = new URLSearchParams(window.location.search).get("medication") ?? "";
        const foundCase = caseResult.ok && caseResult.value.some(item => item.id === requestedCase)
          ? requestedCase : "";
        const foundMedication = foundCase && caseResult.ok &&
          caseResult.value.find(item => item.id === foundCase)?.review.medications.some(med => med.id === requestedMedication)
          ? requestedMedication : "";
        applySelection(foundCase, foundMedication, result.value);
      } else if (!dirtyRef.current) {
        const current = selectionRef.current;
        const caseExists = caseResult.ok && caseResult.value.some(item => item.id === current.caseId);
        const medExists = caseExists && caseResult.ok &&
          caseResult.value.find(item => item.id === current.caseId)?.review.medications.some(med => med.id === current.medicationId);
        if (caseExists && medExists) applySelection(current.caseId, current.medicationId, result.value);
      }
    } else {
      setInstructionsError(result.error);
    }
    setLoaded(true);
  }, [applySelection]);

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  function changeSelection(caseId: string, medId: string) {
    if (dirtyRef.current && !window.confirm("Discard unsaved administration instructions and switch selection?")) return;
    applySelection(caseId, medId, instructions);
  }

  function updateForm(patch: Partial<FormValues>) {
    setForm(current => ({ ...current, ...patch }));
    setSaveError(null);
    setSuccess("");
  }

  function setRoute(value: FormValues["route"]) {
    if (value === "iv") updateForm({
      route: value, mealTiming: "", ivMethod: "", diluentType: "",
      diluentVolumeMl: "", infusionDurationMinutes: "",
    });
    else if (value === "oral") updateForm({
      route: value, ivMethod: "", diluentType: "", diluentVolumeMl: "",
      infusionDurationMinutes: "", mealTiming: "",
    });
    else updateForm({ ...emptyForm });
  }

  function setMethod(value: FormValues["ivMethod"]) {
    if (value === "infusion") updateForm({ ivMethod: value });
    else updateForm({ ivMethod: value, diluentType: "", diluentVolumeMl: "", infusionDurationMinutes: "" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    setSaveError(null);
    setSuccess("");
    try {
      if (!selectedCase || !selectedMedication) throw new Error("Choose a saved case and medication first.");
      const freshCases = readCases();
      if (!freshCases.ok) throw new Error(freshCases.error);
      setCases(freshCases.value);
      const draft: InstructionDraft = {
        caseId: selectedCaseId,
        medicationId,
        route: form.route || null,
        ivMethod: form.route === "iv" ? (form.ivMethod || null) : null,
        diluentType: form.route === "iv" && form.ivMethod === "infusion" ? form.diluentType.trim() || null : null,
        diluentVolumeMl: form.route === "iv" && form.ivMethod === "infusion"
          ? amountValue(form.diluentVolumeMl, "Diluent volume") : null,
        infusionDurationMinutes: form.route === "iv" && form.ivMethod === "infusion"
          ? amountValue(form.infusionDurationMinutes, "Infusion duration") : null,
        mealTiming: form.route === "oral" ? (form.mealTiming || null) : null,
      };
      const result = saveInstructions(draft, freshCases.value);
      if (!result.ok) throw new Error(result.error);
      setInstructions(result.value);
      setBaseline(JSON.stringify(form));
      setSuccess("Administration instructions saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Instructions could not be saved. Your draft has been retained.");
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  function handleRemove() {
    if (!selectedCaseId || !medicationId || !selectedInstruction) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    const result = removeInstructions(selectedCaseId, medicationId);
    if (!result.ok) {
      setSaveError(result.error);
      setConfirmRemove(false);
      return;
    }
    setInstructions(result.value);
    applySelection(selectedCaseId, medicationId, result.value);
    setSuccess("Saved instructions removed.");
  }

  const dirty = JSON.stringify(form) !== baseline;

  return (
    <Shell>
      <div className={styles.page}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Training record · pharmacist documented</p>
          <h1>Administration instructions</h1>
          <p>Document how a medication is to be administered. These are explicit instructions, not a record of a dose given or missed.</p>
          <p className={styles.trainingNote}>Fictional training only — not for real patient care. Patient identity is unspecified.</p>
        </header>

        {!loaded && <section className={styles.loading} role="status" aria-live="polite"><span className={styles.skeletonLine} /><span className={styles.skeletonLine} /><span className={styles.skeletonBlock} />Loading saved cases and instructions…</section>}
        {loaded && casesError && <section className={styles.errorBox} role="alert"><h2>Saved cases could not be loaded</h2><p>{casesError}</p><button type="button" onClick={refresh}>Retry loading</button></section>}
        {loaded && instructionsError && <section className={styles.errorBox} role="alert"><h2>Instructions could not be loaded</h2><p>{instructionsError}</p><button type="button" onClick={refresh}>Retry loading</button></section>}
        {loaded && !casesError && cases.length === 0 && (
          <section className={styles.emptyState}>
            <span className={styles.emptyMark} aria-hidden="true">—</span>
            <h2>No reviewed cases yet</h2>
            <p>Instructions are attached to a saved reviewed case. Start with a fictional training sheet or open your records.</p>
            <div className={styles.actions}><Link href="/records" className={styles.secondaryAction}>View records</Link><Link href="/scan" className={styles.primaryAction}>Scan a training sheet</Link></div>
          </section>
        )}
        {loaded && !casesError && !instructionsError && cases.length > 0 && <>
          <section className={styles.formSection}>
            <div className={styles.sectionHeading}><span className={styles.step}>01</span><div><h2>Choose the reviewed order</h2><p>Choose each route explicitly. Prescription route is shown only as a reference.</p></div></div>
            <div className={styles.selectionGrid}>
              <label htmlFor="instruction-case">Saved reviewed case
                <select id="instruction-case" value={selectedCaseId} onChange={event => changeSelection(event.target.value, "")}>
                  <option value="">Choose a saved case</option>
                  {cases.map(item => <option key={item.id} value={item.id}>{caseLabel(item)}</option>)}
                </select>
              </label>
              <label htmlFor="instruction-medication">Medication from prescription
                <select id="instruction-medication" value={medicationId} onChange={event => changeSelection(selectedCaseId, event.target.value)} disabled={!selectedCase}>
                  <option value="">Choose a medication</option>
                  {medications.map(med => <option key={med.id} value={med.id}>{display(med.name)}{med.orderStatus === "stopped" ? " · stopped" : ""}</option>)}
                </select>
              </label>
            </div>
            {selectedMedication && <div className={styles.reference} aria-live="polite">
              <p className={styles.referenceLabel}>Prescription reference only — route is not copied into these instructions</p>
              <strong dir="auto">{display(selectedMedication.name)}</strong>
              <p>Dose: <bdi dir="auto">{display(selectedMedication.dose)} {selectedMedication.unit ? `· ${selectedMedication.unit}` : ""}</bdi>
                <span className={styles.separator}> · </span>Prescription route: <bdi dir="auto">{display(selectedMedication.route)}</bdi>
                <span className={styles.separator}> · </span>Frequency: <bdi dir="auto">{display(selectedMedication.frequency)}</bdi></p>
            </div>}
          </section>

          <section className={styles.formSection}>
            <div className={styles.sectionHeading}><span className={styles.step}>02</span><div><h2>Document administration method</h2><p>Leave unknown details blank. No route, diluent, volume or duration is assumed.</p></div></div>
            {!selectedMedication ? <p className={styles.historyPrompt}>Select a case and medication to view or document instructions.</p> : <>
              <form onSubmit={handleSubmit}>
                <div className={styles.fields}>
                  <label htmlFor="instruction-route">Administration route
                    <select id="instruction-route" value={form.route} onChange={event => setRoute(event.target.value as FormValues["route"])}>
                      <option value="">Unspecified</option><option value="iv">IV</option><option value="oral">Oral</option>
                    </select>
                  </label>
                  {form.route === "iv" && <fieldset className={styles.methodFieldset}>
                    <legend>IV method</legend>
                    <label className={`${styles.outcomeOption} ${form.ivMethod === "bolus" ? styles.outcomeSelected : ""}`}>
                      <input type="radio" name="iv-method" checked={form.ivMethod === "bolus"} onChange={() => setMethod("bolus")} />
                      <span><strong>Bolus</strong><small>IV method documented as bolus.</small></span>
                    </label>
                    <label className={`${styles.outcomeOption} ${form.ivMethod === "infusion" ? styles.outcomeSelected : ""}`}>
                      <input type="radio" name="iv-method" checked={form.ivMethod === "infusion"} onChange={() => setMethod("infusion")} />
                      <span><strong>Infusion</strong><small>Enter only the known infusion details below.</small></span>
                    </label>
                    <label className={`${styles.outcomeOption} ${!form.ivMethod ? styles.outcomeSelected : ""}`}>
                      <input type="radio" name="iv-method" checked={!form.ivMethod} onChange={() => setMethod("")} />
                      <span><strong>Unspecified</strong><small>IV method is not documented.</small></span>
                    </label>
                  </fieldset>}
                  {form.route === "iv" && form.ivMethod === "infusion" && <div className={styles.fields}>
                    <label htmlFor="instruction-diluent">Diluent type <span className={styles.optional}>Optional</span>
                      <input id="instruction-diluent" value={form.diluentType} onChange={event => updateForm({ diluentType: event.target.value })} maxLength={1000} autoComplete="off" dir="auto" />
                    </label>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="instruction-volume">Diluent volume <span className={styles.optional}>Optional · mL</span>
                        <div className={styles.unitInput}><input id="instruction-volume" inputMode="decimal" type="text" value={form.diluentVolumeMl} onChange={event => updateForm({ diluentVolumeMl: event.target.value })} aria-describedby="volume-unit" /><span id="volume-unit">mL</span></div>
                      </label>
                      <label htmlFor="instruction-duration">Infusion duration <span className={styles.optional}>Optional · minutes</span>
                        <div className={styles.unitInput}><input id="instruction-duration" inputMode="decimal" type="text" value={form.infusionDurationMinutes} onChange={event => updateForm({ infusionDurationMinutes: event.target.value })} aria-describedby="duration-unit" /><span id="duration-unit">min</span></div>
                      </label>
                    </div>
                  </div>}
                  {form.route === "oral" && <label htmlFor="instruction-meal-timing">Meal timing
                    <select id="instruction-meal-timing" value={form.mealTiming} onChange={event => updateForm({ mealTiming: event.target.value as FormValues["mealTiming"] })}>
                      <option value="">Unspecified</option><option value="before_meals">Before meals</option><option value="after_meals">After meals</option>
                    </select>
                  </label>}
                </div>
                {saveError && <div className={styles.errorBox} role="alert"><strong>Not saved</strong><p>{saveError}</p><p>Your draft is still here. Correct any issue or retry.</p></div>}
                {success && <div className={styles.successBox} role="status" aria-live="polite">{success}</div>}
                {dirty && <p className={styles.dirtyNote} role="status">Unsaved changes</p>}
                <div className={styles.submitRow}>
                  <p>Document only known details. Patient is unspecified; do not enter names or real identifiers.</p>
                  <div className={styles.actionGroup}>
                    {selectedInstruction && !confirmRemove && <button className={styles.dangerAction} type="button" onClick={() => setConfirmRemove(true)}>Remove saved instructions</button>}
                    {selectedInstruction && confirmRemove && <div className={styles.confirmRemove} role="group" aria-label="Confirm removal"><span>Remove these saved instructions?</span><button type="button" className={styles.dangerAction} onClick={handleRemove}>Confirm remove</button><button type="button" className={styles.secondaryButton} onClick={() => setConfirmRemove(false)}>Keep</button></div>}
                    <button className={styles.primaryAction} type="submit" disabled={saving || !selectedCase || !selectedMedication}>{saving ? "Saving…" : selectedInstruction ? "Save changes" : "Save instructions"}</button>
                  </div>
                </div>
              </form>
            </>}
          </section>

          <section className={styles.historySection}>
            <div className={styles.historyHeader}><div><p className={styles.eyebrow}>Saved locally in this browser</p><h2>Instructions for this case</h2></div>
              {selectedCase && <span className={styles.count}>{selectedSummary.length} {selectedSummary.length === 1 ? "medication" : "medications"}</span>}
            </div>
            {!selectedCase && <p className={styles.historyPrompt}>Choose a saved reviewed case to see its medication instructions.</p>}
            {selectedCase && <div className={styles.historyList}>
              {selectedSummary.map(({ medication, instruction }) => <article className={styles.historyItem} key={medication.id}>
                <h3 dir="auto">{display(medication.name)}</h3><p className={styles.instructionSummary}>{routeSummary(instruction)}</p>
                {instruction?.route === "iv" && instruction.ivMethod === "infusion" && <dl className={styles.details}>
                  <div><dt>Diluent type</dt><dd dir="auto">{display(instruction.diluentType)}</dd></div>
                  <div><dt>Diluent volume</dt><dd>{instruction.diluentVolumeMl === null ? "Unspecified" : `${instruction.diluentVolumeMl} mL`}</dd></div>
                  <div><dt>Infusion duration</dt><dd>{instruction.infusionDurationMinutes === null ? "Unspecified" : `${instruction.infusionDurationMinutes} min`}</dd></div>
                </dl>}
                <p className={styles.prescriptionRef}>Prescription route reference: <bdi dir="auto">{display(medication.route)}</bdi></p>
                <button type="button" className={styles.textAction} onClick={() => changeSelection(selectedCase.id, medication.id)}>{instruction ? "Edit instructions" : "Document instructions"}</button>
              </article>)}
            </div>}
          </section>
        </>}
      </div>
    </Shell>
  );
}
