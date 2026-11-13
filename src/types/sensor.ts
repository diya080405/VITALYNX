export type SensorQualityState = 
  | 'VALID' 
  | 'PROBE_REMOVED'
  | 'SENSOR_DISCONNECTED'
  | 'MISSING_READINGS'
  | 'FLATLINED_SIGNAL'
  | 'MOTION_NOISE'
  | 'POOR_SIGNAL_QUALITY'
  | 'SUSPECTED_ARTIFACT'
  | 'MISSING'
  | 'NOISY';

export interface SensorQualityEvent {
  id: string;
  patientId: string;
  patientName: string;
  timestamp: string;
  artifactType: 'Probe Removed' | 'Sensor Disconnected' | 'Missing Readings' | 'Flatlined Signal' | 'Motion-Related Noise' | 'Poor Signal Quality';
  affectedVital: string; // e.g. "SpO2 & Heart Rate", "PPG Signal", "Respiration Waveform", "Temperature"
  sensorType: 'PPG_PULSE_OX' | 'RESPIRATION_BAND' | 'SKIN_TEMP' | 'WEARABLE_PATCH';
  qualityState: SensorQualityState;
  signalStatus: 'DISCONNECTED' | 'ABSENT' | 'DEGRADED' | 'FROZEN' | 'ERRATIC' | 'REMOVED';
  rawReading: string; // preserved raw measurement
  explanation: string;
  clinicalImpactPrevented: string; // e.g. "Prevented false code blue alert for SpO2 0%"
  confidenceScore: number; // 0 to 100%
  durationSeconds: number;
}

export type SimulationScenarioId = 
  | 'STABLE_RECOVERY'
  | 'GRADUAL_DETERIORATION'
  | 'SUDDEN_VITAL_SPIKE'
  | 'MISSING_DATA'
  | 'MOTION_NOISE'
  | 'PROBE_REMOVAL';

export interface SimulationScenarioConfig {
  id: SimulationScenarioId;
  name: string;
  description: string;
  category: 'PHYSIOLOGICAL' | 'SENSOR_ARTIFACT';
  expectedAlertLevel: 'STABLE' | 'WATCH' | 'REVIEW' | 'URGENT' | 'OFFLINE';
  expectedSensorQuality: SensorQualityState;
  explanation: string;
}
