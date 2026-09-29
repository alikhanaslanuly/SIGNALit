import { spawn } from 'node:child_process';
const backendPort=process.env.PORT??'4000';
const frontendPort=process.env.SIGNAL_DEMO_PORT??'5173';
if(!/^\d+$/.test(frontendPort)||Number(frontendPort)<1||Number(frontendPort)>65535)throw new Error('SIGNAL_DEMO_PORT must be a valid port.');
// One origin for local and LAN browsers; Vite forwards API and Socket.IO to Node.
const children=[spawn(process.execPath,['--import','tsx','server/src/index.ts'],{stdio:'inherit',env:{...process.env,NODE_ENV:'development',PORT:backendPort}}),
  spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0','--port',frontendPort,'--strictPort'],{stdio:'inherit',env:{...process.env,VITE_API_URL:'',SIGNAL_DEMO_PROXY_PORT:backendPort}})];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;const force=setTimeout(()=>{for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');},3000);force.unref();}
for(const child of children){child.on('error',()=>stop(1));child.on('exit',code=>{if(!stopping)stop(code??1);});}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
process.stdout.write(`SIGNALit demo: http://localhost:${frontendPort}/register?demo=1\nCamera QA: http://localhost:${frontendPort}/dashboard/quality/camera-test\nCtrl+C stops both servers. Phone cameras still require trusted HTTPS.\n`);
