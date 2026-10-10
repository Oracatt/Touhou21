import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Keys} from '@ts-stg/thlib';
import {STAGES,ALL_SPELLS,PLAYERS,ENDINGS} from '../dist/src/content.js';

const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
const label=args.includes('--label')?args[args.indexOf('--label')+1]:'';
assert.ok(!label||/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(label),'Visual report label must be a simple directory name');
const out=path.join(root,'reports/visual',label);
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'build'),{recursive:true});
const filter=args.includes('--cases')?args[args.indexOf('--cases')+1].split(','):null;
const backends=args.includes('--backends')?args[args.indexOf('--backends')+1].split(','):['v8','quickjs'];
const result={character:0,difficulty:1,mode:'normal',ending:'good',score:9876543,continues:0,captures:[{captured:true}]};
const base={autostart:true,invincible:true};
const cases=[
  {id:'title',preRoll:150},
  ...['difficulty','character','music','manual','options','spells','practice','replays','records'].map(page=>({id:page,options:{page,unlockAll:true},preRoll:35})),
  {id:'manual-long-bio',options:{page:'manual'},readingIndex:13,preRoll:35},
  {id:'select-marisa',options:{page:'character'},preRoll:35,input:{20:Keys.RIGHT}},
  {id:'scene-cover',preRoll:18,actions:[{frame:0,type:'play'}]},
  {id:'scene-reveal',preRoll:60,actions:[{frame:0,type:'play'}]},
  {id:'road',options:base,preRoll:480},
  {id:'midboss-entrance',options:{...base,mode:'stage-practice',stageId:2},until:{state:'midboss-enter'},phaseRoll:24},
  {id:'midboss-fog-start',options:{...base,mode:'stage-practice',stageId:2},until:{state:'midboss-enter'},phaseRoll:39},
  {id:'midboss-arrival',options:{...base,mode:'stage-practice',stageId:2},until:{state:'midboss-enter'},phaseRoll:89},
  {id:'midboss-fog-gather',options:{...base,mode:'stage-practice',stageId:2},until:{state:'midboss-enter'},expectedState:'midboss-combat',phaseRoll:129},
  {id:'boss-reposition',options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true},until:{state:'phase-wait'},phaseRoll:30},
  ...[{id:'start',phaseRoll:3,range:[.12,.13]},{id:'half',phaseRoll:18,range:[.49,.51]},{id:'full',phaseRoll:40,range:[1,1]}].map(probe=>({
    id:`hp-fill-${probe.id}`,options:{...base,skipRoad:true,autoDialogue:true},until:{state:'combat',phaseIndex:0},phaseRoll:probe.phaseRoll,hpProbe:{range:probe.range,target:1}})),
  ...[{id:'start',phaseRoll:3,range:[.12,.13]},{id:'half',phaseRoll:18,range:[.49,.51]},{id:'full',phaseRoll:40,range:[1,1]}].map(probe=>({
    id:`hp-refill-${probe.id}`,options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true},until:{state:'phase-wait'},phaseRoll:probe.phaseRoll,hpProbe:{range:probe.range,target:1,held:true}})),
  {id:'hp-shared-spell',options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true},until:{state:'combat',phaseIndex:1},phaseRoll:3,hpProbe:{shared:true}},
  {id:'hp-midboss-start',options:{...base,mode:'stage-practice',stageId:2,autoDialogue:true},until:{state:'midboss-combat'},phaseRoll:3,hpProbe:{range:[.12,.13],target:1}},
  {id:'hp-practice-start',options:{...base,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id},until:{state:'combat'},phaseRoll:3,hpProbe:{range:[.12,.13],target:1}},
  ...[{id:'midboss-defeated',phaseRoll:30},{id:'midboss-escaping',phaseRoll:95},{id:'midboss-removed',phaseRoll:140}].map(test=>({
    ...test,options:{...base,mode:'stage-practice',stageId:2,autoDialogue:true,autoCapture:true},until:{state:'midboss-exit'}})),
  {id:'bgm-caption',options:base,preRoll:90},
  ...STAGES.map(stage=>({id:`road-${stage.id}`,options:{...base,mode:'stage-practice',stageId:stage.id,difficulty:stage.id===7?4:1},preRoll:1200})),
  {id:'prelude-monologue',options:{...base,skipRoad:true},until:{state:'dialogue'},phaseRoll:80},
  {id:'prelude-boss-appears',options:{...base,skipRoad:true},preRoll:112,input:{40:Keys.SHOOT,70:Keys.SHOOT}},
  {id:'prelude-boss-dialogue',options:{...base,skipRoad:true},preRoll:210,input:{40:Keys.SHOOT,70:Keys.SHOOT,150:Keys.SHOOT}},
  ...STAGES.map(stage=>({id:`boss-name-${stage.bossId}`,options:{...base,skipRoad:true,mode:'stage-practice',stageId:stage.id,difficulty:stage.id===7?4:1},nameProbe:{age:90}})),
  ...[{id:'gather',age:30},{id:'disperse',age:350},{id:'exit',age:90,exitAge:10},
    {id:'paused',age:90,pauseFrames:30},{id:'resumed',age:90,pauseFrames:30,resume:true}].map(probe=>({
    id:`boss-name-akari-${probe.id}`,options:{...base,skipRoad:true,mode:'stage-practice',stageId:1},nameProbe:probe})),
    {id:'dialogue-marisa',options:{...base,character:1,skipRoad:true,stageId:6,mode:'stage-practice'},until:{state:'dialogue'},phaseRoll:80},
  {id:'nonspell',options:{...base,skipRoad:true,autoDialogue:true},until:{state:'combat',phaseIndex:0},phaseRoll:310},
  ...STAGES.map(stage=>({id:`nonspell-${stage.id}`,options:{...base,skipRoad:true,autoDialogue:true,mode:'stage-practice',stageId:stage.id,difficulty:stage.id===7?4:1},until:{state:'combat',phaseIndex:0},phaseRoll:310})),
  ...STAGES.map(stage=>({id:`spell-${stage.id}`,options:{...base,mode:'spell-practice',stageId:stage.id,spellId:stage.spells[0].id,difficulty:stage.id===7?4:1},until:{state:'combat'},phaseRoll:420})),
  ...STAGES.map(stage=>({id:`spell-active-${stage.id}`,options:{...base,mode:'spell-practice',stageId:stage.id,spellId:stage.spells[0].id,difficulty:stage.id===7?4:1},until:{state:'combat'},phaseRoll:240})),
  ...STAGES.map(stage=>({id:`spell-motion-${stage.id}`,options:{...base,mode:'spell-practice',stageId:stage.id,spellId:stage.spells[0].id,difficulty:stage.id===7?4:1},until:{state:'combat'},phaseRoll:600})),
  {id:'spell-cutin',options:{...base,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id},until:{state:'combat'},phaseRoll:40},
  ...[0,1].map(character=>({id:`bomb-${character}`,options:{...base,character,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id},until:{state:'combat'},phaseRoll:70,inputMask:Keys.BOMB})),
  {id:'pause',options:base,live:true,input:{400:Keys.PAUSE}},
  {id:'stage-clear-30',options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true},until:{state:'stage-clear'},phaseRoll:30},
  {id:'stage-clear-60',options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true},until:{state:'stage-clear'},phaseRoll:60},
  {id:'stage-clear-110',options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true},until:{state:'stage-clear'},phaseRoll:110},
  {id:'stage-clear',options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true},until:{state:'stage-clear'},phaseRoll:90},
  {id:'stage-transition',options:{...base,skipRoad:true,autoDialogue:true,autoCapture:true,autoStageClear:true},until:{state:'stage-clear'},phaseRoll:330},
  ...['ending','staff','result'].map(endingPhase=>({id:endingPhase,ending:result,endingPhase})),
];
for(const card of ALL_SPELLS)if(card.survival){const stage=STAGES.find(stage=>stage.spells.includes(card))??STAGES[6];cases.push({id:`survival-${card.id}`,options:{...base,mode:'spell-practice',stageId:stage.id,spellId:card.id,difficulty:stage.id===7?4:3},until:{state:'combat'},phaseRoll:900});}
for(const card of ALL_SPELLS){const stage=STAGES.find(stage=>stage.spells.includes(card))??STAGES[6];
  if(stage.spells[0]===card)continue;
  cases.push({id:`card-${card.id}`,options:{...base,mode:'spell-practice',stageId:stage.id,spellId:card.id,difficulty:stage.id===7?4:3},until:{state:'combat'},phaseRoll:card.survival?900:420});
}
for(const [character,player] of PLAYERS.entries())for(const ending of ['good','bad','extra']){
  const closeFrame=(ENDINGS[player.id][ending].length+3)*80;
  const input=Object.fromEntries(Array.from({length:closeFrame/80},(_,i)=>[(i+1)*80,Keys.SHOOT]));
  cases.push({id:`ending-flow-${player.id}-${ending}`,actions:[{frame:0,type:'ending',result:{...result,character,ending,mode:ending==='extra'?'extra':'normal',difficulty:ending==='extra'?4:1,replaySaved:true}}],input,preRoll:closeFrame+30});
}
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const parity=state=>{const copy=structuredClone(state);delete copy.backend;return copy;};
const report=[];
for(const scenario of cases.filter(value=>!filter||filter.includes(value.id))){
  const frames=scenario.live?480:220;
  fs.writeFileSync(path.join(root,'build/scenario.json'),JSON.stringify({...scenario,captureFrame:scenario.live?null:frames}));
  const runs=[];
  for(const backend of backends){
    const prefix=path.join(out,`${scenario.id}-${backend}`);
    const child=spawnSync(path.join(root,'runtime/ts-stg.exe'),['tools/native-fixture.js','--root',root,'--backend',backend,'--benchmark','--frames',String(frames),'--screenshot',prefix+'.png','--snapshot',prefix+'.json'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
    fs.writeFileSync(prefix+'.log',(child.stdout??'')+(child.stderr??''));
    if(child.error)throw child.error;assert.equal(child.status,0,`${scenario.id}/${backend}: ${child.stderr}`);
    const state=JSON.parse(fs.readFileSync(prefix+'.json','utf8'));
    if(scenario.id.startsWith('ending-flow-')){assert.equal(state.mode,'title');assert.equal(state.page,null,'Ending, staff and result return to the real title owner');}
    if(scenario.id==='stage-transition')assert.ok(state.scene.stageTransition,'Native stage cover is active');
    if(scenario.id.startsWith('midboss-')){
      const effects=state.bossPresentation,removed=scenario.id==='midboss-removed',combat=scenario.id==='midboss-fog-gather';
      assert.equal(effects.combatActive,combat,'Combat starts only after the authored arrival');
      assert.deepEqual(effects.auraScripts,removed?[]:[99],'Midboss aura lasts until entity removal');
      assert.equal(effects.distortion?.ready??false,!removed,'Warp remains through defeated hold and flight');
      assert.equal(effects.hud.timerVisible,combat,'Retained effects only retain a countdown during combat');
      if(['midboss-entrance','midboss-fog-start','midboss-arrival','midboss-fog-gather'].includes(scenario.id)){
        const frame={'midboss-entrance':25,'midboss-fog-start':40,'midboss-arrival':90,'midboss-fog-gather':130}[scenario.id];
        assert.equal(effects.entrance.mode,frame<40?'flyIn':'halfFog');
        assert.deepEqual(effects.entrance.roots.map(root=>root.scriptId),frame<40?[]:[153,159,161]);
        assert.equal(effects.charges.length,0,'The first midboss nonspell does not repeat entry charge');
        const progress=Math.min(frame,100)/100,ease=1-(1-progress)**2,boss=state.midbossFog.boss;
        assert.ok(Math.abs(boss.x-(-150+150*ease))<.011&&Math.abs(boss.y-(20+85*ease))<.011,'Boss follows the authored deceleration');
        for(const anchor of state.midbossFog.anchors){
          assert.ok(Math.hypot(anchor.root.x-boss.x,anchor.root.y-boss.y)<.011,'Fog roots track the current actor');
          if(anchor.center)assert.ok(Math.hypot(anchor.center.x-boss.x,anchor.center.y-boss.y)<.011,'Converging particles use the current actor center');
        }
      }
    }
    if(scenario.nameProbe){
      const card=state.bossNameCard,stage=STAGES.find(stage=>stage.id===scenario.options.stageId),probe=scenario.nameProbe;
      assert.equal(card.bossId,stage.bossId);assert.equal(card.alive,true);assert.ok(state.nameProbe.startedIndex>0);
      assert.equal(state.scene.director.state,'dialogue');
      if(probe.exitAge!==undefined){assert.equal(card.exitAge,probe.exitAge);assert.ok(state.scene.dialogue.exit,'The real dialogue owner has begun its authored exit');}
      else assert.equal(card.age,probe.age+(probe.resume?1:0));
      assert.equal(state.scene.paused,!!probe.pauseFrames&&!probe.resume);
    }
    if(scenario.hpProbe){
      const panel=state.bossHp.hud.panels[0],probe=scenario.hpProbe;
      assert.equal(state.bossHp.animations,7,'The real public ring and its markers are present');
      if(probe.range)assert.ok(panel.fraction>=probe.range[0]&&panel.fraction<=probe.range[1],`${scenario.id}: fraction ${panel.fraction}`);
      if(probe.target!==undefined)assert.equal(panel.target,probe.target);
      if(probe.held){assert.equal(state.bossHp.held,true);assert.equal(state.bossHp.flags&0x13,0x13);assert.equal(state.bossHp.hud.timerVisible,false);}
      if(probe.shared){assert.ok(panel.target>0&&panel.target<.5);assert.equal(panel.fraction,panel.target,'The shared spell keeps its remaining segment');}
    }
    if(scenario.until){const director=state.scene.director;assert.ok(director,scenario.id);for(const [key,value] of Object.entries(scenario.until))if(key!=='spellId'){
      if(scenario.id!=='stage-transition')assert.equal(director[key],key==='state'?(scenario.expectedState??value):value,`${scenario.id}: ${key}`);
    }}
    runs.push({backend,state,pngSha256:sha(prefix+'.png')});
  }
  const backendLabel=scenario.id==='options';
  if(runs.length===2){assert.deepEqual(parity(runs[0].state),parity(runs[1].state),`${scenario.id} state parity`);if(!backendLabel)assert.equal(runs[0].pngSha256,runs[1].pngSha256,`${scenario.id} pixels parity`);}
  report.push({id:scenario.id,passed:true,pixelComparison:backendLabel?'Backend name intentionally differs':'Exact PNG equality',runs});console.log(`PASS ${scenario.id}`);
}
fs.writeFileSync(path.join(out,filter?'selected-report.json':'report.json'),JSON.stringify({passed:true,binarySha256:sha(path.join(root,'runtime/ts-stg.exe')),gameSourceSha256:Object.fromEntries(fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.ts')).map(name=>[name,sha(path.join(root,'src',name))])),artManifestSha256:sha(path.join(root,'assets/art-manifest.json')),cases:report},null,2)+'\n');
