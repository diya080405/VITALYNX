import PDFDocument from 'pdfkit';
import type { Patient } from '../../src/types/patient.ts';
import type { VitalObservation } from '../../src/types/observation.ts';
import type { ClinicalAlert } from '../../src/types/alert.ts';
import type { EmergencyNotification, SymptomCheckin, ReportPeriod } from '../../src/types/notification.ts';
import { getPatientAvatar } from '../../src/utils/patientAssets.ts';

export interface PatientPdfReportInput {
  patient: Patient;
  period: ReportPeriod;
  periodStart: string;
  periodEnd: string;
  observations: VitalObservation[];
  alerts: ClinicalAlert[];
  notifications: EmergencyNotification[];
  checkins: SymptomCheckin[];
  aiSummary: string;
  aiSource: 'GEMINI' | 'FALLBACK';
  generatedByRole: 'DOCTOR' | 'PATIENT';
  generatedByName: string;
}

async function fetchImageBufferSafe(url: string): Promise<Buffer | null> {
  if (!url || url.startsWith('data:')) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

function drawVectorChart(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    unit: string;
    color: string;
    values: number[];
    labels: string[];
    baseline?: number;
    targetRange?: [number, number];
    yMin: number;
    yMax: number;
    sourceNote: string;
  }
) {
  const {
    x,
    y,
    width,
    height,
    title,
    unit,
    color,
    values,
    labels,
    baseline,
    targetRange,
    yMin,
    yMax,
    sourceNote
  } = options;

  // Card box
  doc.save();
  doc.roundedRect(x, y, width, height, 6).fillAndStroke('#F8FAFC', '#CBD5E1');

  // Header
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9).text(title, x + 10, y + 8);
  doc.fillColor('#64748B').font('Helvetica').fontSize(7).text(sourceNote, x + 10, y + 19);

  const plotX = x + 36;
  const plotY = y + 32;
  const plotW = width - 48;
  const plotH = height - 54;

  // Plot frame
  doc.rect(plotX, plotY, plotW, plotH).fillAndStroke('#FFFFFF', '#E2E8F0');

  const clampVal = (v: number) => Math.max(yMin, Math.min(yMax, v));
  const mapY = (v: number) => {
    const ratio = (clampVal(v) - yMin) / (yMax - yMin || 1);
    return plotY + plotH - ratio * plotH;
  };

  // Optional target band
  if (targetRange) {
    const yTop = mapY(targetRange[1]);
    const yBot = mapY(targetRange[0]);
    doc.save();
    doc.rect(plotX, yTop, plotW, Math.max(2, yBot - yTop)).fillOpacity(0.14).fill('#14B8A6');
    doc.restore();
  }

  // Horizontal grid lines & Y labels
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = yMin + ((yMax - yMin) * i) / steps;
    const gy = mapY(val);
    doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(plotX, gy).lineTo(plotX + plotW, gy).stroke();
    doc.fillColor('#64748B').font('Helvetica').fontSize(6.5).text(
      `${Number.isInteger(val) ? val : val.toFixed(1)}`,
      x + 4,
      gy - 3,
      { width: 28, align: 'right' }
    );
  }

  // Baseline dashed line
  if (baseline !== undefined) {
    const by = mapY(baseline);
    doc.save();
    doc.strokeColor('#94A3B8').lineWidth(0.8).dash(3, { space: 2 }).moveTo(plotX, by).lineTo(plotX + plotW, by).stroke();
    doc.undash();
    doc.fillColor('#475569').font('Helvetica').fontSize(6.5).text(`Base ${baseline}${unit}`, plotX + plotW - 48, by - 8);
    doc.restore();
  }

  // Data series
  if (values.length > 0) {
    const count = values.length;
    const stepX = count > 1 ? plotW / (count - 1) : 0;

    doc.strokeColor(color).lineWidth(1.6);
    values.forEach((v, idx) => {
      const px = count > 1 ? plotX + idx * stepX : plotX + plotW / 2;
      const py = mapY(v);
      if (idx === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke();

    values.forEach((v, idx) => {
      const px = count > 1 ? plotX + idx * stepX : plotX + plotW / 2;
      const py = mapY(v);
      doc.circle(px, py, 2).fill(color);
    });

    // X-axis tick labels (start, mid, end)
    const tickIndices = count >= 3 ? [0, Math.floor((count - 1) / 2), count - 1] : [0];
    for (const ti of tickIndices) {
      const px = count > 1 ? plotX + ti * stepX : plotX + plotW / 2;
      const lbl = labels[ti] || '';
      doc.fillColor('#64748B').font('Helvetica').fontSize(6.5).text(lbl, px - 15, plotY + plotH + 4, {
        width: 30,
        align: 'center'
      });
    }
  } else {
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(8).text('No valid readings in period', plotX + 10, plotY + plotH / 2 - 4);
  }

  doc.restore();
}

export async function generatePatientClinicalPdf(input: PatientPdfReportInput): Promise<Buffer> {
  const {
    patient,
    period,
    periodStart,
    periodEnd,
    observations,
    alerts,
    notifications,
    checkins,
    aiSummary,
    aiSource,
    generatedByRole,
    generatedByName
  } = input;

  const avatarUrl = getPatientAvatar(patient.id, patient.avatarUrl);
  const avatarBuffer = await fetchImageBufferSafe(avatarUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 42,
      bufferPages: true,
      info: {
        Title: `VITALYNX Clinical Report - ${patient.name} (${patient.id})`,
        Author: 'VITALYNX Remote Clinical Surveillance',
        Subject: `Post-Discharge Telemetry Report (${period})`
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 84;
    const validObs = observations.filter((o) => o.sensorQuality === 'VALID');
    const artifactObs = observations.filter((o) => o.sensorQuality !== 'VALID');

    // ================= PAGE 1: PROFILE, VITALS SUMMARY, AI SUMMARY =================
    // Top Brand Header
    doc.rect(42, 36, pageWidth, 54).fill('#0D1527');
    doc.fillColor('#2DD4BF').font('Helvetica-Bold').fontSize(16).text('VITALYNX', 56, 48);
    doc.fillColor('#CBD5E1').font('Helvetica').fontSize(8.5).text(
      'Intelligent Post-Discharge Monitoring • Clinical Telemetry & Decision-Support Report',
      56,
      68
    );
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(8).text(
      `Period: ${period.toUpperCase()} (${periodStart} to ${periodEnd})`,
      42,
      50,
      { width: pageWidth - 14, align: 'right' }
    );
    doc.text(`Generated by: ${generatedByName} (${generatedByRole})`, 42, 63, {
      width: pageWidth - 14,
      align: 'right'
    });

    // Patient Profile Box with Avatar
    let curY = 102;
    doc.roundedRect(42, curY, pageWidth, 88, 6).fillAndStroke('#F8FAFC', '#CBD5E1');
    if (avatarBuffer) {
      try {
        doc.save();
        doc.circle(78, curY + 44, 24).clip();
        doc.image(avatarBuffer, 54, curY + 20, { width: 48, height: 48 });
        doc.restore();
      } catch {
        doc.circle(78, curY + 44, 24).fill('#0F766E');
      }
    } else {
      doc.circle(78, curY + 44, 24).fill('#0F766E');
      const initials = patient.name
        .split(' ')
        .map((s) => s[0])
        .join('')
        .slice(0, 2);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text(initials, 54, curY + 37, {
        width: 48,
        align: 'center'
      });
    }

    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(13).text(`${patient.name} (${patient.id})`, 114, curY + 12);
    doc.fillColor('#334155').font('Helvetica').fontSize(8.5)
      .text(`${patient.age} yrs • ${patient.gender} • Discharged: ${patient.dischargeDate} • Contact: ${patient.patientPhone}`, 114, curY + 29)
      .text(`Primary Diagnosis: ${patient.primaryDiagnosis}`, 114, curY + 42, { width: 255 })
      .text(`Alert Status: ${patient.currentAlertCategory} | Monitoring: ${patient.monitoringStatus} | SpO2 Scale: ${patient.spo2Scale} (Target ${patient.targetSpo2Range[0]}–${patient.targetSpo2Range[1]}%)`, 114, curY + 62, { width: 390 });

    // Assigned Doctor & Emergency Contacts Card
    curY += 98;
    const halfW = (pageWidth - 10) / 2;
    doc.roundedRect(42, curY, halfW, 74, 6).fillAndStroke('#F0FDFA', '#99F6E4');
    doc.fillColor('#0F766E').font('Helvetica-Bold').fontSize(8.5).text('ASSIGNED ATTENDING PHYSICIAN', 52, curY + 10);
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text(patient.assignedDoctor, 52, curY + 23);
    doc.fillColor('#334155').font('Helvetica').fontSize(8)
      .text(`${patient.assignedDoctorContact.role}`, 52, curY + 37)
      .text(`Phone: ${patient.assignedDoctorContact.phone} | Email: ${patient.assignedDoctorContact.email}`, 52, curY + 49)
      .text(`Clinic: ${patient.assignedDoctorContact.clinic}`, 52, curY + 60, { width: halfW - 20 });

    doc.roundedRect(42 + halfW + 10, curY, halfW, 74, 6).fillAndStroke('#FFF1F2', '#FECDD3');
    doc.fillColor('#9F1239').font('Helvetica-Bold').fontSize(8.5).text('DESIGNATED EMERGENCY CONTACTS', 52 + halfW + 10, curY + 10);
    doc.fillColor('#0F172A').font('Helvetica').fontSize(8.2)
      .text(
        `Primary: ${patient.primaryEmergencyContact.name} (${patient.primaryEmergencyContact.relationship}) — ${patient.primaryEmergencyContact.phone}`,
        52 + halfW + 10,
        curY + 26,
        { width: halfW - 20 }
      )
      .text(
        `Alternate: ${patient.alternativeEmergencyContact.name} (${patient.alternativeEmergencyContact.relationship}) — ${patient.alternativeEmergencyContact.phone}`,
        52 + halfW + 10,
        curY + 48,
        { width: halfW - 20 }
      );

    // Medical Conditions & Medications
    curY += 84;
    doc.roundedRect(42, curY, pageWidth, 68, 6).fillAndStroke('#FFFFFF', '#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text('CLINICAL PROFILE & PRESCRIBED REGIMEN', 52, curY + 9);
    doc.fillColor('#334155').font('Helvetica').fontSize(8)
      .text(`Conditions: ${patient.medicalConditions.join(', ')}`, 52, curY + 23, { width: pageWidth - 20 })
      .text(`Medications: ${patient.medications.join('; ')}`, 52, curY + 41, { width: pageWidth - 20 });

    // Baseline & NEWS2-style Acuity Summary
    curY += 78;
    doc.roundedRect(42, curY, pageWidth, 72, 6).fillAndStroke('#F8FAFC', '#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(
      `PERSONALIZED BASELINE & NEWS2-STYLE ACUITY SCORE (Aggregate: ${patient.news2Score} / 20)`,
      52,
      curY + 10
    );
    doc.fillColor('#334155').font('Helvetica').fontSize(8)
      .text(
        `Baseline (n=${patient.baseline.totalObservationCount}): HR ${patient.baseline.heartRate} bpm | SpO2 ${patient.baseline.spo2}% | RR ${patient.baseline.respiratoryRate}/min | Temp ${patient.baseline.temperature}°C`,
        52,
        curY + 25
      )
      .text(
        `Latest Telemetry (${patient.latestVitals.sensorQuality}): HR ${patient.latestVitals.heartRate} bpm | SpO2 ${patient.latestVitals.spo2}% | RR ${patient.latestVitals.respiratoryRate}/min | Temp ${patient.latestVitals.temperature}°C | BP ${patient.latestVitals.bloodPressure || 'N/A'}`,
        52,
        curY + 38
      )
      .text(
        `NEWS2-style Subscores -> RR: +${patient.news2Breakdown.respiratoryRateScore}, SpO2: +${patient.news2Breakdown.spo2Score}, Temp: +${patient.news2Breakdown.temperatureScore}, HR: +${patient.news2Breakdown.heartRateScore}, BP: +${patient.news2Breakdown.systolicBPScore} | Missing/Artifact Intervals: ${artifactObs.length}`,
        52,
        curY + 51
      );

    // Clearly Labeled AI Summary Box + Data Source Transparency
    curY += 82;
    doc.roundedRect(42, curY, pageWidth, 98, 6).fillAndStroke('#EFF6FF', '#93C5FD');
    doc.fillColor('#1E3A8A').font('Helvetica-Bold').fontSize(8.5).text(
      `AI-ASSISTED MONITORING SUMMARY (${aiSource === 'GEMINI' ? 'Gemini Clinical Synthesis' : 'Structured Summary Fallback'} — Separate from Measured Vitals)`,
      52,
      curY + 10
    );
    doc.fillColor('#1E293B').font('Helvetica').fontSize(8.3).text(aiSummary, 52, curY + 25, {
      width: pageWidth - 20,
      lineGap: 2
    });
    doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(7.5).text(
      'Data Sources & LOINC Interoperability: HR (LOINC 8867-4), SpO2 (LOINC 2708-6), and RR (LOINC 9279-1) follow BIDMC PhysioNet waveform/telemetry patterns; Body Temperature (LOINC 8310-5) is supplied by the Virtual Wearable Simulator.',
      52,
      curY + 72,
      { width: pageWidth - 20 }
    );

    // ================= PAGE 2: 4 VECTOR TREND GRAPHS =================
    doc.addPage();
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(12).text(
      `Vital Sign Trend Graphs (${period.toUpperCase()}) — ${patient.name} (${patient.id})`,
      42,
      40
    );
    doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(
      `Plotted from ${validObs.length} valid database observations (${artifactObs.length} artifact/missing intervals excluded from trend lines).`,
      42,
      56
    );

    const chartW = (pageWidth - 12) / 2;
    const chartH = 195;
    const chartValues = validObs.slice(-24);
    const labels = chartValues.map((o) => o.timeLabel);

    drawVectorChart(doc, {
      x: 42,
      y: 78,
      width: chartW,
      height: chartH,
      title: 'Oxygen Saturation (SpO2 %)',
      unit: '%',
      color: '#0D9488',
      values: chartValues.map((o) => o.spo2),
      labels,
      baseline: patient.baseline.spo2,
      targetRange: patient.targetSpo2Range,
      yMin: 80,
      yMax: 100,
      sourceNote: `Source: BIDMC PhysioNet Pattern • LOINC 2708-6 • ${patient.spo2Scale}`
    });

    drawVectorChart(doc, {
      x: 42 + chartW + 12,
      y: 78,
      width: chartW,
      height: chartH,
      title: 'Heart Rate (bpm)',
      unit: ' bpm',
      color: '#EF4444',
      values: chartValues.map((o) => o.heartRate),
      labels,
      baseline: patient.baseline.heartRate,
      yMin: 40,
      yMax: 150,
      sourceNote: 'Source: BIDMC PhysioNet Pattern • LOINC 8867-4'
    });

    drawVectorChart(doc, {
      x: 42,
      y: 78 + chartH + 16,
      width: chartW,
      height: chartH,
      title: 'Respiratory Rate (breaths/min)',
      unit: '/min',
      color: '#0284C7',
      values: chartValues.map((o) => o.respiratoryRate),
      labels,
      baseline: patient.baseline.respiratoryRate,
      yMin: 10,
      yMax: 36,
      sourceNote: 'Source: BIDMC PhysioNet Pattern • LOINC 9279-1'
    });

    drawVectorChart(doc, {
      x: 42 + chartW + 12,
      y: 78 + chartH + 16,
      width: chartW,
      height: chartH,
      title: 'Body Temperature (°C)',
      unit: '°C',
      color: '#D97706',
      values: chartValues.map((o) => o.temperature),
      labels,
      baseline: patient.baseline.temperature,
      yMin: 35.5,
      yMax: 40.5,
      sourceNote: 'Source: Virtual Wearable Simulator • LOINC 8310-5'
    });

    // Signal Quality & Artifact Summary Box on Page 2
    const sqY = 78 + (chartH + 16) * 2;
    doc.roundedRect(42, sqY, pageWidth, 88, 6).fillAndStroke('#F8FAFC', '#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9).text('SIGNAL QUALITY & SENSOR ARTIFACT SUMMARY', 52, sqY + 10);
    doc.fillColor('#334155').font('Helvetica').fontSize(8)
      .text(`Total Observations Evaluated: ${observations.length} | Valid Physiological Readings: ${validObs.length} | Excluded Artifact/Missing Intervals: ${artifactObs.length}`, 52, sqY + 26)
      .text('Missing Data Policy: VITALYNX never assigns 0 points to missing readings or detached probes (PROBE_REMOVED / MOTION_NOISE / MISSING_READINGS).', 52, sqY + 41, { width: pageWidth - 20 })
      .text(`Recent Symptom Check-ins (${checkins.length}): ${checkins.slice(0, 2).map((c) => `[${c.submittedAt.slice(0, 10)}] Dyspnea ${c.dyspneaScore}/10, Fatigue ${c.fatigueScore}/10 — ${c.notes || 'No notes'}`).join(' | ') || 'None recorded in period.'}`, 52, sqY + 58, { width: pageWidth - 20 });

    // ================= PAGE 3: READINGS TABLE, ALERTS, SMS HISTORY =================
    doc.addPage();
    let p3Y = 42;
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text('Recent Physiological Readings Log', 42, p3Y);
    p3Y += 18;

    // Table Header
    doc.rect(42, p3Y, pageWidth, 18).fill('#0F172A');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
      .text('Time', 48, p3Y + 5)
      .text('HR (bpm)', 120, p3Y + 5)
      .text('SpO2 (%)', 175, p3Y + 5)
      .text('RR (/min)', 230, p3Y + 5)
      .text('Temp (°C)', 285, p3Y + 5)
      .text('NEWS2-style', 340, p3Y + 5)
      .text('Signal Quality', 405, p3Y + 5);
    p3Y += 18;

    const recentRows = observations.slice(-12).reverse();
    recentRows.forEach((o, i) => {
      if (i % 2 === 0) doc.rect(42, p3Y, pageWidth, 16).fill('#F8FAFC');
      doc.fillColor('#1E293B').font('Helvetica').fontSize(7.5)
        .text(o.timeLabel || o.timestamp.slice(11, 16), 48, p3Y + 4)
        .text(o.sensorQuality === 'VALID' ? `${o.heartRate}` : '---', 120, p3Y + 4)
        .text(o.sensorQuality === 'VALID' ? `${o.spo2}%` : '---', 175, p3Y + 4)
        .text(o.sensorQuality === 'VALID' ? `${o.respiratoryRate}` : '---', 230, p3Y + 4)
        .text(`${o.temperature}°C`, 285, p3Y + 4)
        .text(`${o.news2Score}`, 340, p3Y + 4)
        .text(o.sensorQuality, 405, p3Y + 4);
      p3Y += 16;
    });

    p3Y += 16;
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text(`Alert History & Explanations (${alerts.length})`, 42, p3Y);
    p3Y += 16;

    if (alerts.length === 0) {
      doc.fillColor('#475569').font('Helvetica').fontSize(8.5).text('No clinical alerts triggered during this monitoring window.', 42, p3Y);
      p3Y += 18;
    } else {
      alerts.slice(0, 5).forEach((a) => {
        if (p3Y > 680) {
          doc.addPage();
          p3Y = 42;
        }
        doc.roundedRect(42, p3Y, pageWidth, 44, 4).fillAndStroke('#FFFFFF', '#CBD5E1');
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8).text(
          `${a.id} [${a.alertLevel} • ${a.status}] — ${a.timestamp} — ${a.vitalSignReading}`,
          50,
          p3Y + 7,
          { width: pageWidth - 16 }
        );
        doc.fillColor('#334155').font('Helvetica').fontSize(7.5).text(
          `Rule: ${a.ruleApplied} | ${a.explanation}`,
          50,
          p3Y + 20,
          { width: pageWidth - 16, height: 20 }
        );
        p3Y += 50;
      });
    }

    // Emergency Notification History (Doctor report includes full log; Patient report includes summary)
    p3Y += 8;
    if (p3Y > 680) {
      doc.addPage();
      p3Y = 42;
    }
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(11).text(
      generatedByRole === 'DOCTOR'
        ? `WhatsApp Emergency Alert History (${notifications.length})`
        : `WhatsApp Caregiver Alert History (${notifications.length})`,
      42,
      p3Y
    );
    p3Y += 16;

    if (notifications.length === 0) {
      doc.fillColor('#475569').font('Helvetica').fontSize(8.5).text('No WhatsApp emergency alerts logged for this patient in this period.', 42, p3Y);
    } else {
      notifications.slice(0, 6).forEach((n) => {
        if (p3Y > 710) {
          doc.addPage();
          p3Y = 42;
        }
        doc.roundedRect(42, p3Y, pageWidth, 32, 4).fillAndStroke('#F8FAFC', '#CBD5E1');
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(7.8).text(
          `${n.recipientType} (${n.recipientName}) • ${n.recipientPhone} • Status: ${n.deliveryStatus} (${n.provider}) • ${n.createdAt}`,
          50,
          p3Y + 6,
          { width: pageWidth - 16 }
        );
        doc.fillColor('#475569').font('Helvetica').fontSize(7.2).text(
          n.errorReason ? `Error: ${n.errorReason}` : n.messageText,
          50,
          p3Y + 18,
          { width: pageWidth - 16, height: 10 }
        );
        p3Y += 37;
      });
    }

    // Footer with page numbers & disclaimer on ALL buffered pages
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 58;
      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(42, footerY - 5).lineTo(42 + pageWidth, footerY - 5).stroke();
      doc.fillColor('#9F1239').font('Helvetica-Bold').fontSize(6.8).text(
        'Clinical Decision Support Only - Not a medical diagnosis tool. All alerts must be reviewed by qualified healthcare professionals.',
        42,
        footerY,
        { width: pageWidth - 70, lineBreak: false }
      );
      doc.fillColor('#475569').font('Helvetica').fontSize(7.5).text(
        `Page ${i + 1} of ${pageRange.count}`,
        42,
        footerY,
        { width: pageWidth, align: 'right', lineBreak: false }
      );
    }

    doc.end();
  });
}
