import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {spellBackgroundStyle} from '../src/background-art.js';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
let stages=[1,2,3,4,5,6,7],backends=['v8','quickjs'],modes=['road','spell'],frames=36,label='',clockStart=480;
for(let i=0;i<args.length;i++){
  if(args[i]==='--stages')stages=args[++i].split(',').map(Number);
  else if(args[i]==='--backends')backends=args[++i].split(',');
  else if(args[i]==='--modes')modes=args[++i].split(',');
  else if(args[i]==='--frames')frames=Number(args[++i]);
  else if(args[i]==='--label')label=args[++i];
  else if(args[i]==='--clock-start')clockStart=Number(args[++i]);
  else throw new Error(`Unknown argument ${args[i]}`);
}
assert.ok(stages.every(id=>Number.isInteger(id)&&id>=1&&id<=7));
assert.ok(backends.every(backend=>['v8','quickjs'].includes(backend)));
assert.ok(modes.every(mode=>['road','spell'].includes(mode)));
assert.ok(Number.isSafeInteger(frames)&&frames>0&&Number.isSafeInteger(clockStart)&&clockStart>=0,'Positive native frame count and nonnegative starting clock');
assert.ok(!label||/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(label),'Background report label must be a simple directory name');
const binary=path.join(root,'runtime/ts-stg.exe'),out=path.join(root,'reports/backgrounds',label),scratch=path.join(root,'build/background-fixtures',label);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),results=[];
const sourceFiles=['src/background.js','src/background-art.js','src/spell-background.js','src/art.js','tools/background-fixture.js','tools/verify-background.mjs'];
const sourceIdentity=()=>Object.fromEntries(sourceFiles.map(file=>[file,hash(path.join(root,file))]));
const sourceBefore=sourceIdentity(),textureIdentity={};
if(modes.includes('spell'))for(const stage of stages){
  const profile=spellBackgroundStyle(null,stage),base=profile.textures.base,pattern=profile.textures.pattern;
  assert.notEqual(base,pattern,'A spell requires independently authored base and pattern paths');
  const baseHash=hash(path.join(root,base)),patternHash=hash(path.join(root,pattern));
  assert.notEqual(baseHash,patternHash,'Different paths may not alias the same image content');
  textureIdentity[stage]={bossId:profile.bossId,files:{[base]:baseHash,[pattern]:patternHash}};
}
const assertFrozen=()=>{assert.deepEqual(sourceIdentity(),sourceBefore,'Background sources and fixture stay frozen during native verification');
  for(const entry of Object.values(textureIdentity))for(const [file,sha]of Object.entries(entry.files))assert.equal(hash(path.join(root,file)),sha,'Authored spell textures stay frozen during verification');};
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
  const scenario=path.join(scratch,`stage${stage}-${mode}.json`),fixture=path.relative(path.dirname(entry),path.join(root,'tools/background-fixture.js')).replaceAll('\\','/');
  fs.writeFileSync(scenario,JSON.stringify({stage,mode,frames,clockStart}));
  fs.writeFileSync(entry,`import {createBackgroundFixture} from '${fixture}';\nglobalThis.__tsstg_game=createBackgroundFixture('${path.relative(root,scenario).replaceAll('\\','/')}');\n`,{encoding:'utf8'});
  const runs=[];
  for(const backend of backends){
    assertFrozen();
    const prefix=path.join(out,`${backend}-stage${stage}-${mode}`),command=[path.relative(root,entry),'--root',root,
      '--backend',backend,'--frames',String(frames),'--benchmark','--screenshot',prefix+'.png','--snapshot',prefix+'.json'];
    const child=spawnSync(binary,command,{cwd:root,encoding:'utf8',windowsHide:true,timeout:90000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));
    if(child.error)throw child.error;assert.equal(child.status,0,`${backend}/${stage}/${mode}: ${child.stderr}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.stats.stage,stage);
    assert.equal(state.stats.spell,mode==='spell');assert.ok(state.stats.meshCalls>0&&state.stats.meshCalls<=15);assert.ok(state.stats.vertices<2300);
    if(mode==='spell'){
      const proof=state.textureProof,assets=textureIdentity[stage];assert.equal(proof.bossId,assets.bossId);
      assert.deepEqual([...proof.sourceTexturePaths].sort(),Object.keys(assets.files).sort(),'The rendered native meshes use both hashed source images');
      assert.equal(proof.distinctTextureIds.length,2);assert.equal(proof.meshes.length,3);assert.equal(proof.repeatedRenderIdentical,true);
    }
    runs.push({backend,state,pngSha256:hash(prefix+'.png'),log:(child.stdout??'').trim()});
    assertFrozen();
  }
  if(runs.length===2){compareState(runs[0].state,runs[1].state);assert.equal(runs[0].pngSha256,runs[1].pngSha256);}
  results.push({stage,mode,runs});console.log(`PASS stage ${stage} ${mode}`);
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:true,frames,clockStart,captureClock:clockStart+frames,sourceSha256:sourceBefore,
  textureIdentity,artManifestSha256:hash(path.join(root,'assets/art-manifest.json')),binarySha256:hash(binary),results,
  stateComparison:'Exact keys, integers and nonnumeric values; relative 1e-12 tolerance for camera/mesh trigonometry. PNG hashes must be identical.',
  scope:'Production StageBackground rendering: independent base/pattern native texture IDs, source paths and distinct file hashes, authored layer order and blend scope, motion and repeated-draw stability, road compatibility and exact backend PNG parity. No original executable run.'},null,2)+'\n');
