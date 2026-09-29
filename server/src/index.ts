import { createRuntime } from './runtime.js';
import { createDatabase } from './db/database.js';
import { serverConfig } from './config.js';
let config: ReturnType<typeof serverConfig>;
try { config=serverConfig(); } catch (error) { process.stderr.write(`Configuration error: ${(error as Error).message}\n`); process.exit(1); }
const runtime = createRuntime({ db: createDatabase(config.database) });
const port = config.port;
runtime.httpServer.listen(port, () => { process.stdout.write(`SIGNALit server listening on ${port}\n`); });
const shutdown = () => { runtime.io.close(() => { runtime.db.close(); process.exit(0); }); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
