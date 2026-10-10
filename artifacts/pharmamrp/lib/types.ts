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
export type Confidence = "high" | "low";
export type MedicationOrderStatus = "active" | "stopped" | "modified" | "unknown";

export interface LabOrder {
  test: string | null;
  date: string | null;
  sourceText: string | null;
}

export interface Medication {
  id: string;
  name: string | null;
  genericName: string | null;
  dose: string | null;
  unit: string | null;
  frequency: string | null;
  route: string | null;
  duration: string | null;
  confidence: Confidence | null;
  conditions: string[] | null;
  startDate: string | null;
  orderStatus: MedicationOrderStatus;
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
  patientName: string | null;
  fileNumber: string | null;
  identifierConfidence: Confidence | null;
  medications: Medication[];
  labOrders: LabOrder[];
  problems: Problem[];
  status: PrescriptionStatus;
}
