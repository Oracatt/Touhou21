import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyEngineLock} from './verify-engine-lock.mjs';

const scenarios=[
  {id:'pickup-timeline',headless:true},
  {id:'point-normal-0',kind:'point-normal',age:0},
  {id:'point-normal-30',kind:'point-normal',age:30},
  {id:'point-full-30',kind:'point-full',age:30},
  {id:'power-up-30',kind:'power-up',age:30},
  {id:'power-full-30',kind:'power-full',age:30},
  {id:'power-up-60',kind:'power-up',age:60},
  {id:'power-up-61',kind:'power-up',age:61},
];
const root=path.resolve(import.meta.dirname,'..'),options={label:'item-score',ids:scenarios.map(s=>s.id),backends:['v8','quickjs']},args=process.argv.slice(2);
for(let index=0;index<args.length;index++){
  if(args[index]==='--cases')options.ids=args[++index]?.split(',');
  else if(args[index]==='--backends')options.backends=args[++index]?.split(',');
  else if(args[index]==='--label'){assert.match(args[index+1]??'',/^[a-z][a-z0-9-]{0,63}$/);options.label=args[++index];}
  else throw new Error('Unknown item-score verifier option: '+args[index]);
}
assert.ok(options.ids?.length&&new Set(options.ids).size===options.ids.length&&options.ids.every(id=>scenarios.some(s=>s.id===id)),'Known unique pickup scenarios');
assert.ok(options.backends?.length&&new Set(options.backends).size===options.backends.length&&options.backends.every(b=>['v8','quickjs'].includes(b)),'Known unique native backends');
verifyEngineLock();
const out=path.join(root,'reports',options.label),build=path.join(root,'build',options.label);
assert.ok(!fs.existsSync(path.join(out,'report.json')),'Preserve prior reports by choosing a new --label');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(build,{recursive:true});
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const tree=directory=>Object.fromEntries(fs.readdirSync(path.join(root,directory),{recursive:true}).filter(name=>fs.statSync(path.join(root,directory,name)).isFile())
  .map(name=>`${directory}/${name.replaceAll('\\','/')}`).sort().map(file=>[file,sha(file)]));
const identity=()=>({source:tree('src'),publicSource:tree('packages/thlib/src'),publicResources:tree('packages/thlib/assets/touhou-common'),
  engineLock:sha('engine.lock.json'),binary:sha('runtime/ts-stg.exe'),artManifest:sha('assets/art-manifest.json'),
  fixture:sha('tools/item-score-fixture.js'),verifier:sha('tools/verify-item-score.mjs')});
const before=identity(),results=[],frames=120,started=new Date().toISOString();
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='backend').map(([key,item])=>[key,normalize(item)])):value;
for(const id of options.ids){
  const scenario={...scenarios.find(s=>s.id===id),captureFrame:frames},scenarioPath=path.join(build,id+'.json'),entry=path.join(build,id+'.js');
  fs.writeFileSync(scenarioPath,JSON.stringify(scenario));
  fs.writeFileSync(entry,`import {createItemScoreFixture} from '../../tools/item-score-fixture.js';\nglobalThis.__tsstg_game=createItemScoreFixture('${path.relative(root,scenarioPath).replaceAll('\\','/')}');\n`);
  const runs=[];
  for(const backend of options.backends){
    assert.deepEqual(identity(),before,'Production and verification identities are frozen before each native run');
    const prefix=path.join(out,`${id}-${backend}`),command=[path.relative(root,entry),'--root',root,'--backend',backend,'--frames',String(frames),'--benchmark','--snapshot',prefix+'.json'];
    if(scenario.headless)command.push('--headless');else command.push('--screenshot',prefix+'.png');
    const child=spawnSync(path.join(root,'runtime/ts-stg.exe'),command,{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));assert.ifError(child.error);
    assert.equal(child.status,0,`${id}/${backend}: ${(child.stderr??child.stdout??'').slice(-3000)}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.passed,true);assert.equal(state.id,id);
    runs.push({backend,state,...scenario.headless?{}:{pngSha256:sha(prefix+'.png')}});
    assert.deepEqual(identity(),before,'Native pickup verification leaves production identities unchanged');
  }
  if(runs.length===2){assert.deepEqual(normalize(runs[0].state),normalize(runs[1].state),id+': exact backend state parity');
    if(!scenario.headless)assert.equal(runs[0].pngSha256,runs[1].pngSha256,id+': exact native PNG parity');}
  results.push({id,passed:true,strictBackendParity:runs.length===2,runs});console.log(`PASS ${id}: ${runs.length} native runs`);
}
const report={passed:true,started,completed:new Date().toISOString(),identity:before,scenarios:options.ids.length,
  nativeExecutions:results.reduce((sum,value)=>sum+value.runs.length,0),results,
  scope:'Actual public pickup awards in the production application; original ASCII960 score/POWER UP glyph geometry and textures; initial/mid/end/expired lifetime; headless score traces and exact native V8/QuickJS state and PNG parity.'};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Report: '+path.join(out,'report.json'));
