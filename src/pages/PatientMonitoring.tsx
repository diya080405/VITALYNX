import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { VitalChart } from '../components/VitalChart';
import { PPGWaveform } from '../components/PPGWaveform';
import { RespiratoryWaveform } from '../components/RespiratoryWaveform';
import { AlertCard } from '../components/AlertCard';
import { MedicalDisclaimerBanner } from '../components/MedicalDisclaimerBanner';
import { generatePatientObservations } from '../data/mockObservations';
import type { VitalObservation } from '../types/observation';
import {
  Heart,
  Wind,
  Thermometer,
  Activity,
  ArrowLeft,
  Calendar,
  Pill,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Info,
  Clock,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  ExternalLink,
  BrainCircuit,
  AlertOctagon,
  ChevronDown,
  Phone,
  Lock,
  UserCheck,
  Building2,
  Download,
  Loader2,
  MessageSquare,
  Save,
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import { formatTelLink } from '../utils/patientAssets';
import type { ReportPeriod } from '../types/notification';

export const PatientMonitoring: React.FC = () => {
  const {
    currentUser,
    selectedPatientId,
    setSelectedPatientId,
    selectedPatient,
    patients,
    alerts,
    setCurrentPage,
    acknowledgeAlert,
    resolveAlert,
    setSelectedAlertForExplanation,
    notifications,
    markWhatsAppOpened,
    confirmWhatsAppSent,
    updatePatientBaseline,
    downloadReportPdf
  } = useApp();

  const [activeTab, setActiveTab] = useState<'vitals' | 'news2' | 'baseline' | 'alerts' | 'profile'>('vitals');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('24h');
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [aiPreview, setAiPreview] = useState<{ summary: string; source?: string } | null>(null);
  const [loadingAiPreview, setLoadingAiPreview] = useState<boolean>(false);

  const patient = selectedPatient || patients[0];

  // Configurable patient baseline state
  const [baseHr, setBaseHr] = useState<number>(patient.baseline.heartRate);
  const [baseSpo2, setBaseSpo2] = useState<number>(patient.baseline.spo2);
  const [baseRr, setBaseRr] = useState<number>(patient.baseline.respiratoryRate);
  const [baseTemp, setBaseTemp] = useState<number>(patient.baseline.temperature);
  const [hrThresh, setHrThresh] = useState<number>(patient.baseline.hrDeviationThreshold ?? 8);
  const [spo2Thresh, setSpo2Thresh] = useState<number>(patient.baseline.spo2DeviationThreshold ?? 8);
  const [rrThresh, setRrThresh] = useState<number>(patient.baseline.rrDeviationThreshold ?? 8);
  const [tempThresh, setTempThresh] = useState<number>(patient.baseline.tempDeviationThreshold ?? 0.8);
  const [spo2Limit, setSpo2Limit] = useState<number>(patient.baseline.spo2LowSafetyLimit ?? 90);
  const [savingBaseline, setSavingBaseline] = useState<boolean>(false);
  const [baselineFeedback, setBaselineFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Single discrete incoming / Synthea-replayed vital event tester
  const [eventHr, setEventHr] = useState<number>(patient.latestVitals.heartRate);
  const [eventSpo2, setEventSpo2] = useState<number>(patient.latestVitals.spo2);
  const [eventRr, setEventRr] = useState<number>(patient.latestVitals.respiratoryRate);
  const [eventTemp, setEventTemp] = useState<number>(patient.latestVitals.temperature);
  const [ingestingEvent, setIngestingEvent] = useState<boolean>(false);
  const [eventFeedback, setEventFeedback] = useState<string | null>(null);

  useEffect(() => {
    setBaseHr(patient.baseline.heartRate);
    setBaseSpo2(patient.baseline.spo2);
    setBaseRr(patient.baseline.respiratoryRate);
    setBaseTemp(patient.baseline.temperature);
    setHrThresh(patient.baseline.hrDeviationThreshold ?? 8);
    setSpo2Thresh(patient.baseline.spo2DeviationThreshold ?? 8);
    setRrThresh(patient.baseline.rrDeviationThreshold ?? 8);
    setTempThresh(patient.baseline.tempDeviationThreshold ?? 0.8);
    setSpo2Limit(patient.baseline.spo2LowSafetyLimit ?? 90);
    setEventHr(patient.latestVitals.heartRate);
    setEventSpo2(patient.latestVitals.spo2);
    setEventRr(patient.latestVitals.respiratoryRate);
    setEventTemp(patient.latestVitals.temperature);
    setBaselineFeedback(null);
    setEventFeedback(null);
  }, [patient.id]);

  // Role-based doctor privacy verification:
  // Only the assigned doctor (Dr. Evelyn Vance) is authorized to access personal contact details
  const isAuthorizedDoctor = patient.assignedDoctor === 'Dr. Evelyn Vance' &&
    (!currentUser || currentUser.role === 'DOCTOR');
  const [observations, setObservations] = useState<VitalObservation[]>(() =>
    generatePatientObservations(patient.id)
  );

  useEffect(() => {
    let active = true;
    api
      .getObservations(patient.id, 60)
      .then((obs) => {
        if (!active) return;
        if (obs && obs.length > 0) setObservations(obs);
        else setObservations(generatePatientObservations(patient.id));
      })
      .catch(() => {
        if (active) setObservations(generatePatientObservations(patient.id));
      });
    return () => {
      active = false;
    };
  }, [patient.id, patient.latestVitals.timestamp]);

  const patientAlerts = alerts.filter((a) => a.patientId === patient.id);
  const isScale2 = patient.spo2Scale === 'SCALE_2';
  const isDetached = patient.latestVitals.sensorQuality === 'PROBE_REMOVED';

  // Rolling baseline comparisons (Deviation = Current Value - Baseline Value)
  const hrDelta = Number((patient.latestVitals.heartRate - patient.baseline.heartRate).toFixed(1));
  const spo2Delta = Number((patient.latestVitals.spo2 - patient.baseline.spo2).toFixed(1));
  const rrDelta = Number((patient.latestVitals.respiratoryRate - patient.baseline.respiratoryRate).toFixed(1));
  const tempDelta = Number((patient.latestVitals.temperature - patient.baseline.temperature).toFixed(1));

  const hrThreshVal = patient.baseline.hrDeviationThreshold ?? 8;
  const spo2ThreshVal = patient.baseline.spo2DeviationThreshold ?? 8;
  const rrThreshVal = patient.baseline.rrDeviationThreshold ?? 8;
  const tempThreshVal = patient.baseline.tempDeviationThreshold ?? 0.8;
  const spo2SafetyVal = patient.baseline.spo2LowSafetyLimit ?? 90;

  const handleSaveBaseline = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBaseline(true);
    setBaselineFeedback(null);
    try {
      await updatePatientBaseline(patient.id, {
        heartRate: baseHr,
        spo2: baseSpo2,
        respiratoryRate: baseRr,
        temperature: baseTemp,
        hrDeviationThreshold: hrThresh,
        spo2DeviationThreshold: spo2Thresh,
        rrDeviationThreshold: rrThresh,
        tempDeviationThreshold: tempThresh,
        spo2LowSafetyLimit: spo2Limit
      });
      setBaselineFeedback({
        type: 'success',
        text: `Saved personalized baseline and deviation thresholds for ${patient.name} (${patient.id}).`
      });
    } catch (err: any) {
      setBaselineFeedback({
        type: 'error',
        text: err?.message || 'Unable to save patient baseline.'
      });
    } finally {
      setSavingBaseline(false);
    }
  };

  const handleProcessVitalEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestingEvent(true);
    setEventFeedback(null);
    try {
      const res = await api.ingestVitals(patient.id, {
        heartRate: eventHr,
        spo2: eventSpo2,
        respiratoryRate: eventRr,
        temperature: eventTemp,
        sensorQuality: 'VALID',
        isSimulated: false
      });
      const notifCount = res.notifications?.length || 0;
      setEventFeedback(
        res.smsSuppressedReason
          ? `Reading processed and saved. ${res.smsSuppressedReason}`
          : notifCount > 0
          ? `Reading processed and saved: Emergency deviation alert raised and ${notifCount} WhatsApp guardian alert(s) marked READY TO SEND.`
          : `Reading processed and saved (${res.patient.currentAlertCategory}).`
      );
    } catch (err: any) {
      setEventFeedback(err?.message || 'Failed to process vital reading.');
    } finally {
      setIngestingEvent(false);
    }
  };

  return (
    <div className="space-y-5 text-left">
      {/* Top Navigation & Patient Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage('patients')}
            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            title="Back to Patient Directory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{patient.name}</h2>
              <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {patient.id}
              </span>
              <StatusBadge type="alert" value={patient.currentAlertCategory} size="sm" />
              {isScale2 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Hypercapnic Scale 2 (Target 88–92%)
                </span>
              )}
            </div>
            <div className="text-xs text-slate-700 mt-0.5 flex flex-wrap items-center gap-2">
              <span>{patient.age} years old • {patient.gender}</span>
              <span>•</span>
              <span>Discharged: {patient.dischargeDate}</span>
              <span>•</span>
              <span>Primary: {patient.primaryDiagnosis}</span>
              <span>•</span>
              <span className="font-semibold text-teal-800">
                Attending: <span className="underline">{patient.assignedDoctor}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Patient Switcher & PDF Report Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <select
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
              aria-label="Monitoring report period"
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              type="button"
              disabled={loadingAiPreview}
              onClick={async () => {
                setLoadingAiPreview(true);
                try {
                  const res = await api.generateReportSummary(patient.id, reportPeriod);
                  setAiPreview({ summary: res.report.aiSummary, source: res.report.aiSource });
                } finally {
                  setLoadingAiPreview(false);
                }
              }}
              className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-semibold flex items-center gap-1"
            >
              {loadingAiPreview ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>AI Summary</span>
            </button>
            <button
              type="button"
              disabled={downloadingPdf}
              onClick={async () => {
                setDownloadingPdf(true);
                try {
                  await downloadReportPdf(patient.id, patient.name, reportPeriod);
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs"
            >
              {downloadingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              <span>Download PDF</span>
            </button>
          </div>

          <span className="text-xs text-slate-700 font-semibold hidden sm:inline">Switch Patient:</span>
          <select
            value={patient.id}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id}) - {p.currentAlertCategory}
              </option>
            ))}
          </select>
        </div>
      </div>

      {aiPreview && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-950 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-indigo-900">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              AI-Assisted Period Summary ({reportPeriod.toUpperCase()} • {aiPreview.source === 'GEMINI' ? 'Gemini AI' : 'Structured Fallback'} — Separate from Measured Vitals)
            </span>
            <button onClick={() => setAiPreview(null)} className="text-[11px] text-indigo-700 hover:underline">
              Dismiss
            </button>
          </div>
          <p className="leading-relaxed text-slate-800">{aiPreview.summary}</p>
        </div>
      )}

      {/* Doctor Contact Privacy & Emergency Contact Command Strip */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Care Team Assignment & Patient Contacts
            </span>
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Doctor Privacy Access Enforced
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Supervising Physician:</span>
            <span className="font-bold text-teal-800 font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {patient.assignedDoctor}
            </span>
          </div>
        </div>

        {/* Doctor Contact Privacy Gate */}
        {isAuthorizedDoctor ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 text-xs">
            {/* Patient Direct Contact (Visible only to assigned doctor) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Patient Direct Phone (Confidential)
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900">{patient.patientPhone}</span>
                <a
                  href={formatTelLink(patient.patientPhone)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[11px] transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call Patient</span>
                </a>
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-1">
                ✓ Authorized for Dr. Evelyn Vance only
              </div>
            </div>

            {/* Primary Emergency Contact (1-Tap calling 9353802577) */}
            <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                  Primary Emergency Contact
                </span>
                <span className="text-[10px] text-rose-700 font-semibold">{patient.primaryEmergencyContact.relationship}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{patient.primaryEmergencyContact.name}</div>
                  <div className="font-mono font-bold text-rose-700 text-xs">
                    <a href={formatTelLink(patient.primaryEmergencyContact.phone)} className="hover:underline">
                      {patient.primaryEmergencyContact.phone}
                    </a>
                  </div>
                </div>
                <a
                  href={formatTelLink(patient.primaryEmergencyContact.phone)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>1-Tap Call</span>
                </a>
              </div>
            </div>

            {/* Alternative Emergency Contact */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Alternative Emergency Contact
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">{patient.alternativeEmergencyContact.relationship}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{patient.alternativeEmergencyContact.name}</div>
                  <div className="font-mono text-slate-600 text-xs">{patient.alternativeEmergencyContact.phone}</div>
                </div>
                <a
                  href={formatTelLink(patient.alternativeEmergencyContact.phone)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-[11px] transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  <span>Call</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>
                <strong>Confidential Patient Contact Information:</strong> Access is restricted to the assigned attending physician (Dr. Evelyn Vance).
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold text-slate-700">
        {[
          { id: 'vitals', label: 'Current Vitals & Waveforms' },
          { id: 'news2', label: 'NEWS2 Scoring Breakdown' },
          { id: 'baseline', label: 'Rolling Baseline & Drift Analysis' },
          { id: 'alerts', label: `Clinical Alerts (${patientAlerts.length})` },
          { id: 'profile', label: 'Discharge Profile & FHIR R4' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`pb-2.5 transition-all border-b-2 ${
              activeTab === t.id
                ? 'border-teal-600 text-teal-800 font-bold'
                : 'border-transparent text-slate-700 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Current Vitals & Interactive Graphs */}
      {activeTab === 'vitals' && (
        <div className="space-y-5">
          {/* 4 Large Vital Signs Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Heart Rate */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-700 mb-2">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-500" /> Heart Rate
                </span>
                <span className="text-[11px] font-mono font-medium text-slate-700">
                  Base: {patient.baseline.heartRate} bpm
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold font-mono ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
                    {isDetached ? '---' : patient.latestVitals.heartRate}
                  </span>
                  <span className="text-xs text-slate-700 font-medium">bpm</span>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  hrDelta > 15 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'
                }`}>
                  {hrDelta > 0 ? <TrendingUp className="w-3 h-3 text-rose-500" /> : <Minus className="w-3 h-3" />}
                  {hrDelta > 0 ? `+${hrDelta}` : hrDelta} vs Base
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-700 flex justify-between">
                <span>Resting target: 60–90 bpm</span>
                <span>Normal sinus</span>
              </div>
            </div>

            {/* 2. SpO2 */}
            <div className={`rounded-xl border p-4 shadow-xs ${
              isScale2 ? 'bg-amber-50/20 border-amber-300' : 'bg-white border-slate-200/80'
            }`}>
              <div className="flex items-center justify-between text-xs text-slate-700 mb-2">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-teal-500" /> Oxygen (SpO2)
                </span>
                <span className="text-[11px] font-mono font-medium text-slate-700">
                  Target: {patient.targetSpo2Range[0]}–{patient.targetSpo2Range[1]}%
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold font-mono ${
                    isDetached 
                      ? 'text-slate-400' 
                      : isScale2 && patient.latestVitals.spo2 >= 88 && patient.latestVitals.spo2 <= 92
                      ? 'text-emerald-700'
                      : patient.latestVitals.spo2 < 90
                      ? 'text-rose-600'
                      : 'text-slate-900'
                  }`}>
                    {isDetached ? '---' : `${patient.latestVitals.spo2}%`}
                  </span>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  isScale2
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : spo2Delta < -3
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {spo2Delta < 0 ? <TrendingDown className="w-3 h-3 text-rose-500" /> : <Minus className="w-3 h-3" />}
                  {spo2Delta > 0 ? `+${spo2Delta}` : spo2Delta}% vs Base
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-700 flex justify-between">
                <span>{isScale2 ? 'NEWS2 Scale 2 active' : 'Standard Scale 1'}</span>
                <span className="font-semibold">{isScale2 ? 'COPD protocol' : 'Standard ≥96%'}</span>
              </div>
            </div>

            {/* 3. Respiratory Rate */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-700 mb-2">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-sky-500" /> Resp Rate
                </span>
                <span className="text-[11px] font-mono font-medium text-slate-700">
                  Base: {patient.baseline.respiratoryRate} /min
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold font-mono ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
                    {isDetached ? '---' : patient.latestVitals.respiratoryRate}
                  </span>
                  <span className="text-xs text-slate-700 font-medium">/min</span>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  rrDelta > 5 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-700'
                }`}>
                  {rrDelta > 0 ? <TrendingUp className="w-3 h-3 text-rose-500" /> : <Minus className="w-3 h-3" />}
                  {rrDelta > 0 ? `+${rrDelta}` : rrDelta} /min
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-700 flex justify-between">
                <span>Normal: 12–20 /min</span>
                <span>Bio-impedance</span>
              </div>
            </div>

            {/* 4. Body Temp */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-700 mb-2">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-amber-500" /> Temperature
                </span>
                <span className="text-[11px] font-mono font-medium text-slate-700">
                  Base: {patient.baseline.temperature}°C
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-slate-900">
                    {patient.latestVitals.temperature}°
                  </span>
                  <span className="text-xs text-slate-700 font-medium">C</span>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  tempDelta > 1.0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700'
                }`}>
                  {tempDelta > 0 ? <TrendingUp className="w-3 h-3 text-amber-600" /> : <Minus className="w-3 h-3" />}
                  {tempDelta > 0 ? `+${tempDelta}` : tempDelta}°C
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-700 flex justify-between">
                <span>Normal: 36.1–37.5°C</span>
                <span>Axillary patch</span>
              </div>
            </div>
          </div>

          {/* Real-time Continuous BIDMC Waveforms */}
          <div className="space-y-3">
            <PPGWaveform
              heartRate={patient.latestVitals.heartRate}
              spo2={patient.latestVitals.spo2}
              respiratoryRate={patient.latestVitals.respiratoryRate}
              patientName={patient.name}
              sensorQuality={patient.latestVitals.sensorQuality}
            />
            <RespiratoryWaveform
              respiratoryRate={patient.latestVitals.respiratoryRate}
              patientName={patient.name}
              sensorQuality={patient.latestVitals.sensorQuality}
            />
          </div>

          {/* 4 Time-series Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VitalChart
              title="Oxygen Saturation (SpO2 %)"
              data={observations}
              dataKey="spo2"
              unit="%"
              strokeColor="#0d9488"
              baselineValue={patient.baseline.spo2}
              spo2Scale={patient.spo2Scale}
              normalRange={patient.targetSpo2Range}
              height={200}
            />

            <VitalChart
              title="Heart Rate (bpm)"
              data={observations}
              dataKey="heartRate"
              unit="bpm"
              strokeColor="#ef4444"
              baselineValue={patient.baseline.heartRate}
              height={200}
            />

            <VitalChart
              title="Respiratory Rate (breaths/min)"
              data={observations}
              dataKey="respiratoryRate"
              unit="/min"
              strokeColor="#0284c7"
              baselineValue={patient.baseline.respiratoryRate}
              height={200}
            />

            <VitalChart
              title="Body Temperature (°C)"
              data={observations}
              dataKey="temperature"
              unit="°C"
              strokeColor="#d97706"
              baselineValue={patient.baseline.temperature}
              height={200}
            />
          </div>
        </div>
      )}

      {/* TAB 2: NEWS2 Scoring Breakdown */}
      {activeTab === 'news2' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>National Early Warning Score 2 (NEWS2) Evaluation</span>
                  {isScale2 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                      SpO2 Scale 2 Assigned
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-700 mt-1">
                  Royal College of Physicians standardized clinical acuity score with personalized hypercapnic scale adjustment.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-700">Aggregate Score</div>
                  <div className={`text-2xl font-mono font-extrabold ${
                    patient.news2Score >= 7
                      ? 'text-rose-600'
                      : patient.news2Score >= 5
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}>
                    {patient.news2Score} / 20
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  patient.news2Score >= 7
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : patient.news2Score >= 5
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {patient.news2Score >= 7 ? 'High Clinical Risk' : patient.news2Score >= 5 ? 'Medium Clinical Risk' : 'Low Clinical Risk'}
                </div>
              </div>
            </div>

            {/* Individual Parameter Scoring Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
              {[
                { label: 'Resp Rate', value: `${patient.latestVitals.respiratoryRate}/min`, score: patient.news2Breakdown.respiratoryRateScore },
                {
                  label: isScale2 ? 'SpO2 (Scale 2)' : 'SpO2 (Scale 1)',
                  value: `${patient.latestVitals.spo2}%`,
                  score: patient.news2Breakdown.spo2Score
                },
                {
                  label: 'Air / O2',
                  value: patient.hasSupplementalOxygen ? 'Supp O2 (1.5L)' : 'Room Air',
                  score: patient.news2Breakdown.supplementalOxygenScore
                },
                { label: 'Temperature', value: `${patient.latestVitals.temperature}°C`, score: patient.news2Breakdown.temperatureScore },
                { label: 'Systolic BP', value: patient.latestVitals.bloodPressure || '120 mmHg', score: patient.news2Breakdown.systolicBPScore },
                { label: 'Heart Rate', value: `${patient.latestVitals.heartRate} bpm`, score: patient.news2Breakdown.heartRateScore },
                { label: 'Consciousness', value: 'Alert (A)', score: patient.news2Breakdown.consciousnessScore }
              ].map((p, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-center">
                  <div className="text-[10px] text-slate-700 uppercase font-semibold mb-1 truncate">{p.label}</div>
                  <div className="font-mono font-bold text-xs text-slate-900 mb-1">{p.value}</div>
                  <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                    p.score === 3 ? 'bg-rose-100 text-rose-700' : p.score > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    +{p.score} pts
                  </span>
                </div>
              ))}
            </div>

            {/* Official Rule Notice */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-teal-600" />
                NEWS2 Missing Observations Policy:
              </div>
              <p>
                In compliance with clinical safety standards, VITALYNX <strong>never silently assigns normal values (0 points)</strong> to missing observations. If a sensor drops offline or is removed, the parameter is flagged as <em>MISSING_DATA</em> and excluded from scoring while triggering a connectivity warning.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Rolling Baseline & Drift Analysis */}
      {activeTab === 'baseline' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-slate-900">
                Personalized Baseline & Deviation Monitoring
              </h3>
              <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Last saved: {patient.baseline.calculatedAt} ({patient.baseline.updatedBy || 'SYSTEM'})
              </span>
            </div>
            <p className="text-xs text-slate-700 mb-4">
              Deviation = Current Value − Saved Baseline Value. Emergency alerts trigger when |Deviation| ≥ configured threshold or SpO2 falls below {spo2SafetyVal}%.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Parameter</th>
                    <th className="py-2.5 px-3 text-center">Saved Baseline</th>
                    <th className="py-2.5 px-3 text-center">Current Reading</th>
                    <th className="py-2.5 px-3 text-center">Deviation (Δ)</th>
                    <th className="py-2.5 px-3 text-center">Threshold</th>
                    <th className="py-2.5 px-3">Clinical Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-3 font-semibold text-slate-900">Heart Rate (BPM)</td>
                    <td className="py-3 px-3 text-center font-mono">{patient.baseline.heartRate} bpm</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{patient.latestVitals.heartRate} bpm</td>
                    <td
                      className={`py-3 px-3 text-center font-mono font-bold ${
                        Math.abs(hrDelta) >= hrThreshVal ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {hrDelta > 0 ? `+${hrDelta}` : hrDelta} bpm
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700">±{hrThreshVal} bpm</td>
                    <td className="py-3 px-3 text-slate-700">
                      {Math.abs(hrDelta) >= hrThreshVal
                        ? 'Deviation threshold breached (±8+ bpm alert active)'
                        : `Within saved baseline band (±${hrThreshVal} bpm)`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      SpO2 (%) {isScale2 && <span className="text-[10px] text-amber-700 font-bold">(Scale 2)</span>}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{patient.baseline.spo2}%</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{patient.latestVitals.spo2}%</td>
                    <td
                      className={`py-3 px-3 text-center font-mono font-bold ${
                        Math.abs(spo2Delta) >= spo2ThreshVal || patient.latestVitals.spo2 < spo2SafetyVal
                          ? 'text-rose-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {spo2Delta > 0 ? `+${spo2Delta}` : spo2Delta}%
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700">
                      ±{spo2ThreshVal}% / &lt;{spo2SafetyVal}%
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {patient.latestVitals.spo2 < spo2SafetyVal
                        ? `Critical safety limit breached (SpO2 < ${spo2SafetyVal}%)`
                        : Math.abs(spo2Delta) >= spo2ThreshVal
                        ? `SpO2 deviation threshold breached (±${spo2ThreshVal}%)`
                        : isScale2 && patient.latestVitals.spo2 >= 88 && patient.latestVitals.spo2 <= 92
                        ? 'Optimal for hypercapnic failure (Target 88–92% maintained)'
                        : 'Stable saturation'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-slate-900">Respiration Rate</td>
                    <td className="py-3 px-3 text-center font-mono">{patient.baseline.respiratoryRate}/min</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{patient.latestVitals.respiratoryRate}/min</td>
                    <td
                      className={`py-3 px-3 text-center font-mono font-bold ${
                        Math.abs(rrDelta) >= rrThreshVal ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {rrDelta > 0 ? `+${rrDelta}` : rrDelta}/min
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700">±{rrThreshVal}/min</td>
                    <td className="py-3 px-3 text-slate-700">
                      {Math.abs(rrDelta) >= rrThreshVal
                        ? 'Respiration deviation threshold breached'
                        : `Within saved baseline band (±${rrThreshVal}/min)`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 font-semibold text-slate-900">Skin Temperature (°C)</td>
                    <td className="py-3 px-3 text-center font-mono">{patient.baseline.temperature}°C</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{patient.latestVitals.temperature}°C</td>
                    <td
                      className={`py-3 px-3 text-center font-mono font-bold ${
                        Math.abs(tempDelta) >= tempThreshVal ? 'text-rose-700' : 'text-slate-900'
                      }`}
                    >
                      {tempDelta > 0 ? `+${tempDelta}` : tempDelta}°C
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-700">±{tempThreshVal}°C</td>
                    <td className="py-3 px-3 text-slate-700">
                      {Math.abs(tempDelta) >= tempThreshVal
                        ? 'Temperature deviation threshold breached'
                        : `Within saved baseline band (±${tempThreshVal}°C)`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Doctor Baseline Configuration Form */}
          {isAuthorizedDoctor && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <form
                onSubmit={handleSaveBaseline}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3 text-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Configure & Save Patient Baseline Values
                  </h4>
                  <span className="text-[10px] font-semibold bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200">
                    Authorized Clinician
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">Baseline HR (BPM)</span>
                    <input
                      type="number"
                      min={35}
                      max={180}
                      value={baseHr}
                      onChange={(e) => setBaseHr(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">Baseline SpO2 (%)</span>
                    <input
                      type="number"
                      min={70}
                      max={100}
                      value={baseSpo2}
                      onChange={(e) => setBaseSpo2(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">Baseline RR (/min)</span>
                    <input
                      type="number"
                      min={6}
                      max={45}
                      value={baseRr}
                      onChange={(e) => setBaseRr(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">Baseline Temp (°C)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={33}
                      max={42}
                      value={baseTemp}
                      onChange={(e) => setBaseTemp(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">HR Thresh (±)</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={hrThresh}
                      onChange={(e) => setHrThresh(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">SpO2 Thresh (±)</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={spo2Thresh}
                      onChange={(e) => setSpo2Thresh(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">RR Thresh (±)</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={rrThresh}
                      onChange={(e) => setRrThresh(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">Temp Thresh (±°C)</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0.1}
                      max={5}
                      value={tempThresh}
                      onChange={(e) => setTempThresh(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">Critical SpO2 Safety Limit (&lt; %):</span>
                    <input
                      type="number"
                      min={75}
                      max={96}
                      value={spo2Limit}
                      onChange={(e) => setSpo2Limit(Number(e.target.value))}
                      className="w-16 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={savingBaseline}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    {savingBaseline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Baseline</span>
                  </button>
                </div>

                {baselineFeedback && (
                  <div
                    className={`p-2 rounded-lg text-xs border ${
                      baselineFeedback.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    {baselineFeedback.text}
                  </div>
                )}
              </form>

              {/* Discrete Synthea / Incoming Vital Reading Event Processor */}
              <form
                onSubmit={handleProcessVitalEvent}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3 text-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Process Discrete Incoming / Synthea Vital Event
                  </h4>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    Event-Driven Evaluation
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Compare a newly received reading against {patient.name}'s saved baseline. Duplicate unchanged events suppress duplicate alerts; worsening deviations escalate and prepare new WhatsApp guardian alerts immediately.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">HR (BPM)</span>
                    <input
                      type="number"
                      value={eventHr}
                      onChange={(e) => setEventHr(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">SpO2 (%)</span>
                    <input
                      type="number"
                      value={eventSpo2}
                      onChange={(e) => setEventSpo2(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">RR (/min)</span>
                    <input
                      type="number"
                      value={eventRr}
                      onChange={(e) => setEventRr(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold text-slate-700 block mb-1">Skin Temp (°C)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={eventTemp}
                      onChange={(e) => setEventTemp(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="submit"
                    disabled={ingestingEvent}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    {ingestingEvent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    <span>Evaluate Vital Event</span>
                  </button>
                </div>

                {eventFeedback && (
                  <div className="p-2 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-800">
                    {eventFeedback}
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Alerts History */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Clinical Alert History for {patient.name}
            </h3>
            <p className="text-xs text-slate-700 mb-4">
              All generated alerts with exact readings, rules evaluated, and clinician audit trails.
            </p>

            {patientAlerts.length === 0 ? (
              <div className="p-8 text-center text-slate-700 text-xs bg-slate-50 rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                No clinical alerts logged for this patient.
              </div>
            ) : (
              <div className="space-y-3">
                {patientAlerts.map((a) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    onViewPatient={() => {}}
                    onAcknowledge={(id) => acknowledgeAlert(id)}
                    onResolve={(id) => resolveAlert(id)}
                    onViewExplanation={(alertItem) => setSelectedAlertForExplanation(alertItem)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* WHATSAPP EMERGENCY ALERT HISTORY */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                WHATSAPP EMERGENCY ALERT HISTORY ({notifications.filter((n) => n.patientId === patient.id).length})
              </h3>
            </div>
            {notifications.filter((n) => n.patientId === patient.id).length === 0 ? (
              <p className="text-xs text-slate-500">No WhatsApp emergency alerts logged for {patient.name}.</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {notifications
                  .filter((n) => n.patientId === patient.id)
                  .map((n) => {
                    const statusLabel = n.deliveryStatus;
                    const badgeClass =
                      n.deliveryStatus === 'USER CONFIRMED SENT'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : n.deliveryStatus === 'OPENED'
                        ? 'bg-sky-100 text-sky-900 border border-sky-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200';
                    return (
                      <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                n.isTest || n.alertType === 'TEST_ALERT'
                                  ? 'bg-sky-100 text-sky-900'
                                  : 'bg-rose-100 text-rose-900'
                              }`}
                            >
                              {n.isTest || n.alertType === 'TEST_ALERT' ? 'TEST ALERT' : 'REAL EMERGENCY ALERT'}
                            </span>
                            <span>
                              {n.recipientType}: {n.recipientName} ({n.recipientPhone})
                            </span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${badgeClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        {n.abnormalParameter && (
                          <div className="text-[11px] text-slate-800 font-medium bg-white px-2 py-1 rounded border border-slate-200 mt-1.5 flex flex-wrap gap-3">
                            <span>Abnormal Vital: <strong>{n.abnormalParameter}</strong></span>
                            {n.baselineValue && <span>Baseline: <strong>{n.baselineValue}</strong></span>}
                            {n.currentValue && <span>Current: <strong>{n.currentValue}</strong></span>}
                            {n.deviationValue && <span className="text-rose-700">Deviation: <strong>{n.deviationValue}</strong></span>}
                          </div>
                        )}
                        <p className="text-[11px] text-slate-700 mt-1.5 whitespace-pre-line">{n.messageText}</p>
                        {n.errorReason && (
                          <div className="text-[11px] text-rose-700 font-semibold mt-1">{n.errorReason}</div>
                        )}
                        <div className="text-[10px] text-slate-500 mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-3">
                            <span>Patient: {n.patientName || patient.name} ({n.patientId})</span>
                            {n.alertId && <span>Alert: {n.alertId}</span>}
                            <span>{n.createdAt}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {n.whatsappUrl && n.whatsappUrl !== '#' && (
                              <a
                                href={n.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  markWhatsAppOpened(n.id).catch(() => {});
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-xs"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open WhatsApp</span>
                              </a>
                            )}
                            {n.deliveryStatus !== 'USER CONFIRMED SENT' && (
                              <button
                                type="button"
                                onClick={() => {
                                  confirmWhatsAppSent(n.id).catch(() => {});
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px]"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Confirm Sent</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Profile & FHIR R4 Information */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Discharge Summary & FHIR R4 Clinical Resource
              </h3>
              <span className="text-[11px] font-mono text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                FHIR R4 Patient Resource
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Medical Conditions
                </div>
                <ul className="space-y-1 text-slate-700 list-disc list-inside">
                  {patient.medicalConditions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-indigo-600" />
                  Discharge Medications
                </div>
                <ul className="space-y-1 text-slate-700 list-disc list-inside">
                  {patient.medications.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-teal-50/60 rounded-lg border border-teal-200">
                <div className="font-bold text-teal-950 mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-700" />
                  Care Team & Contacts
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-700">
                  <div>
                    <span className="text-slate-500 font-semibold block">Attending Physician:</span>
                    <span className="font-bold text-teal-800">{patient.assignedDoctor}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Primary Emergency (1-Tap):</span>
                    <a href="tel:9353802577" className="font-mono font-bold text-rose-700 hover:underline">
                      9353802577 ({patient.primaryEmergencyContact.name})
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">Alternative Emergency:</span>
                    <span className="font-mono text-slate-700">
                      {patient.alternativeEmergencyContact.phone} ({patient.alternativeEmergencyContact.name})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto">
              <div className="text-slate-400 mb-1">// FHIR R4 JSON Representation (Synthea Interoperability Layer)</div>
              <pre>
{`{
  "resourceType": "Patient",
  "id": "${patient.fhirResourceId}",
  "identifier": [{ "system": "http://vitalynx.health/patients", "value": "${patient.id}" }],
  "active": true,
  "name": [{ "use": "official", "text": "${patient.name}" }],
  "gender": "${patient.gender.toLowerCase()}",
  "birthDate": "${2026 - patient.age}-04-12",
  "generalPractitioner": [{ "display": "${patient.assignedDoctor}, MD, FCCP" }],
  "extension": [{
    "url": "http://vitalynx.health/structure/personalized-spo2-scale",
    "valueCode": "${patient.spo2Scale}",
    "targetMin": ${patient.targetSpo2Range[0]},
    "targetMax": ${patient.targetSpo2Range[1]}
  }],
  "managingOrganization": { "display": "MineArena Clinical Stepdown Surveillance" }
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
