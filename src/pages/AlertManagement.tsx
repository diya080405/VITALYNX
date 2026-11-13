import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlertCard } from '../components/AlertCard';
import { StatusBadge } from '../components/StatusBadge';
import { AlertResolutionStatus } from '../types/alert';
import { EmergencyNotification, SmsGatewayStatus, WhatsAppAlertStatus } from '../types/notification';
import { api } from '../services/api';
import {
  CheckCircle2,
  ExternalLink,
  History,
  MessageSquare,
  Send,
  Phone,
  Loader2,
  ShieldCheck
} from 'lucide-react';

function formatWhatsAppStatusDisplay(status: WhatsAppAlertStatus): {
  label: WhatsAppAlertStatus;
  hint: string;
  badgeClass: string;
} {
  switch (status) {
    case 'USER CONFIRMED SENT':
      return {
        label: 'USER CONFIRMED SENT',
        hint: 'Clinician/user confirmed message was sent in WhatsApp',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      };
    case 'OPENED':
      return {
        label: 'OPENED',
        hint: 'WhatsApp chat opened with prefilled alert (awaiting send confirmation)',
        badgeClass: 'bg-sky-100 text-sky-900 border border-sky-200'
      };
    case 'READY TO SEND':
    default:
      return {
        label: 'READY TO SEND',
        hint: 'Prefilled WhatsApp emergency link ready for guardian',
        badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200'
      };
  }
}

export const AlertManagement: React.FC = () => {
  const {
    alerts,
    patients,
    notifications,
    activeAlertFilter,
    setActiveAlertFilter,
    navigateToPatient,
    acknowledgeAlert,
    resolveAlert,
    setSelectedAlertForExplanation,
    searchQuery,
    markWhatsAppOpened,
    confirmWhatsAppSent,
    triggerTestEmergencySms
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<AlertResolutionStatus | 'ALL'>('ALL');
  const [testPatientId, setTestPatientId] = useState<string>('PT-8024');
  const [verifiedTestPhone, setVerifiedTestPhone] = useState<string>('');
  const [testConsentConfirmed, setTestConsentConfirmed] = useState<boolean>(false);
  const [testBaselineHr, setTestBaselineHr] = useState<number>(80);
  const [testBaselineSpo2, setTestBaselineSpo2] = useState<number>(98);
  const [testBaselineRr, setTestBaselineRr] = useState<number>(16);
  const [testBaselineTemp, setTestBaselineTemp] = useState<number>(36.5);
  const [testReadingHr, setTestReadingHr] = useState<number>(92);
  const [testReadingSpo2, setTestReadingSpo2] = useState<number>(98);
  const [testReadingRr, setTestReadingRr] = useState<number>(16);
  const [testReadingTemp, setTestReadingTemp] = useState<number>(36.5);
  const [testingWhatsApp, setTestingWhatsApp] = useState<boolean>(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [preparedTestNotif, setPreparedTestNotif] = useState<EmergencyNotification | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<SmsGatewayStatus | null>(null);

  useEffect(() => {
    api.getSmsGatewayStatus().then(setGatewayStatus).catch(() => {});
  }, []);

  const filteredAlerts = alerts.filter((a) => {
    const matchesCategory = activeAlertFilter === 'ALL' || a.alertLevel === activeAlertFilter;
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      a.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.ruleApplied.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.explanation.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesStatus && matchesSearch;
  });

  const urgentCount = alerts.filter((a) => a.alertLevel === 'URGENT' && a.status === 'ACTIVE').length;
  const reviewCount = alerts.filter((a) => a.alertLevel === 'REVIEW' && a.status === 'ACTIVE').length;
  const watchCount = alerts.filter((a) => a.alertLevel === 'WATCH' && a.status === 'ACTIVE').length;
  const resolvedCount = alerts.filter((a) => a.status === 'RESOLVED').length;

  const readyToSendAlerts = notifications.filter((n) => n.deliveryStatus === 'READY TO SEND');
  const previewHrDev = Number((testReadingHr - testBaselineHr).toFixed(1));

  const handlePrepareTestWhatsApp = async () => {
    if (!verifiedTestPhone.trim()) {
      setFeedback({
        type: 'error',
        text: 'Enter a valid WhatsApp mobile number (e.g. +919876543210) before preparing a TEST WhatsApp alert.'
      });
      return;
    }
    if (!testConsentConfirmed) {
      setFeedback({
        type: 'error',
        text: 'Please confirm recipient consent before preparing a test WhatsApp alert.'
      });
      return;
    }
    setTestingWhatsApp(true);
    setFeedback(null);
    setPreparedTestNotif(null);
    try {
      const notif = await triggerTestEmergencySms({
        patientId: testPatientId,
        verifiedPhone: verifiedTestPhone.trim(),
        consentConfirmed: true,
        testBaseline: {
          heartRate: testBaselineHr,
          spo2: testBaselineSpo2,
          respiratoryRate: testBaselineRr,
          temperature: testBaselineTemp
        },
        testReading: {
          heartRate: testReadingHr,
          spo2: testReadingSpo2,
          respiratoryRate: testReadingRr,
          temperature: testReadingTemp
        }
      });
      setPreparedTestNotif(notif);
      setFeedback({
        type: 'success',
        text: `Test WhatsApp alert prepared for ${notif.recipientPhone} (Status: READY TO SEND). Click "Open Test Alert in WhatsApp" below to open WhatsApp with the prefilled emergency message.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Failed to prepare test WhatsApp alert.'
      });
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleOpened = async (notifId: string) => {
    try {
      const updated = await markWhatsAppOpened(notifId);
      if (preparedTestNotif?.id === notifId) {
        setPreparedTestNotif(updated);
      }
    } catch {
      // non-blocking
    }
  };

  const handleConfirmSent = async (notifId: string) => {
    setConfirmingId(notifId);
    setFeedback(null);
    try {
      const updated = await confirmWhatsAppSent(notifId);
      if (preparedTestNotif?.id === notifId) {
        setPreparedTestNotif(updated);
      }
      setFeedback({
        type: 'success',
        text: `Confirmed WhatsApp emergency message sent to ${updated.recipientName} (${updated.recipientPhone}).`
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Unable to confirm WhatsApp sent state.'
      });
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-5 text-left">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Clinical Alert Management & Triage
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              {urgentCount + reviewCount + watchCount} Active Alarms
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Tri-tier clinical decision support framework: Watch (early drift), Review (assessment needed), and Urgent (prompt attention).
          </p>
        </div>

        {/* Quick Triage Counters */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-center">
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Urgent</span>
            <span className="text-sm font-bold text-rose-800 font-mono">{urgentCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">Review</span>
            <span className="text-sm font-bold text-amber-900 font-mono">{reviewCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-center">
            <span className="text-[10px] uppercase font-bold text-teal-800 block">Watch</span>
            <span className="text-sm font-bold text-teal-900 font-mono">{watchCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-700 block">Resolved</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{resolvedCount}</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-700 font-semibold mr-1">Alert Category:</span>
          {(
            [
              { id: 'ALL', label: 'All Alerts' },
              { id: 'URGENT', label: 'Urgent' },
              { id: 'REVIEW', label: 'Review' },
              { id: 'WATCH', label: 'Watch' }
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveAlertFilter(c.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                activeAlertFilter === c.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-700 font-semibold mr-1">Triage Status:</span>
          {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Alert Cards Stack */}
      <div className="space-y-3.5">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-700 text-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-700 text-sm">No alerts match current criteria</p>
            <p className="mt-1">All telemetry is stable, or filters have excluded available records.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onViewPatient={(pid) => navigateToPatient(pid)}
              onAcknowledge={(aid) => acknowledgeAlert(aid)}
              onResolve={(aid) => resolveAlert(aid)}
              onViewExplanation={(alertItem) => setSelectedAlertForExplanation(alertItem)}
            />
          ))
        )}
      </div>

      {/* WHATSAPP EMERGENCY ALERT HISTORY */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  WHATSAPP EMERGENCY ALERT HISTORY
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
                  {gatewayStatus ? 'Normal WhatsApp Ready (No API / DLT)' : 'Normal WhatsApp App Links'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Automatically prepares individual prefilled WhatsApp emergency messages for registered primary & alternate guardians. Status stays strictly READY TO SEND → OPENED → USER CONFIRMED SENT.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={testPatientId}
              onChange={(e) => setTestPatientId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              aria-label="Patient context for test WhatsApp alert"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={verifiedTestPhone}
              onChange={(e) => setVerifiedTestPhone(e.target.value)}
              placeholder="Guardian WhatsApp (e.g. +919876543210)"
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 w-52"
              aria-label="WhatsApp number for test emergency alert"
            />
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={testConsentConfirmed}
                onChange={(e) => setTestConsentConfirmed(e.target.checked)}
                className="accent-teal-600 rounded"
              />
              <span>Confirm test recipient</span>
            </label>
            <button
              type="button"
              onClick={handlePrepareTestWhatsApp}
              disabled={testingWhatsApp}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              {testingWhatsApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>SEND TEST WHATSAPP</span>
            </button>
          </div>
        </div>

        {/* Immediate Ready-To-Send Banner when emergency WhatsApp alerts await opening */}
        {readyToSendAlerts.length > 0 && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">
                {readyToSendAlerts.length} Guardian WhatsApp Alert(s) Ready to Open
              </span>
              <span className="text-[11px] text-rose-700">
                Click a guardian button below to open their WhatsApp chat with the emergency message prefilled.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {readyToSendAlerts.slice(0, 6).map((n) => (
                <a
                  key={n.id}
                  href={n.whatsappUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleOpened(n.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    Open WhatsApp: {n.recipientName} ({n.recipientType} • {n.recipientPhone})
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Test Scenario Bar (Separate from Real Patient Emergency Alerts) */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
              Authorized Test WhatsApp Deviation Scenario (Separate from Real Patient Alerts)
            </span>
            <span className="font-mono font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              HR Deviation: {previewHrDev >= 0 ? `+${previewHrDev}` : previewHrDev} BPM (Threshold ±8 BPM)
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
            <label className="block">
              <span className="text-[10px] text-slate-600 font-semibold">Base HR</span>
              <input
                type="number"
                value={testBaselineHr}
                onChange={(e) => setTestBaselineHr(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-600 font-semibold">Base SpO2</span>
              <input
                type="number"
                value={testBaselineSpo2}
                onChange={(e) => setTestBaselineSpo2(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-600 font-semibold">Base RR</span>
              <input
                type="number"
                value={testBaselineRr}
                onChange={(e) => setTestBaselineRr(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-600 font-semibold">Base Temp</span>
              <input
                type="number"
                step="0.1"
                value={testBaselineTemp}
                onChange={(e) => setTestBaselineTemp(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-rose-700 font-semibold">New HR</span>
              <input
                type="number"
                value={testReadingHr}
                onChange={(e) => setTestReadingHr(Number(e.target.value))}
                className="w-full bg-white border border-rose-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-600 font-semibold">New SpO2</span>
              <input
                type="number"
                value={testReadingSpo2}
                onChange={(e) => setTestReadingSpo2(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-600 font-semibold">New RR</span>
              <input
                type="number"
                value={testReadingRr}
                onChange={(e) => setTestReadingRr(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-slate-600 font-semibold">New Temp</span>
              <input
                type="number"
                step="0.1"
                value={testReadingTemp}
                onChange={(e) => setTestReadingTemp(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
              />
            </label>
          </div>
        </div>

        {feedback && (
          <div
            className={`px-3 py-2.5 rounded-lg text-xs font-medium border flex flex-wrap items-center justify-between gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <span>{feedback.text}</span>
            {preparedTestNotif && preparedTestNotif.whatsappUrl && (
              <a
                href={preparedTestNotif.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleOpened(preparedTestNotif.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Test Alert in WhatsApp</span>
              </a>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Patient Name & ID</th>
                <th className="py-2.5 px-3">Guardian Name & Number</th>
                <th className="py-2.5 px-3">Abnormal Vital Parameter</th>
                <th className="py-2.5 px-3">Baseline & Current</th>
                <th className="py-2.5 px-3">Deviation</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">WhatsApp Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    No WhatsApp emergency alerts prepared yet.
                  </td>
                </tr>
              ) : (
                notifications.map((n) => {
                  const statusInfo = formatWhatsAppStatusDisplay(n.deliveryStatus);
                  return (
                    <tr key={n.id} className="hover:bg-slate-50/80 align-top">
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 ${
                            n.isTest || n.alertType === 'TEST_ALERT'
                              ? 'bg-sky-100 text-sky-900 border border-sky-200'
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}
                        >
                          {n.isTest || n.alertType === 'TEST_ALERT' ? 'TEST ALERT' : 'REAL EMERGENCY ALERT'}
                        </span>
                        <div className="font-semibold text-slate-900">
                          {n.patientName || n.patientId}{' '}
                          <span className="font-mono text-slate-500">({n.patientId})</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {n.recipientName}{' '}
                          <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                            {n.recipientType}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-mono text-slate-700 mt-0.5">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {n.recipientPhone}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {n.abnormalParameter || 'Vital Sign Alert'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        <div>Base: {n.baselineValue || '—'}</div>
                        <div className="font-bold text-slate-900">Curr: {n.currentValue || '—'}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-700 whitespace-nowrap">
                        {n.deviationValue || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{n.createdAt}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5 max-w-[190px]">{statusInfo.hint}</div>
                        {n.errorReason && (
                          <div className="text-[10px] text-rose-700 font-semibold mt-0.5 max-w-[190px]">
                            {n.errorReason}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {n.whatsappUrl && n.whatsappUrl !== '#' ? (
                            <a
                              href={n.whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleOpened(n.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-xs"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-rose-700 font-semibold">Invalid Number</span>
                          )}

                          {n.deliveryStatus !== 'USER CONFIRMED SENT' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmSent(n.id)}
                              disabled={confirmingId === n.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-[11px]"
                            >
                              {confirmingId === n.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-3 h-3" />
                              )}
                              <span>Confirm Sent</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Audit Trail Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Clinical Alert Incident Registry & Audit Log
            </h3>
          </div>
          <span className="text-xs text-slate-700">
            Complies with ISO 14971 Medical Device Risk Management
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Alert ID</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Level</th>
                <th className="py-2.5 px-3">Trigger Reading</th>
                <th className="py-2.5 px-3">Sensor Quality</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Clinician Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {alerts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{a.id}</td>
                  <td className="py-2.5 px-3 text-slate-700">{a.timestamp}</td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                    {a.patientName} ({a.patientId})
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <StatusBadge type="alert" value={a.alertLevel} size="sm" />
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 font-semibold">{a.vitalSignReading}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <StatusBadge type="sensor" value={a.sensorQualityStatus} size="sm" />
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        a.status === 'RESOLVED'
                          ? 'bg-emerald-50 text-emerald-800'
                          : a.status === 'ACKNOWLEDGED'
                          ? 'bg-teal-50 text-teal-800'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td
                    className="py-2.5 px-3 font-sans text-slate-700 text-[11px] truncate max-w-[200px]"
                    title={a.explanation}
                  >
                    {a.acknowledgedBy ? `Ack by ${a.acknowledgedBy}` : a.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
