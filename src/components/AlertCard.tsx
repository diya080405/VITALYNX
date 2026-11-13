import React from 'react';
import { ClinicalAlert } from '../types/alert';
import { StatusBadge } from './StatusBadge';
import {
  AlertOctagon,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Info,
  ShieldCheck,
  Stethoscope,
  ChevronRight
} from 'lucide-react';

interface AlertCardProps {
  alert: ClinicalAlert;
  onViewPatient: (patientId: string) => void;
  onAcknowledge: (alertId: string) => void;
  onResolve: (alertId: string) => void;
  onViewExplanation: (alert: ClinicalAlert) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  alert,
  onViewPatient,
  onAcknowledge,
  onResolve,
  onViewExplanation
}) => {
  const isUrgent = alert.alertLevel === 'URGENT';
  const isReview = alert.alertLevel === 'REVIEW';
  const isAcknowledged = alert.status === 'ACKNOWLEDGED';
  const isResolved = alert.status === 'RESOLVED';

  const borderClass = isResolved
    ? 'border-slate-200 bg-slate-50/60 opacity-80'
    : isUrgent
    ? 'border-rose-300 bg-white hover:border-rose-400 ring-1 ring-rose-200'
    : isReview
    ? 'border-amber-300 bg-white hover:border-amber-400'
    : 'border-teal-200 bg-white hover:border-teal-300';

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 shadow-xs hover:shadow-sm ${borderClass}`}>
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge type="alert" value={alert.alertLevel} size="sm" />
          <span className="text-xs font-mono font-bold text-slate-700">{alert.id}</span>
          <span className="text-slate-300">•</span>
          <StatusBadge type="sensor" value={alert.sensorQualityStatus} size="sm" />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-700">
          <Clock className="w-3.5 h-3.5" />
          <span>{alert.timestamp}</span>
          {isAcknowledged && (
            <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Ack by {alert.acknowledgedBy}
            </span>
          )}
          {isResolved && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Resolved
            </span>
          )}
        </div>
      </div>

      {/* Patient info & Reading */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <button
            onClick={() => onViewPatient(alert.patientId)}
            className="text-sm font-bold text-slate-900 hover:text-teal-700 flex items-center gap-1.5 transition-colors group"
          >
            <span>{alert.patientName}</span>
            <span className="text-xs font-mono text-slate-700">({alert.patientId})</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <div className="text-xs text-slate-700 mt-0.5 flex items-center gap-1.5">
            <span className="font-medium text-slate-700">Profile:</span>
            <span className="truncate max-w-[340px]">{alert.patientMedicalInfo}</span>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold shadow-xs">
          {alert.vitalSignReading}
        </div>
      </div>

      {/* Applied Rule */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 mb-2.5 text-xs text-slate-700">
        <div className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
          <span>Applied Clinical Rule:</span>
        </div>
        <div className="font-mono text-slate-700 text-[11px] leading-relaxed">
          {alert.ruleApplied}
        </div>
      </div>

      {/* Explanation snippet */}
      <div className="text-xs text-slate-700 mb-3 leading-relaxed">
        <span className="font-semibold text-slate-900">Analysis: </span>
        {alert.explanation}
      </div>

      {/* Suggested Action Bar */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 mb-3 text-xs text-amber-950 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Recommended Action: </span>
          <span>{alert.suggestedAction}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
        <button
          onClick={() => onViewExplanation(alert)}
          className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-teal-600" />
          View Rationale & Math
        </button>

        <div className="flex items-center gap-2">
          {!isResolved && (
            <>
              {!isAcknowledged && (
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-xs"
                >
                  Acknowledge
                </button>
              )}
              <button
                onClick={() => onResolve(alert.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolve Alert
              </button>
            </>
          )}
          <button
            onClick={() => onViewPatient(alert.patientId)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs flex items-center gap-1"
          >
            <span>View Patient</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
