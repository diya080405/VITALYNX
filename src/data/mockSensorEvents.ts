import type { SensorQualityEvent, SimulationScenarioConfig } from '../types/sensor.ts';

export const MOCK_SENSOR_EVENTS: SensorQualityEvent[] = [
  {
    id: 'SQ-901',
    patientId: 'PT-8025',
    patientName: 'James Wilson',
    timestamp: '2026-11-12 05:22',
    artifactType: 'Probe Removed',
    affectedVital: 'Oxygen Saturation (SpO2) & Pulse Rate',
    sensorType: 'PPG_PULSE_OX',
    qualityState: 'PROBE_REMOVED',
    signalStatus: 'REMOVED',
    rawReading: 'SpO2: 0% | Pulse Rate: 0 bpm | AC/DC Ratio: 0.00',
    explanation: 'The sensor has lost contact or its signal. Complete absence of infrared absorption pulsatile component detected while ambient photodiode confirmed optical sensor detached from fingertip during ambulation.',
    clinicalImpactPrevented: 'Prevented false "Cardiac Arrest / Asystole" emergency callout and patient panic.',
    confidenceScore: 99.6,
    durationSeconds: 1080
  },
  {
    id: 'SQ-902',
    patientId: 'PT-8026',
    patientName: 'Dorothy Miller',
    timestamp: '2026-11-12 04:50',
    artifactType: 'Sensor Disconnected',
    affectedVital: 'Continuous PPG & Skin Temperature',
    sensorType: 'WEARABLE_PATCH',
    qualityState: 'SENSOR_DISCONNECTED',
    signalStatus: 'DISCONNECTED',
    rawReading: 'BLE Signal RSSI: -96 dBm -> Connection Terminated (Code 0x13)',
    explanation: 'Bluetooth 5.2 link to home gateway disconnected due to distance or dead battery. Device status flagged as offline rather than medical emergency.',
    clinicalImpactPrevented: 'Suppressed erroneous vital cessation alarm; routed to device reconnection prompt.',
    confidenceScore: 100.0,
    durationSeconds: 480
  },
  {
    id: 'SQ-903',
    patientId: 'PT-8021',
    patientName: 'Marcus Chen',
    timestamp: '2026-11-12 04:15',
    artifactType: 'Missing Readings',
    affectedVital: 'Respiratory Waveform (Impedance)',
    sensorType: 'RESPIRATION_BAND',
    qualityState: 'MISSING_READINGS',
    signalStatus: 'ABSENT',
    rawReading: 'Packet Loss: 0 packets received in last 210 seconds',
    explanation: 'Packet sequence counter detected 42 consecutive dropped frames. System holds last known valid state and alerts technician, never hallucinating normal values.',
    clinicalImpactPrevented: 'Prevented default assignment of normal respiratory score (NEWS2 violation avoided).',
    confidenceScore: 98.4,
    durationSeconds: 210
  },
  {
    id: 'SQ-904',
    patientId: 'PT-8023',
    patientName: 'Robert Alvarez',
    timestamp: '2026-11-12 03:40',
    artifactType: 'Flatlined Signal',
    affectedVital: 'PPG Pulse Rate',
    sensorType: 'PPG_PULSE_OX',
    qualityState: 'FLATLINED_SIGNAL',
    signalStatus: 'FROZEN',
    rawReading: 'PPG ADC Register frozen at 0x7FFF for 45 consecutive seconds',
    explanation: 'Sensor analog-to-digital converter freeze detected. Identical numerical value streamed continuously without natural physiological micro-variability.',
    clinicalImpactPrevented: 'Prevented false clinical assumption of rigid autonomic tone; triggered sensor driver soft reset.',
    confidenceScore: 99.1,
    durationSeconds: 45
  },
  {
    id: 'SQ-905',
    patientId: 'PT-8022',
    patientName: 'Sarah Jenkins',
    timestamp: '2026-11-12 03:10',
    artifactType: 'Motion-Related Noise',
    affectedVital: 'PPG Pulse Waveform & SpO2',
    sensorType: 'PPG_PULSE_OX',
    qualityState: 'MOTION_NOISE',
    signalStatus: 'ERRATIC',
    rawReading: 'SpO2 fluctuating 82% <-> 99% in 2s | Accelerometer RMS: 2.1g',
    explanation: 'Concurrent tri-axial accelerometer registered high limb motion energy (brushing hair / ambulating). Rapidly oscillating non-biological morphology discarded.',
    clinicalImpactPrevented: 'Suppressed spurious rapid hypoxemia and arrhythmia alert during patient movement.',
    confidenceScore: 95.8,
    durationSeconds: 150
  },
  {
    id: 'SQ-906',
    patientId: 'PT-8024',
    patientName: 'Elena Rostova',
    timestamp: '2026-11-12 02:25',
    artifactType: 'Poor Signal Quality',
    affectedVital: 'PPG Signal & Pulse Rate',
    sensorType: 'PPG_PULSE_OX',
    qualityState: 'POOR_SIGNAL_QUALITY',
    signalStatus: 'DEGRADED',
    rawReading: 'Perfusion Index (PI): 0.12% (threshold: >0.4%) | SNR: 6.2 dB',
    explanation: 'Marginal optical transmission due to localized peripheral vasoconstriction or loose sensor strap. Reading marked as unverified until perfusion recovers.',
    clinicalImpactPrevented: 'Prevented inaccurate calculation of arterial pulse rate from degraded optical peaks.',
    confidenceScore: 91.5,
    durationSeconds: 320
  }
];

export const SIMULATION_SCENARIOS: SimulationScenarioConfig[] = [
  {
    id: 'STABLE_RECOVERY',
    name: 'Stable Post-Op Recovery',
    description: 'Physiologically stable convalescence with natural circadian variations. All parameters track close to personalized baselines.',
    category: 'PHYSIOLOGICAL',
    expectedAlertLevel: 'STABLE',
    expectedSensorQuality: 'VALID',
    explanation: 'Demonstrates baseline maintenance. No alerts generated.'
  },
  {
    id: 'GRADUAL_DETERIORATION',
    name: 'Gradual Sepsis / Respiratory Decline',
    description: 'Subtle multi-parameter drift: heart rate creeps upward by 20 bpm, SpO2 trends down by 6%, and respiratory rate climbs steadily.',
    category: 'PHYSIOLOGICAL',
    expectedAlertLevel: 'URGENT',
    expectedSensorQuality: 'VALID',
    explanation: 'Demonstrates early deterioration detection hours before acute crisis thresholds.'
  },
  {
    id: 'SUDDEN_VITAL_SPIKE',
    name: 'Sudden Fever / Tachycardia Spike',
    description: 'Rapid elevation of temperature to 38.8°C accompanied by compensatory tachycardia and mild tachypnea.',
    category: 'PHYSIOLOGICAL',
    expectedAlertLevel: 'REVIEW',
    expectedSensorQuality: 'VALID',
    explanation: 'Triggers clinician review alert for suspected infection or acute systemic reaction.'
  },
  {
    id: 'MISSING_DATA',
    name: 'BLE Dropout / Missing Telemetry',
    description: 'Wearable goes out of Bluetooth gateway range. Telemetry packets stop arriving.',
    category: 'SENSOR_ARTIFACT',
    expectedAlertLevel: 'OFFLINE',
    expectedSensorQuality: 'MISSING',
    explanation: 'Classified strictly as connectivity loss. Suppresses clinical deterioration alarms.'
  },
  {
    id: 'MOTION_NOISE',
    name: 'Active Motion Artifact',
    description: 'Patient ambulates or brushes teeth. Rapid, physically implausible oscillations in PPG signal with high accelerometer variance.',
    category: 'SENSOR_ARTIFACT',
    expectedAlertLevel: 'STABLE',
    expectedSensorQuality: 'NOISY',
    explanation: 'System suppresses false arrhythmia and hypoxemia alarms by recognizing motion artifacts.'
  },
  {
    id: 'PROBE_REMOVAL',
    name: 'Optical Sensor / Probe Detached',
    description: 'Patient unclips fingertip pulse-oximeter. SpO2 drops to 0% and pulse signal drops to flatline instantaneously.',
    category: 'SENSOR_ARTIFACT',
    expectedAlertLevel: 'OFFLINE',
    expectedSensorQuality: 'PROBE_REMOVED',
    explanation: 'Distinguishes sensor detachment from true cardiac arrest. Triggers device reminder, NOT emergency code.'
  }
];
