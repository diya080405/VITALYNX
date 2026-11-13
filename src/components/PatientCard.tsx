import React, { useState } from 'react';
import { Patient } from '../types/patient';
import { StatusBadge } from './StatusBadge';
import { MiniPPGWaveform } from './MiniPPGWaveform';
import { getPatientAvatar } from '../utils/patientAssets';
import {
  MoreVertical,
  Heart,
  Wind,
  Thermometer,
  Activity,
  ArrowUpRight,
  Clock,
  Sparkles,
  FileText
} from 'lucide-react';

interface PatientCardProps {
  patient: Patient;
  isSelected?: boolean;
  onSelect: (patientId: string) => void;
  onViewDetails: (patientId: string) => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  isSelected = false,
  onSelect,
  onViewDetails
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const isDetached = patient.latestVitals.sensorQuality === 'PROBE_REMOVED';

  return (
    <div
      onClick={() => onSelect(patient.id)}
      className={`group relative bg-white rounded-xl border p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md text-left ${
        isSelected
          ? 'ring-2 ring-teal-500 border-teal-500 bg-teal-50/15'
          : 'border-slate-200/80 hover:border-slate-300'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img
              src={getPatientAvatar(patient.id, patient.avatarUrl)}
              alt={patient.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                patient.monitoringStatus === 'ACTIVE'
                  ? 'bg-emerald-500'
                  : patient.monitoringStatus === 'DISCONNECTED'
                  ? 'bg-slate-400'
                  : 'bg-amber-500'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm group-hover:text-teal-700 transition-colors">
                {patient.name}
              </span>
              <span className="text-xs text-slate-700 font-mono">({patient.id})</span>
            </div>
            <div className="text-xs text-slate-700 flex items-center gap-1.5 mt-0.5">
              <span>{patient.age}y • {patient.gender}</span>
              <span>•</span>
              <span className="truncate max-w-[130px]">{patient.roomBed || 'Discharged'}</span>
            </div>
          </div>
        </div>

        {/* Action Menu */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-7 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 text-xs">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onViewDetails(patient.id);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                View Full Monitoring
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onSelect(patient.id);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2"
              >
                <Activity className="w-3.5 h-3.5" />
                Select on Dashboard
              </button>
              <div className="border-t border-slate-100 my-1" />
              <div className="px-3 py-1 text-[10px] text-slate-600 font-mono">
                FHIR: {patient.fhirResourceId.slice(0, 16)}...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conditions tag & Alert Badge */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-3">
        <StatusBadge type="alert" value={patient.currentAlertCategory} size="sm" />
        {patient.spo2Scale === 'SCALE_2' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded">
            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
            SpO2 Scale 2 (88–92%)
          </span>
        )}
      </div>

      {/* Primary Diagnosis */}
      <div className="text-xs text-slate-600 font-medium mb-3 line-clamp-1" title={patient.primaryDiagnosis}>
        {patient.primaryDiagnosis}
      </div>

      {/* Latest Vitals Matrix */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono text-center mb-2.5">
        {/* Heart Rate */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-sans text-slate-600 flex items-center gap-0.5">
            <Heart className="w-3 h-3 text-rose-500" /> HR
          </span>
          <span className={`text-xs font-bold ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
            {isDetached ? '---' : patient.latestVitals.heartRate}
          </span>
          <span className="text-[9px] text-slate-600 font-sans">bpm</span>
        </div>

        {/* SpO2 */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-sans text-slate-600 flex items-center gap-0.5">
            <Activity className="w-3 h-3 text-teal-500" /> SpO2
          </span>
          <span className={`text-xs font-bold ${
            isDetached 
              ? 'text-slate-400' 
              : patient.spo2Scale === 'SCALE_2' && patient.latestVitals.spo2 >= 88 && patient.latestVitals.spo2 <= 92
              ? 'text-emerald-700'
              : patient.latestVitals.spo2 < 90
              ? 'text-rose-600'
              : 'text-slate-900'
          }`}>
            {isDetached ? '---' : `${patient.latestVitals.spo2}%`}
          </span>
          <span className="text-[9px] text-slate-600 font-sans">
            {patient.spo2Scale === 'SCALE_2' ? 'Scale 2' : 'Scale 1'}
          </span>
        </div>

        {/* Respiratory Rate */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-sans text-slate-600 flex items-center gap-0.5">
            <Wind className="w-3 h-3 text-sky-500" /> RR
          </span>
          <span className={`text-xs font-bold ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
            {isDetached ? '---' : patient.latestVitals.respiratoryRate}
          </span>
          <span className="text-[9px] text-slate-600 font-sans">/min</span>
        </div>

        {/* Temp */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-sans text-slate-600 flex items-center gap-0.5">
            <Thermometer className="w-3 h-3 text-amber-500" /> Temp
          </span>
          <span className="text-xs font-bold text-slate-900">
            {patient.latestVitals.temperature}°
          </span>
          <span className="text-[9px] text-slate-600 font-sans">C</span>
        </div>
      </div>

      {/* Visible Live PPG Waveform Strip */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1">
          <span className="flex items-center gap-1 text-teal-700 font-semibold">
            <Activity className="w-3 h-3 text-teal-600 animate-pulse" />
            Live PPG Waveform
          </span>
          <span className="font-mono text-[9px] text-slate-400">
            {isDetached ? 'Artifact Flagged' : 'Optical Pulse • 125 Hz'}
          </span>
        </div>
        <MiniPPGWaveform
          heartRate={patient.latestVitals.heartRate}
          spo2={patient.latestVitals.spo2}
          respiratoryRate={patient.latestVitals.respiratoryRate}
          sensorQuality={patient.latestVitals.sensorQuality}
          patientId={patient.id}
          height={48}
        />
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {patient.latestVitals.timestamp}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(patient.id);
            }}
            className="text-slate-600 hover:text-teal-700 font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
            title="Focus 24h Vital Rate Graphs for this patient"
          >
            <span>Rate Graphs</span>
          </button>
          <span className="text-slate-300">•</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(patient.id);
            }}
            className="text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-0.5"
          >
            <span>Details</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
