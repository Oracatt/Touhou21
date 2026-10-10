import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyEngineLock} from './verify-engine-lock.mjs';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
const cases=[
  {id:'lantern48',stageId:1,attack:'lantern',delay:48,parentType:18,parentCount:1,childCount:5},
  {id:'letter58',stageId:2,attack:'letter',delay:58,parentType:11,parentCount:1,childCount:5},
  {id:'stage2motif54',stageId:2,attack:'motif',delay:54,parentType:11,parentCount:3,childCount:24},
];
let label='road-split',ids=cases.map(value=>value.id),backends=['v8','quickjs'];
for(let index=0;index<args.length;index++){
  if(args[index]==='--label'){label=args[++index];assert.match(label??'',/^[a-z][a-z0-9-]{0,63}$/);}
  else if(args[index]==='--cases')ids=args[++index]?.split(',');
  else if(args[index]==='--backends')backends=args[++index]?.split(',');
  else throw new Error('Unknown road-split option: '+args[index]);
}
assert.ok(ids?.length&&new Set(ids).size===ids.length&&ids.every(id=>cases.some(value=>value.id===id)),'Known unique road-split cases');
assert.ok(backends?.length&&new Set(backends).size===backends.length&&backends.every(value=>['v8','quickjs'].includes(value)),'Known unique native backends');
verifyEngineLock();
const out=path.join(root,'reports',label),build=path.join(root,'build',label);
assert.ok(!fs.existsSync(path.join(out,'report.json')),'Preserve completed evidence using another --label');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(build,{recursive:true});
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const source=()=>Object.fromEntries(fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.ts')).sort().map(name=>[name,sha('src/'+name)]));
const identity=()=>({source:source(),binary:sha('runtime/ts-stg.exe'),engineLock:sha('engine.lock.json'),fixture:sha('tools/road-split-fixture.js'),verifier:sha('tools/verify-road-split.mjs')});
const baseline=identity(),results=[],frames=120,started=new Date().toISOString();
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='backend').map(([key,item])=>[key,normalize(item)])):value;
for(const id of ids){
  const scenario={...cases.find(value=>value.id===id),observeAfter:18,captureFrame:frames};
  const scenarioPath=path.join(build,id+'.json'),entry=path.join(build,id+'.js');
  fs.writeFileSync(scenarioPath,JSON.stringify(scenario));
  fs.writeFileSync(entry,`import {createRoadSplitFixture} from '../../tools/road-split-fixture.js';\nglobalThis.__tsstg_game=createRoadSplitFixture('${path.relative(root,scenarioPath).replaceAll('\\','/')}');\n`);
  const runs=[];
  for(const backend of backends){
    assert.deepEqual(identity(),baseline,'Source and native binary remain stable during verification');
    const prefix=path.join(out,`${id}-${backend}`);
    const command=[path.relative(root,entry),'--root',root,'--backend',backend,'--benchmark','--frames',String(frames),'--screenshot',prefix+'.png','--snapshot',prefix+'.json'];
    const child=spawnSync(path.join(root,'runtime/ts-stg.exe'),command,{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));assert.ifError(child.error);
    assert.equal(child.status,0,`${id}/${backend}: ${(child.stderr??child.stdout??'').slice(-3000)}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));
    assert.equal(state.passed,true);assert.equal(state.splitCount,1);assert.equal(state.sourceVolleyCount,1);
    assert.equal(state.split.fieldAge-state.launch.fieldAge,scenario.delay);assert.equal(state.death.enemyAlive,false);
    assert.equal(state.split.children.length,scenario.childCount);assert.equal(state.memoryWrites,0);
    runs.push({backend,state,pngSha256:sha(prefix+'.png')});
    assert.deepEqual(identity(),baseline,'Native QA leaves production source unchanged');
  }
  if(runs.length===2){assert.deepEqual(normalize(runs[0].state),normalize(runs[1].state),id+': exact native state parity');assert.equal(runs[0].pngSha256,runs[1].pngSha256,id+': exact native pixel parity');}
  results.push({id,passed:true,strictBackendParity:runs.length===2,runs});console.log(`PASS ${id}: ${runs.length} native runs`);
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,started,completed:new Date().toISOString(),identity:baseline,
  scenarios:ids.length,nativeExecutions:results.reduce((sum,value)=>sum+value.runs.length,0),results,
  scope:'Natural campaign road spawning, real Enemy.damage after first launch, live parents retained after source defeat, exact authored split frames, once-only derivation, real native rendering, memory-only userdata, exact V8/QuickJS state and PNG parity.'},null,2)+'\n');
console.log('Report: '+path.join(out,'report.json'));
