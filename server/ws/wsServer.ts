import type { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyJwtToken, type AuthenticatedUser } from '../middleware/auth.ts';
import { getDb } from '../db/database.ts';

interface ClientConnection {
  ws: WebSocket;
  user: AuthenticatedUser;
}

class VitalynxWebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientConnection>();

  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      try {
        const url = new URL(request.url || '/', 'http://localhost');
        if (url.pathname !== '/ws') {
          return;
        }
        const token = url.searchParams.get('token');
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        const user = verifyJwtToken(token);
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.registerClient(ws, user);
        });
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });
  }

  private registerClient(ws: WebSocket, user: AuthenticatedUser): void {
    const conn: ClientConnection = { ws, user };
    this.clients.add(conn);

    ws.send(
      JSON.stringify({
        type: 'ws:connected',
        payload: { userId: user.id, role: user.role, patientId: user.patientId, timestamp: new Date().toISOString() }
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      this.clients.delete(conn);
    });
  }

  broadcastForPatient(patientId: string, eventType: string, payload: unknown): void {
    const db = getDb();
    const row = db
      .prepare('SELECT assigned_doctor_id FROM patients WHERE id = ?')
      .get(patientId) as { assigned_doctor_id: string } | undefined;
    const assignedDoctorId = row?.assigned_doctor_id;

    const frame = JSON.stringify({ type: eventType, payload, timestamp: new Date().toISOString() });

    for (const conn of this.clients) {
      if (conn.ws.readyState !== WebSocket.OPEN) continue;

      const isAuthorizedPatient = conn.user.role === 'PATIENT' && conn.user.patientId === patientId;
      const isAuthorizedDoctor =
        conn.user.role === 'DOCTOR' && Boolean(assignedDoctorId && conn.user.doctorId === assignedDoctorId);

      if (isAuthorizedPatient || isAuthorizedDoctor) {
        conn.ws.send(frame);
      }
    }
  }
}

export const wsHub = new VitalynxWebSocketHub();
