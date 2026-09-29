import type { Server } from 'socket.io';
import type { RealtimeEvent } from '../types.js';

export type Broadcast = (event: RealtimeEvent, payload: unknown, patientId?: string) => void;

export function createBroadcaster(io: Pick<Server, 'to'>): Broadcast {
  return (event, payload, patientId) => {
    io.to('nurses').emit(event, payload);
    if (patientId) io.to(`patient:${patientId}`).emit(event, payload);
  };
}

export function setupSocket(io: Server): void {
  io.on('connection', socket => {
    socket.on('join:nurses', async (ack?: () => void) => { await socket.join('nurses'); if (typeof ack === 'function') ack(); });
    socket.on('join:patient', async (patientId: unknown, ack?: () => void) => {
      if (typeof patientId === 'string' && patientId.length > 0 && patientId.length <= 100) { await socket.join(`patient:${patientId}`); if (typeof ack === 'function') ack(); }
    });
  });
}
