import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ProjectApplication} from '../dist/src/application.js';
import {AttackKit} from '../dist/src/danmaku.js';
import {SHINO} from '../dist/src/attacks/shino.js';
import {KOTONE} from '../dist/src/attacks/kotone.js';
import {updateRoadEnemy} from '../dist/src/roads.js';

// Real public resources, laser owner and audio queue; only platform handles
// and playback are observed, with no disk saves or audible output.
function fixture(){
  let handle=1;const files=new Map(),played=[],requested=[],noop=()=>{};
  const host={backend:'node-laser-audio',readText:file=>file.startsWith('userdata/')?'':fs.readFileSync(file,'utf8'),
    writeText:()=>assert.fail('Audio tests must not write saves'),hasSystemFont:()=>true,
    loadTexture:()=>handle++,unloadTexture:noop,createTexture:()=>handle++,createRenderTarget:()=>handle++,
    loadSound:file=>{assert.ok(fs.existsSync(file));const id=handle++;files.set(id,file);return id;},
    playSound:(id,gain,pan,loop)=>played.push({file:files.get(id),gain,pan,loop}),
    stopSound:noop,pauseSound:noop,resumeSound:noop,unloadSound:noop,isSoundPlaying:()=>false,
    loadMusic:()=>handle++,setMusicLoop:noop,seekMusic:noop,playMusic:noop,stopMusic:noop,pauseMusic:noop,resumeMusic:noop,setMusicVolume:noop,unloadMusic:noop,quit:noop};
  const app=new ProjectApplication(host,{testing:true,autostart:true,seed:73,mode:'stage-practice',stageId:4,difficulty:1});
  const game=app.core.game,audio=app.resources.audio,request=audio.request.bind(audio);
  audio.request=(id,x)=>{requested.push(id);request(id,x);};
  audio.flush();requested.length=0;played.length=0;
  const bind=(frame=0,state={},difficulty=1)=>new AttackKit().bind({game,boss:{x:0,y:112},frame,state,difficulty});
  return{app,game,audio,played,requested,bind};
}
const laserPlays=f=>f.played.filter(p=>p.file.endsWith('/audio/se_lazer00.wav'));

const authored=[
  {name:'Shino second nonspell',attack:SHINO.nonspells[1],frames:[0,150],beams:2,requests:2},
  {name:'Shino first spell',attack:SHINO.spells[0],frames:[0,200],beams:4,requests:1},
  {name:'Shino third spell',attack:SHINO.spells[2],frames:[0,300],beams:8,requests:1},
  {name:'Kotone fourth spell',attack:KOTONE.spells[3],frames:[0,220],beams:2,requests:1,laserState:2},
  {name:'stage-four road guard',frames:[56,236],beams:4,requests:1,
    attack:k=>updateRoadEnemy({game:k.game,enemy:{id:1,x:0,y:112},frame:k.frame,state:k.state,difficulty:1,stageId:4,attack:'motif'})},
];
for(const scenario of authored)test(`${scenario.name} uses one common laser sound per volley, including later volleys`,()=>{
  const f=fixture();try{
    const state={};
    for(const frame of scenario.frames){
      const first=f.game.lasers.nextId;f.requested.length=0;f.played.length=0;
      scenario.attack(f.bind(frame,state));
      const beams=f.game.lasers.lasers.filter(l=>l.id>first);
      assert.equal(beams.length,scenario.beams);assert.ok(beams.every(l=>l.state===(scenario.laserState??3)&&l.age.current===0));
      assert.ok(beams.every(l=>l.p.sound===18||l.p.sound===-1));
      assert.equal(f.requested.filter(id=>id===18).length,scenario.requests);assert.ok(!f.requested.includes(26));
      f.audio.flush();assert.equal(laserPlays(f).length,1,'thlib coalesces all same-frame requests for ID18');
      assert.ok(laserPlays(f).every(p=>p.gain>0&&p.loop===false));
    }
  }finally{f.app.destroy();}
});

test('laser authoring defaults, explicit silence/override and exhausted capacity use the public sound contract',()=>{
  const f=fixture();try{
    const k=f.bind();k.beam(0,112,1);k.laser(0,112,1,2,160);f.audio.flush();
    assert.deepEqual(f.requested,[18,18]);assert.equal(laserPlays(f).length,1);
    f.requested.length=0;f.played.length=0;
    k.beam(0,112,1,{sound:-1});k.laser(0,112,1,2,160,{sound:-1});f.audio.flush();
    assert.equal(f.played.length,0);assert.equal(f.requested.length,0);
    k.beam(0,112,1,{sound:19});f.audio.flush();
    assert.deepEqual(f.requested,[19]);assert.ok(f.played[0].file.endsWith('/audio/se_lazer01.wav'));assert.equal(f.played[0].loop,false);
    f.game.lasers.capacity=f.game.lasers.count;f.requested.length=0;f.played.length=0;
    assert.equal(k.beam(0,112,1),null);f.audio.flush();assert.equal(f.requested.length,0);assert.equal(f.played.length,0);
  }finally{f.app.destroy();}
});

test('warning creation sounds once, growth/sustain do not repeat it, and ordinary shots retain their own sound',()=>{
  const f=fixture();try{
    const k=f.bind(),laser=k.beam(0,112,1,{delay:3,grow:3,sustain:30});
    k.shot(0,112,1,2,4,1);f.audio.flush();
    assert.equal(laser.state,3);assert.deepEqual(f.requested,[18,21]);
    assert.equal(laserPlays(f).length,1);assert.ok(f.played.some(p=>p.file.endsWith('/audio/se_tan00.wav')));
    const states=new Set();f.requested.length=0;f.played.length=0;
    for(let i=0;i<20;i++){f.game.lasers.update(null,f.game.context);states.add(laser.state);f.audio.flush();}
    assert.ok(states.has(4)&&states.has(2));assert.equal(f.requested.length,0);assert.equal(f.played.length,0);
  }finally{f.app.destroy();}
});
