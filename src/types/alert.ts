export type ClinicalAlertCategory = 'WATCH' | 'REVIEW' | 'URGENT';
export type AlertResolutionStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface ClinicalAlert {
  id: string; // e.g. "ALT-1049"
  patientId: string;
  patientName: string;
  alertLevel: ClinicalAlertCategory;
  vitalSignReading: string; // e.g. "SpO2 86% (Scale 1 standard)", "HR 118 bpm & Temp 38.6°C"
  parameter: 'HEART_RATE' | 'SPO2' | 'RESPIRATORY_RATE' | 'TEMPERATURE' | 'MULTIVARIATE';
  timestamp: string;
  ruleApplied: string; // e.g. "Rule O2-04: Sustained Desaturation below personalized baseline (>4% drop for >15m)"
  patientMedicalInfo: string; // e.g. "COPD with Hypercapnic Failure - SpO2 Scale 2 active (Target 88-92%)"
  sensorQualityStatus: 'VALID' | 'SUSPECTED_ARTIFACT' | 'PROBE_REMOVED' | 'MISSING' | 'NOISY';
  explanation: string;
  suggestedAction: string;
  status: AlertResolutionStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface ClinicianAction {
  id: string;
  patientId: string;
  patientName: string;
  actionDescription: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  completed: boolean;
  category: 'TREND_REVIEW' | 'OXYGEN_CHECK' | 'SENSOR_CHECK' | 'SYMPTOM_REVIEW' | 'URGENT_TRIAGE';
}
