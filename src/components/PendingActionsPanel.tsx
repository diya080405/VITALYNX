import React from 'react';
import { ClinicianAction } from '../types/alert';
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowUpRight,
  AlertCircle,
  Activity,
  Wifi,
  FileQuestion,
  UserCheck
} from 'lucide-react';

interface PendingActionsPanelProps {
  actions: ClinicianAction[];
  onToggleComplete: (id: string) => void;
  onOpenPatient: (patientId: string) => void;
}

export const PendingActionsPanel: React.FC<PendingActionsPanelProps> = ({
  actions,
  onToggleComplete,
  onOpenPatient
}) => {
  const pendingCount = actions.filter((a) => !a.completed).length;

  const getPriorityBadge = (priority: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (priority) {
      case 'HIGH':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            LOW
          </span>
        );
    }
  };

  const getCategoryIcon = (category: ClinicianAction['category']) => {
    switch (category) {
      case 'URGENT_TRIAGE':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
      case 'OXYGEN_CHECK':
        return <Activity className="w-3.5 h-3.5 text-teal-500" />;
      case 'SENSOR_CHECK':
        return <Wifi className="w-3.5 h-3.5 text-amber-500" />;
      case 'SYMPTOM_REVIEW':
        return <FileQuestion className="w-3.5 h-3.5 text-sky-500" />;
      default:
        return <UserCheck className="w-3.5 h-3.5 text-indigo-500" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Pending Clinician Actions
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            {pendingCount} Due
          </span>
        </div>
      </div>

      <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
        {actions.map((item) => (
          <div
            key={item.id}
            className={`p-3 rounded-lg border transition-all duration-150 text-xs ${
              item.completed
                ? 'bg-slate-50/70 border-slate-200 text-slate-600 line-through'
                : 'bg-white border-slate-200/90 hover:border-teal-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                {getCategoryIcon(item.category)}
                <button
                  onClick={() => onOpenPatient(item.patientId)}
                  className="font-bold text-slate-900 hover:text-teal-700 flex items-center gap-1"
                >
                  <span>{item.patientName}</span>
                  <span className="font-mono text-slate-700 font-normal">({item.patientId})</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {getPriorityBadge(item.priority)}
                <button
                  onClick={() => onToggleComplete(item.id)}
                  title={item.completed ? 'Mark incomplete' : 'Mark complete'}
                  className="p-1 rounded text-slate-600 hover:text-teal-700"
                >
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 hover:text-teal-500" />
                  )}
                </button>
              </div>
            </div>

            <p className={`text-slate-700 font-medium mb-2 ${item.completed ? 'text-slate-600' : ''}`}>
              {item.actionDescription}
            </p>

            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1.5 border-t border-slate-100">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.timestamp}
              </span>
              <button
                onClick={() => onOpenPatient(item.patientId)}
                className="text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-0.5"
              >
                Open Triage
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
