import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number | string;
  subtext: string;
  icon: LucideIcon;
  badgeText?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'teal' | 'slate' | 'indigo';
  onClick?: () => void;
  isActive?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  badgeText,
  badgeColor = 'slate',
  onClick,
  isActive = false
}) => {
  const badgeStyles = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }[badgeColor];

  const iconBgStyles = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    teal: 'bg-teal-50 text-teal-600',
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  }[badgeColor];

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={`group relative bg-white rounded-xl p-4 border transition-all duration-200 cursor-pointer text-left shadow-xs hover:shadow-md hover:border-teal-300 ${
        isActive ? 'ring-2 ring-teal-500 border-transparent bg-teal-50/20' : 'border-slate-200/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
          {label}
        </span>
        <div className={`p-2 rounded-lg transition-transform group-hover:scale-105 ${iconBgStyles}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {badgeText && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badgeStyles}`}>
            {badgeText}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-700">
        <span className="truncate">{subtext}</span>
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};
