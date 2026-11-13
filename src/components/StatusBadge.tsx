import React from 'react';
import { AlertCategory } from '../types/patient';
import { SensorQualityState } from '../types/sensor';
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon, WifiOff, Activity, RefreshCw, Zap } from 'lucide-react';

interface StatusBadgeProps {
  type: 'alert' | 'sensor' | 'scale';
  value: AlertCategory | SensorQualityState | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  value,
  size = 'md',
  showIcon = true
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-semibold',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold'
  }[size];

  if (type === 'scale') {
    if (value === 'SCALE_2') {
      return (
        <span className={`inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses}`}>
          {showIcon && <Activity className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
          SpO2 Scale 2 (Target 88–92%)
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center rounded-md bg-teal-50 text-teal-800 border border-teal-200 ${sizeClasses}`}>
        {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />}
        SpO2 Scale 1 (Target ≥96%)
      </span>
    );
  }

  if (type === 'sensor') {
    switch (value) {
      case 'VALID':
        return (
          <span className={`inline-flex items-center rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 ${sizeClasses}`}>
            {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
            VALID SIGNAL
          </span>
        );
      case 'PROBE_REMOVED':
        return (
          <span className={`inline-flex items-center rounded-md bg-rose-50 text-rose-800 border border-rose-300 ${sizeClasses}`}>
            {showIcon && <WifiOff className="w-3.5 h-3.5 text-rose-600" />}
            PROBE REMOVED (Artifact)
          </span>
        );
      case 'SENSOR_DISCONNECTED':
        return (
          <span className={`inline-flex items-center rounded-md bg-rose-50 text-rose-800 border border-rose-200 ${sizeClasses}`}>
            {showIcon && <WifiOff className="w-3.5 h-3.5 text-rose-500" />}
            SENSOR DISCONNECTED
          </span>
        );
      case 'MISSING_READINGS':
      case 'MISSING':
        return (
          <span className={`inline-flex items-center rounded-md bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
            {showIcon && <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
            MISSING READINGS
          </span>
        );
      case 'FLATLINED_SIGNAL':
        return (
          <span className={`inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses}`}>
            {showIcon && <Activity className="w-3.5 h-3.5 text-amber-600" />}
            FLATLINED SIGNAL
          </span>
        );
      case 'MOTION_NOISE':
      case 'NOISY':
        return (
          <span className={`inline-flex items-center rounded-md bg-purple-50 text-purple-800 border border-purple-200 ${sizeClasses}`}>
            {showIcon && <Zap className="w-3.5 h-3.5 text-purple-600 animate-pulse" />}
            MOTION NOISE
          </span>
        );
      case 'POOR_SIGNAL_QUALITY':
      case 'SUSPECTED_ARTIFACT':
        return (
          <span className={`inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses}`}>
            {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
            POOR SIGNAL QUALITY
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center rounded-md bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
            {showIcon && <Activity className="w-3.5 h-3.5 text-slate-500" />}
            {String(value)}
          </span>
        );
    }
  }

  // Clinical Alert Category
  switch (value) {
    case 'URGENT':
      return (
        <span className={`inline-flex items-center rounded-md bg-red-50 text-red-700 border border-red-300 ${sizeClasses} shadow-xs`}>
          {showIcon && <AlertOctagon className="w-3.5 h-3.5 text-red-600" />}
          URGENT
        </span>
      );
    case 'REVIEW':
      return (
        <span className={`inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-300 ${sizeClasses}`}>
          {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
          REVIEW
        </span>
      );
    case 'WATCH':
      return (
        <span className={`inline-flex items-center rounded-md bg-teal-50 text-teal-800 border border-teal-200 ${sizeClasses}`}>
          {showIcon && <Activity className="w-3.5 h-3.5 text-teal-600" />}
          WATCH
        </span>
      );
    case 'OFFLINE':
      return (
        <span className={`inline-flex items-center rounded-md bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}>
          {showIcon && <WifiOff className="w-3.5 h-3.5 text-slate-500" />}
          OFFLINE (Sensor)
        </span>
      );
    case 'STABLE':
    default:
      return (
        <span className={`inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}>
          {showIcon && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
          STABLE
        </span>
      );
  }
};
