import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys,stateHash} from '@ts-stg/thlib';
import {ProjectApplication} from '../dist/src/application.js';

const assets=fs.existsSync('packages/thlib/assets/touhou-common/manifest.json');
const needsAssets=assets?{}:{skip:'requires the private touhou-common resource pack (tools/setup-local.ps1)'};

function fixture(replay=null){
  let handle=1;const noop=()=>{},writes=new Map();
  const host={backend:'node-replay-pause',readText:file=>String(file).startsWith('userdata/')?'':fs.readFileSync(file,'utf8'),
    writeText:(file,text)=>writes.set(file,text),hasSystemFont:()=>true,
    loadTexture:()=>handle++,unloadTexture:noop,createTexture:()=>handle++,createRenderTarget:()=>handle++,
    readTexturePixels:()=>({width:1024,height:1024,pixels:new Uint8Array(1024*1024*4)}),updateTexture:noop,
    loadSound:()=>handle++,playSound:noop,stopSound:noop,pauseSound:noop,resumeSound:noop,unloadSound:noop,isSoundPlaying:()=>false,
    loadMusic:()=>handle++,setMusicLoop:noop,seekMusic:noop,playMusic:noop,stopMusic:noop,pauseMusic:noop,resumeMusic:noop,setMusicVolume:noop,unloadMusic:noop,quit:noop};
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,autostart:!replay,invincible:true,
    seed:73,mode:'normal',stageId:1,difficulty:1});
  if(replay){app.playbackSource=replay;app.core.start(replay.config);}
  return{app,game:app.core.game,writes,dispose:()=>app.destroy()};
}
const tick=(app,frames,mask=0)=>{for(let i=0;i<frames;i++)app.update(mask);};
function resume(f,mask=Keys.PAUSE){
  f.app.update(mask);
  for(let i=0;i<40&&f.game.paused;i++)f.app.update(Keys.LEFT|Keys.BOMB|Keys.SHOOT);
  assert.equal(f.game.paused,false,'the real pause menu completes its resume transition');
}
function playToEnd(f,replay){
  for(let i=0;i<=replay.frames;i++){
    f.app.update(0);
    assert.equal(f.game.paused,false,'recorded gameplay must never open the pause menu');
    assert.equal(f.app.page,null,'playback must not show a desync or pause page');
  }
  assert.equal(f.game.playback.frame,replay.frames);
  assert.equal(f.game.playback.desync,null);
  assert.equal(f.app.replayFinished,true);
}

test('manual pause, menu navigation and resume transitions consume no replay frames or checkpoints',needsAssets,()=>{
  const f=fixture();try{
    tick(f.app,600);const frame=f.game.frame,recording=JSON.stringify(f.game.recorder.toJSON()),player=f.game.player.snapshot();
    f.app.update(Keys.PAUSE|Keys.RIGHT|Keys.BOMB);assert.equal(f.game.paused,true);
    assert.equal(JSON.stringify(f.game.recorder.toJSON()),recording,'opening pause is not a recorded frame');
    tick(f.app,12,Keys.LEFT|Keys.BOMB);f.app.update(Keys.DOWN);f.app.update(0);f.app.update(Keys.UP);f.app.update(0);
    assert.equal(f.game.pauseVisual.selection,0);
    assert.equal(JSON.stringify(f.game.recorder.toJSON()),recording,'paused updates do not duplicate the checkpoint at frame 600');
    resume(f,Keys.PAUSE|Keys.RIGHT|Keys.BOMB);
    assert.equal(f.game.frame,frame);assert.deepEqual(f.game.player.snapshot(),player);
    assert.equal(JSON.stringify(f.game.recorder.toJSON()),recording,'the final resume frame still belongs to the menu');
    f.app.update(Keys.RIGHT|Keys.SHOOT);
    assert.equal(f.game.recorder.frames,frame+1);assert.deepEqual(f.game.recorder.runs.at(-1),[Keys.RIGHT|Keys.SHOOT,1]);
    assert.equal(f.writes.size,0);
  }finally{f.dispose();}
});

test('an ignored pause key during the opening 30 frames is stripped from recorded gameplay input',needsAssets,()=>{
  const f=fixture();try{
    f.app.update(Keys.PAUSE|Keys.RIGHT|Keys.SHOOT);
    assert.equal(f.game.paused,false);assert.equal(f.game.frame,1);
    assert.deepEqual(f.game.recorder.runs,[[Keys.RIGHT|Keys.SHOOT,1]]);
  }finally{f.dispose();}
});

test('gameplay after repeated pauses replays movement, bomb edges and state checkpoints without automatic pauses',needsAssets,()=>{
  const recording=fixture();let replay,expected;
  try{
    const {app,game}=recording;tick(app,40,Keys.RIGHT|Keys.SHOOT);
    for(const wait of [15,75]){
      app.update(Keys.PAUSE|Keys.BOMB);assert.equal(game.paused,true);
      tick(app,wait,Keys.DOWN|Keys.LEFT|Keys.BOMB);resume(recording);
      app.update(Keys.BOMB|Keys.RIGHT|Keys.SHOOT);tick(app,25,Keys.FOCUS|Keys.LEFT|Keys.SHOOT);app.update(0);
      game.recorder.checkpoint(game.snapshot());
    }
    while(game.recorder.frames<1205)app.update(Keys.SHOOT);
    game.recorder.checkpoint(game.snapshot());replay=game.recorder.toJSON();expected=stateHash(game.snapshot());
    assert.ok(replay.runs.every(([mask])=>!(mask&Keys.PAUSE)));
    assert.ok(replay.checkpoints.some(point=>point.frame===600));assert.ok(replay.checkpoints.some(point=>point.frame===1200));
    assert.equal(recording.writes.size,0);
  }finally{recording.dispose();}
  const playback=fixture(replay);try{
    playToEnd(playback,replay);assert.equal(stateHash(playback.game.snapshot()),expected);assert.equal(playback.writes.size,0);
  }finally{playback.dispose();}
});

test('saving from a pause menu ends the replay at the last gameplay frame',needsAssets,()=>{
  const recording=fixture();let replay,expected;
  try{
    const {app,game}=recording;tick(app,75,Keys.SHOOT);expected=stateHash(game.snapshot());
    app.update(Keys.PAUSE);tick(app,15);assert.equal(game.paused,true);
    // Exercise the actual save action with all persistence captured in memory.
    app.options.testing=false;
    game.pauseVisual.openExternal('replay');assert.equal(app.page.title,'保存回放');tick(app,8);
    app.update(Keys.SHOOT);app.options.testing=true;
    assert.equal(app.storage.replays.length,20);assert.equal(app.storage.replayCount,1);replay=app.storage.replays[0].replay;
    assert.equal(replay.frames,75);assert.ok(replay.runs.every(([mask])=>!(mask&Keys.PAUSE)));
    assert.ok(recording.writes.has('guiming-replays.json'));assert.equal(app.core.mode,'title');
  }finally{recording.app.options.testing=true;recording.dispose();}
  const playback=fixture(replay);try{
    playToEnd(playback,replay);assert.equal(stateHash(playback.game.snapshot()),expected);
  }finally{playback.dispose();}
});

test('live Escape still pauses the replay viewer without advancing the recorded cursor',needsAssets,()=>{
  const recording=fixture();let replay;
  try{tick(recording.app,90,Keys.SHOOT);replay=recording.game.recorder.toJSON();}finally{recording.dispose();}
  const playback=fixture(replay);try{
    tick(playback.app,35);const frame=playback.game.playback.frame,expected=stateHash(playback.game.snapshot());
    playback.app.update(Keys.PAUSE);assert.equal(playback.app.page.title,'回放暂停');tick(playback.app,15);
    assert.equal(playback.game.playback.frame,frame);assert.equal(stateHash(playback.game.snapshot()),expected);
    playback.app.update(Keys.PAUSE);assert.equal(playback.app.page,null);assert.equal(playback.game.playback.frame,frame);
    playback.app.update(0);assert.equal(playback.game.playback.frame,frame+1);assert.equal(playback.game.playback.desync,null);
  }finally{playback.dispose();}
});

test('Game Over Continue remains a recorded gameplay decision',needsAssets,()=>{
  const recording=fixture();let replay,expected;
  try{
    const {app,game}=recording;tick(app,40);game.openGameOver();tick(app,15);
    assert.equal(game.pauseVisual.selection,0);app.update(Keys.SHOOT);
    for(let i=0;i<40&&game.paused;i++)app.update(0);
    assert.equal(game.paused,false);assert.equal(game.session.continues,1);
    tick(app,30,Keys.RIGHT|Keys.SHOOT);game.recorder.checkpoint(game.snapshot());
    replay=game.recorder.toJSON();expected=stateHash(game.snapshot());assert.ok(replay.frames>game.frame);
  }finally{recording.dispose();}
  const playback=fixture(replay);try{
    tick(playback.app,40);playback.game.openGameOver();
    for(let i=40;i<=replay.frames;i++)playback.app.update(0);
    assert.equal(playback.game.session.continues,1);assert.equal(playback.game.playback.desync,null);
    assert.equal(playback.app.replayFinished,true);assert.equal(stateHash(playback.game.snapshot()),expected);
  }finally{playback.dispose();}
});

test('legacy recordings fast-forward manual pauses while still verifying their recorded checkpoints',needsAssets,()=>{
  const recording=fixture();let replay;
  try{
    tick(recording.app,40);recording.game.recorder.checkpoint(recording.game.snapshot());
    replay={...recording.game.recorder.toJSON(),frames:79,
      runs:[[0,40],[Keys.PAUSE,1],[0,15],[Keys.PAUSE,1],[0,22]]};
  }finally{recording.dispose();}
  // Direct scene playback provides the original frame-by-frame legacy state,
  // including its paused checkpoints and visual RNG consumption.
  const reference=fixture(replay);let expected;
  try{
    for(let frame=1;frame<=replay.frames;frame++){
      reference.game.update(0);
      if([41,50,69,79].includes(frame))replay.checkpoints.push({frame,hash:stateHash(reference.game.snapshot())});
    }
    assert.equal(reference.game.frame,50);assert.equal(reference.game.paused,false);expected=stateHash(reference.game.snapshot());
  }finally{reference.dispose();}
  const playback=fixture(replay);try{
    const checked=[],verify=playback.game.playback.verify.bind(playback.game.playback);
    playback.game.playback.verify=snapshot=>{checked.push(playback.game.playback.frame);return verify(snapshot);};
    tick(playback.app,40);assert.equal(playback.game.playback.frame,40);
    playback.app.update(0);
    assert.equal(playback.game.playback.frame,69,'all recorded pause and resume frames are consumed within one viewer update');
    assert.equal(playback.game.frame,40);assert.equal(playback.game.paused,false);assert.equal(playback.app.page,null);
    tick(playback.app,11);assert.equal(playback.game.frame,50);assert.equal(playback.app.replayFinished,true);
    assert.equal(playback.game.playback.desync,null);assert.equal(stateHash(playback.game.snapshot()),expected);
    assert.ok(replay.checkpoints.every(point=>checked.includes(point.frame)),'paused checkpoints retain their original verification');
  }finally{playback.dispose();}
});

test('Game Over Escape preserves Continue and holding it through resume does not open a manual pause',needsAssets,()=>{
  const recording=fixture();let replay,expected;
  try{
    const {app,game}=recording;tick(app,40);game.openGameOver();tick(app,15);
    app.update(Keys.PAUSE);assert.equal(game.pauseVisual.phase,18,'Escape keeps the original Continue action');
    assert.deepEqual(game.recorder.runs.at(-1),[Keys.PAUSE,1]);
    for(let i=0;i<40&&game.paused;i++)app.update(Keys.PAUSE);
    assert.equal(game.paused,false);assert.equal(game.session.continues,1);
    const frame=game.frame;app.update(Keys.PAUSE);
    assert.equal(game.paused,false,'holding the same Escape press cannot open a second menu');assert.equal(game.frame,frame+1);
    tick(app,15,Keys.RIGHT);game.recorder.checkpoint(game.snapshot());replay=game.recorder.toJSON();expected=stateHash(game.snapshot());
  }finally{recording.dispose();}
  const playback=fixture(replay);try{
    tick(playback.app,40);playback.game.openGameOver();
    for(let i=40;i<=replay.frames;i++)playback.app.update(0);
    assert.equal(playback.game.session.continues,1);assert.equal(playback.game.playback.desync,null);
    assert.equal(playback.app.replayFinished,true);assert.equal(stateHash(playback.game.snapshot()),expected);
  }finally{playback.dispose();}
});
