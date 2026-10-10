import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {TouhouGame,createTouhouResources} from '@ts-stg/thlib/touhou';
import {STAGES,MIDBOSSES} from '../dist/src/content.js';
import {CampaignDirector} from '../dist/src/director.js';

function fixture({stageId=1,midbosses=MIDBOSSES,enterCombat=true,dialogue=(_lines,{onComplete})=>onComplete()}={}){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const sounds=[],events=[];
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,
    seed:73,onSound:(id,x)=>sounds.push({id,x}),onEvent:(name,data)=>events.push({name,data})});
  game.player.invulnerability.set(999999);
  const director=new CampaignDirector({stages:STAGES,midbosses,mode:'stage-practice',stageId,seed:73,
    callbacks:{dialogue}}).attach(game);
  director.stageFrame=midbosses.find(mid=>mid.stageId===stageId).atFrame;
  if(enterCombat){for(let i=0;i<160&&director.state!=='midboss-combat';i++)game.update(0);
    assert.equal(director.state,'midboss-combat');}
  else game.update(0);
  return{game,director,sounds,events,dispose(){director.destroy();game.destroy();resources.dispose();}};
}

test('a recurring main Boss retreats through the public escape owner without a death burst',()=>{
  for(let stageId=1;stageId<=6;stageId++){
    const f=fixture({stageId}),boss=f.director.boss,roadFrame=f.director.stageFrame,phases=stageId===1?1:2;
    const presentation=f.game.bossPresentation,aura=presentation.aura.slice(),distortion=presentation.distortion;
    assert.deepEqual(aura.map(vm=>vm.scriptId),[99]);assert.equal(presentation.profileName,'midboss');
    const sameEffects=()=>{assert.equal(presentation.aura.length,aura.length);aura.forEach((vm,index)=>assert.equal(presentation.aura[index],vm));
      assert.equal(presentation.distortion,distortion);assert.equal(presentation.boss,boss);};
    for(let phase=0;phase<phases;phase++){
      if(phase){for(let i=0;i<120&&f.director.state!=='midboss-combat';i++)f.game.update(0);assert.equal(f.game.spell.active,true,'the ordinary attack hands over to the midboss card');}
      f.game.bullets.emit({x:40,y:180,angle:Math.PI/2,speed:1,type:0,color:1,count:3,pattern:3});
      boss.damage(100000,{type:'transition-test'},f.game.context);
      if(phase+1<phases)assert.equal(f.director.state,'midboss-phase-wait');
    }
    assert.equal(f.director.state,'midboss-exit');assert.equal(f.director.boss,boss);
    assert.equal(f.sounds.filter(sound=>sound.id===27).length,phases,'every broken midboss group, even the last, plays the break cue');
    assert.equal(f.game.context.boss,boss,'presentation binding lasts until the actor actually leaves');
    assert.equal(presentation.combatActive,false);assert.equal(f.game.isBossCombatReady(boss),false);sameEffects();
    assert.equal(f.game.context.damageEnemy(boss,1000,{kind:'held-shot'}),0,'bound presentation does not reopen player damage');
    f.game.player.setPosition(boss.x,boss.y);f.game.player.state=1;f.game.player.invulnerability.set(0);
    f.game.update(0);assert.equal(f.game.player.state,1,'held body cannot collide with the player');
    f.game.player.setPosition(0,400);f.game.player.invulnerability.set(999999);
    assert.equal(boss.alive,true);assert.equal(f.game.bossDefeats.length,0);assert.equal(f.game.bossPresentation.deaths.length,0);
    assert.equal(f.game.bossEscapes.length,0,'a broken midboss pauses before she runs');
    const heldPhase=distortion.phaseX,heldPosition={x:boss.x,y:boss.y};
    let pause=0;for(;pause<200&&f.game.bossEscapes.length===0;pause++){sameEffects();assert.deepEqual({x:boss.x,y:boss.y},heldPosition);f.game.update(0);}
    assert.notEqual(distortion.phaseX,heldPhase,'the same distortion continues updating while the defeated body waits');
    assert.ok(pause>=45&&pause<=120,`the pause is a beat, not an instant or a stall (${pause})`);
    assert.equal(f.director.state,'midboss-exit');assert.equal(boss.alive,true);
    const escape=f.game.bossEscapes[0];assert.equal(escape.enemy,boss);
    assert.equal(escape.sequence.duration,60);assert.equal(escape.sequence.easing,4);
    assert.deepEqual(escape.sequence.target,{x:192,y:-32,z:0});
    const shotCount=f.game.bullets.nextId;
    for(let i=0;i<20;i++)f.game.update(0);
    sameEffects();assert.equal(f.game.bossHud.timerVisible,false);assert.equal(f.game.bossHud.state.dialogue,true);
    assert.equal(aura[0].x,boss.x);assert.equal(aura[0].y,boss.y,'the same aura follows the moving actor');
    assert.equal(boss.alive,true);assert.ok(boss.x>0);assert.ok(boss.y<105);
    assert.equal(f.director.stageFrame,roadFrame);assert.equal(f.game.bullets.nextId,shotCount,'retired emitter stops firing');
    f.game.update(Keys.PAUSE);const position={x:boss.x,y:boss.y},age=escape.sequence.age;
    const pausedEffects={aura:aura.map(vm=>vm.snapshot()),phaseX:distortion.phaseX,phaseY:distortion.phaseY};
    for(let i=0;i<10;i++)f.game.update(0);
    assert.equal(f.game.paused,true);assert.equal(escape.sequence.age,age);assert.deepEqual({x:boss.x,y:boss.y},position);
    sameEffects();assert.deepEqual({aura:aura.map(vm=>vm.snapshot()),phaseX:distortion.phaseX,phaseY:distortion.phaseY},pausedEffects);
    f.game.update(Keys.PAUSE);
    for(let i=0;i<200&&f.director.state==='midboss-exit';i++)f.game.update(0);
    assert.equal(f.director.state,'road');assert.equal(boss.alive,false);assert.equal(f.director.boss,null);
    assert.equal(f.game.context.boss,null);assert.equal(presentation.boss,null);assert.equal(presentation.distortion,null);
    assert.equal(presentation.aura.length,0);assert.ok(aura.every(vm=>!vm.alive),'removal destroys the retained effects once');
    assert.equal(f.events.filter(event=>event.name==='bossescape').length,1);
    assert.equal(f.events.filter(event=>event.name==='bossburst').length,0);
    assert.equal(f.director.stageFrame,roadFrame+1);f.dispose();
  }
});

test('midboss effects start during flight, survive its dialogue and switch to the main Boss profile only on rebinding',()=>{
  let midbossDialogue,mainDialogue;
  const midbosses=MIDBOSSES.map(mid=>mid.stageId===1?{...mid,dialogues:MIDBOSSES[6].dialogues}:mid);
  const f=fixture({midbosses,enterCombat:false,dialogue:(_lines,context)=>{
    if(context.kind==='midboss')midbossDialogue=context;
    else{mainDialogue=context;context.cue?.('appear');}
  }}),game=f.game,director=f.director,presentation=game.bossPresentation,boss=director.boss;
  try{
    assert.equal(director.state,'midboss-enter');assert.equal(presentation.profileName,'midboss');
    assert.equal(presentation.entrance.mode,'halfFog');assert.equal(presentation.bossVisible,true);
    assert.equal(f.sounds.filter(sound=>sound.id===54).length,1,'half-fog entry owns one separate original entrance cue');
    const aura=presentation.aura[0],distortion=presentation.distortion;
    assert.deepEqual(presentation.aura.map(vm=>vm.scriptId),[99]);assert.equal(distortion.radius,128);
    assert.equal(presentation.combatActive,false);assert.equal(game.isBossCombatReady(boss),false);
    const phase=distortion.phaseX;
    assert.deepEqual({x:boss.x,y:boss.y},{x:-150,y:20},'right-side fog accompanies an upper-left Boss entrance');
    for(let i=0;i<50;i++)game.update(0);
    assert.deepEqual({x:boss.x,y:boss.y},{x:-37.5,y:83.75});
    assert.equal(director.state,'midboss-enter');assert.equal(presentation.combatActive,false);
    assert.equal(aura.x,boss.x);assert.equal(aura.y,boss.y,'the existing effect follows the corrected route');
    for(let i=0;i<90&&!midbossDialogue;i++)game.update(0);
    assert.ok(midbossDialogue);assert.equal(director.state,'dialogue');assert.equal(presentation.combatActive,false);
    assert.equal(presentation.aura[0],aura);assert.equal(presentation.distortion,distortion);
    assert.notEqual(distortion.phaseX,phase);assert.deepEqual({x:boss.x,y:boss.y},{x:0,y:105});
    for(let i=0;i<10;i++)game.update(0);
    assert.equal(presentation.aura[0],aura);assert.equal(presentation.distortion,distortion);
    midbossDialogue.onComplete();game.update(0);
    assert.equal(director.state,'midboss-combat');assert.equal(presentation.aura[0],aura);
    boss.damage(100000,{type:'retire-midboss'},game.context);
    for(let i=0;i<200&&director.state!=='road';i++)game.update(0);
    assert.equal(presentation.boss,null);assert.equal(presentation.distortion,null);assert.equal(aura.alive,false);
    director.stageFrame=STAGES[0].roadFrames;game.update(0);
    assert.ok(mainDialogue);assert.equal(director.state,'dialogue');assert.notEqual(director.boss,boss);
    assert.equal(presentation.profileName,'boss');assert.equal(presentation.distortion.radius,160);
    for(let i=0;i<130;i++)game.update(0);
    assert.equal(presentation.combatActive,false);assert.equal(presentation.aura.length,0);assert.equal(presentation.distortionReady,false);
    mainDialogue.onComplete();for(let i=0;i<180&&director.state!=='combat';i++)game.update(0);
    assert.equal(director.state,'combat');assert.equal(presentation.combatActive,true);
    assert.deepEqual(presentation.aura.map(vm=>vm.scriptId),[99,108]);assert.equal(presentation.distortionReady,true);
  }finally{f.dispose();}
});

test('the final midboss card timing out keeps the same live aura and distortion until escape removal',()=>{
  const midbosses=MIDBOSSES.map(mid=>({...mid,spells:mid.spells.map(card=>({...card,seconds:2}))}));
  const f=fixture({stageId:2,midbosses}),game=f.game,director=f.director,boss=director.boss,presentation=game.bossPresentation;
  try{
    const aura=presentation.aura[0],distortion=presentation.distortion;
    const beforeCharge=f.sounds.filter(sound=>sound.id===54).length;
    assert.equal(presentation.charges.length,0,'entry nonspell uses only the half-fog preparation');
    boss.damage(100000,{type:'open-card'},game.context);
    for(let i=0;i<120&&director.state!=='midboss-combat';i++)game.update(0);
    assert.equal(game.spell.active,true);assert.equal(presentation.aura[0],aura);assert.equal(presentation.distortion,distortion);
    assert.equal(presentation.charges.length,1,'the later midboss spell keeps its own attack charge');
    assert.equal(f.sounds.filter(sound=>sound.id===54).length,beforeCharge+1);
    game.spell.age.set(game.spell.duration-1);game.update(0);
    assert.equal(director.state,'midboss-exit');assert.equal(game.spell.active,false);
    assert.equal(director.pendingEscape,null,'timeouts begin the flight without a defeat hold');
    assert.equal(game.context.boss,boss);assert.equal(presentation.combatActive,false);
    assert.equal(game.bossEscapes[0].enemy,boss);assert.equal(presentation.aura[0],aura);assert.equal(presentation.distortion,distortion);
    const phase=distortion.phaseX,shots=game.bullets.nextId;
    for(let i=0;i<20;i++)game.update(0);
    assert.notEqual(distortion.phaseX,phase);assert.equal(presentation.aura[0],aura);assert.equal(presentation.distortion,distortion);
    assert.equal(aura.x,boss.x);assert.equal(aura.y,boss.y);assert.equal(game.bullets.nextId,shots);
    assert.equal(game.isBossCombatReady(boss),false);assert.equal(game.bossHud.timerVisible,false);
    for(let i=0;i<80&&boss.alive;i++)game.update(0);
    assert.equal(boss.alive,false);assert.equal(aura.alive,false);assert.equal(presentation.aura.length,0);
    assert.equal(presentation.distortion,null);assert.equal(game.context.boss,null);
  }finally{f.dispose();}
});

test('midboss timeout uses its authored clock and escapes without defeat rewards',()=>{
  const midbosses=MIDBOSSES.map(mid=>({...mid,seconds:2})),f=fixture({midbosses}),boss=f.director.boss;
  assert.equal(f.director.midbossDuration,120);
  const itemCount=f.game.items.items.length;
  while(f.director.phaseFrame<119)f.game.update(0);
  assert.equal(f.director.state,'midboss-combat');f.game.update(0);
  assert.equal(f.director.state,'midboss-exit');assert.equal(f.game.items.items.length,itemCount);
  assert.equal(f.game.bossPresentation.deaths.length,0);assert.equal(f.game.bossEscapes[0].enemy,boss);
  assert.deepEqual(f.game.bossEscapes[0].sequence.target,{x:0,y:-32,z:0});f.dispose();
});

test('different midboss outcomes remain authorable, with escape opt-in and final death kept separate',()=>{
  for(const exit of ['escape','defeat']){
    const midbosses=MIDBOSSES.map(mid=>mid.stageId===1?{...mid,bossId:'fusae',exit}:mid),f=fixture({midbosses}),boss=f.director.boss;
    boss.damage(100000,{type:'transition-test'},f.game.context);
    for(let i=0;i<200&&f.game.bossEscapes.length===0&&f.director.state==='midboss-exit';i++)f.game.update(0);
    assert.equal(f.game.bossEscapes.length,exit==='escape'?1:0);
    assert.equal(f.game.bossPresentation.deaths.length,exit==='defeat'?1:0);
    assert.equal(boss.alive,exit==='escape');f.dispose();
  }
});

test('entry fog replaces the first midboss nonspell charge while main Boss phases retain one charge each',()=>{
  const f=fixture({enterCombat:false}),entranceSounds=f.sounds.filter(sound=>sound.id===54).length;
  for(let i=0;i<160&&f.director.state!=='midboss-combat';i++)f.game.update(0);
  assert.equal(f.director.state,'midboss-combat');
  assert.equal(f.game.bossPresentation.charges.length,0);
  assert.equal(f.sounds.filter(sound=>sound.id===54).length,entranceSounds);
  for(let i=0;i<65;i++)f.game.update(0);
  assert.equal(f.game.bossPresentation.charges.length,0);
  assert.equal(f.sounds.filter(sound=>sound.id===54).length,entranceSounds,'the first nonspell does not repeat the fog cue');
  assert.equal(f.sounds.filter(sound=>sound.id===6).length,0,'no orphaned release sound after the skipped charge');
  const boss=f.director.boss;boss.damage(100000,{type:'transition-test'},f.game.context);
  for(let i=0;i<200&&f.director.state!=='road';i++)f.game.update(0);
  f.director.midbossDone=true;f.director.stageFrame=STAGES[0].roadFrames;
  let beforeMainPhase;
  for(let i=0;i<180&&f.director.state!=='combat';i++){
    beforeMainPhase=f.sounds.filter(sound=>sound.id===54).length;f.game.update(0);
  }
  assert.equal(f.director.state,'combat');assert.equal(f.sounds.filter(sound=>sound.id===54).length,beforeMainPhase+1);
  const normal=f.game.bossPresentation.charges.at(-1);assert.equal(normal.repeatCount,1);
  const beforeSpell=f.sounds.filter(sound=>sound.id===54).length;
  f.director.boss.damage(100000,{type:'transition-test'},f.game.context);
  assert.equal(f.game.spell.active,true);assert.equal(f.sounds.filter(sound=>sound.id===54).length,beforeSpell+1);
  const beforeRelease=f.sounds.filter(sound=>sound.id===6).length;
  for(let i=0;i<59;i++)f.game.update(0);
  assert.equal(f.sounds.filter(sound=>sound.id===6).length,beforeRelease,'cancelled nonspell never releases into the new card');
  f.game.update(0);assert.equal(f.sounds.filter(sound=>sound.id===6).length,beforeRelease+1);
  assert.equal(f.game.bossPresentation.charges.at(-1).repeatCount,1);f.dispose();
});
