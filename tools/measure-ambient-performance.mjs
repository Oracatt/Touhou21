import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inventoryTree} from './verify-engine-lock.mjs';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
let binaryPath='runtime/ts-stg.exe',label=`ambient-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}`;
let stages=[1,2,3,4,5,6,7],backends=['v8','quickjs'],frames=240,warmup=60,preRoll=900,prepareOnly=false;
for(let i=0;i<args.length;i++){
  if(args[i]==='--binary')binaryPath=args[++i];
  else if(args[i]==='--label')label=args[++i];
  else if(args[i]==='--stages')stages=args[++i].split(',').map(Number);
  else if(args[i]==='--backends')backends=args[++i].split(',');
  else if(args[i]==='--frames')frames=Number(args[++i]);
  else if(args[i]==='--warmup')warmup=Number(args[++i]);
  else if(args[i]==='--preroll')preRoll=Number(args[++i]);
  else if(args[i]==='--prepare-only')prepareOnly=true;
  else throw new Error(`Unknown argument ${args[i]}`);
}
assert.ok(stages.length&&new Set(stages).size===stages.length&&stages.every(stage=>Number.isInteger(stage)&&stage>=1&&stage<=7));
assert.ok(backends.length&&new Set(backends).size===backends.length&&backends.every(backend=>['v8','quickjs'].includes(backend)));
assert.ok(Number.isSafeInteger(frames)&&Number.isSafeInteger(warmup)&&warmup>0&&frames>warmup);
assert.ok(Number.isSafeInteger(preRoll)&&preRoll>=0&&Math.ceil(preRoll/64)<warmup,'Preroll must finish before measured renders');
assert.match(label,/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);
const binary=path.resolve(root,binaryPath);assert.ok(fs.statSync(binary).isFile());
const plan={binary,label,stages,backends,frames,warmup,measuredFrames:frames-warmup,preRoll,runs:stages.length*backends.length*2};
if(prepareOnly){console.log(JSON.stringify({prepared:true,...plan},null,2));process.exit(0);}
const out=path.join(root,'reports/ambient-performance',label),scratch=path.join(root,'build/ambient-performance-fixtures',label);
assert.ok(!fs.existsSync(out)&&!fs.existsSync(scratch),'Use a new label to preserve existing performance evidence');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const scriptFiles=directory=>fs.readdirSync(path.join(root,directory),{recursive:true})
  .filter(name=>/\.(?:ts|js|json)$/.test(name)).map(name=>`${directory}/${name.split(path.sep).join('/')}`);
const resourceFiles=directory=>fs.readdirSync(path.join(root,directory),{recursive:true})
  .map(name=>`${directory}/${name.split(path.sep).join('/')}`).filter(file=>fs.statSync(path.join(root,file)).isFile());
const localNativeLibraries=()=>fs.readdirSync(path.dirname(binary)).filter(name=>/\.dll$/i.test(name)).map(name=>path.join(path.dirname(binary),name));
const identity=()=>Object.fromEntries([...new Set(['main.ts','engine.lock.json','assets/art-manifest.json',
  'tools/ambient-performance-fixture.js','tools/measure-ambient-performance.mjs',
  ...scriptFiles('src'),...scriptFiles('dist'),...scriptFiles('packages/thlib'),
  ...resourceFiles('assets'),...resourceFiles('packages/thlib/assets'),...localNativeLibraries()])]
  .sort().map(file=>[file,hash(path.resolve(root,file))]));
const sourceBefore=identity(),binaryBefore=hash(binary);
const userdata=()=>fs.existsSync(path.join(root,'userdata'))?inventoryTree(path.join(root,'userdata')):[];
const userdataBefore=userdata();
const frozen={sources:true,binary:true,userdata:true};
const assertFrozen=()=>{const currentSource=identity(),currentBinary=hash(binary),currentUserdata=userdata();
  frozen.sources=JSON.stringify(currentSource)===JSON.stringify(sourceBefore);frozen.binary=currentBinary===binaryBefore;
  frozen.userdata=JSON.stringify(currentUserdata)===JSON.stringify(userdataBefore);
  assert.deepEqual(currentSource,sourceBefore,'Sources, compiled code, library and fixture must stay frozen');
  assert.equal(currentBinary,binaryBefore,'Native binary must stay frozen');assert.deepEqual(currentUserdata,userdataBefore,'Userdata must remain unchanged');};
const runs=[],pairs=[],comparisons=[];
const saveReport=complete=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:complete,...plan,binarySha256:binaryBefore,
  sourceSha256:sourceBefore,sourceFrozen:frozen.sources,binaryFrozen:frozen.binary,userdataUnchanged:frozen.userdata,runs,pairs,comparisons,
  conditions:`Serial real GPU; ${frames} total native renders, ${warmup} discarded warmup, ${frames-warmup} measured frames; ${preRoll} additional identical updates during warmup only. Peaks cover measured frames. Stationary invincible player, input mask 0, identical seed/clock/workload per ON/OFF pair. Only OFF overrides production atmosphere.draw with empty stats. Muted audio is still loaded and called. No native userdata writes.`,
  interpretation:'Deltas are ON minus OFF for matched scenes, not a universal bound. renderMs is native renderJsMs (JS command generation); gpuMs is the actual asynchronous GL timer. Existing other GPU applications and run-to-run scheduling can affect these short samples.'},null,2)+'\n');
function verifyState(state,ambient,stage,backend){
  assert.equal(state.backend,backend,'The native fixture must execute the requested backend');
  assert.equal(state.stage,stage);assert.equal(state.ambient,ambient);assert.equal(state.frame,frames);
  assert.equal(state.preRollRemaining,0);assert.equal(state.measured.frames,frames-warmup);
  assert.equal(state.measured.lastClock-state.measured.firstClock,frames-warmup-1,'One advancing road clock per measured render');
  assert.equal(state.nativeUserdataWrites,0);assert.equal(state.rngTrace.length,frames-warmup);
  assert.equal(state.measured.ambientFrames,ambient?frames-warmup:0);
  if(ambient){assert.ok(state.peak.particles>0);assert.ok(state.peak.meshCalls>0&&state.peak.meshCalls<=4);assert.ok(state.peak.vertices>0&&state.peak.vertices<=600);}
  else for(const key of ['particles','meshCalls','vertices'])assert.equal(state.peak[key],0);
}
function equalGameplay(a,b,message){
  assert.deepEqual(a.application,b.application,`${message}: full gameplay snapshot`);
  assert.deepEqual(a.rngTrace,b.rngTrace,`${message}: game, visual and director RNG trace`);
  assert.equal(a.gameplayHash,b.gameplayHash,`${message}: gameplay hash`);
  for(const key of ['bullets','lasers'])assert.equal(a.peak[key],b.peak[key],`${message}: peak ${key}`);
  for(const key of ['firstClock','lastClock','frames'])assert.equal(a.measured[key],b.measured[key],`${message}: measured ${key}`);
}
try{
  for(const stage of stages){
    const stageStates=new Map();
    for(const [backendIndex,backend]of backends.entries()){
      const states=new Map(),metrics=new Map(),order=(stage+backendIndex)%2?[false,true]:[true,false];
      for(const ambient of order){
        assertFrozen();const id=`stage${stage}-${backend}-${ambient?'on':'off'}`,prefix=path.join(out,id);
        const scenario={stage,ambient,frames,warmup,preRoll,mask:0},scenarioPath=path.join(scratch,id+'.json'),entry=path.join(scratch,id+'.js');
        fs.writeFileSync(scenarioPath,JSON.stringify(scenario));
        const fixture=path.relative(path.dirname(entry),path.join(root,'tools/ambient-performance-fixture.js')).replaceAll('\\','/');
        fs.writeFileSync(entry,`import {createAmbientPerformanceFixture} from '${fixture}';\nglobalThis.__tsstg_game=createAmbientPerformanceFixture('${path.relative(root,scenarioPath).replaceAll('\\','/')}');\n`);
        const command=[path.relative(root,entry),'--root',root,'--backend',backend,'--benchmark','--frames',String(frames),
          '--profile-warmup',String(warmup),'--profile',prefix+'-profile.json','--snapshot',prefix+'-state.json'];
        const child=spawnSync(binary,command,{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
        fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));if(child.error)throw child.error;
        assert.equal(child.status,0,`${id}: ${child.stderr}`);
        const profile=JSON.parse(fs.readFileSync(prefix+'-profile.json','utf8')),state=JSON.parse(fs.readFileSync(prefix+'-state.json','utf8'));
        assert.equal(profile.headless,false);assert.equal(profile.benchmark,true);assert.equal(profile.gpuTimer,'GL_TIME_ELAPSED');
        assert.match(profile.backend,backend==='v8'?/^V8\b/:/^QuickJS\b/,'Profiler backend agrees with the requested backend');
        assert.equal(profile.renderFrames,frames);assert.equal(profile.warmupRenderFrames,warmup);
        assert.equal(profile.metrics.updatesPerRender.mean,1);assert.equal(profile.metrics.frameWorkMs.samples,frames-warmup);
        assert.equal(profile.metrics.gpuMs.samples,frames-warmup);verifyState(state,ambient,stage,backend);assertFrozen();
        const run={id,stage,backend,ambient,peak:state.peak,measured:state.measured,gameplayHash:state.gameplayHash,
          atmosphere:state.lastAmbient,memoryWrites:state.memoryWrites,workMs:profile.metrics.frameWorkMs,renderMs:profile.metrics.renderJsMs,
          updateMs:profile.metrics.updateJsMs,decodeMs:profile.metrics.decodeMs,submitMs:profile.metrics.submitMs,gpuMs:profile.metrics.gpuMs,device:profile.gpuDevice};
        runs.push(run);states.set(ambient,state);metrics.set(ambient,run);saveReport(false);
        console.log(`${id}: work P95 ${run.workMs.p95.toFixed(3)} ms, render P95 ${run.renderMs.p95.toFixed(3)} ms, GPU P95 ${run.gpuMs.p95.toFixed(3)} ms`);
      }
      const on=metrics.get(true),off=metrics.get(false);equalGameplay(states.get(true),states.get(false),`stage${stage}/${backend} ON/OFF`);
      assert.equal(on.device,off.device,'A matched pair uses the same GPU');
      pairs.push({stage,backend,gameplayIdentical:true,rngTraceIdentical:true,gameplayHash:on.gameplayHash,clock:on.measured,
        peakBullets:on.peak.bullets,peakLasers:on.peak.lasers,atmosphere:on.atmosphere,
        workP95Ms:{off:off.workMs.p95,on:on.workMs.p95,delta:on.workMs.p95-off.workMs.p95},
        renderP95Ms:{off:off.renderMs.p95,on:on.renderMs.p95,delta:on.renderMs.p95-off.renderMs.p95},
        gpuP95Ms:{off:off.gpuMs.p95,on:on.gpuMs.p95,delta:on.gpuMs.p95-off.gpuMs.p95}});
      stageStates.set(backend,states);saveReport(false);
    }
    if(backends.length===2){
      for(const ambient of [false,true])equalGameplay(stageStates.get('v8').get(ambient),stageStates.get('quickjs').get(ambient),`stage${stage}/${ambient?'ON':'OFF'} backend parity`);
      comparisons.push({stage,backendGameplayIdentical:true,backendRngTraceIdentical:true});
    }
  }
  assertFrozen();saveReport(true);console.log(`PASS ${runs.length} serial GPU runs, ${pairs.length} ON/OFF pairs: ${path.join(out,'report.json')}`);
}catch(error){try{assertFrozen();}catch{}saveReport(false);throw error;}
