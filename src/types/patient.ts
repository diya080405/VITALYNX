export type AlertCategory = 'STABLE' | 'WATCH' | 'REVIEW' | 'URGENT' | 'OFFLINE';

export type SpO2ScaleType = 'SCALE_1' | 'SCALE_2'; // SCALE_2 is for hypercapnic respiratory failure (target 88-92%)

export interface PatientBaseline {
  heartRate: number; // e.g. 74
  spo2: number; // e.g. 97 or 90
  respiratoryRate: number; // e.g. 16
  temperature: number; // e.g. 36.8
  systolicBP?: number;
  diastolicBP?: number;
  calculatedAt: string;
  totalObservationCount: number;
  hrDeviationThreshold?: number; // default ±8 BPM
  spo2DeviationThreshold?: number; // default ±8 percentage points
  rrDeviationThreshold?: number; // default ±8 breaths/min
  tempDeviationThreshold?: number; // default ±0.8 °C
  spo2LowSafetyLimit?: number; // default 90% (Scale 1) or 85% (Scale 2)
  hrHighSafetyLimit?: number;
  hrLowSafetyLimit?: number;
  rrHighSafetyLimit?: number;
  rrLowSafetyLimit?: number;
  tempHighSafetyLimit?: number;
  tempLowSafetyLimit?: number;
  updatedBy?: string;
}

export interface VitalMetric {
  value: number;
  previousValue: number;
  unit: string;
  timestamp: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
  signalQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'ARTIFACT' | 'REMOVED';
  sqi: number; // 0-100%
}

export interface LatestVitals {
  heartRate: number;
  previousHeartRate?: number;
  spo2: number;
  previousSpo2?: number;
  respiratoryRate: number;
  previousRespiratoryRate?: number;
  temperature: number;
  previousTemperature?: number;
  bloodPressure?: string;
  timestamp: string;
  sensorQuality: 'VALID' | 'SUSPECTED_ARTIFACT' | 'PROBE_REMOVED' | 'MISSING' | 'NOISY' | 'SENSOR_DISCONNECTED' | 'FLATLINED_SIGNAL' | 'POOR_SIGNAL_QUALITY' | 'MOTION_NOISE' | 'MISSING_READINGS';
}

export type EmergencyContactType = 'PRIMARY' | 'ALTERNATE' | 'ADDITIONAL';

export interface EmergencyContact {
  id?: string;
  patientId?: string;
  contactType?: EmergencyContactType;
  name: string;
  relationship: string;
  phone: string;
  priority?: number;
}

export interface DoctorContactInfo {
  name: string;
  role: string;
  clinic: string;
  phone: string;
  email: string;
  pager?: string;
}

export interface Patient {
  id: string; // e.g., 'PT-8021'
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  avatarUrl?: string;
  dischargeDate: string; // e.g. '2026-11-05'
  primaryDiagnosis: string;
  medicalConditions: string[];
  medications: string[];
  monitoringStatus: 'ACTIVE' | 'PAUSED' | 'DISCONNECTED';
  currentAlertCategory: AlertCategory;
  statusExplanation?: string;
  latestVitals: LatestVitals;
  spo2Scale: SpO2ScaleType;
  targetSpo2Range: [number, number]; // e.g. [88, 92] for Marcus Chen, [96, 100] for standard
  baseline: PatientBaseline;
  personalizationNotes: string;
  news2Score: number;
  news2Breakdown: {
    respiratoryRateScore: number;
    spo2Score: number;
    supplementalOxygenScore: number;
    temperatureScore: number;
    systolicBPScore: number;
    heartRateScore: number;
    consciousnessScore: number;
  };
  hasSupplementalOxygen: boolean;
  fhirResourceId: string;
  roomBed?: string;
  careTeamMember: string;
  assignedDoctor: string; // 'Dr. Evelyn Vance'
  assignedDoctorContact: DoctorContactInfo;
  patientPhone: string;
  // Emergency contacts for patient portal
  primaryEmergencyContact: EmergencyContact;
  alternativeEmergencyContact: EmergencyContact;
  emergencyContacts?: EmergencyContact[];
}
