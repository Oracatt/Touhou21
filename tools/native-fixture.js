import {ProjectApplication} from '../dist/src/application.js';
import {EndingPage} from '../dist/src/pages.js';
import {Keys} from '@ts-stg/thlib';
const native=globalThis.tsstg,scenario=JSON.parse(native.readText('build/scenario.json'));
const memory=new Map(),host=Object.fromEntries(Object.getOwnPropertyNames(native).map(key=>[key,native[key]]));
host.readText=path=>path.startsWith('userdata/')?(memory.get(path)??''):native.readText(path);
host.writeText=(path,text)=>memory.set(`userdata/${path}`,text);
const application=new ProjectApplication(host,{testing:true,fixedClock:true,seed:2107,...scenario.options});
if(Number.isInteger(scenario.readingIndex)&&application.page?.pages)application.page.index=scenario.readingIndex;
let count=0;
const advance=(mask=0)=>{
  const input=scenario.input?.[count]??scenario.inputMask??mask;
  for(const action of scenario.actions??[])if(action.frame===count){
    if(action.type==='page')application.openTestPage(action.page);
    else if(action.type==='select'){application.core.menu.selection=action.index;application.core.menu.phase=2;}
    else if(action.type==='play'){application.page=null;application.core.startTransition(action.selection??{});}
    else if(action.type==='practice')application.choosePractice(action.selection);
    else if(action.type==='ending')application.page=new EndingPage({result:action.result,onClose:()=>{application.page=null;application.core.openMenu();},text:application.text,art:application.art,music:application.music});
  }
  application.update(input);count++;
};
let preRoll=scenario.preRoll??0,phaseRoll=scenario.phaseRoll??0,untilFrames=0,conditionReached=!scenario.until,ready=false,nativeFrames=0,awaitingPauseRender=false;
const nameProbe={phase:'seek',startedIndex:null,startedAt:null,pausedAge:null,pausedTicks:0};
function prepareName(){
  const game=application.core.game,card=game?.bossNameCard,probe=scenario.nameProbe;
  if(nameProbe.phase==='seek'){
    if(!card){advance(count%2?Keys.SHOOT:0);return false;}
    if(!game.dialogue?.portraitState('right'))throw new Error('Boss name appeared before its portrait');
    nameProbe.startedIndex=game.dialogue.index;nameProbe.startedAt=count;nameProbe.phase='age';
  }
  if(!card?.alive)throw new Error('QA Boss name retired before the requested frame');
  if(nameProbe.phase==='age'){
    if(card.age<probe.age){advance();return false;}
    if(probe.exitAge!==undefined)nameProbe.phase='exit';
    else if(probe.pauseFrames){
      // Pause samples the real backbuffer. Yield one native frame with the
      // actual dialogue drawn before sending the next physical input edge.
      nameProbe.pausedAge=card.age;nameProbe.phase='pause-capture';awaitingPauseRender=true;return false;
    }
    else return true;
  }
  if(nameProbe.phase==='pause-capture'){advance(Keys.PAUSE);nameProbe.phase='paused';return false;}
  if(nameProbe.phase==='exit'){
    if(game.dialogue?.exiting){if(card.exitAge>=probe.exitAge)return true;advance();}
    else advance(count%2?Keys.SHOOT:0);
    return false;
  }
  if(nameProbe.phase==='paused'){
    if(!game.paused||card.age!==nameProbe.pausedAge)throw new Error('QA paused Boss name advanced');
    if(nameProbe.pausedTicks++<probe.pauseFrames){advance();return false;}
    if(!probe.resume)return true;
    advance(Keys.PAUSE);nameProbe.phase='resuming';return false;
  }
  if(nameProbe.phase==='resuming'){
    if(game.paused){advance();return false;}
    if(card.age!==nameProbe.pausedAge)throw new Error('QA resume handoff advanced the name');
    advance();nameProbe.phase='resumed';return true;
  }
  return false;
}
const matches=()=>{const director=application.core.game?.director;return director&&Object.entries(scenario.until).every(([key,value])=>key==='spellId'?director.phase?.spec?.id===value:director[key]===value);};
function prepare(){
  // Bound each native invocation: both backends intentionally reject a single
  // JS call lasting over five seconds. QA prerolls must obey the same ABI.
  for(let i=0;i<64&&!ready;i++){
    if(scenario.nameProbe){
      if(++untilFrames>(scenario.maxPreRoll??12000))throw new Error('QA Boss name input path was never reached');
      ready=prepareName();if(awaitingPauseRender)return;continue;
    }
    if(preRoll>0){advance();preRoll--;continue;}
    if(!conditionReached){
      if(matches())conditionReached=true;
      else{if(++untilFrames>(scenario.maxPreRoll??12000))throw new Error('QA condition was never reached');advance();continue;}
    }
    if(phaseRoll>0){advance();phaseRoll--;continue;}
    if(scenario.ending)application.page=new EndingPage({result:scenario.ending,onClose:()=>{},text:application.text,art:application.art,music:application.music});
    if(scenario.endingPhase){application.page.phase=scenario.endingPhase;application.page.age=120;}
    advance();ready=true;
  }
}
globalThis.__tsstg_game={
  update(){nativeFrames++;awaitingPauseRender=false;if(!ready)prepare();else if(scenario.live)advance();},
  render:()=>awaitingPauseRender||ready&&(!scenario.captureFrame||nativeFrames===scenario.captureFrame)?application.render():[],
  snapshot(){if(!ready)throw new Error('QA frame budget exhausted');
    const state=application.snapshot();
    if(scenario.id?.startsWith('midboss-')){
      const game=application.core.game,entrance=game.bossPresentation.entrance;
      state.bossPresentation=game.bossPresentation.snapshot();
      state.midbossFog={boss:game.director.boss?{x:game.director.boss.x,y:game.director.boss.y}:null,
        anchors:entrance?.roots.map(root=>({script:root.scriptId,root:{x:root.x,y:root.y},
          center:root.attachedEffect?.center??null,near:root.attachedEffect?.nearCenter??null,far:root.attachedEffect?.farCenter??null}))??[]};
    }
    if(scenario.nameProbe){state.bossNameCard=application.core.game.bossNameCard?.snapshot()??null;state.nameProbe={...nameProbe};}
    if(scenario.hpProbe){const game=application.core.game,boss=game.director.boss;
      state.bossHp={hud:game.bossHud.snapshot(),animations:game.bossHud.panels[0].animations.length,held:game.isBossHeld(boss),flags:boss.primaryFlags};}
    return state;
  },
};
