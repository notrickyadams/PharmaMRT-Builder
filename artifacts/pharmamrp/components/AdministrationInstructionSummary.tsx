"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { display } from "@/components/review-model";
import { readInstructions, type AdministrationInstruction } from "@/lib/administration-instructions";
import type { SavedCase } from "@/lib/storage";
import styles from "./administration-summary.module.css";

function summarize(entry?: AdministrationInstruction) {
  if (!entry) return "No instruction saved";
  if (!entry.route) return "Route unspecified";
  if (entry.route === "oral") {
    return entry.mealTiming === "before_meals" ? "Oral · Before meals" :
      entry.mealTiming === "after_meals" ? "Oral · After meals" : "Oral · Meal timing unspecified";
  }
  if (entry.ivMethod === "bolus") return "IV · Bolus";
  if (entry.ivMethod !== "infusion") return "IV · Method unspecified";
  const details = ["IV · Infusion"];
  if (entry.diluentType) details.push(`Diluent: ${entry.diluentType}`);
  if (entry.diluentVolumeMl !== null) details.push(`${entry.diluentVolumeMl} mL`);
  if (entry.infusionDurationMinutes !== null) details.push(`${entry.infusionDurationMinutes} min`);
  return details.join(" · ");
}

export default function AdministrationInstructionSummary({ record }: { record: SavedCase }) {
  const [instructions, setInstructions] = useState<AdministrationInstruction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(() => {
    const result = readInstructions();
    if (result.ok) {
      setInstructions(result.value);
      setError(null);
    } else setError(result.error);
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return <div className={styles.summary} aria-live="polite">
    {!loaded && <p role="status">Loading saved administration instructions…</p>}
    {error && <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={refresh}>Retry</button></div>}
    {loaded && !error && <div className={styles.list}>
      {record.review.medications.map(medication => {
        const entry = instructions.find(item => item.caseId === record.id && item.medicationId === medication.id);
        const href = `/administration?case=${encodeURIComponent(record.id)}&medication=${encodeURIComponent(medication.id)}`;
        return <article className={styles.item} key={medication.id}>
          <div className={styles.itemBody}>
            <h3 dir="auto">{display(medication.name)}</h3>
            <p className={styles.instruction}>{summarize(entry)}</p>
            {entry?.route === "iv" && entry.ivMethod === "infusion" && <p className={styles.facts}>
              Diluent: <bdi dir="auto">{display(entry.diluentType)}</bdi>
              <span> · Volume: {entry.diluentVolumeMl === null ? "Unspecified" : `${entry.diluentVolumeMl} mL`}</span>
              <span> · Duration: {entry.infusionDurationMinutes === null ? "Unspecified" : `${entry.infusionDurationMinutes} min`}</span>
            </p>}
            <p className={styles.reference}>Prescription route reference: <bdi dir="auto">{display(medication.route)}</bdi></p>
          </div>
          <Link className={styles.editLink} href={href}>{entry ? "Edit" : "Add instructions"}</Link>
        </article>;
      })}
      {!record.review.medications.length && <p>No medications are saved for this case.</p>}
    </div>}
  </div>;
}
