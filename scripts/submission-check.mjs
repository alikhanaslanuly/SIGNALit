import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
const skip=new Set(['node_modules','.git','.codex','.agents','dist','data','coverage','test-results','playwright-report']);
const files=[];const problems=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){if(skip.has(entry.name)||entry.name.startsWith('.env')&&entry.name!=='.env.example')continue;const file=join(dir,entry.name);if(entry.isDirectory())walk(file);else files.push(file);}}
walk('.');
const textTypes=/\.(?:tsx?|jsx?|mjs|css|html|md|json|ya?ml)$/;
for(const file of files){
 if(/\.(db|sqlite|sqlite3|log)(-|$)|signalit-camera-qa-.*\.(json|csv)$/.test(file))problems.push(`${file}: generated private data must be excluded`);
 if(statSync(file).size>20*1024*1024)problems.push(`${file}: unexpected file above 20 MB`);
 if(!textTypes.test(file)||file.startsWith('public/models/wasm/'))continue;
 const source=readFileSync(file,'utf8');
 if(/\/Users\/[^\s]+|[A-Z]:\\(?:Users|Desktop|Downloads)\\/.test(source))problems.push(`${file}: personal filesystem path`);
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-proj-|ghp_)[a-zA-Z0-9_-]{20,}/.test(source))problems.push(`${file}: possible credential`);
 if(file.endsWith('.md'))for(const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  const link=match[1].split('#')[0];if(!link||/^[a-z]+:|^\//i.test(link))continue;
  if(!existsSync(resolve(dirname(file),decodeURIComponent(link))))problems.push(`${file}: broken relative link ${link}`);
 }
}
const docs=files.filter(file=>file.endsWith('.md')).map(file=>readFileSync(file,'utf8')).join('\n');
for(const file of files.filter(file=>file.startsWith('docs/assets/')&&/\.png$/.test(file)))if(!docs.includes(file.split('/').at(-1)))problems.push(`${file}: unreferenced screenshot`);
if(problems.length){for(const problem of problems)process.stderr.write(problem+'\n');process.exitCode=1;}else process.stdout.write(`Submission source check passed (${files.length} files; local env, dependencies, databases and build output excluded).\n`);
if(!existsSync('.git'))process.stdout.write('Source archive: no .git directory; tracked-file status cannot be verified.\n');
