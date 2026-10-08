import {DrawList,Keys} from '@ts-stg/thlib';
import {TouhouPause,TouhouGameOver} from '@ts-stg/thlib/touhou';
import {ProjectApplication} from '../src/application.js';

/** Short native display fixture. All writes are memory-only; pause/confirmation
 * use real App input, while result menus explicitly use the public entry API. */
export function createPauseUiFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath)),memory=new Map();
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const userPath=path=>String(path).replaceAll('\\','/').startsWith('userdata/');
  const host=Object.create(native);let memoryWrites=0;
  Object.defineProperties(host,{
    readText:{value:path=>userPath(path)?memory.get(String(path).replaceAll('\\','/'))??'':native.readText(path)},
    writeText:{value:(path,value)=>{const name=String(path).replaceAll('\\','/');assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA write stays in memory userdata');memory.set(`userdata/${name}`,value);memoryWrites++;}},
  });
  const resultMenu=scenario.id.startsWith('gameover-'),practice=scenario.id==='gameover-practice';
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210721,autostart:true,
    mode:practice?'stage-practice':'normal',stageId:1,difficulty:1,character:0,invincible:true});
  const game=app.core.game,draw=new DrawList(),inputs=[];let applicationUpdates=0,nativeFrames=0,ready=false,result=null,owner=null;
  const advance=(mask=0)=>{if(mask)inputs.push({frame:app.frame,mask});app.update(mask);applicationUpdates++;};
  const tap=mask=>{advance(mask);advance();};
  function* prepare(){
    // Yield one rendered gameplay frame before capture() reads the framebuffer.
    for(let i=0;i<90;i++){advance();if(i%32===31)yield;}yield;
    if(resultMenu){
      game.openGameOver(0);owner=game.pauseVisual;
      assert(owner instanceof TouhouGameOver,'Actual public GameOver owner');
      assert(game.session.mode===(practice?1:0),'Requested real result policy');
    }else{
      tap(Keys.PAUSE);owner=game.pauseVisual;
      assert(owner instanceof TouhouPause&&game.paused,'Real Esc opens the public pause owner');
    }
    for(let i=0;owner.phase!==6;i++){assert(i<40,'Public owner reaches menu phase');advance();}
    for(let i=0;i<40;i++)advance();
    if(!resultMenu&&scenario.id!=='pause-main'){
      const choice=scenario.id.startsWith('pause-exit')?1:scenario.id==='pause-restart'?5:2;
      if(choice===5)tap(Keys.UP);else for(let i=0;i<choice;i++)tap(Keys.DOWN);
      assert(owner.selection===choice&&!owner.excluded.has(choice),'Real navigation selects available pause action');
      tap(Keys.SHOOT);
      const phase=choice===2?9:7;
      assert(owner.phase===phase,'Real confirm opens the original ANM confirmation');
      for(let i=0;owner.age<42;i++){assert(i<50,'Confirmation animation settles');advance();}
      assert(owner.count===2&&owner.selection===1,'Confirmation defaults to No');
      if(scenario.id==='pause-exit-yes'){tap(Keys.UP);for(let i=0;i<10;i++)advance();assert(owner.selection===0,'Actual input selects Yes without accepting');}
    }
    assert(app.page===null,'ANM confirmation is not an external Options/Manual page');
    const frozenGameFrame=game.frame;for(let i=0;i<8;i++)advance();
    assert(game.paused&&game.frame===frozenGameFrame,'The real menu freezes gameplay');
    assert(owner.active&&owner.panelVisible&&owner.panel,'Actual ANM panel is visible');
    const emissions=[];
    const observe=vm=>{
      const original=vm.drawSelf.bind(vm);
      vm.drawSelf=(target,view)=>{
        const start=target.commands?.length??0,answer=original(target,view),end=target.commands?.length??0;
        // Queuing is not drawing: only record commands appended to a plain list.
        if(!target.enqueueAnm&&end>start)emissions.push({scriptId:vm.scriptId,sprite:vm.spriteIndex,
          rawLayer:vm.layer,secondary:vm.renderSecondary,effectiveLayer:vm.effectiveLayer,
          priority:vm.drawPriority,order:vm.renderOrder,commandStart:start,commandEnd:end});
        return answer;
      };
      for(const child of vm.children)observe(child);
    };
    observe(owner.panel);
    result={passed:true,id:scenario.id,backend:native.backend,entry:resultMenu?'Direct public openGameOver API; not death/input reproduction':'Actual ProjectApplication Esc and navigation input',
      scope:'Native public ANM panel rendering only. Memory userdata and fixture invincibility isolate display; no campaign/collision/audio-quality claim.',
      applicationUpdates,memoryWrites,inputs,gameFrame:game.frame,paused:game.paused,menu:owner.snapshot(),
      panelScript:owner.panel.scriptId,sessionMode:game.session.mode,emissions,commands:0,orderCorrect:null};
    ready=true;
  }
  const runner=prepare();
  return{
    update(){nativeFrames++;if(!ready)runner.next();},
    render(){
      if(!ready)return app.render();
      if(nativeFrames!==scenario.captureFrame)return[];
      const commands=app.render();draw.reset();for(const command of commands)draw.push(command);
      const decorations=result.emissions.filter(value=>value.priority===77),labels=result.emissions.filter(value=>value.priority===99);
      assert(decorations.length>0&&labels.length>0,'Actual decoration77 and label99 both emit commands');
      result.orderCorrect=Math.max(...decorations.map(value=>value.commandEnd))<=Math.min(...labels.map(value=>value.commandStart));
      result.decorations=decorations.length;result.labels=labels.length;result.commands=commands.length;
      assert(result.orderCorrect===!scenario.legacy,'Actual plain-list order matches the explicitly requested baseline/fixed state');
      return draw.commands;
    },
    snapshot(){assert(ready&&result.commands>0,'Native frame budget reaches and renders the actual panel');return result;},
  };
}
