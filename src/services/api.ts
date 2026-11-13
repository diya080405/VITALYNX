import { Patient, LatestVitals, PatientBaseline, EmergencyContact } from '../types/patient';
import { VitalObservation } from '../types/observation';
import { ClinicalAlert } from '../types/alert';
import { SensorQualityEvent } from '../types/sensor';
import type {
  ClinicalThresholdsConfig,
  EmergencyNotification,
  ReportPeriod,
  SmsGatewayStatus,
  SymptomCheckin,
  GeneratedReportMetadata
} from '../types/notification';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const API_BASE_URL =
  /^https?:\/\//i.test(rawApiBase) || rawApiBase.startsWith('/') ? rawApiBase : '';
const TOKEN_STORAGE_KEY = 'vitalynx_jwt_token';

export interface AuthResponseUser {
  id: string;
  email: string;
  role: 'DOCTOR' | 'PATIENT';
  name: string;
  doctorId: string | null;
  patientId: string | null;
  doctorTitle?: string;
  phone?: string;
}

let inMemoryToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setOnUnauthorizedHandler(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) inMemoryToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = (init.method || 'GET').toUpperCase();
  const canRetryTransient = method === 'GET' && attempt < 3;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers
    });
  } catch {
    if (canRetryTransient) {
      await sleep(700 * (attempt + 1));
      return apiFetch<T>(path, init, attempt + 1);
    }
    throw new Error('Cannot connect to the VITALYNX server. Ensure the backend is running on port 3000.');
  }

  if (res.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/register') {
    setAuthToken(null);
    onUnauthorizedCallback?.();
    throw new Error('Session expired. Please sign in again.');
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text().catch(() => '');
  const looksLikeHtml =
    contentType.includes('text/html') || /^\s*<!doctype\s+html|^\s*<html/i.test(rawText);

  // During dev-server restarts, nginx may briefly serve /warmup.html with HTTP 200 or 502/503/504
  if ((res.status === 502 || res.status === 503 || res.status === 504 || looksLikeHtml) && canRetryTransient) {
    await sleep(700 * (attempt + 1));
    return apiFetch<T>(path, init, attempt + 1);
  }

  if (!res.ok) {
    let message =
      res.status === 404
        ? `API endpoint not found (${path}, HTTP 404). Verify backend routes and server status.`
        : `Request failed (${res.status})`;
    if (rawText && !looksLikeHtml) {
      try {
        const errJson = JSON.parse(rawText);
        if (errJson?.error) message = errJson.error;
        else if (errJson?.message) message = errJson.message;
      } catch {
        // keep HTTP error message when body is non-JSON
      }
    }
    throw new Error(message);
  }

  if (looksLikeHtml) {
    throw new Error('Backend server is warming up or returned HTML instead of JSON. Please retry.');
  }

  if (!rawText) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(`Invalid JSON response received from ${path}.`);
  }
}

export const api = {
  async login(payload: {
    role: 'DOCTOR' | 'PATIENT';
    identifier: string;
    password: string;
  }): Promise<{ token: string; user: AuthResponseUser }> {
    const data = await apiFetch<{ token: string; user: AuthResponseUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setAuthToken(data.token);
    return data;
  },

  async register(payload: {
    role: 'DOCTOR' | 'PATIENT';
    name: string;
    email: string;
    phone: string;
    password: string;
    patientId?: string;
    primaryContact?: EmergencyContact;
    alternativeContact?: EmergencyContact;
  }): Promise<{ registered?: boolean; message?: string; token: string; user: AuthResponseUser }> {
    const data = await apiFetch<{
      registered?: boolean;
      message?: string;
      token: string;
      user: AuthResponseUser;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setAuthToken(data.token);
    return data;
  },

  async getMe(): Promise<{ user: AuthResponseUser }> {
    return apiFetch<{ user: AuthResponseUser }>('/api/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // clear local token anyway
    } finally {
      setAuthToken(null);
    }
  },

  async getPatients(): Promise<Patient[]> {
    return apiFetch<Patient[]>('/api/patients');
  },

  async getPatientById(id: string): Promise<Patient | null> {
    try {
      return await apiFetch<Patient>(`/api/patients/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  },

  async getEmergencyContacts(patientId: string): Promise<EmergencyContact[]> {
    return apiFetch<EmergencyContact[]>(
      `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts`
    );
  },

  async addEmergencyContact(
    patientId: string,
    contact: { name: string; relationship: string; phone: string }
  ): Promise<{ contact: EmergencyContact; patient: Patient }> {
    return apiFetch<{ contact: EmergencyContact; patient: Patient }>(
      `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts`,
      {
        method: 'POST',
        body: JSON.stringify(contact)
      }
    );
  },

  async updateEmergencyContact(
    patientId: string,
    contactId: string,
    contact: { name: string; relationship: string; phone: string }
  ): Promise<{ contact: EmergencyContact; patient: Patient }> {
    return apiFetch<{ contact: EmergencyContact; patient: Patient }>(
      `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts/${encodeURIComponent(contactId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(contact)
      }
    );
  },

  async deleteEmergencyContact(
    patientId: string,
    contactId: string
  ): Promise<{ deletedId: string; patient: Patient }> {
    return apiFetch<{ deletedId: string; patient: Patient }>(
      `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts/${encodeURIComponent(contactId)}`,
      {
        method: 'DELETE'
      }
    );
  },

  async updateAlternateEmergencyContact(patientId: string, contact: EmergencyContact): Promise<Patient> {
    return apiFetch<Patient>(
      `/api/patients/${encodeURIComponent(patientId)}/emergency-contacts/alternate`,
      {
        method: 'PUT',
        body: JSON.stringify(contact)
      }
    );
  },

  async getObservations(patientId: string, limit = 100): Promise<VitalObservation[]> {
    return apiFetch<VitalObservation[]>(
      `/api/patients/${encodeURIComponent(patientId)}/observations?limit=${limit}`
    );
  },

  async ingestVitals(
    patientId: string,
    vitals: Partial<LatestVitals> & { isSimulated?: boolean }
  ): Promise<{
    success: boolean;
    patient: Patient;
    alert?: ClinicalAlert | null;
    notifications?: EmergencyNotification[];
    smsSuppressedReason?: string | null;
  }> {
    return apiFetch(`/api/patients/${encodeURIComponent(patientId)}/vitals`, {
      method: 'POST',
      body: JSON.stringify(vitals)
    });
  },

  async getAlerts(): Promise<ClinicalAlert[]> {
    return apiFetch<ClinicalAlert[]>('/api/alerts');
  },

  async acknowledgeAlert(alertId: string, clinicianName?: string): Promise<ClinicalAlert> {
    return apiFetch<ClinicalAlert>(`/api/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ clinicianName })
    });
  },

  async resolveAlert(alertId: string): Promise<ClinicalAlert> {
    return apiFetch<ClinicalAlert>(`/api/alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'POST'
    });
  },

  async getAlertAiExplanation(alertId: string): Promise<{
    alertId: string;
    aiExplanation: string;
    source: 'GEMINI' | 'FALLBACK';
  }> {
    return apiFetch(`/api/alerts/${encodeURIComponent(alertId)}/ai-explanation`, {
      method: 'POST'
    });
  },

  async getSmsGatewayStatus(): Promise<SmsGatewayStatus> {
    return apiFetch<SmsGatewayStatus>('/api/notifications/gateway-status');
  },

  async getClinicalThresholds(): Promise<ClinicalThresholdsConfig> {
    return apiFetch<ClinicalThresholdsConfig>('/api/notifications/thresholds');
  },

  async updateClinicalThresholds(
    patch: Partial<ClinicalThresholdsConfig>
  ): Promise<ClinicalThresholdsConfig> {
    return apiFetch<ClinicalThresholdsConfig>('/api/notifications/thresholds', {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
  },

  async getNotifications(patientId?: string): Promise<EmergencyNotification[]> {
    const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
    return apiFetch<EmergencyNotification[]>(`/api/notifications${query}`);
  },

  async markWhatsAppOpened(
    notificationId: string
  ): Promise<{ notification: EmergencyNotification }> {
    return apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}/opened`, {
      method: 'POST'
    });
  },

  async confirmWhatsAppSent(
    notificationId: string
  ): Promise<{ notification: EmergencyNotification }> {
    return apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}/confirm-sent`, {
      method: 'POST'
    });
  },

  async triggerTestEmergencySms(payload: {
    patientId: string;
    verifiedPhone: string;
    recipientName?: string;
    consentConfirmed: boolean;
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
  }): Promise<{
    notification: EmergencyNotification;
    evaluatedDeviation?: {
      parameter: string;
      baselineValue: string;
      currentValue: string;
      deviationValue: string;
      alertTriggered: boolean;
    };
  }> {
    return apiFetch('/api/notifications/test-emergency', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async generateReportSummary(
    patientId: string,
    period: ReportPeriod
  ): Promise<{ report: GeneratedReportMetadata & { aiSource?: string } }> {
    return apiFetch(`/api/reports/patients/${encodeURIComponent(patientId)}/generate`, {
      method: 'POST',
      body: JSON.stringify({ period })
    });
  },

  async downloadPatientReportPdf(patientId: string, patientName: string, period: ReportPeriod): Promise<void> {
    const token = getAuthToken();
    const res = await fetch(
      `${API_BASE_URL}/api/reports/patients/${encodeURIComponent(patientId)}?period=${encodeURIComponent(period)}&format=pdf`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }
    );

    if (res.status === 401) {
      setAuthToken(null);
      onUnauthorizedCallback?.();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!res.ok) {
      let msg = `Failed to generate PDF report (${res.status})`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    const safeName = patientName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || patientId;
    const dateTag = new Date().toISOString().slice(0, 10);
    const filename = `VITALYNX_${safeName}_Report_${dateTag}.pdf`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async getCheckins(patientId: string): Promise<SymptomCheckin[]> {
    return apiFetch<SymptomCheckin[]>(`/api/patients/${encodeURIComponent(patientId)}/symptom-checkins`);
  },

  async submitCheckin(
    patientId: string,
    payload: {
      dyspneaScore: number;
      dizziness: boolean;
      feverChills: boolean;
      fatigueScore: number;
      notes: string;
    }
  ): Promise<SymptomCheckin> {
    return apiFetch<SymptomCheckin>(
      `/api/patients/${encodeURIComponent(patientId)}/symptom-checkins`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
  },

  async getNews2Score(patientId: string) {
    return apiFetch(`/api/patients/${encodeURIComponent(patientId)}/news2`);
  },

  async getBaseline(patientId: string): Promise<PatientBaseline | null> {
    try {
      return await apiFetch<PatientBaseline>(`/api/patients/${encodeURIComponent(patientId)}/baseline`);
    } catch {
      return null;
    }
  },

  async updateBaseline(
    patientId: string,
    baseline: Partial<PatientBaseline>
  ): Promise<{ patient: Patient; baseline: PatientBaseline }> {
    return apiFetch<{ patient: Patient; baseline: PatientBaseline }>(
      `/api/patients/${encodeURIComponent(patientId)}/baseline`,
      {
        method: 'PUT',
        body: JSON.stringify(baseline)
      }
    );
  },

  async getSensorQuality(): Promise<SensorQualityEvent[]> {
    return apiFetch<SensorQualityEvent[]>('/api/sensor-quality');
  },

  async getPerformance() {
    return apiFetch('/api/performance');
  }
};
