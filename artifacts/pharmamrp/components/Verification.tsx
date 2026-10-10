"use client";
import { useState } from "react";
import { blankMedication, display, nullable, type Lab, type Review, type ReviewMedication } from "./review-model";
import styles from "./workflow.module.css";

const fields = ["name", "genericName", "dose", "unit", "frequency", "route", "duration"] as const;
export default function Verification({ review, onChange, disabled = false }: {
  review: Review; onChange: (review: Review) => void; disabled?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  function medChange(med: ReviewMedication) {
    onChange({ ...review, medications: review.medications.map(m => m.id === med.id ? med : m) });
  }
  function labChange(lab: Lab) {
    onChange({ ...review, labs: review.labs.map(l => l.id === lab.id ? lab : l) });
  }
  const dates = [...new Set(review.labs.map(l => l.date))];
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
    <section>
      <h2>Verify medications</h2>
      <p className={styles.muted}>Check each field against the sheet. Missing information stays unspecified. Original source text is retained.</p>
      <div className={styles.tableWrap}><table>
        <caption className={styles.muted}>Tap Edit to check or correct an order</caption>
        <thead><tr><th>Medication / generic</th><th>Dose / unit</th><th>Frequency</th><th>Route</th><th>Order status</th><th>Review</th></tr></thead>
        <tbody>{review.medications.map(m => <tr key={m.id} className={m.confidence === "low" ? styles.warning : undefined}>
          <td><span dir="auto" className={m.orderStatus === "stopped" ? styles.stopped : undefined}>{display(m.name)}</span><br /><small dir="auto">{display(m.genericName)}</small>{m.confidence === "low" && <strong style={{ display: "block" }}>Check this</strong>}</td>
          <td>{display(m.dose)} / {display(m.unit)}</td><td dir="auto">{display(m.frequency)}</td>
          <td dir="auto">{display(m.route)}</td><td>{display(m.orderStatus)}</td>
          <td><button type="button" aria-label={`Edit ${display(m.name)}`} onClick={() => setEditing(editing === m.id ? null : m.id)}>Edit</button></td>
        </tr>)}</tbody>
      </table></div>
      {!review.medications.length && <p>No medications yet. Add only information supplied by the pharmacist.</p>}
      {review.medications.filter(m => m.id === editing).map(m => <div className={styles.card} key={m.id}>
        <h3>Edit medication</h3>
        <div className={styles.grid}>{fields.map(field => <label key={field}>{field === "genericName" ? "Generic name" : field}
          <input dir="auto" value={m[field] ?? ""} placeholder="unspecified" onChange={e => medChange({ ...m, [field]: nullable(e.target.value) })} />
        </label>)}
        <label>Order status<select value={m.orderStatus ?? ""} onChange={e => medChange({ ...m, orderStatus: (e.target.value || null) as ReviewMedication["orderStatus"] })}><option value="">unspecified</option>{["active", "stopped", "modified"].map(v => <option key={v}>{v}</option>)}</select></label></div>
        {m.sourceText !== null ? <><p>Original source text (unchanged)</p><blockquote dir="auto">{m.sourceText}</blockquote></> :
          <p className={styles.muted}>Manual entry: supplied fields will be transcribed transparently when verification is confirmed.</p>}
        <div className={styles.row}><button type="button" onClick={() => setEditing(null)}>Done editing</button>
          <button type="button" className={styles.danger} onClick={() => { onChange({ ...review, medications: review.medications.filter(x => x.id !== m.id) }); setEditing(null); }}>Remove medication</button></div>
      </div>)}
      <button type="button" disabled={review.medications.length >= 100} onClick={() => { const med = blankMedication(); onChange({ ...review, medications: [...review.medications, med] }); setEditing(med.id); }}>Add medication</button>
    </section>
    <section><h2>Verify labs</h2><p className={styles.muted}>Orders are requests, not results. No date or result is inferred.</p>
      {dates.map(date => <div key={date ?? "undated"}><h3>{date ?? "Undated"}</h3>
        <div className={styles.row}>{review.labs.filter(l => l.date === date).map(l => <button type="button" className={styles.chip} key={l.id} onClick={() => setEditing(editing === l.id ? null : l.id)}>
          <span dir="auto">{display(l.name)}</span> · {l.kind === "order" ? "order" : `${display(l.value)} ${display(l.unit)}`} · Edit
        </button>)}</div>
      </div>)}
      {!review.labs.length && <p>Labs unspecified.</p>}
      {review.labs.filter(l => l.id === editing).map(l => <div className={styles.card} key={l.id}><h3>Correct lab {l.kind}</h3>
        <div className={styles.grid}>{(["name", "date", ...(l.kind === "result" ? ["value", "unit"] : [])] as (keyof Pick<Lab, "name" | "date" | "value" | "unit">)[]).map(field =>
          <label key={field}>{field}<input dir="auto" placeholder="unspecified" value={l[field] ?? ""} onChange={e => labChange({ ...l, [field]: nullable(e.target.value) })} /></label>)}</div>
        <p>Original source text: <bdi>{display(l.sourceText)}</bdi></p>
        <button type="button" onClick={() => setEditing(null)}>Done editing lab</button>{" "}
        <button type="button" className={styles.danger} onClick={() => { onChange({ ...review, labs: review.labs.filter(x => x.id !== l.id) }); setEditing(null); }}>Remove lab</button>
      </div>)}
      <div className={styles.row}>{(["order", "result"] as const).map(kind => <button type="button" disabled={review.labs.length >= 200} key={kind} onClick={() => {
        const lab: Lab = { id: crypto.randomUUID(), kind, name: null, date: null, value: null, unit: null, sourceText: null };
        onChange({ ...review, labs: [...review.labs, lab] }); setEditing(lab.id);
      }}>Add lab {kind}</button>)}</div>
    </section>
  </fieldset>;
}
