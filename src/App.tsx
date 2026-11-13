/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp, NavPage } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AlertExplanationModal } from './components/AlertExplanationModal';
import { MedicalDisclaimerBanner } from './components/MedicalDisclaimerBanner';
import { AuthLanding } from './components/AuthLanding';

// Pages
import { Dashboard } from './pages/Dashboard';
import { PatientDirectory } from './pages/PatientDirectory';
import { PatientMonitoring } from './pages/PatientMonitoring';
import { PatientDashboard } from './pages/PatientDashboard';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { AlertManagement } from './pages/AlertManagement';
import { SensorQuality } from './pages/SensorQuality';
import { PerformanceAnalytics } from './pages/PerformanceAnalytics';
import { Settings } from './pages/Settings';

const AppContent: React.FC = () => {
  const {
    currentUser,
    authLoading,
    currentPage,
    selectedAlertForExplanation,
    setSelectedAlertForExplanation,
    acknowledgeAlert
  } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex items-center justify-center text-teal-300 text-xs font-mono">
        Verifying VITALYNX clinical session...
      </div>
    );
  }

  // MANDATORY AUTHENTICATION GUARD:
  // If user is not authenticated, show the Doctor/Patient Landing & Login interface
  if (!currentUser) {
    return <AuthLanding />;
  }

  // PATIENT ROLE WORKSPACE
  if (currentUser.role === 'PATIENT') {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex flex-col text-slate-800">
        <Header pageTitle="Patient Health & Remote Monitoring Portal" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <PatientDashboard />
        </main>
        <MedicalDisclaimerBanner isProminent={false} />
      </div>
    );
  }

  // DOCTOR / CLINICIAN WORKSPACE
  const getPageTitle = (page: NavPage): string => {
    switch (page) {
      case 'dashboard':
        return 'Surveillance Command Center';
      case 'patients':
        return 'Post-Discharge Patient Directory';
      case 'patient-monitoring':
        return 'Individual Patient Telemetry & Trend Analysis';
      case 'live':
        return 'Multi-Patient Live Telemetry Surveillance Wall';
      case 'alerts':
        return 'Clinical Alert Triage & Incident Registry';
      case 'sensor-quality':
        return 'Sensor Signal Quality & Artifact Classification';
      case 'analytics':
        return 'Performance Analytics & False Alert Reduction';
      case 'settings':
        return 'System Configuration & Safety Governance';
      default:
        return 'Clinical Surveillance Command';
    }
  };

  const renderActivePage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'patients':
        return <PatientDirectory />;
      case 'patient-monitoring':
        return <PatientMonitoring />;
      case 'live':
        return <LiveMonitoring />;
      case 'alerts':
        return <AlertManagement />;
      case 'sensor-quality':
        return <SensorQuality />;
      case 'analytics':
        return <PerformanceAnalytics />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex flex-col text-slate-800">
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Workspace Area (Offset by Sidebar on lg screens) */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300">
        {/* Soft Pale Pink Top Header */}
        <Header pageTitle={getPageTitle(currentPage)} />

        {/* Dynamic Page Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1720px] w-full mx-auto">
          {renderActivePage()}
        </main>

        {/* Permanently Visible Medical Safety Disclaimer Footer */}
        <MedicalDisclaimerBanner isProminent={false} />
      </div>

      {/* Decision-Support Clinical Explanation Modal */}
      {selectedAlertForExplanation && (
        <AlertExplanationModal
          alert={selectedAlertForExplanation}
          onClose={() => setSelectedAlertForExplanation(null)}
          onAcknowledge={(alertId) => acknowledgeAlert(alertId)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
