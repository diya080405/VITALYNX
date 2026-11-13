import React from 'react';
import { Patient } from '../types/patient';
import { StatusBadge } from './StatusBadge';
import { MiniPPGWaveform } from './MiniPPGWaveform';
import { getPatientAvatar } from '../utils/patientAssets';
import {
  ArrowUpRight,
  Heart,
  Wind,
  Thermometer,
  Activity,
  Sparkles,
  ChevronRight,
  Eye,
  Clock
} from 'lucide-react';

interface PatientTableProps {
  patients: Patient[];
  onSelectPatient: (patientId: string) => void;
  selectedPatientId?: string;
}

export const PatientTable: React.FC<PatientTableProps> = ({
  patients,
  onSelectPatient,
  selectedPatientId
}) => {
  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200/80 shadow-xs">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
          <tr>
            <th className="py-3 px-4">Patient Name & ID</th>
            <th className="py-3 px-3">Conditions & Medications</th>
            <th className="py-3 px-3 text-center">Status</th>
            <th className="py-3 px-3 text-center">NEWS2</th>
            <th className="py-3 px-3 text-center">Heart Rate</th>
            <th className="py-3 px-3 text-left min-w-[170px]">Live PPG Waveform</th>
            <th className="py-3 px-3 text-center">SpO2 (Target)</th>
            <th className="py-3 px-3 text-center">Resp Rate</th>
            <th className="py-3 px-3 text-center">Temp</th>
            <th className="py-3 px-3">Last Updated</th>
            <th className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {patients.map((p) => {
            const isSelected = p.id === selectedPatientId;
            const isDetached = p.latestVitals.sensorQuality === 'PROBE_REMOVED' || p.latestVitals.sensorQuality === 'SENSOR_DISCONNECTED';

            return (
              <tr
                key={p.id}
                onClick={() => onSelectPatient(p.id)}
                className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${
                  isSelected ? 'bg-teal-50/40' : ''
                }`}
              >
                {/* Patient ID and Name */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={getPatientAvatar(p.id, p.avatarUrl)}
                      alt={p.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="font-bold text-slate-900 hover:text-teal-700 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        {p.id} • {p.age}y {p.gender[0]}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Conditions & Medications */}
                <td className="py-3 px-3">
                  <div className="max-w-[200px] truncate font-medium text-slate-800" title={p.primaryDiagnosis}>
                    {p.primaryDiagnosis}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5" title={p.medications.join(', ')}>
                    Meds: {p.medications[0] || 'Standard protocol'}
                  </div>
                  {p.spo2Scale === 'SCALE_2' && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-1 py-0.2 rounded mt-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      Scale 2 (88–92%)
                    </span>
                  )}
                </td>

                {/* Alert Status */}
                <td className="py-3 px-3 text-center">
                  <StatusBadge type="alert" value={p.currentAlertCategory} size="sm" />
                </td>

                {/* NEWS2 Score */}
                <td className="py-3 px-3 text-center font-mono">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                    p.news2Score >= 7
                      ? 'bg-rose-100 text-rose-800'
                      : p.news2Score >= 5
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {p.news2Score}
                  </span>
                </td>

                {/* Heart Rate */}
                <td className="py-3 px-3 text-center font-mono">
                  <span className={`font-bold ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
                    {isDetached ? '---' : `${p.latestVitals.heartRate}`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block">bpm</span>
                </td>

                {/* Live PPG Waveform */}
                <td className="py-2.5 px-3">
                  <div className="w-48">
                    <MiniPPGWaveform
                      heartRate={p.latestVitals.heartRate}
                      spo2={p.latestVitals.spo2}
                      respiratoryRate={p.latestVitals.respiratoryRate}
                      sensorQuality={p.latestVitals.sensorQuality}
                      patientId={p.id}
                      height={38}
                    />
                  </div>
                </td>

                {/* SpO2 */}
                <td className="py-3 px-3 text-center font-mono">
                  <span
                    className={`font-bold ${
                      isDetached
                        ? 'text-slate-400'
                        : p.spo2Scale === 'SCALE_2' && p.latestVitals.spo2 >= 88 && p.latestVitals.spo2 <= 92
                        ? 'text-emerald-700'
                        : p.latestVitals.spo2 < 90
                        ? 'text-rose-600 font-extrabold'
                        : 'text-slate-900'
                    }`}
                  >
                    {isDetached ? '---' : `${p.latestVitals.spo2}%`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block">
                    [{p.targetSpo2Range[0]}-{p.targetSpo2Range[1]}%]
                  </span>
                </td>

                {/* Resp Rate */}
                <td className="py-3 px-3 text-center font-mono">
                  <span className={`font-bold ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
                    {isDetached ? '---' : `${p.latestVitals.respiratoryRate}`}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans block">/min</span>
                </td>

                {/* Temp */}
                <td className="py-3 px-3 text-center font-mono">
                  <span className="font-bold text-slate-900">{p.latestVitals.temperature}°C</span>
                  <span className="text-[10px] text-slate-500 font-sans block">skin</span>
                </td>

                {/* Last Updated */}
                <td className="py-3 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{p.latestVitals.timestamp}</span>
                  </div>
                </td>

                {/* Action Buttons */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPatient(p.id);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors text-[11px] border border-slate-200"
                      title="Focus 24h Vital Rate Graphs"
                    >
                      <span>Rate Graphs</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPatient(p.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 font-semibold hover:bg-teal-100 transition-colors border border-teal-200 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
