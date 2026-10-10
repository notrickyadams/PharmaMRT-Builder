"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import Verification from "@/components/Verification";
import Problems from "@/components/Problems";
import { apiPrescription, display, emptyReview, normalizeScan, nullable, parseProblems, validProblem, validReview, type Review } from "@/components/review-model";
import { prepareImage } from "@/components/image";
import { saveCase } from "@/lib/storage";
import type { Problem } from "@/lib/types";
import styles from "@/components/workflow.module.css";

export default function ScanPage() {
  const [review, setReview] = useState<Review | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"scan" | "analyze" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [reviewStarted, setReviewStarted] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveId, setSaveId] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const saving = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);

  function changed(next: Review) {
    setReview(next); setChecked(false); setReady(false);
  }
  function manual() {
    controller.current?.abort(); controller.current = null; lock.current = false;
    setBusy(null); setError(null);
    if (!review) setReview(emptyReview()); // Never discard already-entered work.
    if (review) { setReady(checked); if (checked) setReviewStarted(true); }
    else { setReady(false); setChecked(false); }
  }
  async function scan() {
    if (!file || lock.current || review) return;
    lock.current = true; setBusy("scan"); setError(null);
    const request = new AbortController(); controller.current = request;
    const timer = setTimeout(() => request.abort(), 22000);
    try {
      const image = await prepareImage(file);
      if (request.signal.aborted) throw new Error();
      const response = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(image), signal: request.signal });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (!["demo", "ai"].includes(payload.source) || !payload.prescription) throw new Error();
      const next = normalizeScan(payload.prescription, payload.source);
      if (new Set(next.medications.map(m => m.id)).size !== next.medications.length) throw new Error();
      if (controller.current !== request) return;
      setReview(next); setAiNotice(payload.source === "demo"); setChecked(false);
    } catch {
      if (controller.current === request) setError("We couldn’t read this sheet. Try a clearer image, or enter it manually.");
    } finally {
      clearTimeout(timer);
      if (controller.current === request) { lock.current = false; setBusy(null); }
    }
  }
  function verify(value: boolean) {
    if (review && value) {
      setReview({ ...review,
        medications: review.medications.map(m => ({ ...m, sourceText: m.sourceText ?? (
          (["name", "dose", "unit", "frequency", "route", "duration"] as const)
            .filter(key => m[key]).map(key => `${key}: ${m[key]}`).join("; ") || null) })),
        labs: review.labs.map(l => ({ ...l, sourceText: l.sourceText ?? (
          (["name", "date", "value", "unit"] as const).filter(key => l[key]).map(key => `${key}: ${l[key]}`).join("; ") || null) })),
      });
    }
    setChecked(value); if (!value) setReady(false);
  }
  async function analyze() {
    if (!review || !checked || lock.current) return;
    lock.current = true; setBusy("analyze"); setError(null);
    const request = new AbortController(); controller.current = request;
    const timer = setTimeout(() => request.abort(), 22000);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescription: apiPrescription(review) }), signal: request.signal });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (!["demo", "ai"].includes(payload.source) || payload.prescriptionId !== review.id) throw new Error();
      const suggestions = parseProblems(payload.problems, review);
      if (controller.current !== request) return;
      setProblems(suggestions.map(p => ({ ...p, reviewStatus: "suggested", finalIntervention: null, acceptance: null })));
      setAiNotice(payload.source === "demo"); setReady(true); setReviewStarted(true);
    } catch {
      if (controller.current === request) setError("We couldn’t produce compatible suggestions for these medications. Your verified work is retained. Continue with pharmacist review instead.");
    } finally {
      clearTimeout(timer);
      if (controller.current === request) { lock.current = false; setBusy(null); }
    }
  }
  const canSave = !!review && validReview(review) && checked && ready && !busy && !draftOpen &&
    problems.every(p => p.reviewStatus !== "suggested" && (p.reviewStatus === "rejected" || validProblem(p, review)));
  function save() {
    if (!review || !canSave || saving.current || saved) return;
    saving.current = true;
    const id = saveId ?? crypto.randomUUID(); setSaveId(id);
    const result = saveCase({ id, savedAt: new Date().toISOString(), status: "reviewed", review,
      problems: problems.filter(p => ["accepted", "edited", "added"].includes(p.reviewStatus)) });
    if (result.ok) { setSaved(true); setError(null); }
    else { setError(result.error); saving.current = false; }
  }
  return <Shell><p className={styles.eyebrow}>Treatment review</p><h1>Scan. Verify. Decide.</h1>
    {saved ? <section className={styles.success}><h2>Case saved</h2><p>Your pharmacist decisions and verified sheet are saved on this browser.</p>
      <div className={styles.row}><a className={styles.primary} href="/scan">Scan next sheet</a><Link href="/records">View records</Link></div></section> : <>
      {!review && <section><h2>Scan a treatment sheet</h2><label>Sheet image<input type="file" accept="image/*" capture="environment" disabled={!!busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null); }} /></label>
        <div className={styles.row}><button className={styles.primary} type="button" disabled={!file || !!busy} onClick={scan}>Read sheet</button><button type="button" onClick={manual}>Enter manually</button></div>
        <p className={styles.muted}>Use fictional sheets only. Do not upload patient names or real identifiers.</p></section>}
      {busy && <p role="status">{busy === "scan" ? "Reading the sheet…" : "Preparing suggestions…"}</p>}
      {error && <section role="alert"><p>{error}</p><button type="button" onClick={manual}>Enter manually</button></section>}
      {review && <>
        <section><h2>Patient: unspecified</h2><p>File number: {display(review.fileNumber)} {review.fileNumber && "(fictional)"}</p>
          <label>Ward<input dir="auto" disabled={!!busy} placeholder="unspecified" value={review.ward ?? ""} onChange={e => changed({ ...review, ward: nullable(e.target.value) })} /></label>
          {aiNotice && <p className={styles.warning}>Fictional example, not extracted from your image. Suggestions use a fixed example, not your corrections. Check every suggestion against the verified sheet.</p>}
        </section>
        <Verification review={review} onChange={changed} disabled={!!busy} />
        <section><label><input type="checkbox" checked={checked} disabled={!!busy || !validReview(review)} onChange={e => verify(e.target.checked)} /> I have checked the medications and labs</label>
          {!validReview(review) && <p role="status">Complete or remove empty medication and lab entries before verification (maximum 100 medications and 200 labs).</p>}
          {!checked && <p className={styles.muted}>Any change requires verification again.</p>}
          <div className={styles.row}><button className={styles.primary} type="button" disabled={!checked || !!busy || reviewStarted} onClick={analyze}>Confirm and analyze</button>
            <button type="button" disabled={!checked || !!busy} onClick={() => { setReady(true); setReviewStarted(true); setError(null); }}>Continue pharmacist review</button></div>
          {problems.length > 0 && !ready && <p>Previous decisions are retained. Recheck the changed sheet, then continue pharmacist review.</p>}
        </section>
        {reviewStarted && <><fieldset disabled={!ready || !checked || !!busy} style={{ border: 0, padding: 0, minWidth: 0 }}><Problems problems={problems} review={review} onChange={setProblems} onDraftChange={setDraftOpen} /></fieldset>
          <section><p>{problems.filter(p => p.reviewStatus === "suggested").length} suggestions still need a decision.</p>
            <button className={styles.primary} type="button" disabled={!canSave} onClick={save}>Save case</button></section></>}
      </>}
    </>}
  </Shell>;
}
