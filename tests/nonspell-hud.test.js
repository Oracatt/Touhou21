import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {createTouhouResources,TouhouRNG,TouhouBossHud,TouhouPlayer} from '@ts-stg/thlib/touhou';
import {CampaignScene} from '../dist/src/scene.js';
import {CampaignBossHud} from '../dist/src/campaign-boss-hud.js';
import {STAGES} from '../dist/src/content.js';

function fixture({midboss=false,spell=false}={}){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  resources.encodeText=text=>new Uint8Array(Array.from(text).flatMap(char=>char.charCodeAt(0)>127?[65,65]:[65]));
  resources.writeAnimationText=vm=>vm;
  const storage={settings:{startingLives:2,autoSaveReplay:false},progress:{spellRecords:{},seenSpells:[],stageUnlock:1,scores:[]},saveProgress(){},saveReplay(){},recordClear(){}};
  const art={host:{createTexture:()=>89,unloadTexture(){}},load:()=>({id:81,width:512,height:512,bounds:{x:0,y:0,width:265,height:512}}),portrait(){},background(){}};
  const rng=new TouhouRNG(73),visualRng=new TouhouRNG(73^0x6d2b79f5),sounds=[];let playerFactoryCalls=0;
  for(const bank of Object.values(resources.banks)){bank.rng=visualRng;bank.environment={...bank.environment,rng:visualRng};}
  const game=new CampaignScene({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,rng,visualRng,power:400,
    onSound:id=>sounds.push(id),factories:{player:options=>{playerFactoryCalls++;return new TouhouPlayer(options);}}},
    {resources,host:{backend:'v8'},art,text:{draw(){}},music:{play(){},pause(){},resume(){},fadeOut(){}},storage,
      config:{character:0,difficulty:1,mode:spell?'spell-practice':'normal',spellId:spell?STAGES[0].spells[0].id:null,stageId:1,seed:73},
      options:{testing:true,fixedClock:true,skipRoad:!midboss}});
  game.director.callbacks.dialogue=(_lines,{onComplete})=>onComplete();
  if(midboss)game.director.stageFrame=game.director.midbosses.find(spec=>spec.stageId===1).atFrame;
  let updates=0;const update=game.bossHud.update.bind(game.bossHud);
  game.bossHud.update=state=>{updates++;return update(state);};
  return{game,sounds,get updates(){return updates;},playerFactoryCalls,dispose(){game.destroy();resources.dispose();}};
}
const tick=(game,count=1,mask=0)=>{for(let i=0;i<count;i++)game.update(mask);};
function enterCombat(f,midboss=false){
  for(let i=0;i<300&&f.game.director.state!==(midboss?'midboss-combat':'combat');i++)f.game.update(0);
  assert.equal(f.game.director.state,midboss?'midboss-combat':'combat');
}
function checkClock(game,duration){
  const remaining=duration-game.director.phaseFrame;
  assert.equal(game.bossHud.state.remainingFrames,remaining);
  assert.equal(game.bossHud.seconds,Math.trunc(remaining/60));
  assert.equal(game.bossHud.hundredths,Math.trunc(remaining%60*100/60));
  assert.equal(game.bossHud.timerVisible,true);assert.equal(game.bossHud.state.timerHidden,false);
}

test('main Boss nonspell clock follows the completed phase tick through the public factory',()=>{
  const f=fixture();assert.ok(f.game.bossHud instanceof CampaignBossHud);assert.ok(f.game.bossHud instanceof TouhouBossHud);
  assert.equal(f.playerFactoryCalls,1,'Unrelated caller subsystem factories remain in use');
  enterCombat(f);assert.equal(f.game.director.phase.spell,false);
  const duration=f.game.director.phase.duration,updates=f.updates;tick(f.game,17);
  assert.equal(f.updates-updates,17,'Exactly one public HUD update per gameplay tick');checkClock(f.game,duration);
  f.dispose();
});

test('ordinary midboss uses its authored nonspell duration rather than an absent spell timer',()=>{
  const f=fixture({midboss:true});enterCombat(f,true);
  assert.equal(f.game.director.midbossPhase.spell,false);assert.equal(f.game.spell.active,false);
  assert.equal(f.game.director.midbossDuration,Math.round(f.game.director.midbossSpec.seconds*60));
  tick(f.game,17);checkClock(f.game,f.game.director.midbossDuration);f.dispose();
});

test('public pause freezes both the phase clock and the single HUD update stream',()=>{
  for(const midboss of [false,true]){
    const f=fixture({midboss});enterCombat(f,midboss);tick(f.game,17);
    const phaseFrame=f.game.director.phaseFrame,time=f.game.bossHud.state.remainingFrames,updates=f.updates;
    f.game.update(Keys.PAUSE);tick(f.game,24);
    assert.equal(f.game.paused,true);assert.equal(f.game.director.phaseFrame,phaseFrame);
    assert.equal(f.game.bossHud.state.remainingFrames,time);assert.equal(f.updates,updates);
    f.game.update(Keys.PAUSE);for(let i=0;i<40&&f.game.paused;i++)f.game.update(0);
    assert.equal(f.game.paused,false);assert.equal(f.game.director.phaseFrame,phaseFrame);
    f.game.update(0);assert.equal(f.game.director.phaseFrame,phaseFrame+1);checkClock(f.game,midboss?f.game.director.midbossDuration:f.game.director.phase.duration);f.dispose();
  }
});

test('stale nonspell metadata cannot show a zero clock during dialogue or midboss exit',()=>{
  for(const midboss of [false,true]){
    const f=fixture({midboss});enterCombat(f,midboss);tick(f.game,2);
    f.game.setBossHud({remainingFrames:540});
    if(midboss)f.game.director._finishMidboss(f.game);
    else{f.game.director.state='dialogue';f.game.context.dialogue=true;f.game.setBossHud({dialogue:true});}
    f.game.update(0);assert.equal(f.game.bossHud.timerVisible,false);assert.equal(f.game.bossHud.state.timerHidden,true);
    assert.ok(f.game.bossHud.numbers.every(vm=>!vm.visible),'Both public timer digit animations are hidden');f.dispose();
  }
});

test('spell and nonspell warning thresholds remain owned by one public HUD update',()=>{
  for(const spell of [false,true]){
    const f=fixture({spell});enterCombat(f);
    if(spell)f.game.spell.age.set(f.game.spell.duration-301);
    else f.game.director.phaseFrame=f.game.director.phase.duration-301;
    f.game.update(0);assert.equal(f.game.bossHud.state.remainingFrames,300);
    f.sounds.length=0;const updates=f.updates;
    f.game.update(0);assert.equal(f.game.bossHud.state.remainingFrames,299);
    assert.deepEqual(f.sounds.filter(id=>id===11||id===12),[11],'Crossing 5 seconds plays one public warning');
    assert.equal(f.updates-updates,1);
    tick(f.game,8);assert.deepEqual(f.sounds.filter(id=>id===11||id===12),[11],'No repeat warning within the same second');
    if(spell)f.game.spell.age.set(f.game.spell.duration-121);
    else f.game.director.phaseFrame=f.game.director.phase.duration-121;
    f.game.update(0);assert.equal(f.game.bossHud.state.remainingFrames,120);f.sounds.length=0;
    f.game.update(0);assert.equal(f.game.bossHud.state.remainingFrames,119);
    assert.deepEqual(f.sounds.filter(id=>id===11||id===12),[12],'Crossing 2 seconds plays one public urgent warning');
    if(spell)assert.equal(f.game.bossHud.state.remainingFrames,f.game.spell.remaining,'Spell forwards the public post-update remaining time');
    else checkClock(f.game,f.game.director.phase.duration);
    f.dispose();
  }
});

test('an escaping midboss queues its same body after the public presentation detaches it',()=>{
  const f=fixture({midboss:true});enterCombat(f,true);
  const boss=f.game.director.boss,queued=[],drawn=[];
  const queue={enqueue:(layer,callback,options)=>queued.push({layer,callback,options})};
  f.game.bossSprites.draw=(_draw,enemy,id,options)=>drawn.push({enemy,id,options});
  const escape=f.game.beginBossEscape(boss,{target:{x:192,y:-32},duration:60,easing:4});
  assert.equal(f.game.context.boss,null);assert.equal(f.game.bossPresentation.boss,null);assert.equal(escape.alive,true);
  boss.draw(queue,f.game.view);assert.equal(queued.length,1);assert.equal(queued[0].layer,7);assert.equal(queued[0].options.order,0);
  queued[0].callback({});assert.equal(drawn.length,1);assert.equal(drawn[0].enemy,boss);assert.equal(drawn[0].options.height,55);
  f.game.removeBoss(boss);queued.length=0;boss.draw(queue,f.game.view);assert.equal(queued.length,0,'The retired body cannot be queued again');f.dispose();
  const entering=fixture();entering.game.update(0);
  assert.equal(entering.game.bossPresentation.bossVisible,false,'The ordinary black-fog entrance still hides its body');
  entering.game.director.boss.draw(queue,entering.game.view);assert.equal(queued.length,0,'The escape render path must not bypass a normal fog entrance');entering.dispose();
});

test('real midboss defeat keeps the body drawn on every held and escaping frame until retirement',()=>{
  const f=fixture({midboss:true});enterCombat(f,true);
  const game=f.game,boss=game.director.boss,queued=[],drawn=[];
  const queue={enqueue:(layer,callback,options)=>{queued.push({layer,options});callback({});}};
  game.bossSprites.draw=(_draw,enemy)=>drawn.push(enemy);
  try{
    for(let i=0;game.director.state==='midboss-combat';i++){
      assert.ok(i<1000,'Capped public damage reaches registered defeat');
      game.context.damageEnemy(boss,1000000,{kind:'qa-public-damage',x:game.player.x,y:game.player.y});game.update(0);
    }
    assert.equal(game.director.state,'midboss-exit');assert.equal(game.director.pendingEscape?.boss,boss);
    assert.equal(game.context.boss,null);assert.equal(game.bossPresentation.boss,null);assert.equal(game.bossEscapes.length,0);
    const origin={x:boss.x,y:boss.y},delay=game.director.pendingEscape.delay;let heldFrames=0,escapeFrames=0,moved=false;
    const checkBody=()=>{
      queued.length=0;drawn.length=0;boss.draw(queue,game.view);
      assert.equal(queued.length,1,`Alive midboss body must be queued at exit frame ${game.director.phaseFrame}`);
      assert.equal(queued[0].layer,7);assert.equal(queued[0].options.order,0);assert.deepEqual(drawn,[boss]);
      assert.equal(game.context.boss,null);assert.equal(game.bossPresentation.boss,null);
      assert.equal(game.bossHud.timerVisible,false,'Body visibility must not reactivate combat HUD');
    };
    while(game.director.pendingEscape){
      assert.ok(heldFrames<=delay+1,'Delay remains bounded');assert.deepEqual({x:boss.x,y:boss.y},origin);
      checkBody();heldFrames++;game.update(0);
    }
    assert.ok(heldFrames>=delay);assert.ok(game.bossEscapes.some(entry=>entry.enemy===boss&&entry.sequence.alive));
    while(boss.alive){
      assert.ok(escapeFrames<65,'Public escape retires the body');checkBody();
      moved||=boss.x!==origin.x||boss.y!==origin.y;escapeFrames++;game.update(0);
    }
    assert.equal(moved,true);queued.length=0;drawn.length=0;boss.draw(queue,game.view);
    assert.equal(queued.length,0);assert.equal(drawn.length,0,'Retired body is no longer submitted');
  }finally{f.dispose();}
});
