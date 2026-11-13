import type { Patient, DoctorContactInfo } from '../types/patient.ts';
import { PATIENT_IMAGE_MAP } from '../utils/patientAssets.ts';

export const DR_EVELYN_VANCE_CONTACT: DoctorContactInfo = {
  name: 'Dr. Evelyn Vance',
  role: 'Attending Physician & Lead Intensivist',
  clinic: 'BIET Memorial Hospital – Remote Clinical Surveillance Command',
  phone: '9900130474',
  email: 'evelyn.vance@vitalynx-health.org',
  pager: 'PG-409'
};

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'PT-8021',
    name: 'Marcus Chen',
    age: 68,
    gender: 'Male',
    avatarUrl: PATIENT_IMAGE_MAP['PT-8021'],
    dischargeDate: '2026-11-05 (6 days ago)',
    primaryDiagnosis: 'COPD Exacerbation with Chronic Hypercapnic Respiratory Failure',
    medicalConditions: [
      'Chronic Obstructive Pulmonary Disease (GOLD Stage III)',
      'Documented Hypercapnic Respiratory Failure',
      'Cor Pulmonale',
      'Hypertension'
    ],
    medications: [
      'Tiotropium Bromide 18 mcg Inhalation daily',
      'Fluticasone/Salmeterol 250/50 mcg Diskus BID',
      'Amlodipine 5 mg PO daily',
      'Home Low-Flow O2 at 1.5 L/min nasal cannula'
    ],
    monitoringStatus: 'ACTIVE',
    currentAlertCategory: 'STABLE', // Stable under personalized Scale 2!
    statusExplanation: 'All vital parameters remain within personalized therapeutic targets. SpO2 is safely within the target range of 88–92% under COPD Scale 2.',
    latestVitals: {
      heartRate: 78,
      previousHeartRate: 76,
      spo2: 90, // Within 88-92% target! On standard scale, 90% triggers a warning, but for Marcus it is optimal!
      previousSpo2: 91,
      respiratoryRate: 18,
      previousRespiratoryRate: 17,
      temperature: 36.8,
      previousTemperature: 36.7,
      bloodPressure: '128/82',
      timestamp: 'Just now (1 min ago)',
      sensorQuality: 'VALID'
    },
    spo2Scale: 'SCALE_2', // NEWS2 Scale 2 for Hypercapnic Respiratory Failure
    targetSpo2Range: [88, 92],
    baseline: {
      heartRate: 76,
      spo2: 90,
      respiratoryRate: 17,
      temperature: 36.7,
      systolicBP: 126,
      diastolicBP: 80,
      calculatedAt: '2026-11-06 08:00',
      totalObservationCount: 288
    },
    personalizationNotes: 'SPECIAL PROTOCOL: NEWS2 SpO2 Scale 2 applies. Target saturation 88–92% to avoid hypercapnic blunting of hypoxic drive. Normal fixed 96%+ thresholds are strictly suppressed.',
    news2Score: 0,
    news2Breakdown: {
      respiratoryRateScore: 0,
      spo2Score: 0, // In scale 2, 88-92% scores 0!
      supplementalOxygenScore: 0,
      temperatureScore: 0,
      systolicBPScore: 0,
      heartRateScore: 0,
      consciousnessScore: 0
    },
    hasSupplementalOxygen: true,
    fhirResourceId: 'urn:uuid:8b31a890-482d-4217-bfd2-009941a12001',
    roomBed: 'Home Unit A-12',
    careTeamMember: 'Dr. Evelyn Vance (Attending Physician)',
    assignedDoctor: 'Dr. Evelyn Vance',
    assignedDoctorContact: DR_EVELYN_VANCE_CONTACT,
    patientPhone: '7259821416',
    primaryEmergencyContact: {
      name: 'Linda Chen',
      relationship: 'Spouse',
      phone: '9353802577'
    },
    alternativeEmergencyContact: {
      name: 'David Chen',
      relationship: 'Son',
      phone: '+1 (555) 876-5432'
    }
  },
  {
    id: 'PT-8022',
    name: 'Sarah Jenkins',
    age: 54,
    gender: 'Female',
    avatarUrl: PATIENT_IMAGE_MAP['PT-8022'],
    dischargeDate: '2026-11-07 (4 days ago)',
    primaryDiagnosis: 'Post-CABG Recovery with Heart Failure (EF 40%)',
    medicalConditions: [
      'Coronary Artery Bypass Graft (x3)',
      'Ischemic Cardiomyopathy',
      'Type 2 Diabetes Mellitus'
    ],
    medications: [
      'Metoprolol Succinate 50 mg daily',
      'Sacubitril/Valsartan 49/51 mg BID',
      'Empagliflozin 10 mg daily',
      'Aspirin 81 mg daily'
    ],
    monitoringStatus: 'ACTIVE',
    currentAlertCategory: 'WATCH',
    statusExplanation: 'Patient requires closer observation due to a gradual downward nocturnal trend in SpO2 (93% vs 97% baseline) and slight resting heart rate elevation.',
    latestVitals: {
      heartRate: 88,
      previousHeartRate: 82,
      spo2: 93,
      previousSpo2: 95,
      respiratoryRate: 20,
      previousRespiratoryRate: 18,
      temperature: 37.1,
      previousTemperature: 36.9,
      bloodPressure: '118/74',
      timestamp: '2 mins ago',
      sensorQuality: 'VALID'
    },
    spo2Scale: 'SCALE_1',
    targetSpo2Range: [96, 100],
    baseline: {
      heartRate: 72,
      spo2: 97,
      respiratoryRate: 16,
      temperature: 36.6,
      systolicBP: 114,
      diastolicBP: 72,
      calculatedAt: '2026-11-08 09:00',
      totalObservationCount: 192
    },
    personalizationNotes: 'Monitored for early signs of pulmonary congestion or fluid overload. Rolling baseline shows downward trend in night-time SpO2 over last 6 hours.',
    news2Score: 2,
    news2Breakdown: {
      respiratoryRateScore: 0,
      spo2Score: 1, // 93% on Scale 1
      supplementalOxygenScore: 0,
      temperatureScore: 0,
      systolicBPScore: 0,
      heartRateScore: 1, // 88 bpm slightly elevated
      consciousnessScore: 0
    },
    hasSupplementalOxygen: false,
    fhirResourceId: 'urn:uuid:34f59c11-9a43-41bb-a53b-9e48226b9112',
    roomBed: 'Home Unit C-04',
    careTeamMember: 'Dr. Evelyn Vance (Attending Physician)',
    assignedDoctor: 'Dr. Evelyn Vance',
    assignedDoctorContact: DR_EVELYN_VANCE_CONTACT,
    patientPhone: '7259821416',
    primaryEmergencyContact: {
      name: 'Mark Jenkins',
      relationship: 'Spouse',
      phone: '9353802577'
    },
    alternativeEmergencyContact: {
      name: 'Emily Jenkins',
      relationship: 'Daughter',
      phone: '+1 (555) 987-6543'
    }
  },
  {
    id: 'PT-8023',
    name: 'Robert Alvarez',
    age: 72,
    gender: 'Male',
    avatarUrl: PATIENT_IMAGE_MAP['PT-8023'],
    dischargeDate: '2026-11-08 (3 days ago)',
    primaryDiagnosis: 'Urosepsis Recovery with Acute Kidney Injury (Resolved)',
    medicalConditions: [
      'Recent Urosepsis (Gram-negative)',
      'Benign Prostatic Hyperplasia',
      'Chronic Kidney Disease Stage 3a'
    ],
    medications: [
      'Cefpodoxime Proxetil 200 mg PO BID (Day 5 of 7)',
      'Tamsulosin 0.4 mg PO daily at bedtime',
      'Oral Hydration Protocol 2L/day'
    ],
    monitoringStatus: 'ACTIVE',
    currentAlertCategory: 'REVIEW',
    statusExplanation: 'Clinical review recommended. Sustained core temperature elevation (38.6°C) combined with compensatory tachycardia (112 bpm) suggests possible bacteremia recurrence.',
    latestVitals: {
      heartRate: 112,
      previousHeartRate: 98,
      spo2: 95,
      previousSpo2: 96,
      respiratoryRate: 23,
      previousRespiratoryRate: 20,
      temperature: 38.6,
      previousTemperature: 37.8,
      bloodPressure: '102/64',
      timestamp: '4 mins ago',
      sensorQuality: 'VALID'
    },
    spo2Scale: 'SCALE_1',
    targetSpo2Range: [96, 100],
    baseline: {
      heartRate: 74,
      spo2: 97,
      respiratoryRate: 15,
      temperature: 36.8,
      systolicBP: 122,
      diastolicBP: 78,
      calculatedAt: '2026-11-09 11:30',
      totalObservationCount: 144
    },
    personalizationNotes: 'Early recurrence surveillance for secondary bacteremia. Current spike: Tachycardia + Fever + Tachypnea suggests potential systemic inflammation.',
    news2Score: 6,
    news2Breakdown: {
      respiratoryRateScore: 2, // 23/min
      spo2Score: 1, // 95%
      supplementalOxygenScore: 0,
      temperatureScore: 1, // 38.6°C
      systolicBPScore: 1, // 102 mmHg
      heartRateScore: 1, // 112 bpm
      consciousnessScore: 0
    },
    hasSupplementalOxygen: false,
    fhirResourceId: 'urn:uuid:71a2be44-c760-44ec-b892-23c88bb71004',
    roomBed: 'Home Unit B-09',
    careTeamMember: 'Dr. Evelyn Vance (Attending Physician)',
    assignedDoctor: 'Dr. Evelyn Vance',
    assignedDoctorContact: DR_EVELYN_VANCE_CONTACT,
    patientPhone: '7259821416',
    primaryEmergencyContact: {
      name: 'Maria Alvarez',
      relationship: 'Daughter',
      phone: '9353802577'
    },
    alternativeEmergencyContact: {
      name: 'Carlos Alvarez',
      relationship: 'Brother',
      phone: '+1 (555) 876-1234'
    }
  },
  {
    id: 'PT-8024',
    name: 'Elena Rostova',
    age: 61,
    gender: 'Female',
    avatarUrl: PATIENT_IMAGE_MAP['PT-8024'],
    dischargeDate: '2026-11-09 (2 days ago)',
    primaryDiagnosis: 'Severe Community-Acquired Pneumonia (Left Lower Lobe)',
    medicalConditions: [
      'Community-Acquired Pneumonia',
      'Bronchial Asthma (Moderate persistent)',
      'Osteopenia'
    ],
    medications: [
      'Levofloxacin 500 mg PO daily',
      'Budesonide/Formoterol 160/4.5 mcg 2 puffs BID',
      'Prednisone 20 mg tapering course'
    ],
    monitoringStatus: 'ACTIVE',
    currentAlertCategory: 'URGENT',
    statusExplanation: 'Requires prompt clinical attention. Severe hypoxemic desaturation (SpO2 86% on Scale 1) with marked tachypnea (28/min) and tachycardia (124 bpm).',
    latestVitals: {
      heartRate: 124,
      previousHeartRate: 114,
      spo2: 86, // Dropped severely on Scale 1
      previousSpo2: 91,
      respiratoryRate: 28,
      previousRespiratoryRate: 24,
      temperature: 38.9,
      previousTemperature: 38.2,
      bloodPressure: '96/60',
      timestamp: '1 min ago',
      sensorQuality: 'VALID'
    },
    spo2Scale: 'SCALE_1',
    targetSpo2Range: [96, 100],
    baseline: {
      heartRate: 78,
      spo2: 96,
      respiratoryRate: 16,
      temperature: 37.0,
      systolicBP: 120,
      diastolicBP: 76,
      calculatedAt: '2026-11-10 10:00',
      totalObservationCount: 96
    },
    personalizationNotes: 'Critical respiratory deterioration risk. Immediate clinical escalation recommended: severe hypoxemia with marked tachypnea.',
    news2Score: 9,
    news2Breakdown: {
      respiratoryRateScore: 3, // 28/min
      spo2Score: 3, // 86% on Scale 1
      supplementalOxygenScore: 0,
      temperatureScore: 1, // 38.9°C
      systolicBPScore: 1, // 96 mmHg
      heartRateScore: 1, // 124 bpm
      consciousnessScore: 0
    },
    hasSupplementalOxygen: false,
    fhirResourceId: 'urn:uuid:65de1239-2a9c-48be-8012-7811bb391209',
    roomBed: 'Home Unit D-01',
    careTeamMember: 'Dr. Evelyn Vance (Attending Physician)',
    assignedDoctor: 'Dr. Evelyn Vance',
    assignedDoctorContact: DR_EVELYN_VANCE_CONTACT,
    patientPhone: '7259821416',
    primaryEmergencyContact: {
      name: 'Dmitri Rostov',
      relationship: 'Spouse',
      phone: '9353802577'
    },
    alternativeEmergencyContact: {
      name: 'Anna Rostova',
      relationship: 'Sister',
      phone: '+1 (555) 765-4321'
    }
  },
  {
    id: 'PT-8025',
    name: 'James Wilson',
    age: 75,
    gender: 'Male',
    avatarUrl: PATIENT_IMAGE_MAP['PT-8025'],
    dischargeDate: '2026-11-10 (1 day ago)',
    primaryDiagnosis: 'Total Knee Arthroplasty + Paroxysmal Atrial Fibrillation',
    medicalConditions: [
      'Post-operative Left Total Knee Replacement',
      'Paroxysmal Atrial Fibrillation (Rate controlled)',
      'Mild Cognitive Impairment'
    ],
    medications: [
      'Apixaban 5 mg PO BID',
      'Paracetamol 1000 mg QDS PRN',
      'Enoxaparin 40 mg SC (discontinued)'
    ],
    monitoringStatus: 'DISCONNECTED',
    currentAlertCategory: 'OFFLINE',
    statusExplanation: 'Sensor detached from patient. Pulse oximeter probe was unclipped during ambulation. This is an artifact event (PROBE_REMOVED), not genuine patient deterioration.',
    latestVitals: {
      heartRate: 0, // Flatline detected as probe off!
      previousHeartRate: 72,
      spo2: 0,
      previousSpo2: 97,
      respiratoryRate: 0,
      previousRespiratoryRate: 16,
      temperature: 36.6,
      previousTemperature: 36.6,
      bloodPressure: '124/80',
      timestamp: '18 mins ago',
      sensorQuality: 'PROBE_REMOVED' // System classified as artifact, avoiding false code blue!
    },
    spo2Scale: 'SCALE_1',
    targetSpo2Range: [96, 100],
    baseline: {
      heartRate: 70,
      spo2: 97,
      respiratoryRate: 15,
      temperature: 36.6,
      systolicBP: 124,
      diastolicBP: 80,
      calculatedAt: '2026-11-10 18:00',
      totalObservationCount: 48
    },
    personalizationNotes: 'NOTE: Wearable pulse-oximeter detached while ambulating to bathroom. Artifact filter suppressed false code alert; flagged as Device Warning.',
    news2Score: 0,
    news2Breakdown: {
      respiratoryRateScore: 0,
      spo2Score: 0,
      supplementalOxygenScore: 0,
      temperatureScore: 0,
      systolicBPScore: 0,
      heartRateScore: 0,
      consciousnessScore: 0
    },
    hasSupplementalOxygen: false,
    fhirResourceId: 'urn:uuid:10ff3847-19aa-4033-91ec-883391091238',
    roomBed: 'Home Unit E-07',
    careTeamMember: 'Dr. Evelyn Vance (Attending Physician)',
    assignedDoctor: 'Dr. Evelyn Vance',
    assignedDoctorContact: DR_EVELYN_VANCE_CONTACT,
    patientPhone: '7259821416',
    primaryEmergencyContact: {
      name: 'Patricia Wilson',
      relationship: 'Spouse',
      phone: '9353802577'
    },
    alternativeEmergencyContact: {
      name: 'Thomas Wilson',
      relationship: 'Son',
      phone: '+1 (555) 654-3210'
    }
  },
  {
    id: 'PT-8026',
    name: 'Dorothy Miller',
    age: 81,
    gender: 'Female',
    avatarUrl: PATIENT_IMAGE_MAP['PT-8026'],
    dischargeDate: '2026-11-06 (5 days ago)',
    primaryDiagnosis: 'Post-NSTEMI Recovery with Drug-Eluting Stent (LAD)',
    medicalConditions: [
      'Non-ST Elevation Myocardial Infarction',
      'Coronary Artery Disease',
      'Hyperlipidemia'
    ],
    medications: [
      'Ticagrelor 90 mg BID',
      'Aspirin 81 mg daily',
      'Atorvastatin 80 mg daily',
      'Bisoprolol 2.5 mg daily'
    ],
    monitoringStatus: 'ACTIVE',
    currentAlertCategory: 'STABLE',
    statusExplanation: 'Patient is stable. No concerning changes detected in available telemetry. Resting vitals are consistent with personalized recovery baseline.',
    latestVitals: {
      heartRate: 66,
      previousHeartRate: 68,
      spo2: 98,
      previousSpo2: 98,
      respiratoryRate: 15,
      previousRespiratoryRate: 15,
      temperature: 36.7,
      previousTemperature: 36.6,
      bloodPressure: '122/76',
      timestamp: '3 mins ago',
      sensorQuality: 'VALID'
    },
    spo2Scale: 'SCALE_1',
    targetSpo2Range: [96, 100],
    baseline: {
      heartRate: 68,
      spo2: 98,
      respiratoryRate: 15,
      temperature: 36.6,
      systolicBP: 120,
      diastolicBP: 74,
      calculatedAt: '2026-11-07 10:00',
      totalObservationCount: 240
    },
    personalizationNotes: 'Stable cardiac recovery. Good adherence to antiplatelet regimen. Resting vitals consistently within target range.',
    news2Score: 0,
    news2Breakdown: {
      respiratoryRateScore: 0,
      spo2Score: 0,
      supplementalOxygenScore: 0,
      temperatureScore: 0,
      systolicBPScore: 0,
      heartRateScore: 0,
      consciousnessScore: 0
    },
    hasSupplementalOxygen: false,
    fhirResourceId: 'urn:uuid:9981a812-7104-4b92-8091-112349887711',
    roomBed: 'Home Unit A-02',
    careTeamMember: 'Dr. Evelyn Vance (Attending Physician)',
    assignedDoctor: 'Dr. Evelyn Vance',
    assignedDoctorContact: DR_EVELYN_VANCE_CONTACT,
    patientPhone: '7259821416',
    primaryEmergencyContact: {
      name: 'Susan Miller',
      relationship: 'Daughter',
      phone: '9353802577'
    },
    alternativeEmergencyContact: {
      name: 'Michael Miller',
      relationship: 'Son',
      phone: '+1 (555) 543-2109'
    }
  }
];
