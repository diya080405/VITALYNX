export type WhatsAppAlertStatus = 'READY TO SEND' | 'OPENED' | 'USER CONFIRMED SENT';

// Backward-compatible alias for any shared internal references
export type SmsDeliveryStatus = WhatsAppAlertStatus;

export type SmsAlertType = 'REAL_EMERGENCY' | 'TEST_ALERT';

export interface EmergencyNotification {
  id: string;
  alertId: string | null;
  patientId: string;
  patientName?: string;
  doctorId?: string;
  recipientName: string;
  recipientType: 'PRIMARY' | 'ALTERNATE' | 'ADDITIONAL' | 'TEST_RECIPIENT';
  recipientPhone: string;
  abnormalParameter?: string | null;
  baselineValue?: string | null;
  currentValue?: string | null;
  deviationValue?: string | null;
  detectionTime?: string | null;
  messageText: string;
  whatsappUrl: string;
  deliveryStatus: WhatsAppAlertStatus;
  alertType: SmsAlertType;
  isTest: boolean;
  provider: string;
  providerMessageId?: string | null;
  providerResponse?: string | null;
  errorReason?: string | null;
  retryCount: number;
  openedAt?: string | null;
  confirmedSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalThresholdsConfig {
  spo2CriticalScale1: number;
  spo2CriticalScale2: number;
  hrCriticalHigh: number;
  hrCriticalLow: number;
  rrCriticalHigh: number;
  rrCriticalLow: number;
  tempCriticalHigh: number;
  tempCriticalLow: number;
  news2CriticalThreshold: number;
  alertCooldownMinutes: number;
  maxSmsRetries: number;
  updatedAt?: string;
}

export interface SmsGatewayStatus {
  configured: boolean;
  provider: 'WHATSAPP_NORMAL';
  mode: string;
  requiresDlt: boolean;
  requiresApiKey: boolean;
  fromIdentifier: string | null;
  webhookUrl: string | null;
  configurationError: string | null;
}

export interface SymptomCheckin {
  id: string;
  patientId: string;
  dyspneaScore: number;
  dizziness: boolean;
  feverChills: boolean;
  fatigueScore: number;
  notes: string;
  submittedAt: string;
}

export type ReportPeriod = '24h' | '7d' | '30d';

export interface GeneratedReportMetadata {
  id: string;
  patientId: string;
  period: ReportPeriod;
  periodStart: string;
  periodEnd: string;
  aiSummary: string;
  news2Score: number;
  observationCount: number;
  alertCount: number;
  createdAt: string;
  downloadUrl: string;
}
