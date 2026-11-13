export interface VitalBaselineComparison {
  baseline: {
    heartRate: number;
    spo2: number;
    respiratoryRate: number;
    temperature: number;
  };
  deltas: {
    heartRate: number;
    spo2: number;
    respiratoryRate: number;
    temperature: number;
  };
  triggeredParameters: string[];
}

export interface VitalObservation {
  id: string;
  patientId: string;
  timestamp: string; // ISO string or relative time label
  timeLabel: string; // e.g. "14:00"
  heartRate: number;
  spo2: number;
  respiratoryRate: number;
  temperature: number;
  sensorQuality: 'VALID' | 'SUSPECTED_ARTIFACT' | 'PROBE_REMOVED' | 'MISSING' | 'NOISY';
  news2Score?: number;
  alertCategory?: string;
  emergencyStatus?: string;
  baselineComparison?: VitalBaselineComparison | null;
  isSimulated?: boolean;
}

export type TimeRangeOption = '1h' | '6h' | '24h' | '7d';
