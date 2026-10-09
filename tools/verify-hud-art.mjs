import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const scenarios=[
  {id:'road-reimu',kind:'road',character:0,mode:'normal',stageId:1},
  {id:'point-growth',kind:'point-growth',character:0,mode:'normal',stageId:1},
  {id:'nonspell-marisa',kind:'combat',character:1,mode:'stage-practice',stageId:1,age:310},
  {id:'spell-bright',kind:'spell',character:0,mode:'spell-practice',stageId:6,age:240},
  {id:'extra-nonspell',kind:'combat',character:1,mode:'extra',stageId:7,age:310},
  {id:'pause-main',kind:'pause',character:0,mode:'normal',stageId:1},
  {id:'pause-confirm',kind:'pause-confirm',character:0,mode:'normal',stageId:1},
  {id:'gameover-result',kind:'gameover',character:1,mode:'normal',stageId:1},
  ...[5,12,45].map(age=>({id:`pause-continued-${age}`,kind:'pause-continued',character:0,mode:'normal',stageId:1,age})),
  {id:'result-continued',kind:'result-continued',character:0,mode:'normal',stageId:1,age:45},
  {id:'replay-long',kind:'replay',character:1,mode:'normal',stageId:1},
  ...[0,15,30,60,90,120].map(age=>({id:`spell-name-${age}`,kind:'spell',character:1,mode:'spell-practice',stageId:7,spellId:'ex-09',age})),
];
const options={label:'hud-art',ids:scenarios.map(value=>value.id),backends:['v8','quickjs']},args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  if(args[i]==='--cases')options.ids=args[++i]?.split(',');
  else if(args[i]==='--backends')options.backends=args[++i]?.split(',');
  else if(args[i]==='--label'){assert.match(args[i+1]??'',/^[a-z][a-z0-9-]{0,63}$/);options.label=args[++i];}
  else throw new Error(`Unknown option ${args[i]}`);
}
assert.ok(options.ids?.length&&new Set(options.ids).size===options.ids.length&&options.ids.every(id=>scenarios.some(value=>value.id===id)),'Known unique HUD scenarios');
assert.ok(options.backends?.length&&new Set(options.backends).size===options.backends.length&&options.backends.every(value=>['v8','quickjs'].includes(value)),'Known unique backends');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'reports',options.label),build=path.join(root,'build',options.label);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(build,{recursive:true});assert.ok(!fs.existsSync(path.join(out,'report.json')),'Preserve previous reports; choose a new --label');
const sha=file=>createHash('sha256').update(fs.readFileSync(path.resolve(root,file))).digest('hex');
const tree=directory=>Object.fromEntries(fs.readdirSync(path.join(root,directory),{recursive:true}).filter(name=>fs.statSync(path.join(root,directory,name)).isFile())
  .map(name=>`${directory}/${name.replaceAll('\\','/')}`).sort().map(file=>[file,sha(file)]));
const identity=()=>({gameSourceHashes:{'main.js':sha('main.js'),...tree('src')},publicSourceHashes:tree('packages/thlib/src'),
  publicResourceHashes:tree('packages/thlib/assets/touhou-common'),
  engineLockSha256:sha('engine.lock.json'),binarySha256:sha('runtime/ts-stg.exe'),artManifestSha256:sha('assets/art-manifest.json'),
  hudArtworkHashes:Object.fromEntries(['hud-panel','hud-logo'].map(id=>[`assets/art/${id}.png`,sha(`assets/art/${id}.png`)])),
  fixtureSha256:sha('tools/hud-art-fixture.js'),verifierSha256:sha('tools/verify-hud-art.mjs')});
const before=identity(),started=new Date().toISOString(),frames=120,results=[];
const manifest=JSON.parse(fs.readFileSync(path.join(root,'packages/thlib/assets/touhou-common/manifest.json'),'utf8'));
assert.ok(manifest.locales?.['zh-CN']?.archives?.front,'Run only after the public zh-CN resource pack has been synced');
const normalise=value=>Array.isArray(value)?value.map(normalise):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='backend').map(([key,item])=>[key,normalise(item)])):value;
for(const id of options.ids){
  const scenario={...scenarios.find(value=>value.id===id),captureFrame:frames},scenarioPath=path.join(build,`${id}.json`),entry=path.join(build,`${id}.js`);
  fs.writeFileSync(scenarioPath,JSON.stringify(scenario));
  fs.writeFileSync(entry,`import {createHudArtFixture} from '../../tools/hud-art-fixture.js';\nglobalThis.__tsstg_game=createHudArtFixture('${path.relative(root,scenarioPath).replaceAll('\\','/')}');\n`);
  const runs=[];
  for(const backend of options.backends){
    assert.deepEqual(identity(),before,'All production sources, SDK, lock, artwork, fixture and binary are frozen before native execution');
    const prefix=path.join(out,`${id}-${backend}`),start=performance.now();
    const child=spawnSync(path.join(root,'runtime/ts-stg.exe'),[path.relative(root,entry),'--root',root,'--backend',backend,'--benchmark','--frames',String(frames),
      '--screenshot',prefix+'.png','--snapshot',prefix+'.json'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));if(child.error)throw child.error;
    assert.equal(child.status,0,`${id}/${backend}: ${(child.stderr??child.stdout??'').slice(-2000)}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));assert.equal(state.passed,true);assert.equal(state.id,id);
    runs.push({backend,state,pngSha256:sha(prefix+'.png'),elapsedMs:Math.round(performance.now()-start)});
    assert.deepEqual(identity(),before,'Frozen validation identity remained unchanged through native execution');
  }
  if(runs.length===2){assert.deepEqual(normalise(runs[0].state),normalise(runs[1].state),`${id}: strict native state parity`);assert.equal(runs[0].pngSha256,runs[1].pngSha256,`${id}: exact PNG parity`);}
  results.push({id,passed:true,strictBackendParity:runs.length===2,runs});console.log(`PASS ${id}: ${runs.length} native execution(s)${runs.length===2?' / strict state and PNG parity':''}`);
}
const report={passed:true,started,completed:new Date().toISOString(),scenarios:options.ids.length,nativeExecutions:results.reduce((sum,value)=>sum+value.runs.length,0),
  applicationUpdates:results.reduce((sum,value)=>sum+value.runs.reduce((count,run)=>count+run.state.applicationUpdates,0),0),identity:before,
  scope:'Focused production App/public zh-CN HUD and pause/GameOver GPU rendering, memory-only userdata, real Esc/confirmation and replay-list input. GameOver enters via the public API, not death reproduction. The long-value preset follows a verified real replay. No reused baseline, full-campaign, collision, audio-quality or gameplay-balance claim.',
  scenarioTable:scenarios.filter(value=>options.ids.includes(value.id)),results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(`Report: ${path.join(out,'report.json')}`);
