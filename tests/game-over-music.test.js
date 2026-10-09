import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MusicController} from '../dist/src/music.js';
import {ProjectApplication} from '../dist/src/application.js';
import {STAGES} from '../dist/src/content.js';

const assets=fs.existsSync('packages/thlib/assets/touhou-common/manifest.json');
const needsAssets=assets?{}:{skip:'requires the private touhou-common resource pack (tools/setup-local.ps1)'};

/** Platform music stand-in: records transport calls and reports a play clock. */
function musicHost(){
  let next=1;const files=new Map(),log=[];const host={log,time:0,
    loadMusic:file=>{const id=next++;files.set(id,file);return id;},setMusicLoop(){},unloadMusic(){},setMusicVolume(){},
    seekMusic:(id,time)=>log.push(['seek',files.get(id),time]),playMusic:id=>log.push(['play',files.get(id)]),
    stopMusic:id=>log.push(['stop',files.get(id)]),pauseMusic:id=>log.push(['pause',files.get(id)]),resumeMusic:id=>log.push(['resume',files.get(id)]),
    getMusicTime:()=>host.time};
  return host;
}

test('the game-over interruption plays Player\'s Score, then restores the stage track where it stopped',()=>{
  const host=musicHost(),music=new MusicController(host,{musicVolume:72});
  music.play('stage03');host.time=41.25;
  const interruption=music.interrupt('playersScore');
  assert.equal(music.current.id,'playersScore');assert.deepEqual(host.log.at(-2),['seek','assets/music/playersScore.wav',0]);
  interruption.restore();
  assert.equal(music.current.id,'stage03');assert.deepEqual(host.log.at(-2),['seek','assets/music/stage03.wav',41.25]);
  interruption.restore();assert.equal(music.current.id,'stage03','a restore is used once');
});

test('discarding stops the temporary track, and a newer explicit track voids an old interruption',()=>{
  const host=musicHost(),music=new MusicController(host,{musicVolume:72});
  music.play('boss02');const first=music.interrupt('playersScore');first.discard();
  assert.equal(music.current,null);assert.deepEqual(host.log.at(-1),['stop','assets/music/playersScore.wav']);
  music.play('stage01');const stale=music.interrupt('playersScore');music.play('title');
  stale.restore();assert.equal(music.current.id,'title','returning to the title abandons the stage restore');
  music.play('stage05');host.time=9;const outer=music.interrupt('playersScore');host.time=3;const inner=music.interrupt('playersScore');
  outer.restore();assert.equal(music.current.id,'playersScore','only the newest interruption owns the restore');
  inner.restore();assert.equal(music.current.id,'stage05');assert.deepEqual(host.log.at(-2),['seek','assets/music/stage05.wav',9],'re-entering keeps the first recovery point');
});

function appFixture(mode){
  let handle=1;const noop=()=>{},music=musicHost();
  const host={backend:'node-music-observer',readText:file=>String(file).startsWith('userdata/')?'':fs.readFileSync(file,'utf8'),writeText:noop,
    hasSystemFont:()=>true,loadTexture:()=>handle++,unloadTexture:noop,createTexture:()=>handle++,createRenderTarget:()=>handle++,
    readTexturePixels:()=>({width:1024,height:1024,pixels:new Uint8Array(1024*1024*4)}),updateTexture:noop,
    loadSound:()=>handle++,playSound:noop,stopSound:noop,pauseSound:noop,resumeSound:noop,unloadSound:noop,isSoundPlaying:()=>false,
    ...music,quit:noop};
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,autostart:true,seed:73,mode,stageId:1,difficulty:1,
    spellId:mode==='spell-practice'?STAGES[0].spells[0].id:null});
  for(let i=0;i<30;i++)app.update(0);
  return{app,game:app.core.game,music,dispose:()=>app.destroy()};
}

test('Game Over switches to Player\'s Score and Continue resumes the interrupted stage music',needsAssets,()=>{
  const f=appFixture('normal');
  try{
    assert.equal(f.app.music.current.id,'stage01');f.music.time=17.5;
    f.game.openGameOver();
    assert.equal(f.app.music.current.id,'playersScore');assert.equal(f.app.music.paused,false,'the score theme actually plays');
    const menu=f.game.pauseVisual;menu.selection=0;menu.finish();
    assert.equal(f.game.paused,false);assert.equal(f.app.music.current.id,'stage01');
    assert.deepEqual(f.music.log.filter(e=>e[0]==='seek').at(-1),['seek','assets/music/stage01.wav',17.5]);
  }finally{f.dispose();}
});

test('leaving Game Over stops Player\'s Score, and a failed spell practice keeps its Boss track',needsAssets,()=>{
  const normal=appFixture('normal');
  try{
    normal.game.openGameOver();const menu=normal.game.pauseVisual;menu.selection=1;menu.finish();
    assert.notEqual(normal.app.music.current?.id,'playersScore');
  }finally{normal.dispose();}
  const practice=appFixture('spell-practice');
  try{
    const track=practice.app.music.current.id;practice.game.openGameOver();
    assert.equal(practice.app.music.current.id,track,'spell practice failure keeps the ongoing card music');
  }finally{practice.dispose();}
});
