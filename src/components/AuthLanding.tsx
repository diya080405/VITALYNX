import React, { useState } from 'react';
import { useApp, type AuthUser } from '../context/AppContext';
import {
  isValidEmail,
  isValidSyntheaPatientIdFormat,
  validatePhoneInput
} from '../utils/patientAssets';
import {
  Stethoscope,
  UserCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ChevronRight,
  HeartHandshake
} from 'lucide-react';

const DEMO_PATIENT_PILLS = [
  { id: 'PT-8021', label: 'PT-8021 (Marcus)' },
  { id: 'PT-8022', label: 'PT-8022 (Sarah)' },
  { id: 'PT-8023', label: 'PT-8023 (Robert)' },
  { id: 'PT-8024', label: 'PT-8024 (Elena)' },
  { id: 'PT-8025', label: 'PT-8025 (James)' },
  { id: 'PT-8026', label: 'PT-8026 (Dorothy)' }
];

export const AuthLanding: React.FC = () => {
  const {
    loginAsDoctor,
    loginAsPatient,
    registerDoctor,
    registerPatient,
    activateRegisteredPatientSession
  } = useApp();

  const [activePortal, setActivePortal] = useState<'CHOICE' | 'DOCTOR' | 'PATIENT'>('CHOICE');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [submitting, setSubmitting] = useState(false);

  // Doctor Form State
  const [doctorIdentifier, setDoctorIdentifier] = useState('dr.evelyn.vance@vitalynx.health');
  const [doctorPassword, setDoctorPassword] = useState('ClinicalAdmin#2026');
  const [doctorName, setDoctorName] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorRegPassword, setDoctorRegPassword] = useState('');
  const [doctorRegConfirmPassword, setDoctorRegConfirmPassword] = useState('');
  const [doctorRememberMe, setDoctorRememberMe] = useState(true);

  // Patient Form State
  const [patientIdInput, setPatientIdInput] = useState('PT-8021');
  const [patientPassword, setPatientPassword] = useState('Patient#8021');
  const [patientRememberMe, setPatientRememberMe] = useState(true);

  // Patient Registration Form State
  const [patientFullName, setPatientFullName] = useState('');
  const [patientRegId, setPatientRegId] = useState('PT-8021');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientRegPassword, setPatientRegPassword] = useState('');
  const [patientRegConfirmPassword, setPatientRegConfirmPassword] = useState('');

  // Primary Emergency Contact
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactRelation, setPrimaryContactRelation] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('9353802577');

  // Alternative Emergency Contact
  const [altContactName, setAltContactName] = useState('');
  const [altContactRelation, setAltContactRelation] = useState('');
  const [altContactPhone, setAltContactPhone] = useState('');

  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Feedback Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registeredPatientUser, setRegisteredPatientUser] = useState<AuthUser | null>(null);

  const clearFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Clear messages when switching
  const switchPortal = (portal: 'DOCTOR' | 'PATIENT') => {
    setActivePortal(portal);
    setAuthMode('LOGIN');
    clearFeedback();
    setRegisteredPatientUser(null);
  };

  const switchAuthMode = (mode: 'LOGIN' | 'REGISTER') => {
    setAuthMode(mode);
    clearFeedback();
    if (mode === 'LOGIN') {
      setRegisteredPatientUser(null);
    }
  };

  // Doctor Login Handler
  const handleDoctorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    clearFeedback();
    if (!doctorIdentifier.trim() || !doctorPassword.trim()) {
      setErrorMessage('Please enter both your Doctor Name/Email and Password.');
      return;
    }
    setSubmitting(true);
    try {
      await loginAsDoctor(doctorIdentifier.trim(), doctorPassword);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to sign in to Doctor Portal.');
    } finally {
      setSubmitting(false);
    }
  };

  // Doctor Registration Handler
  const handleDoctorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    clearFeedback();
    if (!doctorName.trim() || !doctorEmail.trim() || !doctorPhone.trim() || !doctorRegPassword) {
      setErrorMessage('All fields marked * are required.');
      return;
    }
    if (!isValidEmail(doctorEmail)) {
      setErrorMessage('Please enter a valid clinician email address.');
      return;
    }
    const phoneCheck = validatePhoneInput(doctorPhone);
    if (!phoneCheck.valid) {
      setErrorMessage(`Contact phone error: ${phoneCheck.error}`);
      return;
    }
    if (doctorRegPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (doctorRegPassword !== doctorRegConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await registerDoctor({
        name: doctorName.trim(),
        email: doctorEmail.trim(),
        phone: doctorPhone.trim(),
        password: doctorRegPassword
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to register clinician account.');
    } finally {
      setSubmitting(false);
    }
  };

  // Patient Login Handler
  const handlePatientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    clearFeedback();
    if (!patientIdInput.trim() || !patientPassword.trim()) {
      setErrorMessage('Please enter your Synthea Patient ID (or Email) and Password.');
      return;
    }
    const rawIdent = patientIdInput.trim();
    const cleanIdent = rawIdent.includes('@') ? rawIdent : rawIdent.toUpperCase();
    setSubmitting(true);
    try {
      await loginAsPatient(cleanIdent, patientPassword);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          `Sign in failed for "${cleanIdent}". Use your registered credentials or demo format (e.g. PT-8021 / Patient#8021).`
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Patient Registration Handler
  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    clearFeedback();
    setRegisteredPatientUser(null);

    if (
      !patientFullName.trim() ||
      !patientRegId.trim() ||
      !patientEmail.trim() ||
      !patientPhone.trim() ||
      !patientRegPassword ||
      !primaryContactName.trim() ||
      !primaryContactRelation.trim() ||
      !primaryContactPhone.trim() ||
      !altContactName.trim() ||
      !altContactRelation.trim() ||
      !altContactPhone.trim()
    ) {
      setErrorMessage('Please fill in all personal and emergency contact fields marked *.');
      return;
    }

    const cleanId = patientRegId.trim().toUpperCase();
    if (!isValidSyntheaPatientIdFormat(cleanId)) {
      setErrorMessage(
        `Invalid Synthea Patient ID "${cleanId}". Please enter an assigned hospital ID (PT-8021 to PT-8026).`
      );
      return;
    }

    if (!isValidEmail(patientEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. patient@example.com).');
      return;
    }

    const patientPhoneCheck = validatePhoneInput(patientPhone);
    if (!patientPhoneCheck.valid) {
      setErrorMessage(`Your Contact Phone: ${patientPhoneCheck.error}`);
      return;
    }

    if (patientRegPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (patientRegPassword !== patientRegConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    const primaryPhoneCheck = validatePhoneInput(primaryContactPhone);
    if (!primaryPhoneCheck.valid) {
      setErrorMessage(`Primary Emergency Contact Phone: ${primaryPhoneCheck.error}`);
      return;
    }

    const altPhoneCheck = validatePhoneInput(altContactPhone);
    if (!altPhoneCheck.valid) {
      setErrorMessage(`Alternative Emergency Contact Phone: ${altPhoneCheck.error}`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerPatient(
        {
          name: patientFullName.trim(),
          patientId: cleanId,
          email: patientEmail.trim(),
          phone: patientPhone.trim(),
          password: patientRegPassword,
          primaryContact: {
            name: primaryContactName.trim(),
            relationship: primaryContactRelation.trim(),
            phone: primaryContactPhone.trim()
          },
          alternativeContact: {
            name: altContactName.trim(),
            relationship: altContactRelation.trim(),
            phone: altContactPhone.trim()
          }
        },
        { stayOnConfirmation: true }
      );
      setRegisteredPatientUser(result.user);
      setSuccessMessage(result.message);
      setPatientIdInput(cleanId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to complete patient registration.');
    } finally {
      setSubmitting(false);
    }
  };

  // Google Sign-in SSO handler (authenticates against seeded clinical backend)
  const handleGoogleSignIn = async (role: 'DOCTOR' | 'PATIENT') => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      if (role === 'DOCTOR') {
        await loginAsDoctor('dr.evelyn.vance@vitalynx.health', 'ClinicalAdmin#2026');
      } else {
        await loginAsPatient('PT-8021', 'Patient#8021');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'SSO authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B132B] via-[#0D1527] to-[#1E293B] flex flex-col justify-between text-slate-100 p-4 sm:p-6 md:p-8 font-sans">
      {/* Top Brand Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <path d="M3 12h3l2-6 3 12 3-8 2 5h5" />
              <circle cx="18" cy="6" r="2.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-wider text-white">VITALYNX</div>
            <div className="text-xs text-teal-400 font-medium">
              Monitor continuously. Detect deterioration early.
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Clinical Telemetry Portal v1.0.4</span>
        </div>
      </header>

      {/* Main Authentication Flow Container */}
      <main className="max-w-4xl w-full mx-auto my-auto py-6">
        {/* VIEW 1: Portal Choice Landing */}
        {activePortal === 'CHOICE' && (
          <div className="space-y-8 text-center animate-in fade-in duration-200">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Post-Discharge Deterioration Surveillance
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Welcome to VITALYNX Health Portal
              </h1>
              <p className="text-slate-400 text-sm max-w-xl mx-auto mt-2 leading-relaxed">
                Continuous physiological tele-surveillance, personalized NEWS2 scoring, and intelligent sensor artifact reduction. Select your authorized portal to proceed:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
              {/* Doctor Portal Card */}
              <div
                onClick={() => switchPortal('DOCTOR')}
                className="group relative bg-slate-900/80 hover:bg-slate-850 rounded-2xl p-6 border border-slate-700/80 hover:border-teal-400 transition-all duration-200 cursor-pointer shadow-xl hover:shadow-teal-500/10 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-between">
                    <span>Doctor Portal</span>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    For clinicians and medical administrators to view the surveillance command center, live cohort telemetry, artifact logs, and clinical triage.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs font-semibold text-teal-400 flex items-center gap-1.5">
                  <span>Enter Clinician Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* Patient Portal Card */}
              <div
                onClick={() => switchPortal('PATIENT')}
                className="group relative bg-slate-900/80 hover:bg-slate-850 rounded-2xl p-6 border border-slate-700/80 hover:border-sky-400 transition-all duration-200 cursor-pointer shadow-xl hover:shadow-sky-500/10 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center justify-between">
                    <span>Patient Portal</span>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    For discharged patients and caregivers to view personal recovery vitals, PPG waveforms, monitoring status, and complete daily symptom checks.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                  <span>Enter Patient Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Doctor Portal Login & Registration */}
        {activePortal === 'DOCTOR' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 max-w-lg mx-auto animate-in fade-in duration-150 text-left">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/30">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Doctor Portal</h2>
                  <div className="text-xs text-slate-400">Clinical Surveillance Authentication</div>
                </div>
              </div>
              <button
                onClick={() => setActivePortal('CHOICE')}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
              >
                ← Switch Portal
              </button>
            </div>

            {/* Login / Register Toggle */}
            <div className="flex rounded-lg bg-slate-800 p-1 mb-5 border border-slate-700">
              <button
                onClick={() => switchAuthMode('LOGIN')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  authMode === 'LOGIN' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Doctor Sign In
              </button>
              <button
                onClick={() => switchAuthMode('REGISTER')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  authMode === 'REGISTER' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register New Doctor
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300 rounded-lg text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Form Mode: Doctor Login */}
            {authMode === 'LOGIN' ? (
              <form onSubmit={handleDoctorLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Doctor Name or Email Address <span className="text-teal-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={doctorIdentifier}
                      onChange={(e) => setDoctorIdentifier(e.target.value)}
                      placeholder="e.g. dr.evelyn.vance@vitalynx.health"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Password <span className="text-teal-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSuccessMessage('Password reset instructions simulated for Dr. Evelyn Vance (demo: ClinicalAdmin#2026).')
                      }
                      className="text-[11px] text-teal-400 hover:text-teal-300"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={doctorPassword}
                      onChange={(e) => setDoctorPassword(e.target.value)}
                      placeholder="Enter clinical credentials"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={doctorRememberMe}
                      onChange={(e) => setDoctorRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 accent-teal-500 rounded"
                    />
                    <span>Remember Me on this Workstation</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold text-xs transition-colors shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>{submitting ? 'Signing In...' : 'Log In to Clinical Dashboard'}</span>
                </button>

                {/* Google Sign-in Option */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500 font-semibold">Or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleGoogleSignIn('DOCTOR')}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-750 disabled:opacity-60 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.2 7.5 23 12 23z"
                    />
                  </svg>
                  <span>Sign in with Google Hospital SSO</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode('REGISTER')}
                    className="text-xs text-teal-400 hover:underline"
                  >
                    Need an authorized clinician account? Register here
                  </button>
                </div>
              </form>
            ) : (
              /* Form Mode: Doctor Registration */
              <form onSubmit={handleDoctorRegister} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Full Doctor Name <span className="text-teal-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. Arthur Pendelton, MD"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Email Address <span className="text-teal-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={doctorEmail}
                      onChange={(e) => setDoctorEmail(e.target.value)}
                      placeholder="doctor@hospital.org"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Contact Phone <span className="text-teal-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={doctorPhone}
                      onChange={(e) => setDoctorPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Password <span className="text-teal-400">*</span>
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={doctorRegPassword}
                      onChange={(e) => setDoctorRegPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Confirm Password <span className="text-teal-400">*</span>
                    </label>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={doctorRegConfirmPassword}
                      onChange={(e) => setDoctorRegConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-teal-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold text-xs transition-colors shadow-lg shadow-teal-700/20"
                >
                  {submitting ? 'Creating Account...' : 'Create Clinician Account'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode('LOGIN')}
                    className="text-xs text-teal-400 hover:underline"
                  >
                    Already have credentials? Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* VIEW 3: Patient Portal Login & Registration */}
        {activePortal === 'PATIENT' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 max-w-xl mx-auto animate-in fade-in duration-150 text-left">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Patient & Family Portal</h2>
                  <div className="text-xs text-slate-400">Post-Discharge Remote Monitoring</div>
                </div>
              </div>
              <button
                onClick={() => setActivePortal('CHOICE')}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors font-medium"
              >
                ← Switch Portal
              </button>
            </div>

            {/* Login / Register Toggle */}
            <div className="flex rounded-lg bg-slate-800 p-1 mb-5 border border-slate-700">
              <button
                onClick={() => switchAuthMode('LOGIN')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  authMode === 'LOGIN' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Patient Sign In
              </button>
              <button
                onClick={() => switchAuthMode('REGISTER')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  authMode === 'REGISTER' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Patient Registration
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300 rounded-lg text-xs flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs space-y-2.5 mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="font-semibold">{successMessage}</span>
                </div>
                {registeredPatientUser && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => activateRegisteredPatientSession(registeredPatientUser)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <span>Open My Patient Health Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPatientIdInput(registeredPatientUser.patientId || '');
                        setPatientPassword('');
                        switchAuthMode('LOGIN');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors"
                    >
                      Go to Patient Sign In
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Patient Login Form */}
            {authMode === 'LOGIN' ? (
              <form onSubmit={handlePatientLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Synthea Patient ID or Registered Email <span className="text-sky-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={patientIdInput}
                      onChange={(e) => {
                        clearFeedback();
                        setPatientIdInput(e.target.value);
                      }}
                      placeholder="e.g. PT-8021 or patient@example.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] text-slate-400">Quick fill demo patient:</span>
                    {DEMO_PATIENT_PILLS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPatientIdInput(p.id);
                          setPatientPassword(`Patient#${p.id.replace('PT-', '')}`);
                        }}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          patientIdInput === p.id
                            ? 'bg-sky-500/20 text-sky-300 border-sky-400'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Password <span className="text-sky-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSuccessMessage('Demo patient passwords correspond to Patient#<ID>, e.g. Patient#8021')
                      }
                      className="text-[11px] text-sky-400 hover:text-sky-300"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={patientPassword}
                      onChange={(e) => setPatientPassword(e.target.value)}
                      placeholder="Enter patient portal password"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={patientRememberMe}
                      onChange={(e) => setPatientRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 accent-sky-500 rounded"
                    />
                    <span>Remember My Patient ID</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold text-xs transition-colors shadow-lg shadow-sky-700/20 flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{submitting ? 'Signing In...' : 'Log In to My Patient Health Dashboard'}</span>
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500 font-semibold">Or</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleGoogleSignIn('PATIENT')}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-750 disabled:opacity-60 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.2 7.5 23 12 23z"
                    />
                  </svg>
                  <span>Sign in with Google Account</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode('REGISTER')}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    First-time user after hospital discharge? Sign Up Here
                  </button>
                </div>
              </form>
            ) : (
              /* Patient Registration Form with Mandatory Emergency Contacts */
              <form onSubmit={handlePatientRegister} className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
                <div className="text-xs text-slate-300 font-semibold bg-sky-500/10 p-2.5 rounded-lg border border-sky-500/20">
                  Register your account with your Synthea hospital discharge ID and designated emergency contacts.
                </div>

                {/* Section A: Patient Identification */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> 1. Patient Details
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Full Name <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={patientFullName}
                        onChange={(e) => setPatientFullName(e.target.value)}
                        placeholder="e.g. Marcus Chen"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Synthea Patient ID <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={patientRegId}
                        onChange={(e) => setPatientRegId(e.target.value)}
                        placeholder="e.g. PT-8021"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-sky-500"
                      />
                      <span className="text-[10px] text-slate-500">Valid demo IDs: PT-8021 to PT-8026</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Email Address <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="patient@example.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Contact Phone <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Password <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={patientRegPassword}
                        onChange={(e) => setPatientRegPassword(e.target.value)}
                        placeholder="Choose password"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Confirm Password <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={patientRegConfirmPassword}
                        onChange={(e) => setPatientRegConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Primary Emergency Contact */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartHandshake className="w-3.5 h-3.5" /> 2. Primary Emergency Contact
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Contact Person Name <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={primaryContactName}
                        onChange={(e) => setPrimaryContactName(e.target.value)}
                        placeholder="e.g. Linda Chen"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Relationship <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={primaryContactRelation}
                        onChange={(e) => setPrimaryContactRelation(e.target.value)}
                        placeholder="e.g. Spouse / Daughter"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Phone (Primary Hotline: 9353802577) <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={primaryContactPhone}
                        onChange={(e) => setPrimaryContactPhone(e.target.value)}
                        placeholder="9353802577"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section C: Alternative Emergency Contact */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartHandshake className="w-3.5 h-3.5" /> 3. Alternative Emergency Contact
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Contact Person Name <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={altContactName}
                        onChange={(e) => setAltContactName(e.target.value)}
                        placeholder="e.g. David Chen"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Relationship <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={altContactRelation}
                        onChange={(e) => setAltContactRelation(e.target.value)}
                        placeholder="e.g. Son / Brother"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Phone Number <span className="text-sky-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={altContactPhone}
                        onChange={(e) => setAltContactPhone(e.target.value)}
                        placeholder="+1 (555) 876-5432"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold text-xs transition-colors shadow-lg shadow-sky-700/20 mt-2"
                >
                  {submitting ? 'Completing Registration...' : 'Complete Registration & Save Account'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => switchAuthMode('LOGIN')}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    Already registered? Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Safety Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-400 py-3 border-t border-slate-800/80">
        <p>
          Clinical Decision Support Only – This system is not a medical diagnosis tool. All alerts and recommendations must be reviewed by qualified healthcare professionals.
        </p>
      </footer>
    </div>
  );
};
