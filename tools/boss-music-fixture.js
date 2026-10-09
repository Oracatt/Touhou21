import {Keys} from '@ts-stg/thlib';
import {ProjectApplication} from '../src/application.js';
import {CampaignScene} from '../src/scene.js';
import {STAGES} from '../src/content.js';
import {musicTrack} from '../src/music-data.js';

/** Real App/dialogue/Pause inputs with only the final speaker boundary muted.
 * Native music handles, seek/stop commands and the production music clock are
 * retained. Userdata is private to this short verification run. */
export function createBossMusicFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath));
  const assert=(value,message)=>{if(!value)throw new Error(`${scenario.id}: ${message}`);};
  const normalize=value=>String(value).replaceAll('\\','/'),memory=new Map(),files=new Map(),host=Object.create(native);
  const stage=STAGES.find(value=>value.id===scenario.stageId),bossFile=musicTrack(stage.bgmBoss).file,stageFile=musicTrack(stage.bgmStage).file;
  const transports=[],pendingTicks=[],steps=[];let app=null,game=null,tick=0,memoryWrites=0,musicUpdates=0,ready=false,result=null;
  const stamp=()=>({tick,musicUpdates,gameFrame:app?.core.game?.frame??0});
  Object.defineProperties(host,{
    readText:{value:file=>normalize(file).startsWith('userdata/')?memory.get(normalize(file))??'':native.readText(file)},
    writeText:{value:(file,text)=>{const name=normalize(file);assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA userdata stays in memory');memory.set(`userdata/${name}`,text);memoryWrites++;}},
    loadMusic:{value:file=>{const handle=native.loadMusic(file);files.set(handle,normalize(file));return handle;}},
    seekMusic:{value:(handle,time)=>{transports.push({...stamp(),kind:'seek',file:files.get(handle),time});native.seekMusic(handle,time);}},
    stopMusic:{value:handle=>{transports.push({...stamp(),kind:'stop',file:files.get(handle)});native.stopMusic(handle);}},
    playMusic:{value:(handle,volume)=>{transports.push({...stamp(),kind:'play',file:files.get(handle),volume});}},
    pauseMusic:{value:handle=>{transports.push({...stamp(),kind:'pause',file:files.get(handle)});native.pauseMusic(handle);}},
    resumeMusic:{value:handle=>{transports.push({...stamp(),kind:'resume',file:files.get(handle)});}},
    playSound:{value:()=>{}},resumeSound:{value:()=>{}},
  });
  app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210911,autostart:true,skipRoad:true,invincible:true,
    mode:'stage-practice',character:0,stageId:stage.id,difficulty:1});
  game=app.core.game;assert(game instanceof CampaignScene,'Production App owns the actual CampaignScene');
  const musicUpdate=app.music.update.bind(app.music);
  app.music.update=()=>{
    musicUpdates++;
    if(app.music.pending?.id===stage.bgmBoss)pendingTicks.push({...stamp(),remaining:app.music.pending.remainingFrames,paused:app.music.paused});
    return musicUpdate();
  };
  let previousStep=-1;
  const plays=()=>transports.filter(value=>value.kind==='play'&&value.file===bossFile);
  function advance(mask=0){
    tick++;assert(tick<3600,'Dialogue/transport verification stays within its fixed-frame budget');app.update(mask);
    if(game.dialogue?.index!==undefined&&game.dialogue.index!==previousStep){previousStep=game.dialogue.index;steps.push({tick,index:previousStep,track:app.music.current?.id??null});}
    if(app.core.game===game&&app.music.pending?.id===stage.bgmBoss){
      assert(app.music.current===null,'The old stage track has stopped during the lead-in silence');
      assert(game.bgmCaption===null,'Boss caption is absent until actual playback starts');
    }
    const justPlayed=plays().find(value=>value.tick===tick);
    if(justPlayed){assert(game.bgmCaption?.title===musicTrack(stage.bgmBoss).title,'Real start callback publishes the Boss music caption');assert(game.bgmCaption.age===0,'The caption begins on the exact playback frame');}
  }
  function* ticks(count,mask=0){for(let i=0;i<count;i++){advance(mask);yield;}}
  function* tap(mask){yield* ticks(1,mask);yield* ticks(1);}
  function* openPause(){yield* tap(Keys.PAUSE);yield* ticks(12);assert(game.paused&&game.pauseVisual.phase===6&&app.music.paused,'Actual Pause owner freezes the shared music clock');}
  function* prepare(){
    assert(app.music.current?.id===stage.bgmStage,'A regular stage starts its authored road track');
    let stepEntered=0,seen=-1;
    while(!app.music.pending){
      const index=game.dialogue?.index??-1;
      if(index!==seen){seen=index;stepEntered=tick;}
      const fast=scenario.kind!=='normal',mask=fast?Keys.FOCUS:tick-stepEntered>=90&&tick%2===0?Keys.SHOOT:0;
      yield* ticks(1,mask);
      assert(plays().length===0,'Boss theme cannot play on the cue frame');
    }
    assert(game.director.bossMusicStarted&&game.director.state==='dialogue','The authored independent music cue queued the switch during real dialogue');
    const cueTick=tick,stop=transports.filter(value=>value.kind==='stop'&&value.file===stageFile).at(-1);
    assert(stop?.tick===cueTick,'The music cue stops the prior stage track immediately');
    assert(app.music.pending.remainingFrames===41,'The same App frame performs the first of 42 music updates');
    let pauseRemaining=null,pauseStart=null,pauseEnd=null;
    if(['pause','exit','restart'].includes(scenario.kind)){
      yield* ticks(5);pauseRemaining=app.music.pending.remainingFrames;pauseStart=tick;
      yield* openPause();yield* ticks(50);
      assert(app.music.pending.remainingFrames===pauseRemaining&&plays().length===0,'Ordinary Pause preserves the complete remaining silent interval');
      if(scenario.kind==='pause'){
        yield* tap(Keys.PAUSE);while(game.paused)yield* ticks(1);pauseEnd=tick;
      }else{
        const choice=scenario.kind==='exit'?1:5;
        for(let i=0;game.pauseVisual.selection!==choice&&i<6;i++)yield* tap(Keys.DOWN);
        assert(game.pauseVisual.selection===choice,'Real menu navigation selects the requested abandonment route');
        yield* tap(Keys.SHOOT);yield* ticks(34);
        assert(game.pauseVisual.phase===7&&game.pauseVisual.count===2,'Actual exit/retry opens its normal confirmation');
        yield* tap(Keys.UP);yield* tap(Keys.SHOOT);
        while(app.core.game===game)yield* ticks(1);
        assert(game.destroyed,'Real application scene replacement destroys the previous scene');
        assert(scenario.kind==='exit'?app.core.mode==='title':app.core.mode==='game','Confirmed menu action reaches its expected scene');
        yield* ticks(120);
        assert(plays().length===0&&app.music.pending===null,'An abandoned scene never starts its queued Boss music later');
        assert(app.music.current?.id===(scenario.kind==='exit'?'title':stage.bgmStage),'Title/retry owns its fresh explicit track');
      }
    }
    if(!['exit','restart'].includes(scenario.kind)){
      while(!plays().length)yield* ticks(1,scenario.kind==='normal'?0:Keys.FOCUS);
      const played=plays()[0],active=pendingTicks.filter(value=>!value.paused);
      assert(active.length===42&&active[0].remaining===42&&active.at(-1).remaining===1,'Exactly 42 unpaused production music ticks precede Boss playback');
      assert(scenario.kind==='pause'?played.tick-cueTick>41:played.tick-cueTick===41,'App ordering counts the cue frame itself as the first silent tick');
      assert(transports.filter(value=>value.kind==='seek'&&value.file===bossFile).length===1&&transports.find(value=>value.kind==='seek'&&value.file===bossFile).time===0,'Boss playback seeks its intro from zero exactly once');
      for(let i=0;game.director.state!=='combat'&&i<900;i++)yield* ticks(1,Keys.FOCUS);
      assert(game.director.state==='combat','Fast forward reaches normal combat through real dialogue completion');
      yield* ticks(90);
      assert(plays().length===1,'Dialogue completion fallback never restarts or requeues the Boss theme');
    }
    assert(memoryWrites===0,'Verification never persists userdata');
    result={passed:true,id:scenario.id,backend:native.backend,kind:scenario.kind,tick,musicUpdates,stageId:stage.id,
      cueTick,pauseStart,pauseEnd,pauseRemaining,transports,pendingTicks,steps,memoryWrites,
      currentTrack:app.music.current?.id??null,sceneMode:app.core.mode,director:app.core.game?.director.snapshot()??null,
      scope:'Actual ProjectApplication/dialogue/Pause input and native music load/seek/stop; final play/resume speaker calls suppressed. Verifies event timing, cancellation and caption ownership, not audible waveform quality or GPU pixels.'};
    ready=true;
  }
  const runner=prepare();
  return{update(){for(let i=0;i<48&&!ready;i++)runner.next();},render(){return[];},snapshot(){assert(ready,'Native budget completes actual application verification');return result;},destroy(){app.destroy();}};
}
