import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.ts';
import { authenticateToken, signJwtToken, type AuthenticatedRequest } from '../middleware/auth.ts';
import {
  DOCTOR_AVATAR,
  isValidEmail,
  isValidSyntheaPatientIdFormat,
  validatePhoneInput
} from '../../src/utils/patientAssets.ts';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { role, identifier, password } = req.body || {};
  if (!identifier || !password) {
    res.status(400).json({ error: 'Identifier and password are required.' });
    return;
  }

  const db = getDb();
  const cleanIdent = String(identifier).trim();

  let userRow: any = null;
  if (role === 'PATIENT') {
    const cleanPid = cleanIdent.toUpperCase();
    userRow = db
      .prepare(
        `SELECT * FROM users WHERE role = 'PATIENT' AND (UPPER(patient_id) = ? OR LOWER(email) = LOWER(?))`
      )
      .get(cleanPid, cleanIdent);
  } else if (role === 'DOCTOR') {
    userRow = db
      .prepare(
        `SELECT u.* FROM users u
         LEFT JOIN doctors d ON d.id = u.doctor_id
         WHERE u.role = 'DOCTOR' AND (LOWER(u.email) = LOWER(?) OR LOWER(u.name) = LOWER(?) OR LOWER(d.name) = LOWER(?))`
      )
      .get(cleanIdent, cleanIdent, cleanIdent);
  } else {
    userRow = db
      .prepare(
        `SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR UPPER(patient_id) = UPPER(?) OR LOWER(name) = LOWER(?)`
      )
      .get(cleanIdent, cleanIdent, cleanIdent);
  }

  if (!userRow || !userRow.is_active) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const passwordValid = bcrypt.compareSync(String(password), userRow.password_hash);
  if (!passwordValid) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const authUser = {
    id: userRow.id,
    email: userRow.email,
    role: userRow.role as 'DOCTOR' | 'PATIENT',
    name: userRow.name,
    doctorId: userRow.doctor_id || null,
    patientId: userRow.patient_id || null
  };

  const token = signJwtToken(authUser);
  const doctorInfo = authUser.doctorId
    ? (db.prepare('SELECT * FROM doctors WHERE id = ?').get(authUser.doctorId) as any)
    : null;

  res.json({
    token,
    user: {
      ...authUser,
      doctorTitle: doctorInfo?.role_title || (authUser.role === 'DOCTOR' ? 'Attending Physician' : undefined),
      phone: doctorInfo?.phone
    }
  });
});

authRouter.post('/register', (req, res) => {
  const { role, name, email, phone, password, patientId, primaryContact, alternativeContact } = req.body || {};

  if (!role || !name || !email || !password) {
    res.status(400).json({ error: 'Missing required registration fields (name, email, password, and role).' });
    return;
  }

  const cleanName = String(name).trim();
  if (cleanName.length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address (e.g. name@example.com).' });
    return;
  }

  if (String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const phoneCheck = validatePhoneInput(phone);
  if (!phoneCheck.valid) {
    res.status(400).json({ error: `Contact phone error: ${phoneCheck.error}` });
    return;
  }

  const db = getDb();
  const existingEmail = db
    .prepare('SELECT id, role, patient_id FROM users WHERE LOWER(email) = ?')
    .get(cleanEmail) as { id: string; role: string; patient_id: string | null } | undefined;

  if (role === 'DOCTOR') {
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }
    const doctorId = `DOC-${Date.now().toString(36).toUpperCase()}`;
    const userId = `USR-${doctorId}`;
    const passHash = bcrypt.hashSync(String(password), 10);

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO doctors (id, name, role_title, clinic, phone, email, pager, avatar_url)
        VALUES (?, ?, 'Attending Physician', 'BIET Memorial Hospital – Remote Clinical Surveillance Command', ?, ?, 'PG-NEW', ?)
      `).run(doctorId, cleanName, String(phone).trim(), cleanEmail, DOCTOR_AVATAR);

      db.prepare(`
        INSERT INTO users (id, email, password_hash, role, name, doctor_id, patient_id, is_portal_registered)
        VALUES (?, ?, ?, 'DOCTOR', ?, ?, NULL, 1)
      `).run(userId, cleanEmail, passHash, cleanName, doctorId);
    });
    tx();

    const authUser = {
      id: userId,
      email: cleanEmail,
      role: 'DOCTOR' as const,
      name: cleanName,
      doctorId,
      patientId: null
    };
    const token = signJwtToken(authUser);
    res.status(201).json({
      registered: true,
      message: `Clinician account registered for ${cleanName}.`,
      token,
      user: { ...authUser, doctorTitle: 'Attending Physician' }
    });
    return;
  }

  if (role === 'PATIENT') {
    const cleanPid = String(patientId || '').trim().toUpperCase();
    if (!isValidSyntheaPatientIdFormat(cleanPid)) {
      res.status(400).json({
        error: `Invalid Synthea Patient ID format "${cleanPid || 'empty'}". Use an assigned hospital ID between PT-8021 and PT-8026.`
      });
      return;
    }

    const patientRow = db.prepare('SELECT * FROM patients WHERE UPPER(id) = ?').get(cleanPid) as any;
    if (!patientRow) {
      res.status(404).json({
        error: `Hospital registry validation failed: Patient ID "${cleanPid}" was not found. Valid patient IDs: PT-8021 to PT-8026.`
      });
      return;
    }

    const existingPatientUser = db
      .prepare("SELECT id, email, is_portal_registered FROM users WHERE role = 'PATIENT' AND UPPER(patient_id) = ?")
      .get(patientRow.id) as { id: string; email: string; is_portal_registered: number } | undefined;

    if (existingPatientUser && existingPatientUser.is_portal_registered === 1) {
      res.status(409).json({
        error: `Patient ID ${patientRow.id} is already registered (${existingPatientUser.email}). Duplicate registration is not allowed; please use Patient Sign In.`
      });
      return;
    }

    if (existingEmail && (!existingPatientUser || existingEmail.id !== existingPatientUser.id)) {
      res.status(409).json({
        error: `An account with email "${cleanEmail}" is already registered. Please sign in or use a different email address.`
      });
      return;
    }

    if (
      !primaryContact?.name?.trim() ||
      !primaryContact?.relationship?.trim() ||
      !primaryContact?.phone?.trim() ||
      !alternativeContact?.name?.trim() ||
      !alternativeContact?.relationship?.trim() ||
      !alternativeContact?.phone?.trim()
    ) {
      res.status(400).json({
        error: 'Both primary and alternative emergency contact names, relationships, and phone numbers are required.'
      });
      return;
    }

    const primaryPhoneCheck = validatePhoneInput(primaryContact.phone);
    if (!primaryPhoneCheck.valid) {
      res.status(400).json({ error: `Primary emergency contact phone error: ${primaryPhoneCheck.error}` });
      return;
    }

    const altPhoneCheck = validatePhoneInput(alternativeContact.phone);
    if (!altPhoneCheck.valid) {
      res.status(400).json({ error: `Alternative emergency contact phone error: ${altPhoneCheck.error}` });
      return;
    }

    const passHash = bcrypt.hashSync(String(password), 10);
    const tx = db.transaction(() => {
      db.prepare("UPDATE patients SET name = ?, patient_phone = ?, updated_at = datetime('now') WHERE id = ?").run(
        cleanName,
        String(phone).trim(),
        patientRow.id
      );

      const primaryExists = db
        .prepare("SELECT id FROM emergency_contacts WHERE patient_id = ? AND contact_type = 'PRIMARY'")
        .get(patientRow.id) as { id: string } | undefined;

      if (primaryExists) {
        db.prepare(`
          UPDATE emergency_contacts
          SET name = ?, relationship = ?, phone = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          String(primaryContact.name).trim(),
          String(primaryContact.relationship).trim(),
          String(primaryContact.phone).trim(),
          primaryExists.id
        );
      } else {
        db.prepare(`
          INSERT INTO emergency_contacts (id, patient_id, contact_type, name, relationship, phone, priority)
          VALUES (?, ?, 'PRIMARY', ?, ?, ?, 1)
        `).run(
          `EC-${patientRow.id}-PRIMARY`,
          patientRow.id,
          String(primaryContact.name).trim(),
          String(primaryContact.relationship).trim(),
          String(primaryContact.phone).trim()
        );
      }

      const altExists = db
        .prepare("SELECT id FROM emergency_contacts WHERE patient_id = ? AND contact_type = 'ALTERNATE'")
        .get(patientRow.id) as { id: string } | undefined;

      if (altExists) {
        db.prepare(`
          UPDATE emergency_contacts
          SET name = ?, relationship = ?, phone = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          String(alternativeContact.name).trim(),
          String(alternativeContact.relationship).trim(),
          String(alternativeContact.phone).trim(),
          altExists.id
        );
      } else {
        db.prepare(`
          INSERT INTO emergency_contacts (id, patient_id, contact_type, name, relationship, phone, priority)
          VALUES (?, ?, 'ALTERNATE', ?, ?, ?, 2)
        `).run(
          `EC-${patientRow.id}-ALTERNATE`,
          patientRow.id,
          String(alternativeContact.name).trim(),
          String(alternativeContact.relationship).trim(),
          String(alternativeContact.phone).trim()
        );
      }

      if (existingPatientUser) {
        db.prepare(`
          UPDATE users
          SET email = ?, password_hash = ?, name = ?, is_portal_registered = 1
          WHERE id = ?
        `).run(cleanEmail, passHash, cleanName, existingPatientUser.id);
        return existingPatientUser.id;
      } else {
        const uid = `USR-${patientRow.id}`;
        db.prepare(`
          INSERT INTO users (id, email, password_hash, role, name, doctor_id, patient_id, is_portal_registered)
          VALUES (?, ?, ?, 'PATIENT', ?, NULL, ?, 1)
        `).run(uid, cleanEmail, passHash, cleanName, patientRow.id);
        return uid;
      }
    });

    const userId = tx();
    const authUser = {
      id: userId,
      email: cleanEmail,
      role: 'PATIENT' as const,
      name: cleanName,
      doctorId: null,
      patientId: patientRow.id
    };
    const token = signJwtToken(authUser);
    res.status(201).json({
      registered: true,
      message: `Registration confirmed and saved for ${patientRow.id} (${cleanEmail}).`,
      token,
      user: authUser
    });
    return;
  }

  res.status(400).json({ error: 'Unsupported role.' });
});

authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const db = getDb();
  const doctorInfo = user.doctorId
    ? (db.prepare('SELECT * FROM doctors WHERE id = ?').get(user.doctorId) as any)
    : null;
  res.json({
    user: {
      ...user,
      doctorTitle: doctorInfo?.role_title || (user.role === 'DOCTOR' ? 'Clinical Administrator' : undefined),
      phone: doctorInfo?.phone
    }
  });
});

authRouter.post('/logout', authenticateToken, (_req, res) => {
  res.json({ success: true, message: 'Session terminated.' });
});
