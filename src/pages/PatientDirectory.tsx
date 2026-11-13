import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PatientCard } from '../components/PatientCard';
import { PatientTable } from '../components/PatientTable';
import { VitalChart } from '../components/VitalChart';
import { StatusBadge } from '../components/StatusBadge';
import { generatePatientObservations } from '../data/mockObservations';
import { getPatientAvatar } from '../utils/patientAssets';
import { AlertCategory } from '../types/patient';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  Grid,
  List,
  LineChart,
  Sparkles,
  ShieldCheck,
  FileText,
  Activity,
  Plus,
  Heart,
  Wind,
  Thermometer,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowRight
} from 'lucide-react';

export const PatientDirectory: React.FC = () => {
  const { patients, navigateToPatient, searchQuery, setSearchQuery, selectedPatientId, setSelectedPatientId } = useApp();
  const [alertFilter, setAlertFilter] = useState<AlertCategory | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'age' | 'alert'>('id');
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'charts'>('table');
  const [focusedPatientId, setFocusedPatientId] = useState<string>(selectedPatientId || patients[0]?.id || 'PT-8021');
  const [rateGraphsExpanded, setRateGraphsExpanded] = useState<boolean>(true);
  const [enrollNotice, setEnrollNotice] = useState<string | null>(null);

  const filteredPatients = useMemo(() => {
    return patients
      .filter((p) => {
        const matchesAlert = alertFilter === 'ALL' || p.currentAlertCategory === alertFilter;
        const matchesSearch =
          searchQuery === '' ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.primaryDiagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.medicalConditions.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesAlert && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'id') return a.id.localeCompare(b.id);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'age') return b.age - a.age;
        return a.currentAlertCategory.localeCompare(b.currentAlertCategory);
      });
  }, [patients, alertFilter, searchQuery, sortBy]);

  // Focused patient for the 4 rate graphs
  const focusedPatient = useMemo(() => {
    return patients.find((p) => p.id === focusedPatientId) || filteredPatients[0] || patients[0];
  }, [patients, focusedPatientId, filteredPatients]);

  // Observations for the focused patient's rate graphs
  const focusedObservations = useMemo(() => {
    if (!focusedPatient) return [];
    return generatePatientObservations(focusedPatient.id);
  }, [focusedPatient]);

  return (
    <div className="space-y-5 text-left">
      {/* Top Banner with Synthea & PPG Telemetry Notice */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Post-Discharge Patient Directory
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
              {filteredPatients.length} Active Records
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
              Dynamic Live Waves Active
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Continuous remote patient monitoring cohort with live photoplethysmogram (PPG) pulse morphology, vital rate trend graphs, and personalized SpO2 scales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            Synthetic Demonstration Patient Data
          </span>
          <button
            onClick={() =>
              setEnrollNotice('New patient discharge enrollment is synchronized with the hospital FHIR R4 EHR queue.')
            }
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enroll Patient</span>
          </button>
        </div>
      </div>

      {enrollNotice && (
        <div className="bg-teal-50 border border-teal-200 text-teal-900 rounded-xl px-4 py-2.5 text-xs flex items-center justify-between gap-2">
          <span>{enrollNotice}</span>
          <button onClick={() => setEnrollNotice(null)} className="text-teal-700 font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Control Bar: Search, Filters, Sorting, View Toggle */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, ID, or condition..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-700 font-semibold mr-1">Alert Level:</span>
          {(['ALL', 'URGENT', 'REVIEW', 'WATCH', 'STABLE', 'OFFLINE'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setAlertFilter(filter)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                alertFilter === filter
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Sort & 3-Way View Mode (Table, Grid, Rate Graphs) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View with PPG Waveforms"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View with PPG Waveforms"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 ${
                viewMode === 'charts' ? 'bg-white text-teal-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="24h Vital Rate Graphs View"
            >
              <LineChart className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline text-[11px]">Rate Graphs</span>
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-700 font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              <option value="id">Patient ID</option>
              <option value="name">Name</option>
              <option value="age">Age</option>
              <option value="alert">Alert Severity</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= SECTION: 4 VITAL RATE TREND GRAPHS ================= */}
      {/* (Oxygen Saturation, Heart Rate, Respiratory Rate, Body Temperature) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        {/* Header with Patient Selector Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <LineChart className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Patient Vital Rate Trend Graphs (24h Profiles)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                Available Data Streams
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any patient below to analyze their 4 continuous vital rate graphs with baseline delta and therapeutic target bands.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRateGraphsExpanded(!rateGraphsExpanded)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
            >
              <span>{rateGraphsExpanded ? 'Hide Rate Graphs' : 'Show Rate Graphs'}</span>
              {rateGraphsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Horizontal Patient Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {patients.map((p) => {
            const isSelected = p.id === focusedPatient?.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setFocusedPatientId(p.id);
                  setSelectedPatientId(p.id);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-all shrink-0 ${
                  isSelected
                    ? 'bg-teal-50/90 border-teal-500 text-teal-900 shadow-xs ring-1 ring-teal-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <img
                  src={getPatientAvatar(p.id, p.avatarUrl)}
                  alt={p.name}
                  className="w-6 h-6 rounded-full object-cover border border-slate-300"
                />
                <div className="text-left">
                  <div className="font-bold flex items-center gap-1">
                    <span>{p.name}</span>
                    <span className="text-[10px] font-mono opacity-80">({p.id})</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    HR: {p.latestVitals.heartRate} | SpO2: {p.latestVitals.spo2}%
                  </div>
                </div>
                <StatusBadge type="alert" value={p.currentAlertCategory} size="sm" />
              </button>
            );
          })}
        </div>

        {/* The 4 Vital Rate Graphs Grid for the Focused Patient */}
        {rateGraphsExpanded && focusedPatient && (
          <div className="space-y-4 pt-1 animate-in fade-in duration-200">
            {/* Focused Patient Summary Sub-Header */}
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <img
                  src={getPatientAvatar(focusedPatient.id, focusedPatient.avatarUrl)}
                  alt={focusedPatient.name}
                  className="w-9 h-9 rounded-full object-cover border border-teal-400"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{focusedPatient.name}</span>
                    <span className="font-mono text-slate-500 font-semibold">({focusedPatient.id})</span>
                    <StatusBadge type="alert" value={focusedPatient.currentAlertCategory} size="sm" />
                    {focusedPatient.spo2Scale === 'SCALE_2' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                        Hypercapnic Scale 2 (88–92%)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {focusedPatient.age}y {focusedPatient.gender} • Discharged: {focusedPatient.dischargeDate} • Diagnosis: {focusedPatient.primaryDiagnosis}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateToPatient(focusedPatient.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>Full Telemetry & Waveforms</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* The 4 Rate Graphs Grid (Oxygen Saturation, Heart Rate, Respiratory Rate, Body Temperature) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Oxygen Saturation (SpO2 %) */}
              <VitalChart
                title="Oxygen Saturation (SpO2 %)"
                data={focusedObservations}
                dataKey="spo2"
                unit="%"
                strokeColor="#0d9488"
                baselineValue={focusedPatient.baseline.spo2}
                spo2Scale={focusedPatient.spo2Scale}
                normalRange={focusedPatient.targetSpo2Range}
                height={190}
              />

              {/* 2. Heart Rate (bpm) */}
              <VitalChart
                title="Heart Rate (bpm)"
                data={focusedObservations}
                dataKey="heartRate"
                unit="bpm"
                strokeColor="#ef4444"
                baselineValue={focusedPatient.baseline.heartRate}
                height={190}
              />

              {/* 3. Respiratory Rate (breaths/min) */}
              <VitalChart
                title="Respiratory Rate (breaths/min)"
                data={focusedObservations}
                dataKey="respiratoryRate"
                unit="/min"
                strokeColor="#0284c7"
                baselineValue={focusedPatient.baseline.respiratoryRate}
                height={190}
              />

              {/* 4. Body Temperature (°C) */}
              <VitalChart
                title="Body Temperature (°C)"
                data={focusedObservations}
                dataKey="temperature"
                unit="°C"
                strokeColor="#f59e0b"
                baselineValue={focusedPatient.baseline.temperature}
                height={190}
              />
            </div>
          </div>
        )}
      </div>

      {/* Directory Content: Table, Grid, or Rate Graphs View */}
      {viewMode === 'table' ? (
        <PatientTable
          patients={filteredPatients}
          onSelectPatient={(id) => {
            setFocusedPatientId(id);
            setSelectedPatientId(id);
          }}
          selectedPatientId={focusedPatient?.id}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              isSelected={p.id === focusedPatient?.id}
              onSelect={(id) => {
                setFocusedPatientId(id);
                setSelectedPatientId(id);
              }}
              onViewDetails={(id) => navigateToPatient(id)}
            />
          ))}
        </div>
      ) : (
        /* Full Cohort Rate Graphs View: Renders 4 rate graphs for each patient in the filtered cohort */
        <div className="space-y-6">
          {filteredPatients.map((p) => {
            const pObservations = generatePatientObservations(p.id);
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <img
                      src={getPatientAvatar(p.id, p.avatarUrl)}
                      alt={p.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-300"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                        <span className="font-mono text-slate-500 font-semibold text-xs">({p.id})</span>
                        <StatusBadge type="alert" value={p.currentAlertCategory} size="sm" />
                        {p.spo2Scale === 'SCALE_2' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            Scale 2 (88–92%)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.primaryDiagnosis} • Discharged: {p.dischargeDate}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigateToPatient(p.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Detail Telemetry</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <VitalChart
                    title="Oxygen Saturation (SpO2 %)"
                    data={pObservations}
                    dataKey="spo2"
                    unit="%"
                    strokeColor="#0d9488"
                    baselineValue={p.baseline.spo2}
                    spo2Scale={p.spo2Scale}
                    normalRange={p.targetSpo2Range}
                    height={180}
                  />

                  <VitalChart
                    title="Heart Rate (bpm)"
                    data={pObservations}
                    dataKey="heartRate"
                    unit="bpm"
                    strokeColor="#ef4444"
                    baselineValue={p.baseline.heartRate}
                    height={180}
                  />

                  <VitalChart
                    title="Respiratory Rate (breaths/min)"
                    data={pObservations}
                    dataKey="respiratoryRate"
                    unit="/min"
                    strokeColor="#0284c7"
                    baselineValue={p.baseline.respiratoryRate}
                    height={180}
                  />

                  <VitalChart
                    title="Body Temperature (°C)"
                    data={pObservations}
                    dataKey="temperature"
                    unit="°C"
                    strokeColor="#f59e0b"
                    baselineValue={p.baseline.temperature}
                    height={180}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Synthea FHIR R4 Integration Architecture Note */}
      <div className="bg-slate-50 rounded-xl border border-slate-200/90 p-4 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-600" />
          Synthea Synthetic Patient Generation & FHIR R4 Mapping (Requirement 11)
        </div>
        <p className="leading-relaxed">
          This patient directory is structured to ingest synthetic FHIR R4 Patient and Observation resources generated via Synthea™. Each record stores standard demographics (age, gender, identifier), clinical conditions (ICD-10/SNOMED-CT mapped), current medication orders, and individualized remote-monitoring configuration extensions (such as NEWS2 Scale 2 designation for hypercapnic respiratory failure).
        </p>
      </div>
    </div>
  );
};
