import type Database from 'better-sqlite3';
import { formatPhoneE164, formatWhatsAppLink } from '../../src/utils/patientAssets.ts';
import {
  formatEmergencyWhatsAppMessage,
  detectPatientAbnormalVitals,
  resolveDetectionTimestamp,
  type AbnormalVitalDetail
} from '../../src/utils/emergencyWhatsAppBuilder.ts';
import type {
  EmergencyNotification,
  SmsGatewayStatus,
  WhatsAppAlertStatus
} from '../../src/types/notification.ts';
import { evaluateDeviationAndSafetyEvents } from './alertEngine.ts';

export interface WhatsAppDispatchParams {
  alertId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  vitalSignReading: string;
  timestamp: string;
  abnormalParameter?: string;
  baselineValue?: string;
  currentValue?: string;
  deviationValue?: string;
  abnormals?: AbnormalVitalDetail[];
  idempotencySuffix?: string;
  vitals: {
    spo2: number;
    respiratoryRate: number;
    heartRate: number;
    temperature: number;
  };
}

export interface TestWhatsAppDispatchParams {
  patientId: string;
  patientName: string;
  doctorId: string;
  recipientPhone: string;
  recipientName?: string;
  timestamp: string;
  testBaseline?: {
    heartRate: number;
    spo2: number;
    respiratoryRate: number;
    temperature: number;
  };
  testReading?: {
    heartRate: number;
    spo2: number;
    respiratoryRate: number;
    temperature: number;
  };
  vitals?: {
    spo2: number;
    respiratoryRate: number;
    heartRate: number;
    temperature: number;
  };
  consentConfirmed: boolean;
}

export function isValidWhatsAppPhoneNumber(phone: string): {
  valid: boolean;
  normalized: string;
  reason?: string;
} {
  const normalized = formatPhoneE164(phone);
  if (!normalized || !/^\+[1-9]\d{9,14}$/.test(normalized)) {
    return {
      valid: false,
      normalized: phone || '',
      reason: `Invalid guardian mobile number: "${phone || 'empty'}". Valid number with 10-15 digits required (e.g. +919353802577 or +15557654321).`
    };
  }
  return { valid: true, normalized };
}

export function getWhatsAppGatewayStatus(): SmsGatewayStatus {
  return {
    configured: true,
    provider: 'WHATSAPP_NORMAL',
    mode: 'Normal WhatsApp App Deep Links (https://wa.me)',
    requiresDlt: false,
    requiresApiKey: false,
    fromIdentifier: 'Device Normal WhatsApp App',
    webhookUrl: null,
    configurationError: null
  };
}

export function buildEmergencyWhatsAppMessage(params: {
  patientName: string;
  patientId: string;
  parameter: string;
  baselineValue: string;
  currentValue: string;
  deviationValue: string;
  detectionTime: string;
  abnormals?: AbnormalVitalDetail[];
  isTest?: boolean;
}): string {
  const abnormals: AbnormalVitalDetail[] =
    params.abnormals && params.abnormals.length > 0
      ? params.abnormals
      : [
          {
            parameter: 'HEART_RATE',
            label: params.parameter,
            baselineDisplay: params.baselineValue,
            currentDisplay: params.currentValue,
            deviationDisplay: params.deviationValue,
            deviationValue: 0,
            unit: ''
          }
        ];

  return formatEmergencyWhatsAppMessage({
    patientName: params.patientName,
    patientId: params.patientId,
    abnormals,
    detectionTime: params.detectionTime,
    isTest: params.isTest
  });
}

export function mapNotificationRow(row: any): EmergencyNotification {
  const rawStatus = String(row.delivery_status || 'READY TO SEND').toUpperCase();
  const deliveryStatus: WhatsAppAlertStatus =
    rawStatus === 'USER CONFIRMED SENT'
      ? 'USER CONFIRMED SENT'
      : rawStatus === 'OPENED'
      ? 'OPENED'
      : 'READY TO SEND';

  const normalizedPhone = formatPhoneE164(row.recipient_phone) || row.recipient_phone;
  const whatsappUrl =
    row.whatsapp_url && String(row.whatsapp_url).startsWith('https://wa.me/')
      ? row.whatsapp_url
      : formatWhatsAppLink(normalizedPhone, row.message_text);

  return {
    id: row.id,
    alertId: row.alert_id ?? null,
    patientId: row.patient_id,
    patientName: row.patient_name || undefined,
    doctorId: row.doctor_id || undefined,
    recipientName: row.recipient_name,
    recipientType: row.recipient_type,
    recipientPhone: normalizedPhone,
    abnormalParameter: row.triggered_parameter ?? null,
    baselineValue: row.baseline_value ?? null,
    currentValue: row.current_value ?? null,
    deviationValue: row.deviation_value ?? null,
    detectionTime: row.created_at,
    messageText: row.message_text,
    whatsappUrl,
    deliveryStatus,
    alertType: row.alert_type || (row.is_test ? 'TEST_ALERT' : 'REAL_EMERGENCY'),
    isTest: Boolean(row.is_test),
    provider: row.provider || 'WHATSAPP_NORMAL',
    providerMessageId: row.provider_message_id ?? null,
    providerResponse: row.provider_response ?? null,
    errorReason: row.error_reason ?? null,
    retryCount: Number(row.retry_count || 0),
    openedAt: row.opened_at ?? null,
    confirmedSentAt: row.confirmed_sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function prepareWhatsAppAlertsForEmergency(
  db: Database.Database,
  params: WhatsAppDispatchParams,
  onNotificationEvent?: (notification: EmergencyNotification) => void
): Promise<EmergencyNotification[]> {
  // Strict patient verification against canonical patient record in DB
  const canonicalPatient = db
    .prepare('SELECT id, name FROM patients WHERE id = ?')
    .get(params.patientId) as { id: string; name: string } | undefined;

  if (!canonicalPatient || canonicalPatient.id !== params.patientId) {
    throw new Error(`Patient record verification failed for ID ${params.patientId}.`);
  }
  if (canonicalPatient.name.trim() !== String(params.patientName || '').trim()) {
    throw new Error(
      `Patient name mismatch for ${params.patientId}: expected "${canonicalPatient.name}", got "${params.patientName}".`
    );
  }

  const tsCheck = resolveDetectionTimestamp({
    patientId: canonicalPatient.id,
    explicitTimestamp: params.timestamp
  });
  if (!tsCheck.valid) {
    throw new Error(tsCheck.error || 'Invalid emergency detection timestamp.');
  }

  const contacts = db
    .prepare(`
      SELECT id, contact_type, name, relationship, phone, priority
      FROM emergency_contacts
      WHERE patient_id = ?
      ORDER BY priority ASC, updated_at ASC
    `)
    .all(canonicalPatient.id) as Array<{
    id: string;
    contact_type: 'PRIMARY' | 'ALTERNATE' | 'ADDITIONAL';
    name: string;
    relationship: string;
    phone: string;
    priority: number;
  }>;

  if (contacts.length === 0) {
    return [];
  }

  const abnormals =
    params.abnormals && params.abnormals.length > 0 ? params.abnormals : undefined;

  const parameterLabel =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => a.label).join(', ')
      : params.abnormalParameter || 'Vital Sign Deviation';
  const baselineVal =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => `${a.label}: ${a.baselineDisplay}`).join(' | ')
      : params.baselineValue || 'Saved Baseline';
  const currentVal =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => `${a.label}: ${a.currentDisplay}`).join(' | ')
      : params.currentValue || params.vitalSignReading;
  const deviationVal =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => `${a.label}: ${a.deviationDisplay}`).join(' | ')
      : params.deviationValue || 'Threshold Breached';

  const messageText = buildEmergencyWhatsAppMessage({
    patientName: canonicalPatient.name,
    patientId: canonicalPatient.id,
    parameter: parameterLabel,
    baselineValue: baselineVal,
    currentValue: currentVal,
    deviationValue: deviationVal,
    detectionTime: tsCheck.formatted,
    abnormals,
    isTest: false
  });

  const results: EmergencyNotification[] = [];

  for (const contact of contacts) {
    const suffix = params.idempotencySuffix ? `:${params.idempotencySuffix}` : '';
    const idempotencyKey =
      contact.contact_type === 'ADDITIONAL'
        ? `${params.alertId}:${contact.id}${suffix}`
        : `${params.alertId}:${contact.contact_type}${suffix}`;

    const existing = db.prepare('SELECT * FROM notifications WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing) {
      results.push(mapNotificationRow({ ...(existing as object), patient_name: params.patientName }));
      continue;
    }

    const notifId = `WA-${Date.now()}-${contact.contact_type.slice(0, 3)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const phoneCheck = isValidWhatsAppPhoneNumber(contact.phone);
    const normalizedPhone = phoneCheck.valid ? phoneCheck.normalized : contact.phone || 'MISSING';
    const whatsappUrl = phoneCheck.valid ? formatWhatsAppLink(normalizedPhone, messageText) : '';
    const errorReason = phoneCheck.valid ? null : phoneCheck.reason || 'Invalid guardian phone number.';

    db.prepare(`
      INSERT INTO notifications (
        id, alert_id, patient_id, doctor_id, recipient_name, recipient_type,
        recipient_phone, message_text, whatsapp_url, delivery_status, alert_type, is_test,
        provider, provider_message_id, provider_response, error_reason, retry_count, idempotency_key,
        triggered_parameter, baseline_value, current_value, deviation_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY TO SEND', 'REAL_EMERGENCY', 0, 'WHATSAPP_NORMAL', NULL, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      notifId,
      params.alertId,
      params.patientId,
      params.doctorId,
      contact.name,
      contact.contact_type,
      normalizedPhone,
      messageText,
      whatsappUrl,
      JSON.stringify({ mode: 'WHATSAPP_LINK', contactType: contact.contact_type, relationship: contact.relationship }),
      errorReason,
      idempotencyKey,
      parameterLabel,
      baselineVal,
      currentVal,
      deviationVal
    );

    const inserted = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
    const mapped = mapNotificationRow({ ...(inserted as object), patient_name: params.patientName });
    results.push(mapped);
    onNotificationEvent?.(mapped);
  }

  return results;
}

export async function prepareTestWhatsAppAlert(
  db: Database.Database,
  params: TestWhatsAppDispatchParams,
  onNotificationEvent?: (notification: EmergencyNotification) => void
): Promise<{
  notification: EmergencyNotification;
  evaluatedDeviation: {
    parameter: string;
    baselineValue: string;
    currentValue: string;
    deviationValue: string;
    alertTriggered: boolean;
  };
}> {
  if (!params.consentConfirmed) {
    throw new Error('Explicit guardian/recipient confirmation is required before preparing a test WhatsApp alert.');
  }

  const phoneCheck = isValidWhatsAppPhoneNumber(params.recipientPhone);
  if (!phoneCheck.valid) {
    throw new Error(phoneCheck.reason || 'Invalid WhatsApp mobile number.');
  }

  const canonicalPatient = db
    .prepare('SELECT id, name FROM patients WHERE id = ?')
    .get(params.patientId) as { id: string; name: string } | undefined;

  if (!canonicalPatient || canonicalPatient.id !== params.patientId) {
    throw new Error(`Patient record verification failed for ID ${params.patientId}.`);
  }

  const testBaseline = params.testBaseline || {
    heartRate: 80,
    spo2: 98,
    respiratoryRate: 16,
    temperature: 36.5
  };
  const testReading = params.testReading ||
    params.vitals || {
      heartRate: 92,
      spo2: 98,
      respiratoryRate: 16,
      temperature: 36.5
    };

  const baselineObj = {
    heartRate: Number(testBaseline.heartRate),
    spo2: Number(testBaseline.spo2),
    respiratoryRate: Number(testBaseline.respiratoryRate),
    temperature: Number(testBaseline.temperature),
    calculatedAt: params.timestamp,
    totalObservationCount: 1,
    hrDeviationThreshold: 8,
    spo2DeviationThreshold: 8,
    rrDeviationThreshold: 8,
    tempDeviationThreshold: 0.8,
    spo2LowSafetyLimit: 90
  };
  const readingObj = {
    heartRate: Number(testReading.heartRate),
    spo2: Number(testReading.spo2),
    respiratoryRate: Number(testReading.respiratoryRate),
    temperature: Number(testReading.temperature),
    timestamp: params.timestamp,
    sensorQuality: 'VALID' as const
  };

  const { triggeredEvents, deltas } = evaluateDeviationAndSafetyEvents(
    {
      id: canonicalPatient.id,
      name: canonicalPatient.name,
      baseline: baselineObj
    },
    readingObj
  );

  const detected = detectPatientAbnormalVitals({
    id: canonicalPatient.id,
    name: canonicalPatient.name,
    baseline: baselineObj,
    latestVitals: readingObj
  });

  const tsCheck = resolveDetectionTimestamp({
    patientId: canonicalPatient.id,
    explicitTimestamp: params.timestamp
  });
  const detectionTime = tsCheck.valid ? tsCheck.formatted : params.timestamp;

  const abnormals = detected.valid && detected.abnormals.length > 0 ? detected.abnormals : undefined;
  const primaryEvent = triggeredEvents[0];
  const parameterLabel =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => a.label).join(', ')
      : primaryEvent
      ? primaryEvent.parameterLabel
      : 'Heart Rate';
  const baselineVal =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => `${a.label}: ${a.baselineDisplay}`).join(' | ')
      : `${testBaseline.heartRate} BPM`;
  const currentVal =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => `${a.label}: ${a.currentDisplay}`).join(' | ')
      : `${testReading.heartRate} BPM`;
  const deviationVal =
    abnormals && abnormals.length > 0
      ? abnormals.map((a) => `${a.label}: ${a.deviationDisplay}`).join(' | ')
      : `${deltas.hrDelta >= 0 ? '+' : ''}${deltas.hrDelta} BPM`;

  const messageText = buildEmergencyWhatsAppMessage({
    patientName: canonicalPatient.name,
    patientId: canonicalPatient.id,
    parameter: parameterLabel,
    baselineValue: baselineVal,
    currentValue: currentVal,
    deviationValue: deviationVal,
    detectionTime,
    abnormals,
    isTest: true
  });

  const whatsappUrl = formatWhatsAppLink(phoneCheck.normalized, messageText);
  const notifId = `WA-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const idempotencyKey = `TEST:${params.patientId}:${phoneCheck.normalized}:${Date.now()}`;
  const recipientName = params.recipientName?.trim() || 'Verified Test Guardian';

  db.prepare(`
    INSERT INTO notifications (
      id, alert_id, patient_id, doctor_id, recipient_name, recipient_type,
      recipient_phone, message_text, whatsapp_url, delivery_status, alert_type, is_test,
      provider, provider_message_id, provider_response, error_reason, retry_count, idempotency_key,
      triggered_parameter, baseline_value, current_value, deviation_value
    ) VALUES (?, NULL, ?, ?, ?, 'TEST_RECIPIENT', ?, ?, ?, 'READY TO SEND', 'TEST_ALERT', 1, 'WHATSAPP_NORMAL', NULL, ?, NULL, 0, ?, ?, ?, ?, ?)
  `).run(
    notifId,
    params.patientId,
    params.doctorId,
    recipientName,
    phoneCheck.normalized,
    messageText,
    whatsappUrl,
    JSON.stringify({ mode: 'WHATSAPP_LINK', test: true }),
    idempotencyKey,
    parameterLabel,
    baselineVal,
    currentVal,
    deviationVal
  );

  const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);
  const mapped = mapNotificationRow({ ...(updated as object), patient_name: params.patientName });
  onNotificationEvent?.(mapped);

  return {
    notification: mapped,
    evaluatedDeviation: {
      parameter: parameterLabel,
      baselineValue: baselineVal,
      currentValue: currentVal,
      deviationValue: deviationVal,
      alertTriggered: triggeredEvents.length > 0
    }
  };
}

export function markWhatsAppNotificationOpened(
  db: Database.Database,
  notificationId: string,
  onNotificationEvent?: (notification: EmergencyNotification) => void
): EmergencyNotification {
  const row = db
    .prepare(`
      SELECT n.*, p.name as patient_name
      FROM notifications n
      JOIN patients p ON p.id = n.patient_id
      WHERE n.id = ?
    `)
    .get(notificationId) as any;

  if (!row) {
    throw new Error('WhatsApp alert record not found.');
  }

  // Do not downgrade USER CONFIRMED SENT back to OPENED
  const nextStatus: WhatsAppAlertStatus =
    row.delivery_status === 'USER CONFIRMED SENT' ? 'USER CONFIRMED SENT' : 'OPENED';

  db.prepare(`
    UPDATE notifications
    SET delivery_status = ?,
        opened_at = COALESCE(opened_at, datetime('now')),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(nextStatus, notificationId);

  const updated = db
    .prepare(`
      SELECT n.*, p.name as patient_name
      FROM notifications n
      JOIN patients p ON p.id = n.patient_id
      WHERE n.id = ?
    `)
    .get(notificationId);
  const mapped = mapNotificationRow(updated);
  onNotificationEvent?.(mapped);
  return mapped;
}

export function markWhatsAppNotificationConfirmedSent(
  db: Database.Database,
  notificationId: string,
  onNotificationEvent?: (notification: EmergencyNotification) => void
): EmergencyNotification {
  const row = db
    .prepare(`
      SELECT n.*, p.name as patient_name
      FROM notifications n
      JOIN patients p ON p.id = n.patient_id
      WHERE n.id = ?
    `)
    .get(notificationId) as any;

  if (!row) {
    throw new Error('WhatsApp alert record not found.');
  }

  db.prepare(`
    UPDATE notifications
    SET delivery_status = 'USER CONFIRMED SENT',
        opened_at = COALESCE(opened_at, datetime('now')),
        confirmed_sent_at = COALESCE(confirmed_sent_at, datetime('now')),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(notificationId);

  const updated = db
    .prepare(`
      SELECT n.*, p.name as patient_name
      FROM notifications n
      JOIN patients p ON p.id = n.patient_id
      WHERE n.id = ?
    `)
    .get(notificationId);
  const mapped = mapNotificationRow(updated);
  onNotificationEvent?.(mapped);
  return mapped;
}
