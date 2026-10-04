import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'reports/performance');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'build'),{recursive:true});
const cases=[{id:'title',options:{}},
  {id:'weave-lunatic',options:{autostart:true,mode:'spell-practice',stageId:4,spellId:'s04-03',difficulty:3}},
  {id:'final-lunatic',options:{autostart:true,mode:'spell-practice',stageId:6,spellId:'s06-05',difficulty:3}},
  {id:'marisa-bomb',options:{autostart:true,mode:'spell-practice',stageId:5,spellId:'s05-03',difficulty:3,character:1},bombFrame:250},
  {id:'extra-survival',options:{autostart:true,mode:'spell-practice',stageId:7,spellId:'ex-08',difficulty:4}},
];
const results=[];
for(const scenario of cases){
  fs.writeFileSync(path.join(root,'build/performance-scenario.json'),JSON.stringify(scenario));
  for(const backend of ['v8','quickjs']){
    const prefix=path.join(out,`${scenario.id}-${backend}`);
    const child=spawnSync(path.join(root,'runtime/ts-stg.exe'),['tools/performance-fixture.js','--root',root,'--backend',backend,'--benchmark','--frames','600','--profile-warmup','60','--profile',prefix+'-profile.json','--snapshot',prefix+'-state.json','--screenshot',prefix+'.png'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));if(child.error)throw child.error;assert.equal(child.status,0,child.stderr);
    const profile=JSON.parse(fs.readFileSync(prefix+'-profile.json','utf8')),state=JSON.parse(fs.readFileSync(prefix+'-state.json','utf8'));
    assert.equal(profile.metrics.updatesPerRender.mean,1);assert.equal(profile.headless,false);assert.equal(profile.metrics.frameWorkMs.samples,540);
    results.push({id:scenario.id,backend,peak:state.peak,workMs:profile.metrics.frameWorkMs,updateMs:profile.metrics.updateJsMs,renderMs:profile.metrics.renderJsMs,gpuMs:profile.metrics.gpuMs,device:profile.gpuDevice});
    console.log(`${scenario.id}/${backend}: mean ${profile.metrics.frameWorkMs.mean.toFixed(2)}ms, p95 ${profile.metrics.frameWorkMs.p95.toFixed(2)}ms, peak ${state.peak.bullets} bullets/${state.peak.lasers} lasers`);
  }
}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({binarySha256:createHash('sha256').update(fs.readFileSync(path.join(root,'runtime/ts-stg.exe'))).digest('hex'),results,conditions:'Serial, real GPU, one fixed update per rendered frame, 60 warmup + 540 measured frames. Muted audio still loaded and called. Invincible stationary player, full public effects and real authored geometry. Pre-existing user game is not closed. These samples do not guarantee every attack/input combination.'},null,2)+'\n');
