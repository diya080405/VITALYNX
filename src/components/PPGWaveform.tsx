import React, { useRef, useEffect, useState } from 'react';
import { Activity, Radio, Volume2, VolumeX, ShieldCheck, AlertTriangle } from 'lucide-react';

interface PPGWaveformProps {
  heartRate?: number;
  spo2?: number;
  respiratoryRate?: number;
  patientName?: string;
  sensorQuality?: string;
  samplingRate?: number; // e.g. 125 Hz or 250 Hz
  showControls?: boolean;
}

// 1. Authentic Photoplethysmogram (PPG) Arterial Volume Wave
function computePPGWaveY(p: number, midY: number, amp: number): number {
  const baseline = midY + amp * 0.42;
  const notchDepth = 0.52;
  const dicroticPeakHeight = 0.28;

  // A. Rapid Systolic Upstroke & Peak (p: 0.0 -> 0.28)
  if (p < 0.28) {
    const rise = p / 0.28;
    const curve = Math.sin(rise * Math.PI * 0.5);
    return baseline - Math.pow(curve, 1.6) * (amp * 1.55);
  }

  // B. Catacrotic Decline to Dicrotic Notch (p: 0.28 -> 0.44)
  if (p >= 0.28 && p < 0.44) {
    const rel = (p - 0.28) / 0.16;
    const fall = Math.sin(rel * Math.PI * 0.5);
    const peakLevel = baseline - amp * 1.55;
    const notchLevel = baseline - amp * notchDepth;
    return peakLevel + fall * (notchLevel - peakLevel);
  }

  // C. Dicrotic Notch & Secondary Diastolic Wave (p: 0.44 -> 0.64)
  if (p >= 0.44 && p < 0.64) {
    const rel = (p - 0.44) / 0.20;
    const notchLevel = baseline - amp * notchDepth;
    const rebound = Math.sin(rel * Math.PI) * (amp * dicroticPeakHeight);
    return notchLevel - rebound;
  }

  // D. Diastolic Runoff to Baseline (p: 0.64 -> 1.0)
  const runoff = (p - 0.64) / 0.36;
  const notchLevel = baseline - amp * notchDepth;
  const runoffDecay = Math.cos(runoff * Math.PI * 0.5);
  return baseline - (notchLevel - baseline) * -1 * Math.pow(runoffDecay, 2);
}

// 2. ECG Lead II Rhythm Strip (P-QRS-T complex matching user's monitor reference)
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

export const PPGWaveform: React.FC<PPGWaveformProps> = ({
  heartRate = 78,
  spo2 = 95,
  respiratoryRate = 18,
  patientName = 'Marcus Chen',
  sensorQuality = 'VALID',
  samplingRate = 125,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [sweepSpeed, setSweepSpeed] = useState<'25' | '50'>('25');
  const [activeChannel, setActiveChannel] = useState<'ppg' | 'ecg'>('ppg');
  const offsetRef = useRef<number>(Math.floor(Math.random() * 500));
  const lastBeepRef = useRef<number>(0);

  const isProbeRemoved =
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
    const width = 720;
    const height = 120;
    canvas.width = width;
    canvas.height = height;

    const midY = height / 2;
    const baseAmp = height * 0.32;

    // Audio beep for pulse peak if sound enabled
    let audioCtx: AudioContext | null = null;
    const playPulseSound = () => {
      if (!soundEnabled || isProbeRemoved) return;
      try {
        if (!audioCtx) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5 pleasant pulse tone
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.07);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.07);
      } catch {
        // audio muted or unsupported
      }
    };

    const clampedHR = Math.max(40, Math.min(180, heartRate));
    const clampedRR = Math.max(8, Math.min(45, respiratoryRate));
    const clampedSpO2 = Math.max(80, Math.min(100, spo2));

    const baseDistance = Math.round(7600 / clampedHR);
    const beatDistance = sweepSpeed === '50' ? baseDistance * 1.5 : baseDistance;
    const scrollSpeed = (sweepSpeed === '50' ? 2.8 : 1.7) * (clampedHR / 75);

    // Physiological dynamic coupling parameters:
    const respFrequency = 0.012 * (clampedRR / 18);
    // Lower SpO2 increases pulse amplitude fluctuation (Delta-POP / respiratory paradox)
    const spo2ModulationDepth = Math.max(0.09, (100 - clampedSpO2) * 0.024);

    const render = () => {
      offsetRef.current += scrollSpeed;
      const currentOffset = offsetRef.current;

      // Pulse audio trigger
      const beatCycle = currentOffset % beatDistance;
      if (beatCycle < scrollSpeed && Date.now() - lastBeepRef.current > 400) {
        lastBeepRef.current = Date.now();
        playPulseSound();
      }

      // Clear Canvas
      ctx.fillStyle = '#030814';
      ctx.fillRect(0, 0, width, height);

      // Draw Medical Grid
      ctx.lineWidth = 1;

      // Minor grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      const minorStep = 10;
      for (let gx = 0; gx < width; gx += minorStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += minorStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Major grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      const majorStep = 30;
      for (let gx = 0; gx < width; gx += majorStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += majorStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Compute points across all 720 pixels with live data-coupled fluctuations
      const pts: { x: number; y: number }[] = [];

      for (let x = 0; x <= width; x++) {
        let y = midY;

        if (isProbeRemoved) {
          y = midY + Math.sin((x + currentOffset) * 0.15) * 0.8 + (Math.random() - 0.5) * 1.0;
        } else if (isNoisy) {
          const noise =
            Math.sin((x + currentOffset) * 0.08) * (baseAmp * 0.85) +
            Math.cos((x + currentOffset) * 0.22) * (baseAmp * 0.45);
          y = Math.max(4, Math.min(height - 4, midY + noise));
        } else {
          const t = x + currentOffset;

          // 1. Dynamic Heart Rate Variability (HRV):
          const hrvOffset = Math.sin(t * 0.012) * 5.5 + Math.sin(t * 0.003) * 3.2;
          const dynamicBeatDist = Math.max(42, beatDistance + hrvOffset);
          const cycleP = (((t % dynamicBeatDist) + dynamicBeatDist) % dynamicBeatDist) / dynamicBeatDist;

          // 2. Dynamic Amplitude Fluctuation (Delta-POP coupled to RR and SpO2):
          const respWave = Math.sin(t * respFrequency);
          const dynAmp =
            baseAmp *
            (1.0 +
              respWave * spo2ModulationDepth +
              Math.sin(t * 0.005) * 0.06);

          if (activeChannel === 'ecg') {
            y = computeECGWaveY(cycleP, midY, dynAmp);
          } else {
            y = computePPGWaveY(cycleP, midY, dynAmp);
          }

          // 3. Natural respiratory baseline wander
          y += Math.sin(t * respFrequency) * 2.2;
          y = Math.max(3, Math.min(height - 3, y));
        }

        pts.push({ x, y });
      }

      // Translucent Gradient Fill Under the Wave
      if (!isProbeRemoved && pts.length > 0) {
        const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
        if (isNoisy) {
          fillGrad.addColorStop(0, 'rgba(192, 132, 252, 0.22)');
          fillGrad.addColorStop(1, 'rgba(192, 132, 252, 0.0)');
        } else if (activeChannel === 'ecg') {
          fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
          fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        } else {
          fillGrad.addColorStop(0, 'rgba(45, 212, 191, 0.26)');
          fillGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.10)');
          fillGrad.addColorStop(1, 'rgba(3, 8, 20, 0.0)');
        }

        ctx.fillStyle = fillGrad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, height);
        for (let i = 0; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.lineTo(pts[pts.length - 1].x, height);
        ctx.closePath();
        ctx.fill();
      }

      // Draw Glowing Wave Line
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isProbeRemoved) {
        ctx.strokeStyle = '#F43F5E';
        ctx.shadowColor = 'rgba(244, 63, 94, 0.85)';
        ctx.shadowBlur = 5;
      } else if (isNoisy) {
        ctx.strokeStyle = '#C084FC';
        ctx.shadowColor = 'rgba(192, 132, 252, 0.85)';
        ctx.shadowBlur = 5;
      } else if (activeChannel === 'ecg') {
        ctx.strokeStyle = '#38BDF8';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
        ctx.shadowBlur = 5;
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

      // Draw Time Axis Markers
      ctx.fillStyle = '#64748B';
      ctx.font = '9px monospace';
      const secondPixels = width / 5;
      for (let s = 0; s <= 5; s++) {
        const tx = Math.min(width - 20, s * secondPixels + 4);
        ctx.fillText(`${s}s`, tx, height - 4);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (audioCtx) {
        audioCtx.close();
      }
    };
  }, [heartRate, spo2, respiratoryRate, isProbeRemoved, isNoisy, sweepSpeed, soundEnabled, activeChannel]);

  return (
    <div className="bg-[#030814] rounded-xl border border-slate-800 text-white overflow-hidden shadow-md text-left">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold text-teal-400">
            <Activity className="w-4 h-4 text-teal-400 animate-pulse" />
            <span>
              {activeChannel === 'ppg'
                ? 'PHOTOPLETHYSMOGRAM (PPG PLETH)'
                : 'ELECTROCARDIOGRAM (ECG LEAD II)'}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-medium">{patientName}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {activeChannel === 'ppg' ? 'Optical Blood Volume Wave' : 'Cardiac Rhythm Strip'}
          </span>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* Waveform Channel Mode Selector */}
            <div className="flex rounded bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => setActiveChannel('ppg')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  activeChannel === 'ppg'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PPG Pleth
              </button>
              <button
                onClick={() => setActiveChannel('ecg')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  activeChannel === 'ecg'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ECG Lead II
              </button>
            </div>

            {/* Sweep Speed Selector */}
            <div className="flex rounded bg-slate-800 p-0.5 border border-slate-700">
              {(['25', '50'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSweepSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    sweepSpeed === s
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}mm/s
                </button>
              ))}
            </div>

            {/* Pulse Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute pulse sound' : 'Enable audio tone'}
              className={`p-1 rounded border transition-colors ${
                soundEnabled
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="relative p-2 bg-[#030814]">
        <canvas
          ref={canvasRef}
          width={720}
          height={120}
          className="w-full h-28 block rounded"
        />

        {/* Real-time Overlays */}
        <div className="absolute top-3 right-4 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-800 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Pulse Rate
            </div>
            <div
              className={`text-xl font-mono font-bold ${
                isProbeRemoved ? 'text-rose-400' : 'text-teal-300'
              }`}
            >
              {isProbeRemoved ? '---' : `${heartRate}`}
              <span className="text-xs font-normal text-slate-400 ml-1">bpm</span>
            </div>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Signal Quality (SQI)
            </div>
            <div
              className={`text-xs font-semibold mt-0.5 flex items-center gap-1 justify-end ${
                isProbeRemoved
                  ? 'text-rose-400'
                  : isNoisy
                  ? 'text-purple-400'
                  : 'text-emerald-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isProbeRemoved ? 'bg-rose-500 animate-ping' : 'bg-teal-400'
                }`}
              />
              {isProbeRemoved
                ? 'PROBE REMOVED'
                : isNoisy
                ? 'MOTION NOISE'
                : '98% (VALID)'}
            </div>
          </div>
        </div>

        {/* Signal Specs Footer Marker */}
        <div className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-500 flex items-center gap-2">
          <span>
            {activeChannel === 'ppg'
              ? 'SIGNAL: Photoplethysmography (PPG) Arterial Volume'
              : 'SIGNAL: Electrocardiogram (ECG) Lead II'}
          </span>
          <span>•</span>
          <span>FILTER: 0.5–8.0 Hz Bandpass</span>
          <span>•</span>
          <span>TIME AXIS: 5.0s Window</span>
        </div>
      </div>
    </div>
  );
};
