import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Patient, PatientBaseline, AlertCategory, EmergencyContact } from '../types/patient';
import { ClinicalAlert, ClinicianAction } from '../types/alert';
import { SensorQualityEvent, SimulationScenarioId } from '../types/sensor';
import type { EmergencyNotification, ReportPeriod } from '../types/notification';
import { api, getAuthToken, setAuthToken, setOnUnauthorizedHandler } from '../services/api';
import { MOCK_CLINICIAN_ACTIONS } from '../data/mockAlerts';

export type UserRole = 'DOCTOR' | 'PATIENT' | null;

export interface AuthUser {
  id?: string;
  role: 'DOCTOR' | 'PATIENT';
  name: string;
  email?: string;
  patientId?: string;
  doctorId?: string;
  doctorTitle?: string;
}

export type NavPage =
  | 'dashboard'
  | 'patients'
  | 'patient-monitoring'
  | 'patient-dashboard'
  | 'live'
  | 'alerts'
  | 'sensor-quality'
  | 'analytics'
  | 'settings';

interface AppContextType {
  currentUser: AuthUser | null;
  authLoading: boolean;
  loginAsDoctor: (identifier: string, password?: string) => Promise<void>;
  loginAsPatient: (patientId: string, password?: string) => Promise<void>;
  registerDoctor: (details: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  registerPatient: (
    details: {
      name: string;
      patientId: string;
      email: string;
      phone: string;
      password: string;
      primaryContact: EmergencyContact;
      alternativeContact: EmergencyContact;
    },
    options?: { stayOnConfirmation?: boolean }
  ) => Promise<{ user: AuthUser; message: string }>;
  activateRegisteredPatientSession: (user: AuthUser) => Promise<void>;
  logout: () => void;

  currentPage: NavPage;
  setCurrentPage: (page: NavPage) => void;
  selectedPatientId: string;
  setSelectedPatientId: (id: string) => void;
  selectedPatient: Patient | undefined;
  patients: Patient[];
  alerts: ClinicalAlert[];
  notifications: EmergencyNotification[];
  clinicianActions: ClinicianAction[];
  sensorEvents: SensorQualityEvent[];
  activeAlertFilter: AlertCategory | 'ALL';
  setActiveAlertFilter: (filter: AlertCategory | 'ALL') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isNotificationOpen: boolean;
  setIsNotificationOpen: (open: boolean) => void;
  selectedAlertForExplanation: ClinicalAlert | null;
  setSelectedAlertForExplanation: (alert: ClinicalAlert | null) => void;
  wsConnected: boolean;

  // Actions
  navigateToPatient: (patientId: string) => void;
  navigateToAlertsWithFilter: (filter: AlertCategory) => void;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  toggleClinicianAction: (actionId: string) => void;
  updateAlternativeContact: (patientId: string, contact: EmergencyContact) => Promise<void>;
  addEmergencyContact: (patientId: string, contact: { name: string; relationship: string; phone: string }) => Promise<void>;
  updateEmergencyContact: (
    patientId: string,
    contactId: string,
    contact: { name: string; relationship: string; phone: string }
  ) => Promise<void>;
  deleteEmergencyContact: (patientId: string, contactId: string) => Promise<void>;
  refreshNotifications: (patientId?: string) => Promise<void>;
  markWhatsAppOpened: (notificationId: string) => Promise<EmergencyNotification>;
  confirmWhatsAppSent: (notificationId: string) => Promise<EmergencyNotification>;
  updatePatientBaseline: (patientId: string, baseline: Partial<PatientBaseline>) => Promise<Patient>;
  triggerTestEmergencySms: (payload: {
    patientId: string;
    verifiedPhone: string;
    recipientName?: string;
    consentConfirmed: boolean;
    testBaseline?: {
      heartRate: number;
      spo2: number;
      respiratoryRate: number;
      temperature: number;
    };
    testReading?: {
      heartRate: number;
      spo2: number;
      respiratoryRate: number;
      temperature: number;
    };
  }) => Promise<EmergencyNotification>;
  downloadReportPdf: (patientId: string, patientName: string, period: ReportPeriod) => Promise<void>;

  // Simulation Controls
  isSimulating: boolean;
  activeScenario: SimulationScenarioId | null;
  simulationPatientId: string;
  simulationTick: number;
  startSimulation: (patientId: string, scenarioId: SimulationScenarioId) => void;
  pauseSimulation: () => void;
  stopSimulation: () => void;
  simulationStatusText: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('PT-8021');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [notifications, setNotifications] = useState<EmergencyNotification[]>([]);
  const [clinicianActions, setClinicianActions] = useState<ClinicianAction[]>(MOCK_CLINICIAN_ACTIONS);
  const [sensorEvents, setSensorEvents] = useState<SensorQualityEvent[]>([]);
  const [activeAlertFilter, setActiveAlertFilter] = useState<AlertCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [selectedAlertForExplanation, setSelectedAlertForExplanation] = useState<ClinicalAlert | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<SimulationScenarioId | null>(null);
  const [simulationPatientId, setSimulationPatientId] = useState<string>('PT-8021');
  const [simulationTick, setSimulationTick] = useState<number>(0);
  const [simulationStatusText, setSimulationStatusText] = useState<string>('Idle (Baseline Telemetry)');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const selectedPatientIdRef = useRef<string>(selectedPatientId);
  selectedPatientIdRef.current = selectedPatientId;

  const loadAuthorizedData = useCallback(async (role: 'DOCTOR' | 'PATIENT', patientId?: string) => {
    try {
      const [loadedPatients, loadedAlerts, loadedNotifications] = await Promise.all([
        api.getPatients(),
        api.getAlerts(),
        api.getNotifications(role === 'PATIENT' ? patientId : undefined)
      ]);
      setPatients(loadedPatients);
      setAlerts(loadedAlerts);
      setNotifications(loadedNotifications);

      if (role === 'DOCTOR') {
        const loadedSensorEvents = await api.getSensorQuality();
        setSensorEvents(loadedSensorEvents);
      } else {
        setSensorEvents([]);
      }

      if (role === 'PATIENT' && patientId) {
        setSelectedPatientId(patientId);
      } else if (loadedPatients.length > 0 && !loadedPatients.some((p) => p.id === selectedPatientIdRef.current)) {
        setSelectedPatientId(loadedPatients[0].id);
      }
    } catch (err) {
      console.error('Failed to load authenticated VITALYNX data:', err);
    }
  }, []);

  // Register 401 handler
  useEffect(() => {
    setOnUnauthorizedHandler(() => {
      setCurrentUser(null);
      setPatients([]);
      setAlerts([]);
      setNotifications([]);
      setCurrentPage('dashboard');
    });
  }, []);

  // Restore JWT session on mount if available
  useEffect(() => {
    const restoreSession = async () => {
      const token = getAuthToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const { user } = await api.getMe();
        const mappedUser: AuthUser = {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          patientId: user.patientId || undefined,
          doctorId: user.doctorId || undefined,
          doctorTitle: user.doctorTitle
        };
        setCurrentUser(mappedUser);
        setCurrentPage(user.role === 'PATIENT' ? 'patient-dashboard' : 'dashboard');
        await loadAuthorizedData(user.role, user.patientId || undefined);
      } catch {
        setAuthToken(null);
      } finally {
        setAuthLoading(false);
      }
    };
    restoreSession();
  }, [loadAuthorizedData]);

  // Authenticated WebSocket connection with automatic reconnect and idempotent state reconciliation
  useEffect(() => {
    if (!currentUser) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    let unmounted = false;
    let attempt = 0;
    let isReconnect = false;

    const connectWs = () => {
      if (unmounted) return;
      const token = getAuthToken();
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setWsConnected(true);
        if (isReconnect) {
          loadAuthorizedData(currentUser.role, currentUser.patientId);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'vital:updated' && msg.payload?.patient) {
            const updated: Patient = msg.payload.patient;
            setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          } else if (msg.type === 'patient:updated' && msg.payload) {
            const updated: Patient = msg.payload;
            setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          } else if (msg.type === 'alert:created' && msg.payload) {
            const created: ClinicalAlert = msg.payload;
            setAlerts((prev) => {
              if (prev.some((a) => a.id === created.id)) {
                return prev.map((a) => (a.id === created.id ? created : a));
              }
              return [created, ...prev];
            });
          } else if (msg.type === 'alert:updated' && msg.payload) {
            const updated: ClinicalAlert = msg.payload;
            setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          } else if (msg.type === 'notification:updated' && msg.payload) {
            const notif: EmergencyNotification = msg.payload;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notif.id)) {
                return prev.map((n) => (n.id === notif.id ? notif : n));
              }
              return [notif, ...prev];
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!unmounted && currentUser) {
          isReconnect = true;
          const delay = Math.min(15000, 1500 * Math.pow(1.5, attempt));
          attempt += 1;
          reconnectTimerRef.current = window.setTimeout(() => {
            connectWs();
          }, delay);
        }
      };
    };

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [currentUser, loadAuthorizedData]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Real Backend Auth Functions
  const loginAsDoctor = async (identifier: string, password = '') => {
    const res = await api.login({ role: 'DOCTOR', identifier, password });
    const mapped: AuthUser = {
      id: res.user.id,
      role: 'DOCTOR',
      name: res.user.name,
      email: res.user.email,
      doctorId: res.user.doctorId || undefined,
      doctorTitle: res.user.doctorTitle || 'Clinical Administrator'
    };
    setCurrentUser(mapped);
    setCurrentPage('dashboard');
    await loadAuthorizedData('DOCTOR');
  };

  const loginAsPatient = async (patientId: string, password = '') => {
    const res = await api.login({ role: 'PATIENT', identifier: patientId, password });
    const mapped: AuthUser = {
      id: res.user.id,
      role: 'PATIENT',
      name: res.user.name,
      email: res.user.email,
      patientId: res.user.patientId || patientId
    };
    setCurrentUser(mapped);
    setSelectedPatientId(mapped.patientId || patientId);
    setCurrentPage('patient-dashboard');
    await loadAuthorizedData('PATIENT', mapped.patientId);
  };

  const registerDoctor = async (details: { name: string; email: string; phone: string; password: string }) => {
    const res = await api.register({
      role: 'DOCTOR',
      name: details.name,
      email: details.email,
      phone: details.phone,
      password: details.password
    });
    const mapped: AuthUser = {
      id: res.user.id,
      role: 'DOCTOR',
      name: res.user.name,
      email: res.user.email,
      doctorId: res.user.doctorId || undefined,
      doctorTitle: res.user.doctorTitle || 'Attending Physician'
    };
    setCurrentUser(mapped);
    setCurrentPage('dashboard');
    await loadAuthorizedData('DOCTOR');
  };

  const activateRegisteredPatientSession = async (user: AuthUser) => {
    setCurrentUser(user);
    if (user.patientId) setSelectedPatientId(user.patientId);
    setCurrentPage('patient-dashboard');
    await loadAuthorizedData('PATIENT', user.patientId);
  };

  const registerPatient = async (
    details: {
      name: string;
      patientId: string;
      email: string;
      phone: string;
      password: string;
      primaryContact: EmergencyContact;
      alternativeContact: EmergencyContact;
    },
    options?: { stayOnConfirmation?: boolean }
  ) => {
    const res = await api.register({
      role: 'PATIENT',
      name: details.name,
      patientId: details.patientId,
      email: details.email,
      phone: details.phone,
      password: details.password,
      primaryContact: details.primaryContact,
      alternativeContact: details.alternativeContact
    });
    const mapped: AuthUser = {
      id: res.user.id,
      role: 'PATIENT',
      name: res.user.name,
      email: res.user.email,
      patientId: res.user.patientId || details.patientId
    };
    const message =
      res.message || `Registration confirmed and saved to database for ${mapped.patientId}.`;

    if (!options?.stayOnConfirmation) {
      await activateRegisteredPatientSession(mapped);
    }
    return { user: mapped, message };
  };

  const updateAlternativeContact = async (patientId: string, contact: EmergencyContact) => {
    const updatedPatient = await api.updateAlternateEmergencyContact(patientId, contact);
    setPatients((prev) => prev.map((p) => (p.id === patientId ? updatedPatient : p)));
  };

  const addEmergencyContact = async (
    patientId: string,
    contact: { name: string; relationship: string; phone: string }
  ) => {
    const res = await api.addEmergencyContact(patientId, contact);
    setPatients((prev) => prev.map((p) => (p.id === patientId ? res.patient : p)));
  };

  const updateEmergencyContact = async (
    patientId: string,
    contactId: string,
    contact: { name: string; relationship: string; phone: string }
  ) => {
    const res = await api.updateEmergencyContact(patientId, contactId, contact);
    setPatients((prev) => prev.map((p) => (p.id === patientId ? res.patient : p)));
  };

  const deleteEmergencyContact = async (patientId: string, contactId: string) => {
    const res = await api.deleteEmergencyContact(patientId, contactId);
    setPatients((prev) => prev.map((p) => (p.id === patientId ? res.patient : p)));
  };

  const logout = () => {
    api.logout();
    setIsSimulating(false);
    setCurrentUser(null);
    setPatients([]);
    setAlerts([]);
    setNotifications([]);
    setCurrentPage('dashboard');
  };

  const navigateToPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setCurrentPage('patient-monitoring');
  };

  const navigateToAlertsWithFilter = (filter: AlertCategory) => {
    setActiveAlertFilter(filter);
    setCurrentPage('alerts');
  };

  const acknowledgeAlert = async (alertId: string) => {
    const updated = await api.acknowledgeAlert(alertId, currentUser?.name || 'Dr. Evelyn Vance');
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
  };

  const resolveAlert = async (alertId: string) => {
    const updated = await api.resolveAlert(alertId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
  };

  const toggleClinicianAction = (actionId: string) => {
    setClinicianActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, completed: !a.completed } : a))
    );
  };

  const refreshNotifications = async (patientId?: string) => {
    const list = await api.getNotifications(patientId);
    setNotifications(list);
  };

  const markWhatsAppOpened = async (notificationId: string) => {
    const res = await api.markWhatsAppOpened(notificationId);
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? res.notification : n)));
    return res.notification;
  };

  const confirmWhatsAppSent = async (notificationId: string) => {
    const res = await api.confirmWhatsAppSent(notificationId);
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? res.notification : n)));
    return res.notification;
  };

  const updatePatientBaseline = async (patientId: string, baseline: Partial<PatientBaseline>) => {
    const res = await api.updateBaseline(patientId, baseline);
    setPatients((prev) => prev.map((p) => (p.id === patientId ? res.patient : p)));
    return res.patient;
  };

  const triggerTestEmergencySms = async (payload: {
    patientId: string;
    verifiedPhone: string;
    recipientName?: string;
    consentConfirmed: boolean;
    testBaseline?: {
      heartRate: number;
      spo2: number;
      respiratoryRate: number;
      temperature: number;
    };
    testReading?: {
      heartRate: number;
      spo2: number;
      respiratoryRate: number;
      temperature: number;
    };
  }) => {
    try {
      const res = await api.triggerTestEmergencySms(payload);
      setNotifications((prev) => [res.notification, ...prev.filter((n) => n.id !== res.notification.id)]);
      return res.notification;
    } catch (err) {
      // Refresh history so failed attempt with real errorReason appears immediately in logs
      await refreshNotifications().catch(() => {});
      throw err;
    }
  };

  const downloadReportPdf = async (patientId: string, patientName: string, period: ReportPeriod) => {
    await api.downloadPatientReportPdf(patientId, patientName, period);
  };

  // Simulator loop synchronized to backend deterioration & artifact pipeline
  useEffect(() => {
    if (!isSimulating || !activeScenario || !currentUser) return;

    const interval = setInterval(() => {
      setSimulationTick((t) => t + 1);
      const target = patients.find((p) => p.id === simulationPatientId);
      if (!target) return;

      let nextPayload: Record<string, any> = { isSimulated: true };

      if (activeScenario === 'GRADUAL_DETERIORATION') {
        const newHr = Math.min(132, target.latestVitals.heartRate + 4);
        const newSpo2 = Math.max(84, target.latestVitals.spo2 - 2);
        const newRr = Math.min(30, target.latestVitals.respiratoryRate + 2);
        nextPayload = {
          heartRate: Math.round(newHr),
          spo2: Math.round(newSpo2),
          respiratoryRate: Math.round(newRr),
          temperature: target.latestVitals.temperature,
          sensorQuality: 'VALID',
          timestampLabel: 'Streaming live (Simulated)',
          isSimulated: true
        };
      } else if (activeScenario === 'PROBE_REMOVAL') {
        nextPayload = {
          heartRate: 0,
          spo2: 0,
          respiratoryRate: 0,
          temperature: target.latestVitals.temperature,
          sensorQuality: 'PROBE_REMOVED',
          timestampLabel: 'Sensor Detached',
          isSimulated: true
        };
      } else if (activeScenario === 'MOTION_NOISE') {
        const noise = Math.sin(Date.now() / 300) * 8;
        nextPayload = {
          heartRate: Math.round(75 + noise),
          spo2: Math.round(Math.min(99, Math.max(85, 96 + noise * 0.5))),
          respiratoryRate: target.latestVitals.respiratoryRate,
          temperature: target.latestVitals.temperature,
          sensorQuality: 'MOTION_NOISE',
          timestampLabel: 'Motion detected',
          isSimulated: true
        };
      } else if (activeScenario === 'SUDDEN_VITAL_SPIKE') {
        nextPayload = {
          heartRate: 118,
          temperature: 38.9,
          respiratoryRate: 24,
          spo2: target.latestVitals.spo2,
          sensorQuality: 'VALID',
          timestampLabel: 'Spike active',
          isSimulated: true
        };
      } else if (activeScenario === 'MISSING_DATA') {
        nextPayload = {
          heartRate: target.latestVitals.heartRate,
          spo2: target.latestVitals.spo2,
          respiratoryRate: target.latestVitals.respiratoryRate,
          temperature: target.latestVitals.temperature,
          sensorQuality: 'MISSING_READINGS',
          timestampLabel: 'No packet (Timeout)',
          isSimulated: true
        };
      } else if (activeScenario === 'STABLE_RECOVERY') {
        nextPayload = {
          heartRate: target.baseline.heartRate + Math.round(Math.sin(Date.now() / 1000) * 2),
          spo2: target.spo2Scale === 'SCALE_2' ? 90 : 98,
          respiratoryRate: target.baseline.respiratoryRate,
          temperature: target.baseline.temperature,
          sensorQuality: 'VALID',
          timestampLabel: 'Stable live',
          isSimulated: true
        };
      }

      api.ingestVitals(simulationPatientId, nextPayload).catch((err) => {
        console.error('Simulated ingestion error:', err);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating, activeScenario, simulationPatientId, patients, currentUser]);

  const startSimulation = (patientId: string, scenarioId: SimulationScenarioId) => {
    setSimulationPatientId(patientId);
    setActiveScenario(scenarioId);
    setIsSimulating(true);
    setSimulationTick(0);
    setSimulationStatusText(`Active: ${scenarioId} on ${patientId}`);
  };

  const pauseSimulation = () => {
    setIsSimulating(false);
    setSimulationStatusText('Simulation Paused');
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    setActiveScenario(null);
    setSimulationTick(0);
    setSimulationStatusText('Simulation Halted');
    if (currentUser) {
      loadAuthorizedData(currentUser.role, currentUser.patientId);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        authLoading,
        loginAsDoctor,
        loginAsPatient,
        registerDoctor,
        registerPatient,
        activateRegisteredPatientSession,
        logout,
        currentPage,
        setCurrentPage,
        selectedPatientId,
        setSelectedPatientId,
        selectedPatient,
        patients,
        alerts,
        notifications,
        clinicianActions,
        sensorEvents,
        activeAlertFilter,
        setActiveAlertFilter,
        searchQuery,
        setSearchQuery,
        isNotificationOpen,
        setIsNotificationOpen,
        selectedAlertForExplanation,
        setSelectedAlertForExplanation,
        wsConnected,
        navigateToPatient,
        navigateToAlertsWithFilter,
        acknowledgeAlert,
        resolveAlert,
        toggleClinicianAction,
        updateAlternativeContact,
        addEmergencyContact,
        updateEmergencyContact,
        deleteEmergencyContact,
        refreshNotifications,
        markWhatsAppOpened,
        confirmWhatsAppSent,
        updatePatientBaseline,
        triggerTestEmergencySms,
        downloadReportPdf,
        isSimulating,
        activeScenario,
        simulationPatientId,
        simulationTick,
        startSimulation,
        pauseSimulation,
        stopSimulation,
        simulationStatusText
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
