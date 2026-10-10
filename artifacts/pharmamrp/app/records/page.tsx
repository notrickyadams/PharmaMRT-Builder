"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { readCases, type SavedCase } from "@/lib/storage";
import { display } from "@/components/review-model";
import styles from "@/components/workflow.module.css";

export default function RecordsPage() {
  const [cases, setCases] = useState<SavedCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  function load() {
    const result = readCases();
    if (result.ok) { setCases(result.value); setError(null); }
    else { setError(result.error); setCases(null); }
  }
  useEffect(() => {
    load();
    window.addEventListener("storage", load);
    window.addEventListener("focus", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("focus", load); };
  }, []);
  return <Shell><p className={styles.eyebrow}>Your reviewed sheets</p><h1>Records</h1>
    <p className={styles.muted}>Saved on this browser only. Newest first. No patient names or real file identifiers.</p>
    <Link className={styles.primary} href="/scan">Scan a treatment sheet</Link>
    {error && <section role="alert"><p>{error}</p><button type="button" onClick={load}>Retry records</button><p>You can replace damaged records with fictional examples using Reset demo on Home.</p></section>}
    {!cases && !error && <p role="status">Loading records…</p>}
    {cases?.length === 0 && <section><h2>No saved cases yet</h2><p>Complete a pharmacist review, or reset the fictional examples on Home.</p></section>}
    {cases?.map(c => <section key={c.id}><Link href={`/records/${encodeURIComponent(c.id)}`}>
      <p className={styles.eyebrow}>{c.review.fictional ? "Fictional reviewed case" : "Pharmacist-reviewed case"}</p>
      <h2>{display(c.review.fileNumber)}</h2>
      <p dir="auto">{display(c.review.ward)}</p><p>{new Date(c.savedAt).toLocaleString()} · {c.problems.length} {c.problems.length === 1 ? "problem" : "problems"}</p>
      <span>View case →</span>
    </Link></section>)}
  </Shell>;
}
