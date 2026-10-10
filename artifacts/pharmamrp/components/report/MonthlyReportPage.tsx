"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { readCases, type SavedCase } from "../../lib/storage";
import { buildReport, monthKey, workbookData, type Count } from "./model";
import styles from "./report.module.css";

const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith("0000");
function monthLabel(value: string) {
  if (!validMonth(value)) return "Select a month";
  const [year, month] = value.split("-").map(Number);
  const date = new Date(2000, month - 1, 1);
  date.setFullYear(year);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function BarList({ items, empty }: { items: Count[]; empty: string }) {
  const max = Math.max(0, ...items.map(item => item.count));
  if (!items.length) return <div className={styles.emptyList}>{empty}</div>;
  return (
    <div role="list" className={styles.bars}>
      {items.map(item => (
        <div role="listitem" key={`${item.code}:${item.label}`} className={item.count === 0 ? styles.zero : undefined}>
          <div className={styles.barLabel}>
            <span><bdi dir="auto">{item.label}</bdi>{item.code && <span className={styles.code}>{item.code}</span>}</span>
            <strong>{item.count}</strong>
          </div>
          <div className={styles.track} aria-hidden="true">
            <div className={styles.fill} style={{ width: `${max ? item.count / max * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MonthlyReportPage() {
  const [month, setMonth] = useState("");
  const [cases, setCases] = useState<SavedCase[] | null>(null);
  const [readError, setReadError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState("");
  const [mounted, setMounted] = useState(false);
  const refresh = useCallback(() => {
    const result = readCases();
    if (result.ok) {
      setCases(result.value);
      setReadError("");
    } else {
      setCases(null);
      setReadError(result.error);
    }
  }, []);
  useEffect(() => {
    setMonth(monthKey());
    setMounted(true);
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);
  const isValid = validMonth(month);
  const report = useMemo(() => cases !== null && isValid ? buildReport(cases, month) : null, [cases, month, isValid]);
  const period = monthLabel(month);

  async function exportWorkbook() {
    if (!isValid || exporting || readError || !report) return;
    const selectedMonth = month;
    setExportError("");
    setExported("");
    setExporting(true);
    try {
      const fresh = readCases();
      if (!fresh.ok) {
        setReadError(fresh.error);
        setCases(null);
        throw new Error(fresh.error);
      }
      setCases(fresh.value);
      const freshReport = buildReport(fresh.value, selectedMonth);
      const { buildWorkbook, downloadReport } = await import("./excel");
      downloadReport(buildWorkbook(workbookData(freshReport)), selectedMonth);
      setExported(`Workbook downloaded for ${monthLabel(selectedMonth)}.`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "The workbook could not be created. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const groups = report ? [
    { title: "Problems by type", items: report.problemTypes, empty: "No problems documented this month." },
    { title: "Causes", items: report.causes, empty: "No causes documented this month." },
    { title: "Interventions", items: report.interventions, empty: "No interventions documented this month." },
    { title: "Acceptance", items: report.acceptance, empty: "No acceptance outcomes documented this month." },
    { title: "Problems by ward", items: report.wards, empty: "No problems linked to wards this month." },
    { title: "Top 5 medications involved in problems", items: report.medications.slice(0, 5), empty: "No medications linked to problems this month." },
  ] : [];

  return (
    <div className={styles.report}>
      <header className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>Clinical pharmacist documentation</div>
          <h1>Monthly report</h1>
          <p className={styles.intro}>A month-by-month view of reviewed cases, documented problems and recorded intervention outcomes.</p>
        </div>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.monthField}>
          Reporting month
          <input type="month" value={month} min="0001-01" max="9999-12" disabled={!mounted || exporting}
            aria-describedby={!isValid && mounted ? "month-error" : undefined}
            aria-invalid={mounted && !isValid}
            onChange={event => {
              const next = event.target.value;
              setMonth(validMonth(next) ? next : "");
              setExportError("");
              setExported("");
            }} />
        </label>
        <div className={styles.period}>Saved date · browser local time</div>
        <button type="button" className={styles.export} onClick={exportWorkbook}
          disabled={!report || !isValid || !!readError || exporting}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" /></svg>
          {exporting ? "Creating workbook…" : "Export to Excel"}
        </button>
      </div>
      {mounted && !isValid && <div id="month-error" role="status" className={styles.alert}>Choose a valid reporting month to view or export its report.</div>}
      {readError && <div role="alert" className={styles.alert}><p>{readError}</p><button type="button" onClick={refresh}>Retry</button></div>}
      {exportError && !readError && <div role="alert" className={styles.alert}><p>{exportError}</p><button type="button" disabled={exporting || !report} onClick={exportWorkbook}>Retry export</button></div>}
      {exported && <div role="status" className={styles.status}>{exported}</div>}
      {!mounted && <div role="status" aria-label="Loading monthly report" className={styles.loading}>{[0, 1, 2, 3].map(index => <div key={index} className={styles.skeleton} aria-hidden="true" />)}</div>}
      {report && <>
        <div className={styles.sectionHeading}><h2>{period}</h2><span>Monthly documentation summary</span></div>
        <div className={styles.metrics}>
          <div className={styles.metric}><div className={styles.metricLabel}>Cases reviewed</div><div className={styles.value}>{report.caseCount}</div><div className={styles.metricNote}>Saved in the selected month</div></div>
          <div className={styles.metric}><div className={styles.metricLabel}>Problems documented</div><div className={styles.value}>{report.problemCount}</div><div className={styles.metricNote}>Pharmacist-confirmed problems</div></div>
          <div className={styles.metric}><div className={styles.metricLabel}>Interventions made</div><div className={styles.value}>{report.interventionCount}</div><div className={styles.metricNote}>Excludes I0 and unspecified</div></div>
          <div className={styles.metric}><div className={styles.metricLabel}>Acceptance rate</div>
            <div className={`${styles.value} ${report.acceptanceRate === null ? styles.valueText : ""}`}>{report.acceptanceRate === null ? "Not recorded" : `${Math.round(report.acceptanceRate * 10) / 10}%`}</div>
            <div className={styles.metricNote}>{report.answered} of {report.problemCount} problems with an acceptance answer{report.answered > 0 ? ` · ${report.accepted} accepted (A1)` : ""}</div>
          </div>
        </div>
        {report.caseCount === 0 && <section className={styles.empty}>
          <h2>No cases this month yet</h2>
          <p>Save a reviewed case to include it here. To try existing fictional examples, use Reset demo on Home.</p>
          <div className={styles.actions}><Link className={styles.scan} href="/scan">Scan a case</Link><Link className={styles.home} href="/">Go to Home</Link></div>
        </section>}
        <div className={styles.charts}>
          {groups.map((group, index) => <section className={styles.chart} key={group.title} aria-label={`${group.title}, ${period}`}>
            <div className={styles.chartHeader}><div><h2>{group.title}</h2><div className={styles.chartSubtitle}>{period} · problem count</div></div><span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span></div>
            <BarList items={report.problemCount === 0 ? [] : group.items} empty={group.empty} />
          </section>)}
        </div>
        <section className={styles.method}>
          <h2>How to read this report</h2>
          <p>Cases are grouped by their saved date in browser local time. Problem totals include pharmacist-confirmed, edited and added problems. Counts are shown in descending order; zero-count classifications remain visible when problems are documented.</p>
          <p>Acceptance is A1 ÷ answered outcomes (A1, A2 or A3), not the pharmacist’s review status. Unspecified outcomes are excluded from that rate. Interventions made exclude I0 (No intervention) and unspecified interventions.</p>
          <p>Medication counts represent unique problems per generic name. If the generic name is unspecified, the recorded medication name is used and explicitly labeled “generic unspecified”; no generic name is inferred.</p>
          <p>Excel includes Summary, Problems and Counts sheets. Saved free-text notes are included; check them before sharing. This report supports documentation and training, not clinical decision-making.</p>
        </section>
      </>}
    </div>
  );
}
