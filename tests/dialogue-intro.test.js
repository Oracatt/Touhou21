import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DrawList,Keys,stateHash} from '@ts-stg/thlib';
import {createTouhouResources,TouhouRNG} from '@ts-stg/thlib/touhou';
import {CampaignScene} from '../dist/src/scene.js';
import {STAGES} from '../dist/src/content.js';
import {BOSS_SPRITE_LAYOUTS} from '../dist/src/boss-sprites.js';

function fixture({character=0,stageId=1,lines,view,playbackSource=null}={}){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11,createTexture:()=>12,unloadTexture(){}}),writes=[],portraits=[],music=[];
  resources.encodeText=text=>new Uint8Array(Array.from(text).flatMap(char=>char.codePointAt(0)>127?[65,65]:[65]));
  resources.writeAnimationText=(vm,text)=>{writes.push(text);return vm;};
  const storage={settings:{startingLives:2,autoSaveReplay:false},progress:{spellRecords:{},seenSpells:[],stageUnlock:1,scores:[]},writes:0,
    saveProgress(){this.writes++;},saveReplay(){this.writes++;},recordClear(){this.writes++;}};
  const art={host:{createTexture:()=>89,unloadTexture(){}},load:path=>{
    const layout=Object.values(BOSS_SPRITE_LAYOUTS).find(layout=>layout.file===path);
    return{id:path.startsWith('assets/boss-names/')?82:81,width:layout?.width??512,height:layout?.height??512,bounds:{x:0,y:0,width:265,height:512}};
  },
    portrait:(_draw,id,_x,_y,_height,options)=>portraits.push({id,...options}),background(){}};
  const rng=new TouhouRNG(73),visualRng=new TouhouRNG(73^0x6d2b79f5);
  for(const bank of Object.values(resources.banks)){bank.rng=visualRng;bank.environment={...bank.environment,rng:visualRng};}
  const game=new CampaignScene({banks:resources.banks,font:resources.font,sht:resources.shots[character],styles:resources.styles,rng,visualRng,power:400,...(view?{view}:{})},
    {resources,host:{backend:'v8'},art,text:{draw(){}},music:{play:id=>music.push(id),pause(){},resume(){},fadeOut(){}},storage,
      config:{character,difficulty:1,mode:stageId===7?'extra':'normal',spellId:null,stageId,seed:73},playbackSource,options:{testing:true,fixedClock:true}});
  if(lines){const route=character?'marisa':'reimu';game.director.stages=game.director.stages.map(stage=>stage.id===stageId?
    {...stage,dialogues:{...stage.dialogues,[route]:{...stage.dialogues[route],before:lines}}}:stage);}
  let appearances=0;const bossSpawn=game.director.callbacks.bossSpawn;
  game.director.callbacks.bossSpawn=(...args)=>{appearances++;return bossSpawn(...args);};
  game.director.midbossDone=true;game.director.stageFrame=game.director.stage.roadFrames;
  return{game,music,writes,portraits,storage,get appearances(){return appearances;},dispose(){game.destroy();resources.dispose();}};
}
const tick=(game,count,mask=0)=>{for(let frame=0;frame<count;frame++)game.update(mask);};
function enterDialogue(game){
  for(let frame=0;frame<30&&!(game.dialogue?.index>=0);frame++)game.update(0);
  assert.equal(game.director.state,'dialogue');assert.equal(game.dialogue.index,0);return game.dialogue;
}
function nextLine(game){
  const owner=game.dialogue,index=owner.index;
  for(let attempt=0;attempt<650;attempt++){
    game.update(0);if(game.dialogue!==owner||owner.index!==index)return;
    game.update(Keys.SHOOT);if(game.dialogue!==owner||owner.index!==index)return;
  }
  assert.fail(`Dialogue line ${index} did not advance through real input`);
}
function firstBossLine(game){
  const owner=enterDialogue(game),index=owner.steps.findIndex(step=>step.speaker==='right');
  while(owner.index<index)nextLine(game);
  assert.equal(owner.index,index);return owner;
}

test('all seven authored preludes separate the field actor, portrait and music cues for both players',()=>{
  for(const stage of STAGES)for(const character of [0,1]){
    const f=fixture({character,stageId:stage.id});
    try{
      const owner=enterDialogue(f.game),steps=owner.steps,first=steps.findIndex(step=>step.speaker==='right');
      assert.ok(first>0);assert.equal(f.game.director.boss,null);assert.equal(f.appearances,0);
      assert.ok(steps.slice(0,first).every(step=>step.portraits.left.present&&!step.portraits.right.present));
      assert.equal(steps[first].boxMode,2);assert.deepEqual(steps[first].portraits,{left:{present:false},right:{present:false}});
      assert.deepEqual(steps[first].entrance,{portraitFrame:0,speakerFrame:0,textFrame:60,inputFrame:94});
      assert.deepEqual(steps[first].events.find(event=>event.name==='appear'),{type:'cue',name:'appear',entranceStage:'portraits'});
      assert.ok(steps[first+1].portraits.left.present&&steps[first+1].portraits.right.present);
      assert.deepEqual(steps.flatMap((step,index)=>step.events.filter(event=>event.type==='boss-name').map(()=>index)),[first+1],
        'MSG20 introduces a single name card together with the portrait, never with the actor-only response');
      assert.equal(steps[first+1].boxMode,undefined,'Portrait dialogue resumes the public speaker-based bubble');
      const musicIndex=steps.findIndex(step=>step.events.some(event=>event.name==='music'));
      assert.ok(musicIndex>first,'Actor entrance retains the stage BGM');
    }finally{f.dispose();}
  }
});

test('the Boss name waits for the portrait, freezes during pause and fades on dialogue exit',()=>{
  const f=fixture();
  try{
    const game=f.game,owner=firstBossLine(game);
    assert.equal(game.bossNameCard,null);tick(game,94);assert.equal(game.bossNameCard,null);
    nextLine(game);const card=game.bossNameCard;
    assert.equal(card.bossId,'akari');assert.equal(card.age,0);tick(game,60);assert.equal(card.age,60);
    const before=card.snapshot();game.update(Keys.PAUSE);tick(game,20);assert.equal(game.paused,true);
    assert.deepEqual(card.snapshot(),before);game.pauseVisual.resume();
    for(let frame=0;game.paused&&frame<30;frame++)game.update();
    assert.equal(game.paused,false);assert.deepEqual(card.snapshot(),before);
    game.update();assert.equal(card.age,61);owner.finish();tick(game,10);
    assert.equal(card.exitAge,10);assert.equal(card.alive,true);tick(game,10);
    assert.equal(card.alive,false);assert.equal(game.bossNameCard,null);
  }finally{f.dispose();}
});

test('long-held dialogue names retire once and postbattle or midboss dialogue never introduces them',()=>{
  const f=fixture();
  try{
    const game=f.game;firstBossLine(game);nextLine(game);const card=game.bossNameCard;
    tick(game,380);assert.equal(card.alive,false);assert.equal(game.bossNameCard,null);
    nextLine(game);assert.equal(game.bossNameCard,null,'subsequent portrait lines do not restart the name animation');
    for(const kind of ['after','midboss']){
      game.openDialogue([{speaker:'boss',text:'Later.'}],{bossId:'akari',kind,onComplete(){}});
      tick(game,40);assert.equal(game.bossNameCard,null);
      assert.ok(game.dialogue.steps.every(step=>step.events.every(event=>event.type!=='boss-name')));
    }
  }finally{f.dispose();}
});

test('the actual dialogue render queue places Boss names on source layer37 below dialogue text',()=>{
  const f=fixture();
  try{
    const game=f.game,owner=firstBossLine(game);nextLine(game);tick(game,60);
    let entries;const flush=owner.queue.flush.bind(owner.queue);
    owner.queue.flush=(target,options)=>{entries=owner.queue.entries.slice();return flush(target,options);};
    const draw=new DrawList();owner.draw(draw,{x:0,y:0,scale:1,screenScale:1.5});
    const name=entries.find(entry=>entry.commands?.some(command=>command[0]==='spriteRegion'&&command[1]===82));
    assert.equal(name.layer,37);assert.equal(name.priority,owner.queue.layerPriority(37));
    assert.ok(entries.some(entry=>entry.layer===35&&entry.priority<name.priority),'portrait geometry is behind the name');
    assert.ok(entries.some(entry=>entry.layer===36&&entry.priority<name.priority),'source balloons are behind the name');
    assert.ok(entries.some(entry=>entry!==name&&entry.layer===37&&entry.order>name.order),'same-layer dialogue text stays in front of the name');
    assert.equal(draw.commands.filter(command=>command[0]==='spriteRegion'&&command[1]===82).length,1);
  }finally{f.dispose();}
});

test('paused scene composition keeps portraits, text and Boss names behind the pause menu',()=>{
  const f=fixture();
  try{
    const game=f.game;firstBossLine(game);nextLine(game);tick(game,60);game.update(Keys.PAUSE);
    assert.equal(game.paused,true);const before=game.bossNameCard.snapshot(),marker=0x21436587;
    const drawPause=game.pauseVisual.draw.bind(game.pauseVisual);
    game.pauseVisual.draw=draw=>{drawPause(draw);draw.rect(1,2,3,4,marker);};
    const commands=game.render(),nameIndex=commands.findIndex(command=>command[0]==='spriteRegion'&&command[1]===82);
    const pauseIndex=commands.findIndex(command=>command[0]==='rect'&&command.at(-1)===marker);
    assert.ok(nameIndex>=0);assert.ok(pauseIndex>nameIndex,'the common pause owner is drawn after the full business dialogue');
    let scissor=null;for(const command of commands.slice(0,nameIndex)){if(command[0]==='scissor')scissor=command;else if(command[0]==='scissorEnd')scissor=null;}
    assert.equal(scissor,null,'full-screen dialogue does not inherit the gameplay viewport clip');
    assert.deepEqual(game.bossNameCard.snapshot(),before,'composition cannot tick the frozen name');
  }finally{f.dispose();}
});

test('a middle dialogue step retires the player portrait before the actor bubble and later recreates both portraits',()=>{
  for(const character of [0,1]){
    const f=fixture({character});
    try{
      const game=f.game,owner=firstBossLine(game),first=owner.index,oldLeft=owner.portraitMotion,stageMusic=f.music.at(-1);
      assert.equal(f.appearances,1);assert.ok(game.director.boss?.alive);assert.equal(game.director.bossAppeared,true);
      assert.ok(owner.entranceState,'The public owner starts the per-step entrance in the middle of the conversation');
      assert.equal(owner.entranceState.frame,0);assert.ok(!owner.box);assert.equal(owner.portraitState('right'),null);
      assert.ok(oldLeft?.alive,'The previous portrait follows its source exit instead of disappearing immediately');
      tick(game,29);assert.ok(!owner.box);assert.equal(owner.portraitState('right'),null);
      tick(game,1);assert.ok(oldLeft.alive,'The source exit retains its frame30 tail');
      tick(game,1);assert.equal(owner.portraitState('left'),null,'The source 30-frame exit retires on its following ANM tick');
      tick(game,28);assert.equal(owner.entranceState.frame,59);assert.ok(!owner.box);
      game.update(0);assert.equal(owner.entranceState.frame,60);assert.equal(owner.mode,2);
      assert.ok([272,296].includes(owner.box.scriptId));assert.equal(owner.index,first);assert.equal(owner.advance(),false);
      f.portraits.length=0;owner.draw(new DrawList(),{x:0,y:0,scale:1,screenScale:1.5});
      assert.deepEqual(f.portraits,[],'The actor bubble is rendered without either business portrait');
      tick(game,33);assert.equal(owner.entranceState.frame,93);assert.equal(owner.advance(),false);
      game.update(0);assert.equal(owner.entranceState.inputReady,true);assert.equal(f.music.at(-1),stageMusic);
      nextLine(game);assert.equal(owner.index,first+1);assert.ok(owner.portraitMotion?.alive);assert.ok(owner.rightPortraitMotion?.alive);
      assert.notEqual(owner.portraitMotion,oldLeft);assert.equal(owner.mode,owner.current.speaker==='left'?0:1);
      assert.ok([270,271,294,295].includes(owner.box.scriptId));assert.equal(f.appearances,1);
      while(owner.active&&!game.director.bossMusicStarted)nextLine(game);
      assert.equal(f.music.filter(id=>id===STAGES[0].bgmBoss).length,1,'Boss music starts once at its independent authored cue');
    }finally{f.dispose();}
  }
});

test('the actor bubble anchors to the spawned Boss through the actual view once, rather than a fixed playfield point',()=>{
  const f=fixture({view:{x:301,y:39,scale:1.25,screenScale:1}});
  try{
    const owner=firstBossLine(f.game),boss=f.game.director.boss,anchor={x:2*((301+boss.x*1.25)/1.5-32),y:2*((39+boss.y*1.25)/1.5+6)};
    assert.equal(owner.current.x,anchor.x);assert.equal(owner.current.y,anchor.y);
    boss.x=40;boss.y=80;f.game.view={x:340,y:50,scale:1.8,screenScale:1};tick(f.game,60);
    assert.equal(owner.box.x,Math.fround(anchor.x));assert.equal(owner.box.y,Math.fround(anchor.y),'MSG screen coordinates remain fixed after entry');
    assert.equal(owner.current.x,anchor.x);assert.equal(owner.current.y,anchor.y);
  }finally{f.dispose();}
});

test('pause and held skip cannot advance the field response before its input gate or repeat its appearance cue',()=>{
  const f=fixture();
  try{
    const game=f.game,owner=firstBossLine(game),first=owner.index;
    tick(game,17);const frame=owner.entranceState.frame,age=owner.age;
    game.update(Keys.PAUSE);tick(game,25);assert.equal(game.paused,true);
    assert.equal(owner.entranceState.frame,frame);assert.equal(owner.age,age);assert.equal(f.appearances,1);
    game.update(Keys.PAUSE);for(let i=0;i<40&&game.paused;i++)game.update(0);assert.equal(game.paused,false);
    assert.equal(owner.entranceState.frame,frame);
    while(owner.entranceState.frame<93)game.update(Keys.FOCUS|Keys.SHOOT);
    assert.equal(owner.index,first);assert.equal(owner.mode,2);assert.equal(f.appearances,1);
    game.update(Keys.FOCUS|Keys.SHOOT);assert.equal(owner.index,first+1);assert.equal(f.appearances,1);
  }finally{f.dispose();}
});

test('ordinary dialogue and short prelude fallbacks retain their public portrait and completion flow',()=>{
  const f=fixture();
  try{
    f.game.director.state='dialogue';
    f.game.openDialogue([{speaker:'boss',text:'Still here.'},{speaker:'reimu',text:'So am I.'}],{bossId:'akari',kind:'before',onComplete(){}});
    tick(f.game,12);const owner=f.game.dialogue;
    assert.equal(owner.mode,1);assert.equal(owner.entranceState,null);assert.ok(owner.portraitMotion?.alive);assert.ok(owner.rightPortraitMotion?.alive);
    f.game.openDialogue([{speaker:'reimu',text:'All done.'}],{bossId:'akari',kind:'after',onComplete(){}});
    assert.equal(f.game.dialogue.entranceState.frame,0);assert.ok(f.game.dialogue.portraitMotion?.alive);assert.ok(f.game.dialogue.rightPortraitMotion?.alive);
    assert.equal(f.game.dialogue.box,undefined);tick(f.game,34);assert.equal(f.game.dialogue.mode,0);
  }finally{f.dispose();}
  for(const lines of [[{speaker:'reimu',text:'Is anybody here?'}],[{speaker:'reimu',text:'Anybody?'},{speaker:'boss',text:'Here.'}],
    [{speaker:'reimu',text:'Anybody?'},{speaker:'boss',text:'Here.'},{speaker:'reimu',text:'Found you.'}]]){
    const short=fixture({lines});
    try{
      const owner=enterDialogue(short.game);
      if(lines.length===2)assert.equal(owner.steps[1].portraits.right.present,false,'No portrait cue is fabricated past the final line');
      if(lines.length===3){assert.ok(owner.steps[2].portraits.right.present);assert.ok(owner.steps[2].events.some(event=>event.name==='music'),'Music and portrait may start on the same line');}
      for(let i=0;i<10&&short.game.dialogue?.active;i++)nextLine(short.game);
      assert.equal(short.game.dialogue,null);assert.ok(short.game.director.boss?.alive);
      assert.equal(short.appearances,1);assert.equal(short.music.filter(id=>id===STAGES[0].bgmBoss).length,1);
      assert.ok(['boss-enter','combat'].includes(short.game.director.state));
    }finally{short.dispose();}
  }
});

test('recorded prelude replays its field-response gates, portrait handoff and pause without progress writes',()=>{
  const recording=fixture(),marks=[];let replay,finalHash;
  const mark=label=>{recording.game.recorder.checkpoint(recording.game.snapshot());marks.push({label,frame:recording.game.recorder.frames});};
  try{
    const game=recording.game,owner=firstBossLine(game),first=owner.index;
    assert.ok(owner.entranceState);mark('actor-appear');tick(game,59);assert.ok(!owner.box);mark('before-text');
    game.update(0);assert.equal(owner.mode,2);mark('actor-text');tick(game,5);
    game.update(Keys.PAUSE);assert.equal(game.paused,true);mark('pause');
    const entranceFrame=owner.entranceState.frame;tick(game,24);assert.equal(owner.entranceState.frame,entranceFrame);mark('paused');
    game.update(Keys.PAUSE);for(let i=0;i<40&&game.paused;i++)game.update(0);
    assert.equal(game.paused,false);assert.equal(owner.entranceState.frame,entranceFrame);mark('resume');
    while(owner.entranceState.frame<93)game.update(0);assert.equal(owner.index,first);mark('before-input');
    game.update(0);assert.equal(owner.entranceState.inputReady,true);mark('input-ready');
    nextLine(game);assert.equal(owner.index,first+1);assert.ok(owner.portraitState('left'));assert.ok(owner.portraitState('right'));mark('portraits');
    for(let i=0;i<30&&game.dialogue?.active;i++)nextLine(game);
    for(let i=0;i<200&&game.director.state!=='combat';i++)game.update(0);
    assert.equal(game.director.state,'combat');mark('combat');
    while(game.recorder.frames<1201)game.update(0);
    mark('final');replay=game.recorder.toJSON();finalHash=stateHash(game.snapshot());
    assert.ok(replay.checkpoints.some(point=>point.frame===600));assert.ok(replay.checkpoints.some(point=>point.frame===1200));
    assert.equal(recording.storage.writes,0);
  }finally{recording.dispose();}
  const playback=fixture({playbackSource:replay}),initialProgress=JSON.stringify(playback.storage.progress),checked=[];
  try{
    const checkpointMap=new Map(replay.checkpoints.map(point=>[point.frame,point.hash]));
    for(let frame=1;frame<=replay.frames;frame++){
      playback.game.update(Keys.BOMB);
      if(checkpointMap.has(frame)){assert.equal(stateHash(playback.game.snapshot()),checkpointMap.get(frame));checked.push(frame);}
    }
    assert.equal(playback.game.playback.desync,null);assert.equal(playback.game.playback.finished,true);
    assert.equal(stateHash(playback.game.snapshot()),finalHash);assert.ok(marks.every(mark=>checked.includes(mark.frame)));
    assert.equal(JSON.stringify(playback.storage.progress),initialProgress);assert.equal(playback.storage.writes,0);
  }finally{playback.dispose();}
  assert.equal(playback.storage.writes,0,'Disposal does not save replay or progress during playback');
});
