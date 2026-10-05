import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
let stages=[1,2,3,4,5,6,7],backends=['v8','quickjs'],modes=['road','spell'],frames=36;
for(let i=0;i<args.length;i++){
  if(args[i]==='--stages')stages=args[++i].split(',').map(Number);
  else if(args[i]==='--backends')backends=args[++i].split(',');
  else if(args[i]==='--modes')modes=args[++i].split(',');
  else if(args[i]==='--frames')frames=Number(args[++i]);
  else throw new Error(`Unknown argument ${args[i]}`);
}
assert.ok(stages.every(id=>Number.isInteger(id)&&id>=1&&id<=7));
assert.ok(backends.every(backend=>['v8','quickjs'].includes(backend)));
assert.ok(modes.every(mode=>['road','spell'].includes(mode)));
const binary=path.join(root,'runtime/ts-stg.exe'),out=path.join(root,'reports/backgrounds'),scratch=path.join(root,'build/background-fixtures');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),results=[];
function compareState(a,b,location='$'){
  if(typeof a==='number'&&typeof b==='number'){
    if(Number.isInteger(a)&&Number.isInteger(b))assert.equal(a,b,location);
    else assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b)),`${location}: ${a} != ${b}`);
  }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
    assert.deepEqual(Object.keys(a),Object.keys(b),location);
    for(const key of Object.keys(a))compareState(a[key],b[key],`${location}.${key}`);
  }else assert.equal(a,b,location);
}
for(const stage of stages)for(const mode of modes){
  const entry=path.join(scratch,`stage${stage}-${mode}.js`);
  fs.writeFileSync(entry,`
import {DrawList} from '@ts-stg/thlib';
import {GameArt} from '../../src/art.js';
import {StageBackground} from '../../src/background.js';
const background=new StageBackground({art:new GameArt(tsstg)});let frame=0;
globalThis.__tsstg_game={
  update(){frame++;},
  render(){const draw=new DrawList();draw.clear(0x07101cff).scissor(48,24,576,672);
    background.draw(draw,{frame:480+frame,spell:{active:${mode==='spell'}}},{stage:${stage}});
    draw.scissorEnd().rect(630,24,300,672,0x0e1927ff).text('REALTIME 3D',653,64,23,0xe4dcbbff)
      .text('STAGE ${stage} / ${mode.toUpperCase()}',653,104,17,0x809dadff);
    return draw.commands;
  },
  snapshot(){return{frame,stats:background.stats};}
};
`,{encoding:'utf8'});
  const runs=[];
  for(const backend of backends){
    const prefix=path.join(out,`${backend}-stage${stage}-${mode}`),command=[path.relative(root,entry),'--root',root,
      '--backend',backend,'--frames',String(frames),'--benchmark','--screenshot',prefix+'.png','--snapshot',prefix+'.json'];
    const child=spawnSync(binary,command,{cwd:root,encoding:'utf8',windowsHide:true,timeout:90000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));
    if(child.error)throw child.error;assert.equal(child.status,0,`${backend}/${stage}/${mode}: ${child.stderr}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.stats.stage,stage);
    assert.equal(state.stats.spell,mode==='spell');assert.ok(state.stats.meshCalls>0&&state.stats.meshCalls<=7);
    runs.push({backend,state,pngSha256:hash(prefix+'.png'),log:(child.stdout??'').trim()});
  }
  if(runs.length===2){compareState(runs[0].state,runs[1].state);assert.equal(runs[0].pngSha256,runs[1].pngSha256);}
  results.push({stage,mode,runs});console.log(`PASS stage ${stage} ${mode}`);
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,sourceSha256:hash(path.join(root,'src/background.js')),artManifestSha256:hash(path.join(root,'assets/art-manifest.json')),
  binarySha256:hash(binary),results,stateComparison:'Exact keys, integers and nonnumeric values; relative 1e-12 tolerance for camera trigonometry. PNG hashes must be identical.',scope:'Original world-space textured planes, camera, painter ordering, portrait viewport and backend parity. No original executable run.'},null,2)+'\n');
