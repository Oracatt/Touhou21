import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {TouhouGame,createTouhouResources} from '@ts-stg/thlib/touhou';
import {STAGES,MIDBOSSES} from '../dist/src/content.js';
import {CampaignDirector} from '../dist/src/director.js';

function fixture({midboss=false}={}){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:73});
  game.player.invulnerability.set(999999);
  let dialogue;
  // Give the first midboss an existing authored dialogue so reaching its
  // movement endpoint cannot silently complete the dialogue in the fixture.
  const midbosses=MIDBOSSES.map(spec=>spec.stageId===1?{...spec,dialogues:MIDBOSSES[6].dialogues}:spec);
  const director=new CampaignDirector({stages:STAGES,midbosses,mode:'stage-practice',stageId:1,seed:73,
    callbacks:{dialogue:(_lines,context)=>{if(context.kind==='midboss')dialogue=context;else context.onComplete();}}}).attach(game);
  director.midbossDone=!midboss;
  director.stageFrame=midboss?midbosses[0].atFrame:STAGES[0].roadFrames;
  game.update(0);
  return{game,director,get dialogue(){return dialogue;},dispose(){director.destroy();game.destroy();resources.dispose();}};
}

const position=boss=>({x:boss.x,y:boss.y});
function closePosition(actual,expected,label){
  // Original Motion floors coordinates to hundredths after float32 sampling.
  // The bound includes float32 rounding around the flooring boundary.
  assert.ok(Math.abs(actual.x-expected.x)<=.011,`${label}: x ${actual.x} vs ${expected.x}`);
  assert.ok(Math.abs(actual.y-expected.y)<=.011,`${label}: y ${actual.y} vs ${expected.y}`);
}
const quadraticOut=t=>1-(1-t)*(1-t);
const quadraticInOut=t=>t<.5?2*t*t:1-2*(1-t)*(1-t);
const expectedPosition=(from,to,t,ease)=>({x:from.x+(to.x-from.x)*ease(t),y:from.y+(to.y-from.y)*ease(t)});

test('midboss flies in for100 frames with original mode4 deceleration, visible aura and a separate combat gate',()=>{
  const f=fixture({midboss:true}),{game,director}=f,boss=director.boss,presentation=game.bossPresentation;
  try{
    assert.equal(director.state,'midboss-enter');assert.deepEqual(position(boss),{x:-150,y:20});
    assert.equal(presentation.entrance.mode,'halfFog');assert.equal(presentation.entrance.readyFrame,100);
    assert.equal(presentation.bossVisible,true);const aura=presentation.aura[0],distortion=presentation.distortion;
    assert.ok(aura);let previous=position(boss),previousSpeed=Infinity;
    for(let frame=1;frame<=100;frame++){
      game.update(0);
      closePosition(position(boss),expectedPosition({x:-150,y:20},{x:0,y:105},frame/100,quadraticOut),`entry frame${frame}`);
      const speed=Math.hypot(boss.x-previous.x,boss.y-previous.y);
      assert.ok(speed<=previousSpeed+.02,`entry decelerates at frame${frame}: ${speed} after ${previousSpeed}`);
      previous=position(boss);previousSpeed=speed;
      assert.strictEqual(presentation.aura[0],aura);assert.strictEqual(presentation.distortion,distortion);
      assert.equal(aura.x,boss.x);assert.equal(aura.y,boss.y);
      assert.equal(presentation.combatActive,false);assert.equal(game.isBossCombatReady(boss),false);
      if(frame<100){assert.equal(director.state,'midboss-enter');assert.equal(f.dialogue,undefined);}
      if(frame===50){
        assert.deepEqual(position(boss),{x:-37.5,y:83.75});
        game.update(Keys.PAUSE);assert.equal(game.paused,true);
        const snapshot=()=>({position:position(boss),frame:game.frame,phaseFrame:director.phaseFrame,
          entranceAge:presentation.entrance.age,auraTime:aura.time,warpPhase:distortion.phaseX});
        const frozen=snapshot();for(let pause=0;pause<20;pause++)game.update(0);
        assert.deepEqual(snapshot(),frozen,'public pause freezes movement and its following effects');
        game.pauseVisual.resume();for(let pause=0;game.paused&&pause<40;pause++)game.update(0);
        assert.equal(game.paused,false);assert.deepEqual(snapshot(),frozen,'resume transition does not consume movement frames');
      }
    }
    assert.deepEqual(position(boss),{x:0,y:105});assert.equal(director.state,'dialogue');assert.ok(f.dialogue);
    for(let frame=0;frame<10;frame++){game.update(0);assert.deepEqual(position(boss),{x:0,y:105});}
    assert.equal(presentation.combatActive,false,'arrival does not bypass authored dialogue');
    f.dialogue.onComplete();assert.equal(director.state,'midboss-combat');assert.equal(presentation.combatActive,true);
  }finally{f.dispose();}
});

test('completed card returns along mode9 in exactly60 phase-wait frames without residual velocity or late drift',()=>{
  const f=fixture(),{game,director}=f;
  try{
    for(let frame=0;director.state!=='combat'&&frame<180;frame++)game.update(0);
    assert.equal(director.state,'combat');assert.equal(director.phase.spell,false);
    const boss=director.boss;
    boss.damage(100000,{type:'movement-test-open-card'},game.context);
    assert.equal(director.state,'combat');assert.equal(director.phase.spell,true);assert.equal(game.spell.active,true);
    const from={x:-120,y:165};Object.assign(boss,from);Object.assign(boss.motion.position,from);Object.assign(boss.animation,from);
    // A public capture can occur without the HP-defeat hold. The next move
    // must therefore explicitly cancel this previous velocity/delta.
    assert.equal(game.isBossHeld(boss),false);
    boss.motion.speed=4;boss.motion.angle=.4;Object.assign(boss.motion.delta,{x:3,y:2,z:0});
    const oldPhase=director.phaseIndex,target={x:80*Math.sin((oldPhase+1)*1.7),y:105};
    game.spell.capture(game.context);
    assert.equal(director.state,'phase-wait');assert.equal(director.waitFrames,60);
    const phaseStarts=director.events.filter(event=>event.event==='phase-start').length;
    assert.equal(boss.motion.speed,0);assert.deepEqual(boss.motion.delta,{x:0,y:0,z:0});
    let previous=position(boss),firstSpeed,lastSpeed;
    for(let frame=1;frame<=60;frame++){
      game.update(0);
      closePosition(position(boss),expectedPosition(from,target,frame/60,quadraticInOut),`handoff frame${frame}`);
      const speed=Math.hypot(boss.x-previous.x,boss.y-previous.y);previous=position(boss);
      if(frame===1)firstSpeed=speed;if(frame===60)lastSpeed=speed;
      assert.equal(game.bossPresentation.aura[0].x,boss.x);assert.equal(game.bossPresentation.aura[0].y,boss.y);
      if(frame<60){
        assert.equal(director.state,'phase-wait');assert.equal(director.phaseIndex,oldPhase);
        assert.equal(director.waitFrames,60-frame);
        assert.equal(director.events.filter(event=>event.event==='phase-start').length,phaseStarts);
      }
    }
    assert.ok(firstSpeed<.1&&lastSpeed<.1,'in/out quadratic motion starts and ends near rest');
    closePosition(position(boss),target,'terminal point');
    assert.equal(director.state,'combat');assert.equal(director.phaseIndex,oldPhase+1);assert.equal(director.phaseFrame,0);
    assert.equal(director.events.filter(event=>event.event==='phase-start').length,phaseStarts+1);
    game.update(0);assert.equal(director.phaseFrame,1,'the next attack receives its first tick after the complete60-frame handoff');
  }finally{f.dispose();}
});
