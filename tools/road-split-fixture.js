import {ProjectApplication} from '../dist/src/application.js';
import {CampaignScene} from '../dist/src/scene.js';
import {TouhouEnemy} from '@ts-stg/thlib/touhou';

// Exercise natural road spawning, real Enemy.damage and the public scene task
// clock. Observers record emissions without supplying or advancing any split.
export function createRoadSplitFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath));
  const assert=(value,message)=>{if(!value)throw new Error(`${scenario.id}: ${message}`);};
  const memory=new Map(),host=Object.create(native),normal=file=>String(file).replaceAll('\\','/');let memoryWrites=0;
  Object.defineProperties(host,{
    readText:{value:file=>normal(file).startsWith('userdata/')?memory.get(normal(file))??'':native.readText(file)},
    writeText:{value:(file,value)=>{const name=normal(file);assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA writes remain in memory');memory.set(`userdata/${name}`,value);memoryWrites++;}},
  });
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210910,autostart:true,invincible:true,mode:'stage-practice',stageId:scenario.stageId,difficulty:1});
  const game=app.core.game;
  assert(game instanceof CampaignScene,'Production application owns the real campaign scene');
  const bulletState=b=>({id:b.id,state:b.state,type:b.type,color:b.color,x:b.x,y:b.y,vx:b.vx,vy:b.vy,age:b.age.current,totalAge:b.totalAge.current,commandIndex:b.commandIndex});
  const flying=b=>b.state===1||b.state===2;
  const emissions=[],events=[],timeline=[];let target=null,parents=[],children=[],launch=null,death=null,split=null,ready=false,painted=false,nativeFrames=0;
  const emit=game.bullets.emit.bind(game.bullets);
  game.bullets.emit=(...args)=>{
    const before=parents.map(bulletState),created=emit(...args);
    emissions.push({gameFrame:game.frame,fieldAge:game.bullets.age,parentPositions:before,ids:created.map(b=>b.id),born:created.map(bulletState)});
    return created;
  };
  game.director.callbacks.roadAttack=event=>{
    events.push({...event,gameFrame:game.frame,fieldAge:game.bullets.age});
    if(event.attack!==scenario.attack)return;
    if(!launch&&event.source!=='bullet'){
      target=game.enemies.find(enemy=>enemy.id===event.enemyId);
      assert(target instanceof TouhouEnemy,'Natural road target is the public Enemy');
      const first=game.bullets.nextId-event.count;
      parents=game.bullets.bullets.filter(b=>b.id>=first&&b.type===scenario.parentType).sort((a,b)=>a.id-b.id);
      assert(parents.length===scenario.parentCount,'First real volley contains the expected split parents');
      launch={...event,gameFrame:game.frame,fieldAge:game.bullets.age,due:game.bullets.age+scenario.delay,enemy:{id:target.id,hp:target.hp,x:target.x,y:target.y,wave:target.roadWaveId},parents:parents.map(bulletState)};
    }else if(launch&&event.enemyId===target.id&&event.source==='bullet'){
      assert(!target.alive&&target.hp<=0,'Emitter remains genuinely defeated at derivation');
      assert(!split,'Dead emitter parents derive exactly once');
      assert(game.bullets.age===launch.due,'Derivation occurs exactly at the authored field frame');
      const first=game.bullets.nextId-event.count;
      children=game.bullets.bullets.filter(b=>b.id>=first).sort((a,b)=>a.id-b.id);
      assert(event.count===scenario.childCount&&children.length===scenario.childCount,'All expected children derive from surviving parents');
      const batches=emissions.filter(entry=>entry.fieldAge===launch.due&&entry.ids.some(id=>children.some(b=>b.id===id)));
      assert(batches.length===parents.length,'Each live parent emits one ring');
      split={...event,gameFrame:game.frame,fieldAge:game.bullets.age,parents:parents.map(bulletState),children:children.map(bulletState),batches};
    }
  };
  function sample(label){timeline.push({label,gameFrame:game.frame,fieldAge:game.bullets.age,enemyAlive:target.alive,parents:parents.map(bulletState),childCount:children.length,children:children.map(bulletState)});}
  function advance(){
    if(launch&&game.bullets.age===launch.due){
      assert(!split,'There are no early derived children');assert(parents.every(flying),'Every parent survives until the scheduled split');sample('before-split-update');
    }
    const previousAge=game.bullets.age;app.update(0);
    assert(game.bullets.age===previousAge+1,'Real application advances the bullet clock exactly once');
    if(launch&&!death){
      const ids=parents.map(b=>b.id),hp=target.hp,fieldAge=game.bullets.age;
      const damage=target.damage(10000000,{kind:'road-split-verification-shot',x:target.x,y:target.y},game.context);
      assert(damage>0&&!target.alive&&target.hp<=0,'Real damage defeats the source immediately after its first volley');
      assert(parents.every(flying)&&parents.every((b,index)=>b.id===ids[index]),'Enemy defeat preserves the already-fired parents');
      death={gameFrame:game.frame,fieldAge,hpBefore:hp,hpAfter:target.hp,damage,enemyAlive:target.alive,effects:target.effects.length,parents:parents.map(bulletState)};sample('after-enemy-defeat');
    }
    if(launch){
      assert(!target.alive,'Source never resumes enemy updates');
      if(game.bullets.age<=launch.due)assert(!split,'No derived ring appears before its authored update');
      if(game.bullets.age===launch.due+1){assert(split,'Scheduled split ran during its original frame');sample('after-split-update');}
      if(game.bullets.age===launch.due+1+scenario.observeAfter){
        const derived=events.filter(event=>event.enemyId===target.id&&event.source==='bullet');
        assert(derived.length===1,'Continued real updates never repeat the split');
        assert(events.filter(event=>event.enemyId===target.id&&event.source!=='bullet').length===1,'Defeated source never fires a second volley');
        assert(children.every(flying),'Derived children remain visible after spreading');
        sample('visible-children');ready=true;
      }
    }
    assert(game.frame<1600,'Natural target volley and derivation occur within the bounded pre-roll');
  }
  return{
    update(){nativeFrames++;if(!ready)for(let count=0;count<32&&!ready;count++)advance();},
    render(){if(!ready||nativeFrames!==scenario.captureFrame)return[];const commands=app.render();painted=true;return commands;},
    snapshot(){
      assert(ready&&painted,'Native budget reaches a rendered post-defeat split');
      return{passed:true,id:scenario.id,backend:native.backend,scenario,launch,death,split,timeline,
        exactDueFrame:true,splitCount:events.filter(event=>event.enemyId===target.id&&event.source==='bullet').length,
        sourceVolleyCount:events.filter(event=>event.enemyId===target.id&&event.source!=='bullet').length,
        memoryWrites,userdataFiles:[...memory.keys()],snapshot:app.snapshot()};
    },
    destroy(){app.destroy();},
  };
}
