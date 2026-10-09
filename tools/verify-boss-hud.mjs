import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const allowedIds=['main-nonspell','midboss-nonspell','spell-clock','dialogue-hidden','midboss-escape','midboss-hold','midboss-hold-edge','midboss-escape-start'];
const options={label:'boss-hud',ids:allowedIds.slice(0,5)},args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  if(args[i]==='--label'){assert.ok(args[i+1]&&/^[a-z][a-z0-9-]{0,63}$/.test(args[i+1]),'Use a simple report label');options.label=args[++i];}
  else if(args[i]==='--cases'){assert.ok(args[i+1],'--cases requires comma-separated scenario IDs');options.ids=args[++i].split(',');}
  else throw new Error(`Unknown option ${args[i]}`);
}
assert.ok(options.ids.length>0&&new Set(options.ids).size===options.ids.length&&options.ids.every(id=>allowedIds.includes(id)),'Scenario IDs must be unique and known');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'reports',options.label),build=path.join(root,'build',options.label);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(build,{recursive:true});
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const sources=()=>Object.fromEntries(fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(name=>name.endsWith('.ts')).map(name=>`src/${name.replaceAll('\\','/')}`).sort().map(file=>[file,sha(file)]));
const before=sources(),binary=sha('runtime/ts-stg.exe'),fixture=sha('tools/boss-hud-fixture.js'),frames=220,results=[];
const ids=options.ids;
const normalise=value=>Array.isArray(value)?value.map(normalise):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='backend').map(([key,item])=>[key,normalise(item)])):value;
function compare(a,b,label='$'){
  if(typeof a==='number'&&typeof b==='number'){assert.ok(Math.abs(a-b)<=1e-12,`${label}: backend number difference`);}
  else if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const key of Object.keys(a))compare(a[key],b[key],`${label}.${key}`);}
  else assert.equal(a,b,label);
}
for(const id of ids){
  const scenario=`build/${options.label}/${id}.json`,entry=`build/${options.label}/${id}.js`,runs=[];
  fs.writeFileSync(path.join(root,scenario),JSON.stringify({id,captureFrame:frames}));
  fs.writeFileSync(path.join(root,entry),`import {createBossHudFixture} from '../../tools/boss-hud-fixture.js';\nglobalThis.__tsstg_game=createBossHudFixture('${scenario}');\n`);
  for(const backend of ['v8','quickjs']){
    const prefix=path.join(out,`${id}-${backend}`),child=spawnSync(path.join(root,'runtime/ts-stg.exe'),[entry,'--root',root,'--backend',backend,'--benchmark','--frames',String(frames),'--screenshot',prefix+'.png','--snapshot',prefix+'.json'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));if(child.error)throw child.error;
    assert.equal(child.status,0,`${id}/${backend}: ${child.stderr}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.passed,true);assert.equal(state.id,id);
    runs.push({backend,state,pngSha256:sha(prefix+'.png')});
  }
  compare(normalise(runs[0].state),normalise(runs[1].state),id);assert.equal(runs[0].pngSha256,runs[1].pngSha256,`${id}: exact PNG parity`);
  results.push({id,passed:true,runs});console.log(`PASS ${id}: V8 + QuickJS / exact PNG parity`);
  assert.deepEqual(sources(),before,'Production source remains frozen during targeted GPU verification');
}
assert.equal(sha('runtime/ts-stg.exe'),binary);assert.equal(sha('tools/boss-hud-fixture.js'),fixture);
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,scope:`${ids.length} focused production HUD/body scenarios, two actual native GPU backends. No baseline reuse or full-campaign claim.`,scenarios:ids.length,nativeExecutions:results.reduce((sum,result)=>sum+result.runs.length,0),sourceHashes:before,binarySha256:binary,fixtureSha256:fixture,results},null,2)+'\n');
