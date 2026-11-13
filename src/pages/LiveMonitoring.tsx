import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PPGWaveform } from '../components/PPGWaveform';
import { StatusBadge } from '../components/StatusBadge';
import { getPatientAvatar } from '../utils/patientAssets';
import {
  Activity,
  Heart,
  Wind,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  WifiOff,
  Maximize2,
  Sparkles,
  ArrowUpRight,
  Radio
} from 'lucide-react';

export const LiveMonitoring: React.FC = () => {
  const { patients, navigateToPatient } = useApp();
  const [selectedFocusPatientId, setSelectedFocusPatientId] = useState<string | null>(null);

  const focusPatient = selectedFocusPatientId
    ? patients.find((p) => p.id === selectedFocusPatientId)
    : null;

  return (
    <div className="space-y-5 text-left">
      {/* Top Telemetry Header */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base font-bold tracking-tight">
              Central Telemetry Surveillance Wall
            </h2>
            <span className="text-xs font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded">
              6 Channels Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Continuous multi-parameter wearable bio-sensor feeds with real-time artifact filtration.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300">
            <Radio className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
            <span>Sample Rate: 250 Hz (PPG/ECG)</span>
          </div>
        </div>
      </div>

      {/* Main Telemetry Grid (6 beds) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.map((patient) => {
          const isDetached = patient.latestVitals.sensorQuality === 'PROBE_REMOVED';
          const isScale2 = patient.spo2Scale === 'SCALE_2';

          return (
            <div
              key={patient.id}
              className="bg-slate-950 text-white rounded-xl border border-slate-800/90 p-4 shadow-md flex flex-col justify-between space-y-3 hover:border-teal-500/50 transition-colors"
            >
              {/* Patient Top Bar */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <img
                    src={getPatientAvatar(patient.id, patient.avatarUrl)}
                    alt={patient.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <span>{patient.name}</span>
                      <span className="text-xs text-slate-400 font-mono">({patient.id})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                      {patient.roomBed || 'Home Bed'} • {patient.age}y
                    </div>
                  </div>
                </div>

                <StatusBadge type="alert" value={patient.currentAlertCategory} size="sm" />
              </div>

              {/* Mini PPG Waveform Canvas Strip */}
              <div className="rounded-lg overflow-hidden border border-slate-800/80">
                <PPGWaveform
                  heartRate={patient.latestVitals.heartRate}
                  spo2={patient.latestVitals.spo2}
                  respiratoryRate={patient.latestVitals.respiratoryRate}
                  patientName={patient.name}
                  sensorQuality={patient.latestVitals.sensorQuality}
                  showControls={false}
                />
              </div>

              {/* Vitals Telemetry Numbers */}
              <div className="grid grid-cols-4 gap-2 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80 font-mono text-center">
                {/* HR */}
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block mb-0.5">HR</span>
                  <span className={`text-sm font-extrabold ${isDetached ? 'text-slate-500' : 'text-emerald-400'}`}>
                    {isDetached ? '---' : patient.latestVitals.heartRate}
                  </span>
                  <span className="text-[9px] text-slate-400 font-sans block">bpm</span>
                </div>

                {/* SpO2 */}
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block mb-0.5">SpO2</span>
                  <span
                    className={`text-sm font-extrabold ${
                      isDetached
                        ? 'text-slate-500'
                        : isScale2 && patient.latestVitals.spo2 >= 88 && patient.latestVitals.spo2 <= 92
                        ? 'text-amber-400'
                        : patient.latestVitals.spo2 < 90
                        ? 'text-rose-400'
                        : 'text-teal-300'
                    }`}
                  >
                    {isDetached ? '---' : `${patient.latestVitals.spo2}%`}
                  </span>
                  <span className="text-[9px] text-slate-400 font-sans block">
                    {isScale2 ? 'Scale 2' : 'Scale 1'}
                  </span>
                </div>

                {/* RR */}
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block mb-0.5">RR</span>
                  <span className={`text-sm font-extrabold ${isDetached ? 'text-slate-500' : 'text-sky-400'}`}>
                    {isDetached ? '---' : patient.latestVitals.respiratoryRate}
                  </span>
                  <span className="text-[9px] text-slate-400 font-sans block">/min</span>
                </div>

                {/* Temp */}
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block mb-0.5">Temp</span>
                  <span className="text-sm font-extrabold text-amber-300">
                    {patient.latestVitals.temperature}°
                  </span>
                  <span className="text-[9px] text-slate-400 font-sans block">C</span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <StatusBadge type="sensor" value={patient.latestVitals.sensorQuality} size="sm" />
                <button
                  onClick={() => navigateToPatient(patient.id)}
                  className="px-2.5 py-1 rounded bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Drilldown</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
