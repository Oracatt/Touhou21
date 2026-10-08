import {Keys} from '@ts-stg/thlib';
import {ProjectApplication} from '../src/application.js';
import {STAGES} from '../src/content.js';

export function createBossHudFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath)),memory=new Map();
  const host=Object.create(native);
  Object.defineProperties(host,{readText:{value:path=>String(path).startsWith('userdata/')?memory.get(path)??'':native.readText(path)},
    writeText:{value:(path,value)=>memory.set(`userdata/${path}`,value)}});
  const midboss=scenario.id.startsWith('midboss-'),spell=scenario.id==='spell-clock',dialogue=scenario.id==='dialogue-hidden';
  const retreatSamples={'midboss-hold':37,'midboss-hold-edge':75,'midboss-escape-start':76,'midboss-escape':null};
  const retreat=Object.hasOwn(retreatSamples,scenario.id);let retreatState=null;
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210721,autostart:true,invincible:true,
    mode:spell?'spell-practice':'stage-practice',stageId:1,difficulty:1,character:0,spellId:spell?STAGES[0].spells[0].id:null,
    skipRoad:!midboss,autoDialogue:!dialogue});
  const game=app.core.game;let calls=0,nativeFrames=0,ready=false,result=null,bodyDraws=0;
  const audioRequests=[],request=app.resources.audio.request.bind(app.resources.audio);
  app.resources.audio.request=(id,x)=>{if([54,6,27,46].includes(id))audioRequests.push({id,applicationFrame:app.frame,gameFrame:game.frame});return request(id,x);};
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const advance=(mask=0)=>{app.update(mask);calls++;};
  const clock=()=>({phaseFrame:game.director.phaseFrame,remainingFrames:game.bossHud.state.remainingFrames,
    visible:game.bossHud.timerVisible,seconds:game.bossHud.seconds,hundredths:game.bossHud.hundredths});
  const checkClock=()=>{const duration=midboss?game.director.midbossDuration:game.director.phase.duration;
    const remaining=spell?game.spell.remaining:duration-game.director.phaseFrame;
    assert(game.bossHud.timerVisible,'Active public HUD timer is visible');
    assert(game.bossHud.state.remainingFrames===remaining,'HUD uses the post-update actual phase clock');
    assert(game.bossHud.seconds===Math.trunc(remaining/60),'Actual public timer digit value matches the clock');};
  function* prepare(){
    const state=dialogue?'dialogue':midboss?'midboss-combat':'combat';
    for(let i=0;game.director.state!==state;i++){
      assert(i<12000,'Native Boss HUD setup reaches the real requested phase');advance();if(calls%64===0)yield;
    }
    if(dialogue){
      for(let i=0;i<24;i++){advance();if(calls%64===0)yield;}
      assert(!game.bossHud.timerVisible&&game.bossHud.state.timerHidden,'Dialogue hides the timer explicitly');
      assert(game.bossHud.numbers.every(vm=>!vm.visible),'Dialogue hides both actual timer digit animations');
    }else{
      for(let i=0;i<180;i++){advance();if(calls%64===0)yield;}checkClock();
      const before=clock();advance(Keys.PAUSE);
      for(let i=0;i<24;i++){advance();if(calls%64===0)yield;}
      assert(game.paused,'Real Esc enters public pause');assert(JSON.stringify(clock())===JSON.stringify(before),'Pause freezes the phase and HUD clock');
      advance(Keys.PAUSE);for(let i=0;game.paused;i++){assert(i<40,'Real Esc resumes');advance();if(calls%64===0)yield;}
      assert(JSON.stringify(clock())===JSON.stringify(before),'Resuming does not consume an extra phase tick');advance();checkClock();
      if(retreat){
        const boss=game.director.boss;
        // The public accumulator caps each frame using the original SHT.
        // Sustain real damage across frames instead of bypassing that owner.
        for(let i=0;game.director.state==='midboss-combat';i++){
          assert(i<1000,'Capped public damage reaches registered midboss defeat before timeout');
          game.context.damageEnemy(boss,1000000,{kind:'qa-public-damage',x:game.player.x,y:game.player.y});advance();if(calls%64===0)yield;
        }
        assert(game.director.state==='midboss-exit'&&game.context.boss===null,'Registered defeat ends combat ownership');
        assert(game.director.pendingEscape?.boss===boss,'Actual damage creates this midboss delayed retreat owner');
        const origin={x:boss.x,y:boss.y},delay=game.director.pendingEscape.delay,sample=retreatSamples[scenario.id];
        assert(delay===75,'The current authored defeat pause is 75 frames');
        if(sample!==null){
          while(game.director.phaseFrame<sample){advance();if(calls%64===0)yield;}
          assert(game.director.phaseFrame===sample,'Sample the exact requested exit frame');
        }else{
          for(let i=0;game.director.pendingEscape;i++){
            assert(i<=delay+1,'Pending retreat starts its public escape within the authored delay');advance();if(calls%64===0)yield;
          }
          for(let i=0;i<20;i++){advance();if(calls%64===0)yield;}
        }
        const held=sample!==null&&sample<=delay,escape=game.bossEscapes.find(entry=>entry.enemy===boss&&entry.sequence.alive);
        assert(boss.alive,'The actual midboss body remains alive');
        assert(game.context.boss===null&&game.bossPresentation.boss===null,'Drawing the body does not reacquire combat/presentation ownership');
        if(held){
          assert(game.director.pendingEscape?.boss===boss&&!escape,'Held body precedes the public escape sequence');
          assert(boss.x===origin.x&&boss.y===origin.y,'The defeated midboss stays at its real defeat position throughout the pause');
        }else{
          assert(!game.director.pendingEscape&&escape,'Public escape owns the body after the pause');
          if(sample===null)assert(boss.x!==origin.x||boss.y!==origin.y,'The public escape actually moves the rendered body');
        }
        assert(!game.bossHud.timerVisible&&game.bossHud.state.timerHidden,'Delayed retreat and flight have no stale countdown');
        retreatState={exitFrame:game.director.phaseFrame,delay,phase:held?'hold':'escape',pendingOwner:game.director.pendingEscape?.boss===boss,
          publicEscapeOwner:!!escape,bodyAlive:boss.alive,origin,position:{x:boss.x,y:boss.y},contextBossDetached:true,presentationBossDetached:true};
        const draw=game.bossSprites.draw.bind(game.bossSprites);
        game.bossSprites.draw=(...args)=>{if(args[1]===boss)bodyDraws++;return draw(...args);};
      }
    }
    result={passed:true,id:scenario.id,backend:native.backend,clock:clock(),hud:game.bossHud.snapshot(),application:app.snapshot(),
      applicationUpdates:calls,phaseHp:game.director.phase?.hp??game.director.boss?.maximumHp??null,
      bossHp:game.director.boss?.hp??null,audioRequests,retreat:retreatState,
      charges:game.bossPresentation.charges.map(charge=>({alive:charge.alive,repeatCount:charge.repeatCount,releaseFrame:charge.releaseFrame})),
      pickups:game.items.items.map(item=>({type:item.type,x:item.x,y:item.y,state:item.state})),
      scope:'Actual native App/public HUD and real Pause/Resume. Fixture-only invincibility isolates HUD/body rendering; this does not validate player collision or difficulty.'};ready=true;
  }
  const runner=prepare();
  return{update(){nativeFrames++;if(!ready)runner.next();},
    render(){if(!ready||nativeFrames!==scenario.captureFrame)return[];const commands=app.render();result.commands=commands.length;result.bodyDraws=bodyDraws;
      if(retreat)assert(bodyDraws>0,'The held/escaping body is actually submitted by the production renderer');return commands;},
    snapshot(){assert(ready,'Native frame budget reaches the targeted HUD sample');assert(result.commands>0,'Actual production scene renders');return result;}};
}
