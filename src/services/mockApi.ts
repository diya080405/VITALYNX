import { Patient, LatestVitals, PatientBaseline } from '../types/patient';
import { VitalObservation } from '../types/observation';
import { ClinicalAlert } from '../types/alert';
import { SensorQualityEvent } from '../types/sensor';
import { MOCK_PATIENTS } from '../data/mockPatients';
import { MOCK_ALERTS } from '../data/mockAlerts';
import { generatePatientObservations } from '../data/mockObservations';
import { MOCK_SENSOR_EVENTS } from '../data/mockSensorEvents';

// In-memory mutable state for the session
let currentPatients = [...MOCK_PATIENTS];
let currentAlerts = [...MOCK_ALERTS];
let currentSensorEvents = [...MOCK_SENSOR_EVENTS];

export const mockApiService = {
  // GET /patients
  async getPatients(): Promise<Patient[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...currentPatients]), 60);
    });
  },

  // GET /patients/{patient_id}
  async getPatientById(patientId: string): Promise<Patient | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const found = currentPatients.find((p) => p.id === patientId) || null;
        resolve(found);
      }, 50);
    });
  },

  // GET /patients/{patient_id}/observations
  async getObservations(patientId: string): Promise<VitalObservation[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(generatePatientObservations(patientId));
      }, 80);
    });
  },

  // POST /ingest
  async ingestVitals(patientId: string, vitals: Partial<LatestVitals>): Promise<{ success: boolean; patient: Patient }> {
    return new Promise((resolve, reject) => {
      const idx = currentPatients.findIndex((p) => p.id === patientId);
      if (idx === -1) {
        reject(new Error(`Patient ${patientId} not found`));
        return;
      }
      const existing = currentPatients[idx];
      const updatedLatestVitals: LatestVitals = {
        ...existing.latestVitals,
        ...vitals,
        timestamp: 'Just now'
      };
      
      const updatedPatient: Patient = {
        ...existing,
        latestVitals: updatedLatestVitals
      };
      currentPatients[idx] = updatedPatient;
      resolve({ success: true, patient: updatedPatient });
    });
  },

  // GET /alerts
  async getAlerts(): Promise<ClinicalAlert[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...currentAlerts]), 50);
    });
  },

  // POST /alerts/{alert_id}/acknowledge
  async acknowledgeAlert(alertId: string, clinicianName: string = 'Dr. Evelyn Vance'): Promise<ClinicalAlert> {
    return new Promise((resolve, reject) => {
      const idx = currentAlerts.findIndex((a) => a.id === alertId);
      if (idx === -1) {
        reject(new Error(`Alert ${alertId} not found`));
        return;
      }
      const updated: ClinicalAlert = {
        ...currentAlerts[idx],
        status: 'ACKNOWLEDGED',
        acknowledgedBy: clinicianName,
        acknowledgedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      currentAlerts[idx] = updated;
      resolve(updated);
    });
  },

  // POST /alerts/{alert_id}/resolve
  async resolveAlert(alertId: string): Promise<ClinicalAlert> {
    return new Promise((resolve, reject) => {
      const idx = currentAlerts.findIndex((a) => a.id === alertId);
      if (idx === -1) {
        reject(new Error(`Alert ${alertId} not found`));
        return;
      }
      const updated: ClinicalAlert = {
        ...currentAlerts[idx],
        status: 'RESOLVED',
        resolvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      currentAlerts[idx] = updated;
      resolve(updated);
    });
  },

  // GET /patients/{patient_id}/news2
  async getNews2Score(patientId: string): Promise<{ score: number; scale: string; breakdown: Patient['news2Breakdown'] } | null> {
    const patient = currentPatients.find((p) => p.id === patientId);
    if (!patient) return null;
    return {
      score: patient.news2Score,
      scale: patient.spo2Scale === 'SCALE_2' ? 'Scale 2 (Target 88-92% for Hypercapnic Failure)' : 'Scale 1 (Standard Target ≥96%)',
      breakdown: patient.news2Breakdown
    };
  },

  // GET /patients/{patient_id}/baseline
  async getBaseline(patientId: string): Promise<PatientBaseline | null> {
    const patient = currentPatients.find((p) => p.id === patientId);
    return patient ? patient.baseline : null;
  },

  // GET /sensor-quality
  async getSensorQualityEvents(): Promise<SensorQualityEvent[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...currentSensorEvents]), 50);
    });
  },

  // POST /simulator/start
  async startSimulator(patientId: string, scenarioId: string): Promise<{ status: string; message: string }> {
    return {
      status: 'RUNNING',
      message: `Simulator active for ${patientId} under scenario ${scenarioId}`
    };
  },

  // POST /simulator/stop
  async stopSimulator(): Promise<{ status: string; message: string }> {
    return {
      status: 'STOPPED',
      message: 'Simulator halted. Telemetry returned to normal baseline stream.'
    };
  },

  // GET /performance
  async getPerformanceMetrics() {
    return {
      monitoredPatientDays: 142,
      totalClinicalAlerts: 256,
      alertsPerPatientDay: 1.8,
      detectionLeadTimeHours: 3.4,
      falseAlertReductionPercent: 82.4,
      sensitivityPercent: 96.8,
      specificityPercent: 94.2,
      truePositiveEvents: 48,
      falsePositiveEvents: 7,
      missedEvents: 1,
      naiveSystemComparison: {
        naiveAlertsPerPatientDay: 14.6,
        naiveFalseAlertRatePercent: 78.5,
        alarmFatigueRisk: 'CRITICAL',
        vitalynxAlarmFatigueRisk: 'VERY_LOW'
      }
    };
  }
};
