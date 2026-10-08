import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {TouhouGame,createTouhouResources} from '@ts-stg/thlib/touhou';
import {STAGES,MIDBOSSES} from '../src/content.js';
import {CampaignDirector} from '../src/director.js';

function fixture({stageId=1,midbosses=MIDBOSSES}={}){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const sounds=[],events=[];
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,
    seed:73,onSound:(id,x)=>sounds.push({id,x}),onEvent:(name,data)=>events.push({name,data})});
  game.player.invulnerability.set(999999);
  const director=new CampaignDirector({stages:STAGES,midbosses,mode:'stage-practice',stageId,seed:73,
    callbacks:{dialogue:(lines,{onComplete})=>onComplete()}}).attach(game);
  director.stageFrame=midbosses.find(mid=>mid.stageId===stageId).atFrame;
  for(let i=0;i<160&&director.state!=='midboss-combat';i++)game.update(0);
  assert.equal(director.state,'midboss-combat');
  return{game,director,sounds,events,dispose(){director.destroy();game.destroy();resources.dispose();}};
}

test('a recurring main Boss retreats through the public escape owner without a death burst',()=>{
  for(let stageId=1;stageId<=6;stageId++){
    const f=fixture({stageId}),boss=f.director.boss,roadFrame=f.director.stageFrame,phases=stageId===1?1:2;
    for(let phase=0;phase<phases;phase++){
      if(phase){for(let i=0;i<120&&f.director.state!=='midboss-combat';i++)f.game.update(0);assert.equal(f.game.spell.active,true,'the ordinary attack hands over to the midboss card');}
      f.game.bullets.emit({x:40,y:180,angle:Math.PI/2,speed:1,type:0,color:1,count:3,pattern:3});
      boss.damage(100000,{type:'transition-test'},f.game.context);
      if(phase+1<phases)assert.equal(f.director.state,'midboss-phase-wait');
    }
    assert.equal(f.director.state,'midboss-exit');assert.equal(f.director.boss,boss);
    assert.equal(f.sounds.filter(sound=>sound.id===27).length,phases,'every broken midboss group, even the last, plays the break cue');
    assert.equal(f.game.context.boss,null,'HUD/combat ownership ends while the visible actor departs');
    assert.equal(boss.alive,true);assert.equal(f.game.bossDefeats.length,0);assert.equal(f.game.bossPresentation.deaths.length,0);
    const escape=f.game.bossEscapes[0];assert.equal(escape.enemy,boss);
    assert.equal(escape.sequence.duration,60);assert.equal(escape.sequence.easing,4);
    assert.deepEqual(escape.sequence.target,{x:192,y:-32,z:0});
    const shotCount=f.game.bullets.nextId;
    for(let i=0;i<20;i++)f.game.update(0);
    assert.equal(boss.alive,true);assert.ok(boss.x>0);assert.ok(boss.y<105);
    assert.equal(f.director.stageFrame,roadFrame);assert.equal(f.game.bullets.nextId,shotCount,'retired emitter stops firing');
    f.game.update(Keys.PAUSE);const position={x:boss.x,y:boss.y},age=escape.sequence.age;
    for(let i=0;i<10;i++)f.game.update(0);
    assert.equal(f.game.paused,true);assert.equal(escape.sequence.age,age);assert.deepEqual({x:boss.x,y:boss.y},position);
    f.game.update(Keys.PAUSE);
    for(let i=0;i<80&&f.director.state==='midboss-exit';i++)f.game.update(0);
    assert.equal(f.director.state,'road');assert.equal(boss.alive,false);assert.equal(f.director.boss,null);
    assert.equal(f.events.filter(event=>event.name==='bossescape').length,1);
    assert.equal(f.events.filter(event=>event.name==='bossburst').length,0);
    assert.equal(f.director.stageFrame,roadFrame+1);f.dispose();
  }
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
    assert.equal(f.game.bossEscapes.length,exit==='escape'?1:0);
    assert.equal(f.game.bossPresentation.deaths.length,exit==='defeat'?1:0);
    assert.equal(boss.alive,exit==='escape');f.dispose();
  }
});

test('one phase preparation emits one original charge sound and one convergence cohort',()=>{
  const f=fixture(),charge=f.game.bossPresentation.charges[0];
  assert.equal(charge.repeatCount,1);assert.equal(charge.emitted,1);assert.equal(charge.releaseFrame,60);
  assert.equal(f.sounds.filter(sound=>sound.id===54).length,1);
  for(let i=0;i<65;i++)f.game.update(0);
  assert.equal(charge.emitted,1);assert.equal(charge.released,true);
  assert.equal(f.sounds.filter(sound=>sound.id===54).length,1,'ordinary updates do not retrigger the cue');
  assert.equal(f.sounds.filter(sound=>sound.id===6).length,1,'one release accompanies the same charge');
  const boss=f.director.boss;boss.damage(100000,{type:'transition-test'},f.game.context);
  for(let i=0;i<80&&f.director.state!=='road';i++)f.game.update(0);
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
