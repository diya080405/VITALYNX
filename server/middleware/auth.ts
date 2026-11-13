import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'vitalynx-dev-clinical-secret-change-in-prod';
const JWT_EXPIRES_IN = '12h';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'DOCTOR' | 'PATIENT';
  name: string;
  doctorId: string | null;
  patientId: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function signJwtToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      doctorId: user.doctorId,
      patientId: user.patientId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyJwtToken(token: string): AuthenticatedUser {
  const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  return {
    id: String(payload.sub),
    email: String(payload.email),
    role: payload.role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT',
    name: String(payload.name),
    doctorId: payload.doctorId ? String(payload.doctorId) : null,
    patientId: payload.patientId ? String(payload.patientId) : null
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : queryToken;

  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  try {
    const decoded = verifyJwtToken(rawToken);
    const db = getDb();
    const userRow = db
      .prepare('SELECT id, email, role, name, doctor_id, patient_id, is_active FROM users WHERE id = ?')
      .get(decoded.id) as any;

    if (!userRow || !userRow.is_active) {
      res.status(401).json({ error: 'Account inactive or not found.' });
      return;
    }

    req.user = {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      name: userRow.name,
      doctorId: userRow.doctor_id,
      patientId: userRow.patient_id
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'DOCTOR') {
    res.status(403).json({ error: 'Forbidden: Clinician authorization required.' });
    return;
  }
  next();
}

export function verifyPatientAccess(user: AuthenticatedUser, patientId: string): boolean {
  if (user.role === 'PATIENT') {
    return user.patientId === patientId;
  }
  if (user.role === 'DOCTOR' && user.doctorId) {
    const db = getDb();
    const row = db
      .prepare('SELECT assigned_doctor_id FROM patients WHERE id = ?')
      .get(patientId) as { assigned_doctor_id: string } | undefined;
    return Boolean(row && row.assigned_doctor_id === user.doctorId);
  }
  return false;
}
