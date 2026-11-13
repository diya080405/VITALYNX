import React, { useState } from 'react';
import { useApp, NavPage } from '../context/AppContext';
import {
  LayoutDashboard,
  Users,
  Activity,
  AlertTriangle,
  Radio,
  BarChart3,
  Settings,
  UserCircle,
  HelpCircle,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Sparkles
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentPage, setCurrentPage, alerts, sensorEvents, logout, currentUser } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const artifactCount = sensorEvents.filter((s) => s.qualityState !== 'VALID').length;

  const navItems: { id: NavPage; label: string; icon: React.ElementType; badge?: string | number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patient Directory', icon: Users },
    { id: 'live', label: 'Live Monitoring', icon: Activity },
    {
      id: 'alerts',
      label: 'Alert Management',
      icon: AlertTriangle,
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'sensor-quality',
      label: 'Sensor Quality',
      icon: Radio,
      badge: artifactCount > 0 ? `${artifactCount} flagged` : undefined,
      badgeColor: 'bg-amber-500 text-slate-900'
    },
    { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const handleNavClick = (page: NavPage) => {
    setCurrentPage(page);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Hamburger Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-4 right-4 z-50 lg:hidden p-3 rounded-full bg-slate-900 text-white shadow-xl border border-slate-700"
        aria-label="Toggle Navigation"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0D1527] text-slate-300 flex flex-col border-r border-slate-800/80 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-3">
            {/* VITALYNX Logo: Medical Pulse + Connected Node */}
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-teal-900/30">
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
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-wider text-white">
                  VITALYNX
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold">

                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                Intelligent Post-Discharge Monitoring
              </p>
            </div>
          </div>
        </div>

        {/* Tagline Ribbon */}
        <div className="px-5 py-2 bg-slate-900/70 border-b border-slate-800/60 text-[10px] text-teal-400 font-mono tracking-wide">
          Monitor continuously • Detect early • Reduce false alerts
        </div>

        {/* Main Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Surveillance Command
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id || (item.id === 'patients' && currentPage === 'patient-monitoring');

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 group text-left ${
                  isActive
                    ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.badgeColor || 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Utility Items */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/50 space-y-1 text-xs">
          <button
            onClick={() => handleNavClick('settings')}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <UserCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Account Settings</span>
          </button>

          <button
            onClick={() => handleNavClick('settings')}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Help and Support</span>
          </button>

          <div className="px-3 py-2 my-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-300 font-medium">System Status</span>
            </div>
            <span className="text-emerald-400 font-mono text-[10px]">ALL NORMAL</span>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out ({currentUser?.name?.split(' ')[0] || 'Clinician'})</span>
            </div>
            <span className="text-[10px] text-slate-500">Exit</span>
          </button>
        </div>
      </aside>
    </>
  );
};
