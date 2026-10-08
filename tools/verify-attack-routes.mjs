/** Finite QA search, followed by actual public Game/input replay. Reports are
 * witnesses within a restricted grid, never a proof of human difficulty. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {STAGES,MIDBOSSES} from '../src/content.js';
import {searchAttackRoute,ATTACK_ROUTE_GRID,ATTACK_ROUTE_QA_VERSION} from './attack-routes.mjs';

const root=path.resolve(import.meta.dirname,'..');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inputs=['src/content.js','src/patterns.js','src/danmaku.js',...fs.readdirSync(path.join(root,'src','attacks')).sort().map(file=>`src/attacks/${file}`),'engine.lock.json','tools/attack-routes.mjs','tools/verify-attack-routes.mjs'];
export function attackRouteCases({kind='spell'}={}){
  assert.ok(['spell','nonspell','all'].includes(kind));const cases=[];
  for(const stage of STAGES){const difficulty=stage.id===7?4:1;
    if(kind!=='nonspell')stage.spells.forEach((card,spellIndex)=>cases.push({id:card.id,name:card.name,kind:'spell',stageId:stage.id,spellIndex,difficulty,frames:Math.round(card.seconds*60)}));
    if(kind!=='spell')stage.spells.forEach((_,group)=>cases.push({id:`nonspell-${stage.id}-${group}`,kind:'nonspell',stageId:stage.id,phaseIndex:group*2,difficulty,frames:(32+Math.min(18,stage.id*3))*60}));
  }
  if(kind!=='nonspell')for(const midboss of MIDBOSSES)for(const [spellIndex,card]of(midboss.spells??[]).entries())
    cases.push({id:card.id,name:card.name,kind:'midboss',stageId:midboss.stageId,spellIndex,difficulty:midboss.stageId===7?4:1,frames:Math.round(card.seconds*60)});
  return cases;
}
export function verifyAttackRoutes({kind='spell',ids=null,frames=null,difficulty=null,iterations=40,lookbacks=[64,96,32],output='reports/attack-routes/report.json'}={}){
  const before=Object.fromEntries(inputs.map(name=>[name,sha(path.join(root,name))]));
  const cases=attackRouteCases({kind}).filter(spec=>!ids||ids.includes(spec.id));
  assert.ok(cases.length,'No selected attacks');if(ids)assert.equal(cases.length,new Set(ids).size,'Unknown or duplicate selected attack');
  if(frames!==null)assert.ok(Number.isSafeInteger(frames)&&frames>0&&frames%4===0);
  if(difficulty!==null)assert.ok(Number.isSafeInteger(difficulty)&&difficulty>=0&&difficulty<=3,'Main-story difficulty override must be 0..3');
  const target=path.resolve(root,output);assert.ok(target.startsWith(path.join(root,'reports')+path.sep),'QA report must remain in ignored reports/');
  fs.mkdirSync(path.dirname(target),{recursive:true});const results=[];
  const save=complete=>fs.writeFileSync(target,JSON.stringify({complete,passed:complete&&results.every(result=>result.passed),
    qaVersion:ATTACK_ROUTE_QA_VERSION,sourceHashes:before,grid:ATTACK_ROUTE_GRID,scope:'Node execution of real public Game and live target-dependent trajectories, followed by two unmodified collision-enabled real input replays checking both zero hit and 1.5-unit clearance on every frame. No native/GPU or human difficulty claim. Failure means this finite grid/search budget found no witness.',
    results},null,2)+'\n');
  for(const original of cases){const spec={...original,difficulty:original.stageId===7?4:difficulty??original.difficulty,frames:frames??original.frames},runs=[],began=Date.now();let result;
    for(const lookback of lookbacks){result=searchAttackRoute(spec,{iterations,lookback});runs.push({lookback,passed:result.passed,attempts:result.attempts,reason:result.reason,lastReplay:result.lastReplay,blockedFrame:result.blockedFrame});if(result.passed)break;}
    for(const name of inputs)assert.equal(sha(path.join(root,name)),before[name],'Production or QA input changed during route verification: '+name);
    result={...result,fullAuthoredDuration:spec.frames===original.frames,authoredFrames:original.frames,searchRuns:runs,elapsedMs:Date.now()-began};
    results.push(result);save(false);console.log(`${result.passed?'PASS':'NO WITNESS'} ${spec.id} ${spec.frames}f ${result.attempts} iterations ${result.elapsedMs}ms`);
  }
  save(true);return{passed:results.every(result=>result.passed),cases:results.length,passedCases:results.filter(result=>result.passed).length,report:path.relative(root,target).split(path.sep).join('/')};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};for(let i=2;i<process.argv.length;i++){
    const arg=process.argv[i];if(arg==='--kind')options.kind=process.argv[++i];else if(arg==='--cases')options.ids=process.argv[++i].split(',');
    else if(arg==='--frames')options.frames=Number(process.argv[++i]);else if(arg==='--iterations')options.iterations=Number(process.argv[++i]);
    else if(arg==='--lookbacks')options.lookbacks=process.argv[++i].split(',').map(Number);else if(arg==='--output')options.output=process.argv[++i];
    else if(arg==='--difficulty')options.difficulty=Number(process.argv[++i]);
    else throw new Error('Unknown argument '+arg);
  }
  const result=verifyAttackRoutes(options);console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
}
