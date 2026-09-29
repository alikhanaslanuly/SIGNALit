import { spawnSync } from 'node:child_process';
const full=process.argv.includes('--full');
const commands=['typecheck','server:typecheck','test','server:build',...(full?['test:realtime','test:e2e']:[]),'build','submission:check'];
for(const script of commands){const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run',script],{stdio:'inherit',env:process.env});if(result.status!==0){process.exitCode=result.status??1;break;}}
