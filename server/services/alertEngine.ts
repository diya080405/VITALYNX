import type Database from 'better-sqlite3';
import type { Patient, LatestVitals, AlertCategory } from '../../src/types/patient';
import type { ClinicalAlertCategory } from '../../src/types/alert';
import type { ClinicalThresholdsConfig } from '../../src/types/notification';

export const DEFAULT_CLINICAL_THRESHOLDS: ClinicalThresholdsConfig = {
  spo2CriticalScale1: Number(process.env.THRESHOLD_SPO2_SCALE1) || 89, // SpO2 below 90%
  spo2CriticalScale2: Number(process.env.THRESHOLD_SPO2_SCALE2) || 84, // SpO2 below 85% (hypercapnic Scale 2)
  hrCriticalHigh: Number(process.env.THRESHOLD_HR_HIGH) || 130,
  hrCriticalLow: Number(process.env.THRESHOLD_HR_LOW) || 40,
  rrCriticalHigh: Number(process.env.THRESHOLD_RR_HIGH) || 25,
  rrCriticalLow: Number(process.env.THRESHOLD_RR_LOW) || 8,
  tempCriticalHigh: Number(process.env.THRESHOLD_TEMP_HIGH) || 38.8,
  tempCriticalLow: Number(process.env.THRESHOLD_TEMP_LOW) || 35.0,
  news2CriticalThreshold: Number(process.env.THRESHOLD_NEWS2_CRITICAL) || 7,
  alertCooldownMinutes: Number(process.env.ALERT_COOLDOWN_MINUTES) || 15,
  maxSmsRetries: 3
};

export function getClinicalThresholds(db: Database.Database): ClinicalThresholdsConfig {
  try {
    const row = db.prepare('SELECT * FROM clinical_thresholds WHERE id = ?').get('DEFAULT') as any;
    if (!row) return { ...DEFAULT_CLINICAL_THRESHOLDS };
    return {
      spo2CriticalScale1: Number(row.spo2_critical_scale1),
      spo2CriticalScale2: Number(row.spo2_critical_scale2),
      hrCriticalHigh: Number(row.hr_critical_high),
      hrCriticalLow: Number(row.hr_critical_low),
      rrCriticalHigh: Number(row.rr_critical_high),
      rrCriticalLow: Number(row.rr_critical_low),
      tempCriticalHigh: Number(row.temp_critical_high),
      tempCriticalLow: Number(row.temp_critical_low),
      news2CriticalThreshold: Number(row.news2_critical_threshold),
      alertCooldownMinutes: Number(row.alert_cooldown_minutes),
      maxSmsRetries: Number(row.max_sms_retries),
      updatedAt: row.updated_at
    };
  } catch {
    return { ...DEFAULT_CLINICAL_THRESHOLDS };
  }
}

export function updateClinicalThresholds(
  db: Database.Database,
  patch: Partial<ClinicalThresholdsConfig>
): ClinicalThresholdsConfig {
  const current = getClinicalThresholds(db);
  const next: ClinicalThresholdsConfig = {
    spo2CriticalScale1: clampNum(patch.spo2CriticalScale1, current.spo2CriticalScale1, 75, 95),
    spo2CriticalScale2: clampNum(patch.spo2CriticalScale2, current.spo2CriticalScale2, 70, 92),
    hrCriticalHigh: clampNum(patch.hrCriticalHigh, current.hrCriticalHigh, 100, 180),
    hrCriticalLow: clampNum(patch.hrCriticalLow, current.hrCriticalLow, 25, 60),
    rrCriticalHigh: clampNum(patch.rrCriticalHigh, current.rrCriticalHigh, 20, 45),
    rrCriticalLow: clampNum(patch.rrCriticalLow, current.rrCriticalLow, 4, 14),
    tempCriticalHigh: clampNum(patch.tempCriticalHigh, current.tempCriticalHigh, 37.5, 42.0),
    tempCriticalLow: clampNum(patch.tempCriticalLow, current.tempCriticalLow, 32.0, 36.2),
    news2CriticalThreshold: Math.round(
      clampNum(patch.news2CriticalThreshold, current.news2CriticalThreshold, 5, 15)
    ),
    alertCooldownMinutes: Math.round(
      clampNum(patch.alertCooldownMinutes, current.alertCooldownMinutes, 1, 120)
    ),
    maxSmsRetries: Math.round(clampNum(patch.maxSmsRetries, current.maxSmsRetries, 1, 5))
  };

  db.prepare(`
    INSERT INTO clinical_thresholds (
      id, spo2_critical_scale1, spo2_critical_scale2, hr_critical_high, hr_critical_low,
      rr_critical_high, rr_critical_low, temp_critical_high, temp_critical_low,
      news2_critical_threshold, alert_cooldown_minutes, max_sms_retries, updated_at
    ) VALUES ('DEFAULT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      spo2_critical_scale1 = excluded.spo2_critical_scale1,
      spo2_critical_scale2 = excluded.spo2_critical_scale2,
      hr_critical_high = excluded.hr_critical_high,
      hr_critical_low = excluded.hr_critical_low,
      rr_critical_high = excluded.rr_critical_high,
      rr_critical_low = excluded.rr_critical_low,
      temp_critical_high = excluded.temp_critical_high,
      temp_critical_low = excluded.temp_critical_low,
      news2_critical_threshold = excluded.news2_critical_threshold,
      alert_cooldown_minutes = excluded.alert_cooldown_minutes,
      max_sms_retries = excluded.max_sms_retries,
      updated_at = datetime('now')
  `).run(
    next.spo2CriticalScale1,
    next.spo2CriticalScale2,
    next.hrCriticalHigh,
    next.hrCriticalLow,
    next.rrCriticalHigh,
    next.rrCriticalLow,
    next.tempCriticalHigh,
    next.tempCriticalLow,
    next.news2CriticalThreshold,
    next.alertCooldownMinutes,
    next.maxSmsRetries
  );

  return getClinicalThresholds(db);
}

function clampNum(val: unknown, fallback: number, min: number, max: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export interface News2StyleEvaluation {
  totalScore: number;
  breakdown: {
    respiratoryRateScore: number;
    spo2Score: number;
    supplementalOxygenScore: number;
    temperatureScore: number;
    systolicBPScore: number;
    heartRateScore: number;
    consciousnessScore: number;
  };
  missingParameters: string[];
  isValidSignal: boolean;
}

export interface TriggeredVitalEvent {
  eventType: 'DEVIATION_BREACH' | 'SPO2_SAFETY_LIMIT';
  parameter: 'HEART_RATE' | 'SPO2' | 'RESPIRATORY_RATE' | 'TEMPERATURE' | 'MULTIVARIATE';
  parameterLabel: string;
  baselineDisplay: string;
  currentDisplay: string;
  deviationDisplay: string;
  deviationMagnitude: number;
  thresholdDisplay: string;
  ruleApplied: string;
  explanation: string;
  cooldownKey: string;
  readingSignature: string;
}

export interface DeteriorationDecision {
  alertCategory: AlertCategory;
  news2Evaluation: News2StyleEvaluation;
  shouldCreateAlert: boolean;
  alertLevel?: ClinicalAlertCategory;
  shouldTriggerEmergencySms: boolean;
  parameter: 'HEART_RATE' | 'SPO2' | 'RESPIRATORY_RATE' | 'TEMPERATURE' | 'MULTIVARIATE';
  ruleApplied: string;
  vitalSignReading: string;
  baselineDisplay?: string;
  currentDisplay?: string;
  deviationDisplay?: string;
  deviationMagnitude?: number;
  explanation: string;
  suggestedAction: string;
  statusExplanation: string;
  triggeredEvents: TriggeredVitalEvent[];
}

export function evaluateDeviationAndSafetyEvents(
  patient: Pick<Patient, 'id' | 'name' | 'baseline'>,
  vitals: { heartRate: number; spo2: number; respiratoryRate: number; temperature: number }
): {
  triggeredEvents: TriggeredVitalEvent[];
  deltas: { hrDelta: number; spo2Delta: number; rrDelta: number; tempDelta: number };
} {
  const base = patient.baseline;
  const hrThresh = Number(base.hrDeviationThreshold ?? 8);
  const spo2Thresh = Number(base.spo2DeviationThreshold ?? 8);
  const rrThresh = Number(base.rrDeviationThreshold ?? 8);
  const tempThresh = Number(base.tempDeviationThreshold ?? 0.8);
  const spo2SafetyLimit = Number(base.spo2LowSafetyLimit ?? 90);

  const hrDelta = Number((vitals.heartRate - base.heartRate).toFixed(1));
  const spo2Delta = Number((vitals.spo2 - base.spo2).toFixed(1));
  const rrDelta = Number((vitals.respiratoryRate - base.respiratoryRate).toFixed(1));
  const tempDelta = Number((vitals.temperature - base.temperature).toFixed(1));

  const sigSuffix = `${vitals.heartRate}|${vitals.spo2}|${vitals.respiratoryRate}|${vitals.temperature}`;
  const events: TriggeredVitalEvent[] = [];

  if (Math.abs(hrDelta) >= hrThresh) {
    const sign = hrDelta >= 0 ? '+' : '';
    events.push({
      eventType: 'DEVIATION_BREACH',
      parameter: 'HEART_RATE',
      parameterLabel: 'Heart Rate (BPM)',
      baselineDisplay: `${base.heartRate} BPM`,
      currentDisplay: `${vitals.heartRate} BPM`,
      deviationDisplay: `${sign}${hrDelta} BPM`,
      deviationMagnitude: Number(Math.abs(hrDelta).toFixed(2)),
      thresholdDisplay: `±${hrThresh} BPM`,
      ruleApplied: `Rule DEV-HR: Heart Rate deviation ${sign}${hrDelta} BPM breached saved threshold (±${hrThresh} BPM)`,
      explanation: `Heart Rate shifted by ${sign}${hrDelta} BPM from ${patient.name}'s saved baseline (${base.heartRate} -> ${vitals.heartRate} BPM), exceeding ±${hrThresh} BPM.`,
      cooldownKey: `${patient.id}:URGENT:DEVIATION:HEART_RATE`,
      readingSignature: `HR:${sigSuffix}`
    });
  }

  if (Math.abs(spo2Delta) >= spo2Thresh) {
    const sign = spo2Delta >= 0 ? '+' : '';
    events.push({
      eventType: 'DEVIATION_BREACH',
      parameter: 'SPO2',
      parameterLabel: 'SpO2 (%)',
      baselineDisplay: `${base.spo2}%`,
      currentDisplay: `${vitals.spo2}%`,
      deviationDisplay: `${sign}${spo2Delta}%`,
      deviationMagnitude: Number(Math.abs(spo2Delta).toFixed(2)),
      thresholdDisplay: `±${spo2Thresh}%`,
      ruleApplied: `Rule DEV-SPO2: SpO2 deviation ${sign}${spo2Delta}% breached saved threshold (±${spo2Thresh}%)`,
      explanation: `Oxygen saturation shifted by ${sign}${spo2Delta} percentage points from ${patient.name}'s saved baseline (${base.spo2}% -> ${vitals.spo2}%), exceeding ±${spo2Thresh}%.`,
      cooldownKey: `${patient.id}:URGENT:DEVIATION:SPO2`,
      readingSignature: `SPO2:${sigSuffix}`
    });
  }

  if (Math.abs(rrDelta) >= rrThresh) {
    const sign = rrDelta >= 0 ? '+' : '';
    events.push({
      eventType: 'DEVIATION_BREACH',
      parameter: 'RESPIRATORY_RATE',
      parameterLabel: 'Respiration Rate (breaths/min)',
      baselineDisplay: `${base.respiratoryRate} breaths/min`,
      currentDisplay: `${vitals.respiratoryRate} breaths/min`,
      deviationDisplay: `${sign}${rrDelta} breaths/min`,
      deviationMagnitude: Number(Math.abs(rrDelta).toFixed(2)),
      thresholdDisplay: `±${rrThresh} breaths/min`,
      ruleApplied: `Rule DEV-RR: Respiration Rate deviation ${sign}${rrDelta} breaths/min breached saved threshold (±${rrThresh})`,
      explanation: `Respiration Rate shifted by ${sign}${rrDelta} breaths/min from ${patient.name}'s saved baseline (${base.respiratoryRate} -> ${vitals.respiratoryRate} breaths/min), exceeding ±${rrThresh}.`,
      cooldownKey: `${patient.id}:URGENT:DEVIATION:RESPIRATORY_RATE`,
      readingSignature: `RR:${sigSuffix}`
    });
  }

  if (Math.abs(tempDelta) >= tempThresh) {
    const sign = tempDelta >= 0 ? '+' : '';
    events.push({
      eventType: 'DEVIATION_BREACH',
      parameter: 'TEMPERATURE',
      parameterLabel: 'Skin Temperature (°C)',
      baselineDisplay: `${base.temperature}°C`,
      currentDisplay: `${vitals.temperature}°C`,
      deviationDisplay: `${sign}${tempDelta}°C`,
      deviationMagnitude: Number(Math.abs(tempDelta).toFixed(2)),
      thresholdDisplay: `±${tempThresh}°C`,
      ruleApplied: `Rule DEV-TEMP: Skin Temperature deviation ${sign}${tempDelta}°C breached saved threshold (±${tempThresh}°C)`,
      explanation: `Skin Temperature shifted by ${sign}${tempDelta}°C from ${patient.name}'s saved baseline (${base.temperature}°C -> ${vitals.temperature}°C), exceeding ±${tempThresh}°C.`,
      cooldownKey: `${patient.id}:URGENT:DEVIATION:TEMPERATURE`,
      readingSignature: `TEMP:${sigSuffix}`
    });
  }

  // Separate mandatory safety alert whenever SpO2 falls below configured critical limit (default 90%)
  if (vitals.spo2 < spo2SafetyLimit) {
    const belowLimit = Number((vitals.spo2 - spo2SafetyLimit).toFixed(1));
    events.push({
      eventType: 'SPO2_SAFETY_LIMIT',
      parameter: 'SPO2',
      parameterLabel: `SpO2 Critical Safety Limit (<${spo2SafetyLimit}%)`,
      baselineDisplay: `${spo2SafetyLimit}% (Safety Limit) / ${base.spo2}% (Baseline)`,
      currentDisplay: `${vitals.spo2}%`,
      deviationDisplay: `${belowLimit}% below ${spo2SafetyLimit}% safety limit`,
      deviationMagnitude: Number(Math.abs(belowLimit).toFixed(2)),
      thresholdDisplay: `< ${spo2SafetyLimit}%`,
      ruleApplied: `Rule SAF-SPO2: Critical Hypoxemia Safety Alert (SpO2 ${vitals.spo2}% < ${spo2SafetyLimit}% limit)`,
      explanation: `Immediate critical safety alert: SpO2 (${vitals.spo2}%) fell below the configured critical safety limit of ${spo2SafetyLimit}% (patient baseline ${base.spo2}%).`,
      cooldownKey: `${patient.id}:URGENT:SPO2_SAFETY_LIMIT`,
      readingSignature: `SPO2_SAFETY:${sigSuffix}`
    });
  }

  return {
    triggeredEvents: events,
    deltas: { hrDelta, spo2Delta, rrDelta, tempDelta }
  };
}

function parseSystolicBp(bp?: string): number | null {
  if (!bp) return null;
  const parts = bp.split('/');
  const sys = Number(parts[0]);
  return Number.isFinite(sys) && sys > 0 ? sys : null;
}

export function evaluateNews2StyleScore(
  patient: Patient,
  vitals: LatestVitals
): News2StyleEvaluation {
  const isValidSignal = vitals.sensorQuality === 'VALID';
  const missingParameters: string[] = [];

  if (!isValidSignal) {
    // Safety policy: never silently fill 0 points for missing/artifact parameters.
    return {
      totalScore: 0,
      breakdown: {
        respiratoryRateScore: 0,
        spo2Score: 0,
        supplementalOxygenScore: 0,
        temperatureScore: 0,
        systolicBPScore: 0,
        heartRateScore: 0,
        consciousnessScore: 0
      },
      missingParameters: ['heartRate', 'spo2', 'respiratoryRate'],
      isValidSignal: false
    };
  }

  // Respiratory Rate scoring (NEWS2-style)
  let rrScore = 0;
  if (vitals.respiratoryRate <= 8 || vitals.respiratoryRate >= 25) rrScore = 3;
  else if (vitals.respiratoryRate >= 21 && vitals.respiratoryRate <= 24) rrScore = 2;
  else if (vitals.respiratoryRate >= 9 && vitals.respiratoryRate <= 11) rrScore = 1;

  // SpO2 Scale 1 vs Scale 2 (hypercapnic respiratory failure target 88-92%)
  let spo2Score = 0;
  if (patient.spo2Scale === 'SCALE_2') {
    if (vitals.spo2 <= 83) spo2Score = 3;
    else if (vitals.spo2 >= 84 && vitals.spo2 <= 85) spo2Score = 2;
    else if (vitals.spo2 >= 86 && vitals.spo2 <= 87) spo2Score = 1;
    else if (vitals.spo2 >= 88 && vitals.spo2 <= 92) spo2Score = 0;
    else if (vitals.spo2 >= 93 && patient.hasSupplementalOxygen) {
      if (vitals.spo2 >= 97) spo2Score = 3;
      else if (vitals.spo2 >= 95) spo2Score = 2;
      else spo2Score = 1;
    }
  } else {
    if (vitals.spo2 <= 91) spo2Score = 3;
    else if (vitals.spo2 >= 92 && vitals.spo2 <= 93) spo2Score = 2;
    else if (vitals.spo2 >= 94 && vitals.spo2 <= 95) spo2Score = 1;
  }

  const supplementalOxygenScore = patient.hasSupplementalOxygen ? 0 : 0;

  // Body Temperature scoring
  let tempScore = 0;
  if (vitals.temperature <= 35.0) tempScore = 3;
  else if (vitals.temperature >= 39.1) tempScore = 2;
  else if ((vitals.temperature >= 35.1 && vitals.temperature <= 36.0) || (vitals.temperature >= 38.1 && vitals.temperature <= 39.0)) {
    tempScore = 1;
  }

  // Heart Rate scoring
  let hrScore = 0;
  if (vitals.heartRate <= 40 || vitals.heartRate >= 131) hrScore = 3;
  else if (vitals.heartRate >= 111 && vitals.heartRate <= 130) hrScore = 2;
  else if ((vitals.heartRate >= 41 && vitals.heartRate <= 50) || (vitals.heartRate >= 91 && vitals.heartRate <= 110)) {
    hrScore = 1;
  }

  // Systolic BP (if available)
  let bpScore = 0;
  const sysBp = parseSystolicBp(vitals.bloodPressure);
  if (sysBp === null) {
    missingParameters.push('systolicBP');
  } else if (sysBp <= 90 || sysBp >= 220) bpScore = 3;
  else if (sysBp >= 91 && sysBp <= 100) bpScore = 2;
  else if (sysBp >= 101 && sysBp <= 110) bpScore = 1;

  const totalScore = rrScore + spo2Score + supplementalOxygenScore + tempScore + bpScore + hrScore;

  return {
    totalScore,
    breakdown: {
      respiratoryRateScore: rrScore,
      spo2Score,
      supplementalOxygenScore,
      temperatureScore: tempScore,
      systolicBPScore: bpScore,
      heartRateScore: hrScore,
      consciousnessScore: 0
    },
    missingParameters,
    isValidSignal: true
  };
}

export function evaluateClinicalDeterioration(
  patient: Patient,
  vitals: LatestVitals,
  thresholds: ClinicalThresholdsConfig = DEFAULT_CLINICAL_THRESHOLDS
): DeteriorationDecision {
  const news2Evaluation = evaluateNews2StyleScore(patient, vitals);

  // Strict artifact / connectivity gate: non-VALID signals NEVER trigger clinical emergency SMS
  if (vitals.sensorQuality !== 'VALID') {
    const qualityLabel = vitals.sensorQuality;
    return {
      alertCategory: 'OFFLINE',
      news2Evaluation,
      shouldCreateAlert: false,
      shouldTriggerEmergencySms: false,
      parameter: 'MULTIVARIATE',
      ruleApplied: `Artifact Gate (${qualityLabel}): Clinical escalation and SMS suppressed`,
      vitalSignReading: `Signal Quality: ${qualityLabel}`,
      explanation: `Telemetry packet classified as ${qualityLabel}. Sensor artifact isolation prevented false deterioration alerts and blocked emergency SMS dispatch.`,
      suggestedAction: 'Check wearable probe placement, battery, and Bluetooth gateway connection.',
      statusExplanation: `Sensor signal is ${qualityLabel}. Verify wearable contact and gateway connectivity. Artifact filter suppressed false clinical escalation.`,
      triggeredEvents: []
    };
  }

  const { triggeredEvents, deltas } = evaluateDeviationAndSafetyEvents(patient, vitals);
  const { hrDelta, spo2Delta, rrDelta, tempDelta } = deltas;
  const readingSummary = `SpO2 ${vitals.spo2}% (${patient.spo2Scale === 'SCALE_2' ? 'Scale 2' : 'Scale 1'}) | RR ${vitals.respiratoryRate}/min | HR ${vitals.heartRate} bpm | Temp ${vitals.temperature}°C`;

  if (triggeredEvents.length > 0) {
    const primary = triggeredEvents[0];
    return {
      alertCategory: 'URGENT',
      news2Evaluation,
      shouldCreateAlert: true,
      alertLevel: 'URGENT',
      shouldTriggerEmergencySms: true,
      parameter: primary.parameter,
      ruleApplied: primary.ruleApplied,
      vitalSignReading: readingSummary,
      baselineDisplay: primary.baselineDisplay,
      currentDisplay: primary.currentDisplay,
      deviationDisplay: primary.deviationDisplay,
      deviationMagnitude: primary.deviationMagnitude,
      explanation: triggeredEvents.map((e) => e.explanation).join(' '),
      suggestedAction: 'Immediate clinician tele-triage required. Contact patient/caregiver and escalate emergency care as clinically indicated.',
      statusExplanation: `URGENT baseline/safety breach detected: ${triggeredEvents.map((e) => `${e.parameterLabel} ${e.deviationDisplay}`).join(' | ')}.`,
      triggeredEvents
    };
  }

  // Configurable critical emergency criteria (NEWS2 / extreme values)
  const severeHypoxemia =
    patient.spo2Scale === 'SCALE_2'
      ? vitals.spo2 <= thresholds.spo2CriticalScale2
      : vitals.spo2 <= thresholds.spo2CriticalScale1;
  const severeTachypneaOrBradypnea =
    vitals.respiratoryRate >= thresholds.rrCriticalHigh || vitals.respiratoryRate <= thresholds.rrCriticalLow;
  const severeHeartRate =
    vitals.heartRate > thresholds.hrCriticalHigh || vitals.heartRate <= thresholds.hrCriticalLow;
  const severeTemp =
    vitals.temperature >= thresholds.tempCriticalHigh || vitals.temperature <= thresholds.tempCriticalLow;
  const highAcuityScore = news2Evaluation.totalScore >= thresholds.news2CriticalThreshold;

  if (severeHypoxemia || severeTachypneaOrBradypnea || severeHeartRate || severeTemp || highAcuityScore) {
    const primaryParam = severeHypoxemia && severeTachypneaOrBradypnea
      ? 'MULTIVARIATE'
      : severeHypoxemia
      ? 'SPO2'
      : severeTachypneaOrBradypnea
      ? 'RESPIRATORY_RATE'
      : severeHeartRate
      ? 'HEART_RATE'
      : severeTemp
      ? 'TEMPERATURE'
      : 'MULTIVARIATE';

    const baselineDisp = `HR ${patient.baseline.heartRate} | SpO2 ${patient.baseline.spo2}% | RR ${patient.baseline.respiratoryRate} | Temp ${patient.baseline.temperature}°C`;
    const currentDisp = `HR ${vitals.heartRate} | SpO2 ${vitals.spo2}% | RR ${vitals.respiratoryRate} | Temp ${vitals.temperature}°C`;
    const devDisp = `HR ${hrDelta >= 0 ? '+' : ''}${hrDelta} | SpO2 ${spo2Delta >= 0 ? '+' : ''}${spo2Delta}%`;

    return {
      alertCategory: 'URGENT',
      news2Evaluation,
      shouldCreateAlert: true,
      alertLevel: 'URGENT',
      shouldTriggerEmergencySms: true,
      parameter: primaryParam,
      ruleApplied: `Rule URG-01: Personalized NEWS2-style High Acuity (${news2Evaluation.totalScore}) / Critical Vital Threshold Breach (${patient.spo2Scale})`,
      vitalSignReading: readingSummary,
      baselineDisplay: baselineDisp,
      currentDisplay: currentDisp,
      deviationDisplay: devDisp,
      deviationMagnitude: Number(Math.max(Math.abs(hrDelta), Math.abs(spo2Delta), Math.abs(rrDelta), Math.abs(tempDelta)).toFixed(2)),
      explanation: `Validated wearable telemetry confirms critical physiological excursion against ${patient.name}'s personalized baseline (HR Δ ${hrDelta >= 0 ? '+' : ''}${hrDelta} bpm, SpO2 Δ ${spo2Delta >= 0 ? '+' : ''}${spo2Delta}%, RR Δ ${rrDelta >= 0 ? '+' : ''}${rrDelta}/min, Temp Δ ${tempDelta >= 0 ? '+' : ''}${tempDelta}°C).`,
      suggestedAction: 'Immediate clinician tele-triage required. Contact patient/caregiver and escalate emergency care as clinically indicated.',
      statusExplanation: `URGENT clinical attention required: ${readingSummary}. Validated signal confirmed.`,
      triggeredEvents: []
    };
  }

  // REVIEW tier
  if (
    news2Evaluation.totalScore >= 5 ||
    vitals.temperature >= 38.3 ||
    vitals.heartRate >= 110 ||
    vitals.respiratoryRate >= 22 ||
    (patient.spo2Scale === 'SCALE_1' && vitals.spo2 <= 91) ||
    (patient.spo2Scale === 'SCALE_2' && vitals.spo2 <= 86)
  ) {
    return {
      alertCategory: 'REVIEW',
      news2Evaluation,
      shouldCreateAlert: true,
      alertLevel: 'REVIEW',
      shouldTriggerEmergencySms: false,
      parameter: vitals.temperature >= 38.3 ? 'TEMPERATURE' : 'MULTIVARIATE',
      ruleApplied: `Rule REV-02: Moderate Multi-Vital Deviation (NEWS2-style ${news2Evaluation.totalScore}, ${patient.spo2Scale})`,
      vitalSignReading: readingSummary,
      explanation: `Sustained deviation from personalized recovery baseline detected with valid sensor quality (Temp Δ ${tempDelta >= 0 ? '+' : ''}${tempDelta}°C, HR Δ ${hrDelta >= 0 ? '+' : ''}${hrDelta} bpm).`,
      suggestedAction: 'Schedule same-day clinician review and verify patient symptom check-in.',
      statusExplanation: `Clinical review recommended: ${readingSummary}. Monitoring closely for escalation.`,
      triggeredEvents: []
    };
  }

  // WATCH tier (early drift)
  if (
    news2Evaluation.totalScore >= 2 ||
    spo2Delta <= -3 ||
    hrDelta >= 5 ||
    rrDelta >= 3 ||
    tempDelta >= 0.5
  ) {
    return {
      alertCategory: 'WATCH',
      news2Evaluation,
      shouldCreateAlert: true,
      alertLevel: 'WATCH',
      shouldTriggerEmergencySms: false,
      parameter: spo2Delta <= -3 ? 'SPO2' : 'MULTIVARIATE',
      ruleApplied: `Rule WAT-03: Early Personalized Baseline Drift (${patient.spo2Scale})`,
      vitalSignReading: readingSummary,
      explanation: `Early subtle physiological drift detected relative to ${patient.name}'s rolling baseline without critical threshold breaches.`,
      suggestedAction: 'Continue automated surveillance and request next routine symptom check-in.',
      statusExplanation: `Close observation active: subtle vital drift detected relative to personalized baseline.`,
      triggeredEvents: []
    };
  }

  return {
    alertCategory: 'STABLE',
    news2Evaluation,
    shouldCreateAlert: false,
    shouldTriggerEmergencySms: false,
    parameter: 'MULTIVARIATE',
    ruleApplied: `Baseline Target Maintained (${patient.spo2Scale})`,
    vitalSignReading: readingSummary,
    explanation: 'All vital parameters remain within personalized post-discharge therapeutic targets.',
    suggestedAction: 'Continue routine continuous monitoring.',
    statusExplanation: `All vital parameters remain within personalized therapeutic targets (${patient.targetSpo2Range[0]}–${patient.targetSpo2Range[1]}% SpO2 target).`,
    triggeredEvents: []
  };
}
