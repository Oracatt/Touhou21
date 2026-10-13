import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Keys} from '@ts-stg/thlib';
import {TouhouGame,TouhouMotion,TouhouRNG,createTouhouResources} from '@ts-stg/thlib/touhou';
import {MIO} from '../dist/src/attacks/mio.js';
import {driveAttack} from '../dist/src/danmaku.js';

const cases=[
  {attack:MIO.nonspells[6],start:60,schedule:'d27b17ca505e729abf71d4c3b8d1bb0d9447caf360137888832b10b33da7c5ef',events:512,rng:73},
  {attack:MIO.spells[5],start:80,schedule:'babd1057a9d6154237078e057c6c40f391230f7e1cb38bf442209a834559a59d',events:7522,rng:953302479},
  {attack:MIO.spells[7],start:80,schedule:'107396cddebd6ba5253765ea8baceb20b75d97d3c9c10183d684d0ba6958b59c',events:1504,rng:99321389},
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
    samples.push({frame,x:boss.x,y:boss.y,speed:Math.hypot(dx,dy),acceleration:Math.hypot(dx-previousDx,dy-previousDy)});
    previousDx=dx;previousDy=dy;
  }
  return{samples,log:events,rng:rng.state,events:events.length,schedule:createHash('sha256').update(JSON.stringify(events)).digest('hex')};
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

test('the survival card breathes once a second from a still Boss and every breath is fuller',()=>{
  const {samples,log}=trace(cases[2]);
  for(const row of samples.slice(80))assert.ok(row.speed<.02,`frame ${row.frame}: the Boss holds still`);
  const exhales=log.filter(row=>row[1]==='bullet'&&row[5]>=26);
  assert.deepEqual(exhales.map(row=>row[0]),Array.from({length:64},(_,breath)=>80+breath*60));
  for(let breath=1;breath<exhales.length;breath++)assert.ok(exhales[breath][5]>=exhales[breath-1][5],`breath ${breath} is no thinner`);
  assert.ok(exhales.at(-1)[5]>exhales[0][5]+12);
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
