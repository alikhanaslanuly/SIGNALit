export interface ServerConfig { origins: string[]; port: number; database: string }
export function serverConfig(env: Record<string,string|undefined> = process.env): ServerConfig {
  const production = env.NODE_ENV === 'production';
  if (production && !env.FRONTEND_ORIGIN?.trim()) throw new Error('FRONTEND_ORIGIN is required in production. Set the exact HTTPS frontend origin.');
  if (production && (!env.SIGNAL_DB_PATH?.trim() || env.SIGNAL_DB_PATH?.trim() === ':memory:')) throw new Error('SIGNAL_DB_PATH must name a persistent database file in production.');
  const origins = (env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://localhost:4173').split(',').map(value=>value.trim());
  for (const origin of origins) {
    let url: URL; try { url=new URL(origin); } catch { throw new Error('FRONTEND_ORIGIN contains an invalid origin.'); }
    if (!['http:','https:'].includes(url.protocol) || url.origin!==origin || url.username || url.password) throw new Error('FRONTEND_ORIGIN must contain exact HTTP(S) origins without paths or wildcards.');
    if (production && url.protocol!=='https:') throw new Error('Production FRONTEND_ORIGIN must use HTTPS.');
  }
  const port=Number(env.PORT??4000);
  if (!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT must be an integer between 1 and 65535.');
  return {origins,port,database:env.SIGNAL_DB_PATH?.trim()||'./data/signalit.db'};
}
