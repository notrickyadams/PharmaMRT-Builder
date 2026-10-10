"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Shell from "@/components/Shell";
import { display } from "@/components/review-model";
import { readCases, type SavedCase } from "@/lib/storage";
import {
  readAdministrations,
  saveAdministration,
  type AdministrationEntry,
} from "@/lib/administration";
import styles from "./administration.module.css";

type RecordStatus = "given" | "missed";

function localDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function toIso(value: string): string | null {
  if (!value) return null;
  try {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
    if (!match) throw new Error("Invalid local date and time.");
    const [, year, month, day, hour, minute, second = "0"] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      0,
    );
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day) ||
      date.getHours() !== Number(hour) ||
      date.getMinutes() !== Number(minute) ||
      date.getSeconds() !== Number(second)
    ) throw new Error("Enter a valid local date and time.");
    return date.toISOString();
  } catch {
    throw new Error("Enter a valid local date and time before saving.");
  }
}

function RecordCard({ entry, medicationName }: { entry: AdministrationEntry; medicationName: string }) {
  return (
    <article className={styles.historyItem}>
      <div className={styles.historyTop}>
        <span className={entry.status === "given" ? styles.givenBadge : styles.missedBadge}>
          {entry.status === "given" ? "Given" : "Missed"}
        </span>
        <time dateTime={entry.recordedAt}>{localDateTime(entry.recordedAt)}</time>
      </div>
      <h3 dir="auto">{medicationName}</h3>
      <p className={styles.prescriptionRef}>
        Prescription reference: {entry.status === "given" ? "separate from actual administration" : "reviewed medication"}
      </p>
      {entry.status === "given" ? (
        <dl className={styles.details}>
          <div><dt>Actual dose</dt><dd dir="auto">{display(entry.dose)} {display(entry.unit)}</dd></div>
          <div><dt>Actual route</dt><dd dir="auto">{display(entry.route)}</dd></div>
          <div><dt>Actual administration time</dt><dd>{localDateTime(entry.administeredAt)}</dd></div>
          {entry.scheduledAt && <div><dt>Scheduled time</dt><dd>{localDateTime(entry.scheduledAt)}</dd></div>}
        </dl>
      ) : (
        <dl className={styles.details}>
          <div><dt>Reason not given</dt><dd dir="auto">{entry.reason}</dd></div>
          {entry.scheduledAt && <div><dt>Scheduled time</dt><dd>{localDateTime(entry.scheduledAt)}</dd></div>}
        </dl>
      )}
      {entry.notes && <p className={styles.note}><strong>Notes:</strong> <span dir="auto">{entry.notes}</span></p>}
    </article>
  );
}

export default function Administration() {
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [entries, setEntries] = useState<AdministrationEntry[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [medicationId, setMedicationId] = useState("");
  const [status, setStatus] = useState<RecordStatus>("given");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("");
  const [route, setRoute] = useState("");
  const [administeredAt, setAdministeredAt] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const queryApplied = useRef(false);

  const refresh = useCallback(() => {
    const caseResult = readCases();
    if (caseResult.ok) {
      setCases(caseResult.value);
      setCasesError(null);
      setSelectedCaseId(current => current && caseResult.value.some(item => item.id === current) ? current : "");
      setMedicationId(current => {
        const exists = caseResult.value.some(item =>
          item.id === selectedCaseId && item.review.medications.some(med => med.id === current));
        return exists ? current : "";
      });
      if (!queryApplied.current) {
        queryApplied.current = true;
        const requested = new URLSearchParams(window.location.search).get("case");
        if (requested && caseResult.value.some(item => item.id === requested)) setSelectedCaseId(requested);
      }
    } else {
      setCasesError(caseResult.error);
    }
    const historyResult = readAdministrations();
    if (historyResult.ok) {
      setEntries(historyResult.value);
      setHistoryError(null);
    } else {
      setHistoryError(historyResult.error);
    }
    setLoaded(true);
  }, [selectedCaseId]);

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const selectedCase = cases.find(item => item.id === selectedCaseId);
  const medications = selectedCase?.review.medications ?? [];
  const selectedMedication = medications.find(item => item.id === medicationId);
  const caseEntries = useMemo(
    () => entries.filter(entry => entry.caseId === selectedCaseId),
    [entries, selectedCaseId],
  );

  function clearDoseDetails() {
    setDose("");
    setUnit("");
    setRoute("");
    setAdministeredAt("");
    setScheduledAt("");
    setReason("");
    setNotes("");
  }

  function selectCase(value: string) {
    clearDoseDetails();
    setSelectedCaseId(value);
    setMedicationId("");
    setSuccess(false);
    setSaveError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setSaving(true);
    setSaveError(null);
    setSuccess(false);
    try {
      const freshCases = readCases();
      if (!freshCases.ok) {
        setSaveError(freshCases.error);
        return;
      }
      setCases(freshCases.value);
      const draft = {
        caseId: selectedCaseId,
        medicationId,
        status,
        scheduledAt: toIso(scheduledAt),
        administeredAt: status === "given" ? toIso(administeredAt) : null,
        dose: status === "given" ? dose.trim() : null,
        unit: status === "given" ? unit.trim() : null,
        route: status === "given" ? route.trim() : null,
        reason: status === "missed" ? reason.trim() : null,
        notes: notes.trim() || null,
      };
      const result = saveAdministration(draft, freshCases.value);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setEntries(result.value);
      setSuccess(true);
      setDose("");
      setUnit("");
      setRoute("");
      setAdministeredAt("");
      setScheduledAt("");
      setReason("");
      setNotes("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The record could not be saved. Your entered details have been retained.");
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  const selectedStopped = selectedMedication?.orderStatus === "stopped";

  return (
    <Shell>
      <div className={styles.page}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Training record · pharmacist documented</p>
          <h1>Medication administration</h1>
          <p>Record what was given, or document a missed dose. Every administration detail is entered explicitly.</p>
          <p className={styles.trainingNote}>Fictional training only — not for real patient care. Patient identity is unspecified.</p>
        </header>

        {!loaded && <section className={styles.loading} role="status" aria-live="polite"><span className={styles.skeletonLine} /><span className={styles.skeletonLine} /><span className={styles.skeletonBlock} />Loading saved cases and administration history…</section>}

        {loaded && casesError && (
          <section className={styles.errorBox} role="alert">
            <h2>Saved cases could not be loaded</h2><p>{casesError}</p>
            <button type="button" onClick={refresh}>Retry loading</button>
          </section>
        )}

        {loaded && !casesError && cases.length === 0 && (
          <section className={styles.emptyState}>
            <span className={styles.emptyMark} aria-hidden="true">—</span>
            <h2>No reviewed cases yet</h2>
            <p>Administration records are attached to a saved reviewed case. Start with a fictional training sheet or open your records.</p>
            <div className={styles.actions}>
              <Link href="/records" className={styles.secondaryAction}>View records</Link>
              <Link href="/scan" className={styles.primaryAction}>Scan a training sheet</Link>
            </div>
          </section>
        )}

        {loaded && !casesError && cases.length > 0 && (
          <>
            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <span className={styles.step}>01</span>
                <div><h2>Choose the reviewed order</h2><p>Prescription details are a reference only. Record actual administration separately.</p></div>
              </div>
              <div className={styles.selectionGrid}>
                <label>
                  Saved reviewed case
                  <select value={selectedCaseId} onChange={event => selectCase(event.target.value)} required>
                    <option value="">Choose a saved case</option>
                    {cases.map(item => (
                      <option key={item.id} value={item.id}>
                        {display(item.review.fileNumber)} · {display(item.review.ward)} · Reviewed {localDateTime(item.savedAt)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Medication from prescription
                  <select value={medicationId} onChange={event => { clearDoseDetails(); setMedicationId(event.target.value); setSuccess(false); setSaveError(null); }} required disabled={!selectedCase}>
                    <option value="">Choose a medication</option>
                    {medications.map(med => (
                      <option key={med.id} value={med.id}>
                        {display(med.name)}{med.orderStatus === "stopped" ? " · stopped" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedMedication && (
                <div className={styles.reference} aria-live="polite">
                  <p className={styles.referenceLabel}>Prescription reference — not an administration record</p>
                  <strong dir="auto">{display(selectedMedication.name)}</strong>
                  <p>Dose: <bdi>{display(selectedMedication.dose)} {selectedMedication.unit ? `· ${selectedMedication.unit}` : ""}</bdi>
                    <span className={styles.separator}> · </span>Route: <bdi dir="auto">{display(selectedMedication.route)}</bdi>
                    <span className={styles.separator}> · </span>Frequency: <bdi dir="auto">{display(selectedMedication.frequency)}</bdi>
                  </p>
                  {selectedStopped && <p className={styles.stoppedMessage}>This prescription is marked stopped. A dose cannot be recorded as given against it. A missed-dose record is still available.</p>}
                </div>
              )}
            </section>

            <section className={styles.formSection}>
              <div className={styles.sectionHeading}>
                <span className={styles.step}>02</span>
                <div><h2>Document the outcome</h2><p>Only enter what was actually observed or documented.</p></div>
              </div>
              <form onSubmit={handleSubmit}>
                <fieldset className={styles.outcomeFieldset}>
                  <legend>Administration outcome</legend>
                  <label className={`${styles.outcomeOption} ${status === "given" ? styles.outcomeSelected : ""}`}>
                    <input type="radio" name="outcome" value="given" checked={status === "given"} onChange={() => { setStatus("given"); setSuccess(false); setSaveError(null); }} />
                    <span><strong>Given</strong><small>Enter actual dose, unit, route and administration time.</small></span>
                  </label>
                  <label className={`${styles.outcomeOption} ${status === "missed" ? styles.outcomeSelected : ""}`}>
                    <input type="radio" name="outcome" value="missed" checked={status === "missed"} onChange={() => { setStatus("missed"); setSuccess(false); setSaveError(null); }} />
                    <span><strong>Missed</strong><small>Record why the dose was not given.</small></span>
                  </label>
                </fieldset>

                {status === "given" ? (
                  <div className={styles.fields}>
                    <div className={styles.fieldGroup}>
                      <label>Actual dose given<input value={dose} onChange={event => setDose(event.target.value)} required maxLength={1000} autoComplete="off" dir="auto" placeholder="Enter the dose actually given" /></label>
                      <label>Actual dose unit<input value={unit} onChange={event => setUnit(event.target.value)} required maxLength={1000} autoComplete="off" dir="auto" placeholder="Enter the unit actually used" /></label>
                    </div>
                    <label>Actual route<input value={route} onChange={event => setRoute(event.target.value)} required maxLength={1000} autoComplete="off" dir="auto" placeholder="Enter the route actually used" /></label>
                    <div className={styles.fieldGroup}>
                      <label>Actual administration date and time<input type="datetime-local" value={administeredAt} onChange={event => setAdministeredAt(event.target.value)} required /></label>
                      <label>Scheduled date and time <span className={styles.optional}>Optional</span><input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} /></label>
                    </div>
                  </div>
                ) : (
                  <div className={styles.fields}>
                    <label>Reason dose was not given<textarea value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} dir="auto" placeholder="Document the reason" /></label>
                    <label>Scheduled date and time <span className={styles.optional}>Optional</span><input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} /></label>
                  </div>
                )}
                <label className={styles.notesField}>Notes <span className={styles.optional}>Optional</span><textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} dir="auto" placeholder="Add relevant training notes, if needed" /></label>

                {saveError && <div className={styles.errorBox} role="alert"><strong>Not saved</strong><p>{saveError}</p><p>Your entered details are still here. Correct any issue or retry.</p></div>}
                {success && <div className={styles.successBox} role="status" aria-live="polite"><strong>Administration record saved.</strong> The latest history is shown below.</div>}
                <div className={styles.submitRow}>
                  <p>Patient is unspecified. Do not enter names or real identifiers.</p>
                  <button className={styles.primaryAction} type="submit" disabled={saving || !selectedCase || !selectedMedication || (status === "given" && selectedStopped)}>
                    {saving ? "Saving record…" : status === "given" ? "Save given dose" : "Save missed dose"}
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.historySection}>
              <div className={styles.historyHeader}>
                <div><p className={styles.eyebrow}>Saved locally in this browser</p><h2>Administration history</h2></div>
                {selectedCase && <span className={styles.count}>{caseEntries.length} {caseEntries.length === 1 ? "record" : "records"}</span>}
              </div>
              {historyError && <div className={styles.errorBox} role="alert"><p>{historyError}</p><button type="button" onClick={refresh}>Retry history</button></div>}
              {!historyError && !selectedCase && <p className={styles.historyPrompt}>Choose a saved reviewed case to view its history.</p>}
              {!historyError && selectedCase && caseEntries.length === 0 && (
                <div className={styles.historyEmpty}><span aria-hidden="true">01</span><p>No administration records for this case yet. A record appears here after it is saved.</p></div>
              )}
              {!historyError && selectedCase && caseEntries.length > 0 && (
                <div className={styles.historyList}>
                  {caseEntries.map(entry => {
                    const med = selectedCase.review.medications.find(item => item.id === entry.medicationId);
                    return <RecordCard key={entry.id} entry={entry} medicationName={display(med?.name)} />;
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}
