import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const scenarios=[
  {id:'s1-reimu-monologue35',stageId:1,character:0,kind:'monologue',age:35},
  {id:'s1-reimu-entry20',stageId:1,character:0,kind:'entry',age:20},
  {id:'s1-reimu-actor70',stageId:1,character:0,kind:'actor',age:70},
  {id:'s1-reimu-actor110',stageId:1,character:0,kind:'actor',age:110},
  {id:'s1-reimu-portrait35',stageId:1,character:0,kind:'portrait',age:35},
  {id:'s1-marisa-actor110',stageId:1,character:1,kind:'actor',age:110},
  {id:'s1-marisa-portrait35',stageId:1,character:1,kind:'portrait',age:35},
  {id:'s6-marisa-actor110',stageId:6,character:1,kind:'actor',age:110},
  {id:'extra-reimu-actor110',stageId:7,character:0,kind:'actor',age:110},
];
const options={ids:null,backends:['v8','quickjs'],label:'dialogue-actor-intro'},args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  if(args[i]==='--cases')options.ids=args[++i]?.split(',');
  else if(args[i]==='--backends')options.backends=args[++i]?.split(',');
  else if(args[i]==='--label'){assert.ok(args[i+1]&&/^[a-z][a-z0-9-]{0,63}$/.test(args[i+1]),'Use a simple independent report label');options.label=args[++i];}
  else throw new Error(`Unknown option ${args[i]}`);
}
const ids=options.ids??scenarios.map(value=>value.id),backends=options.backends;
assert.ok(ids.length&&new Set(ids).size===ids.length&&ids.every(id=>scenarios.some(value=>value.id===id)),'Known unique dialogue scenarios');
assert.ok(backends.length&&new Set(backends).size===backends.length&&backends.every(value=>['v8','quickjs'].includes(value)),'Known unique native backends');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'reports',options.label),build=path.join(root,'build',options.label);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(build,{recursive:true});
assert.ok(!fs.existsSync(path.join(out,'report.json')),'Do not overwrite an existing focused validation report; choose --label');
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const tree=directory=>Object.fromEntries(fs.readdirSync(path.join(root,directory),{recursive:true}).filter(name=>fs.statSync(path.join(root,directory,name)).isFile())
  .map(name=>`${directory}/${name.replaceAll('\\','/')}`).sort().map(file=>[file,sha(file)]));
const identity=()=>({gameSourceHashes:{'main.ts':sha('main.ts'),...tree('src')},publicSourceHashes:tree('packages/thlib/src'),
  engineLockSha256:sha('engine.lock.json'),binarySha256:sha('runtime/ts-stg.exe'),
  fixtureSha256:sha('tools/dialogue-intro-fixture.js'),verifierSha256:sha('tools/verify-dialogue-intro.mjs')});
const before=identity(),frames=90,results=[],started=new Date().toISOString();
const normalise=value=>Array.isArray(value)?value.map(normalise):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='backend').map(([key,item])=>[key,normalise(item)])):value;
for(const id of ids){
  const scenario={...scenarios.find(value=>value.id===id),captureFrame:frames};
  const scenarioPath=path.join(build,`${id}.json`),entryPath=path.join(build,`${id}.js`);
  fs.writeFileSync(scenarioPath,JSON.stringify(scenario));
  const relative=path.relative(root,scenarioPath).replaceAll('\\','/');
  fs.writeFileSync(entryPath,`import {createDialogueIntroFixture} from '../../tools/dialogue-intro-fixture.js';\nglobalThis.__tsstg_game=createDialogueIntroFixture('${relative}');\n`);
  const runs=[];
  for(const backend of backends){
    assert.deepEqual(identity(),before,'Production/public source, lock, fixture and native executable are frozen before each run');
    const prefix=path.join(out,`${id}-${backend}`),begin=performance.now();
    const child=spawnSync(path.join(root,'runtime/ts-stg.exe'),[path.relative(root,entryPath),'--root',root,'--backend',backend,'--benchmark','--frames',String(frames),'--screenshot',prefix+'.png','--snapshot',prefix+'.json'],
      {cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));if(child.error)throw child.error;
    assert.equal(child.status,0,`${id}/${backend}: ${(child.stderr??child.stdout??'').slice(-2000)}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.passed,true);assert.equal(state.id,id);
    runs.push({backend,state,pngSha256:sha(prefix+'.png'),elapsedMs:Math.round(performance.now()-begin)});
    assert.deepEqual(identity(),before,'Production/public source, lock, fixture and native executable stayed frozen during the native run');
  }
  if(runs.length===2){assert.deepEqual(normalise(runs[0].state),normalise(runs[1].state),`${id}: strict native state parity`);assert.equal(runs[0].pngSha256,runs[1].pngSha256,`${id}: exact PNG parity`);}
  results.push({id,passed:true,strictBackendParity:runs.length===2,runs});
  console.log(`PASS ${id}: ${runs.length} actual native GPU execution(s)${runs.length===2?' / strict state and PNG parity':''}`);
}
const report={passed:true,started,completed:new Date().toISOString(),scenarios:ids.length,nativeExecutions:results.reduce((sum,value)=>sum+value.runs.length,0),
  scope:'Focused actual ProjectApplication dialogue input and GPU rendering. No reused baseline, campaign, collision, difficulty or audio-quality claim.',
  identity:before,scenarioTable:scenarios.filter(value=>ids.includes(value.id)),results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Report: ${path.join(out,'report.json')}`);
