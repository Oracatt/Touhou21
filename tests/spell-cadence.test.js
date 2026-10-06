import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TouhouGame,createTouhouResources} from '@ts-stg/thlib/touhou';
import {SPELL_CADENCES,spellAttackClock} from '../src/spell-cadence.js';
import {STAGES} from '../src/content.js';
import {updateSpellPattern,updateMidbossSpellPattern,STAGE_PATTERN_OFFSETS,DIFFICULTY_PROFILES} from '../src/patterns.js';
import {CampaignDirector} from '../src/director.js';

test('all 34 cards leave a real recovery interval without erasing public live bullets',()=>{
  const r=createTouhouResources({readText:p=>fs.readFileSync(p,'utf8'),loadTexture:()=>1});
  for(let index=0;index<34;index++){
    const g=new TouhouGame({banks:r.banks,font:r.font,sht:r.shots[0],styles:r.styles});
    const b=g.spawnEnemy({x:0,y:105,hp:100000,directional:false});b.invulnerable=true;
    const stage=index<31?STAGES.find(s=>STAGE_PATTERN_OFFSETS[s.id-1]<=index&&index<STAGE_PATTERN_OFFSETS[s.id-1]+s.spells.length):STAGES[6];
    const state={},score=SPELL_CADENCES[index];let requests=0,liveAtRecovery=false;const original=g.bullets.emit.bind(g.bullets);
    g.bullets.emit=p=>{assert.equal(spellAttackClock(index,frame).active,true,'No new bullets in opening, reposition or recovery');requests+=p.count;return original(p);};
    const originalLaser=g.lasers.spawn.bind(g.lasers);
    g.lasers.spawn=(kind,p)=>{assert.equal(spellAttackClock(index,frame).active,true,'No surprise laser starts during recovery');return originalLaser(kind,p);};
    let frame=0;
    for(;frame<60+score.cycle*2;frame++){
      const fn=index<31?updateSpellPattern:updateMidbossSpellPattern;
      fn({game:g,boss:b,frame,difficulty:stage.id===7?4:1,stageId:stage.id,
        spellIndex:index<31?index-STAGE_PATTERN_OFFSETS[stage.id-1]:index-31,state});
      g.bullets.update(null,{});g.lasers.update(null,{});
      if(spellAttackClock(index,frame).phase==='recovery'&&g.bullets.count)liveAtRecovery=true;
    }
    assert.ok(score.recovery>=120);assert.ok(requests>0,`${index} actually fires`);
    assert.ok(liveAtRecovery,`${index} recovery does not silently erase old trajectories`);g.destroy();
  }
  r.dispose();
});

test('the journey quotation final card advances all six geometries instead of resetting to chapter zero',()=>{
  const state={},boss={x:0,y:100};const chapters=[];
  const game={player:{x:0,y:400},bullets:{emit:()=>[]},lasers:{spawnInfinite:()=>({}),spawnCurve:()=>({})}};
  for(let frame=0;frame<60+SPELL_CADENCES[30].cycle*6;frame++){
    updateSpellPattern({game,boss,frame,stageId:7,spellIndex:9,difficulty:4,state});
    if(state.chapter!==undefined&&chapters.at(-1)!==state.chapter)chapters.push(state.chapter);
  }
  assert.deepEqual(chapters,[0,1,2,3,4,5]);
});

test('breaking a moving nonspell clears its motion before the next spell opening',()=>{
  const r=createTouhouResources({readText:p=>fs.readFileSync(p,'utf8'),loadTexture:()=>1});
  const g=new TouhouGame({banks:r.banks,font:r.font,sht:r.shots[0],styles:r.styles});
  const director=new CampaignDirector({stages:STAGES,callbacks:{dialogue:(lines,{onComplete})=>onComplete()}}).attach(g);
  director._spawnBoss(g);director._beginPhase(g,0);
  const b=director.boss;b.motion.speed=2;b.motion.delta.x=2;b.motion.flags=16;
  director._finishPhase(g,{defeated:true});
  assert.equal(director.phase.spell,true);assert.equal(b.motion.speed,0);assert.equal(b.motion.flags,0);
  assert.deepEqual(b.motion.delta,{x:0,y:0,z:0});const {x,y}=b;
  for(let frame=0;frame<30;frame++)g.update(0);
  assert.equal(b.x,x);assert.equal(b.y,y);director.destroy();g.destroy();r.dispose();
});

test('paused memory bullets release toward one saved address, even after the player moves',()=>{
  const r=createTouhouResources({readText:p=>fs.readFileSync(p,'utf8'),loadTexture:()=>1});
  const g=new TouhouGame({banks:r.banks,font:r.font,sht:r.shots[0],styles:r.styles});
  try{
    g.player.x=0;g.player.y=400;g.bullets.player=g.player;const boss={x:0,y:105};
    const index=10,frame=60+SPELL_CADENCES[index].windup;
    updateSpellPattern({game:g,boss,frame,stageId:4,spellIndex:2,difficulty:1,state:{}});
    const bullet=g.bullets.bullets.find(b=>b.id===1);assert.ok(bullet);
    let locked=null;
    for(let age=0;age<130;age++){
      const before={x:bullet.x,y:bullet.y};g.bullets.update(g.player,{});
      if(locked===null&&bullet.commandIndex===3){
        locked=Math.atan2(g.player.y-before.y,g.player.x-before.x);
        assert.ok(Math.abs(bullet.motion.get(16).angle-locked)<1e-5);
        g.player.x=150;
      }
    }
    assert.notEqual(locked,null);assert.ok(Math.abs(bullet.angle-locked)<1e-5);
    assert.ok(bullet.vy>2,'A lower-field saved address releases downward, not upward after adding aim twice');
    assert.ok(Math.abs(bullet.speed-2.6)<1e-5);
  }finally{g.destroy();r.dispose();}
});

test('actual stopped and accelerated public bullets keep each difficulty speed after their commands finish',()=>{
  const r=createTouhouResources({readText:p=>fs.readFileSync(p,'utf8'),loadTexture:()=>1});
  try{
    for(const difficulty of[0,1,2,3,4])for(const sample of[
      {index:3,stageId:2,spellIndex:1,frames:105,expected:2.5},
      {index:15,stageId:5,spellIndex:3,frames:135,expected:2.5},
    ]){
      const g=new TouhouGame({banks:r.banks,font:r.font,sht:r.shots[0],styles:r.styles});
      try{
        g.player.x=0;g.player.y=440;g.bullets.player=g.player;
        updateSpellPattern({game:g,boss:{x:0,y:105},frame:60+SPELL_CADENCES[sample.index].windup,
          stageId:sample.stageId,spellIndex:sample.spellIndex,difficulty,state:{}});
        const bullet=g.bullets.bullets.find(b=>b.id===1);assert.ok(bullet);
        for(let age=0;age<sample.frames;age++)g.bullets.update(g.player,{});
        assert.equal(bullet.state,1,'The measured bullet is still active inside the field');
        assert.ok(Math.abs(bullet.speed-sample.expected*DIFFICULTY_PROFILES[difficulty].speed)<1e-4,
          `Command release/acceleration must follow difficulty ${difficulty}, got ${bullet.speed}`);
        assert.ok(Math.abs(bullet.angle-Math.PI/2)<1e-5,'Difficulty does not rotate the authored trajectory');
      }finally{g.destroy();}
    }
  }finally{r.dispose();}
});
