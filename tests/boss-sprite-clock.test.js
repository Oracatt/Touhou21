import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DrawList,Keys,stateHash} from '@ts-stg/thlib';
import {createTouhouResources,TouhouRNG} from '@ts-stg/thlib/touhou';
import {CampaignScene} from '../dist/src/scene.js';
import {STAGES,MIDBOSSES} from '../dist/src/content.js';
import {BOSS_SPRITE_LAYOUTS,bossSpriteFrame} from '../dist/src/boss-sprites.js';

function fixture(){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  resources.encodeText=text=>new Uint8Array(Array.from(text).flatMap(char=>char.codePointAt(0)>127?[65,65]:[65]));
  resources.writeAnimationText=vm=>vm;
  const storage={settings:{startingLives:2,autoSaveReplay:false},progress:{spellRecords:{},seenSpells:[],stageUnlock:1,scores:[]},saveProgress(){},saveReplay(){},recordClear(){}};
  const art={host:{createTexture:()=>89,unloadTexture(){}},load(file){
    const layout=Object.values(BOSS_SPRITE_LAYOUTS).find(layout=>layout.file===file);
    return {id:81,width:layout?.width??512,height:layout?.height??512,bounds:{x:0,y:0,width:265,height:512}};
  },portrait(){},background(){}};
  const rng=new TouhouRNG(73),visualRng=new TouhouRNG(73^0x6d2b79f5);
  for(const bank of Object.values(resources.banks)){bank.rng=visualRng;bank.environment={...bank.environment,rng:visualRng};}
  const game=new CampaignScene({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,rng,visualRng,power:400},
    {resources,host:{backend:'v8'},art,text:{draw(){}},music:{play(){},pause(){},resume(){},fadeOut(){}},storage,
      config:{character:0,difficulty:1,mode:'normal',spellId:null,stageId:1,seed:73},options:{testing:true,fixedClock:true,invincible:true}});
  game.director.callbacks.dialogue=(_lines,{onComplete})=>onComplete();
  return{game,dispose(){game.destroy();resources.dispose();}};
}

test('a Boss created during a simulation update starts its own clock on that first frame',()=>{
  const f=fixture(),game=f.game;
  try{
    game.director.stageFrame=MIDBOSSES.find(boss=>boss.stageId===1).atFrame;
    assert.equal(game.director.boss,null);game.update();
    const boss=game.director.boss;assert.ok(boss?.alive);
    for(let frame=1;frame<=24;frame++){
      assert.equal(game.bossSprites.frame(boss),bossSpriteFrame({age:frame,_spriteDirection:boss._spriteDirection}));
      if(frame<24)game.update();
    }
  }finally{f.dispose();}
});

test('phase-wait repositioning animates the held body while its attack age remains frozen',()=>{
  const f=fixture(),game=f.game;
  try{
    game.director.midbossDone=true;game.director.stageFrame=STAGES[0].roadFrames;
    for(let frame=0;frame<300&&game.director.state!=='combat';frame++)game.update();
    assert.equal(game.director.state,'combat');
    const boss=game.director.boss;
    boss.damage(100000,{type:'test-strike'},game.context);boss.damage(100000,{type:'test-strike'},game.context);
    assert.equal(game.director.state,'phase-wait');assert.equal(game.isBossHeld(boss),true);
    const attackAge=boss.age,startX=boss.x,frames=[];
    for(let frame=0;frame<24;frame++){game.update();frames.push(game.bossSprites.frame(boss));assert.equal(boss.age,attackAge);}
    assert.notEqual(boss.x,startX);assert.ok(new Set(frames).size>=2,'holding the attack does not pin its visible movement pose');
  }finally{f.dispose();}
});

test('held retreat animates on simulation steps, freezes through pause and stops when removed',()=>{
  const f=fixture(),game=f.game;
  try{
    game.director.stageFrame=MIDBOSSES.find(boss=>boss.stageId===1).atFrame;game.update();
    const boss=game.director.boss;
    for(let frame=0;frame<110&&game.director.state!=='midboss-combat';frame++)game.update();
    assert.equal(game.director.state,'midboss-combat');
    boss.damage(100000,{type:'test-strike'},game.context);
    for(let frame=0;frame<120&&!game.bossEscapes.length;frame++)game.update();
    assert.equal(game.bossEscapes.length,1);assert.equal(game.isBossHeld(boss),true);
    const attackAge=boss.age,escape=game.bossEscapes[0].sequence,samples=[];
    for(let frame=0;frame<16;frame++){game.update();samples.push(game.bossSprites.frame(boss));assert.equal(boss.age,attackAge);}
    assert.ok(new Set(samples).size>=2);
    const beforePause=game.bossSprites.frame(boss),escapeAge=escape.age,frameBefore=game.frame;
    game.update(Keys.PAUSE);assert.equal(game.paused,true);
    for(let frame=0;frame<40;frame++)game.update();
    assert.equal(game.frame,frameBefore);assert.equal(escape.age,escapeAge);assert.equal(game.bossSprites.frame(boss),beforePause);
    game.pauseVisual.resume();for(let frame=0;game.paused&&frame<30;frame++)game.update();
    assert.equal(game.paused,false);assert.equal(game.frame,frameBefore);assert.equal(game.bossSprites.frame(boss),beforePause);
    for(let frame=0;frame<8;frame++)game.update();
    assert.notEqual(game.bossSprites.frame(boss),beforePause,'the same clock resumes at the next authored movement pose');
    for(let frame=0;boss.alive&&frame<120;frame++)game.update();
    assert.equal(boss.alive,false);const retiredFrame=game.bossSprites.frame(boss);
    for(let frame=0;frame<8;frame++)game.update();assert.equal(game.bossSprites.frame(boss),retiredFrame);
  }finally{f.dispose();}
});

test('Boss sprite updates and repeated body draws leave gameplay RNG and replay hashes unchanged',()=>{
  const f=fixture(),game=f.game;
  try{
    game.director.stageFrame=MIDBOSSES.find(boss=>boss.stageId===1).atFrame;game.update();
    for(let frame=0;frame<110;frame++)game.update();
    const boss=game.director.boss,before=game.snapshot(),hash=stateHash(before),actor=boss.snapshot();
    const random=[game.rng.state,game.visualRng.state,game.director.rng.state];
    for(let frame=0;frame<19;frame++)game.bossSprites.update(boss);
    const pose=game.bossSprites.frame(boss);
    for(let frame=0;frame<4;frame++){
      const draw=new DrawList();boss.draw(draw,game.view);
      assert.ok(draw.commands.some(command=>command[0]==='spriteRegion'),'the visible body actually renders');
    }
    assert.equal(game.bossSprites.frame(boss),pose);assert.deepEqual(boss.snapshot(),actor);
    assert.deepEqual(game.snapshot(),before);assert.equal(stateHash(game.snapshot()),hash);
    assert.deepEqual([game.rng.state,game.visualRng.state,game.director.rng.state],random);
  }finally{f.dispose();}
});
