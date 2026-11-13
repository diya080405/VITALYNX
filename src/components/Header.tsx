import React, { useState, useEffect } from 'react';
import { useApp, NavPage } from '../context/AppContext';
import { getPatientAvatar, DOCTOR_AVATAR } from '../utils/patientAssets';
import {
  Bell,
  Search,
  Clock,
  Calendar,
  AlertTriangle,
  AlertOctagon,
  WifiOff,
  User,
  Activity,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  ExternalLink,
  LogOut
} from 'lucide-react';

interface HeaderProps {
  pageTitle: string;
}

export const Header: React.FC<HeaderProps> = ({ pageTitle }) => {
  const {
    alerts,
    searchQuery,
    setSearchQuery,
    isNotificationOpen,
    setIsNotificationOpen,
    navigateToAlertsWithFilter,
    navigateToPatient,
    setCurrentPage,
    currentUser,
    logout
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      );
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');
  const urgentCount = activeAlerts.filter((a) => a.alertLevel === 'URGENT');
  const reviewCount = activeAlerts.filter((a) => a.alertLevel === 'REVIEW');
  const watchCount = activeAlerts.filter((a) => a.alertLevel === 'WATCH');

  return (
    <header className="sticky top-0 z-40 bg-[#FAF1F3] border-b border-[#F2D7DE] shadow-xs">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Mobile Brand & Page Title */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {pageTitle}
              </h1>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
             Continuous Clinical Surveillance
            </p>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patients, conditions, alerts, or vitals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/90 border border-[#ECCCD4] rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right: Date/Time, Notifications, User Profile */}
        <div className="flex items-center gap-4">
          {/* Live Date / Time Clock */}
          <div className="hidden lg:flex items-center gap-3 text-xs bg-white/70 border border-[#ECCCD4] px-3 py-1.5 rounded-lg shadow-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>{currentDate}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5 text-slate-800 font-mono font-semibold">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>{currentTime}</span>
            </div>
          </div>

          {/* Notification Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2 rounded-lg bg-white border border-[#ECCCD4] text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
              title="Clinical Alerts & Device Warnings"
            >
              <Bell className="w-4 h-4" />
              {activeAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                  {activeAlerts.length}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {isNotificationOpen && (
              <div className="absolute right-0 top-11 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden text-left animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">Surveillance Alerts</span>
                    <span className="text-[11px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                      {activeAlerts.length} Active
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setIsNotificationOpen(false);
                      setCurrentPage('alerts');
                    }}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    View All
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {activeAlerts.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      All post-discharge telemetry is currently stable.
                    </div>
                  ) : (
                    activeAlerts.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          setIsNotificationOpen(false);
                          navigateToPatient(a.patientId);
                        }}
                        className="p-3 hover:bg-slate-50 cursor-pointer transition-colors text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              a.alertLevel === 'URGENT'
                                ? 'bg-rose-100 text-rose-700'
                                : a.alertLevel === 'REVIEW'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {a.alertLevel}
                          </span>
                          <span className="text-[10px] text-slate-400">{a.timestamp}</span>
                        </div>
                        <div className="font-bold text-slate-900">{a.patientName} ({a.patientId})</div>
                        <div className="text-slate-600 text-[11px] mt-0.5 line-clamp-1">{a.vitalSignReading}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setIsNotificationOpen(false);
                      setCurrentPage('sensor-quality');
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Review Sensor Quality & Artifact Logs →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Portal Switch */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-[#ECCCD4]">
            <img
              src={
                currentUser?.role === 'PATIENT'
                  ? getPatientAvatar(currentUser?.patientId)
                  : DOCTOR_AVATAR
              }
              alt={currentUser?.name || 'User'}
              className="w-8 h-8 rounded-full object-cover border border-[#ECCCD4] shadow-xs"
            />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.name || 'Dr. Evelyn Vance'}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {currentUser?.role === 'PATIENT'
                  ? `Patient ID: ${currentUser?.patientId || 'PT-8021'}`
                  : (currentUser?.doctorTitle || 'Clinical Administrator')}
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out to Portal Selection"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
