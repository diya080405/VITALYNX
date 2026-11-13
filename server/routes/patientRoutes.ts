import { Router } from 'express';
import { getDb } from '../db/database.ts';
import { authenticateToken, requireDoctor, verifyPatientAccess, type AuthenticatedRequest } from '../middleware/auth.ts';
import {
  getPatientById,
  getPatientsForDoctor,
  getObservationsForPatient,
  getCheckinsForPatient,
  mapAlertRow
} from '../db/queries.ts';
import { evaluateClinicalDeterioration, getClinicalThresholds } from '../services/alertEngine.ts';
import { prepareWhatsAppAlertsForEmergency } from '../services/whatsappService.ts';
import { detectPatientAbnormalVitals } from '../../src/utils/emergencyWhatsAppBuilder.ts';
import { wsHub } from '../ws/wsServer.ts';
import { formatPhoneE164, validatePhoneInput } from '../../src/utils/patientAssets.ts';
import type { LatestVitals } from '../../src/types/patient.ts';

export const patientRouter = Router();

patientRouter.use(authenticateToken);

// List patients authorized for current user
patientRouter.get('/', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;
  if (user.role === 'PATIENT') {
    const patient = user.patientId ? getPatientById(db, user.patientId) : null;
    res.json(patient ? [patient] : []);
    return;
  }
  const patients = getPatientsForDoctor(db, user.doctorId || '');
  res.json(patients);
});

// Get single patient details (strictly RBAC-checked)
patientRouter.get('/:id', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to access this patient record.' });
    return;
  }
  const patient = getPatientById(getDb(), patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  res.json(patient);
});

// List all emergency contacts for a patient
patientRouter.get('/:id/emergency-contacts', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to view contacts for this patient.' });
    return;
  }
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  const rows = db
    .prepare('SELECT * FROM emergency_contacts WHERE patient_id = ? ORDER BY priority ASC, updated_at ASC')
    .all(patientId) as any[];
  res.json(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      contactType: r.contact_type,
      name: r.name,
      relationship: r.relationship,
      phone: r.phone,
      priority: r.priority,
      updatedAt: r.updated_at
    }))
  );
});

// Add a new emergency contact for a patient
patientRouter.post('/:id/emergency-contacts', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to update this patient.' });
    return;
  }

  const { name, relationship, phone } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanRelation = String(relationship || '').trim();
  const cleanPhone = String(phone || '').trim();

  if (cleanName.length < 2) {
    res.status(400).json({ error: 'Contact name must be at least 2 characters.' });
    return;
  }
  if (cleanRelation.length < 2) {
    res.status(400).json({ error: 'Relationship is required (e.g. Spouse, Sibling, Caregiver).' });
    return;
  }
  const phoneCheck = validatePhoneInput(cleanPhone);
  if (!phoneCheck.valid) {
    res.status(400).json({ error: phoneCheck.error || 'Invalid phone number format.' });
    return;
  }

  const db = getDb();
  const patientExists = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
  if (!patientExists) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const existingContacts = db
    .prepare('SELECT id, contact_type, phone, priority FROM emergency_contacts WHERE patient_id = ? ORDER BY priority ASC')
    .all(patientId) as Array<{ id: string; contact_type: string; phone: string; priority: number }>;

  if (existingContacts.some((c) => formatPhoneE164(c.phone) === phoneCheck.normalized)) {
    res.status(409).json({ error: 'An emergency contact with this phone number is already saved for this patient.' });
    return;
  }

  const hasAlternate = existingContacts.some((c) => c.contact_type === 'ALTERNATE');
  const nextType = hasAlternate ? 'ADDITIONAL' : 'ALTERNATE';
  const maxPriority = existingContacts.reduce((max, c) => Math.max(max, c.priority), 1);
  const nextPriority = nextType === 'ALTERNATE' ? 2 : Math.max(3, maxPriority + 1);
  const contactId = `EC-${patientId}-${Date.now().toString(36).toUpperCase()}`;

  db.prepare(`
    INSERT INTO emergency_contacts (id, patient_id, contact_type, name, relationship, phone, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(contactId, patientId, nextType, cleanName, cleanRelation, cleanPhone, nextPriority);

  const createdRow = db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(contactId) as any;
  const updatedPatient = getPatientById(db, patientId);
  wsHub.broadcastForPatient(patientId, 'patient:updated', updatedPatient);

  res.status(201).json({
    contact: {
      id: createdRow.id,
      patientId: createdRow.patient_id,
      contactType: createdRow.contact_type,
      name: createdRow.name,
      relationship: createdRow.relationship,
      phone: createdRow.phone,
      priority: createdRow.priority
    },
    patient: updatedPatient
  });
});

// Update alternative emergency contact independently (preserves legacy route compatibility)
patientRouter.put('/:id/emergency-contacts/alternate', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to update this patient.' });
    return;
  }
  const { name, relationship, phone } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanRelation = String(relationship || '').trim();
  const cleanPhone = String(phone || '').trim();

  if (cleanName.length < 2 || cleanRelation.length < 2 || !cleanPhone) {
    res.status(400).json({ error: 'Name, relationship, and phone are required.' });
    return;
  }
  const phoneCheck = validatePhoneInput(cleanPhone);
  if (!phoneCheck.valid) {
    res.status(400).json({ error: phoneCheck.error || 'Invalid phone number format.' });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM emergency_contacts WHERE patient_id = ? AND contact_type = 'ALTERNATE'")
    .get(patientId);

  if (existing) {
    db.prepare(`
      UPDATE emergency_contacts
      SET name = ?, relationship = ?, phone = ?, updated_at = datetime('now')
      WHERE patient_id = ? AND contact_type = 'ALTERNATE'
    `).run(cleanName, cleanRelation, cleanPhone, patientId);
  } else {
    db.prepare(`
      INSERT INTO emergency_contacts (id, patient_id, contact_type, name, relationship, phone, priority)
      VALUES (?, ?, 'ALTERNATE', ?, ?, ?, 2)
    `).run(`EC-${patientId}-ALTERNATE`, patientId, cleanName, cleanRelation, cleanPhone);
  }

  const updatedPatient = getPatientById(db, patientId);
  wsHub.broadcastForPatient(patientId, 'patient:updated', updatedPatient);
  res.json(updatedPatient);
});

// Edit any specific emergency contact by contactId
patientRouter.put('/:id/emergency-contacts/:contactId', (req: AuthenticatedRequest, res) => {
  const { id: patientId, contactId } = req.params;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to update this patient.' });
    return;
  }

  const { name, relationship, phone } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanRelation = String(relationship || '').trim();
  const cleanPhone = String(phone || '').trim();

  if (cleanName.length < 2 || cleanRelation.length < 2) {
    res.status(400).json({ error: 'Valid contact name and relationship are required.' });
    return;
  }
  const phoneCheck = validatePhoneInput(cleanPhone);
  if (!phoneCheck.valid) {
    res.status(400).json({ error: phoneCheck.error || 'Invalid phone number format.' });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM emergency_contacts WHERE id = ? AND patient_id = ?')
    .get(contactId, patientId) as any;

  if (!existing) {
    res.status(404).json({ error: 'Emergency contact not found.' });
    return;
  }

  db.prepare(`
    UPDATE emergency_contacts
    SET name = ?, relationship = ?, phone = ?, updated_at = datetime('now')
    WHERE id = ? AND patient_id = ?
  `).run(cleanName, cleanRelation, cleanPhone, contactId, patientId);

  const updatedRow = db.prepare('SELECT * FROM emergency_contacts WHERE id = ?').get(contactId) as any;
  const updatedPatient = getPatientById(db, patientId);
  wsHub.broadcastForPatient(patientId, 'patient:updated', updatedPatient);

  res.json({
    contact: {
      id: updatedRow.id,
      patientId: updatedRow.patient_id,
      contactType: updatedRow.contact_type,
      name: updatedRow.name,
      relationship: updatedRow.relationship,
      phone: updatedRow.phone,
      priority: updatedRow.priority
    },
    patient: updatedPatient
  });
});

// Delete a non-primary emergency contact
patientRouter.delete('/:id/emergency-contacts/:contactId', (req: AuthenticatedRequest, res) => {
  const { id: patientId, contactId } = req.params;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: You are not authorized to update this patient.' });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM emergency_contacts WHERE id = ? AND patient_id = ?')
    .get(contactId, patientId) as any;

  if (!existing) {
    res.status(404).json({ error: 'Emergency contact not found.' });
    return;
  }

  if (existing.contact_type === 'PRIMARY') {
    res.status(400).json({
      error: 'The Primary Emergency Contact cannot be deleted because an active hotline is required. You can edit its details instead.'
    });
    return;
  }

  db.prepare('DELETE FROM emergency_contacts WHERE id = ? AND patient_id = ?').run(contactId, patientId);

  const updatedPatient = getPatientById(db, patientId);
  wsHub.broadcastForPatient(patientId, 'patient:updated', updatedPatient);
  res.json({ deletedId: contactId, patient: updatedPatient });
});

// Get patient observations
patientRouter.get('/:id/observations', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const limit = Number(req.query.limit) || 100;
  res.json(getObservationsForPatient(getDb(), patientId, Math.min(limit, 500)));
});

// Alias /vitals GET
patientRouter.get('/:id/vitals', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const limit = Number(req.query.limit) || 100;
  res.json(getObservationsForPatient(getDb(), patientId, Math.min(limit, 500)));
});

// Ingest new vitals observation, run personalized alert engine + artifact gate, and trigger emergency SMS if URGENT & VALID
patientRouter.post('/:id/vitals', async (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const db = getDb();
  const patient = getPatientById(db, patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const body = req.body || {};
  const now = new Date();
  const timeLabel = now.toISOString().slice(11, 16);
  const timestampIso = now.toISOString();

  const nextVitals: LatestVitals = {
    heartRate: body.heartRate !== undefined ? Number(body.heartRate) : patient.latestVitals.heartRate,
    previousHeartRate: patient.latestVitals.heartRate,
    spo2: body.spo2 !== undefined ? Number(body.spo2) : patient.latestVitals.spo2,
    previousSpo2: patient.latestVitals.spo2,
    respiratoryRate:
      body.respiratoryRate !== undefined ? Number(body.respiratoryRate) : patient.latestVitals.respiratoryRate,
    previousRespiratoryRate: patient.latestVitals.respiratoryRate,
    temperature: body.temperature !== undefined ? Number(body.temperature) : patient.latestVitals.temperature,
    previousTemperature: patient.latestVitals.temperature,
    bloodPressure: body.bloodPressure || patient.latestVitals.bloodPressure,
    timestamp: body.timestampLabel || `${timeLabel} UTC`,
    sensorQuality: body.sensorQuality || 'VALID'
  };

  const thresholds = getClinicalThresholds(db);
  const decision = evaluateClinicalDeterioration(patient, nextVitals, thresholds);
  const monitoringStatus = nextVitals.sensorQuality === 'VALID' ? 'ACTIVE' : 'DISCONNECTED';

  const obsId = `obs-${patientId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const isSimulated = Boolean(body.isSimulated);
  const emergencyStatus =
    nextVitals.sensorQuality !== 'VALID'
      ? 'ARTIFACT_SUPPRESSED'
      : decision.alertCategory === 'URGENT'
      ? `EMERGENCY (${decision.triggeredEvents.map((e) => e.parameterLabel).join(', ') || decision.parameter})`
      : decision.alertCategory;

  const baselineComparisonJson = JSON.stringify({
    baseline: {
      heartRate: patient.baseline.heartRate,
      spo2: patient.baseline.spo2,
      respiratoryRate: patient.baseline.respiratoryRate,
      temperature: patient.baseline.temperature
    },
    deltas: {
      heartRate: Number((nextVitals.heartRate - patient.baseline.heartRate).toFixed(1)),
      spo2: Number((nextVitals.spo2 - patient.baseline.spo2).toFixed(1)),
      respiratoryRate: Number((nextVitals.respiratoryRate - patient.baseline.respiratoryRate).toFixed(1)),
      temperature: Number((nextVitals.temperature - patient.baseline.temperature).toFixed(1))
    },
    triggeredParameters: decision.triggeredEvents.map((e) => e.parameterLabel)
  });

  db.prepare(`
    INSERT INTO vital_observations (
      id, patient_id, timestamp, time_label, heart_rate, spo2, respiratory_rate,
      temperature, blood_pressure, sensor_quality, news2_score, alert_category,
      fhir_observation_id, data_source, baseline_comparison_json, emergency_status, is_simulated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    obsId,
    patientId,
    timestampIso,
    timeLabel,
    nextVitals.heartRate,
    nextVitals.spo2,
    nextVitals.respiratoryRate,
    nextVitals.temperature,
    nextVitals.bloodPressure || '120/78',
    nextVitals.sensorQuality,
    decision.news2Evaluation.totalScore,
    decision.alertCategory,
    `urn:uuid:obs-${obsId}`,
    isSimulated
      ? 'Virtual Wearable Simulator (Controlled Deterioration/Artifact Test)'
      : 'BIDMC PhysioNet (HR/SpO2/RR) + Virtual Wearable Simulator (Temp)',
    baselineComparisonJson,
    emergencyStatus,
    isSimulated ? 1 : 0
  );

  db.prepare(`
    UPDATE patients
    SET latest_vitals_json = ?,
        current_alert_category = ?,
        monitoring_status = ?,
        status_explanation = ?,
        news2_score = ?,
        news2_breakdown_json = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    JSON.stringify(nextVitals),
    decision.alertCategory,
    monitoringStatus,
    decision.statusExplanation,
    decision.news2Evaluation.totalScore,
    JSON.stringify(decision.news2Evaluation.breakdown),
    patientId
  );

  // If non-VALID signal quality, record artifact log and skip clinical alert/SMS
  if (nextVitals.sensorQuality !== 'VALID') {
    const sqId = `SQ-${Date.now()}`;
    db.prepare(`
      INSERT INTO sensor_quality_events (
        id, patient_id, patient_name, timestamp, artifact_type, affected_vital,
        sensor_type, quality_state, signal_status, explanation, clinical_impact_prevented
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sqId,
      patientId,
      patient.name,
      timestampIso.slice(0, 16).replace('T', ' '),
      nextVitals.sensorQuality,
      'Pulse Oximetry & Respiratory Impedance',
      'WEARABLE_PPG_BAND',
      nextVitals.sensorQuality,
      nextVitals.sensorQuality === 'PROBE_REMOVED' ? 'REMOVED' : 'DEGRADED',
      decision.explanation,
      'Suppressed false clinical escalation and prevented erroneous emergency SMS.'
    );
  }

  const createdOrUpdatedAlerts: any[] = [];
  const smsNotifications: any[] = [];
  const suppressionNotes: string[] = [];
  const formattedTs = `${timestampIso.slice(0, 16).replace('T', ' ')} UTC`;
  const patientRaw = db.prepare('SELECT assigned_doctor_id FROM patients WHERE id = ?').get(patientId) as any;
  const doctorId = patientRaw?.assigned_doctor_id || 'DOC-EVANCE';

  if (decision.shouldCreateAlert && decision.alertLevel) {
    if (decision.triggeredEvents && decision.triggeredEvents.length > 0) {
      const dispatchAlertIds: string[] = [];
      let hasEscalation = false;

      // Process each triggered event independently for clinical alerts (e.g., Deviation breach + SpO2 < 90% safety alert)
      for (let idx = 0; idx < decision.triggeredEvents.length; idx++) {
        const ev = decision.triggeredEvents[idx];
        const activeAlert = db
          .prepare(`
            SELECT * FROM alerts
            WHERE patient_id = ?
              AND cooldown_key = ?
              AND status IN ('ACTIVE', 'ACKNOWLEDGED')
            ORDER BY created_at DESC
            LIMIT 1
          `)
          .get(patientId, ev.cooldownKey) as any;

        if (activeAlert) {
          const prevMag = Number(activeAlert.max_deviation_magnitude || 0);
          const isWorsened = ev.deviationMagnitude > prevMag + 0.05;

          if (isWorsened) {
            db.prepare(`
              UPDATE alerts
              SET vital_sign_reading = ?,
                  timestamp = ?,
                  rule_applied = ?,
                  explanation = ?,
                  reading_signature = ?,
                  max_deviation_magnitude = ?,
                  baseline_value = ?,
                  current_value = ?,
                  deviation_value = ?
              WHERE id = ?
            `).run(
              decision.vitalSignReading,
              formattedTs,
              `${ev.ruleApplied} [ESCALATED]`,
              `${ev.explanation} Condition worsened (deviation increased from ${prevMag} to ${ev.deviationMagnitude}).`,
              ev.readingSignature,
              ev.deviationMagnitude,
              ev.baselineDisplay,
              ev.currentDisplay,
              ev.deviationDisplay,
              activeAlert.id
            );

            const updatedAlertRow = db.prepare('SELECT * FROM alerts WHERE id = ?').get(activeAlert.id);
            const mappedAlert = mapAlertRow(updatedAlertRow);
            createdOrUpdatedAlerts.push(mappedAlert);
            wsHub.broadcastForPatient(patientId, 'alert:updated', mappedAlert);
            dispatchAlertIds.push(activeAlert.id);
            hasEscalation = true;
          } else {
            createdOrUpdatedAlerts.push(mapAlertRow(activeAlert));
            suppressionNotes.push(
              `Duplicate WhatsApp alert suppressed for unchanged ${ev.parameterLabel} event (deviation ${ev.deviationMagnitude} <= active ${prevMag}).`
            );
          }
        } else {
          const alertId = `ALT-${Date.now().toString().slice(-6)}-${idx + 1}`;
          db.prepare(`
            INSERT INTO alerts (
              id, patient_id, patient_name, alert_level, vital_sign_reading, parameter,
              timestamp, rule_applied, patient_medical_info, sensor_quality_status,
              explanation, suggested_action, status, cooldown_key,
              reading_signature, max_deviation_magnitude, baseline_value, current_value, deviation_value
            ) VALUES (?, ?, ?, 'URGENT', ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)
          `).run(
            alertId,
            patientId,
            patient.name,
            decision.vitalSignReading,
            ev.parameter,
            formattedTs,
            ev.ruleApplied,
            `${patient.primaryDiagnosis}; ${patient.spo2Scale} (Target ${patient.targetSpo2Range[0]}-${patient.targetSpo2Range[1]}%)`,
            nextVitals.sensorQuality,
            ev.explanation,
            decision.suggestedAction,
            ev.cooldownKey,
            ev.readingSignature,
            ev.deviationMagnitude,
            ev.baselineDisplay,
            ev.currentDisplay,
            ev.deviationDisplay
          );

          const insertedAlertRow = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
          const mappedAlert = mapAlertRow(insertedAlertRow);
          createdOrUpdatedAlerts.push(mappedAlert);
          wsHub.broadcastForPatient(patientId, 'alert:created', mappedAlert);
          dispatchAlertIds.push(alertId);
        }
      }

      if (dispatchAlertIds.length > 0) {
        const detectedAbnormals = detectPatientAbnormalVitals({
          id: patient.id,
          name: patient.name,
          baseline: patient.baseline,
          latestVitals: nextVitals
        });
        const abnormals =
          detectedAbnormals.valid && detectedAbnormals.abnormals.length > 0
            ? detectedAbnormals.abnormals
            : undefined;
        const ev0 = decision.triggeredEvents[0];
        const dispatched = await prepareWhatsAppAlertsForEmergency(
          db,
          {
            alertId: dispatchAlertIds[0],
            patientId,
            patientName: patient.name,
            doctorId,
            vitalSignReading: decision.vitalSignReading,
            timestamp: timestampIso,
            abnormalParameter: abnormals ? abnormals.map((a) => a.label).join(', ') : ev0.parameterLabel,
            baselineValue: ev0.baselineDisplay,
            currentValue: ev0.currentDisplay,
            deviationValue: hasEscalation ? `${ev0.deviationDisplay} (Escalated)` : ev0.deviationDisplay,
            abnormals,
            idempotencySuffix: hasEscalation ? `ESC-${obsId}` : obsId,
            vitals: {
              spo2: nextVitals.spo2,
              respiratoryRate: nextVitals.respiratoryRate,
              heartRate: nextVitals.heartRate,
              temperature: nextVitals.temperature
            }
          },
          (notif) => wsHub.broadcastForPatient(patientId, 'notification:updated', notif)
        );
        smsNotifications.push(...dispatched);
      }
    } else {
      const cooldownKey = `${patientId}:${decision.alertLevel}:${decision.parameter}`;
      const cooldownModifier = `-${Math.max(1, Math.round(thresholds.alertCooldownMinutes || 15))} minutes`;
      const activeCooldown = db
        .prepare(`
          SELECT * FROM alerts
          WHERE patient_id = ?
            AND (
              cooldown_key = ?
              OR (alert_level = 'URGENT' AND ? = 'URGENT' AND status IN ('ACTIVE', 'ACKNOWLEDGED'))
            )
            AND status IN ('ACTIVE', 'ACKNOWLEDGED')
            AND datetime(created_at) >= datetime('now', ?)
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .get(patientId, cooldownKey, decision.alertLevel, cooldownModifier) as any;

      const curMag = Number(decision.deviationMagnitude || 0);
      if (activeCooldown && !(decision.alertLevel === 'URGENT' && curMag > Number(activeCooldown.max_deviation_magnitude || 0) + 0.05)) {
        createdOrUpdatedAlerts.push(mapAlertRow(activeCooldown));
        suppressionNotes.push(
          `Active alert cooldown (${thresholds.alertCooldownMinutes}m) prevented duplicate WhatsApp alert.`
        );
      } else {
        const alertId = `ALT-${Date.now().toString().slice(-6)}`;
        db.prepare(`
          INSERT INTO alerts (
            id, patient_id, patient_name, alert_level, vital_sign_reading, parameter,
            timestamp, rule_applied, patient_medical_info, sensor_quality_status,
            explanation, suggested_action, status, cooldown_key,
            max_deviation_magnitude, baseline_value, current_value, deviation_value
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
        `).run(
          alertId,
          patientId,
          patient.name,
          decision.alertLevel,
          decision.vitalSignReading,
          decision.parameter,
          formattedTs,
          decision.ruleApplied,
          `${patient.primaryDiagnosis}; ${patient.spo2Scale} (Target ${patient.targetSpo2Range[0]}-${patient.targetSpo2Range[1]}%)`,
          nextVitals.sensorQuality,
          decision.explanation,
          decision.suggestedAction,
          cooldownKey,
          curMag,
          decision.baselineDisplay || null,
          decision.currentDisplay || null,
          decision.deviationDisplay || null
        );

        const insertedAlertRow = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
        const mappedAlert = mapAlertRow(insertedAlertRow);
        createdOrUpdatedAlerts.push(mappedAlert);
        wsHub.broadcastForPatient(patientId, 'alert:created', mappedAlert);

        if (decision.shouldTriggerEmergencySms) {
          const dispatched = await prepareWhatsAppAlertsForEmergency(
            db,
            {
              alertId,
              patientId,
              patientName: patient.name,
              doctorId,
              vitalSignReading: decision.vitalSignReading,
              timestamp: formattedTs,
              abnormalParameter: decision.parameter,
              baselineValue: decision.baselineDisplay,
              currentValue: decision.currentDisplay,
              deviationValue: decision.deviationDisplay,
              vitals: {
                spo2: nextVitals.spo2,
                respiratoryRate: nextVitals.respiratoryRate,
                heartRate: nextVitals.heartRate,
                temperature: nextVitals.temperature
              }
            },
            (notif) => wsHub.broadcastForPatient(patientId, 'notification:updated', notif)
          );
          smsNotifications.push(...dispatched);
        }
      }
    }
  }

  const smsSuppressedReason = suppressionNotes.length > 0 ? suppressionNotes.join(' ') : null;
  const updatedPatient = getPatientById(db, patientId)!;
  wsHub.broadcastForPatient(patientId, 'vital:updated', { patient: updatedPatient, observationId: obsId });

  res.status(201).json({
    success: true,
    patient: updatedPatient,
    decision,
    alert: createdOrUpdatedAlerts[0] || null,
    alerts: createdOrUpdatedAlerts,
    notifications: smsNotifications,
    smsSuppressedReason
  });
});

// NEWS2-style score endpoint
patientRouter.get('/:id/news2', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const patient = getPatientById(getDb(), patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  res.json({
    patientId: patient.id,
    scoringStandard: 'NEWS2-style',
    spo2Scale: patient.spo2Scale,
    targetSpo2Range: patient.targetSpo2Range,
    news2Score: patient.news2Score,
    breakdown: patient.news2Breakdown
  });
});

// Baseline endpoints (GET & authorized Doctor PUT)
patientRouter.get('/:id/baseline', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const patient = getPatientById(getDb(), patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  res.json(patient.baseline);
});

patientRouter.put('/:id/baseline', requireDoctor, (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: Patient is not assigned to you.' });
    return;
  }

  const db = getDb();
  const patient = getPatientById(db, patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const body = req.body || {};
  const cur = patient.baseline;

  const heartRate = body.heartRate !== undefined ? Number(body.heartRate) : cur.heartRate;
  const spo2 = body.spo2 !== undefined ? Number(body.spo2) : cur.spo2;
  const respiratoryRate = body.respiratoryRate !== undefined ? Number(body.respiratoryRate) : cur.respiratoryRate;
  const temperature = body.temperature !== undefined ? Number(body.temperature) : cur.temperature;

  const hrDeviationThreshold =
    body.hrDeviationThreshold !== undefined ? Number(body.hrDeviationThreshold) : Number(cur.hrDeviationThreshold ?? 8);
  const spo2DeviationThreshold =
    body.spo2DeviationThreshold !== undefined ? Number(body.spo2DeviationThreshold) : Number(cur.spo2DeviationThreshold ?? 8);
  const rrDeviationThreshold =
    body.rrDeviationThreshold !== undefined ? Number(body.rrDeviationThreshold) : Number(cur.rrDeviationThreshold ?? 8);
  const tempDeviationThreshold =
    body.tempDeviationThreshold !== undefined ? Number(body.tempDeviationThreshold) : Number(cur.tempDeviationThreshold ?? 0.8);
  const spo2LowSafetyLimit =
    body.spo2LowSafetyLimit !== undefined ? Number(body.spo2LowSafetyLimit) : Number(cur.spo2LowSafetyLimit ?? 90);

  if (!Number.isFinite(heartRate) || heartRate < 35 || heartRate > 180) {
    res.status(400).json({ error: 'Baseline Heart Rate must be between 35 and 180 BPM.' });
    return;
  }
  if (!Number.isFinite(spo2) || spo2 < 70 || spo2 > 100) {
    res.status(400).json({ error: 'Baseline SpO2 must be between 70% and 100%.' });
    return;
  }
  if (!Number.isFinite(respiratoryRate) || respiratoryRate < 6 || respiratoryRate > 45) {
    res.status(400).json({ error: 'Baseline Respiration Rate must be between 6 and 45 breaths/min.' });
    return;
  }
  if (!Number.isFinite(temperature) || temperature < 33.0 || temperature > 42.0) {
    res.status(400).json({ error: 'Baseline Skin Temperature must be between 33.0°C and 42.0°C.' });
    return;
  }
  if (!Number.isFinite(hrDeviationThreshold) || hrDeviationThreshold <= 0 || hrDeviationThreshold > 50) {
    res.status(400).json({ error: 'Heart Rate deviation threshold must be between 1 and 50 BPM.' });
    return;
  }
  if (!Number.isFinite(spo2DeviationThreshold) || spo2DeviationThreshold <= 0 || spo2DeviationThreshold > 30) {
    res.status(400).json({ error: 'SpO2 deviation threshold must be between 1 and 30 percentage points.' });
    return;
  }
  if (!Number.isFinite(rrDeviationThreshold) || rrDeviationThreshold <= 0 || rrDeviationThreshold > 30) {
    res.status(400).json({ error: 'Respiration Rate deviation threshold must be between 1 and 30 breaths/min.' });
    return;
  }
  if (!Number.isFinite(tempDeviationThreshold) || tempDeviationThreshold <= 0 || tempDeviationThreshold > 5) {
    res.status(400).json({ error: 'Skin Temperature deviation threshold must be between 0.1°C and 5.0°C.' });
    return;
  }
  if (!Number.isFinite(spo2LowSafetyLimit) || spo2LowSafetyLimit < 75 || spo2LowSafetyLimit > 96) {
    res.status(400).json({ error: 'SpO2 critical safety limit must be between 75% and 96%.' });
    return;
  }

  const updatedBy = req.user!.name || 'Attending Clinician';
  const updatedAtDisplay = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const nextBaselineJson = {
    ...cur,
    heartRate: Number(heartRate.toFixed(1)),
    spo2: Number(spo2.toFixed(1)),
    respiratoryRate: Number(respiratoryRate.toFixed(1)),
    temperature: Number(temperature.toFixed(1)),
    hrDeviationThreshold: Number(hrDeviationThreshold.toFixed(1)),
    spo2DeviationThreshold: Number(spo2DeviationThreshold.toFixed(1)),
    rrDeviationThreshold: Number(rrDeviationThreshold.toFixed(1)),
    tempDeviationThreshold: Number(tempDeviationThreshold.toFixed(2)),
    spo2LowSafetyLimit: Number(spo2LowSafetyLimit.toFixed(1)),
    calculatedAt: updatedAtDisplay,
    updatedBy
  };

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO patient_baselines (
        patient_id, heart_rate, spo2, respiratory_rate, temperature,
        hr_deviation_threshold, spo2_deviation_threshold, rr_deviation_threshold, temp_deviation_threshold,
        spo2_low_safety_limit, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(patient_id) DO UPDATE SET
        heart_rate = excluded.heart_rate,
        spo2 = excluded.spo2,
        respiratory_rate = excluded.respiratory_rate,
        temperature = excluded.temperature,
        hr_deviation_threshold = excluded.hr_deviation_threshold,
        spo2_deviation_threshold = excluded.spo2_deviation_threshold,
        rr_deviation_threshold = excluded.rr_deviation_threshold,
        temp_deviation_threshold = excluded.temp_deviation_threshold,
        spo2_low_safety_limit = excluded.spo2_low_safety_limit,
        updated_by = excluded.updated_by,
        updated_at = datetime('now')
    `).run(
      patientId,
      nextBaselineJson.heartRate,
      nextBaselineJson.spo2,
      nextBaselineJson.respiratoryRate,
      nextBaselineJson.temperature,
      nextBaselineJson.hrDeviationThreshold,
      nextBaselineJson.spo2DeviationThreshold,
      nextBaselineJson.rrDeviationThreshold,
      nextBaselineJson.tempDeviationThreshold,
      nextBaselineJson.spo2LowSafetyLimit,
      updatedBy
    );

    db.prepare(`
      UPDATE patients
      SET baseline_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(nextBaselineJson), patientId);
  });

  tx();

  const updatedPatient = getPatientById(db, patientId)!;
  wsHub.broadcastForPatient(patientId, 'patient:updated', updatedPatient);
  res.json({ patient: updatedPatient, baseline: updatedPatient.baseline });
});

// Symptom check-ins
patientRouter.get('/:id/symptom-checkins', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json(getCheckinsForPatient(getDb(), patientId));
});

patientRouter.post('/:id/symptom-checkins', (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  if (!verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { dyspneaScore = 0, dizziness = false, feverChills = false, fatigueScore = 0, notes = '' } = req.body || {};
  const id = `CHK-${patientId}-${Date.now().toString().slice(-5)}`;
  const submittedAt = new Date().toISOString();
  getDb()
    .prepare(`
      INSERT INTO symptom_checkins (id, patient_id, dyspnea_score, dizziness, fever_chills, fatigue_score, notes, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      patientId,
      Math.max(0, Math.min(10, Number(dyspneaScore))),
      dizziness ? 1 : 0,
      feverChills ? 1 : 0,
      Math.max(0, Math.min(10, Number(fatigueScore))),
      String(notes || '').slice(0, 500),
      submittedAt
    );

  const created = {
    id,
    patientId,
    dyspneaScore: Number(dyspneaScore),
    dizziness: Boolean(dizziness),
    feverChills: Boolean(feverChills),
    fatigueScore: Number(fatigueScore),
    notes: String(notes || ''),
    submittedAt
  };
  wsHub.broadcastForPatient(patientId, 'checkin:created', created);
  res.status(201).json(created);
});
