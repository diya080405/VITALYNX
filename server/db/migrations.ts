import type Database from 'better-sqlite3';

interface Migration {
  version: string;
  description: string;
  up: (db: Database.Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: '001_initial_schema',
    description: 'Create core VITALYNX clinical surveillance relational tables and indexes',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS doctors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role_title TEXT NOT NULL,
          clinic TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          pager TEXT,
          avatar_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS patients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER NOT NULL,
          gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
          avatar_url TEXT,
          discharge_date TEXT NOT NULL,
          primary_diagnosis TEXT NOT NULL,
          medical_conditions_json TEXT NOT NULL,
          medications_json TEXT NOT NULL,
          monitoring_status TEXT NOT NULL CHECK (monitoring_status IN ('ACTIVE', 'PAUSED', 'DISCONNECTED')),
          current_alert_category TEXT NOT NULL CHECK (current_alert_category IN ('STABLE', 'WATCH', 'REVIEW', 'URGENT', 'OFFLINE')),
          status_explanation TEXT NOT NULL,
          spo2_scale TEXT NOT NULL CHECK (spo2_scale IN ('SCALE_1', 'SCALE_2')),
          target_spo2_min INTEGER NOT NULL,
          target_spo2_max INTEGER NOT NULL,
          baseline_json TEXT NOT NULL,
          personalization_notes TEXT NOT NULL,
          news2_score INTEGER NOT NULL DEFAULT 0,
          news2_breakdown_json TEXT NOT NULL,
          has_supplemental_oxygen INTEGER NOT NULL DEFAULT 0,
          fhir_resource_id TEXT NOT NULL,
          room_bed TEXT,
          assigned_doctor_id TEXT NOT NULL REFERENCES doctors(id),
          patient_phone TEXT NOT NULL,
          latest_vitals_json TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('DOCTOR', 'PATIENT')),
          name TEXT NOT NULL,
          doctor_id TEXT REFERENCES doctors(id),
          patient_id TEXT REFERENCES patients(id),
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS emergency_contacts (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          contact_type TEXT NOT NULL CHECK (contact_type IN ('PRIMARY', 'ALTERNATE')),
          name TEXT NOT NULL,
          relationship TEXT NOT NULL,
          phone TEXT NOT NULL,
          priority INTEGER NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(patient_id, contact_type)
        );

        CREATE TABLE IF NOT EXISTS vital_observations (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          timestamp TEXT NOT NULL,
          time_label TEXT NOT NULL,
          heart_rate REAL NOT NULL,
          spo2 REAL NOT NULL,
          respiratory_rate REAL NOT NULL,
          temperature REAL NOT NULL,
          blood_pressure TEXT,
          sensor_quality TEXT NOT NULL,
          news2_score INTEGER NOT NULL DEFAULT 0,
          alert_category TEXT NOT NULL DEFAULT 'STABLE',
          loinc_hr_code TEXT NOT NULL DEFAULT '8867-4',
          loinc_spo2_code TEXT NOT NULL DEFAULT '2708-6',
          loinc_rr_code TEXT NOT NULL DEFAULT '9279-1',
          loinc_temp_code TEXT NOT NULL DEFAULT '8310-5',
          fhir_observation_id TEXT,
          data_source TEXT NOT NULL DEFAULT 'BIDMC_PHYSIONET + VIRTUAL_WEARABLE_TEMP',
          is_simulated INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          patient_name TEXT NOT NULL,
          alert_level TEXT NOT NULL CHECK (alert_level IN ('WATCH', 'REVIEW', 'URGENT')),
          vital_sign_reading TEXT NOT NULL,
          parameter TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          rule_applied TEXT NOT NULL,
          patient_medical_info TEXT NOT NULL,
          sensor_quality_status TEXT NOT NULL,
          explanation TEXT NOT NULL,
          suggested_action TEXT NOT NULL,
          ai_explanation TEXT,
          status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
          acknowledged_by TEXT,
          acknowledged_at TEXT,
          resolved_at TEXT,
          cooldown_key TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id TEXT REFERENCES doctors(id),
          recipient_name TEXT NOT NULL,
          recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PRIMARY', 'ALTERNATE')),
          recipient_phone TEXT NOT NULL,
          message_text TEXT NOT NULL,
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'MOCK_TEST_SENT')),
          provider TEXT NOT NULL,
          provider_message_id TEXT,
          provider_response TEXT,
          error_reason TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          idempotency_key TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_patients_doctor ON patients(assigned_doctor_id);
        CREATE INDEX IF NOT EXISTS idx_obs_patient_ts ON vital_observations(patient_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_alerts_patient_status ON alerts(patient_id, status, alert_level);
        CREATE INDEX IF NOT EXISTS idx_alerts_cooldown ON alerts(patient_id, cooldown_key, status);
        CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);
      `);
    }
  },
  {
    version: '002_reports_checkins_sensor_events',
    description: 'Create reports, symptom_checkins, and sensor_quality_events tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          generated_by_user_id TEXT NOT NULL REFERENCES users(id),
          generated_by_role TEXT NOT NULL CHECK (generated_by_role IN ('DOCTOR', 'PATIENT')),
          period TEXT NOT NULL CHECK (period IN ('24h', '7d', '30d')),
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          ai_summary TEXT NOT NULL,
          news2_score INTEGER NOT NULL,
          observation_count INTEGER NOT NULL,
          alert_count INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS symptom_checkins (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          dyspnea_score INTEGER NOT NULL CHECK (dyspnea_score BETWEEN 0 AND 10),
          dizziness INTEGER NOT NULL DEFAULT 0,
          fever_chills INTEGER NOT NULL DEFAULT 0,
          fatigue_score INTEGER NOT NULL CHECK (fatigue_score BETWEEN 0 AND 10),
          notes TEXT,
          submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sensor_quality_events (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          patient_name TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          artifact_type TEXT NOT NULL,
          affected_vital TEXT NOT NULL,
          sensor_type TEXT NOT NULL,
          quality_state TEXT NOT NULL,
          signal_status TEXT NOT NULL,
          explanation TEXT NOT NULL,
          clinical_impact_prevented TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_checkins_patient ON symptom_checkins(patient_id, submitted_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sensor_events_patient ON sensor_quality_events(patient_id, created_at DESC);
      `);
    }
  },
  {
    version: '003_emergency_contacts_crud_and_registration',
    description: 'Support patient portal registration status and full Add/Edit/Delete emergency contacts CRUD',
    up: (db) => {
      const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
      if (!userColumns.some((c) => c.name === 'is_portal_registered')) {
        db.exec(`ALTER TABLE users ADD COLUMN is_portal_registered INTEGER NOT NULL DEFAULT 0;`);
        db.exec(`
          UPDATE users
          SET is_portal_registered = 1
          WHERE role = 'DOCTOR'
             OR (
               role = 'PATIENT'
               AND LOWER(email) NOT LIKE '%@patient.vitalynx.health'
               AND LOWER(email) NOT LIKE '%@patient.vitalynx.local'
             );
        `);
      }

      // Migrate emergency_contacts to allow multiple ADDITIONAL contacts while preserving unique PRIMARY contact
      db.exec(`
        CREATE TABLE emergency_contacts_new (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          contact_type TEXT NOT NULL CHECK (contact_type IN ('PRIMARY', 'ALTERNATE', 'ADDITIONAL')),
          name TEXT NOT NULL,
          relationship TEXT NOT NULL,
          phone TEXT NOT NULL,
          priority INTEGER NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO emergency_contacts_new (id, patient_id, contact_type, name, relationship, phone, priority, updated_at)
        SELECT id, patient_id, contact_type, name, relationship, phone, priority, updated_at
        FROM emergency_contacts;

        DROP TABLE emergency_contacts;
        ALTER TABLE emergency_contacts_new RENAME TO emergency_contacts;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_ec_primary_unique
          ON emergency_contacts(patient_id) WHERE contact_type = 'PRIMARY';
        CREATE INDEX IF NOT EXISTS idx_ec_patient_priority
          ON emergency_contacts(patient_id, priority ASC);
      `);

      // Allow ADDITIONAL recipient_type in notifications audit log
      db.exec(`
        CREATE TABLE notifications_new (
          id TEXT PRIMARY KEY,
          alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id TEXT REFERENCES doctors(id),
          recipient_name TEXT NOT NULL,
          recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PRIMARY', 'ALTERNATE', 'ADDITIONAL')),
          recipient_phone TEXT NOT NULL,
          message_text TEXT NOT NULL,
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'MOCK_TEST_SENT')),
          provider TEXT NOT NULL,
          provider_message_id TEXT,
          provider_response TEXT,
          error_reason TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          idempotency_key TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO notifications_new (
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text, delivery_status, provider, provider_message_id, provider_response,
          error_reason, retry_count, idempotency_key, created_at, updated_at
        )
        SELECT
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text, delivery_status, provider, provider_message_id, provider_response,
          error_reason, retry_count, idempotency_key, created_at, updated_at
        FROM notifications;

        DROP TABLE notifications;
        ALTER TABLE notifications_new RENAME TO notifications;

        CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);
      `);
    }
  },
  {
    version: '004_fix_seeded_registration_flag',
    description: 'Ensure seeded @patient.vitalynx.health demo accounts allow first-time portal registration',
    up: (db) => {
      db.exec(`
        UPDATE users
        SET is_portal_registered = 0
        WHERE role = 'PATIENT'
          AND (LOWER(email) LIKE '%@patient.vitalynx.health' OR LOWER(email) LIKE '%@patient.vitalynx.local');
      `);
    }
  },
  {
    version: '005_real_sms_and_thresholds',
    description: 'Replace MOCK_TEST_SENT with real SMS delivery statuses, add test/emergency distinction, and add configurable clinical_thresholds table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS clinical_thresholds (
          id TEXT PRIMARY KEY,
          spo2_critical_scale1 REAL NOT NULL DEFAULT 89,
          spo2_critical_scale2 REAL NOT NULL DEFAULT 84,
          hr_critical_high REAL NOT NULL DEFAULT 130,
          hr_critical_low REAL NOT NULL DEFAULT 40,
          rr_critical_high REAL NOT NULL DEFAULT 25,
          rr_critical_low REAL NOT NULL DEFAULT 8,
          temp_critical_high REAL NOT NULL DEFAULT 38.8,
          temp_critical_low REAL NOT NULL DEFAULT 35.0,
          news2_critical_threshold INTEGER NOT NULL DEFAULT 7,
          alert_cooldown_minutes INTEGER NOT NULL DEFAULT 15,
          max_sms_retries INTEGER NOT NULL DEFAULT 3,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO clinical_thresholds (
          id, spo2_critical_scale1, spo2_critical_scale2, hr_critical_high, hr_critical_low,
          rr_critical_high, rr_critical_low, temp_critical_high, temp_critical_low,
          news2_critical_threshold, alert_cooldown_minutes, max_sms_retries
        ) VALUES (
          'DEFAULT',
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_SPO2_SCALE1) || 89}', ''), 89),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_SPO2_SCALE2) || 84}', ''), 84),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_HR_HIGH) || 130}', ''), 130),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_HR_LOW) || 40}', ''), 40),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_RR_HIGH) || 25}', ''), 25),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_RR_LOW) || 8}', ''), 8),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_TEMP_HIGH) || 38.8}', ''), 38.8),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_TEMP_LOW) || 35.0}', ''), 35.0),
          COALESCE(NULLIF('${Number(process.env.THRESHOLD_NEWS2_CRITICAL) || 7}', ''), 7),
          COALESCE(NULLIF('${Number(process.env.ALERT_COOLDOWN_MINUTES) || 15}', ''), 15),
          3
        );

        -- Remove legacy simulated sandbox notifications (never fabricate delivery status)
        DELETE FROM notifications
        WHERE delivery_status = 'MOCK_TEST_SENT'
           OR provider = 'TEST_SANDBOX';

        CREATE TABLE notifications_v5 (
          id TEXT PRIMARY KEY,
          alert_id TEXT REFERENCES alerts(id) ON DELETE CASCADE,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id TEXT REFERENCES doctors(id),
          recipient_name TEXT NOT NULL,
          recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PRIMARY', 'ALTERNATE', 'ADDITIONAL', 'TEST_RECIPIENT')),
          recipient_phone TEXT NOT NULL,
          message_text TEXT NOT NULL,
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED')),
          alert_type TEXT NOT NULL DEFAULT 'REAL_EMERGENCY' CHECK (alert_type IN ('REAL_EMERGENCY', 'TEST_ALERT')),
          is_test INTEGER NOT NULL DEFAULT 0,
          provider TEXT NOT NULL,
          provider_message_id TEXT,
          provider_response TEXT,
          error_reason TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          idempotency_key TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO notifications_v5 (
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text, delivery_status, alert_type, is_test, provider, provider_message_id,
          provider_response, error_reason, retry_count, idempotency_key, created_at, updated_at
        )
        SELECT
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text,
          CASE
            WHEN delivery_status = 'QUEUED' THEN 'PENDING'
            WHEN delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED') THEN delivery_status
            ELSE 'FAILED'
          END,
          'REAL_EMERGENCY',
          0,
          provider, provider_message_id, provider_response, error_reason, retry_count,
          idempotency_key, created_at, updated_at
        FROM notifications;

        DROP TABLE notifications;
        ALTER TABLE notifications_v5 RENAME TO notifications;

        CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_provider_msg_id ON notifications(provider_message_id);
      `);
    }
  },
  {
    version: '006_baseline_deviation_monitoring',
    description: 'Create patient_baselines table with per-patient deviation thresholds and add deviation/escalation tracking columns to alerts and notifications',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS patient_baselines (
          patient_id TEXT PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
          heart_rate REAL NOT NULL,
          spo2 REAL NOT NULL,
          respiratory_rate REAL NOT NULL,
          temperature REAL NOT NULL,
          hr_deviation_threshold REAL NOT NULL DEFAULT 8,
          spo2_deviation_threshold REAL NOT NULL DEFAULT 8,
          rr_deviation_threshold REAL NOT NULL DEFAULT 8,
          temp_deviation_threshold REAL NOT NULL DEFAULT 0.8,
          spo2_low_safety_limit REAL NOT NULL DEFAULT 90,
          hr_high_safety_limit REAL NOT NULL DEFAULT 130,
          hr_low_safety_limit REAL NOT NULL DEFAULT 40,
          rr_high_safety_limit REAL NOT NULL DEFAULT 25,
          rr_low_safety_limit REAL NOT NULL DEFAULT 8,
          temp_high_safety_limit REAL NOT NULL DEFAULT 38.8,
          temp_low_safety_limit REAL NOT NULL DEFAULT 35.0,
          updated_by TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // Populate patient_baselines from existing patients.baseline_json
      const patients = db
        .prepare('SELECT id, spo2_scale, baseline_json FROM patients')
        .all() as Array<{ id: string; spo2_scale: string; baseline_json: string }>;

      const insertBaseline = db.prepare(`
        INSERT OR IGNORE INTO patient_baselines (
          patient_id, heart_rate, spo2, respiratory_rate, temperature,
          hr_deviation_threshold, spo2_deviation_threshold, rr_deviation_threshold, temp_deviation_threshold,
          spo2_low_safety_limit, updated_by
        ) VALUES (?, ?, ?, ?, ?, 8, 8, 8, 0.8, ?, 'SYSTEM_SEED')
      `);

      for (const p of patients) {
        try {
          const base = JSON.parse(p.baseline_json || '{}');
          const spo2Limit = p.spo2_scale === 'SCALE_2' ? 85 : 90;
          insertBaseline.run(
            p.id,
            Number(base.heartRate) || 74,
            Number(base.spo2) || 97,
            Number(base.respiratoryRate) || 16,
            Number(base.temperature) || 36.8,
            spo2Limit
          );
        } catch {
          // ignore malformed row
        }
      }

      const alertCols = (db.prepare('PRAGMA table_info(alerts)').all() as Array<{ name: string }>).map((c) => c.name);
      if (!alertCols.includes('reading_signature')) {
        db.exec(`ALTER TABLE alerts ADD COLUMN reading_signature TEXT;`);
      }
      if (!alertCols.includes('max_deviation_magnitude')) {
        db.exec(`ALTER TABLE alerts ADD COLUMN max_deviation_magnitude REAL NOT NULL DEFAULT 0;`);
      }

      const notifCols = (db.prepare('PRAGMA table_info(notifications)').all() as Array<{ name: string }>).map((c) => c.name);
      if (!notifCols.includes('triggered_parameter')) {
        db.exec(`ALTER TABLE notifications ADD COLUMN triggered_parameter TEXT;`);
      }
      if (!notifCols.includes('baseline_value')) {
        db.exec(`ALTER TABLE notifications ADD COLUMN baseline_value TEXT;`);
      }
      if (!notifCols.includes('current_value')) {
        db.exec(`ALTER TABLE notifications ADD COLUMN current_value TEXT;`);
      }
      if (!notifCols.includes('deviation_value')) {
        db.exec(`ALTER TABLE notifications ADD COLUMN deviation_value TEXT;`);
      }
      if (!notifCols.includes('delivery_confirmed_at')) {
        db.exec(`ALTER TABLE notifications ADD COLUMN delivery_confirmed_at TEXT;`);
      }
    }
  },
  {
    version: '007_strict_sms_statuses_and_deviation_audit',
    description: 'Enforce strict PENDING/DELIVERED/FAILED SMS statuses, add baseline/current/deviation columns to alerts, and align SpO2 safety limit to 90%',
    up: (db) => {
      const alertCols = (db.prepare('PRAGMA table_info(alerts)').all() as Array<{ name: string }>).map((c) => c.name);
      if (!alertCols.includes('baseline_value')) {
        db.exec(`ALTER TABLE alerts ADD COLUMN baseline_value TEXT;`);
      }
      if (!alertCols.includes('current_value')) {
        db.exec(`ALTER TABLE alerts ADD COLUMN current_value TEXT;`);
      }
      if (!alertCols.includes('deviation_value')) {
        db.exec(`ALTER TABLE alerts ADD COLUMN deviation_value TEXT;`);
      }

      // Ensure every patient has a row in patient_baselines and default SpO2 critical limit is 90%
      db.exec(`
        UPDATE patient_baselines
        SET spo2_low_safety_limit = 90
        WHERE updated_by = 'SYSTEM_SEED' AND spo2_low_safety_limit <> 90;
      `);

      db.exec(`
        CREATE TABLE notifications_v7 (
          id TEXT PRIMARY KEY,
          alert_id TEXT REFERENCES alerts(id) ON DELETE CASCADE,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id TEXT REFERENCES doctors(id),
          recipient_name TEXT NOT NULL,
          recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PRIMARY', 'ALTERNATE', 'ADDITIONAL', 'TEST_RECIPIENT')),
          recipient_phone TEXT NOT NULL,
          message_text TEXT NOT NULL,
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('PENDING', 'DELIVERED', 'FAILED')),
          alert_type TEXT NOT NULL DEFAULT 'REAL_EMERGENCY' CHECK (alert_type IN ('REAL_EMERGENCY', 'TEST_ALERT')),
          is_test INTEGER NOT NULL DEFAULT 0,
          provider TEXT NOT NULL,
          provider_message_id TEXT,
          provider_response TEXT,
          error_reason TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          idempotency_key TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          triggered_parameter TEXT,
          baseline_value TEXT,
          current_value TEXT,
          deviation_value TEXT,
          delivery_confirmed_at TEXT
        );

        INSERT INTO notifications_v7 (
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text, delivery_status, alert_type, is_test, provider, provider_message_id,
          provider_response, error_reason, retry_count, idempotency_key, created_at, updated_at,
          triggered_parameter, baseline_value, current_value, deviation_value, delivery_confirmed_at
        )
        SELECT
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text,
          CASE
            WHEN delivery_status IN ('DELIVERED', 'FAILED') THEN delivery_status
            ELSE 'PENDING'
          END,
          alert_type, is_test, provider, provider_message_id,
          provider_response, error_reason, retry_count, idempotency_key, created_at, updated_at,
          triggered_parameter, baseline_value, current_value, deviation_value, delivery_confirmed_at
        FROM notifications;

        DROP TABLE notifications;
        ALTER TABLE notifications_v7 RENAME TO notifications;

        CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_provider_msg_id ON notifications(provider_message_id);
      `);
    }
  },
  {
    version: '008_whatsapp_notifications_and_vital_audit',
    description: 'Upgrade notifications to normal WhatsApp link workflow (READY TO SEND, OPENED, USER CONFIRMED SENT) and store baseline comparison + emergency status on every vital observation',
    up: (db) => {
      const obsCols = (db.prepare('PRAGMA table_info(vital_observations)').all() as Array<{ name: string }>).map((c) => c.name);
      if (!obsCols.includes('baseline_comparison_json')) {
        db.exec(`ALTER TABLE vital_observations ADD COLUMN baseline_comparison_json TEXT;`);
      }
      if (!obsCols.includes('emergency_status')) {
        db.exec(`ALTER TABLE vital_observations ADD COLUMN emergency_status TEXT;`);
      }

      db.exec(`
        CREATE TABLE notifications_v8 (
          id TEXT PRIMARY KEY,
          alert_id TEXT REFERENCES alerts(id) ON DELETE CASCADE,
          patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          doctor_id TEXT REFERENCES doctors(id),
          recipient_name TEXT NOT NULL,
          recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PRIMARY', 'ALTERNATE', 'ADDITIONAL', 'TEST_RECIPIENT')),
          recipient_phone TEXT NOT NULL,
          message_text TEXT NOT NULL,
          whatsapp_url TEXT NOT NULL DEFAULT '',
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('READY TO SEND', 'OPENED', 'USER CONFIRMED SENT')),
          alert_type TEXT NOT NULL DEFAULT 'REAL_EMERGENCY' CHECK (alert_type IN ('REAL_EMERGENCY', 'TEST_ALERT')),
          is_test INTEGER NOT NULL DEFAULT 0,
          provider TEXT NOT NULL DEFAULT 'WHATSAPP_NORMAL',
          provider_message_id TEXT,
          provider_response TEXT,
          error_reason TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          idempotency_key TEXT UNIQUE NOT NULL,
          opened_at TEXT,
          confirmed_sent_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          triggered_parameter TEXT,
          baseline_value TEXT,
          current_value TEXT,
          deviation_value TEXT,
          delivery_confirmed_at TEXT
        );

        INSERT INTO notifications_v8 (
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text, whatsapp_url, delivery_status, alert_type, is_test, provider, provider_message_id,
          provider_response, error_reason, retry_count, idempotency_key, opened_at, confirmed_sent_at,
          created_at, updated_at, triggered_parameter, baseline_value, current_value, deviation_value,
          delivery_confirmed_at
        )
        SELECT
          id, alert_id, patient_id, doctor_id, recipient_name, recipient_type, recipient_phone,
          message_text, '', 'READY TO SEND', alert_type, is_test, 'WHATSAPP_NORMAL', provider_message_id,
          provider_response, error_reason, retry_count, idempotency_key, NULL, NULL,
          created_at, updated_at, triggered_parameter, baseline_value, current_value, deviation_value,
          NULL
        FROM notifications;

        DROP TABLE notifications;
        ALTER TABLE notifications_v8 RENAME TO notifications;

        CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);
      `);
    }
  }
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>;
  const appliedSet = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.version)) {
      const tx = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(
          migration.version,
          migration.description
        );
      });
      tx();
      console.log(`[DB] Applied migration ${migration.version}: ${migration.description}`);
    }
  }
}
