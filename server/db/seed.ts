import bcrypt from 'bcryptjs';
import type Database from 'better-sqlite3';
import { MOCK_PATIENTS, DR_EVELYN_VANCE_CONTACT } from '../../src/data/mockPatients.ts';
import { MOCK_ALERTS } from '../../src/data/mockAlerts.ts';
import { generatePatientObservations } from '../../src/data/mockObservations.ts';
import { MOCK_SENSOR_EVENTS } from '../../src/data/mockSensorEvents.ts';
import { DOCTOR_AVATAR, getPatientAvatar } from '../../src/utils/patientAssets.ts';

export const LOINC_CODES = {
  HEART_RATE: '8867-4',
  SPO2: '2708-6',
  RESPIRATORY_RATE: '9279-1',
  TEMPERATURE: '8310-5'
} as const;

export function seedDatabaseIfEmpty(db: Database.Database): void {
  const docCount = (db.prepare('SELECT COUNT(*) as cnt FROM doctors').get() as { cnt: number }).cnt;
  if (docCount > 0) {
    // Ensure updated demo phone numbers and avatars stay in sync even on existing DBs
    db.prepare('UPDATE doctors SET phone = ?, avatar_url = ? WHERE id = ?').run(
      '9900130474',
      DOCTOR_AVATAR,
      'DOC-EVANCE'
    );
    return;
  }

  const tx = db.transaction(() => {
    const doctorPassHash = bcrypt.hashSync('ClinicalAdmin#2026', 10);

    // 1. Seed Primary Attending Doctor (Dr. Evelyn Vance) + Secondary Unassigned Doctor for RBAC tests
    db.prepare(`
      INSERT INTO doctors (id, name, role_title, clinic, phone, email, pager, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'DOC-EVANCE',
      DR_EVELYN_VANCE_CONTACT.name,
      DR_EVELYN_VANCE_CONTACT.role,
      DR_EVELYN_VANCE_CONTACT.clinic,
      '9900130474',
      'dr.evelyn.vance@vitalynx.health',
      DR_EVELYN_VANCE_CONTACT.pager || 'PG-409',
      DOCTOR_AVATAR
    );

    db.prepare(`
      INSERT INTO doctors (id, name, role_title, clinic, phone, email, pager, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'DOC-MTHORNE',
      'Dr. Marcus Thorne',
      'Visiting Pulmonologist',
      'BIET Memorial Hospital – North Wing',
      '9900130499',
      'dr.marcus.thorne@vitalynx.health',
      'PG-512',
      DOCTOR_AVATAR
    );

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, doctor_id, patient_id)
      VALUES (?, ?, ?, 'DOCTOR', ?, ?, NULL)
    `).run(
      'USR-DOC-EVANCE',
      'dr.evelyn.vance@vitalynx.health',
      doctorPassHash,
      'Dr. Evelyn Vance',
      'DOC-EVANCE'
    );

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, doctor_id, patient_id)
      VALUES (?, ?, ?, 'DOCTOR', ?, ?, NULL)
    `).run(
      'USR-DOC-MTHORNE',
      'dr.marcus.thorne@vitalynx.health',
      doctorPassHash,
      'Dr. Marcus Thorne',
      'DOC-MTHORNE'
    );

    // 2. Seed Patients, Patient User Accounts, Emergency Contacts, Observations
    const insertPatient = db.prepare(`
      INSERT INTO patients (
        id, name, age, gender, avatar_url, discharge_date, primary_diagnosis,
        medical_conditions_json, medications_json, monitoring_status, current_alert_category,
        status_explanation, spo2_scale, target_spo2_min, target_spo2_max,
        baseline_json, personalization_notes, news2_score, news2_breakdown_json,
        has_supplemental_oxygen, fhir_resource_id, room_bed, assigned_doctor_id,
        patient_phone, latest_vitals_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertUser = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, name, doctor_id, patient_id)
      VALUES (?, ?, ?, 'PATIENT', ?, NULL, ?)
    `);

    const insertContact = db.prepare(`
      INSERT INTO emergency_contacts (id, patient_id, contact_type, name, relationship, phone, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertBaseline = db.prepare(`
      INSERT OR IGNORE INTO patient_baselines (
        patient_id, heart_rate, spo2, respiratory_rate, temperature,
        hr_deviation_threshold, spo2_deviation_threshold, rr_deviation_threshold, temp_deviation_threshold,
        spo2_low_safety_limit, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYSTEM_SEED')
    `);

    const insertObs = db.prepare(`
      INSERT INTO vital_observations (
        id, patient_id, timestamp, time_label, heart_rate, spo2, respiratory_rate,
        temperature, blood_pressure, sensor_quality, news2_score, alert_category,
        loinc_hr_code, loinc_spo2_code, loinc_rr_code, loinc_temp_code,
        fhir_observation_id, data_source, is_simulated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of MOCK_PATIENTS) {
      const avatarUrl = getPatientAvatar(p.id, p.avatarUrl);
      insertPatient.run(
        p.id,
        p.name,
        p.age,
        p.gender,
        avatarUrl,
        p.dischargeDate,
        p.primaryDiagnosis,
        JSON.stringify(p.medicalConditions),
        JSON.stringify(p.medications),
        p.monitoringStatus,
        p.currentAlertCategory,
        p.statusExplanation || '',
        p.spo2Scale,
        p.targetSpo2Range[0],
        p.targetSpo2Range[1],
        JSON.stringify(p.baseline),
        p.personalizationNotes,
        p.news2Score,
        JSON.stringify(p.news2Breakdown),
        p.hasSupplementalOxygen ? 1 : 0,
        p.fhirResourceId,
        p.roomBed || '',
        'DOC-EVANCE',
        '7259821416',
        JSON.stringify(p.latestVitals)
      );

      insertBaseline.run(
        p.id,
        p.baseline.heartRate,
        p.baseline.spo2,
        p.baseline.respiratoryRate,
        p.baseline.temperature,
        p.baseline.hrDeviationThreshold ?? 8,
        p.baseline.spo2DeviationThreshold ?? 8,
        p.baseline.rrDeviationThreshold ?? 8,
        p.baseline.tempDeviationThreshold ?? 0.8,
        p.baseline.spo2LowSafetyLimit ?? 90
      );

      const numericPart = p.id.replace('PT-', '');
      const patientEmail = `${p.name.toLowerCase().replace(/\s+/g, '.')}@patient.vitalynx.health`;
      const patientPassHash = bcrypt.hashSync(`Patient#${numericPart}`, 10);
      insertUser.run(`USR-${p.id}`, patientEmail, patientPassHash, p.name, p.id);

      insertContact.run(
        `EC-${p.id}-PRIMARY`,
        p.id,
        'PRIMARY',
        p.primaryEmergencyContact.name,
        p.primaryEmergencyContact.relationship,
        p.primaryEmergencyContact.phone || '9353802577',
        1
      );

      insertContact.run(
        `EC-${p.id}-ALTERNATE`,
        p.id,
        'ALTERNATE',
        p.alternativeEmergencyContact.name,
        p.alternativeEmergencyContact.relationship,
        p.alternativeEmergencyContact.phone,
        2
      );

      const observations = generatePatientObservations(p.id);
      for (const obs of observations) {
        insertObs.run(
          obs.id,
          obs.patientId,
          obs.timestamp,
          obs.timeLabel,
          obs.heartRate,
          obs.spo2,
          obs.respiratoryRate,
          obs.temperature,
          p.latestVitals.bloodPressure || '120/78',
          obs.sensorQuality,
          obs.news2Score,
          obs.sensorQuality === 'VALID' ? p.currentAlertCategory : 'OFFLINE',
          LOINC_CODES.HEART_RATE,
          LOINC_CODES.SPO2,
          LOINC_CODES.RESPIRATORY_RATE,
          LOINC_CODES.TEMPERATURE,
          `urn:uuid:obs-${obs.id}`,
          'BIDMC PhysioNet (HR/SpO2/RR) + Virtual Wearable Simulator (Temp)',
          obs.isSimulated ? 1 : 0
        );
      }
    }

    // 3. Seed Alerts
    const insertAlert = db.prepare(`
      INSERT INTO alerts (
        id, patient_id, patient_name, alert_level, vital_sign_reading, parameter,
        timestamp, rule_applied, patient_medical_info, sensor_quality_status,
        explanation, suggested_action, status, acknowledged_by, acknowledged_at, resolved_at, cooldown_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of MOCK_ALERTS) {
      insertAlert.run(
        a.id,
        a.patientId,
        a.patientName,
        a.alertLevel,
        a.vitalSignReading,
        a.parameter,
        a.timestamp,
        a.ruleApplied,
        a.patientMedicalInfo,
        a.sensorQualityStatus,
        a.explanation,
        a.suggestedAction,
        a.status,
        a.acknowledgedBy || null,
        a.acknowledgedAt || null,
        a.resolvedAt || null,
        `${a.patientId}:${a.alertLevel}:${a.parameter}`
      );
    }

    // 4. Seed Sensor Quality Events
    const insertSensor = db.prepare(`
      INSERT INTO sensor_quality_events (
        id, patient_id, patient_name, timestamp, artifact_type, affected_vital,
        sensor_type, quality_state, signal_status, explanation, clinical_impact_prevented
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ev of MOCK_SENSOR_EVENTS) {
      insertSensor.run(
        ev.id,
        ev.patientId,
        ev.patientName,
        ev.timestamp,
        ev.artifactType,
        ev.affectedVital,
        ev.sensorType,
        ev.qualityState,
        ev.signalStatus,
        ev.explanation,
        ev.clinicalImpactPrevented
      );
    }

    // 5. Real SMS notifications are only created by genuine clinical threshold breaches or authorized test dispatches (never seeded with fake status)

    // 6. Seed initial symptom check-ins
    db.prepare(`
      INSERT INTO symptom_checkins (id, patient_id, dyspnea_score, dizziness, fever_chills, fatigue_score, notes, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'CHK-8021-01',
      'PT-8021',
      2,
      0,
      0,
      3,
      'Mild exertional shortness of breath during morning walk; settled within 5 minutes at 1.5L O2.',
      '2026-11-11T09:15:00Z'
    );

    db.prepare(`
      INSERT INTO symptom_checkins (id, patient_id, dyspnea_score, dizziness, fever_chills, fatigue_score, notes, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'CHK-8024-01',
      'PT-8024',
      7,
      1,
      1,
      8,
      'Increasing breathlessness when speaking and feeling feverish this evening.',
      '2026-11-11T22:40:00Z'
    );
  });

  tx();
  console.log('[DB] Seeded VITALYNX database with clinical cohort, users, observations, alerts, and notifications.');
}
