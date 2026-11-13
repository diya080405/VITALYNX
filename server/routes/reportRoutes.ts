import { Router } from 'express';
import { getDb } from '../db/database.ts';
import { authenticateToken, verifyPatientAccess, type AuthenticatedRequest } from '../middleware/auth.ts';
import {
  getPatientById,
  getObservationsForPatient,
  getCheckinsForPatient,
  getNotificationsForUser,
  mapAlertRow
} from '../db/queries.ts';
import { generateReportAiSummary } from '../services/aiService.ts';
import { generatePatientClinicalPdf } from '../services/pdfService.ts';
import type { ReportPeriod } from '../../src/types/notification.ts';

export const reportRouter = Router();

reportRouter.use(authenticateToken);

function normalizePeriod(input: unknown): ReportPeriod {
  const s = String(input || '24h').toLowerCase();
  if (s === '7d' || s === '30d' || s === '24h') return s;
  return '24h';
}

function getPeriodWindow(period: ReportPeriod): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (period === '24h') start.setHours(end.getHours() - 24);
  else if (period === '7d') start.setDate(end.getDate() - 7);
  else start.setDate(end.getDate() - 30);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

// Generate report metadata & AI summary (persisted in SQLite reports table)
reportRouter.post('/patients/:id/generate', async (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  const user = req.user!;
  if (!verifyPatientAccess(user, patientId)) {
    res.status(403).json({ error: 'Forbidden: Unauthorized report generation attempt.' });
    return;
  }

  const db = getDb();
  const patient = getPatientById(db, patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const period = normalizePeriod(req.body?.period || req.query.period);
  const { start, end } = getPeriodWindow(period);
  const obsLimit = period === '24h' ? 30 : period === '7d' ? 100 : 250;
  const observations = getObservationsForPatient(db, patientId, obsLimit);
  const alertRows = db
    .prepare('SELECT * FROM alerts WHERE patient_id = ? ORDER BY created_at DESC')
    .all(patientId) as any[];
  const alerts = alertRows.map(mapAlertRow);
  const checkins = getCheckinsForPatient(db, patientId);

  const { summary, source } = await generateReportAiSummary({
    patient,
    period,
    observations,
    alerts,
    checkins
  });

  const reportId = `RPT-${patientId}-${Date.now().toString().slice(-6)}`;
  db.prepare(`
    INSERT INTO reports (
      id, patient_id, generated_by_user_id, generated_by_role, period,
      period_start, period_end, ai_summary, news2_score, observation_count, alert_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId,
    patientId,
    user.id,
    user.role,
    period,
    start,
    end,
    summary,
    patient.news2Score,
    observations.length,
    alerts.length
  );

  res.status(201).json({
    report: {
      id: reportId,
      patientId,
      period,
      periodStart: start,
      periodEnd: end,
      aiSummary: summary,
      aiSource: source,
      news2Score: patient.news2Score,
      observationCount: observations.length,
      alertCount: alerts.length,
      createdAt: new Date().toISOString(),
      downloadUrl: `/api/reports/patients/${patientId}?period=${period}&format=pdf`
    }
  });
});

// Download real PDF report directly from persisted database records
reportRouter.get('/patients/:id', async (req: AuthenticatedRequest, res) => {
  const patientId = req.params.id;
  const user = req.user!;
  if (!verifyPatientAccess(user, patientId)) {
    res.status(403).json({ error: 'Forbidden: Unauthorized patient report download.' });
    return;
  }

  const db = getDb();
  const patient = getPatientById(db, patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }

  const period = normalizePeriod(req.query.period);
  const { start, end } = getPeriodWindow(period);
  const obsLimit = period === '24h' ? 30 : period === '7d' ? 100 : 250;
  const observations = getObservationsForPatient(db, patientId, obsLimit);
  const alertRows = db
    .prepare('SELECT * FROM alerts WHERE patient_id = ? ORDER BY created_at DESC')
    .all(patientId) as any[];
  const alerts = alertRows.map(mapAlertRow);
  const checkins = getCheckinsForPatient(db, patientId);
  const notifications = getNotificationsForUser(db, user, patientId);

  const { summary, source } = await generateReportAiSummary({
    patient,
    period,
    observations,
    alerts,
    checkins
  });

  const reportId = `RPT-${patientId}-${Date.now().toString().slice(-6)}`;
  db.prepare(`
    INSERT INTO reports (
      id, patient_id, generated_by_user_id, generated_by_role, period,
      period_start, period_end, ai_summary, news2_score, observation_count, alert_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId,
    patientId,
    user.id,
    user.role,
    period,
    start,
    end,
    summary,
    patient.news2Score,
    observations.length,
    alerts.length
  );

  if (req.query.format === 'json') {
    res.json({
      id: reportId,
      patient,
      period,
      periodStart: start,
      periodEnd: end,
      aiSummary: summary,
      aiSource: source,
      observations,
      alerts,
      notifications,
      checkins
    });
    return;
  }

  const pdfBuffer = await generatePatientClinicalPdf({
    patient,
    period,
    periodStart: start,
    periodEnd: end,
    observations,
    alerts,
    notifications,
    checkins,
    aiSummary: summary,
    aiSource: source,
    generatedByRole: user.role,
    generatedByName: user.name
  });

  const safeName = patient.name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `VITALYNX_${safeName}_Report_${dateTag}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(pdfBuffer.length));
  res.send(pdfBuffer);
});
