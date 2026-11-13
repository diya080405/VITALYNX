import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Clock,
  Radio,
  User,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Save,
  Info,
  Server,
  Activity,
  FileCheck
} from 'lucide-react';
import { DOCTOR_AVATAR } from '../utils/patientAssets';
import { api } from '../services/api';
import type { ClinicalThresholdsConfig, SmsGatewayStatus } from '../types/notification';

export const Settings: React.FC = () => {
  const [dataRefreshInterval, setDataRefreshInterval] = useState<number>(5);
  const [sensorTimeoutSeconds, setSensorTimeoutSeconds] = useState<number>(180);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(true);
  const [emailDigestFrequency, setEmailDigestFrequency] = useState<string>('shift');
  const [artifactRejectionThreshold, setArtifactRejectionThreshold] = useState<number>(90);
  const [thresholds, setThresholds] = useState<ClinicalThresholdsConfig>({
    spo2CriticalScale1: 89,
    spo2CriticalScale2: 84,
    hrCriticalHigh: 130,
    hrCriticalLow: 40,
    rrCriticalHigh: 25,
    rrCriticalLow: 8,
    tempCriticalHigh: 38.8,
    tempCriticalLow: 35.0,
    news2CriticalThreshold: 7,
    alertCooldownMinutes: 15,
    maxSmsRetries: 3
  });
  const [gatewayStatus, setGatewayStatus] = useState<SmsGatewayStatus | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    api.getClinicalThresholds().then(setThresholds).catch(() => {});
    api.getSmsGatewayStatus().then(setGatewayStatus).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedFeedback(null);
    setSaveError(null);
    try {
      const updated = await api.updateClinicalThresholds(thresholds);
      setThresholds(updated);
      setSavedFeedback('System configuration and WhatsApp emergency thresholds saved to backend database.');
      setTimeout(() => setSavedFeedback(null), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Unable to save clinical threshold configuration.');
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Surveillance System Settings & Governance
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
              Admin Configuration
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Telemetry ingestion timeouts, notification pipelines, sensor quality parameters, and system governance.
          </p>
        </div>

        <div className="text-xs text-slate-700 font-mono">
          VITALYNX Platform Version: <strong>v1.0.4-rc</strong>
        </div>
      </div>

      {/* Safety Policy Notice regarding Clinical Scoring */}
      <div className="p-4 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 text-xs flex items-start gap-3">
        <Lock className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block mb-0.5">
            Clinical Safety & Governance Policy (Requirement 15)
          </span>
          <span className="text-slate-300 leading-relaxed">
            In compliance with medical software standards (IEC 62304), clinical scoring criteria (such as NEWS2 parameter ranges and SpO2 Scale 2 hypercapnic target definitions 88–92%) are strictly governed by validated hospital clinical protocols and are <strong>not exposed as editable arbitrary preferences</strong> to individual users.
          </span>
        </div>
      </div>

      {savedFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{savedFeedback}</span>
        </div>
      )}
      {saveError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2">
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Section 1: Monitoring & Sensor Quality Configuration */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Radio className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Telemetry Ingestion & Sensor Timeout
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Data Poll & Polling Interval (seconds)
              </label>
              <select
                value={dataRefreshInterval}
                onChange={(e) => setDataRefreshInterval(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                <option value={2}>2 seconds (High Frequency / ICU Stepdown)</option>
                <option value={5}>5 seconds (Standard Ward / Continuous Remote)</option>
                <option value={15}>15 seconds (Battery Conservation Mode)</option>
                <option value={30}>30 seconds (Intermittent Telemetry)</option>
              </select>
              <p className="text-[11px] text-slate-700 mt-1">
                Governs client polling frequency when connected to future FastAPI backend.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Sensor Disconnect Timeout Threshold (seconds)
              </label>
              <select
                value={sensorTimeoutSeconds}
                onChange={(e) => setSensorTimeoutSeconds(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              >
                <option value={60}>60 seconds (1 minute strict)</option>
                <option value={180}>180 seconds (3 minutes standard)</option>
                <option value={300}>300 seconds (5 minutes relaxed)</option>
              </select>
              <p className="text-[11px] text-slate-700 mt-1">
                Time elapsed before missing packets generate a "Device Connectivity Warning".
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Signal Quality Index (SQI) Artifact Rejection Cutoff
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={70}
                  max={98}
                  value={artifactRejectionThreshold}
                  onChange={(e) => setArtifactRejectionThreshold(Number(e.target.value))}
                  className="flex-1 accent-teal-600"
                />
                <span className="font-mono font-bold text-slate-900 text-xs w-10">
                  {artifactRejectionThreshold}%
                </span>
              </div>
              <p className="text-[11px] text-slate-700 mt-1">
                Optical PPG pulses below this threshold are marked as SUSPECTED_ARTIFACT.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Active Full-Stack Backend Endpoint
              </label>
              <input
                type="text"
                readOnly
                value="Same-Origin Express + SQLite + WebSocket (/api & /ws on port 3000)"
                className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-600 cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-700 mt-1">
                Optional override via <code>VITE_API_BASE_URL</code> environment variable.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Notifications & Audio Preferences */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Bell className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Notification & Escalation Channels
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="font-bold text-slate-900 block">
                  Audible Alarm Ping on Urgent Deterioration
                </span>
                <span className="text-[11px] text-slate-700">
                  Generates 880Hz clinical notification tone for Urgent class alerts.
                </span>
              </div>
              <input
                type="checkbox"
                checked={soundAlertsEnabled}
                onChange={(e) => setSoundAlertsEnabled(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <span className="font-bold text-slate-900 block">
                  Clinician Shift Tele-triage Digest
                </span>
                <span className="text-[11px] text-slate-700">
                  Automated summary of Watch, Review, and Resolved alerts.
                </span>
              </div>
              <select
                value={emailDigestFrequency}
                onChange={(e) => setEmailDigestFrequency(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
              >
                <option value="hourly">Every 2 hours</option>
                <option value="shift">Per 8-hour shift</option>
                <option value="daily">Daily morning digest</option>
              </select>
            </div>
          </div>

          {/* Configurable Critical Emergency WhatsApp Trigger Thresholds */}
          <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900">
                Configurable Critical WhatsApp Emergency Trigger Thresholds & Cooldown
              </span>
              {gatewayStatus && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
                  Normal WhatsApp Ready (No API / DLT Required)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Critical SpO2 ≤ (%)
                </label>
                <input
                  type="number"
                  min={75}
                  max={95}
                  value={thresholds.spo2CriticalScale1}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, spo2CriticalScale1: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Critical HR High &gt; (bpm)
                </label>
                <input
                  type="number"
                  min={100}
                  max={180}
                  value={thresholds.hrCriticalHigh}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, hrCriticalHigh: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Critical RR ≥ (/min)
                </label>
                <input
                  type="number"
                  min={20}
                  max={45}
                  value={thresholds.rrCriticalHigh}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, rrCriticalHigh: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Critical Temp ≥ (°C)
                </label>
                <input
                  type="number"
                  step={0.1}
                  min={37.5}
                  max={42}
                  value={thresholds.tempCriticalHigh}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, tempCriticalHigh: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Hypercapnic Scale 2 SpO2 ≤ (%)
                </label>
                <input
                  type="number"
                  min={70}
                  max={92}
                  value={thresholds.spo2CriticalScale2}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, spo2CriticalScale2: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Critical HR Low ≤ (bpm)
                </label>
                <input
                  type="number"
                  min={25}
                  max={60}
                  value={thresholds.hrCriticalLow}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, hrCriticalLow: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Duplicate Alert Cooldown (min)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={thresholds.alertCooldownMinutes}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, alertCooldownMinutes: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Alert Escalation Cap
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={thresholds.maxSmsRetries}
                  onChange={(e) => setThresholds((prev) => ({ ...prev, maxSmsRetries: Number(e.target.value) }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: User Profile & Role Permissions */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <User className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Active Clinician Profile & Role
            </h3>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <img
              src={DOCTOR_AVATAR}
              alt="Dr. Evelyn Vance"
              className="w-14 h-14 rounded-full object-cover border border-slate-200 shadow-xs"
            />
            <div>
              <div className="font-bold text-sm text-slate-900">Dr. Evelyn Vance, MD, FCCP</div>
              <div className="text-slate-700">Role: Clinical Administrator & Pulmonology Lead</div>
              <div className="text-slate-700 mt-1">
                Department: Stepdown Post-Discharge Tele-Surveillance • NPI: 1892837491
              </div>
            </div>
          </div>
        </div>

        {/* Save Changes Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
