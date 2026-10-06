import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ProjectApplication} from '../src/application.js';
import {STAGES} from '../src/content.js';

/** Observe the actual App -> common audio queue -> platform playback chain.
 * Only platform handles and persistent storage are replaced; resource manifests,
 * sound definitions, common spell settlement and the business director are real.
 */
function fixture({midboss=false,final=false,nonspell=false}={}){
  let handle=1;const soundFiles=new Map(),played=[],requested=[],events=[];
  const noop=()=>{},host={backend:'node-audio-observer',
    readText:file=>String(file).startsWith('userdata/')?'':fs.readFileSync(file,'utf8'),
    writeText:()=>assert.fail('An audio regression must not write player data'),
    hasSystemFont:()=>true,loadTexture:()=>handle++,unloadTexture:noop,createTexture:()=>handle++,createRenderTarget:()=>handle++,
    loadSound:file=>{assert.ok(fs.existsSync(file),`Requested common sound exists: ${file}`);const id=handle++;soundFiles.set(id,file);return id;},
    playSound:(id,gain,pan,loop)=>played.push({frame:app.core.game.frame,file:soundFiles.get(id),gain,pan,loop}),
    stopSound:noop,pauseSound:noop,resumeSound:noop,unloadSound:noop,isSoundPlaying:()=>false,
    loadMusic:()=>handle++,setMusicLoop:noop,seekMusic:noop,playMusic:noop,stopMusic:noop,pauseMusic:noop,resumeMusic:noop,setMusicVolume:noop,unloadMusic:noop,
    quit:noop,
  };
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,autostart:true,seed:73,
    mode:final?'spell-practice':'stage-practice',stageId:midboss?7:1,spellId:final?STAGES[0].spells[0].id:null,difficulty:midboss?4:1});
  const game=app.core.game,director=game.director,audio=app.resources.audio;
  assert.ok(audio,'Real common manifest creates an injected platform audio owner');
  const request=audio.request.bind(audio);audio.request=(id,x)=>{requested.push({frame:game.frame,id,x});request(id,x);};
  const onEvent=game.onEvent;game.onEvent=(name,data)=>{events.push({frame:game.frame,name,data});onEvent?.(name,data);};
  director.callbacks.dialogue=(_lines,{onComplete})=>onComplete();
  director.callbacks.stageClear=(_stage,{onComplete})=>onComplete();
  // Isolate settlement audio from random Miss/Bomb events while waiting for a
  // real timeout. This never changes Boss HP or common capture/failure flags.
  game.player.invulnerability.set(999999);
  if(midboss)director._spawnMidboss(game);else if(!final)director._spawnBoss(game);
  const combat=midboss?'midboss-combat':'combat';
  for(let i=0;i<600&&director.state!==combat;i++)app.update(0);
  assert.equal(director.state,combat);
  if(!midboss&&!final&&!nonspell)director._beginPhase(game,1);
  assert.equal(game.spell.active,!nonspell);
  for(let i=0;i<61;i++)app.update(0);
  audio.flush();requested.length=0;played.length=0;events.length=0;
  return{app,game,director,audio,requested,played,events,
    update:(frames=1)=>{for(let i=0;i<frames;i++)app.update(0);},
    strike:()=>{const boss=director.boss;boss.damage(boss.hp*7+100,{type:'audio-phase-edge'},game.context);},
    dispose:()=>app.destroy()};
}
const count=(f,id)=>f.requested.filter(sound=>sound.id===id).length;
const fileCount=(f,name)=>f.played.filter(sound=>sound.file.endsWith(`/audio/${name}`)).length;

test('a normal attack handoff plays its own original break sound and the distinct public spell-start sound',()=>{
  const f=fixture({nonspell:true});try{
    assert.equal(f.director.phase.spell,false);f.strike();f.update();
    assert.equal(f.director.phase.spell,true);assert.equal(f.game.spell.active,true);
    assert.equal(count(f,27),1);assert.equal(count(f,33),1);assert.equal(count(f,46),0);assert.equal(count(f,5),0);
    assert.equal(fileCount(f,'se_tan00.wav'),1);assert.equal(fileCount(f,'se_cat00.wav'),1);
  }finally{f.dispose();}
});

test('ordinary spell capture and failed defeat retain common result sounds and play one original handoff sound',()=>{
  for(const failed of[false,true]){
    const f=fixture();try{
      if(failed)assert.equal(f.game.spell.notifyPlayerHit(f.game.context),true);
      f.strike();f.update();assert.equal(f.director.state,'phase-wait');
      const results=f.events.filter(event=>event.name==='spellFinish');assert.equal(results.length,1);
      assert.equal(results[0].data.captured,!failed);assert.equal(results[0].data.timeout,false);
      assert.equal(count(f,46),failed?0:1,'CardGet belongs exclusively to actual successful capture');
      assert.equal(count(f,69),0,'A failed capture caused by hit is not a timeout');
      assert.equal(count(f,27),1,'The original next-phase ECL plays its handoff sound even after failure');
      assert.equal(fileCount(f,'se_cardget.wav'),failed?0:1);
      assert.equal(fileCount(f,'se_tan00.wav'),1,'Definition ID27 maps to tan00, not the file-array slot27');
      assert.ok(f.played.every(sound=>sound.gain>0&&Number.isFinite(sound.gain)));
    }finally{f.dispose();}
  }
});

test('natural ordinary timeout plays fault and next-phase handoff, without a false CardGet',()=>{
  const f=fixture();try{
    const remaining=f.game.spell.remaining;
    for(let i=0;i<remaining&&f.game.spell.remaining>1;i++)f.update();
    assert.equal(f.game.spell.active,true);assert.equal(f.game.spell.remaining,1);
    // Pattern command sounds earlier in the card can legitimately use ID27.
    // Observe the natural final clock tick rather than counting the whole fight.
    f.requested.length=0;f.played.length=0;f.events.length=0;f.update();
    assert.equal(f.director.state,'phase-wait');
    const results=f.events.filter(event=>event.name==='spellFinish');assert.equal(results.length,1);
    assert.equal(results[0].data.captured,false);assert.equal(results[0].data.timeout,true);
    assert.equal(count(f,69),1);assert.equal(count(f,27),1);assert.equal(count(f,46),0);
    assert.equal(fileCount(f,'se_fault.wav'),1);assert.equal(fileCount(f,'se_tan00.wav'),1);
  }finally{f.dispose();}
});

test('Extra midboss intermediate cards use a handoff sound while preserving common success and failure rules',()=>{
  for(const failed of[false,true]){
    const f=fixture({midboss:true});try{
      if(failed)f.game.spell.notifyPlayerHit(f.game.context);
      f.strike();f.update();assert.equal(f.director.state,'midboss-phase-wait');
      assert.equal(count(f,27),1);assert.equal(count(f,46),failed?0:1);assert.equal(count(f,5),0);
      assert.equal(fileCount(f,'se_tan00.wav'),1);assert.equal(f.game.bossEscapes.length,0);
    }finally{f.dispose();}
  }
});

test('the last Extra midboss card settles its result without pretending another card is starting',()=>{
  const f=fixture({midboss:true});try{
    while(f.director.midbossPhaseIndex<f.director.midbossPhases.length-1){
      f.strike();
      for(let i=0;i<300&&f.director.state!=='midboss-combat';i++)f.update();
      assert.equal(f.director.state,'midboss-combat');f.update(61);
    }
    f.audio.flush();f.requested.length=0;f.played.length=0;f.events.length=0;
    f.strike();f.update();assert.equal(f.director.state,'midboss-exit');
    assert.equal(count(f,46),1);assert.equal(count(f,27),0);
    assert.equal(f.events.filter(event=>event.name==='spellFinish').length,1);
  }finally{f.dispose();}
});

test('the public final defeat already supplies slow-clear and burst sounds with one delayed capture sound',()=>{
  for(const failed of[false,true]){
    const f=fixture({final:true});try{
      if(failed)f.game.spell.notifyPlayerHit(f.game.context);
      f.strike();f.audio.flush();assert.equal(f.director.state,'boss-defeat');
      assert.equal(count(f,5),1);assert.equal(count(f,46),0);assert.equal(count(f,27),0);
      f.update(59);assert.equal(count(f,46),0,'Common spell settles at the burst, not at the first clear frame');
      f.update();assert.equal(count(f,5),2,'The original clear and burst have separate public sound owners');
      assert.equal(count(f,46),failed?0:1);assert.equal(count(f,27),0,'Never add an intermediate handoff to the final death');
      assert.equal(fileCount(f,'se_cardget.wav'),failed?0:1);
      const results=f.events.filter(event=>event.name==='spellFinish');assert.equal(results.length,1);
      assert.equal(results[0].data.captured,!failed);
    }finally{f.dispose();}
  }
});
