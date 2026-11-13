import type { Patient, EmergencyContact } from '../types/patient';
import type { VitalObservation } from '../types/observation';
import { validateAndNormalizeWhatsAppPhone } from './patientAssets';

export interface AbnormalVitalDetail {
  parameter: 'HEART_RATE' | 'SPO2' | 'RESPIRATORY_RATE' | 'TEMPERATURE';
  label: string;
  baselineDisplay: string;
  currentDisplay: string;
  deviationDisplay: string;
  deviationValue: number;
  unit: string;
  safetyLimitTriggered?: boolean;
}

export interface PatientWhatsAppAlertResult {
  valid: boolean;
  patientId: string;
  patientName: string;
  recipientPhone: string;
  whatsappUrl: string;
  messageText: string;
  detectionTime: string;
  abnormals: AbnormalVitalDetail[];
  error?: string;
}

export function formatSignedDeviation(value: number, unit: string): string {
  const rounded = Number(value.toFixed(1));
  const absFormatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  const sign = rounded >= 0 ? '+' : '';
  return unit === '°C' ? `${sign}${absFormatted}°C` : `${sign}${absFormatted} ${unit}`;
}

export function resolveDetectionTimestamp(params: {
  patientId: string;
  explicitTimestamp?: string | null;
  patientVitalsTimestamp?: string | null;
  observations?: VitalObservation[];
}): { valid: boolean; formatted: string; error?: string } {
  const formatIsoUtc = (ms: number): string => {
    const iso = new Date(ms).toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
  };

  if (params.explicitTimestamp && params.explicitTimestamp.trim()) {
    const raw = params.explicitTimestamp.trim();
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return { valid: true, formatted: formatIsoUtc(parsed) };
    }
    const normalizedUtc = raw.endsWith(' UTC') ? raw.replace(' UTC', 'Z').replace(' ', 'T') : '';
    if (normalizedUtc) {
      const parsedUtc = Date.parse(normalizedUtc);
      if (!Number.isNaN(parsedUtc)) {
        return { valid: true, formatted: formatIsoUtc(parsedUtc) };
      }
    }
    return {
      valid: false,
      formatted: '',
      error: `Invalid detection timestamp "${raw}" for patient ${params.patientId}.`
    };
  }

  // Strictly filter observations by patientId so previous patient records can never leak
  const patientObservations = (params.observations || []).filter(
    (obs) => obs && obs.patientId === params.patientId && obs.timestamp
  );
  if (patientObservations.length > 0) {
    const sorted = [...patientObservations].sort((a, b) => {
      const ta = Date.parse(a.timestamp);
      const tb = Date.parse(b.timestamp);
      if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
      return 0;
    });
    const latestTs = sorted[0].timestamp;
    const parsed = Date.parse(latestTs);
    if (!Number.isNaN(parsed)) {
      return { valid: true, formatted: formatIsoUtc(parsed) };
    }
  }

  const rawVitalTs = String(params.patientVitalsTimestamp || '').trim();
  if (!rawVitalTs) {
    return {
      valid: false,
      formatted: '',
      error: `Detection timestamp is missing for patient ${params.patientId}.`
    };
  }

  const parsedDirect = Date.parse(rawVitalTs);
  if (!Number.isNaN(parsedDirect)) {
    return { valid: true, formatted: formatIsoUtc(parsedDirect) };
  }

  // Handle relative timestamps stored in seed snapshots (e.g. "2 mins ago", "Just now") or "HH:MM UTC"
  if (/^just\s+now$/i.test(rawVitalTs)) {
    return { valid: true, formatted: formatIsoUtc(Date.now()) };
  }
  const minsMatch = rawVitalTs.match(/^(\d+)\s*min(?:s|ute|utes)?\s*ago$/i);
  if (minsMatch) {
    const mins = Number(minsMatch[1]);
    return { valid: true, formatted: formatIsoUtc(Date.now() - mins * 60_000) };
  }
  const hhmmMatch = rawVitalTs.match(/^(\d{2}):(\d{2})(?:\s*UTC)?$/i);
  if (hhmmMatch) {
    const today = new Date().toISOString().slice(0, 10);
    const candidate = `${today}T${hhmmMatch[1]}:${hhmmMatch[2]}:00Z`;
    const parsedCandidate = Date.parse(candidate);
    if (!Number.isNaN(parsedCandidate)) {
      return { valid: true, formatted: formatIsoUtc(parsedCandidate) };
    }
  }

  return {
    valid: false,
    formatted: '',
    error: `Detection timestamp "${rawVitalTs}" is not a valid date/time for patient ${params.patientId}.`
  };
}

export function detectPatientAbnormalVitals(
  patient: Pick<Patient, 'id' | 'name' | 'baseline' | 'latestVitals'>
): {
  valid: boolean;
  abnormals: AbnormalVitalDetail[];
  error?: string;
} {
  const base = patient.baseline;
  const latest = patient.latestVitals;

  if (!base || !latest) {
    return {
      valid: false,
      abnormals: [],
      error: `Baseline or current vital readings are missing for ${patient.name} (${patient.id}).`
    };
  }

  if (latest.sensorQuality && latest.sensorQuality !== 'VALID') {
    return {
      valid: false,
      abnormals: [],
      error: `Cannot generate emergency WhatsApp alert for ${patient.name} (${patient.id}): sensor signal quality is ${latest.sensorQuality}.`
    };
  }

  const numericValues = [
    base.heartRate,
    base.spo2,
    base.respiratoryRate,
    base.temperature,
    latest.heartRate,
    latest.spo2,
    latest.respiratoryRate,
    latest.temperature
  ];
  if (numericValues.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    return {
      valid: false,
      abnormals: [],
      error: `Baseline or current vital readings contain invalid numeric values for ${patient.name} (${patient.id}).`
    };
  }

  const hrThresh = Number(base.hrDeviationThreshold ?? 8);
  const spo2Thresh = Number(base.spo2DeviationThreshold ?? 8);
  const rrThresh = Number(base.rrDeviationThreshold ?? 8);
  const tempThresh = Number(base.tempDeviationThreshold ?? 0.8);
  const spo2SafetyLimit = Number(base.spo2LowSafetyLimit ?? 90);

  const abnormals: AbnormalVitalDetail[] = [];

  const hrDelta = Number((latest.heartRate - base.heartRate).toFixed(1));
  if (Math.abs(hrDelta) >= hrThresh) {
    abnormals.push({
      parameter: 'HEART_RATE',
      label: 'Heart Rate',
      baselineDisplay: `${base.heartRate} BPM`,
      currentDisplay: `${latest.heartRate} BPM`,
      deviationDisplay: formatSignedDeviation(hrDelta, 'BPM'),
      deviationValue: hrDelta,
      unit: 'BPM'
    });
  }

  const spo2Delta = Number((latest.spo2 - base.spo2).toFixed(1));
  const spo2DeviationBreached = Math.abs(spo2Delta) >= spo2Thresh;
  const spo2SafetyBreached = latest.spo2 < spo2SafetyLimit;
  if (spo2DeviationBreached || spo2SafetyBreached) {
    const baseDeviation = formatSignedDeviation(spo2Delta, 'percentage points');
    const deviationDisplay = spo2SafetyBreached
      ? `${baseDeviation} (Critical SpO2 < ${spo2SafetyLimit}%)`
      : baseDeviation;
    abnormals.push({
      parameter: 'SPO2',
      label:
        spo2SafetyBreached && !spo2DeviationBreached
          ? `SpO2 (Critical < ${spo2SafetyLimit}%)`
          : 'SpO2',
      baselineDisplay: `${base.spo2}%`,
      currentDisplay: `${latest.spo2}%`,
      deviationDisplay,
      deviationValue: spo2Delta,
      unit: 'percentage points',
      safetyLimitTriggered: spo2SafetyBreached
    });
  }

  const rrDelta = Number((latest.respiratoryRate - base.respiratoryRate).toFixed(1));
  if (Math.abs(rrDelta) >= rrThresh) {
    abnormals.push({
      parameter: 'RESPIRATORY_RATE',
      label: 'Respiration Rate',
      baselineDisplay: `${base.respiratoryRate} breaths/min`,
      currentDisplay: `${latest.respiratoryRate} breaths/min`,
      deviationDisplay: formatSignedDeviation(rrDelta, 'breaths/min'),
      deviationValue: rrDelta,
      unit: 'breaths/min'
    });
  }

  const tempDelta = Number((latest.temperature - base.temperature).toFixed(1));
  if (Math.abs(tempDelta) >= tempThresh) {
    abnormals.push({
      parameter: 'TEMPERATURE',
      label: 'Skin Temperature',
      baselineDisplay: `${base.temperature}°C`,
      currentDisplay: `${latest.temperature}°C`,
      deviationDisplay: formatSignedDeviation(tempDelta, '°C'),
      deviationValue: tempDelta,
      unit: '°C'
    });
  }

  if (abnormals.length === 0) {
    return {
      valid: false,
      abnormals: [],
      error: `No abnormal vital parameters detected for ${patient.name} (${patient.id}). Current vitals are within configured baseline thresholds and SpO2 is >= ${spo2SafetyLimit}%.`
    };
  }

  return { valid: true, abnormals };
}

export function formatEmergencyWhatsAppMessage(params: {
  patientName: string;
  patientId: string;
  abnormals: AbnormalVitalDetail[];
  detectionTime: string;
  isTest?: boolean;
}): string {
  const lines: string[] = [
    '🚨 VITALYNX EMERGENCY ALERT 🚨',
    '',
    'YOUR WARD IS UNDER EMERGENCY SITUATION. PLEASE PAY ATTENTION TOWARDS YOUR WARD.',
    '',
    'PATIENT DETAILS:',
    `Patient Name: ${params.patientName}`,
    `Patient ID: ${params.patientId}`,
    '',
    'ABNORMAL VITAL DETAILS:'
  ];

  if (params.abnormals.length === 1) {
    const item = params.abnormals[0];
    lines.push(`Abnormal Vital: ${item.label}`);
    lines.push(`Baseline: ${item.baselineDisplay}`);
    lines.push(`Current Reading: ${item.currentDisplay}`);
    lines.push(`Deviation: ${item.deviationDisplay}`);
  } else {
    lines.push(`Abnormal Vital: ${params.abnormals.map((a) => a.label).join(', ')}`);
    for (const item of params.abnormals) {
      lines.push('');
      lines.push(`${item.label}:`);
      lines.push(`Baseline: ${item.baselineDisplay}`);
      lines.push(`Current: ${item.currentDisplay}`);
      lines.push(`Deviation: ${item.deviationDisplay}`);
    }
  }

  lines.push('');
  lines.push(`Detection Time: ${params.detectionTime}`);
  lines.push('');
  lines.push('Please check the patient immediately and contact the healthcare provider.');

  if (params.isTest) {
    lines.push('');
    lines.push('[TEST ALERT - VERIFICATION ONLY]');
  }

  return lines.join('\n');
}

export function buildVerifiedPatientWhatsAppAlert(params: {
  expectedPatientId?: string | null;
  patient?: Patient | null;
  patientRegistry?: Patient[];
  contact?: EmergencyContact | null;
  observations?: VitalObservation[];
  explicitDetectionTime?: string | null;
}): PatientWhatsAppAlertResult {
  const emptyFail = (error: string): PatientWhatsAppAlertResult => ({
    valid: false,
    patientId: String(params.expectedPatientId || params.patient?.id || ''),
    patientName: String(params.patient?.name || ''),
    recipientPhone: '',
    whatsappUrl: '#',
    messageText: '',
    detectionTime: '',
    abnormals: [],
    error
  });

  // 1. Verify patient ID exists and matches exactly
  const expectedId = String(params.expectedPatientId || '').trim();
  if (!expectedId) {
    return emptyFail('Patient ID is missing. Cannot verify patient record for WhatsApp emergency alert.');
  }

  const patient = params.patient;
  if (!patient || !patient.id) {
    return emptyFail(`Patient record for ID ${expectedId} could not be found.`);
  }

  if (patient.id !== expectedId) {
    return emptyFail(
      `Patient ID mismatch (${patient.id} vs expected ${expectedId}). Stopped alert generation to prevent mixed patient data.`
    );
  }

  // 2. Verify patient name belongs to this exact patient ID
  const patientName = String(patient.name || '').trim();
  if (!patientName) {
    return emptyFail(`Patient name is missing for patient ID ${patient.id}.`);
  }

  if (params.patientRegistry && params.patientRegistry.length > 0) {
    const canonical = params.patientRegistry.find((p) => p.id === expectedId);
    if (!canonical || canonical.id !== patient.id || canonical.name.trim() !== patientName) {
      return emptyFail(
        `Patient verification failed: name/ID mismatch for ${expectedId}. Stopped alert generation.`
      );
    }
  }

  // 3. Verify emergency contact belongs to this patient and has valid international phone
  const contact = params.contact;
  if (!contact) {
    return emptyFail(`Emergency contact record is missing for ${patientName} (${patient.id}).`);
  }

  if (contact.patientId && contact.patientId !== patient.id) {
    return emptyFail(
      `Emergency contact "${contact.name}" belongs to ${contact.patientId}, not ${patient.id}. Stopped alert generation.`
    );
  }

  const knownContacts: EmergencyContact[] =
    patient.emergencyContacts && patient.emergencyContacts.length > 0
      ? patient.emergencyContacts
      : [
          patient.primaryEmergencyContact,
          ...(patient.alternativeEmergencyContact?.phone ? [patient.alternativeEmergencyContact] : [])
        ];

  const belongsToPatient = knownContacts.some(
    (c) =>
      (contact.id && c.id ? c.id === contact.id : true) &&
      c.name === contact.name &&
      c.phone === contact.phone
  );

  if (!belongsToPatient) {
    return emptyFail(
      `Emergency contact "${contact.name}" could not be verified on ${patientName}'s (${patient.id}) profile.`
    );
  }

  const phoneCheck = validateAndNormalizeWhatsAppPhone(contact.phone);
  if (!phoneCheck.valid) {
    return emptyFail(`${contact.name}: ${phoneCheck.error || 'Invalid emergency contact phone number.'}`);
  }

  // 4. Verify baseline & current vitals belong to this patient and detect all abnormal vitals
  if (params.observations && params.observations.some((obs) => obs.patientId && obs.patientId !== patient.id)) {
    // Only consider observations strictly matching patient.id; ignore stale mismatched cache if any
  }
  const patientObservations = (params.observations || []).filter((obs) => obs.patientId === patient.id);

  const vitalCheck = detectPatientAbnormalVitals(patient);
  if (!vitalCheck.valid || vitalCheck.abnormals.length === 0) {
    return emptyFail(
      vitalCheck.error || `No abnormal vital parameters detected for ${patientName} (${patient.id}).`
    );
  }

  // 5. Verify detection timestamp is valid
  const tsCheck = resolveDetectionTimestamp({
    patientId: patient.id,
    explicitTimestamp: params.explicitDetectionTime,
    patientVitalsTimestamp: patient.latestVitals?.timestamp,
    observations: patientObservations
  });
  if (!tsCheck.valid) {
    return emptyFail(tsCheck.error || `Invalid detection timestamp for ${patientName} (${patient.id}).`);
  }

  // 6. Generate exact WhatsApp message and URL-encode completely
  const messageText = formatEmergencyWhatsAppMessage({
    patientName,
    patientId: patient.id,
    abnormals: vitalCheck.abnormals,
    detectionTime: tsCheck.formatted
  });

  const whatsappUrl = `https://wa.me/${phoneCheck.phone}?text=${encodeURIComponent(messageText)}`;

  return {
    valid: true,
    patientId: patient.id,
    patientName,
    recipientPhone: phoneCheck.phone,
    whatsappUrl,
    messageText,
    detectionTime: tsCheck.formatted,
    abnormals: vitalCheck.abnormals
  };
}
