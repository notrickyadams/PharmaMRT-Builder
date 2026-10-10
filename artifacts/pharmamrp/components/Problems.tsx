"use client";
import { useEffect, useState } from "react";
import type { Problem } from "@/lib/types";
import { ACCEPTANCE_CODES, CAUSE_CODES, INTERVENTION_CODES, PROBLEM_CODES } from "@/lib/classification";
import { codeLabel, display, nullable, validProblem, type Review } from "./review-model";
import styles from "./workflow.module.css";

export function ProblemRead({ problem: p, review }: { problem: Problem; review: Review }) {
  return <>
    <p><strong>{display(p.severity)} severity</strong> · {p.reviewStatus}</p>
    <h3>{p.medicationIds.map(id => {
      const m = review.medications.find(m => m.id === id);
      return `${display(m?.name)}${m?.orderStatus === "stopped" ? " (stopped)" : ""}`;
    }).join(" + ")}</h3>
    <p dir="auto">{display(p.explanation)}</p>
    <p>{p.problemCode ?? "unspecified"} · {codeLabel(PROBLEM_CODES, p.problemCode)}<br />
      {p.causeCode ?? "unspecified"} · {codeLabel(CAUSE_CODES, p.causeCode)}</p>
    <p>Suggested intervention: {codeLabel(INTERVENTION_CODES, p.suggestedIntervention)}<br />
      Final intervention: {codeLabel(INTERVENTION_CODES, p.finalIntervention)}<br />
      Intervention outcome: {codeLabel(ACCEPTANCE_CODES, p.acceptance)}</p>
    {p.highlights.length > 0 ? <><small>Exact source quotations</small>{p.highlights.map((quote, i) => <blockquote dir="auto" key={i}>{quote}</blockquote>)}</> : <p>No source quotation supplied.</p>}
    {p.notes && <p dir="auto">Notes: {p.notes}</p>}
  </>;
}
export default function Problems({ problems, review, onChange, onDraftChange }: { problems: Problem[]; review: Review; onChange: (problems: Problem[]) => void; onDraftChange: (open: boolean) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Problem | null>(null);
  useEffect(() => { onDraftChange(!!draft); }, [draft, onDraftChange]);
  function update(p: Problem) { onChange(problems.map(x => x.id === p.id ? p : x)); }
  function edit(p: Problem) { setEditing(p.id); setDraft({ ...p, medicationIds: [...p.medicationIds] }); }
  return <section><h2>Pharmacist decisions</h2>
    <p>Decide every suggestion. Accepting a problem does not mean the prescriber accepted an intervention.</p>
    {!problems.length && <p>No suggested problems. You can save a zero-problem reviewed case or add a problem yourself.</p>}
    {problems.map(p => <article className={`${styles.card} ${styles[p.severity ?? "low"]}`} key={p.id}>
      {p.reviewStatus !== "added" && <strong>AI suggestion — needs pharmacist review</strong>}
      {p.reviewStatus === "added" && <strong>Pharmacist-authored problem</strong>}
      <ProblemRead problem={p} review={review} />
      <div className={styles.row}>
        {p.reviewStatus !== "added" && <button type="button" disabled={!!draft} onClick={() => {
          const accepted = { ...p, reviewStatus: "accepted" as const, finalIntervention: p.finalIntervention ?? p.suggestedIntervention };
          if (!validProblem(accepted, review)) edit(p); else update(accepted);
        }}>Accept</button>}
        <button type="button" disabled={!!draft} onClick={() => edit(p)}>Edit</button>
        <button type="button" disabled={!!draft} className={styles.danger} onClick={() => {
          if (editing === p.id) { setEditing(null); setDraft(null); }
          if (p.reviewStatus === "added") onChange(problems.filter(x => x.id !== p.id));
          else update({ ...p, reviewStatus: "rejected" });
        }}>{p.reviewStatus === "added" ? "Remove added problem" : "Reject"}</button>
      </div>
    </article>)}
    {draft && <div className={styles.card}><h3>{editing ? "Edit problem" : "Add problem"}</h3>
      <fieldset><legend>Involved medications (required)</legend>{review.medications.map(m => <label key={m.id}>
        <input type="checkbox" checked={draft.medicationIds.includes(m.id)} onChange={e => setDraft({ ...draft, medicationIds: e.target.checked ? [...draft.medicationIds, m.id] : draft.medicationIds.filter(id => id !== m.id) })} />
        <bdi>{display(m.name)}</bdi> · {display(m.dose)} {display(m.unit)} · {display(m.orderStatus)}
      </label>)}</fieldset>
      <label>Explanation (required)<textarea dir="auto" value={draft.explanation ?? ""} onChange={e => setDraft({ ...draft, explanation: nullable(e.target.value) })} /></label>
      <div className={styles.grid}>{([
        ["problemCode", "PCNE problem", PROBLEM_CODES], ["causeCode", "PCNE cause", CAUSE_CODES],
        ["finalIntervention", "Final intervention", INTERVENTION_CODES], ["acceptance", "Intervention outcome (optional)", ACCEPTANCE_CODES],
      ] as const).map(([field, title, options]) => <label key={field}>{title}<select value={draft[field] ?? ""} onChange={e => setDraft({ ...draft, [field]: e.target.value || null })}>
        <option value="">unspecified</option>{options.map(o => <option key={o.code} value={o.code}>{o.code} — {o.label}</option>)}
      </select></label>)}
        <label>Severity<select value={draft.severity ?? ""} onChange={e => setDraft({ ...draft, severity: (e.target.value || null) as Problem["severity"] })}><option value="">unspecified</option>{["low", "moderate", "high"].map(v => <option key={v}>{v}</option>)}</select></label>
      </div>
      <label>Notes<textarea dir="auto" value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: nullable(e.target.value) })} /></label>
      <p className={styles.muted}>Select medication, explanation, PCNE problem/cause, severity and final intervention. Original quotations are retained.</p>
      <div className={styles.row}><button type="button" disabled={!validProblem(draft, review)} onClick={() => {
        const finished = { ...draft, reviewStatus: (draft.reviewStatus === "added" ? "added" : "edited") as Problem["reviewStatus"] };
        if (editing) update(finished); else onChange([...problems, finished]);
        setDraft(null); setEditing(null);
      }}>Apply problem</button><button type="button" onClick={() => { setDraft(null); setEditing(null); }}>Cancel</button></div>
    </div>}
    <button type="button" disabled={!!draft || !review.medications.length} onClick={() => {
      setEditing(null); setDraft({ id: crypto.randomUUID(), medicationIds: [], problemCode: null, causeCode: null, explanation: null, severity: null,
        suggestedIntervention: null, finalIntervention: null, acceptance: null, reviewStatus: "added", highlights: [], notes: null });
    }}>Add a problem the AI missed</button>
    {draft && <p role="status">Finish or cancel this problem before saving the case.</p>}
  </section>;
}
