export const PROBLEM_CODES = [
  { code: "P1", label: "Treatment effectiveness" },
  { code: "P2", label: "Treatment safety" },
  { code: "P3", label: "Other" },
] as const;

export const CAUSE_CODES = [
  { code: "C1", label: "Drug selection" },
  { code: "C2", label: "Drug form" },
  { code: "C3", label: "Dose selection" },
  { code: "C4", label: "Treatment duration" },
  { code: "C5", label: "Drug use process" },
  { code: "C6", label: "Logistics" },
  { code: "C7", label: "Patient" },
  { code: "C8", label: "Patient transfer related" },
  { code: "C9", label: "Other" },
] as const;

export const INTERVENTION_CODES = [
  { code: "I0", label: "No intervention" },
  { code: "I1", label: "Prescriber" },
  { code: "I2", label: "Patient" },
  { code: "I3", label: "Drug" },
  { code: "I4", label: "Other" },
] as const;

export const ACCEPTANCE_CODES = [
  { code: "A1", label: "Intervention accepted" },
  { code: "A2", label: "Intervention not accepted" },
  { code: "A3", label: "Other" },
] as const;

export type ProblemCode = (typeof PROBLEM_CODES)[number]["code"];
export type CauseCode = (typeof CAUSE_CODES)[number]["code"];
export type InterventionCode = (typeof INTERVENTION_CODES)[number]["code"];
export type AcceptanceCode = (typeof ACCEPTANCE_CODES)[number]["code"];
