import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { MetricCard } from '../components/MetricCard';
import { PatientCard } from '../components/PatientCard';
import { PPGWaveform } from '../components/PPGWaveform';
import { RespiratoryWaveform } from '../components/RespiratoryWaveform';
import { VitalChart } from '../components/VitalChart';
import { AlertCard } from '../components/AlertCard';
import { PendingActionsPanel } from '../components/PendingActionsPanel';
import { PatientTable } from '../components/PatientTable';
import { StatusBadge } from '../components/StatusBadge';
import { MedicalDisclaimerBanner } from '../components/MedicalDisclaimerBanner';
import { generatePatientObservations } from '../data/mockObservations';
import type { VitalObservation } from '../types/observation';
import { AlertCategory } from '../types/patient';
import type { ReportPeriod } from '../types/notification';
import { getPatientAvatar } from '../utils/patientAssets';
import { api } from '../services/api';
import {
  Users,
  Activity,
  AlertTriangle,
  AlertOctagon,
  WifiOff,
  ShieldCheck,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  Sparkles,
  ArrowUpDown,
  Download,
  Loader2
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    patients,
    alerts,
    clinicianActions,
    selectedPatientId,
    setSelectedPatientId,
    selectedPatient,
    navigateToPatient,
    navigateToAlertsWithFilter,
    setCurrentPage,
    acknowledgeAlert,
    resolveAlert,
    toggleClinicianAction,
    setSelectedAlertForExplanation,
    searchQuery,
    setSearchQuery,
    downloadReportPdf
  } = useApp();

  const [patientFilter, setPatientFilter] = useState<AlertCategory | 'ALL'>('ALL');
  const [sortByNameAsc, setSortByNameAsc] = useState<boolean>(true);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('24h');
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  // Mandatory Section 3 Overview Metrics: Total, Stable, Watch, Review, Urgent
  const totalPatients = patients.length;
  const stableCount = patients.filter((p) => p.currentAlertCategory === 'STABLE').length;
  const watchCount = patients.filter((p) => p.currentAlertCategory === 'WATCH').length;
  const reviewCount = patients.filter((p) => p.currentAlertCategory === 'REVIEW').length;
  const urgentCount = patients.filter((p) => p.currentAlertCategory === 'URGENT').length;
  const offlineCount = patients.filter(
    (p) => p.currentAlertCategory === 'OFFLINE' || p.latestVitals.sensorQuality === 'PROBE_REMOVED'
  ).length;

  // Filter and sort patient list
  const filteredPatients = patients
    .filter((p) => {
      const matchesFilter =
        patientFilter === 'ALL' || p.currentAlertCategory === patientFilter;
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.primaryDiagnosis.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => {
      if (sortByNameAsc) {
        return a.name.localeCompare(b.name);
      }
      return b.name.localeCompare(a.name);
    });

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');

  // Observation history for selected patient (synced with SQLite telemetry when updated)
  const [observations, setObservations] = useState<VitalObservation[]>(() =>
    generatePatientObservations(selectedPatientId)
  );

  useEffect(() => {
    let active = true;
    api
      .getObservations(selectedPatientId, 48)
      .then((obs) => {
        if (!active) return;
        if (obs && obs.length > 0) setObservations(obs);
        else setObservations(generatePatientObservations(selectedPatientId));
      })
      .catch(() => {
        if (active) setObservations(generatePatientObservations(selectedPatientId));
      });
    return () => {
      active = false;
    };
  }, [selectedPatientId, selectedPatient?.latestVitals.timestamp]);

  return (
    <div className="space-y-5 text-left">
      {/* Prominent Medical Safety Disclaimer */}
      <MedicalDisclaimerBanner isProminent={true} />

      {/* 5 Mandatory Section 3 Overview Cards (+ Device Warnings) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Total Patients"
          value={totalPatients}
          subtext="Registered in cohort"
          icon={Users}
          badgeText="Synthea Cohort"
          badgeColor="indigo"
          onClick={() => setCurrentPage('patients')}
        />
        <MetricCard
          label="Stable Patients"
          value={stableCount}
          subtext="No concerning trends"
          icon={ShieldCheck}
          badgeText="Stable"
          badgeColor="emerald"
          onClick={() => setPatientFilter('STABLE')}
        />
        <MetricCard
          label="Watch Patients"
          value={watchCount}
          subtext="Close surveillance"
          icon={Activity}
          badgeText="Watch"
          badgeColor="teal"
          onClick={() => setPatientFilter('WATCH')}
        />
        <MetricCard
          label="Review Patients"
          value={reviewCount}
          subtext="Clinical check needed"
          icon={AlertTriangle}
          badgeText="Review"
          badgeColor="amber"
          onClick={() => setPatientFilter('REVIEW')}
        />
        <MetricCard
          label="Urgent Patients"
          value={urgentCount}
          subtext="Prompt clinical attention"
          icon={AlertOctagon}
          badgeText="Urgent"
          badgeColor="rose"
          onClick={() => setPatientFilter('URGENT')}
        />
        <MetricCard
          label="Device Offline"
          value={offlineCount}
          subtext="Sensor artifact / probe"
          icon={WifiOff}
          badgeText="Artifact Gate"
          badgeColor="slate"
          onClick={() => setCurrentPage('sensor-quality')}
        />
      </div>

      {/* Main 3-Column Dashboard Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= LEFT COLUMN: Priority Patient Surveillance (4 cols) ================= */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Patient Cohort Surveillance
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Real-time status based on personalized thresholds
                </p>
              </div>

              {/* Sort by Name toggle */}
              <button
                onClick={() => setSortByNameAsc(!sortByNameAsc)}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                title="Sort by Patient Name"
              >
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
                <span>{sortByNameAsc ? 'Name (A-Z)' : 'Name (Z-A)'}</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1 mb-3">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'STABLE', label: 'Stable' },
                  { id: 'WATCH', label: 'Watch' },
                  { id: 'REVIEW', label: 'Review' },
                  { id: 'URGENT', label: 'Urgent' },
                  { id: 'OFFLINE', label: 'Offline' }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setPatientFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    patientFilter === f.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Patient Cards Stack */}
            <div className="space-y-3 max-h-[820px] overflow-y-auto pr-1">
              {filteredPatients.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No patients match filter "{patientFilter}".
                </div>
              ) : (
                filteredPatients.map((p) => (
                  <PatientCard
                    key={p.id}
                    patient={p}
                    isSelected={p.id === selectedPatientId}
                    onSelect={(id) => setSelectedPatientId(id)}
                    onViewDetails={(id) => navigateToPatient(id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ================= CENTER COLUMN: Waveform & Trend Charts (5 cols) ================= */}
        <div className="lg:col-span-5 space-y-4">
          {/* Selected Patient Banner */}
          {selectedPatient && (
            <div className="bg-white rounded-xl border border-teal-200/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={getPatientAvatar(selectedPatient.id, selectedPatient.avatarUrl)}
                  alt={selectedPatient.name}
                  className="w-10 h-10 rounded-full object-cover border border-teal-300"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {selectedPatient.name}
                    </span>
                    <span className="text-xs font-mono text-slate-500">({selectedPatient.id})</span>
                    <StatusBadge type="alert" value={selectedPatient.currentAlertCategory} size="sm" />
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>{selectedPatient.age}y</span>
                    <span>•</span>
                    <span className="truncate max-w-[200px]">{selectedPatient.primaryDiagnosis}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
                    aria-label="Report period"
                    className="bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-hidden"
                  >
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                    <option value="30d">30d</option>
                  </select>
                  <button
                    type="button"
                    disabled={downloadingPdf}
                    onClick={async () => {
                      setDownloadingPdf(true);
                      try {
                        await downloadReportPdf(selectedPatient.id, selectedPatient.name, reportPeriod);
                      } finally {
                        setDownloadingPdf(false);
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold flex items-center gap-1"
                    title="Download Clinical PDF Report"
                  >
                    {downloadingPdf ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    <span>PDF</span>
                  </button>
                </div>

                <button
                  onClick={() => navigateToPatient(selectedPatient.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs flex items-center gap-1"
                >
                  <span>Full Telemetry</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 1. Continuous Photoplethysmogram (PPG) Waveform (BIDMC Signal) */}
          <PPGWaveform
            heartRate={selectedPatient?.latestVitals.heartRate ?? 76}
            spo2={selectedPatient?.latestVitals.spo2 ?? 96}
            respiratoryRate={selectedPatient?.latestVitals.respiratoryRate ?? 18}
            patientName={selectedPatient?.name ?? 'Marcus Chen'}
            sensorQuality={selectedPatient?.latestVitals.sensorQuality ?? 'VALID'}
            samplingRate={125}
            showControls={true}
          />

          {/* 2. Continuous Respiratory Waveform (BIDMC Respiration) */}
          <RespiratoryWaveform
            respiratoryRate={selectedPatient?.latestVitals.respiratoryRate ?? 18}
            patientName={selectedPatient?.name ?? 'Marcus Chen'}
            sensorQuality={selectedPatient?.latestVitals.sensorQuality ?? 'VALID'}
          />

          {/* Trend Charts for Selected Patient */}
          <div className="space-y-3">
            {/* SpO2 Trend Chart */}
            <VitalChart
              title="Oxygen Saturation (SpO2 %)"
              data={observations}
              dataKey="spo2"
              unit="%"
              strokeColor="#0d9488"
              baselineValue={selectedPatient?.baseline.spo2 ?? 97}
              spo2Scale={selectedPatient?.spo2Scale}
              normalRange={selectedPatient?.targetSpo2Range}
              height={160}
            />

            {/* Heart Rate Trend Chart */}
            <VitalChart
              title="Heart Rate (bpm)"
              data={observations}
              dataKey="heartRate"
              unit="bpm"
              strokeColor="#ef4444"
              baselineValue={selectedPatient?.baseline.heartRate ?? 72}
              height={160}
            />

            {/* Respiratory Rate Trend Chart */}
            <VitalChart
              title="Respiratory Rate (breaths/min)"
              data={observations}
              dataKey="respiratoryRate"
              unit="/min"
              strokeColor="#0284c7"
              baselineValue={selectedPatient?.baseline.respiratoryRate ?? 16}
              height={160}
            />

            {/* Temperature Trend Chart */}
            <VitalChart
              title="Body Temperature (°C) [Virtual Companion]"
              data={observations}
              dataKey="temperature"
              unit="°C"
              strokeColor="#d97706"
              baselineValue={selectedPatient?.baseline.temperature ?? 36.8}
              height={160}
            />
          </div>

          {/* Patient Vital Summary Table */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Patient Cohort Telemetry Summary
              </h3>
              <button
                onClick={() => setCurrentPage('patients')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                Expand View →
              </button>
            </div>
            <PatientTable
              patients={filteredPatients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={(id) => setSelectedPatientId(id)}
            />
          </div>
        </div>

        {/* ================= RIGHT COLUMN: Clinical Alerts & Actions (3 cols) ================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* Clinical Alert Overview Panel */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Clinical Alert Overview
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  {activeAlerts.length} Active
                </span>
              </div>
              <button
                onClick={() => setCurrentPage('alerts')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                All Alerts →
              </button>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {activeAlerts.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No active clinical alerts. All telemetry within targets.
                </div>
              ) : (
                activeAlerts.slice(0, 3).map((a) => (
                  <AlertCard
                    key={a.id}
                    alert={a}
                    onViewPatient={(pid) => navigateToPatient(pid)}
                    onAcknowledge={(aid) => acknowledgeAlert(aid)}
                    onResolve={(aid) => resolveAlert(aid)}
                    onViewExplanation={(alertItem) => setSelectedAlertForExplanation(alertItem)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Pending Clinician Actions */}
          <PendingActionsPanel
            actions={clinicianActions}
            onToggleComplete={(id) => toggleClinicianAction(id)}
            onOpenPatient={(pid) => navigateToPatient(pid)}
          />

          {/* Sensor Quality Overview Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 text-white shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-400">
                <Cpu className="w-4 h-4 text-teal-400" />
                <span>Sensor Artifact Filter</span>
              </div>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                Active 99.6%
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Distinguishes authentic physiological deterioration from probe detachment, motion noise, flatlined signals, and packet dropouts.
            </p>

            <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1.5 mb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">False Alerts Blocked Today:</span>
                <span className="font-mono font-bold text-emerald-400">34 events</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Probe Detached Warnings:</span>
                <span className="font-mono font-bold text-rose-400">1 active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mean Lead Time Gain:</span>
                <span className="font-mono font-bold text-teal-300">+3.4 hours</span>
              </div>
            </div>

            <button
              onClick={() => setCurrentPage('sensor-quality')}
              className="w-full py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Inspect Sensor Quality Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
