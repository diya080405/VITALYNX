import React, { useRef, useEffect } from 'react';
import { Wind } from 'lucide-react';

interface RespiratoryWaveformProps {
  respiratoryRate?: number;
  patientName?: string;
  sensorQuality?: string;
}

export const RespiratoryWaveform: React.FC<RespiratoryWaveformProps> = ({
  respiratoryRate = 18,
  patientName = 'Marcus Chen',
  sensorQuality = 'VALID'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offsetRef = useRef<number>(Math.floor(Math.random() * 500));

  const isProbeRemoved =
    sensorQuality === 'PROBE_REMOVED' ||
    sensorQuality === 'SENSOR_DISCONNECTED' ||
    respiratoryRate === 0;
  const isMissing = sensorQuality === 'MISSING_READINGS' || sensorQuality === 'MISSING';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = 720;
    const height = 100;
    canvas.width = width;
    canvas.height = height;

    const midY = height / 2;
    const baseAmp = height * 0.35;

    // Respiration cycle length in pixels coupled to patient's actual rate
    const clampedRR = Math.max(8, Math.min(45, respiratoryRate));
    const baseDistance = Math.max(90, Math.min(260, Math.round(3600 / clampedRR)));
    const scrollSpeed = 1.35 * (clampedRR / 18);

    const render = () => {
      offsetRef.current += scrollSpeed;
      const currentOffset = offsetRef.current;

      // Hospital dark background
      ctx.fillStyle = '#030814';
      ctx.fillRect(0, 0, width, height);

      // Medical Grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.06)';
      const step = 20;
      for (let gx = 0; gx < width; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Major grid
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.12)';
      for (let gy = 0; gy < height; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Calculate points across full width with natural biological breath fluctuations
      const pts: { x: number; y: number }[] = [];

      for (let x = 0; x <= width; x++) {
        let y = midY;

        if (isProbeRemoved || isMissing) {
          y = midY + Math.sin((x + currentOffset) * 0.1) * 0.8 + (Math.random() - 0.5) * 1.0;
        } else {
          const t = x + currentOffset;

          // 1. Natural breath-to-breath timing fluctuation
          const timingDrift = Math.sin(t * 0.004) * 8.0;
          const dynamicBreathDist = Math.max(70, baseDistance + timingDrift);
          const p = (((t % dynamicBreathDist) + dynamicBreathDist) % dynamicBreathDist) / dynamicBreathDist;

          // 2. Natural tidal volume breath depth fluctuation (some shallower, some deeper sigh breaths)
          const tidalModulation =
            1.0 +
            0.18 * Math.sin(t * 0.0035) +
            0.08 * Math.cos(t * 0.009) +
            (Math.sin(t * 0.001) > 0.85 ? 0.25 : 0.0); // periodic sigh breath

          const dynAmp = baseAmp * tidalModulation;

          // 3. Smooth physiological thoracic expansion & recoil
          if (p < 0.42) {
            // Inhalation expansion
            const inProg = p / 0.42;
            const curve = Math.sin(inProg * Math.PI * 0.5);
            y = midY + (dynAmp * 0.38) - curve * (dynAmp * 1.38);
          } else {
            // Passive exhalation recoil
            const exProg = (p - 0.42) / 0.58;
            const curve = Math.cos(exProg * Math.PI * 0.5);
            y = (midY - dynAmp) + (1 - curve) * (dynAmp * 1.38);
          }

          // Subtle organic micro-variations
          y += Math.sin(t * 0.02) * 1.2;
          y = Math.max(3, Math.min(height - 3, y));
        }

        pts.push({ x, y });
      }

      // Translucent Gradient Fill Under the Respiratory Curve
      if (!isProbeRemoved && !isMissing && pts.length > 0) {
        const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
        fillGrad.addColorStop(0, 'rgba(2, 132, 199, 0.24)');
        fillGrad.addColorStop(0.7, 'rgba(14, 165, 233, 0.08)');
        fillGrad.addColorStop(1, 'rgba(3, 8, 20, 0.0)');

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

      // Draw Glowing Respiratory Line
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (isProbeRemoved || isMissing) {
        ctx.strokeStyle = '#F43F5E';
        ctx.shadowColor = 'rgba(244, 63, 94, 0.85)';
        ctx.shadowBlur = 4;
      } else {
        ctx.strokeStyle = '#0284C7';
        ctx.shadowColor = 'rgba(2, 132, 199, 0.85)';
        ctx.shadowBlur = 5;
      }

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Time axis
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

    return () => cancelAnimationFrame(animationFrameId);
  }, [respiratoryRate, isProbeRemoved, isMissing]);

  return (
    <div className="bg-[#030814] rounded-xl border border-slate-800 text-white overflow-hidden shadow-md text-left">
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="font-bold text-sky-400">RESPIRATORY WAVEFORM LIVE</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-medium">{patientName}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono text-[11px]">Continuous Thoracic Impedance</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[10px] font-mono text-slate-400">Thoracic Bio-impedance</span>
        </div>
      </div>

      <div className="relative p-2 bg-[#030814]">
        <canvas
          ref={canvasRef}
          width={720}
          height={100}
          className="w-full h-24 block rounded"
        />

        <div className="absolute top-2.5 right-4 bg-slate-900/90 backdrop-blur-xs px-3 py-1 rounded-lg border border-slate-800 text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Respiratory Rate
          </div>
          <div
            className={`text-lg font-mono font-bold ${
              isProbeRemoved ? 'text-rose-400' : 'text-sky-300'
            }`}
          >
            {isProbeRemoved ? '---' : `${respiratoryRate}`}
            <span className="text-xs font-normal text-slate-400 ml-1">breaths/min</span>
          </div>
        </div>

        <div className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-500 flex items-center gap-2">
          <span>SIGNAL: Impedance Pneumography (Resp) Continuous</span>
          <span>•</span>
          <span>TIME AXIS: 5.0s</span>
        </div>
      </div>
    </div>
  );
};
