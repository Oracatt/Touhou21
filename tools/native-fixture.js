import {ProjectApplication} from '../src/application.js';
import {EndingPage} from '../src/pages.js';
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
let preRoll=scenario.preRoll??0,phaseRoll=scenario.phaseRoll??0,untilFrames=0,conditionReached=!scenario.until,ready=false,nativeFrames=0;
const matches=()=>{const director=application.core.game?.director;return director&&Object.entries(scenario.until).every(([key,value])=>key==='spellId'?director.phase?.spec?.id===value:director[key]===value);};
function prepare(){
  // Bound each native invocation: both backends intentionally reject a single
  // JS call lasting over five seconds. QA prerolls must obey the same ABI.
  for(let i=0;i<64&&!ready;i++){
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
  update(mask){nativeFrames++;if(!ready)prepare();else if(scenario.live)advance(mask);},
  render:()=>ready&&(!scenario.captureFrame||nativeFrames===scenario.captureFrame)?application.render():[],
  snapshot(){if(!ready)throw new Error('QA frame budget exhausted');return application.snapshot();},
};
