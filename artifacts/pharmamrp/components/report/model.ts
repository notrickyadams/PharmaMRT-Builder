import { ACCEPTANCE_CODES, CAUSE_CODES, INTERVENTION_CODES, PROBLEM_CODES } from "../../lib/classification";
import type { SavedCase } from "../../lib/storage";

export type Count = { code: string; label: string; count: number };
export type ReportRow = {
  date: string; fileNumber: string; ward: string; medications: string;
  problem: string; cause: string; intervention: string; acceptance: string; notes: string;
};
export const unspecified = "Unspecified";
const text = (value: string | null | undefined) => value?.trim() || unspecified;
type Codes = readonly { code: string; label: string }[];
const label = (codes: Codes, code: string | null) =>
  codes.find(item => item.code === code)?.label ?? unspecified;
const coded = (codes: Codes, code: string | null) => code ? `${code} — ${label(codes, code)}` : unspecified;
export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function dateKey(date: Date) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
}
const sorted = (values: Count[]) => values.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
function countCodes(codes: Codes, values: (string | null)[]) {
  const rows = codes.map(item => ({ ...item, count: values.filter(value => value === item.code).length }));
  const missing = values.filter(value => value === null).length;
  if (missing) rows.push({ code: "", label: unspecified, count: missing });
  return sorted(rows);
}
export function buildReport(cases: SavedCase[], month: string) {
  const selectedCases = /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ? cases.filter(item => monthKey(new Date(item.savedAt)) === month) : [];
  const entries = selectedCases.flatMap(record => record.problems
    .filter(problem => ["accepted", "edited", "added"].includes(problem.reviewStatus))
    .map(problem => ({ record, problem })));
  const problems = entries.map(item => item.problem);
  const answered = problems.filter(problem => problem.acceptance !== null).length;
  const accepted = problems.filter(problem => problem.acceptance === "A1").length;
  const wards = new Map<string, Count>();
  const medications = new Map<string, Count>();
  const rows: ReportRow[] = entries.map(({ record, problem }) => {
    const ward = text(record.review.ward);
    const wardKey = ward.normalize("NFKC").toLocaleLowerCase();
    wards.set(wardKey, { code: "", label: wards.get(wardKey)?.label ?? ward, count: (wards.get(wardKey)?.count ?? 0) + 1 });
    const involved = record.review.medications.filter(medication => problem.medicationIds.includes(medication.id));
    const perProblem = new Set<string>();
    for (const medication of involved) {
      const generic = medication.genericName?.trim();
      const displayName = generic || `${text(medication.name)} (generic unspecified)`;
      const key = `${generic ? "generic" : "recorded"}:${(generic || text(medication.name)).normalize("NFKC").toLocaleLowerCase()}`;
      if (perProblem.has(key)) continue;
      perProblem.add(key);
      medications.set(key, { code: "", label: medications.get(key)?.label ?? displayName, count: (medications.get(key)?.count ?? 0) + 1 });
    }
    return {
      date: dateKey(new Date(record.savedAt)), fileNumber: text(record.review.fileNumber),
      ward, medications: involved.map(medication => medication.genericName?.trim() ||
        `${text(medication.name)} (generic unspecified)`).join("; ") || unspecified,
      problem: coded(PROBLEM_CODES, problem.problemCode),
      cause: coded(CAUSE_CODES, problem.causeCode),
      intervention: coded(INTERVENTION_CODES, problem.finalIntervention),
      acceptance: coded(ACCEPTANCE_CODES, problem.acceptance), notes: problem.notes ?? "",
    };
  });
  return {
    month, caseCount: selectedCases.length, problemCount: entries.length,
    interventionCount: problems.filter(problem => problem.finalIntervention !== null && problem.finalIntervention !== "I0").length,
    answered, accepted, acceptanceRate: answered ? accepted / answered * 100 : null,
    rows, problemTypes: countCodes(PROBLEM_CODES, problems.map(problem => problem.problemCode)),
    causes: countCodes(CAUSE_CODES, problems.map(problem => problem.causeCode)),
    interventions: countCodes(INTERVENTION_CODES, problems.map(problem => problem.finalIntervention)),
    acceptance: countCodes(ACCEPTANCE_CODES, problems.map(problem => problem.acceptance)),
    wards: sorted([...wards.values()]), medications: sorted([...medications.values()]),
  };
}
export type MonthlyReport = ReturnType<typeof buildReport>;
export function workbookData(report: MonthlyReport) {
  const groups: [string, Count[]][] = [
    ["Problems", report.problemTypes], ["Causes", report.causes],
    ["Interventions", report.interventions], ["Acceptance", report.acceptance],
    ["Wards", report.wards], ["Medications", report.medications],
  ];
  return [
    { name: "Summary", rows: [
      ["Metric", "Value"], ["Month", report.month], ["Cases reviewed", report.caseCount],
      ["Problems documented", report.problemCount], ["Interventions made", report.interventionCount],
      ["Acceptance rate (%)", report.acceptanceRate === null ? "Not recorded" : Math.round(report.acceptanceRate * 10) / 10],
      ["Interventions accepted (A1)", report.accepted], ["Problems with acceptance answer", report.answered],
      ["Date basis", "Case saved date, browser local time"],
      ["Intervention definition", "Final intervention recorded, excluding I0 (No intervention)"],
      ["Medication counts", "Distinct problems per generic name; recorded name used only when generic is unspecified"],
    ] },
    { name: "Problems", rows: [
      ["Date", "File number", "Ward", "Medications", "Problem", "Cause", "Intervention", "Acceptance", "Notes"],
      ...report.rows.map(row => [row.date, row.fileNumber, row.ward, row.medications,
        row.problem, row.cause, row.intervention, row.acceptance, row.notes]),
    ] },
    { name: "Counts", rows: [["Category", "Code", "Label", "Count"],
      ...groups.flatMap(([group, values]) => values.map(item => [group, item.code, item.label, item.count])),
    ] },
  ];
}
