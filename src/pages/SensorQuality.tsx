import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { SensorQualityState } from '../types/sensor';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  WifiOff,
  Activity,
  Zap,
  Info,
  Clock,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  Radio,
  Sliders
} from 'lucide-react';

export const SensorQuality: React.FC = () => {
  const { sensorEvents, patients, navigateToPatient } = useApp();
  const [selectedQualityFilter, setSelectedQualityFilter] = useState<string>('ALL');

  const filteredEvents = sensorEvents.filter((ev) => {
    if (selectedQualityFilter === 'ALL') return true;
    return ev.artifactType === selectedQualityFilter || ev.qualityState === selectedQualityFilter;
  });

  return (
    <div className="space-y-5 text-left">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Sensor Artifact Detection & Signal Quality Interface
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Active Artifact Gate
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Distinguishing genuine physiological patient deterioration from sensor disconnections, motion corruption, and hardware artifacts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">False Alarms Blocked</span>
            <span className="text-sm font-bold text-emerald-900 font-mono">82.4%</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-700 block">Mean Quality Index</span>
            <span className="text-sm font-bold text-slate-900 font-mono">96.2%</span>
          </div>
        </div>
      </div>

      {/* Safety Principle Banner: PROBE REMOVED IS NOT PATIENT DETERIORATION */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-3 shadow-xs">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-900 block mb-0.5 text-sm">
            Core Safety Principle: Probe Removal ≠ Patient Deterioration
          </span>
          <span className="leading-relaxed">
            When a wearable sensor unclips or falls off (e.g., pulse-oximeter removed during ambulation), readings like SpO2 0% or pulse rate 0 are classified strictly as <strong>PROBE_REMOVED</strong>. The system recognizes that <em>the sensor has lost contact or its signal</em>, generating an actionable device re-attachment reminder instead of an erroneous cardiac arrest code blue.
          </span>
        </div>
      </div>

      {/* The 6 Mandatory Artifact Categories Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Probe Removed */}
        <div className="bg-white rounded-xl border border-rose-300 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-rose-600" />
                1. Probe Removed
              </span>
              <span className="text-[10px] font-mono font-bold text-rose-600">PROBE_REMOVED</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Optical Sensor Dislodgement
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              SpO2 reads 0% or null, pulse flatlines. Optical sensor ambient photodiode detects ambient air exposure rather than tissue bed.
            </p>
          </div>
          <div className="p-2 bg-rose-50/70 rounded text-[10px] text-rose-900 font-medium border border-rose-200">
            <strong>Action:</strong> Dispatched as wearable reconnection alert; suppressed from clinical crisis escalation.
          </div>
        </div>

        {/* 2. Sensor Disconnected */}
        <div className="bg-white rounded-xl border border-rose-200 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-rose-500" />
                2. Sensor Disconnected
              </span>
              <span className="text-[10px] font-mono font-bold text-rose-500">DISCONNECTED</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Telemetry Link Interruption
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              Bluetooth 5.2 radio beacon drops below -95 dBm RSSI. Communication link between wearable patch and home gateway terminated.
            </p>
          </div>
          <div className="p-2 bg-slate-100 rounded text-[10px] text-slate-800 font-medium border border-slate-200">
            <strong>Action:</strong> Gateway attempts automatic channel frequency hop; alerts caregiver if offline &gt;5 min.
          </div>
        </div>

        {/* 3. Missing Readings */}
        <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-slate-500" />
                3. Missing Readings
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-600">MISSING_DATA</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Telemetry Frame Gaps
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              Wearable ceases streaming data packets for &gt;180 seconds. In compliance with safety standards, blank data is never silently filled with 0s.
            </p>
          </div>
          <div className="p-2 bg-slate-100 rounded text-[10px] text-slate-800 font-medium border border-slate-200">
            <strong>Action:</strong> Parameters flagged as <code>MISSING</code> in NEWS2 scoring; triggers technical inspection.
          </div>
        </div>

        {/* 4. Flatlined Signal */}
        <div className="bg-white rounded-xl border border-amber-300 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber-600" />
                4. Flatlined Signal
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-600">FLATLINE_LOCKUP</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              ADC Register Freeze / Hardware Hang
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              Repeated identical numerical values streamed across rolling windows (&gt;30s). Eliminates false assumption that patient is biologically invariant.
            </p>
          </div>
          <div className="p-2 bg-amber-50/70 rounded text-[10px] text-amber-900 font-medium border border-amber-200">
            <strong>Action:</strong> Firmware watchdog timer initiated to soft-reset optical ADC register.
          </div>
        </div>

        {/* 5. Motion-Related Noise */}
        <div className="bg-white rounded-xl border border-purple-300 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1">
                <Zap className="w-3 h-3 text-purple-600" />
                5. Motion-Related Noise
              </span>
              <span className="text-[10px] font-mono font-bold text-purple-600">MOTION_NOISE</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Limb Acceleration Interference
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              Patient ambulating, brushing hair, or shivering produces accelerometer variance &gt;1.5g. Optical PPG peaks lose dicrotic notch definition.
            </p>
          </div>
          <div className="p-2 bg-purple-50/70 rounded text-[10px] text-purple-900 font-medium border border-purple-200">
            <strong>Action:</strong> Telemetry buffered and quarantined until patient completes resting window.
          </div>
        </div>

        {/* 6. Poor Signal Quality */}
        <div className="bg-white rounded-xl border border-indigo-300 p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                <Radio className="w-3 h-3 text-indigo-600" />
                6. Poor Signal Quality
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-600">DEGRADED_SQI</span>
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Low Perfusion / Optical Attenuation
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              Perfusion Index (PI) drops below 0.2% due to cold extremities or loose wristband tension. Signal-to-noise ratio drops below 10 dB.
            </p>
          </div>
          <div className="p-2 bg-indigo-50/70 rounded text-[10px] text-indigo-900 font-medium border border-indigo-200">
            <strong>Action:</strong> Automated prompt to warm hand or adjust sensor strap tension before recalculating.
          </div>
        </div>
      </div>

      {/* Sensor Event Log Table: All fields requested in Section 6 */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Sensor Artifact & Quality Audit Registry
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Displays Artifact Type, Affected Vital/Sensor, Timestamp, Signal Status, and Clinical Explanation for every detected event.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              'ALL',
              'Probe Removed',
              'Sensor Disconnected',
              'Missing Readings',
              'Flatlined Signal',
              'Motion-Related Noise',
              'Poor Signal Quality'
            ].map((f) => (
              <button
                key={f}
                onClick={() => setSelectedQualityFilter(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  selectedQualityFilter === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Event ID</th>
                <th className="py-2.5 px-3">Artifact Type</th>
                <th className="py-2.5 px-3">Affected Vital Sign / Sensor</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-center">Signal Status</th>
                <th className="py-2.5 px-3">Clinical Explanation</th>
                <th className="py-2.5 px-3">False Alert Prevented</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">{ev.id}</td>
                  <td className="py-3 px-3 font-bold text-slate-800">
                    <span className="inline-flex items-center gap-1">
                      {ev.artifactType === 'Probe Removed' && <WifiOff className="w-3.5 h-3.5 text-rose-600" />}
                      {ev.artifactType === 'Motion-Related Noise' && <Zap className="w-3.5 h-3.5 text-purple-600" />}
                      {ev.artifactType === 'Flatlined Signal' && <Activity className="w-3.5 h-3.5 text-amber-600" />}
                      {ev.artifactType}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">
                    {ev.affectedVital}
                    <div className="text-[10px] text-slate-500 font-mono">{ev.sensorType}</div>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900">
                    <button
                      onClick={() => navigateToPatient(ev.patientId)}
                      className="hover:text-teal-700 transition-colors"
                    >
                      {ev.patientName} <span className="font-mono text-slate-500">({ev.patientId})</span>
                    </button>
                  </td>
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{ev.timestamp}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      ev.signalStatus === 'REMOVED'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : ev.signalStatus === 'FROZEN'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : ev.signalStatus === 'ERRATIC'
                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}>
                      {ev.signalStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 max-w-sm leading-relaxed">
                    {ev.explanation}
                  </td>
                  <td className="py-3 px-3 text-emerald-800 font-semibold max-w-xs">
                    {ev.clinicalImpactPrevented}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
