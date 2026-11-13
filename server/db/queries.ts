import type Database from 'better-sqlite3';
import type { Patient, EmergencyContact } from '../../src/types/patient.ts';
import type { VitalObservation } from '../../src/types/observation.ts';
import type { ClinicalAlert } from '../../src/types/alert.ts';
import type { SensorQualityEvent } from '../../src/types/sensor.ts';
import type { SymptomCheckin, EmergencyNotification } from '../../src/types/notification.ts';
import { getPatientAvatar } from '../../src/utils/patientAssets.ts';
import { mapNotificationRow } from '../services/whatsappService.ts';

export function mapPatientRow(db: Database.Database, row: any): Patient {
  const doctorRow = db
    .prepare('SELECT * FROM doctors WHERE id = ?')
    .get(row.assigned_doctor_id) as any;

  const contacts = db
    .prepare('SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY priority ASC, updated_at ASC')
    .all(row.id) as any[];

  const emergencyContacts: EmergencyContact[] = contacts.map((c) => ({
    id: c.id,
    contactType: c.contact_type,
    name: c.name,
    relationship: c.relationship,
    phone: c.phone,
    priority: c.priority
  }));

  const primaryRow = contacts.find((c) => c.contact_type === 'PRIMARY');
  const altRow = contacts.find((c) => c.contact_type === 'ALTERNATE') || contacts.find((c) => c.contact_type !== 'PRIMARY');

  const primaryEmergencyContact: EmergencyContact = primaryRow
    ? {
        id: primaryRow.id,
        contactType: primaryRow.contact_type,
        name: primaryRow.name,
        relationship: primaryRow.relationship,
        phone: primaryRow.phone,
        priority: primaryRow.priority
      }
    : { contactType: 'PRIMARY', name: 'Primary Contact', relationship: 'Caregiver', phone: '9353802577', priority: 1 };

  const alternativeEmergencyContact: EmergencyContact = altRow
    ? {
        id: altRow.id,
        contactType: altRow.contact_type,
        name: altRow.name,
        relationship: altRow.relationship,
        phone: altRow.phone,
        priority: altRow.priority
      }
    : { contactType: 'ALTERNATE', name: 'Not Assigned', relationship: 'Family', phone: '', priority: 2 };

  const rawBaseline = JSON.parse(row.baseline_json || '{}');
  let baselineRow: any = null;
  try {
    baselineRow = db.prepare('SELECT * FROM patient_baselines WHERE patient_id = ?').get(row.id) as any;
  } catch {
    baselineRow = null;
  }

  const baseline = {
    ...rawBaseline,
    heartRate: baselineRow ? Number(baselineRow.heart_rate) : Number(rawBaseline.heartRate) || 74,
    spo2: baselineRow ? Number(baselineRow.spo2) : Number(rawBaseline.spo2) || 97,
    respiratoryRate: baselineRow
      ? Number(baselineRow.respiratory_rate)
      : Number(rawBaseline.respiratoryRate) || 16,
    temperature: baselineRow ? Number(baselineRow.temperature) : Number(rawBaseline.temperature) || 36.8,
    calculatedAt: baselineRow?.updated_at || rawBaseline.calculatedAt || new Date().toISOString().slice(0, 16),
    totalObservationCount: Number(rawBaseline.totalObservationCount) || 0,
    hrDeviationThreshold: baselineRow ? Number(baselineRow.hr_deviation_threshold) : Number(rawBaseline.hrDeviationThreshold) || 8,
    spo2DeviationThreshold: baselineRow ? Number(baselineRow.spo2_deviation_threshold) : Number(rawBaseline.spo2DeviationThreshold) || 8,
    rrDeviationThreshold: baselineRow ? Number(baselineRow.rr_deviation_threshold) : Number(rawBaseline.rrDeviationThreshold) || 8,
    tempDeviationThreshold: baselineRow ? Number(baselineRow.temp_deviation_threshold) : Number(rawBaseline.tempDeviationThreshold) || 0.8,
    spo2LowSafetyLimit: baselineRow ? Number(baselineRow.spo2_low_safety_limit) : Number(rawBaseline.spo2LowSafetyLimit) || 90,
    hrHighSafetyLimit: baselineRow ? Number(baselineRow.hr_high_safety_limit) : 130,
    hrLowSafetyLimit: baselineRow ? Number(baselineRow.hr_low_safety_limit) : 40,
    rrHighSafetyLimit: baselineRow ? Number(baselineRow.rr_high_safety_limit) : 25,
    rrLowSafetyLimit: baselineRow ? Number(baselineRow.rr_low_safety_limit) : 8,
    tempHighSafetyLimit: baselineRow ? Number(baselineRow.temp_high_safety_limit) : 38.8,
    tempLowSafetyLimit: baselineRow ? Number(baselineRow.temp_low_safety_limit) : 35.0,
    updatedBy: baselineRow?.updated_by || rawBaseline.updatedBy || 'SYSTEM_SEED'
  };

  return {
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    avatarUrl: getPatientAvatar(row.id, row.avatar_url),
    dischargeDate: row.discharge_date,
    primaryDiagnosis: row.primary_diagnosis,
    medicalConditions: JSON.parse(row.medical_conditions_json),
    medications: JSON.parse(row.medications_json),
    monitoringStatus: row.monitoring_status,
    currentAlertCategory: row.current_alert_category,
    statusExplanation: row.status_explanation,
    latestVitals: JSON.parse(row.latest_vitals_json),
    spo2Scale: row.spo2_scale,
    targetSpo2Range: [row.target_spo2_min, row.target_spo2_max],
    baseline,
    personalizationNotes: row.personalization_notes,
    news2Score: row.news2_score,
    news2Breakdown: JSON.parse(row.news2_breakdown_json),
    hasSupplementalOxygen: Boolean(row.has_supplemental_oxygen),
    fhirResourceId: row.fhir_resource_id,
    roomBed: row.room_bed,
    careTeamMember: `${doctorRow?.name || 'Dr. Evelyn Vance'} (Attending Physician)`,
    assignedDoctor: doctorRow?.name || 'Dr. Evelyn Vance',
    assignedDoctorContact: {
      name: doctorRow?.name || 'Dr. Evelyn Vance',
      role: doctorRow?.role_title || 'Attending Physician',
      clinic: doctorRow?.clinic || 'BIET Memorial Hospital',
      phone: doctorRow?.phone || '9900130474',
      email: doctorRow?.email || 'dr.evelyn.vance@vitalynx.health',
      pager: doctorRow?.pager || 'PG-409'
    },
    patientPhone: row.patient_phone,
    primaryEmergencyContact,
    alternativeEmergencyContact,
    emergencyContacts
  };
}

export function getPatientById(db: Database.Database, patientId: string): Patient | null {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as any;
  if (!row) return null;
  return mapPatientRow(db, row);
}

export function getPatientsForDoctor(db: Database.Database, doctorId: string): Patient[] {
  const rows = db
    .prepare('SELECT * FROM patients WHERE assigned_doctor_id = ? ORDER BY id ASC')
    .all(doctorId) as any[];
  return rows.map((r) => mapPatientRow(db, r));
}

export function getObservationsForPatient(
  db: Database.Database,
  patientId: string,
  limit = 100
): VitalObservation[] {
  const rows = db
    .prepare('SELECT * FROM vital_observations WHERE patient_id = ? ORDER BY timestamp ASC LIMIT ?')
    .all(patientId, limit) as any[];
  return rows.map((r) => {
    let baselineComparison = null;
    if (r.baseline_comparison_json) {
      try {
        baselineComparison = JSON.parse(r.baseline_comparison_json);
      } catch {
        baselineComparison = null;
      }
    }
    return {
      id: r.id,
      patientId: r.patient_id,
      timestamp: r.timestamp,
      timeLabel: r.time_label,
      heartRate: r.heart_rate,
      spo2: r.spo2,
      respiratoryRate: r.respiratory_rate,
      temperature: r.temperature,
      sensorQuality: r.sensor_quality,
      news2Score: r.news2_score,
      alertCategory: r.alert_category,
      emergencyStatus: r.emergency_status || (r.alert_category === 'URGENT' ? 'EMERGENCY' : 'NORMAL'),
      baselineComparison,
      isSimulated: Boolean(r.is_simulated)
    };
  });
}

export function mapAlertRow(row: any): ClinicalAlert & { aiExplanation?: string | null } {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    alertLevel: row.alert_level,
    vitalSignReading: row.vital_sign_reading,
    parameter: row.parameter,
    timestamp: row.timestamp,
    ruleApplied: row.rule_applied,
    patientMedicalInfo: row.patient_medical_info,
    sensorQualityStatus: row.sensor_quality_status,
    explanation: row.explanation,
    suggestedAction: row.suggested_action,
    aiExplanation: row.ai_explanation || null,
    status: row.status,
    acknowledgedBy: row.acknowledged_by || undefined,
    acknowledgedAt: row.acknowledged_at || undefined,
    resolvedAt: row.resolved_at || undefined
  };
}

export function getSensorQualityEventsForDoctor(db: Database.Database, doctorId: string): SensorQualityEvent[] {
  const rows = db
    .prepare(`
      SELECT sq.*
      FROM sensor_quality_events sq
      JOIN patients p ON p.id = sq.patient_id
      WHERE p.assigned_doctor_id = ?
      ORDER BY sq.timestamp DESC
    `)
    .all(doctorId) as any[];

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    timestamp: r.timestamp,
    artifactType: r.artifact_type,
    affectedVital: r.affected_vital,
    sensorType: r.sensor_type,
    qualityState: r.quality_state,
    signalStatus: r.signal_status,
    rawReading: 'Persisted sensor telemetry diagnostic log',
    explanation: r.explanation,
    clinicalImpactPrevented: r.clinical_impact_prevented,
    confidenceScore: 98.5,
    durationSeconds: 180
  }));
}

export function getCheckinsForPatient(db: Database.Database, patientId: string): SymptomCheckin[] {
  const rows = db
    .prepare('SELECT * FROM symptom_checkins WHERE patient_id = ? ORDER BY submitted_at DESC')
    .all(patientId) as any[];
  return rows.map((r) => ({
    id: r.id,
    patientId: r.patient_id,
    dyspneaScore: r.dyspnea_score,
    dizziness: Boolean(r.dizziness),
    feverChills: Boolean(r.fever_chills),
    fatigueScore: r.fatigue_score,
    notes: r.notes || '',
    submittedAt: r.submitted_at
  }));
}

export function getNotificationsForUser(
  db: Database.Database,
  user: { role: 'DOCTOR' | 'PATIENT'; doctorId: string | null; patientId: string | null },
  filterPatientId?: string
): EmergencyNotification[] {
  if (user.role === 'PATIENT') {
    const pid = user.patientId || '';
    if (filterPatientId && filterPatientId !== pid) {
      return [];
    }
    const rows = db
      .prepare(`
        SELECT n.*, p.name as patient_name
        FROM notifications n
        JOIN patients p ON p.id = n.patient_id
        WHERE n.patient_id = ?
        ORDER BY n.created_at DESC
        LIMIT 100
      `)
      .all(pid) as any[];
    return rows.map(mapNotificationRow);
  }

  const rows = filterPatientId
    ? (db
        .prepare(`
          SELECT n.*, p.name as patient_name
          FROM notifications n
          JOIN patients p ON p.id = n.patient_id
          WHERE p.assigned_doctor_id = ? AND n.patient_id = ?
          ORDER BY n.created_at DESC
          LIMIT 100
        `)
        .all(user.doctorId, filterPatientId) as any[])
    : (db
        .prepare(`
          SELECT n.*, p.name as patient_name
          FROM notifications n
          JOIN patients p ON p.id = n.patient_id
          WHERE p.assigned_doctor_id = ?
          ORDER BY n.created_at DESC
          LIMIT 100
        `)
        .all(user.doctorId) as any[]);

  return rows.map(mapNotificationRow);
}
