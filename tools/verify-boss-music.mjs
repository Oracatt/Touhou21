import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyEngineLock} from './verify-engine-lock.mjs';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
let label='boss-music',backends=['v8','quickjs'];
for(let i=0;i<args.length;i++){
  if(args[i]==='--label')label=args[++i];else if(args[i]==='--backends')backends=args[++i].split(',');else throw new Error('Unknown option '+args[i]);
}
assert.match(label,/^[a-z][a-z0-9-]{0,63}$/);
assert.ok(backends.length&&new Set(backends).size===backends.length&&backends.every(value=>['v8','quickjs'].includes(value)));
verifyEngineLock();
const cases=['normal','fast','pause','exit','restart'].map(kind=>({id:`stage01-${kind}`,stageId:1,kind}));
const out=path.join(root,'reports',label),scratch=path.join(root,'build',label),binary=path.join(root,'runtime/ts-stg.exe');
assert.ok(!fs.existsSync(path.join(out,'report.json')),'Choose a new label to preserve previous reports');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const tree=directory=>Object.fromEntries(fs.readdirSync(path.join(root,directory),{recursive:true}).filter(file=>fs.statSync(path.join(root,directory,file)).isFile())
  .map(file=>`${directory}/${file.replaceAll('\\','/')}`).sort().map(file=>[file,sha(file)]));
const identity=()=>({source:tree('src'),publicSource:tree('packages/thlib/src'),engineLock:sha('engine.lock.json'),binary:sha(binary),
  music:tree('assets/music'),fixture:sha('tools/boss-music-fixture.js'),verifier:sha('tools/verify-boss-music.mjs')});
const before=identity(),results=[];
for(const scenario of cases){
  const config=path.join(scratch,scenario.id+'.json'),entry=path.join(scratch,scenario.id+'.js');
  fs.writeFileSync(config,JSON.stringify(scenario));
  fs.writeFileSync(entry,`import {createBossMusicFixture} from '../../tools/boss-music-fixture.js';\nglobalThis.__tsstg_game=createBossMusicFixture('${path.relative(root,config).replaceAll('\\','/')}');\n`);
  const runs=[];
  for(const backend of backends){
    assert.deepEqual(identity(),before,'Production inputs remain frozen before native verification');
    const prefix=path.join(out,`${scenario.id}-${backend}`),command=[path.relative(root,entry),'--root',root,'--backend',backend,'--headless','--benchmark','--frames','100','--snapshot',prefix+'.json'];
    const child=spawnSync(binary,command,{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));assert.ifError(child.error);assert.equal(child.status,0,`${scenario.id}/${backend}: ${child.stderr??child.stdout}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.passed,true);assert.equal(state.id,scenario.id);runs.push({backend,state});
    assert.deepEqual(identity(),before,'Native music verification leaves production inputs unchanged');
  }
  if(runs.length===2){const {backend:a,...first}=runs[0].state,{backend:b,...second}=runs[1].state;assert.deepEqual(first,second,'Exact native V8/QuickJS music-event and scene parity');}
  results.push({id:scenario.id,passed:true,runs});console.log(`PASS ${scenario.id}: ${runs.length} native runs`);
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,identity:before,results,
  scope:'Real stage-to-Boss dialogue music cue, caption timing, pause/resume, actual pause-menu exit/retry and native transport observation. Exact V8/QuickJS parity. Speaker playback suppressed; no GPU, persistent window or listening claim.'},null,2)+'\n');
console.log('Report: '+path.join(out,'report.json'));
