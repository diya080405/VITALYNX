import type { ClinicalAlert, ClinicianAction } from '../types/alert.ts';

export const MOCK_ALERTS: ClinicalAlert[] = [
  {
    id: 'ALT-1049',
    patientId: 'PT-8024',
    patientName: 'Elena Rostova',
    alertLevel: 'URGENT',
    vitalSignReading: 'SpO2 86% | RR 28/min | HR 124 bpm',
    parameter: 'MULTIVARIATE',
    timestamp: '2026-11-11 23:08',
    ruleApplied: 'Rule RES-01: Severe Hypoxemic Decompensation with Acute Tachypnea (NEWS2 score ≥ 7)',
    patientMedicalInfo: 'Severe CAP recovery; Standard SpO2 Scale 1 active (Target 96-100%). Baseline SpO2: 96%.',
    sensorQualityStatus: 'VALID',
    explanation: 'Elena shows high-confidence concordant deterioration across respiratory rate (+12 above baseline) and oxygen saturation (-10% below baseline). Sensor signal-to-noise ratio is 98% with pulsatile PPG amplitude confirmed, ruling out motion artifact.',
    suggestedAction: 'Immediate tele-triage: Initiate urgent video clinical assessment, titrate emergency home supplemental O2, and notify on-call emergency respiratory service.',
    status: 'ACTIVE'
  },
  {
    id: 'ALT-1048',
    patientId: 'PT-8023',
    patientName: 'Robert Alvarez',
    alertLevel: 'REVIEW',
    vitalSignReading: 'Temp 38.6°C | HR 112 bpm | RR 23/min',
    parameter: 'MULTIVARIATE',
    timestamp: '2026-11-11 22:45',
    ruleApplied: 'Rule INF-02: SIRS/Sepsis Recurrence Criteria Met (Temp >38.3°C + Tachycardia)',
    patientMedicalInfo: 'Recent Gram-negative urosepsis; Day 5/7 post-discharge antibiotics. Baseline HR: 74 bpm, Temp: 36.8°C.',
    sensorQualityStatus: 'VALID',
    explanation: 'Core body temperature sustained elevation above 38.5°C over 45 minutes with concordant sinus tachycardia (HR 112 bpm). Wearable PPG and thermal skin patch demonstrate high contact fidelity.',
    suggestedAction: 'Schedule urgent same-day clinician review. Order repeat urinalysis and blood cultures. Verify antibiotic compliance and hydration status.',
    status: 'ACTIVE'
  },
  {
    id: 'ALT-1047',
    patientId: 'PT-8022',
    patientName: 'Sarah Jenkins',
    alertLevel: 'WATCH',
    vitalSignReading: 'SpO2 93% (Baseline 97%) | HR 88 bpm',
    parameter: 'SPO2',
    timestamp: '2026-11-11 21:15',
    ruleApplied: 'Rule O2-04: Sustained Desaturation below personalized baseline (>3% drop for >30m)',
    patientMedicalInfo: 'Post-CABG with Heart Failure (EF 40%). Target SpO2: 96-100%.',
    sensorQualityStatus: 'VALID',
    explanation: 'Nocturnal downward trend noted in oxygen saturation over the past 4 hours without acute tachypnea. Signal quality index (SQI) is 94%. Early indicator of orthopnea or early fluid congestion.',
    suggestedAction: 'Monitor trend overnight. Request morning weight check and symptom check-in regarding dyspnea when lying flat. Consider diuretic dosage review.',
    status: 'ACTIVE'
  },
  {
    id: 'ALT-1046',
    patientId: 'PT-8021',
    patientName: 'Marcus Chen',
    alertLevel: 'WATCH',
    vitalSignReading: 'SpO2 87% (Scale 2 Target: 88-92%)',
    parameter: 'SPO2',
    timestamp: '2026-11-11 19:30',
    ruleApplied: 'Rule COPD-02: Transient Sub-target SpO2 excursion on NEWS2 Scale 2',
    patientMedicalInfo: 'COPD Gold III with Hypercapnic Failure. Scale 2 applies. Target: 88-92%. Fixed 96% alert suppressed.',
    sensorQualityStatus: 'VALID',
    explanation: 'SpO2 dipped to 87% for 8 minutes during post-prandial ambulation, then returned to 90%. System recognized personalized Scale 2 target (88-92%) rather than triggering false severe hypoxemia alert.',
    suggestedAction: 'Logged for observation. Automatic escalation bypassed due to quick self-resolution back to target 90%. Advise pacing during activity.',
    status: 'ACKNOWLEDGED',
    acknowledgedBy: 'Dr. Evelyn Vance',
    acknowledgedAt: '2026-11-11 19:42'
  },
  {
    id: 'ALT-1045',
    patientId: 'PT-8026',
    patientName: 'Dorothy Miller',
    alertLevel: 'WATCH',
    vitalSignReading: 'HR 52 bpm (Baseline 68 bpm)',
    parameter: 'HEART_RATE',
    timestamp: '2026-11-11 16:10',
    ruleApplied: 'Rule BRADY-01: Nocturnal/Resting Relative Bradycardia with Beta-Blocker',
    patientMedicalInfo: 'Post-NSTEMI, on Bisoprolol 2.5mg daily. Resting baseline HR: 68 bpm.',
    sensorQualityStatus: 'VALID',
    explanation: 'Resting pulse reached 52 bpm during afternoon rest. Patient completed symptom check-in confirming no dizziness, syncope, or chest heaviness.',
    suggestedAction: 'Clinician reviewed and marked expected response to beta-blockade.',
    status: 'RESOLVED',
    acknowledgedBy: 'Dr. Evelyn Vance',
    acknowledgedAt: '2026-11-11 16:25',
    resolvedAt: '2026-11-11 17:00'
  }
];

export const MOCK_CLINICIAN_ACTIONS: ClinicianAction[] = [
  {
    id: 'ACT-01',
    patientId: 'PT-8024',
    patientName: 'Elena Rostova',
    actionDescription: 'Conduct emergency video triage for acute desaturation (SpO2 86%, RR 28)',
    priority: 'HIGH',
    timestamp: '10 mins ago',
    completed: false,
    category: 'URGENT_TRIAGE'
  },
  {
    id: 'ACT-02',
    patientId: 'PT-8023',
    patientName: 'Robert Alvarez',
    actionDescription: 'Review temperature spike (38.6°C) and check bacteremia recurrence markers',
    priority: 'HIGH',
    timestamp: '25 mins ago',
    completed: false,
    category: 'TREND_REVIEW'
  },
  {
    id: 'ACT-03',
    patientId: 'PT-8025',
    patientName: 'James Wilson',
    actionDescription: 'Verify pulse-oximeter sensor reattachment (PROBE_REMOVED alert)',
    priority: 'MEDIUM',
    timestamp: '40 mins ago',
    completed: false,
    category: 'SENSOR_CHECK'
  },
  {
    id: 'ACT-04',
    patientId: 'PT-8022',
    patientName: 'Sarah Jenkins',
    actionDescription: 'Review downward SpO2 trend and prompt morning heart failure symptom check',
    priority: 'MEDIUM',
    timestamp: '1 hour ago',
    completed: false,
    category: 'OXYGEN_CHECK'
  },
  {
    id: 'ACT-05',
    patientId: 'PT-8021',
    patientName: 'Marcus Chen',
    actionDescription: 'Confirm oxygen concentrator flow setting remaining at 1.5 L/min',
    priority: 'LOW',
    timestamp: '3 hours ago',
    completed: true,
    category: 'TREND_REVIEW'
  }
];
