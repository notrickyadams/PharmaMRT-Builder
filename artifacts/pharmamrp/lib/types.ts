import type {
  AcceptanceCode,
  CauseCode,
  InterventionCode,
  ProblemCode,
} from "./classification";

export type PrescriptionStatus = "pending" | "reviewed";
export type ProblemSeverity = "low" | "moderate" | "high";
export type ProblemReviewStatus =
  | "suggested"
  | "accepted"
  | "edited"
  | "rejected"
  | "added";

export interface Medication {
  id: string;
  name: string | null;
  dose: string | null;
  unit: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  sourceText: string | null;
}

export interface Problem {
  id: string;
  medicationIds: string[];
  problemCode: ProblemCode | null;
  causeCode: CauseCode | null;
  explanation: string | null;
  severity: ProblemSeverity | null;
  suggestedIntervention: InterventionCode | null;
  finalIntervention: InterventionCode | null;
  acceptance: AcceptanceCode | null;
  reviewStatus: ProblemReviewStatus;
  highlights: string[];
  notes: string | null;
}

export interface Prescription {
  id: string;
  scannedAt: string;
  ward: string | null;
  patientAge: number | null;
  patientGender: string | null;
  medications: Medication[];
  problems: Problem[];
  status: PrescriptionStatus;
}
