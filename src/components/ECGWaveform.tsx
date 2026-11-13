import React, { useRef, useEffect, useState } from 'react';
import { Activity, Radio, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface ECGWaveformProps {
  heartRate?: number;
  patientName?: string;
  lead?: string;
  quality?: string;
}

export const ECGWaveform: React.FC<ECGWaveformProps> = ({
  heartRate = 78,
  patientName = 'Marcus Chen',
  lead = 'Lead II',
  quality = 'VALID'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedLead, setSelectedLead] = useState<string>(lead);
  const [sweepSpeed, setSweepSpeed] = useState<'25' | '50'>('25');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const isProbeRemoved = quality === 'PROBE_REMOVED' || heartRate === 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let scanX = 0;
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    // Buffer to hold drawn points
    const points: (number | null)[] = new Array(width).fill(null);

    // Audio beep simulation via Web Audio API if enabled
    let audioCtx: AudioContext | null = null;
    const playBeep = () => {
      if (!soundEnabled || isProbeRemoved) return;
      try {
        if (!audioCtx) {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 beep
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
      } catch {
        // ignore audio failure
      }
    };

    // Calculate beat interval in pixels based on heart rate
    // E.g. at 75 bpm, 1 beat every 0.8s. At 60 fps & sweep 25mm/s, ~120px
    const beatDistance = Math.max(70, Math.min(220, Math.round(7200 / Math.max(40, heartRate))));
    let beatProgress = 0;

    const render = () => {
      // Calculate next Y value
      let y = midY;

      if (isProbeRemoved) {
        // Flatline with small micro-noise
        y = midY + (Math.random() - 0.5) * 1.5;
      } else {
        beatProgress += 1;
        if (beatProgress >= beatDistance) {
          beatProgress = 0;
          playBeep();
        }

        const p = beatProgress;

        if (p >= 8 && p < 18) {
          // P-wave
          const angle = ((p - 8) / 10) * Math.PI;
          y = midY - Math.sin(angle) * 7;
        } else if (p >= 20 && p < 23) {
          // Q-wave (small dip)
          y = midY + 5;
        } else if (p >= 23 && p < 27) {
          // R-wave (sharp spike)
          const rProgress = (p - 23) / 4;
          y = midY - 38 + Math.abs(rProgress - 0.5) * 12;
        } else if (p >= 27 && p < 30) {
          // S-wave (deep dip)
          y = midY + 12;
        } else if (p >= 36 && p < 50) {
          // T-wave
          const angle = ((p - 36) / 14) * Math.PI;
          y = midY - Math.sin(angle) * 11;
        } else {
          // Baseline with gentle respiratory oscillation
          y = midY + Math.sin(scanX * 0.02) * 1.5 + (Math.random() - 0.5) * 0.8;
        }
      }

      points[scanX] = y;

      // Clear small erase window ahead of scanline
      const eraseWidth = 24;
      for (let i = 0; i < eraseWidth; i++) {
        const eraseIdx = (scanX + i) % width;
        points[eraseIdx] = null;
      }

      // Redraw canvas
      ctx.clearRect(0, 0, width, height);

      // Draw ECG wave
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isProbeRemoved) {
        ctx.strokeStyle = '#EF4444'; // Red flatline for detached sensor
      } else {
        ctx.strokeStyle = '#10B981'; // Medical green / emerald phosphor
      }

      ctx.beginPath();
      let started = false;
      for (let x = 0; x < width; x++) {
        const py = points[x];
        if (py === null) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(x, py);
          started = true;
        } else {
          ctx.lineTo(x, py);
        }
      }
      ctx.stroke();

      // Draw animated sweep lead dot
      ctx.fillStyle = isProbeRemoved ? '#FCA5A5' : '#34D399';
      ctx.shadowColor = isProbeRemoved ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(scanX, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Advance scan line
      const step = sweepSpeed === '50' ? 2 : 1;
      scanX = (scanX + step) % width;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (audioCtx) {
        audioCtx.close();
      }
    };
  }, [heartRate, isProbeRemoved, sweepSpeed, soundEnabled]);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 text-white overflow-hidden shadow-md">
      {/* Waveform Header Bar */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-teal-400">
            <Activity className="w-4 h-4 animate-pulse text-emerald-400" />
            <span>REAL-TIME TELEMETRY WAVEFORM</span>
          </div>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300 font-medium">{patientName}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">1 mV = 10 mm</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Lead Selector */}
          <div className="flex rounded-md bg-slate-800/80 p-0.5 border border-slate-700">
            {['Lead I', 'Lead II', 'Lead V5'].map((l) => (
              <button
                key={l}
                onClick={() => setSelectedLead(l)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  selectedLead === l ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Speed Selector */}
          <div className="flex rounded-md bg-slate-800/80 p-0.5 border border-slate-700">
            {(['25', '50'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSweepSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  sweepSpeed === s ? 'bg-slate-700 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}mm/s
              </button>
            ))}
          </div>

          {/* Audio Beep Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute QRS sound' : 'Enable QRS sound (880Hz)'}
            className={`p-1 rounded border transition-colors ${
              soundEnabled
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Canvas Area with Medical Grid */}
      <div className="relative p-2 bg-slate-950 ecg-grid-dark">
        <canvas
          ref={canvasRef}
          width={720}
          height={130}
          className="w-full h-32 block rounded"
        />

        {/* Real-time Overlay Counters */}
        <div className="absolute top-4 right-4 flex items-center gap-4 bg-slate-900/80 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-800 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Pulse Rate
            </div>
            <div className={`text-2xl font-mono font-bold ${isProbeRemoved ? 'text-rose-500' : 'text-emerald-400'}`}>
              {isProbeRemoved ? '---' : `${heartRate}`}
              <span className="text-xs font-normal text-slate-400 ml-1">bpm</span>
            </div>
          </div>
          <div className="border-l border-slate-800 pl-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Signal Quality
            </div>
            <div className="text-xs font-semibold text-teal-400 mt-1 flex items-center gap-1 justify-end">
              <span className={`w-2 h-2 rounded-full ${isProbeRemoved ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
              {quality}
            </div>
          </div>
        </div>

        {/* Lead Calibration Marker */}
        <div className="absolute bottom-3 left-4 text-[10px] font-mono text-slate-500 flex items-center gap-2">
          <span>{selectedLead}</span>
          <span>•</span>
          <span>FILTER: 0.05-150Hz</span>
          <span>•</span>
          <span>CAL: 10mm/mV</span>
        </div>
      </div>
    </div>
  );
};
