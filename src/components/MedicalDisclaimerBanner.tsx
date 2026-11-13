import React from 'react';
import { AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface MedicalDisclaimerBannerProps {
  isProminent?: boolean;
}

export const MedicalDisclaimerBanner: React.FC<MedicalDisclaimerBannerProps> = ({
  isProminent = false
}) => {
  if (isProminent) {
    return (
      <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold">Clinical Decision Support Only</span> – This system is not a medical diagnosis tool. All alerts and recommendations must be reviewed by qualified healthcare professionals.
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
          Synthetic Demo Data
        </span>
      </div>
    );
  }

  // Footer permanently visible banner
  return (
    <footer className="w-full bg-white border-t border-slate-200/80 py-3 px-6 text-slate-500 text-xs mt-auto">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-slate-600 font-medium">
            <strong>Clinical Decision Support Only</strong> – This system is not a medical diagnosis tool. All alerts and recommendations must be reviewed by qualified healthcare professionals.
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Synthetic Patient Telemetry</span>
          <span>•</span>
          <span className="font-mono text-teal-600 font-semibold">VITALYNX v1.0.4-rc</span>
        </div>
      </div>
    </footer>
  );
};
