import { Router } from 'express';
import { getDb } from '../db/database.ts';
import {
  authenticateToken,
  requireDoctor,
  verifyPatientAccess,
  type AuthenticatedRequest
} from '../middleware/auth.ts';
import { getPatientById, getNotificationsForUser, mapAlertRow } from '../db/queries.ts';
import { generateAlertAiExplanation } from '../services/aiService.ts';
import { getClinicalThresholds, updateClinicalThresholds } from '../services/alertEngine.ts';
import {
  getWhatsAppGatewayStatus,
  markWhatsAppNotificationConfirmedSent,
  markWhatsAppNotificationOpened,
  prepareTestWhatsAppAlert
} from '../services/whatsappService.ts';
import { wsHub } from '../ws/wsServer.ts';

export const alertRouter = Router();
export const notificationRouter = Router();

// ================= AUTHENTICATED CLINICAL ROUTES =================

alertRouter.use(authenticateToken);
notificationRouter.use(authenticateToken);

// List alerts scoped to doctor's assigned patients or logged-in patient
alertRouter.get('/', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = req.user!;
  if (user.role === 'PATIENT') {
    const rows = db
      .prepare('SELECT * FROM alerts WHERE patient_id = ? ORDER BY created_at DESC')
      .all(user.patientId || '') as any[];
    res.json(rows.map(mapAlertRow));
    return;
  }

  const rows = db
    .prepare(`
      SELECT a.*
      FROM alerts a
      JOIN patients p ON p.id = a.patient_id
      WHERE p.assigned_doctor_id = ?
      ORDER BY a.created_at DESC
    `)
    .all(user.doctorId || '') as any[];
  res.json(rows.map(mapAlertRow));
});

alertRouter.post('/:id/acknowledge', requireDoctor, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const alertId = req.params.id;
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
  if (!row) {
    res.status(404).json({ error: 'Alert not found.' });
    return;
  }
  if (!verifyPatientAccess(req.user!, row.patient_id)) {
    res.status(403).json({ error: 'Forbidden: Patient not assigned to you.' });
    return;
  }
  const ackAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const clinicianName = req.body?.clinicianName || req.user!.name;

  db.prepare(`
    UPDATE alerts
    SET status = 'ACKNOWLEDGED', acknowledged_by = ?, acknowledged_at = ?
    WHERE id = ?
  `).run(clinicianName, ackAt, alertId);

  const updated = mapAlertRow(db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId));
  wsHub.broadcastForPatient(row.patient_id, 'alert:updated', updated);
  res.json(updated);
});

alertRouter.post('/:id/resolve', requireDoctor, (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const alertId = req.params.id;
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
  if (!row) {
    res.status(404).json({ error: 'Alert not found.' });
    return;
  }
  if (!verifyPatientAccess(req.user!, row.patient_id)) {
    res.status(403).json({ error: 'Forbidden: Patient not assigned to you.' });
    return;
  }
  const resolvedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  db.prepare(`
    UPDATE alerts
    SET status = 'RESOLVED', resolved_at = ?
    WHERE id = ?
  `).run(resolvedAt, alertId);

  const updated = mapAlertRow(db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId));
  wsHub.broadcastForPatient(row.patient_id, 'alert:updated', updated);
  res.json(updated);
});

// Server-side Gemini AI Alert Explanation (distinct from deterministic rule alert engine)
alertRouter.post('/:id/ai-explanation', async (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const alertId = req.params.id;
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any;
  if (!row) {
    res.status(404).json({ error: 'Alert not found.' });
    return;
  }
  if (!verifyPatientAccess(req.user!, row.patient_id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const patient = getPatientById(db, row.patient_id);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const alertObj = mapAlertRow(row);
  const { text, source } = await generateAlertAiExplanation(alertObj, patient);
  db.prepare('UPDATE alerts SET ai_explanation = ? WHERE id = ?').run(text, alertId);

  res.json({ alertId, aiExplanation: text, source });
});

// ================= WHATSAPP EMERGENCY NOTIFICATION ROUTES =================

notificationRouter.get('/gateway-status', (_req, res) => {
  res.json(getWhatsAppGatewayStatus());
});

notificationRouter.get('/thresholds', requireDoctor, (_req, res) => {
  res.json(getClinicalThresholds(getDb()));
});

notificationRouter.put('/thresholds', requireDoctor, (req: AuthenticatedRequest, res) => {
  const updated = updateClinicalThresholds(getDb(), req.body || {});
  res.json(updated);
});

notificationRouter.get('/', (req: AuthenticatedRequest, res) => {
  const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
  if (patientId && !verifyPatientAccess(req.user!, patientId)) {
    res.status(403).json({ error: 'Forbidden: Unauthorized patient notification access.' });
    return;
  }
  const list = getNotificationsForUser(getDb(), req.user!, patientId);
  res.json(list);
});

notificationRouter.post('/:id/opened', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const notifRow = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as any;
  if (!notifRow) {
    res.status(404).json({ error: 'WhatsApp alert record not found.' });
    return;
  }
  if (!verifyPatientAccess(req.user!, notifRow.patient_id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const notification = markWhatsAppNotificationOpened(db, notifRow.id, (n) =>
      wsHub.broadcastForPatient(notifRow.patient_id, 'notification:updated', n)
    );
    res.json({ notification });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Unable to update WhatsApp alert state.' });
  }
});

notificationRouter.post('/:id/confirm-sent', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const notifRow = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as any;
  if (!notifRow) {
    res.status(404).json({ error: 'WhatsApp alert record not found.' });
    return;
  }
  if (!verifyPatientAccess(req.user!, notifRow.patient_id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const notification = markWhatsAppNotificationConfirmedSent(db, notifRow.id, (n) =>
      wsHub.broadcastForPatient(notifRow.patient_id, 'notification:updated', n)
    );
    res.json({ notification });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Unable to confirm WhatsApp sent state.' });
  }
});

// Controlled TEST WhatsApp alert preparation (generates wa.me deep link with TEST_ALERT flag)
notificationRouter.post('/test-emergency', requireDoctor, async (req: AuthenticatedRequest, res) => {
  const { patientId, verifiedPhone, recipientName, consentConfirmed, testBaseline, testReading } = req.body || {};
  if (!patientId || !verifyPatientAccess(req.user!, String(patientId))) {
    res.status(403).json({ error: 'Forbidden or invalid patientId.' });
    return;
  }

  if (!consentConfirmed) {
    res.status(400).json({
      error: 'Confirmation is required before preparing a test WhatsApp alert.'
    });
    return;
  }

  if (!verifiedPhone || !String(verifiedPhone).trim()) {
    res.status(400).json({
      error: 'Please enter a valid WhatsApp mobile number (e.g. +919876543210) for the test alert.'
    });
    return;
  }

  const db = getDb();
  const patient = getPatientById(db, String(patientId));
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const formattedTs = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  try {
    const { notification, evaluatedDeviation } = await prepareTestWhatsAppAlert(
      db,
      {
        patientId: patient.id,
        patientName: patient.name,
        doctorId: req.user!.doctorId || 'DOC-EVANCE',
        recipientPhone: String(verifiedPhone).trim(),
        recipientName: recipientName ? String(recipientName).trim() : 'Verified Test Guardian',
        timestamp: formattedTs,
        testBaseline: testBaseline
          ? {
              heartRate: Number(testBaseline.heartRate),
              spo2: Number(testBaseline.spo2),
              respiratoryRate: Number(testBaseline.respiratoryRate),
              temperature: Number(testBaseline.temperature)
            }
          : undefined,
        testReading: testReading
          ? {
              heartRate: Number(testReading.heartRate),
              spo2: Number(testReading.spo2),
              respiratoryRate: Number(testReading.respiratoryRate),
              temperature: Number(testReading.temperature)
            }
          : undefined,
        consentConfirmed: true
      },
      (notif) => wsHub.broadcastForPatient(patient.id, 'notification:updated', notif)
    );

    res.status(201).json({ notification, evaluatedDeviation });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Test WhatsApp preparation failed.' });
  }
});
