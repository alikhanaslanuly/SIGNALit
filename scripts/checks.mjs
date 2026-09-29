import { spawnSync } from 'node:child_process';
const full=process.argv.includes('--full');
const commands=['typecheck','server:typecheck','test','server:build',...(full?['test:realtime','test:e2e']:[]),'build','submission:check'];
for(const script of commands){
  const windows=process.platform==='win32';
  const command=windows?(process.env.ComSpec??'cmd.exe'):'npm';
  const args=windows?['/d','/s','/c','npm','run',script]:['run',script];
  const result=spawnSync(command,args,{stdio:'inherit',env:process.env});
  if(result.error)console.error(`Could not run ${script}:`,result.error);
  if(result.status!==0){process.exitCode=result.status??1;break;}
}
