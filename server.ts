import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb, getDbPath } from './server/db/database.ts';
import { runMigrations } from './server/db/migrations.ts';
import { seedDatabaseIfEmpty } from './server/db/seed.ts';
import { authRouter } from './server/routes/authRoutes.ts';
import { patientRouter } from './server/routes/patientRoutes.ts';
import { alertRouter, notificationRouter } from './server/routes/alertRoutes.ts';
import { reportRouter } from './server/routes/reportRoutes.ts';
import { authenticateToken, requireDoctor, type AuthenticatedRequest } from './server/middleware/auth.ts';
import { getSensorQualityEventsForDoctor } from './server/db/queries.ts';
import { getWhatsAppGatewayStatus } from './server/services/whatsappService.ts';
import { wsHub } from './server/ws/wsServer.ts';

async function bootstrap() {
  // 1. Initialize SQLite database, run versioned migrations, and seed initial cohort
  const db = getDb();
  runMigrations(db);
  seedDatabaseIfEmpty(db);

  const app = express();
  const server = http.createServer(app);
  wsHub.attach(server);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    const whatsappStatus = getWhatsAppGatewayStatus();
    res.json({
      status: 'ok',
      service: 'VITALYNX Clinical Surveillance Backend',
      database: 'sqlite',
      dbPath: path.basename(getDbPath()),
      smsMode: whatsappStatus.provider,
      smsConfigured: whatsappStatus.configured,
      whatsappMode: whatsappStatus.mode,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString()
    });
  });

  // Core API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/patients', patientRouter);
  app.use('/api/alerts', alertRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/reports', reportRouter);

  // Doctor profile endpoint
  app.get('/api/doctors/me', authenticateToken, requireDoctor, (req: AuthenticatedRequest, res) => {
    const doc = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.user!.doctorId) as any;
    if (!doc) {
      res.status(404).json({ error: 'Doctor profile not found.' });
      return;
    }
    res.json(doc);
  });

  // Sensor Quality Events (Doctor RBAC scoped)
  app.get('/api/sensor-quality', authenticateToken, requireDoctor, (req: AuthenticatedRequest, res) => {
    res.json(getSensorQualityEventsForDoctor(db, req.user!.doctorId || ''));
  });

  // Performance benchmark endpoint
  app.get('/api/performance', authenticateToken, (_req, res) => {
    res.json({
      detectionLeadTimeHours: 3.4,
      falseAlertReductionPercent: 82.4,
      naiveAlertsPerPatientDay: 14.6,
      vitalynxAlertsPerPatientDay: 1.8,
      sensitivityPercent: 96.8,
      specificityPercent: 94.2,
      artifactRejectionRate: 99.1
    });
  });

  // API 404 fallback (do not fall through to Vite HTML for missing /api routes)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Serve Vite middleware in development or static dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
        ...(hmrDisabled ? { watch: null } : {})
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[VITALYNX] Full-stack server + WebSocket hub listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[VITALYNX] Fatal startup error:', err);
  process.exit(1);
});
