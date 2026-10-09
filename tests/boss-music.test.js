import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {MusicController} from '../src/music.js';
import {ProjectApplication} from '../src/application.js';
import {STAGES} from '../src/content.js';
import {musicTrack} from '../src/music-data.js';

function transport(){
  let next=1;const files=new Map(),calls=[];
  const host={calls,time:0,loadMusic:file=>{const id=next++;files.set(id,file);return id;},setMusicLoop(){},
    unloadMusic:id=>calls.push(['unload',files.get(id)]),
    seekMusic:(id,time)=>calls.push(['seek',files.get(id),time]),
    playMusic:(id,volume)=>calls.push(['play',files.get(id),volume]),
    stopMusic:id=>calls.push(['stop',files.get(id)]),pauseMusic:id=>calls.push(['pause',files.get(id)]),
    resumeMusic:id=>calls.push(['resume',files.get(id)]),setMusicVolume:(id,volume)=>calls.push(['volume',files.get(id),volume]),
    getMusicTime:()=>host.time};
  const settings={musicVolume:72},music=new MusicController(host,settings);
  return{host,music,settings,calls};
}
const advance=(music,frames)=>{for(let i=0;i<frames;i++)music.update();};
const starts=f=>f.calls.filter(call=>call[0]==='play').map(call=>call[1]);

test('the Boss cue stops the road, leaves 42 fixed audio updates silent, then starts at sample zero once',()=>{
  const f=transport();let captions=0;
  f.music.play('stage01');f.host.time=35;
  f.music.play('boss01',true,{silenceFrames:42,onStart:()=>captions++});
  assert.equal(f.music.current,null);assert.deepEqual(f.calls.at(-1),['stop','assets/music/stage01.wav']);
  advance(f.music,41);assert.deepEqual(starts(f),['assets/music/stage01.wav']);assert.equal(captions,0);
  f.music.update();assert.deepEqual(f.calls.slice(-2),[['seek','assets/music/boss01.wav',0],['play','assets/music/boss01.wav',.72]]);
  assert.equal(captions,1);assert.equal(f.music.pending,null);advance(f.music,100);assert.equal(captions,1);
  f.music.destroy();
});

test('pause freezes the silent interval; the later start uses the current volume',()=>{
  const f=transport();f.music.play('stage02');f.music.play('boss02',true,{silenceFrames:42});advance(f.music,13);
  f.music.pause();advance(f.music,300);assert.equal(f.music.pending.remainingFrames,29);assert.equal(f.music.current,null);
  f.settings.musicVolume=25;f.music.volume();f.music.resume();advance(f.music,28);assert.equal(f.music.current,null);
  f.music.update();assert.deepEqual(f.calls.at(-1),['play','assets/music/boss02.wav',.25]);f.music.destroy();
});

test('title, retry, another cue, stop, stage fade and disposal abandon the previous delayed start',()=>{
  for(const action of ['title','retry','cue','stop','fade','destroy']){
    const f=transport();let staleCaptions=0;f.music.play('stage03');
    f.music.play('boss03',true,{silenceFrames:42,onStart:()=>staleCaptions++});advance(f.music,10);
    if(action==='title')f.music.play('title');
    else if(action==='retry')f.music.play('stage03');
    else if(action==='cue')f.music.play('boss04',true,{silenceFrames:42});
    else if(action==='stop')f.music.stop();else if(action==='fade')f.music.fadeOut();else f.music.destroy();
    advance(f.music,100);assert.equal(staleCaptions,0,action);assert.ok(!starts(f).includes('assets/music/boss03.wav'),action);
    if(action==='cue')assert.equal(f.music.current.id,'boss04');f.music.destroy();
  }
});

test('Game Over and nested interruptions preserve the remaining silence without reviving the road track',()=>{
  const f=transport();let captions=0;f.music.play('stage05');f.music.play('boss05',true,{silenceFrames:42,onStart:()=>captions++});
  advance(f.music,12);const first=f.music.interrupt('playersScore');advance(f.music,180);
  const second=f.music.interrupt('playersScore');first.restore();advance(f.music,180);
  assert.equal(f.music.current.id,'playersScore');assert.equal(captions,0);
  second.restore();assert.equal(f.music.current,null);assert.equal(f.music.pending.remainingFrames,30);
  advance(f.music,29);assert.equal(captions,0);f.music.update();assert.equal(captions,1);
  assert.equal(starts(f).filter(file=>file==='assets/music/stage05.wav').length,1);f.music.destroy();
});

test('discard and explicit music replacement cannot resurrect interrupted pending music',()=>{
  for(const action of ['discard','replace','stop']){
    const f=transport();f.music.play('boss06',true,{silenceFrames:42});
    const session=f.music.interrupt('playersScore');
    if(action==='discard')session.discard();else if(action==='stop')f.music.stop();else f.music.play('title');
    session.restore();advance(f.music,100);assert.ok(!starts(f).includes('assets/music/boss06.wav'));f.music.destroy();
  }
});

test('repeated non-restarting requests keep their original deadline and invalid requests keep the current music',()=>{
  const f=transport();f.music.play('stage01');
  for(const silenceFrames of [-1,1.5,Infinity])assert.throws(()=>f.music.play('boss01',true,{silenceFrames}),RangeError);
  assert.throws(()=>f.music.play('missing',true,{silenceFrames:42}),/Unknown music/);assert.equal(f.music.current.id,'stage01');
  f.music.play('boss01',true,{silenceFrames:42});advance(f.music,20);f.music.play('boss01',false,{silenceFrames:42});
  assert.equal(f.music.pending.remainingFrames,22);advance(f.music,22);assert.equal(f.music.current.id,'boss01');f.music.destroy();
});

function application({stageId=1,character=0,mode=stageId===7?'extra':'stage-practice'}={}){
  const f=transport();let handle=10;const noop=()=>{},host={...f.host,backend:'v8',
    encodeText:text=>new Uint8Array(Array.from(text).flatMap(char=>char.codePointAt(0)>127?[65,65]:[65])),
    readText:file=>String(file).startsWith('userdata/')?'':fs.readFileSync(file,'utf8'),writeText:noop,hasSystemFont:()=>true,
    loadTexture:()=>handle++,unloadTexture:noop,createTexture:()=>handle++,createRenderTarget:()=>handle++,
    readTexturePixels:()=>({width:1024,height:1024,pixels:new Uint8Array(1024*1024*4)}),updateTexture:noop,
    loadSound:()=>handle++,playSound:noop,stopSound:noop,pauseSound:noop,resumeSound:noop,unloadSound:noop,isSoundPlaying:()=>false,quit:noop};
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,autostart:true,invincible:true,skipRoad:true,
    stageId,character,mode,difficulty:stageId===7?4:1,seed:73,spellId:mode==='spell-practice'?STAGES[stageId-1].spells[0].id:null});
  app.core.game.dialogueResources.writeAnimationText=vm=>vm;
  return{...f,app,music:app.music,game:app.core.game};
}

test('all seven actual preludes preserve the lead-in under held skip and show the Boss caption only at playback',()=>{
  for(const stage of STAGES)for(const character of [0,1]){
    const f=application({stageId:stage.id,character});
    try{
      for(let i=0;i<1600&&!f.music.pending;i++)f.app.update(Keys.FOCUS);
      assert.equal(f.music.pending?.id,stage.bgmBoss,`${stage.id}/${character}`);assert.equal(f.game.bgmCaption,null);
      assert.equal(f.music.current,null);const remaining=f.music.pending.remainingFrames;
      f.game.director._cue('music');assert.equal(f.music.pending.remainingFrames,remaining,'Duplicate dialogue cue does not restart silence');
      for(let i=1;i<remaining;i++){f.app.update(Keys.FOCUS);assert.equal(f.music.current,null);assert.equal(f.game.bgmCaption,null);}
      f.app.update(Keys.FOCUS);assert.equal(f.music.current.id,stage.bgmBoss);
      assert.equal(f.game.bgmCaption.title,musicTrack(stage.bgmBoss).title);assert.equal(f.game.bgmCaption.age,0);
      for(let i=0;i<700&&f.game.director.state!=='combat';i++)f.app.update(Keys.FOCUS);
      assert.equal(f.game.director.state,'combat');
      assert.equal(starts(f).filter(file=>file===musicTrack(stage.bgmBoss).file).length,1,'Dialogue completion does not restart Boss music');
    }finally{f.app.destroy();}
  }
});

test('leaving the actual prelude during silence cancels its caption and playback',()=>{
  const f=application();try{
    for(let i=0;i<1600&&!f.music.pending;i++)f.app.update(Keys.FOCUS);
    assert.ok(f.music.pending);f.app.leaveGame();
    for(let i=0;i<100;i++)f.app.update(0);
    assert.equal(f.music.current.id,'title');assert.ok(!starts(f).includes('assets/music/boss01.wav'));assert.equal(f.music.pending,null);
  }finally{f.app.destroy();}
});

test('standalone spell practice remains immediate without a road-to-Boss handoff',()=>{
  const f=application({mode:'spell-practice'});try{
    assert.equal(f.music.current.id,'boss01');assert.equal(f.music.pending,null);
    assert.equal(f.game.bgmCaption.title,musicTrack('boss01').title);
  }finally{f.app.destroy();}
});
