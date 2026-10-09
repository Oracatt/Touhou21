import {Keys} from '@ts-stg/thlib';
import {ProjectApplication} from '../dist/src/application.js';
import {STAGES,PLAYERS} from '../dist/src/content.js';

/** Native display QA only. The production App receives ordinary Shoot/release
 * inputs. Road skipping isolates this dialogue; no dialogue private method or
 * Boss/portrait/ANM clock is changed. All user data writes stay in memory. */
export function createDialogueIntroFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath)),memory=new Map();
  const assert=(condition,message)=>{if(!condition)throw new Error(`${scenario.id}: ${message}`);};
  const host=Object.create(native),normalPath=path=>String(path).replaceAll('\\','/');let memoryWrites=0;
  Object.defineProperties(host,{
    readText:{value:path=>normalPath(path).startsWith('userdata/')?memory.get(normalPath(path))??'':native.readText(path)},
    writeText:{value:(path,value)=>{const name=normalPath(path);assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA write is relative memory userdata');memory.set(`userdata/${name}`,value);memoryWrites++;}},
  });
  const stage=STAGES.find(value=>value.id===scenario.stageId),route=scenario.character?'marisa':'reimu';
  assert(stage,'Known real stage');
  const firstBoss=stage.dialogues[route].before.findIndex(line=>line.speaker==='boss');
  assert(firstBoss>0,'Authored player monologue precedes first Boss response');
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210721,autostart:true,skipRoad:true,
    invincible:true,autoDialogue:false,mode:stage.id===7?'extra':'stage-practice',stageId:stage.id,
    difficulty:stage.id===7?4:1,character:scenario.character});
  const game=app.core.game,inputs=[],transitions=[],revealTrace=[];let nativeFrames=0,updates=0,ready=false,result=null;
  let trackedOwner=null,trackedIndex=-1,enteredAt=0,observing=false;
  const portraitSubmissions=[],bodySubmissions=[],anmSubmissions=[];
  const portrait=app.art.portrait.bind(app.art);
  app.art.portrait=(target,id,x,y,height,options)=>{
    const begin=target.commands.length,answer=portrait(target,id,x,y,height,options);
    if(observing){const emitted=target.commands.slice(begin).filter(command=>command[0]==='spriteRegion');
      assert(emitted.length===1,'Business portrait emits its actual textured sprite once');
      portraitSubmissions.push({id,textureId:emitted[0][1],x,y,height,alpha:options?.alpha??1,color:emitted[0].at(-1),command:emitted[0]});}
    return answer;
  };
  const body=game.bossSprites.draw.bind(game.bossSprites);
  game.bossSprites.draw=(target,enemy,bossId,options)=>{
    const begin=target.commands.length,answer=body(target,enemy,bossId,options);
    if(observing){const emitted=target.commands.slice(begin).filter(command=>command[0]==='spriteRegion');
      assert(emitted.length===1,'Real Boss catalogue emits its actual body sprite');
      bodySubmissions.push({bossId,x:enemy.x,y:enemy.y,options,textureId:emitted[0][1],command:emitted[0]});}
    return answer;
  };
  const track=()=>{
    const owner=game.dialogue;
    if(owner?.current&&(owner!==trackedOwner||owner.index!==trackedIndex)){
      trackedOwner=owner;trackedIndex=owner.index;enteredAt=app.frame;
      transitions.push({frame:app.frame,index:owner.index,speaker:owner.current.speaker,text:owner.current.text});
    }
    const entrance=game.bossPresentation.entrance;
    if(entrance&&[100,101].includes(entrance.age)&&!revealTrace.some(value=>value.age===entrance.age)){
      assert(entrance.revealFrame===101,'Public black fog uses original 101-frame reveal');
      assert(game.bossPresentation.bossVisible===(entrance.age>=101),'Public Boss body gate changes exactly at frame101');
      revealTrace.push({frame:app.frame,index:game.dialogue?.index??null,stepAge:app.frame-enteredAt,age:entrance.age,revealed:entrance.revealed,bodyVisible:game.bossPresentation.bossVisible});
    }
  };
  const advance=(mask=0)=>{inputs.push({frame:app.frame,mask});app.update(mask);updates++;track();};
  const stepAge=()=>app.frame-enteredAt;
  const observeTree=vm=>{
    if(!vm)return;
    const original=vm.drawSelf.bind(vm);
    vm.drawSelf=(target,view)=>{
      const begin=target.commands?.length??0,answer=original(target,view),end=target.commands?.length??0;
      if(observing&&!target.enqueueAnm&&end>begin)anmSubmissions.push({scriptId:vm.scriptId,sprite:vm.spriteIndex,
        rawLayer:vm.layer,effectiveLayer:vm.effectiveLayer,priority:vm.drawPriority,commandStart:begin,commandEnd:end,
        position:vm.worldPosition(view)});
      return answer;
    };
    for(const child of vm.children)observeTree(child);
  };
  function* prepare(){
    for(let i=0;!game.dialogue?.current;i++){
      assert(i<180,'Actual App enters authored opening dialogue');advance();if(updates%32===0)yield;
    }
    assert(game.director.state==='dialogue'&&!game.options.autoDialogue,'Real authored dialogue has no automatic fixture advance');
    const targetIndex=scenario.kind==='monologue'?0:scenario.kind==='portrait'?firstBoss+1:firstBoss;
    while(game.dialogue.index<targetIndex){
      const owner=game.dialogue,index=owner.index;
      for(let i=0;owner.cold||owner.entranceState&&!owner.entranceState.inputReady;i++){
        assert(i<180,'Real source input gate becomes available');advance();if(updates%32===0)yield;
      }
      advance(Keys.SHOOT);if(updates%32===0)yield;
      assert(game.dialogue===owner&&owner.index===index+1,'Shoot input advances exactly one authored step');
      advance();if(updates%32===0)yield;
    }
    const owner=game.dialogue;
    assert(owner.index===targetIndex,'Requested real dialogue step selected');
    while(stepAge()<scenario.age){advance();if(updates%32===0)yield;}
    assert(stepAge()===scenario.age,'Capture exact authored-step presentation age');
    assert(owner.active&&!owner.exiting&&game.director.state==='dialogue','Capturing an active actual dialogue owner');
    assert(!game.bossPresentation.combatActive&&!game.bossHud.timerVisible,'Opening dialogue has no attack effects or active timer');
    const boss=game.director.boss,current=owner.current,entrance=game.bossPresentation.entrance;
    const projected=boss?{x:game.view.x+boss.x*game.view.scale,y:game.view.y+boss.y*game.view.scale}:null;
    const anchor=Number.isFinite(current.x)&&Number.isFinite(current.y)?{x:current.x/2,y:current.y/2}:null;
    const offset=anchor&&projected?{x:anchor.x-projected.x/1.5,y:anchor.y-projected.y/1.5}:null;
    const actor=scenario.kind==='actor'||scenario.kind==='entry';
    if(actor){
      assert(current.boxMode===2,'First Boss response explicitly selects public actor mode2');
      assert(current.portraits.left.present===false&&current.portraits.right.present===false,'Actor line explicitly retires both portrait sides');
      assert(JSON.stringify(current.entrance)===JSON.stringify({portraitFrame:0,speakerFrame:0,textFrame:60,inputFrame:94}),'Actor-line entrance retains original 60/94-frame text/input timing');
      assert(entrance?.mode==='blackFog'&&entrance.revealFrame===101,'Actual public black fog owns Boss body visibility');
      assert(offset&&Math.abs(offset.x+32)<1e-10&&Math.abs(offset.y-6)<1e-10,'MSG anchor has original (-32,+6) source-screen offset from the projected actor');
      if(scenario.kind==='entry')assert(!owner.box,'Age20 has no premature speech bubble while player portrait exits');
      else{
        assert([272,296].includes(owner.box?.scriptId),'Field response uses original single/double-line mode2 ANM');
        assert(owner.mode===2,'Public text positioning uses field mode2');
        assert(owner.entranceState?.inputReady===(scenario.age>=94),'Real first-response input gate uses frame94');
      }
      assert(game.bossPresentation.bossVisible===(scenario.age>=101),'Actor sample respects original black-fog body reveal');
    }else if(scenario.kind==='monologue'){
      assert(current.speaker==='left'&&!boss,'Player monologue precedes Boss spawn');
      assert([270,294].includes(owner.box?.scriptId),'Player monologue uses original left bubble');
    }else{
      assert(current.portraits.left.present&&current.portraits.right.present,'Following authored line rebuilds both portraits');
      assert(owner.portraitState('left')&&owner.portraitState('right'),'Both public portrait motion clocks exist');
      assert([270,271,294,295].includes(owner.box?.scriptId),'Following line uses its speaker portrait bubble');
    }
    observeTree(owner.box);
    result={passed:true,id:scenario.id,backend:native.backend,scenario,entry:'Real ProjectApplication autostart, road skip and Shoot/release input; no private dialogue methods',
      applicationUpdates:updates,inputs,transitions,firstBossIndex:firstBoss,stepAge:stepAge(),memoryWrites,memoryUserdataKeys:[...memory.keys()].sort(),
      dialogue:owner.snapshot(),currentStep:current,portraitStates:{left:owner.portraitState('left'),right:owner.portraitState('right')},
      boss:boss?{id:boss.bossId,x:boss.x,y:boss.y,projected,visible:game.bossPresentation.bossVisible}:null,
      actorAnchor:anchor,actorOffset:offset,entrance:entrance?.snapshot()??null,revealTrace,application:app.snapshot(),
      portraitSubmissions,bodySubmissions,anmSubmissions,commands:0,
      scope:'Focused native opening dialogue rendering and lifecycle. Fixture-only road skip/invincibility/memory userdata; no campaign, difficulty or audio-quality claim.'};
    ready=true;
  }
  const runner=prepare();
  return{
    update(){nativeFrames++;if(!ready)runner.next();},
    render(){
      if(!ready||nativeFrames!==scenario.captureFrame)return[];
      const before=JSON.stringify(app.snapshot());observing=true;
      const commands=app.render();observing=false;
      assert(JSON.stringify(app.snapshot())===before,'Painting does not advance any public scene or dialogue clock');
      const playerId=PLAYERS[scenario.character].id,bossId=stage.bossId;
      const left=portraitSubmissions.filter(value=>value.id===playerId),right=portraitSubmissions.filter(value=>value.id===bossId);
      if(scenario.kind==='actor')assert(left.length===0&&right.length===0,'Field response actually submits neither business portrait texture');
      else if(scenario.kind==='entry')assert(left.length===1&&right.length===0&&left[0].alpha>0,'Age20 retains only the real player portrait exit tail');
      else if(scenario.kind==='monologue')assert(left.length===1&&right.length===0,'Real monologue submits only the player portrait');
      else assert(left.length===1&&right.length===1&&left[0].alpha>0&&right[0].alpha>0,'Following portrait line actually submits both business images');
      if(result.boss?.visible)assert(bodySubmissions.length===1,'Visible Boss actor body is actually submitted once');
      else assert(bodySubmissions.length===0,'Hidden/unspawned Boss emits no body sprite');
      if(scenario.kind==='actor'){
        const arrow=result.dialogue.boxScript===272?262:266;
        assert(anmSubmissions.some(value=>value.scriptId===arrow),'Original actor speech-arrow VM emits actual textured commands');
        result.arrowScript=arrow;
      }
      result.commands=commands.length;result.submittedPortraitIds=portraitSubmissions.map(value=>value.id);
      assert(commands.length>0,'Actual production App paints the requested scene');
      return commands;
    },
    snapshot(){assert(ready&&result.commands>0,'Native budget prepares and renders the requested real dialogue state');return result;},
    destroy(){app.destroy();},
  };
}
