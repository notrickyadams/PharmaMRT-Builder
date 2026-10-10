"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { readCases, type SavedCase } from "@/lib/storage";
import { display } from "@/components/review-model";
import { ProblemRead } from "@/components/Problems";
import AdministrationInstructionSummary from "@/components/AdministrationInstructionSummary";
import styles from "@/components/workflow.module.css";

export default function RecordDetailPage() {
  const params = useParams<{ id: string }>();
  const [record, setRecord] = useState<SavedCase | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    function load() {
      const result = readCases();
      setRecord(result.ok ? result.value.find(c => c.id === params.id) ?? null : null);
      setError(result.ok ? null : result.error); setLoaded(true);
    }
    load(); window.addEventListener("storage", load); window.addEventListener("focus", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("focus", load); };
  }, [params.id]);
  return <Shell><Link href="/records">← Records</Link><h1>Reviewed case</h1>
    {!loaded && <p role="status">Loading case…</p>}
    {error && <section role="alert">{error}</section>}
    {loaded && !error && !record && <section><h2>Case not found</h2><p>This case may have been replaced, or saved in another browser.</p></section>}
    {record && <>
      <section><p className={styles.eyebrow}>{record.review.fictional ? "Fictional training case" : "Pharmacist reviewed"}</p>
        <h2>Patient: unspecified</h2><p>File number: {display(record.review.fileNumber)}</p><p dir="auto">Ward: {display(record.review.ward)}</p>
        <p>Saved: {new Date(record.savedAt).toLocaleString()} · {record.problems.length} problems</p></section>
      <section><h2>Verified medications</h2><div className={styles.tableWrap}><table><thead><tr><th>Medication / generic</th><th>Dose / unit</th><th>Frequency</th><th>Route</th><th>Status</th></tr></thead>
        <tbody>{record.review.medications.map(m => <tr key={m.id} className={m.confidence === "low" ? styles.warning : undefined}>
          <td><span dir="auto" className={m.orderStatus === "stopped" ? styles.stopped : undefined}>{display(m.name)}</span><br /><small dir="auto">{display(m.genericName)}</small>{m.confidence === "low" && <span> · Check this</span>}</td>
          <td>{display(m.dose)} / {display(m.unit)}</td><td dir="auto">{display(m.frequency)}</td><td dir="auto">{display(m.route)}</td><td>{display(m.orderStatus)}</td>
        </tr>)}</tbody></table></div>
        <details><summary>Medication duration and original source text</summary>{record.review.medications.map(m => <div key={m.id}>
          <p><bdi>{display(m.name)}</bdi> · Verified duration: <bdi>{display(m.duration)}</bdi> · Extraction confidence: {display(m.confidence)}</p>
          <blockquote dir="auto">{display(m.sourceText)}</blockquote>
        </div>)}</details>
      </section>
      <section><h2>Administration instructions</h2><p>Document how each medication is to be administered: IV bolus or infusion details, or oral meal timing. These are verified instructions, not given/missed-dose records. Prescription route remains a reference only.</p>
        <AdministrationInstructionSummary record={record} />
        <Link className={styles.secondary} href={`/administration?case=${encodeURIComponent(record.id)}`}>Open instructions for this case</Link>
      </section>
      <section><h2>Verified labs</h2><p>Orders are not results.</p>{[...new Set(record.review.labs.map(l => l.date))].map(date => <div key={date ?? "undated"}>
        <h3>{date ?? "Undated"}</h3><div className={styles.row}>{record.review.labs.filter(l => l.date === date).map(l => <span className={styles.chip} key={l.id} dir="auto">
          {display(l.name)} · {l.kind === "order" ? "order" : `${display(l.value)} ${display(l.unit)}`}
        </span>)}</div></div>)}
        {!record.review.labs.length && <p>Labs unspecified.</p>}
        <details><summary>Original lab source text</summary>{record.review.labs.map(l => <blockquote dir="auto" key={l.id}>{display(l.sourceText)}</blockquote>)}</details>
      </section>
      <section><h2>Saved pharmacist decisions</h2>{!record.problems.length && <p>Reviewed with zero problems saved. Rejected suggestions are not retained.</p>}
        {record.problems.map(p => <article className={`${styles.card} ${styles[p.severity ?? "low"]}`} key={p.id}><ProblemRead problem={p} review={record.review} /></article>)}
      </section>
    </>}
  </Shell>;
}
