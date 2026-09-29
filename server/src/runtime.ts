import { serverConfig } from './config.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { createBroadcaster, setupSocket } from './realtime/socket.js';
import type { Broadcast } from './realtime/socket.js';

/** Express must be attached before Socket.IO wraps the HTTP request handler. */
export function createRuntime(options: { db?: import('better-sqlite3').Database } = {}) {
  let broadcast: Broadcast = () => undefined;
  const runtime = createApp({ ...options, broadcast: (...args) => broadcast(...args) });
  const httpServer = createServer(runtime.app);
  const io = new Server(httpServer, { cors: { origin: serverConfig().origins } });
  broadcast = createBroadcaster(io);
  setupSocket(io);
  return { ...runtime, httpServer, io };
}
