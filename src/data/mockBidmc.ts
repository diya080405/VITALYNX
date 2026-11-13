export interface BidmcDataPoint {
  timeSeconds: number;
  timeLabel: string;
  heartRate: number; // extracted from PPG pulse rate
  spo2: number; // blood oxygen saturation
  respiratoryRate: number; // impedance pneumography or respiratory-induced variations
  temperatureSimulated: number; // simulated companion temp
  sqi: number; // Signal Quality Index (0-100)
}

export interface BidmcRecord {
  id: string;
  name: string;
  samplingDuration: string;
  clinicalProfile: string;
  primaryFinding: string;
  samples: BidmcDataPoint[];
}

// Generate realistic deterministic BIDMC series
const generateBidmcSeries = (
  baseHr: number,
  baseSpo2: number,
  baseRr: number,
  deteriorates: boolean
): BidmcDataPoint[] => {
  const points: BidmcDataPoint[] = [];
  for (let s = 0; s < 60; s += 2) {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    const timeLabel = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    
    // Normal sinus respiratory arrhythmia modulation
    const rsaModulation = Math.sin((s / 4) * Math.PI) * 2.5;
    const hrProgression = deteriorates ? (s / 60) * 18 : 0;
    const hr = Math.round(baseHr + rsaModulation + hrProgression);
    
    const spo2Progression = deteriorates ? -(s / 60) * 6 : 0;
    const spo2 = Math.min(100, Math.max(82, Math.round(baseSpo2 + spo2Progression + (Math.sin(s) * 0.4))));
    
    const rrProgression = deteriorates ? (s / 60) * 8 : 0;
    const rr = Math.round(baseRr + rrProgression + Math.cos(s / 3) * 0.8);
    
    const tempProgression = deteriorates ? (s / 60) * 0.8 : 0;
    const temp = Number((36.8 + tempProgression).toFixed(1));
    
    points.push({
      timeSeconds: s,
      timeLabel,
      heartRate: hr,
      spo2,
      respiratoryRate: rr,
      temperatureSimulated: temp,
      sqi: 95 - (s % 7 === 0 ? 8 : 0)
    });
  }
  return points;
};

export const MOCK_BIDMC_RECORDS: BidmcRecord[] = [
  {
    id: 'bidmc-01',
    name: 'BIDMC Record 01 – Stable Sinus Baseline',
    samplingDuration: '480 seconds (Demonstration excerpt: 60s)',
    clinicalProfile: 'Post-operative monitoring, adult male. Stable cardiorespiratory rhythm.',
    primaryFinding: 'Normal sinus rhythm with physiological respiratory sinus arrhythmia (RSA). Consistent high SQI (>92%).',
    samples: generateBidmcSeries(72, 98, 15, false)
  },
  {
    id: 'bidmc-08',
    name: 'BIDMC Record 08 – Nocturnal Desaturation & Micro-apnea',
    samplingDuration: '480 seconds (Demonstration excerpt: 60s)',
    clinicalProfile: 'Adult female, COPD / Sleep-disordered breathing recovery.',
    primaryFinding: 'Episodic desaturation down to 88% with compensatory respiratory rate acceleration.',
    samples: generateBidmcSeries(82, 94, 21, true)
  },
  {
    id: 'bidmc-14',
    name: 'BIDMC Record 14 – Acute Post-Extubation Tachypnea',
    samplingDuration: '480 seconds (Demonstration excerpt: 60s)',
    clinicalProfile: 'Post-ICU stepdown surveillance following mechanical ventilation.',
    primaryFinding: 'Progressive respiratory compromise: respiratory rate climbing from 18 to 26 breaths/min.',
    samples: generateBidmcSeries(88, 93, 20, true)
  }
];
