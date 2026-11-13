import { GoogleGenAI } from '@google/genai';
import type { Patient } from '../../src/types/patient.ts';
import type { ClinicalAlert } from '../../src/types/alert.ts';
import type { VitalObservation } from '../../src/types/observation.ts';
import type { SymptomCheckin } from '../../src/types/notification.ts';

const MODEL_NAME = 'gemini-4-hydrogen';
const GEMINI_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function buildFallbackAlertExplanation(alert: ClinicalAlert, patient: Patient): string {
  return (
    `Structured Rule Analysis (Local Clinical Fallback): ${alert.ruleApplied}. ` +
    `Observed reading: ${alert.vitalSignReading}. Sensor fidelity: ${alert.sensorQualityStatus}. ` +
    `Patient baseline: HR ${patient.baseline.heartRate} bpm, SpO2 ${patient.baseline.spo2}% (${patient.spo2Scale}, target ${patient.targetSpo2Range[0]}-${patient.targetSpo2Range[1]}%), RR ${patient.baseline.respiratoryRate}/min, Temp ${patient.baseline.temperature}°C. ` +
    `${alert.explanation} Recommended next step: ${alert.suggestedAction}`
  );
}

export async function generateAlertAiExplanation(
  alert: ClinicalAlert,
  patient: Patient
): Promise<{ text: string; source: 'GEMINI' | 'FALLBACK' }> {
  const client = getGeminiClient();
  if (!client) {
    return {
      text: buildFallbackAlertExplanation(alert, patient),
      source: 'FALLBACK'
    };
  }

  // Strictly de-identified clinical payload (no patient name, phone, or email sent to LLM)
  const prompt = [
    `Alert Level: ${alert.alertLevel}`,
    `Trigger Parameter: ${alert.parameter}`,
    `Rule Applied: ${alert.ruleApplied}`,
    `Observed Reading: ${alert.vitalSignReading}`,
    `Sensor Quality Status: ${alert.sensorQualityStatus}`,
    `SpO2 Scale: ${patient.spo2Scale} (Target ${patient.targetSpo2Range[0]}-${patient.targetSpo2Range[1]}%)`,
    `Personalized Baseline: HR ${patient.baseline.heartRate} bpm, SpO2 ${patient.baseline.spo2}%, RR ${patient.baseline.respiratoryRate}/min, Temp ${patient.baseline.temperature}°C`,
    `Primary Diagnosis Context: ${patient.primaryDiagnosis}`,
    `Existing Rule Explanation: ${alert.explanation}`,
    '',
    'Write a concise 3-4 sentence clinician/caregiver-readable rationale explaining ONLY what triggered this alert, how it compares to the patient baseline and SpO2 scale, and sensor quality validation. Do not invent readings, diagnose diseases, or recommend specific medication changes.'
  ].join('\n');

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a clinical decision-support explainer for post-discharge telemetry. Only summarize verified vital values, rules, baseline deviations, and signal quality provided in the prompt. Never diagnose or prescribe medications. Keep output under 95 words.'
        }
      }),
      GEMINI_TIMEOUT_MS
    );
    const text = (response.text ?? '').trim();
    if (!text) {
      return { text: buildFallbackAlertExplanation(alert, patient), source: 'FALLBACK' };
    }
    return { text, source: 'GEMINI' };
  } catch (err) {
    console.warn('[AI] Gemini alert explanation unavailable, using structured fallback:', (err as Error)?.message);
    return { text: buildFallbackAlertExplanation(alert, patient), source: 'FALLBACK' };
  }
}

export async function generateReportAiSummary(params: {
  patient: Patient;
  period: string;
  observations: VitalObservation[];
  alerts: ClinicalAlert[];
  checkins: SymptomCheckin[];
}): Promise<{ summary: string; source: 'GEMINI' | 'FALLBACK' }> {
  const { patient, period, observations, alerts, checkins } = params;

  const validObs = observations.filter((o) => o.sensorQuality === 'VALID');
  const artifactObs = observations.filter((o) => o.sensorQuality !== 'VALID');

  const avg = (arr: number[]) =>
    arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

  const avgHr = avg(validObs.map((o) => o.heartRate));
  const avgSpo2 = avg(validObs.map((o) => o.spo2));
  const avgRr = avg(validObs.map((o) => o.respiratoryRate));
  const avgTemp = avg(validObs.map((o) => o.temperature));

  const fallbackSummary =
    `Monitoring Period (${period}) Summary: ${validObs.length} valid observations and ${artifactObs.length} artifact/missing intervals recorded ` +
    `(PPG/SpO2/RR derived from BIDMC PhysioNet telemetry patterns; axillary temperature via Virtual Wearable Simulator). ` +
    (validObs.length > 0
      ? `Mean valid vitals — HR: ${avgHr} bpm (baseline ${patient.baseline.heartRate}), SpO2: ${avgSpo2}% (${patient.spo2Scale} target ${patient.targetSpo2Range[0]}-${patient.targetSpo2Range[1]}%), RR: ${avgRr}/min (baseline ${patient.baseline.respiratoryRate}), Temp: ${avgTemp}°C. `
      : 'No valid physiological readings captured in this window; device reconnection review advised. ') +
    `Current NEWS2-style score is ${patient.news2Score}. ${alerts.length} clinical alert(s) and ${checkins.length} symptom check-in(s) occurred in this period. Review by a qualified clinician is required.`;

  const client = getGeminiClient();
  if (!client) {
    return { summary: fallbackSummary, source: 'FALLBACK' };
  }

  // Strictly de-identified summary metrics
  const prompt = [
    `Monitoring Window: ${period}`,
    `Diagnosis Context: ${patient.primaryDiagnosis}`,
    `SpO2 Scale: ${patient.spo2Scale} (Target ${patient.targetSpo2Range[0]}-${patient.targetSpo2Range[1]}%)`,
    `Baseline: HR ${patient.baseline.heartRate} bpm, SpO2 ${patient.baseline.spo2}%, RR ${patient.baseline.respiratoryRate}/min, Temp ${patient.baseline.temperature}°C`,
    `Valid Observations: ${validObs.length}; Artifact/Missing Intervals: ${artifactObs.length}`,
    `Period Means (Valid): HR ${avgHr ?? 'N/A'} bpm, SpO2 ${avgSpo2 ?? 'N/A'}%, RR ${avgRr ?? 'N/A'}/min, Temp ${avgTemp ?? 'N/A'}°C`,
    `Latest Status: ${patient.currentAlertCategory}, NEWS2-style score: ${patient.news2Score}`,
    `Alerts in Window (${alerts.length}): ${alerts.slice(0, 5).map((a) => `${a.alertLevel} (${a.vitalSignReading})`).join('; ') || 'None'}`,
    `Symptom Check-ins (${checkins.length}): ${checkins.slice(0, 3).map((c) => `Dyspnea ${c.dyspneaScore}/10, Fatigue ${c.fatigueScore}/10`).join('; ') || 'None'}`,
    '',
    'Provide a clear, plain-language monitoring report summary (max 110 words) stating observed trends, alert activity, and any missing/artifact intervals. Do not diagnose or suggest medication adjustments. Explicitly note that this is clinical decision support only.'
  ].join('\n');

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You summarize post-discharge vital monitoring records cleanly and conservatively. Use only provided metrics. Never fabricate data, diagnose conditions, or alter medications.'
        }
      }),
      GEMINI_TIMEOUT_MS
    );
    const text = (response.text ?? '').trim();
    if (!text) return { summary: fallbackSummary, source: 'FALLBACK' };
    return { summary: text, source: 'GEMINI' };
  } catch (err) {
    console.warn('[AI] Gemini report summary unavailable, using structured fallback:', (err as Error)?.message);
    return { summary: fallbackSummary, source: 'FALLBACK' };
  }
}
