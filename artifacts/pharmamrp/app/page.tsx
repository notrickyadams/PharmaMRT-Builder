"use client";
import { useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { resetDemo } from "@/lib/storage";
import styles from "@/components/workflow.module.css";

export default function HomePage() {
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return <Shell>
    <section className={styles.hero}><p className={styles.eyebrow}>The pharmacist stays in control</p>
      <h1>PharmaMRP</h1><p>Turn a treatment sheet into a reviewed medication record.</p>
      <p>Check the medications and labs. Review every suggested problem. Save only your decisions.</p>
      <div className={styles.row}><Link className={styles.primary} href="/scan">Scan a treatment sheet</Link><Link href="/records">Records</Link><Link href="/administration">Medication administration</Link></div>
    </section>
    <section><h2>AI suggests. You decide.</h2><p>Accept, edit or reject each suggestion, or document a problem yourself. Manual entry is always available.</p>
      <p className={styles.muted}>Fictional training sheets only. Patient names are always unspecified; real patient identifiers must not be entered.</p>
    </section>
    <section><h2>Document administration</h2><p>Choose a saved reviewed case and medication, then explicitly record a given dose or document why it was missed. Administration history stays attached to that case in this browser.</p>
      <Link className={styles.secondary} href="/administration">Open medication administration</Link>
    </section>
    <section><h2>Try the fictional reviewed cases</h2><p>Reset replaces saved cases on this browser with exactly three fictional pharmacist-reviewed examples. No AI request is made.</p>
      {!confirmReset ? <button type="button" onClick={() => setConfirmReset(true)}>Reset demo</button> :
        <div role="group" aria-label="Confirm reset"><p>Replace all saved cases? This cannot be undone. Administration history for the replaced cases will no longer be accessible from the new cases.</p><div className={styles.row}>
          <button type="button" className={styles.danger} onClick={() => { const result = resetDemo(); setMessage(result.ok ? "Saved records replaced with three fictional reviewed cases." : result.error); setConfirmReset(false); }}>Replace saved cases</button>
          <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
        </div></div>}
      {message && <p role="status">{message}</p>}
    </section>
  </Shell>;
}
