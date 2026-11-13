import React, { useRef, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface MiniPPGWaveformProps {
  heartRate: number;
  spo2?: number;
  respiratoryRate?: number;
  sensorQuality?: string;
  patientId?: string;
  height?: number; // e.g. 40 for table, 52 for card
  showMetrics?: boolean;
  className?: string;
  waveformMode?: 'ppg' | 'ecg';
}

// Authentic Photoplethysmogram (PPG) Arterial Pulse Model with dynamic amplitude
function computePPGWaveY(
  p: number,
  midY: number,
  amp: number,
  patientId?: string
): number {
  const baseline = midY + amp * 0.42;

  // Patient-specific arterial stiffness / notch variations
  const isStiff = patientId === 'PT-8022'; // Arthur Pendelton (elderly / stiff vessels)
  const notchDepth = isStiff ? 0.38 : 0.52;
  const dicroticPeakHeight = isStiff ? 0.14 : 0.28;

  // 1. Rapid Systolic Upstroke & Peak (p: 0.0 -> 0.28)
  if (p < 0.28) {
    const rise = p / 0.28;
    const curve = Math.sin(rise * Math.PI * 0.5);
    return baseline - Math.pow(curve, 1.6) * (amp * 1.55);
  }

  // 2. Catacrotic Decline to Dicrotic Notch (p: 0.28 -> 0.44)
  if (p >= 0.28 && p < 0.44) {
    const rel = (p - 0.28) / 0.16;
    const fall = Math.sin(rel * Math.PI * 0.5);
    const peakLevel = baseline - amp * 1.55;
    const notchLevel = baseline - amp * notchDepth;
    return peakLevel + fall * (notchLevel - peakLevel);
  }

  // 3. Dicrotic Notch & Secondary Diastolic Wave (p: 0.44 -> 0.64)
  if (p >= 0.44 && p < 0.64) {
    const rel = (p - 0.44) / 0.20;
    const notchLevel = baseline - amp * notchDepth;
    const rebound = Math.sin(rel * Math.PI) * (amp * dicroticPeakHeight);
    return notchLevel - rebound;
  }

  // 4. Diastolic Runoff to Baseline (p: 0.64 -> 1.0)
  const runoff = (p - 0.64) / 0.36;
  const notchLevel = baseline - amp * notchDepth;
  const runoffDecay = Math.cos(runoff * Math.PI * 0.5);
  return baseline - (notchLevel - baseline) * -1 * Math.pow(runoffDecay, 2);
}

// Alternative ECG Lead II rhythm strip (P-QRS-T complex)
function computeECGWaveY(p: number, midY: number, amp: number): number {
  const baseline = midY + amp * 0.20;

  // P wave
  if (p >= 0.05 && p < 0.15) {
    const prog = (p - 0.05) / 0.10;
    return baseline - Math.sin(prog * Math.PI) * (amp * 0.22);
  }
  // PR segment
  if (p >= 0.15 && p < 0.21) return baseline;
  // Q dip
  if (p >= 0.21 && p < 0.235) {
    const prog = (p - 0.21) / 0.025;
    return baseline + Math.sin(prog * Math.PI) * (amp * 0.15);
  }
  // R peak spike
  if (p >= 0.235 && p < 0.275) {
    const prog = (p - 0.235) / 0.04;
    return baseline - Math.sin(prog * Math.PI) * (amp * 1.55);
  }
  // S dip
  if (p >= 0.275 && p < 0.315) {
    const prog = (p - 0.275) / 0.04;
    return baseline + Math.sin(prog * Math.PI) * (amp * 0.26);
  }
  // ST segment
  if (p >= 0.315 && p < 0.38) return baseline;
  // T wave
  if (p >= 0.38 && p < 0.58) {
    const prog = (p - 0.38) / 0.20;
    return baseline - Math.sin(prog * Math.PI) * (amp * 0.42);
  }
  return baseline;
}

export const MiniPPGWaveform: React.FC<MiniPPGWaveformProps> = ({
  heartRate = 75,
  spo2 = 95,
  respiratoryRate = 18,
  sensorQuality = 'VALID',
  patientId,
  height = 44,
  showMetrics = true,
  className = '',
  waveformMode = 'ppg'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef<number>(Math.floor(Math.random() * 500));
  const [activeMode, setActiveMode] = useState<'ppg' | 'ecg'>(waveformMode);

  const isDetached =
    sensorQuality === 'PROBE_REMOVED' ||
    sensorQuality === 'SENSOR_DISCONNECTED' ||
    heartRate === 0;
  const isNoisy = sensorQuality === 'MOTION_NOISE' || sensorQuality === 'NOISY';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const width = containerRef.current?.clientWidth || 280;
    const canvasHeight = Math.max(38, height);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    const midY = canvasHeight / 2;
    const baseAmp = canvasHeight * 0.32;

    // Couple to actual patient data
    const clampedHR = Math.max(45, Math.min(160, heartRate || 75));
    const clampedRR = Math.max(8, Math.min(45, respiratoryRate || 18));
    const clampedSpO2 = Math.max(80, Math.min(100, spo2 || 95));

    const beatDistance = Math.max(46, Math.min(110, Math.round(5200 / clampedHR)));
    const scrollSpeed = Math.max(1.0, (clampedHR / 75) * 1.45);

    // Dynamic physiological modulation parameters based on data:
    // Higher respiratory rate = faster breathing modulation frequency
    const respFrequency = 0.014 * (clampedRR / 18);
    // Lower SpO2 = higher amplitude fluctuation (Delta POP / pulsus paradoxus)
    const spo2ModulationDepth = Math.max(0.08, (100 - clampedSpO2) * 0.022);

    const render = () => {
      offsetRef.current += scrollSpeed;
      const currentOffset = offsetRef.current;

      // Hospital dark cyan-black background
      ctx.fillStyle = '#030814';
      ctx.fillRect(0, 0, width, canvasHeight);

      // Draw Medical Telemetry Grid
      ctx.lineWidth = 0.8;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      const minorStep = 10;
      for (let gx = 0; gx < width; gx += minorStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, canvasHeight);
        ctx.stroke();
      }
      for (let gy = 0; gy < canvasHeight; gy += minorStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      const majorStep = 30;
      for (let gx = 0; gx < width; gx += majorStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, canvasHeight);
        ctx.stroke();
      }
      for (let gy = 0; gy < canvasHeight; gy += majorStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Calculate points across full width with dynamic fluctuations
      const pts: { x: number; y: number }[] = [];

      for (let x = 0; x <= width; x += 1) {
        let y = midY;

        if (isDetached) {
          y = midY + Math.sin((x + currentOffset) * 0.15) * 0.7 + (Math.random() - 0.5) * 0.8;
        } else if (isNoisy) {
          const noise =
            Math.sin((x + currentOffset) * 0.09) * (baseAmp * 0.8) +
            Math.cos((x + currentOffset) * 0.25) * (baseAmp * 0.45);
          y = Math.max(3, Math.min(canvasHeight - 3, midY + noise));
        } else {
          const t = x + currentOffset;

          // 1. Dynamic Heart Rate Variability (HRV) fluctuation:
          // Local beat distance breathes and fluctuates smoothly
          const hrvOffset = Math.sin(t * 0.012) * 4.2 + Math.sin(t * 0.003) * 2.5;
          const dynamicBeatDist = Math.max(38, beatDistance + hrvOffset);
          const cycleP = (((t % dynamicBeatDist) + dynamicBeatDist) % dynamicBeatDist) / dynamicBeatDist;

          // 2. Dynamic Amplitude Fluctuation (Delta-POP coupled to RR and SpO2):
          // Intrathoracic pressure changes during respiration modulate pulse volume
          const respWave = Math.sin(t * respFrequency);
          const dynAmp =
            baseAmp *
            (1.0 +
              respWave * spo2ModulationDepth +
              Math.sin(t * 0.006) * 0.07);

          if (activeMode === 'ecg') {
            y = computeECGWaveY(cycleP, midY, dynAmp);
          } else {
            y = computePPGWaveY(cycleP, midY, dynAmp, patientId);
          }

          // 3. Natural respiratory baseline wander coupled to respiratory rate
          y += Math.sin(t * respFrequency) * 1.8;
          y = Math.max(3, Math.min(canvasHeight - 3, y));
        }

        pts.push({ x, y });
      }

      // Translucent Gradient Fill Under the Wave
      if (!isDetached && pts.length > 0) {
        const fillGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        if (isNoisy) {
          fillGrad.addColorStop(0, 'rgba(192, 132, 252, 0.22)');
          fillGrad.addColorStop(1, 'rgba(192, 132, 252, 0.0)');
        } else if (activeMode === 'ecg') {
          fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
          fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        } else {
          fillGrad.addColorStop(0, 'rgba(20, 184, 166, 0.28)');
          fillGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.12)');
          fillGrad.addColorStop(1, 'rgba(3, 8, 20, 0.0)');
        }

        ctx.fillStyle = fillGrad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, canvasHeight);
        for (let i = 0; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.lineTo(pts[pts.length - 1].x, canvasHeight);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Vivid Glowing Waveform Line
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isDetached) {
        ctx.strokeStyle = '#F43F5E';
        ctx.shadowColor = 'rgba(244, 63, 94, 0.85)';
        ctx.shadowBlur = 4;
      } else if (isNoisy) {
        ctx.strokeStyle = '#C084FC';
        ctx.shadowColor = 'rgba(192, 132, 252, 0.85)';
        ctx.shadowBlur = 4;
      } else if (activeMode === 'ecg') {
        ctx.strokeStyle = '#38BDF8';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
        ctx.shadowBlur = 4;
      } else {
        ctx.strokeStyle = '#2DD4BF';
        ctx.shadowColor = 'rgba(45, 212, 191, 0.85)';
        ctx.shadowBlur = 5;
      }

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      ctx.shadowBlur = 0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [heartRate, spo2, respiratoryRate, isDetached, isNoisy, height, activeMode, patientId]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-lg bg-[#030814] border border-cyan-950/60 overflow-hidden flex flex-col justify-center shadow-inner group ${className}`}
      style={{ height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />

      {showMetrics && (
        <div className="absolute top-1 right-1.5 flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMode((prev) => (prev === 'ppg' ? 'ecg' : 'ppg'));
            }}
            title="Click to toggle between PPG Plethysmogram and ECG Lead II"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            {activeMode === 'ppg' ? '→ ECG' : '→ PLETH'}
          </button>

          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
              isDetached
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                : isNoisy
                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                : 'bg-teal-950/80 text-teal-300 border border-teal-500/40 shadow-xs'
            }`}
          >
            {isDetached ? 'FLATLINE' : isNoisy ? 'ARTIFACT' : `${heartRate} BPM`}
          </span>
        </div>
      )}

      {/* Optical PPG small identifier */}
      <div className="absolute bottom-1 left-1.5 flex items-center gap-1 pointer-events-none">
        <Activity className="w-2.5 h-2.5 text-teal-400 opacity-90 animate-pulse" />
        <span className="text-[8px] font-mono text-teal-400/90 tracking-wider font-semibold">
          {activeMode === 'ppg' ? 'PPG PLETH' : 'ECG LEAD II'}
        </span>
      </div>
    </div>
  );
};
