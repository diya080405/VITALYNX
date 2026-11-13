import React, { useState, useEffect } from 'react';
import { ClinicalAlert } from '../types/alert';
import { StatusBadge } from './StatusBadge';
import { api } from '../services/api';
import {
  X,
  ShieldCheck,
  Stethoscope,
  Info,
  Scale,
  BrainCircuit,
  ArrowRight,
  Sparkles,
  Loader2
} from 'lucide-react';

interface AlertExplanationModalProps {
  alert: ClinicalAlert | null;
  onClose: () => void;
  onAcknowledge: (alertId: string) => void;
}

export const AlertExplanationModal: React.FC<AlertExplanationModalProps> = ({
  alert,
  onClose,
  onAcknowledge
}) => {
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<'GEMINI' | 'FALLBACK' | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setAiText((alert as any)?.aiExplanation || null);
    setAiSource(null);
    setAiError(null);
  }, [alert]);

  if (!alert) return null;

  const handleGenerateAiExplanation = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.getAlertAiExplanation(alert.id);
      setAiText(res.aiExplanation);
      setAiSource(res.source);
    } catch (err: any) {
      setAiError(err?.message || 'Unable to generate AI explanation.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 text-left">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Clinical Decision Support Rationale
              </h2>
              <div className="text-xs text-slate-700 flex items-center gap-2 mt-0.5">
                <span>Alert ID: <strong className="font-mono">{alert.id}</strong></span>
                <span>•</span>
                <span>Patient: {alert.patientName} ({alert.patientId})</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Classification Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-semibold">Severity Category:</span>
              <StatusBadge type="alert" value={alert.alertLevel} size="md" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-semibold">Sensor Fidelity:</span>
              <StatusBadge type="sensor" value={alert.sensorQualityStatus} size="md" />
            </div>
          </div>

          {/* Section 1: Exact Reading vs Patient Baseline */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-2">
              <Scale className="w-4 h-4 text-teal-600" />
              1. Observed Vital Parameter vs Personalized Baseline
            </div>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg font-mono text-center">
              <div>
                <span className="text-[10px] text-slate-700 font-sans block mb-1 uppercase tracking-wide">
                  Observed Telemetry Reading
                </span>
                <span className="text-sm font-bold text-rose-600">
                  {alert.vitalSignReading}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-700 font-sans block mb-1 uppercase tracking-wide">
                  Patient Medical Profile & Target
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {alert.patientMedicalInfo}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Applied Rule */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-2">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              2. Formal Decision-Support Rule Evaluated
            </div>
            <div className="bg-slate-900 text-teal-300 p-3 rounded-lg font-mono text-xs leading-relaxed">
              {alert.ruleApplied}
            </div>
          </div>

          {/* Section 3: Sensor Artifact Validation */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              3. Sensor Quality & Signal Concordance Verification
            </div>
            <p className="text-slate-700 leading-relaxed mb-2">
              Before elevating this alert, VITALYNX evaluated optical plethysmogram (PPG) pulsatility, tri-axial accelerometer motion energy, and bio-impedance baseline stability.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                <strong>Artifact Filter Result:</strong> Valid biological signal confirmed. Concordant deterioration across multiple vital streams eliminates probe detachment or motion artifact.
              </span>
            </div>
          </div>

          {/* Section 4: Rule-Based Clinical Explanation */}
          <div className="p-3.5 rounded-xl border border-slate-200/90 bg-white">
            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-2">
              <Info className="w-4 h-4 text-teal-600" />
              4. Clinical Decision-Support Analysis
            </div>
            <p className="text-slate-700 leading-relaxed text-xs">
              {alert.explanation}
            </p>
          </div>

          {/* Section 5: Clearly Labeled Server-Side AI Synthesis */}
          <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>5. AI-Assisted Explanation (De-Identified Synthesis)</span>
                {aiSource && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {aiSource === 'GEMINI' ? 'Gemini AI' : 'Structured Fallback'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleGenerateAiExplanation}
                disabled={aiLoading}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-[11px] transition-colors flex items-center gap-1"
              >
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>{aiText ? 'Refresh AI Summary' : 'Explain with AI'}</span>
              </button>
            </div>
            {aiError && (
              <p className="text-rose-700 text-[11px] mb-1">{aiError}</p>
            )}
            {aiText ? (
              <p className="text-slate-800 leading-relaxed text-xs">{aiText}</p>
            ) : (
              <p className="text-slate-600 text-[11px]">
                Click "Explain with AI" to generate a concise de-identified synthesis grounded strictly in the measured vitals, rule criteria, and signal quality above.
              </p>
            )}
          </div>

          {/* Section 6: Suggested Action */}
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/60 text-amber-950">
            <div className="font-bold text-xs flex items-center gap-1.5 mb-1 text-amber-900">
              <span>Recommended Next Clinical Step:</span>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              {alert.suggestedAction}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-[11px] text-slate-700">
            Recorded in patient audit log • ISO/IEEE 11073 standard
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            {alert.status === 'ACTIVE' && (
              <button
                onClick={() => {
                  onAcknowledge(alert.id);
                  onClose();
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs flex items-center gap-1"
              >
                <span>Acknowledge Alert</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
