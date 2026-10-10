import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {TouhouGame,createTouhouResources} from '@ts-stg/thlib/touhou';
import {CampaignBossHud} from '../dist/src/campaign-boss-hud.js';
import {CampaignDirector} from '../dist/src/director.js';
import {STAGES,MIDBOSSES} from '../dist/src/content.js';

function fixture({midboss=false,practice=false,stageId=1}={}){
  const resources=createTouhouResources({readText:path=>fs.readFileSync(path,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:91,
    factories:{bossHud:(options,owner)=>new CampaignBossHud(options,owner)}});
  game.player.invulnerability.set(999999);
  const director=game.director=new CampaignDirector({stages:STAGES,midbosses:MIDBOSSES,stageId,
    mode:practice?'spell-practice':'stage-practice',spellId:practice?STAGES[stageId-1].spells[0].id:null,
    callbacks:{dialogue:(_lines,{onComplete})=>onComplete()}}).attach(game);
  if(!practice){director.midbossDone=!midboss;director.stageFrame=midboss?MIDBOSSES.find(spec=>spec.stageId===stageId).atFrame:director.stage.roadFrames;}
  const expected=midboss?'midboss-combat':'combat';
  for(let i=0;i<400&&director.state!==expected;i++)game.update(0);
  assert.equal(director.state,expected);
  return{game,director,get panel(){return game.bossHud.panels[0];},dispose(){director.destroy();game.destroy();resources.dispose();}};
}
const tick=(game,count=1)=>{for(let i=0;i<count;i++)game.update(0);};
const strike=f=>f.director.boss.damage(1000000,{type:'test-strike'},f.game.context);
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-6,`${message}: ${actual} vs ${expected}`);
const visible=f=>assert.ok(f.panel.animations.length>0,'The ring is submitted during its fill');

test('first main, midboss and independent practice rings visibly fill without changing logical health',()=>{
  for(const options of [{},{midboss:true},{practice:true}]){
    const f=fixture(options);
    try{
      const {game,director}=f,boss=director.boss,hp=boss.hp,scaledHp=boss.health.scaledHp;
      visible(f);near(f.panel.fraction,.025,'First visible tick starts near zero');
      tick(game,19);visible(f);near(f.panel.fraction,.5,'Halfway through the source fill');
      tick(game,21);assert.equal(f.panel.fraction,1);
      assert.equal(boss.hp,hp);assert.equal(boss.health.scaledHp,scaledHp,'Display fill never heals or scales gameplay HP');
    }finally{f.dispose();}
  }
});

test('nonspell defeat carries its shared ring straight to the remaining spell segment',()=>{
  const f=fixture();
  try{
    tick(f.game,40);const ring=f.panel.animations[0],maximum=f.game.bossHudState.healthBars[0].maximum;
    strike(f);assert.equal(f.director.phaseIndex,1);assert.equal(f.director.state,'combat');
    tick(f.game);const hp=f.director.phase.hp;
    assert.equal(f.director.boss.hp,hp);assert.equal(f.director.boss.health.scaledHp,hp*7);
    assert.equal(f.game.bossHudState.healthBars[0].maximum,maximum);
    assert.equal(f.panel.animations[0],ring,'The shared ring is neither recreated nor reset at the marker');
    near(f.panel.fraction,hp/maximum,'Spell starts exactly at its existing segment');
    const fraction=f.panel.fraction;tick(f.game,20);assert.equal(f.panel.fraction,fraction,'No second refill follows the handoff');
  }finally{f.dispose();}
});

test('capture and timeout fill the next group during preparation, without reopening the held actor',()=>{
  for(const timeout of [false,true]){
    const f=fixture();
    try{
      tick(f.game,40);strike(f);tick(f.game);assert.equal(f.director.phaseIndex,1);
      if(timeout)f.game.spell.timeout(f.game.context);else strike(f);
      const {game,director}=f,boss=director.boss,flags=boss.primaryFlags,held=game.isBossHeld(boss),hp=boss.hp,scaledHp=boss.health.scaledHp;
      assert.equal(director.state,'phase-wait');assert.equal(director.waitFrames,60);
      tick(game);visible(f);near(f.panel.fraction,.025,'A settled group has an empty-ring starting point');
      assert.equal(game.bossHud.timerVisible,false,'Preparation does not start the next timer');
      assert.equal(boss.primaryFlags,flags);assert.equal(game.isBossHeld(boss),held);
      game.context.damageEnemy(boss,1000,{kind:'test-held-shot'});
      assert.equal(game.damage.pending.has(boss),false,'Neither held nor timed-out preparation accepts player damage');
      assert.equal(boss.hp,hp);assert.equal(boss.health.scaledHp,scaledHp);
      tick(game,40);assert.equal(f.panel.fraction,1);assert.equal(director.state,'phase-wait');
      const ring=f.panel.animations[0];tick(game,19);
      assert.equal(director.state,'combat');assert.equal(director.phaseIndex,2);
      assert.equal(f.panel.fraction,1);assert.equal(f.panel.animations[0],ring,'Beginning the prepared phase must not refill again');
      assert.equal(boss.hp,hp);assert.equal(boss.health.scaledHp,scaledHp);
    }finally{f.dispose();}
  }
});

test('a spell following another spell fills its own full ring in the existing sixty-frame gap',()=>{
  const f=fixture({stageId:2});
  try{
    tick(f.game,40);strike(f);strike(f);tick(f.game,60);strike(f);tick(f.game);
    assert.equal(f.director.phaseIndex,3);assert.equal(f.director.phase.spell,true);
    strike(f);assert.equal(f.director.state,'phase-wait');
    tick(f.game);visible(f);near(f.panel.fraction,.025,'Independent next spell starts a new ring');
    assert.equal(f.game.bossHudState.healthBars[0].maximum,f.director.phases[4].hp);
    tick(f.game,59);assert.equal(f.director.phaseIndex,4);assert.equal(f.director.state,'combat');
    assert.equal(f.panel.fraction,1);assert.equal(f.director.boss.health.scaledHp,f.director.phase.hp*7);
  }finally{f.dispose();}
});

test('midboss preparation fills the upcoming card once and keeps the real defeated body held',()=>{
  const f=fixture({midboss:true,stageId:2});
  try{
    tick(f.game,40);strike(f);const boss=f.director.boss,hp=boss.hp,flags=boss.primaryFlags;
    assert.equal(f.director.state,'midboss-phase-wait');assert.equal(f.director.waitFrames,40);
    tick(f.game);visible(f);near(f.panel.fraction,.025,'New midboss card is a separate ring');
    assert.equal(f.game.isBossHeld(boss),true);assert.equal(boss.primaryFlags,flags);assert.equal(boss.hp,hp);
    const ring=f.panel.animations[0];tick(f.game,39);
    assert.equal(f.director.state,'midboss-combat');assert.equal(f.director.midbossPhaseIndex,1);
    assert.equal(f.panel.animations[0],ring);near(f.panel.fraction,1,'The forty-frame preparation is already filled at release');
    tick(f.game);assert.equal(f.panel.fraction,1);
    assert.equal(boss.hp,f.director.midbossPhase.hp);assert.equal(boss.health.scaledHp,boss.hp*7);
  }finally{f.dispose();}
});

test('pause freezes a partly filled ring and damage lowers its target without healing actual HP',()=>{
  const f=fixture();
  try{
    tick(f.game,19);near(f.panel.fraction,.5,'Partly filled before pause');
    const before=f.game.bossHud.snapshot(),phaseFrame=f.director.phaseFrame;
    f.game.update(Keys.PAUSE);tick(f.game,20);assert.equal(f.game.paused,true);
    assert.deepEqual(f.game.bossHud.snapshot(),before);assert.equal(f.director.phaseFrame,phaseFrame);
    f.game.update(Keys.PAUSE);for(let i=0;i<40&&f.game.paused;i++)tick(f.game);
    assert.equal(f.game.paused,false);assert.deepEqual(f.game.bossHud.snapshot(),before);
    const boss=f.director.boss;boss.damage(boss.hp-50,{type:'test-damage'},f.game.context);tick(f.game);
    const fraction=f.panel.fraction;assert.equal(boss.hp,50);assert.ok(fraction<.5);
    assert.equal(fraction,f.panel.target,'A falling health target clamps the animated arc immediately');
    tick(f.game,41);assert.equal(boss.hp,50);assert.equal(f.panel.fraction,fraction);
  }finally{f.dispose();}
});

test('replacing a Boss starts an empty ring even when both actors use group zero',()=>{
  const f=fixture();
  try{
    tick(f.game,40);assert.equal(f.panel.fraction,1);
    f.game.stage=null;f.game.director=undefined;f.game.removeBoss(f.director.boss);
    const boss=f.game.spawnEnemy({x:0,y:105,hp:400,script:30,damageInvulnerability:0});
    f.game.enterBoss(boss,{profile:'boss',entrance:{mode:'flyIn'}});f.game.startBossCombat();
    f.game.setBossHud({dialogue:false,healthBars:[{current:400,maximum:400,groupIndex:0}]});
    tick(f.game);visible(f);near(f.panel.fraction,.025,'The previous actor cannot donate a filled arc');
    assert.equal(boss.hp,400);
  }finally{f.dispose();}
});
