import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { PPGWaveform } from '../components/PPGWaveform';
import { RespiratoryWaveform } from '../components/RespiratoryWaveform';
import { VitalChart } from '../components/VitalChart';
import { StatusBadge } from '../components/StatusBadge';
import { generatePatientObservations } from '../data/mockObservations';
import { api } from '../services/api';
import {
  getPatientAvatar,
  formatTelLink,
  validatePhoneInput
} from '../utils/patientAssets';
import { buildVerifiedPatientWhatsAppAlert } from '../utils/emergencyWhatsAppBuilder';
import type { ReportPeriod, SymptomCheckin } from '../types/notification';
import type { VitalObservation } from '../types/observation';
import type { EmergencyContact } from '../types/patient';
import {
  Heart,
  Wind,
  Thermometer,
  Activity,
  Phone,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  HeartHandshake,
  LogOut,
  AlertOctagon,
  Download,
  Loader2,
  MessageSquare,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const {
    currentUser,
    patients,
    notifications,
    logout,
    addEmergencyContact,
    updateEmergencyContact,
    deleteEmergencyContact,
    downloadReportPdf,
    markWhatsAppOpened,
    confirmWhatsAppSent
  } = useApp();

  const loggedInPatientId = currentUser?.patientId?.trim() || '';
  const patient = loggedInPatientId
    ? patients.find((p) => p.id === loggedInPatientId)
    : undefined;

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRelationship, setEditRelationship] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRelationship, setNewContactRelationship] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('24h');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);

  const [observations, setObservations] = useState<VitalObservation[]>(() =>
    patient ? generatePatientObservations(patient.id) : []
  );

  // Symptom check-in state
  const [checkins, setCheckins] = useState<SymptomCheckin[]>([]);
  const [dyspneaScore, setDyspneaScore] = useState<number>(2);
  const [fatigueScore, setFatigueScore] = useState<number>(3);
  const [dizziness, setDizziness] = useState<boolean>(false);
  const [feverChills, setFeverChills] = useState<boolean>(false);
  const [checkinNotes, setCheckinNotes] = useState<string>('');
  const [checkinSubmitting, setCheckinSubmitting] = useState<boolean>(false);
  const [checkinFeedback, setCheckinFeedback] = useState<string | null>(null);

  useEffect(() => {
    setContactError(null);
    setContactSuccess(null);
    setEditingContactId(null);
    setIsAddingContact(false);
    setConfirmDeleteId(null);

    if (!patient) {
      setObservations([]);
      setCheckins([]);
      return;
    }

    let cancelled = false;
    setObservations([]);
    api
      .getObservations(patient.id, 60)
      .then((obs) => {
        if (cancelled) return;
        const scopedObs = (obs || []).filter((o) => o.patientId === patient.id);
        if (scopedObs.length > 0) setObservations(scopedObs);
        else setObservations(generatePatientObservations(patient.id));
      })
      .catch(() => {
        if (!cancelled) setObservations(generatePatientObservations(patient.id));
      });

    api
      .getCheckins(patient.id)
      .then((list) => {
        if (!cancelled) setCheckins(list);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [patient?.id, patient?.latestVitals.timestamp]);

  if (patients.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-600 bg-white rounded-xl border border-slate-200">
        Loading patient clinical telemetry...
      </div>
    );
  }

  if (!patient || !loggedInPatientId) {
    return (
      <div className="p-6 text-center text-xs text-rose-800 bg-rose-50 rounded-xl border border-rose-200">
        Unable to verify authenticated patient record ({loggedInPatientId || 'No Patient ID'}). Emergency alert generation has been blocked to protect patient data integrity.
      </div>
    );
  }

  const patientObservations = observations.filter((o) => o.patientId === patient.id);
  const patientNotifications = notifications.filter((n) => n.patientId === patient.id);
  const isDetached =
    patient.latestVitals.sensorQuality === 'PROBE_REMOVED' ||
    patient.latestVitals.sensorQuality === 'SENSOR_DISCONNECTED';
  const isScale2 = patient.spo2Scale === 'SCALE_2';

  const hrPrev = patient.latestVitals.previousHeartRate ?? patient.baseline.heartRate;
  const hrDelta = patient.latestVitals.heartRate - hrPrev;

  const spo2Prev = patient.latestVitals.previousSpo2 ?? patient.baseline.spo2;
  const spo2Delta = patient.latestVitals.spo2 - spo2Prev;

  const rrPrev = patient.latestVitals.previousRespiratoryRate ?? patient.baseline.respiratoryRate;
  const rrDelta = patient.latestVitals.respiratoryRate - rrPrev;

  const tempPrev = patient.latestVitals.previousTemperature ?? patient.baseline.temperature;
  const tempDelta = Number((patient.latestVitals.temperature - tempPrev).toFixed(1));

  const getStatusExplanation = () => {
    if (patient.statusExplanation) return patient.statusExplanation;
    switch (patient.currentAlertCategory) {
      case 'URGENT':
        return 'High respiratory rate and oxygen desaturation detected. Your care team has been notified for immediate review.';
      case 'REVIEW':
        return 'Temperature elevation with mild tachycardia observed. Clinician assessment is recommended.';
      case 'WATCH':
        return 'A slight downward shift in oxygen levels has been noted compared to your recovery baseline. Continuing observation.';
      case 'OFFLINE':
        return 'The sensor probe has been detached or lost connection. Please verify your wearable device is properly clipped.';
      case 'STABLE':
      default:
        return 'All vital readings are currently stable and within your personalized post-discharge target range.';
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setPdfFeedback(null);
    try {
      await downloadReportPdf(patient.id, patient.name, reportPeriod);
      setPdfFeedback(`Downloaded ${reportPeriod.toUpperCase()} PDF clinical report.`);
      setTimeout(() => setPdfFeedback(null), 4000);
    } catch (err: any) {
      setPdfFeedback(err?.message || 'Failed to download PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSubmitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckinSubmitting(true);
    setCheckinFeedback(null);
    try {
      const created = await api.submitCheckin(patient.id, {
        dyspneaScore,
        dizziness,
        feverChills,
        fatigueScore,
        notes: checkinNotes
      });
      setCheckins((prev) => [created, ...prev]);
      setCheckinNotes('');
      setCheckinFeedback('Daily symptom check-in saved and shared with Dr. Evelyn Vance.');
      setTimeout(() => setCheckinFeedback(null), 4000);
    } catch (err: any) {
      setCheckinFeedback(err?.message || 'Unable to submit symptom check-in.');
    } finally {
      setCheckinSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto">
      {/* Patient Welcome & Monitoring Status Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={getPatientAvatar(patient.id, patient.avatarUrl)}
              alt={patient.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-teal-500 shadow-xs"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{patient.name}</h1>
                <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                  {patient.id}
                </span>
                <StatusBadge type="alert" value={patient.currentAlertCategory} size="sm" />
                {isScale2 && (
                  <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    SpO2 Scale 2 (88–92% Target)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Discharged on {patient.dischargeDate} • Primary Condition: {patient.primaryDiagnosis}
              </p>
            </div>
          </div>

          {/* Quick Actions: Report Download + Sign Out */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
                aria-label="Report monitoring period"
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {downloadingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download My Report</span>
              </button>
            </div>

            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {pdfFeedback && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-xs font-medium">
            {pdfFeedback}
          </div>
        )}

        {/* Monitoring Status & Personalized Explanation Banner */}
        <div
          className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
            patient.currentAlertCategory === 'URGENT'
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : patient.currentAlertCategory === 'REVIEW'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : patient.currentAlertCategory === 'WATCH'
              ? 'bg-teal-50 border-teal-200 text-teal-950'
              : patient.currentAlertCategory === 'OFFLINE'
              ? 'bg-slate-100 border-slate-300 text-slate-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          {patient.currentAlertCategory === 'URGENT' ? (
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          ) : patient.currentAlertCategory === 'REVIEW' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          ) : patient.currentAlertCategory === 'OFFLINE' ? (
            <AlertTriangle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          )}

          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-0.5 flex items-center gap-2">
              <span>Current Recovery Monitoring Status: {patient.currentAlertCategory}</span>
              <span className="text-[11px] font-normal opacity-80">• Updated {patient.latestVitals.timestamp}</span>
            </div>
            <p className="text-xs leading-relaxed font-medium">{getStatusExplanation()}</p>
          </div>
        </div>
      </div>

      {/* TOP SECTION: Personal Profile, Assigned Doctor & Emergency Contacts (Visible Immediately Without Scrolling) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Personal Medical Information & Assigned Doctor */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Personal Information, Medical Profile & Assigned Doctor
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-500 block text-[11px]">Patient Name:</span>
                <span className="font-bold text-slate-900">{patient.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Patient ID:</span>
                <span className="font-mono font-bold text-slate-900">{patient.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Personal Contact:</span>
                <a
                  href={formatTelLink(patient.patientPhone)}
                  className="font-mono font-bold text-teal-700 hover:underline"
                >
                  {patient.patientPhone}
                </a>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Age & Gender:</span>
                <span className="font-medium text-slate-800">
                  {patient.age} years • {patient.gender}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Discharge Date:</span>
                <span className="font-medium text-slate-800">{patient.dischargeDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Monitoring Scale:</span>
                <span className="font-semibold text-slate-800">
                  {isScale2 ? 'Scale 2 (88–92%)' : 'Scale 1 (96–100%)'}
                </span>
              </div>
            </div>

            {/* Assigned Doctor Contact Box */}
            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                    EV
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                      Assigned Attending Physician
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{patient.assignedDoctor}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold bg-teal-100 text-teal-900 px-2 py-0.5 rounded-full border border-teal-300">
                  {patient.assignedDoctorContact.role}
                </span>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-teal-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Clinic:</span>
                  <span>{patient.assignedDoctorContact.clinic}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <a
                    href={formatTelLink(patient.assignedDoctorContact.phone)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Dr. Vance ({patient.assignedDoctorContact.phone})</span>
                  </a>
                  <a
                    href={`mailto:${patient.assignedDoctorContact.email}`}
                    className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-medium underline text-xs"
                  >
                    <span>{patient.assignedDoctorContact.email}</span>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <span className="font-semibold text-slate-800 block mb-1">Medical Conditions:</span>
              <div className="flex flex-wrap gap-1.5">
                {patient.medicalConditions.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] border border-slate-200">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="font-semibold text-slate-800 block mb-1">Prescribed Medications:</span>
              <ul className="space-y-1 text-slate-600 text-[11px] list-disc list-inside">
                {patient.medications.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Emergency Contacts Card with Full Add/Edit/Delete CRUD + Click-to-Call */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Designated Emergency Contacts
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  1-Tap Dialer Ready
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setContactError(null);
                    setContactSuccess(null);
                    setIsAddingContact((v) => !v);
                    setEditingContactId(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingContact ? 'Close Form' : 'Add Contact'}</span>
                </button>
              </div>
            </div>

            {contactError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{contactError}</span>
              </div>
            )}

            {contactSuccess && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{contactSuccess}</span>
              </div>
            )}

            {isAddingContact && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (contactSaving) return;
                  setContactError(null);
                  setContactSuccess(null);
                  if (newContactName.trim().length < 2 || newContactRelationship.trim().length < 2) {
                    setContactError('Contact name and relationship must be at least 2 characters.');
                    return;
                  }
                  const phoneCheck = validatePhoneInput(newContactPhone);
                  if (!phoneCheck.valid) {
                    setContactError(phoneCheck.error || 'Invalid phone number.');
                    return;
                  }
                  setContactSaving(true);
                  try {
                    await addEmergencyContact(patient.id, {
                      name: newContactName.trim(),
                      relationship: newContactRelationship.trim(),
                      phone: newContactPhone.trim()
                    });
                    setNewContactName('');
                    setNewContactRelationship('');
                    setNewContactPhone('');
                    setIsAddingContact(false);
                    setContactSuccess('New emergency contact saved to your care profile.');
                    setTimeout(() => setContactSuccess(null), 4000);
                  } catch (err: any) {
                    setContactError(err?.message || 'Unable to add emergency contact.');
                  } finally {
                    setContactSaving(false);
                  }
                }}
                className="mb-3 p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 text-xs space-y-2.5"
              >
                <div className="font-bold text-teal-900 text-[11px] uppercase tracking-wider">
                  Add New Emergency Contact
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                    Contact Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Relationship <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newContactRelationship}
                      onChange={(e) => setNewContactRelationship(e.target.value)}
                      placeholder="e.g. Sister / Neighbor"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="+1 555 234 5678"
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingContact(false);
                      setContactError(null);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={contactSaving}
                    className="px-3 py-1 rounded bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 disabled:opacity-60 shadow-xs"
                  >
                    {contactSaving ? 'Saving...' : 'Save Contact'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {(() => {
                const contactList: EmergencyContact[] =
                  patient.emergencyContacts && patient.emergencyContacts.length > 0
                    ? patient.emergencyContacts
                    : [
                        { ...patient.primaryEmergencyContact, contactType: 'PRIMARY' },
                        ...(patient.alternativeEmergencyContact?.phone
                          ? [{ ...patient.alternativeEmergencyContact, contactType: 'ALTERNATE' as const }]
                          : [])
                      ];

                return contactList.map((contact, idx) => {
                  const isPrimary = contact.contactType === 'PRIMARY' || idx === 0;
                  const cId = contact.id || `${contact.contactType || 'ALT'}-${idx}`;
                  const isEditingThis = editingContactId === cId;
                  const whatsappAlert = buildVerifiedPatientWhatsAppAlert({
                    expectedPatientId: loggedInPatientId,
                    patient,
                    patientRegistry: patients,
                    contact,
                    observations: patientObservations
                  });

                  return (
                    <div
                      key={cId}
                      className={`p-4 rounded-xl border text-xs shadow-xs ${
                        isPrimary ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isPrimary
                              ? 'text-rose-800 bg-rose-100'
                              : contact.contactType === 'ALTERNATE'
                              ? 'text-slate-700 bg-slate-200'
                              : 'text-sky-800 bg-sky-100'
                          }`}
                        >
                          {isPrimary
                            ? 'Primary Emergency Contact'
                            : contact.contactType === 'ALTERNATE'
                            ? 'Alternative Emergency Contact'
                            : 'Additional Emergency Contact'}
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {contact.id && !isEditingThis && (
                            <button
                              type="button"
                              onClick={() => {
                                setContactError(null);
                                setContactSuccess(null);
                                setIsAddingContact(false);
                                setConfirmDeleteId(null);
                                setEditName(contact.name);
                                setEditRelationship(contact.relationship);
                                setEditPhone(contact.phone);
                                setEditingContactId(cId);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-[11px] transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {!isPrimary && contact.id && !isEditingThis && (
                            confirmDeleteId === cId ? (
                              <div className="inline-flex items-center gap-1 bg-rose-100 border border-rose-300 rounded px-1.5 py-0.5">
                                <span className="text-[10px] font-semibold text-rose-800">Delete?</span>
                                <button
                                  type="button"
                                  disabled={deletingContactId === cId}
                                  onClick={async () => {
                                    setContactError(null);
                                    setContactSuccess(null);
                                    setDeletingContactId(cId);
                                    try {
                                      await deleteEmergencyContact(patient.id, contact.id!);
                                      setConfirmDeleteId(null);
                                      setContactSuccess(`Removed ${contact.name} from emergency contacts.`);
                                      setTimeout(() => setContactSuccess(null), 4000);
                                    } catch (err: any) {
                                      setContactError(err?.message || 'Unable to delete contact.');
                                    } finally {
                                      setDeletingContactId(null);
                                    }
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] hover:bg-rose-700"
                                >
                                  {deletingContactId === cId ? '...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 rounded bg-white text-slate-700 font-semibold text-[10px] border border-slate-300"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setContactError(null);
                                  setConfirmDeleteId(cId);
                                }}
                                aria-label={`Delete ${contact.name}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold text-[11px] transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            )
                          )}

                          <a
                            href={formatTelLink(contact.phone)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-[11px] transition-colors shadow-xs active:scale-95 ${
                              isPrimary
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-white'
                            }`}
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call {isPrimary ? contact.phone : ''}</span>
                          </a>

                          <a
                            href={whatsappAlert.valid ? whatsappAlert.whatsappUrl : '#'}
                            target={whatsappAlert.valid ? '_blank' : undefined}
                            rel={whatsappAlert.valid ? 'noopener noreferrer' : undefined}
                            onClick={(e) => {
                              const freshAlert = buildVerifiedPatientWhatsAppAlert({
                                expectedPatientId: loggedInPatientId,
                                patient,
                                patientRegistry: patients,
                                contact,
                                observations: patientObservations
                              });
                              if (!freshAlert.valid) {
                                e.preventDefault();
                                setContactSuccess(null);
                                setContactError(
                                  freshAlert.error ||
                                    'Unable to generate verified patient WhatsApp emergency alert.'
                                );
                                return;
                              }
                              setContactError(null);
                            }}
                            title={
                              whatsappAlert.valid
                                ? `Open WhatsApp alert for ${patient.name} (${patient.id}) to ${contact.name} (+${whatsappAlert.recipientPhone})`
                                : whatsappAlert.error
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px] transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>

                      {isEditingThis && contact.id ? (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (contactSaving) return;
                            setContactError(null);
                            setContactSuccess(null);
                            if (editName.trim().length < 2 || editRelationship.trim().length < 2) {
                              setContactError('Contact name and relationship must be at least 2 characters.');
                              return;
                            }
                            const phoneCheck = validatePhoneInput(editPhone);
                            if (!phoneCheck.valid) {
                              setContactError(phoneCheck.error || 'Invalid phone number.');
                              return;
                            }
                            setContactSaving(true);
                            try {
                              await updateEmergencyContact(patient.id, contact.id!, {
                                name: editName.trim(),
                                relationship: editRelationship.trim(),
                                phone: editPhone.trim()
                              });
                              setEditingContactId(null);
                              setContactSuccess(`Updated emergency contact ${editName.trim()}.`);
                              setTimeout(() => setContactSuccess(null), 4000);
                            } catch (err: any) {
                              setContactError(err?.message || 'Unable to update emergency contact.');
                            } finally {
                              setContactSaving(false);
                            }
                          }}
                          className="space-y-2 mt-2 pt-2 border-t border-slate-200"
                        >
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Contact Name:</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              required
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Relationship:</label>
                              <input
                                type="text"
                                value={editRelationship}
                                onChange={(e) => setEditRelationship(e.target.value)}
                                required
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Phone Number:</label>
                              <input
                                type="tel"
                                value={editPhone}
                                onChange={(e) => setEditPhone(e.target.value)}
                                required
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContactId(null);
                                setContactError(null);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={contactSaving}
                              className="px-3 py-1 rounded bg-teal-600 text-white font-semibold text-xs hover:bg-teal-700 disabled:opacity-60 shadow-xs"
                            >
                              {contactSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="font-bold text-slate-900 text-sm">{contact.name}</div>
                          <div className="text-slate-700 text-xs mt-1">
                            Relationship: <strong>{contact.relationship}</strong>
                          </div>
                          <div
                            className={`mt-2 pt-2 border-t flex items-center justify-between ${
                              isPrimary ? 'border-rose-200/70' : 'border-slate-200'
                            }`}
                          >
                            <div
                              className={`flex items-center gap-1.5 font-mono font-bold text-xs ${
                                isPrimary ? 'text-rose-900' : 'text-slate-800'
                              }`}
                            >
                              <Phone className={`w-3.5 h-3.5 ${isPrimary ? 'text-rose-600' : 'text-slate-600'}`} />
                              <a href={formatTelLink(contact.phone)} className="hover:underline">
                                {contact.phone}
                              </a>
                            </div>
                            <span className={`text-[10px] font-medium ${isPrimary ? 'text-rose-700' : 'text-slate-500'}`}>
                              {isPrimary ? 'Primary WhatsApp & Dialer Hotline' : 'Emergency WhatsApp & Dialer Ready'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="mt-4 p-3 bg-teal-50 rounded-lg border border-teal-200 text-[11px] text-teal-900 flex flex-wrap items-center justify-between gap-2">
            <span>Call buttons open your device dialer (tel:); emergency alerts prepare prefilled WhatsApp messages for guardians.</span>
            <a
              href={formatTelLink(patient.assignedDoctorContact.phone)}
              className="font-bold text-teal-700 hover:underline flex items-center gap-1"
            >
              <Phone className="w-3 h-3" />
              <span>Call Dr. Vance ({patient.assignedDoctorContact.phone})</span>
            </a>
          </div>
        </div>
      </div>

      {/* 4 Prominent Vital Signs Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Heart Rate */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-500" /> Heart Rate (Pulse)
            </span>
            <span className="text-[11px] font-mono text-slate-500">Prev: {hrPrev} bpm</span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-extrabold font-mono ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
                {isDetached ? '---' : patient.latestVitals.heartRate}
              </span>
              <span className="text-xs text-slate-500 font-medium">bpm</span>
            </div>

            <div
              className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                hrDelta > 5
                  ? 'bg-rose-50 text-rose-700'
                  : hrDelta < -5
                  ? 'bg-sky-50 text-sky-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {hrDelta > 0 ? (
                <TrendingUp className="w-3 h-3 text-rose-500" />
              ) : hrDelta < 0 ? (
                <TrendingDown className="w-3 h-3 text-sky-500" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              <span>{hrDelta > 0 ? `+${hrDelta}` : hrDelta} vs prev</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {patient.latestVitals.timestamp}
            </span>
            <span className="font-medium text-emerald-700">
              Signal: {isDetached ? 'Detached' : 'Good Quality'}
            </span>
          </div>
        </div>

        {/* 2. Oxygen Saturation (SpO2) */}
        <div
          className={`rounded-xl border p-4 shadow-xs ${
            isScale2 ? 'bg-amber-50/20 border-amber-300' : 'bg-white border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-600" /> Blood Oxygen (SpO2)
            </span>
            <span className="text-[11px] font-mono text-slate-500">Prev: {spo2Prev}%</span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1">
              <span
                className={`text-3xl font-extrabold font-mono ${
                  isDetached
                    ? 'text-slate-400'
                    : isScale2 && patient.latestVitals.spo2 >= 88 && patient.latestVitals.spo2 <= 92
                    ? 'text-emerald-700'
                    : patient.latestVitals.spo2 < 90
                    ? 'text-rose-600'
                    : 'text-slate-900'
                }`}
              >
                {isDetached ? '---' : `${patient.latestVitals.spo2}%`}
              </span>
            </div>

            <div
              className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                isScale2
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : spo2Delta < -2
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {spo2Delta < 0 ? <TrendingDown className="w-3 h-3 text-rose-500" /> : <Minus className="w-3 h-3" />}
              <span>
                Target: {patient.targetSpo2Range[0]}–{patient.targetSpo2Range[1]}%
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{isScale2 ? 'Personalized Scale 2' : 'Standard Scale 1'}</span>
            <span className="font-medium text-teal-700">Optical Pulse-Ox</span>
          </div>
        </div>

        {/* 3. Respiratory Rate */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-sky-500" /> Respiration Rate
            </span>
            <span className="text-[11px] font-mono text-slate-500">Prev: {rrPrev} /min</span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-extrabold font-mono ${isDetached ? 'text-slate-400' : 'text-slate-900'}`}>
                {isDetached ? '---' : patient.latestVitals.respiratoryRate}
              </span>
              <span className="text-xs text-slate-500 font-medium">/min</span>
            </div>

            <div
              className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                rrDelta > 3 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {rrDelta > 0 ? <TrendingUp className="w-3 h-3 text-rose-500" /> : <Minus className="w-3 h-3" />}
              <span>{rrDelta > 0 ? `+${rrDelta}` : rrDelta} /min</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Target: 12–20 breaths/min</span>
            <span className="font-medium text-sky-700">Impedance Band</span>
          </div>
        </div>

        {/* 4. Body Temperature */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-500" /> Skin Temperature
            </span>
            <span className="text-[11px] font-mono text-slate-500">Prev: {tempPrev}°C</span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold font-mono text-slate-900">
                {patient.latestVitals.temperature}°
              </span>
              <span className="text-xs text-slate-500 font-medium">C</span>
            </div>

            <div
              className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                tempDelta > 0.6 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {tempDelta > 0 ? <TrendingUp className="w-3 h-3 text-amber-600" /> : <Minus className="w-3 h-3" />}
              <span>{tempDelta > 0 ? `+${tempDelta}` : tempDelta}°C</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Normal: 36.1–37.5°C</span>
            <span className="font-medium text-amber-700">Virtual Wearable</span>
          </div>
        </div>
      </div>

      {/* Dataset-Based Waveforms Section (BIDMC PPG & Respiration) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              Live Continuous Waveforms (BIDMC Dataset Telemetry)
            </h2>
            <p className="text-xs text-slate-500">
              Photoplethysmogram (PPG) optical arterial pulse waveform and thoracic respiratory impedance signals.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
            Real-time Sample: 125 Hz
          </span>
        </div>

        <PPGWaveform
          heartRate={patient.latestVitals.heartRate}
          spo2={patient.latestVitals.spo2}
          respiratoryRate={patient.latestVitals.respiratoryRate}
          patientName={patient.name}
          sensorQuality={patient.latestVitals.sensorQuality}
          samplingRate={125}
          showControls={true}
        />

        <RespiratoryWaveform
          respiratoryRate={patient.latestVitals.respiratoryRate}
          patientName={patient.name}
          sensorQuality={patient.latestVitals.sensorQuality}
        />
      </div>

      {/* Longitudinal 24h Vitals Trend Charts (All 4 Vital Rates) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">
          24-Hour Recovery Vital Trends for {patient.name}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VitalChart
            title="Blood Oxygen Saturation (SpO2 %)"
            data={patientObservations}
            dataKey="spo2"
            unit="%"
            strokeColor="#0d9488"
            baselineValue={patient.baseline.spo2}
            spo2Scale={patient.spo2Scale}
            normalRange={patient.targetSpo2Range}
            height={180}
          />

          <VitalChart
            title="Heart Rate (bpm)"
            data={patientObservations}
            dataKey="heartRate"
            unit="bpm"
            strokeColor="#ef4444"
            baselineValue={patient.baseline.heartRate}
            height={180}
          />

          <VitalChart
            title="Respiratory Rate (breaths/min)"
            data={patientObservations}
            dataKey="respiratoryRate"
            unit="/min"
            strokeColor="#0284c7"
            baselineValue={patient.baseline.respiratoryRate}
            height={180}
          />

          <VitalChart
            title="Body Temperature (°C) [Virtual Simulator]"
            data={patientObservations}
            dataKey="temperature"
            unit="°C"
            strokeColor="#d97706"
            baselineValue={patient.baseline.temperature}
            height={180}
          />
        </div>
      </div>

      {/* Daily Symptom Check-In & WhatsApp Emergency Alert History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Symptom Check-In */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Daily Post-Discharge Symptom Check-In
              </h3>
            </div>
            <span className="text-[10px] font-semibold bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200">
              Synced to Care Team
            </span>
          </div>

          <form onSubmit={handleSubmitCheckin} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Shortness of Breath (0–10): <strong>{dyspneaScore}</strong>
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={dyspneaScore}
                  onChange={(e) => setDyspneaScore(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Fatigue Level (0–10): <strong>{fatigueScore}</strong>
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={fatigueScore}
                  onChange={(e) => setFatigueScore(Number(e.target.value))}
                  className="w-full accent-teal-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={dizziness}
                  onChange={(e) => setDizziness(e.target.checked)}
                  className="accent-teal-600 rounded"
                />
                <span>Dizziness / Lightheadedness</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={feverChills}
                  onChange={(e) => setFeverChills(e.target.checked)}
                  className="accent-teal-600 rounded"
                />
                <span>Fever or Chills</span>
              </label>
            </div>

            <div>
              <textarea
                rows={2}
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
                placeholder="Optional recovery notes for Dr. Evelyn Vance..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              {checkinFeedback ? (
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {checkinFeedback}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">
                  {checkins.length} recent check-in(s) logged
                </span>
              )}
              <button
                type="submit"
                disabled={checkinSubmitting}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-xs transition-colors"
              >
                {checkinSubmitting ? 'Submitting...' : 'Submit Check-In'}
              </button>
            </div>
          </form>
        </div>

        {/* WHATSAPP EMERGENCY ALERT HISTORY (Scoped to Logged-in Patient) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                WHATSAPP EMERGENCY ALERT HISTORY
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              {patientNotifications.length} Record(s)
            </span>
          </div>

          {patientNotifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No WhatsApp emergency alerts have been prepared for your account.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
              {patientNotifications.map((n) => {
                const statusLabel = n.deliveryStatus;
                const badgeClass =
                  n.deliveryStatus === 'USER CONFIRMED SENT'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : n.deliveryStatus === 'OPENED'
                    ? 'bg-sky-100 text-sky-900 border border-sky-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200';
                return (
                  <div key={n.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            n.isTest || n.alertType === 'TEST_ALERT'
                              ? 'bg-sky-100 text-sky-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {n.isTest || n.alertType === 'TEST_ALERT' ? 'TEST ALERT' : 'REAL EMERGENCY ALERT'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {n.recipientType}: {n.recipientName} ({n.recipientPhone})
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {n.abnormalParameter && (
                      <div className="text-[11px] text-slate-800 font-medium bg-white px-2 py-1 rounded border border-slate-200 flex flex-wrap gap-3">
                        <span>Abnormal Vital: <strong>{n.abnormalParameter}</strong></span>
                        {n.baselineValue && <span>Baseline: <strong>{n.baselineValue}</strong></span>}
                        {n.currentValue && <span>Current: <strong>{n.currentValue}</strong></span>}
                        {n.deviationValue && <span className="text-rose-700">Deviation: <strong>{n.deviationValue}</strong></span>}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-700 leading-snug whitespace-pre-line">{n.messageText}</p>
                    {n.errorReason && (
                      <div className="text-[11px] text-rose-700 font-semibold">{n.errorReason}</div>
                    )}
                    <div className="text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span>{n.patientName || patient.name} ({n.patientId}) • {n.createdAt}</span>
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
                            <CheckCircle2 className="w-3 h-3" />
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
    </div>
  );
};
