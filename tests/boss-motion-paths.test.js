import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Keys} from '@ts-stg/thlib';
import {TouhouGame,TouhouMotion,TouhouRNG,createTouhouResources} from '@ts-stg/thlib/touhou';
import {MIO} from '../dist/src/attacks/mio.js';
import {driveAttack} from '../dist/src/danmaku.js';

const cases=[
  {attack:MIO.nonspells[6],start:60,schedule:'eaae765f2d926ed4ab616ff14d8e06a22ad6b1e2ebf9fb439edc44a01938b508',events:587,rng:73},
  {attack:MIO.spells[5],start:80,schedule:'45fda3d94913c572fe61e00f2ce5d9d41064ad8cc54e87b76c22d6a7ed1be34d',events:528,rng:73},
  {attack:MIO.spells[7],start:80,schedule:'8ce82fe6c3202e1c2ac14321f14d48f5dba1bb5408eab302fed0b64287620ce5',events:1057,rng:1376906378},
];

/** Execute the production attack and public actor motion for a complete card.
 * Emission records deliberately omit positions/aim angles: these must follow
 * the corrected actor, while the original volley score stays unchanged. */
function trace({attack,start},playerX=0){
  const boss={x:0,y:105,motion:new TouhouMotion({position:{x:0,y:105}}),animation:{}},state={},rng=new TouhouRNG(73);
  const events=[],samples=[];let frame=0,previousDx=0,previousDy=0;
  const game={player:{x:playerX,y:400},rng,context:{sound(){}},bullets:{emit(p){
    events.push([frame,'bullet',p.type,p.color,p.pattern,p.count,p.rows,p.speed,p.angleStep,p.commands.map(command=>command[0])]);return[];
  }},lasers:{spawnInfinite(p){
    events.push([frame,'infinite',p.type,p.color,p.width,p.delay,p.grow,p.sustain,p.shrink]);return null;
  },spawnStraight(p){events.push([frame,'straight',p.type,p.color,p.width,p.speed,p.length]);return null;}}};
  for(frame=0;frame<3900;frame++){
    const x=boss.x,y=boss.y;
    driveAttack(attack,{game,boss,frame,difficulty:4,state,rng,start});
    boss.motion.update();boss.x=boss.motion.position.x;boss.y=boss.motion.position.y;
    const dx=boss.x-x,dy=boss.y-y;
    samples.push({frame,x:boss.x,y:boss.y,speed:Math.hypot(dx,dy),acceleration:Math.hypot(dx-previousDx,dy-previousDy),segment:state.segment});
    previousDx=dx;previousDy=dy;
  }
  return{samples,rng:rng.state,events:events.length,schedule:createHash('sha256').update(JSON.stringify(events)).digest('hex')};
}

test('Extra direct paths join from rest without teleporting or an abrupt first step',()=>{
  for(const scenario of cases)for(const playerX of [0,-184,184]){
    const result=trace(scenario,playerX);
    for(const row of result.samples){
      assert.ok(Number.isFinite(row.x)&&Number.isFinite(row.y));
      assert.ok(row.speed<4,`${scenario.attack.name}/${playerX} frame ${row.frame}: speed ${row.speed}`);
      assert.ok(row.acceleration<.5,`${scenario.attack.name}/${playerX} frame ${row.frame}: acceleration ${row.acceleration}`);
    }
    assert.ok(result.samples[scenario.start].speed<.02,'first volley keeps the prepared actor position');
  }
});

test('the survival card connects every section, its breathing gaps and the continuing final section',()=>{
  const {samples}=trace(cases[2]);
  assert.deepEqual([...new Set(samples.filter(row=>row.segment!==undefined).map(row=>row.segment))],[0,1,2,3,4,5]);
  for(let segment=1;segment<=6;segment++){
    const entry=samples[80+segment*620];
    assert.ok(entry.speed<.02,`section ${segment} starts at the last visible position`);
  }
  for(const segment of [3,5]){
    const firstRest=80+segment*620+590,lastRest=80+(segment+1)*620-1;
    assert.ok(samples[firstRest].acceleration<.1,'continuous paths decelerate before the breathing gap');
    for(let frame=firstRest+1;frame<=lastRest;frame++){
      assert.equal(samples[frame].x,samples[firstRest].x);
      assert.equal(samples[frame].y,samples[firstRest].y);
    }
  }
});

test('path joins preserve the authored volley schedule and consume no extra random values',()=>{
  for(const scenario of cases){
    const result=trace(scenario);
    assert.equal(result.events,scenario.events,scenario.attack.name);
    assert.equal(result.schedule,scenario.schedule,scenario.attack.name);
    assert.equal(result.rng,scenario.rng,scenario.attack.name);
    assert.deepEqual(trace(scenario),result,'the same fixed simulation frames reproduce the path');
  }
});

test('pausing the real game freezes the path join and resumes its next simulation frame',()=>{
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:73});
  const boss=game.spawnEnemy({x:0,y:105,hp:100000,directional:false}),state={};
  boss.invulnerable=true;game.player.invulnerability.set(999999);
  game.stage=scene=>driveAttack(MIO.nonspells[6],{game:scene,boss,frame:scene.frame,difficulty:4,state,start:60});
  try{
    for(let i=0;i<90;i++)game.update(0);
    const before={frame:game.frame,x:boss.x,y:boss.y,entry:{...state.pathEntry},rng:game.rng.state};
    game.update(Keys.PAUSE);assert.equal(game.paused,true);
    for(let i=0;i<24;i++)game.update(0);
    assert.deepEqual({frame:game.frame,x:boss.x,y:boss.y,entry:{...state.pathEntry},rng:game.rng.state},before);
    game.update(Keys.PAUSE);
    for(let i=0;i<90&&game.paused;i++)game.update(0);
    assert.equal(game.paused,false);assert.equal(game.frame,before.frame);
    game.update(0);
    assert.equal(game.frame,before.frame+1);
    assert.equal(state.pathEntry.age,before.entry.age+1);
    assert.ok(Math.hypot(boss.x-before.x,boss.y-before.y)<4);
  }finally{game.destroy();resources.dispose();}
});
