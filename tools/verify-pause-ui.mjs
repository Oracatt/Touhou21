import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const allIds=['pause-main','pause-exit-no','pause-exit-yes','pause-restart','pause-replay','gameover-normal','gameover-practice'];
const options={baseline:false,ids:null,backends:null},args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  if(args[i]==='--baseline')options.baseline=true;
  else if(args[i]==='--cases')options.ids=args[++i]?.split(',');
  else if(args[i]==='--backends')options.backends=args[++i]?.split(',');
  else throw new Error(`Unknown option ${args[i]}`);
}
const ids=options.ids??(options.baseline?['pause-main']:allIds),backends=options.backends??(options.baseline?['v8']:['v8','quickjs']);
assert.ok(ids.length&&new Set(ids).size===ids.length&&ids.every(id=>allIds.includes(id)),'Known unique scenario IDs');
assert.ok(backends.length&&new Set(backends).size===backends.length&&backends.every(id=>['v8','quickjs'].includes(id)),'Known unique backends');
const root=path.resolve(import.meta.dirname,'..'),label='pause-layer-order',out=path.join(root,'reports',label,...options.baseline?['baseline']:[]),build=path.join(root,'build',label,options.baseline?'baseline':'fixed');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(build,{recursive:true});
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const tree=(directory,extension=null)=>Object.fromEntries(fs.readdirSync(path.join(root,directory),{recursive:true}).filter(name=>fs.statSync(path.join(root,directory,name)).isFile()&&(!extension||name.endsWith(extension))).map(name=>`${directory}/${name.replaceAll('\\','/')}`).sort().map(file=>[file,sha(file)]));
const identity=()=>({gameSourceHashes:{'main.js':sha('main.js'),...tree('src','.js')},publicSourceHashes:tree('packages/thlib/src'),
  engineLockSha256:sha('engine.lock.json'),binarySha256:sha('runtime/ts-stg.exe'),fixtureSha256:sha('tools/pause-ui-fixture.js'),verifierSha256:sha('tools/verify-pause-ui.mjs')});
const before=identity(),frames=90,results=[];
const normalise=value=>Array.isArray(value)?value.map(normalise):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='backend').map(([key,item])=>[key,normalise(item)])):value;
for(const id of ids){
  const scenario=path.join(build,`${id}.json`),entry=path.join(build,`${id}.js`);
  fs.writeFileSync(scenario,JSON.stringify({id,legacy:options.baseline,captureFrame:frames}));
  const relative=path.relative(root,scenario).replaceAll('\\','/');
  fs.writeFileSync(entry,`import {createPauseUiFixture} from '../../../tools/pause-ui-fixture.js';\nglobalThis.__tsstg_game=createPauseUiFixture('${relative}');\n`);
  const runs=[];
  for(const backend of backends){
    const prefix=path.join(out,`${id}-${backend}`),child=spawnSync(path.join(root,'runtime/ts-stg.exe'),[path.relative(root,entry),'--root',root,'--backend',backend,'--benchmark','--frames',String(frames),'--screenshot',prefix+'.png','--snapshot',prefix+'.json'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));if(child.error)throw child.error;
    assert.equal(child.status,0,`${id}/${backend}: ${(child.stderr??'').slice(-1500)}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.passed,true);assert.equal(state.id,id);assert.equal(state.orderCorrect,!options.baseline);
    runs.push({backend,state,pngSha256:sha(prefix+'.png')});
    assert.deepEqual(identity(),before,'Business/public sources, fixture, lock and binary stay frozen during validation');
  }
  if(runs.length===2){assert.deepEqual(normalise(runs[0].state),normalise(runs[1].state),`${id}: exact state parity`);assert.equal(runs[0].pngSha256,runs[1].pngSha256,`${id}: exact PNG parity`);}
  results.push({id,passed:true,runs});console.log(`${options.baseline?'BASELINE':'PASS'} ${id}: ${runs.length} actual native execution(s)`);
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,baseline:options.baseline,
  scope:'Focused real App pause inputs and explicitly API-entered public GameOver result panels. No baseline reuse, campaign, collision or audio-quality claim.',
  scenarios:ids.length,nativeExecutions:results.reduce((sum,item)=>sum+item.runs.length,0),identity:before,results},null,2)+'\n');
