Intelligent Post-Discharge Monitoring
Monitor continuously. Detect changes earlier. Support more connected post-discharge care.

Team Name: IMPACTMIND
Team Leader: Empana R Hemanna
Institution: Bapuji Institute of Engineering and Technology
Domain: Healthcare – Remote Patient Monitoring
Event: HACKARENA 1.0

1. About the Project
VITALYNX is an intelligent post-discharge monitoring platform designed to support patients, families, and healthcare professionals in monitoring a patient's recovery after leaving the hospital.

After hospital discharge, patients may experience changes in their health conditions. However, doctors may not always have continuous visibility into the patient's recovery at home.

VITALYNX aims to bridge this gap by providing a connected platform where patients and families can view recovery information while doctors can monitor multiple patients through a dedicated clinical dashboard.

The platform focuses on vital-sign trends, patient recovery status, clinical alert information, and emergency contact accessibility.

Our vision: To make post-discharge healthcare monitoring more connected, accessible, organised, and responsive.
2. Problem Statement
Hospital discharge does not always mean that a patient has completely recovered. The recovery period at home is equally important, but monitoring patients outside hospitals can be challenging.

The major problems include:
- Lack of continuous monitoring: Doctors may not have a continuous view of a patient's health after discharge.
- Delayed identification of health changes: Changes in vital signs may go unnoticed if measurements are not reviewed regularly.
- Limited communication: Patients and caregivers may struggle to connect with the appropriate healthcare professional.
- Scattered health information: Patient readings, medical information, and emergency contacts may be available across different platforms.
- Difficulty monitoring multiple patients: Doctors may find it difficult to identify which discharged patients require additional attention.
These challenges highlight the need for a connected monitoring platform that makes recovery information easier to access and review.
3. Proposed Solution
VITALYNX provides a connected monitoring experience through two dedicated portals.

A. Patient and Family Portal
- Patient profile and recovery information.
- Visual representation of vital-sign trends.
- Recovery status overview.
- Assigned physician information.
- Emergency contact details.
- Quick contact options through call and WhatsApp actions.
B. Doctor and Clinician Portal
- Dedicated doctor login.
- Patient monitoring dashboard.
- Patient categorisation based on recovery status.
- Individual patient health information.
- Vital-sign trend analysis.
- Clinical alert overview.
- Patient follow-up and contact information.
By connecting these two portals, VITALYNX creates a more organised approach to post-discharge monitoring.
4. Unique Features and Innovation
What makes VITALYNX different is that it does not simply display health readings. It connects patient information, health trends, clinical surveillance, and contact pathways in one application.
1. Dual-Portal Monitoring
Separate interfaces for patients/families and doctors ensure that each user gets relevant information in an easy-to-understand format.
2. Intelligent Patient Categorisation
Patients are grouped into five categories:
- Stable: No current concern indicated by the displayed monitoring status.
- Watch: Requires continued observation.
- Review: Requires clinical review.
- Urgent: Requires prompt attention according to the configured clinical workflow.
- Offline: Monitoring data is unavailable or the patient is not currently connected.
These categories help doctors quickly understand the patient cohort.
3. Vital Trend Analysis
VITALYNX focuses on displaying health measurements over time instead of relying only on individual readings.

The platform includes:
- SpO₂ – Oxygen saturation.
- Pulse – Heart rate.
- Respiratory Rate – Number of breaths per minute.
- Temperature – Body temperature.
4. Connected Emergency Contacts
Assigned physician and emergency contact information are displayed within the application, with call and WhatsApp actions available in the current interface.
5. Centralised Clinical Dashboard
Doctors can view patient categories, individual telemetry, and clinical alert information from one centralised interface.
6. Offline Data Support
SQLite is included in the proposed technology stack as an offline data buffer, providing a foundation for handling temporary connectivity interruptions. A reliable synchronisation mechanism will be needed for complete offline-to-online operation.
5. Technology Stack
VITALYNX uses a modern technology stack designed to support a responsive frontend, backend processing, data handling, and health visualisation.
Technology	Purpose
React	Frontend development
TypeScript	Type-safe frontend programming
Python	Data processing and analysis
FastAPI	Backend API development
SQLite	Offline data buffering
BIDMC Dataset	Potential clinical data source for development/testing
Synthea	Synthetic healthcare data for development/testing
NEWS2	Clinical monitoring and escalation reference
Recharts	Vital-sign graphs and visualisation

Why This Technology Stack?
- React: Helps create reusable and responsive user interfaces.
- TypeScript: Improves code reliability and maintainability.
- Python: Provides flexibility for data analysis and processing.
- FastAPI: Supports lightweight and efficient backend APIs.
- SQLite: Provides local storage capabilities.
- Recharts: Makes health trends easier to understand through graphs.
- BIDMC and Synthea: Can support development and testing with clinical or synthetic datasets.
- NEWS2: Provides a recognised reference for designing clinical monitoring and escalation workflows.
6. Workflow of VITALYNX
The application follows a simple five-step workflow.

STEP 1 – ACCESS

The patient/family member or doctor accesses the appropriate portal through the login interface.

STEP 2 – OPEN

The user opens the patient profile or the doctor accesses the patient cohort dashboard.

STEP 3 – REVIEW

The application presents available vital-sign measurements and their historical trends.

STEP 4 – IDENTIFY

The user reviews the patient's recovery status, patient category, and available clinical alert information.

STEP 5 – RESPOND

The doctor reviews the information and uses the available contact options or arranges appropriate clinical follow-up.
Simple Workflow Representation
Patient / Family → Patient Portal → Health Information → Vital Trend Analysis → Recovery Status

Doctor → Doctor Portal → Patient Dashboard → Alert Overview → Clinical Review / Follow-up
7. High-Level System Architecture
VITALYNX is organised into three major sections.

1. User Interface Layer
- Patient and Family Portal.
- Doctor and Clinician Portal.
- Patient profiles.
- Vital-sign visualisation.
- Patient cohort dashboard.
2. Application and Processing Layer
- React and TypeScript frontend.
- FastAPI backend.
- Python-based analysis logic.
- SQLite offline buffer.
3. Monitoring and Data Layer
- Vital-sign information.
- BIDMC and Synthea development datasets.
- NEWS2-informed monitoring context.
- Recharts visualisation.
- Clinical alert and status presentation.
The frontend communicates with backend services through APIs. The backend supports application processing and data access, while the interface presents relevant information to patients and clinicians.
8. Clinical Safety and Data Privacy
Since VITALYNX deals with healthcare information, safety and privacy are important considerations.

Our proposed approach includes:
- Role-based access for patients, families, and doctors.
- Secure communication using HTTPS/TLS.
- Protection of patient information.
- Clear timestamps for health measurements.
- Identification of missing or outdated readings.
- Clinical review before acting on monitoring alerts.
- Appropriate handling of offline data.
Important clinical consideration: NEWS2 requires specific observations beyond the four vital trends currently displayed in the interface. A complete NEWS2 implementation must capture the required inputs and follow clinically validated scoring and escalation rules.

VITALYNX is intended to support monitoring and follow-up, not replace medical diagnosis or professional clinical judgement.
9. Real-World Applications
VITALYNX can potentially be useful in:
1. Post-surgery recovery: Supporting the monitoring of patients after surgical discharge.
2. Elderly patient care: Helping caregivers and clinicians keep track of recovery information.
3. Chronic disease follow-up: Supporting structured monitoring for patients who require regular clinical follow-up.
4. Home healthcare: Connecting patient-facing information with healthcare professionals.
5. Hospital follow-up programmes: Helping healthcare teams organise information about discharged patients.
These are potential applications and would require appropriate clinical validation before real-world deployment.
10. Future Enhancements
We plan to extend VITALYNX with additional capabilities:
- Integration with approved wearable health-monitoring devices.
- Real-time data synchronisation.
- Configurable clinical alert thresholds.
- Automated notifications for relevant clinical follow-up.
- Multilingual support for better accessibility.
- Improved patient recovery analytics.
- Integration with hospital management systems.
- Alert acknowledgement and follow-up history.
- Enhanced offline synchronisation.
These improvements can help VITALYNX evolve into a more comprehensive post-discharge monitoring platform.

Our competitive advantages:
1. Real-world problem: Addresses the gap in monitoring patients after hospital discharge.
2. Dual-user experience: Connects patient/family needs with clinician requirements.
3. Clear visualisation: Makes health trends easier to understand.
4. Patient prioritisation: Provides five clear patient status categories.
5. Practical technology: Uses React, TypeScript, Python, FastAPI, and SQLite.
6. Scalability: Provides a foundation for future wearable and healthcare-system integrations.
7. Human-centred design: Focuses on making information accessible and useful for different users.
8. Responsible healthcare approach: Recognises the importance of clinical oversight and patient data protection.

12. Conclusion
VITALYNX aims to make post-discharge healthcare monitoring more connected and organised.
By combining patient-facing recovery information, clinician surveillance, vital-sign trends, patient categorisation, and emergency contact accessibility, the platform provides a foundation for better follow-up care.

Our goal is not just to monitor health readings, but to make important recovery information easier to understand and act upon through appropriate clinical review.

VITALYNX – Monitor continuously. Detect changes earlier. Support more connected post-discharge care.
