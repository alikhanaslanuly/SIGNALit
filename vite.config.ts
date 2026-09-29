import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { publicApiOrigin } from './scripts/build-config.ts';
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const production=command==='build'; const allowLocal=process.env.SIGNAL_ALLOW_LOCAL_API==='1';
  let value=process.env.VITE_API_URL ?? env.VITE_API_URL ?? '';
  if(production&&!allowLocal&&process.env.VITE_API_URL===undefined&&/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(value)) {
    process.stdout.write('Build: ignoring the development loopback API from a local env file; using same-origin API.\n'); value='';
  }
  const api=publicApiOrigin(value,production,allowLocal);
  let revision='local'; try {revision=execFileSync('git',['rev-parse','--short','HEAD'],{stdio:['ignore','pipe','ignore'],encoding:'utf8'}).trim();} catch { /* Source archive without git metadata. */ }
  const build=`${revision} · ${new Date().toISOString()}`;
  const proxyPort=process.env.SIGNAL_DEMO_PROXY_PORT ?? (command==='serve' ? '4000' : undefined);
  const proxy=proxyPort ? Object.fromEntries(['/api','/health','/ready','/socket.io'].map(path=>[path,{target:`http://127.0.0.1:${proxyPort}`,ws:true,changeOrigin:true}])) : undefined;
  return {plugins:[react()],server:{proxy},define:{'import.meta.env.VITE_API_URL':JSON.stringify(api),__SIGNAL_BUILD__:JSON.stringify(build)}};
});
