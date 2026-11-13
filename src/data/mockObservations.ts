import type { VitalObservation } from '../types/observation.ts';

// Generate 24-hour synthetic observations at hourly intervals + recent high frequency
export const generatePatientObservations = (patientId: string): VitalObservation[] => {
  const hours = [
    '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
    '12:00', '14:00', '16:00', '18:00', '20:00', '21:00',
    '22:00', '22:30', '23:00', '23:10'
  ];

  if (patientId === 'PT-8021') {
    // Marcus Chen: COPD with Hypercapnic Failure - Target 88-92%
    return hours.map((time, idx) => {
      const spo2Values = [91, 90, 89, 89, 90, 92, 91, 89, 88, 87, 89, 90, 91, 90, 90, 90];
      const hrValues =   [74, 73, 72, 75, 76, 78, 77, 80, 82, 84, 80, 78, 77, 76, 78, 78];
      const rrValues =   [16, 16, 17, 17, 18, 18, 19, 18, 19, 20, 19, 18, 18, 18, 18, 18];
      const tempValues = [36.6, 36.6, 36.5, 36.7, 36.8, 36.9, 36.8, 36.8, 36.9, 36.8, 36.7, 36.8, 36.8, 36.8, 36.8, 36.8];
      return {
        id: `obs-8021-${idx}`,
        patientId: 'PT-8021',
        timestamp: `2026-11-11T${time}:00Z`,
        timeLabel: time,
        heartRate: hrValues[idx],
        spo2: spo2Values[idx],
        respiratoryRate: rrValues[idx],
        temperature: tempValues[idx],
        sensorQuality: 'VALID',
        news2Score: 0,
        isSimulated: false
      };
    });
  }

  if (patientId === 'PT-8024') {
    // Elena Rostova: Acute Deterioration from Pneumonia
    return hours.map((time, idx) => {
      const spo2Values = [97, 96, 96, 95, 94, 94, 93, 91, 90, 89, 88, 87, 87, 86, 86, 86];
      const hrValues =   [76, 78, 80, 82, 85, 90, 94, 102, 108, 114, 118, 120, 122, 124, 124, 124];
      const rrValues =   [16, 17, 17, 18, 19, 20, 22, 24, 25, 26, 27, 27, 28, 28, 28, 28];
      const tempValues = [36.9, 37.0, 37.1, 37.2, 37.4, 37.6, 37.9, 38.2, 38.5, 38.7, 38.8, 38.8, 38.9, 38.9, 38.9, 38.9];
      const news2Score = idx > 10 ? 9 : idx > 6 ? 6 : idx > 4 ? 3 : 1;
      return {
        id: `obs-8024-${idx}`,
        patientId: 'PT-8024',
        timestamp: `2026-11-11T${time}:00Z`,
        timeLabel: time,
        heartRate: hrValues[idx],
        spo2: spo2Values[idx],
        respiratoryRate: rrValues[idx],
        temperature: tempValues[idx],
        sensorQuality: 'VALID',
        news2Score,
        isSimulated: false
      };
    });
  }

  if (patientId === 'PT-8023') {
    // Robert Alvarez: Sepsis recurrence with fever spike
    return hours.map((time, idx) => {
      const spo2Values = [98, 97, 97, 96, 96, 96, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95];
      const hrValues =   [72, 74, 75, 74, 78, 80, 85, 92, 98, 105, 110, 112, 112, 112, 112, 112];
      const rrValues =   [15, 15, 16, 16, 16, 17, 18, 20, 21, 22, 23, 23, 23, 23, 23, 23];
      const tempValues = [36.7, 36.8, 36.8, 36.8, 37.0, 37.2, 37.5, 37.9, 38.2, 38.4, 38.5, 38.6, 38.6, 38.6, 38.6, 38.6];
      return {
        id: `obs-8023-${idx}`,
        patientId: 'PT-8023',
        timestamp: `2026-11-11T${time}:00Z`,
        timeLabel: time,
        heartRate: hrValues[idx],
        spo2: spo2Values[idx],
        respiratoryRate: rrValues[idx],
        temperature: tempValues[idx],
        sensorQuality: 'VALID',
        news2Score: idx > 10 ? 6 : 2,
        isSimulated: false
      };
    });
  }

  if (patientId === 'PT-8025') {
    // James Wilson: Probe removed at 22:30
    return hours.map((time, idx) => {
      const isDetached = idx >= 13;
      return {
        id: `obs-8025-${idx}`,
        patientId: 'PT-8025',
        timestamp: `2026-11-11T${time}:00Z`,
        timeLabel: time,
        heartRate: isDetached ? 0 : 70 + Math.floor(Math.sin(idx) * 4),
        spo2: isDetached ? 0 : 97,
        respiratoryRate: isDetached ? 0 : 16,
        temperature: 36.6,
        sensorQuality: isDetached ? 'PROBE_REMOVED' : 'VALID',
        news2Score: 0,
        isSimulated: false
      };
    });
  }

  // Default stable / watch for other patients (e.g. Sarah Jenkins PT-8022 or Dorothy Miller PT-8026)
  return hours.map((time, idx) => {
    const isSarah = patientId === 'PT-8022';
    const baseHr = isSarah ? 76 : 68;
    const baseSpo2 = isSarah ? 95 : 98;
    const hr = isSarah && idx > 8 ? baseHr + (idx - 8) * 1.5 : baseHr + (idx % 3);
    const spo2 = isSarah && idx > 8 ? baseSpo2 - Math.min(2, Math.floor((idx - 8) * 0.3)) : baseSpo2;
    return {
      id: `obs-gen-${patientId}-${idx}`,
      patientId,
      timestamp: `2026-11-11T${time}:00Z`,
      timeLabel: time,
      heartRate: Math.round(hr),
      spo2: Math.round(spo2),
      respiratoryRate: isSarah ? 18 + (idx > 10 ? 2 : 0) : 15,
      temperature: 36.7,
      sensorQuality: 'VALID',
      news2Score: isSarah ? 2 : 0,
      isSimulated: false
    };
  });
};
