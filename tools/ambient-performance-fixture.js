import {ProjectApplication} from '../dist/src/application.js';
import {stateHash} from '@ts-stg/thlib';

/** Paired native GPU workload. Only the OFF fixture replaces ambience drawing;
 * scene updates, production scenery, actors, bullets and HUD are unchanged. */
export function createAmbientPerformanceFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath));
  const check=(condition,message)=>{if(!condition)throw new Error(`Ambient performance: ${message}`);};
  const memory=new Map([['userdata/guiming-settings.json',JSON.stringify({musicVolume:0,soundVolume:0,startingLives:2,autoSaveReplay:false})]]);
  const host=Object.fromEntries(Object.getOwnPropertyNames(native).map(key=>[key,native[key]]));
  let memoryWrites=0;
  host.readText=file=>String(file).replaceAll('\\','/').startsWith('userdata/')?memory.get(file)??'':native.readText(file);
  // No fixture write can reach the native userdata writer, including cleanup.
  host.writeText=(name,value)=>{memoryWrites++;memory.set(`userdata/${name}`,value);};
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,invincible:true,seed:2107,
    autostart:true,mode:scenario.stage===7?'extra':'stage-practice',stageId:scenario.stage,difficulty:scenario.stage===7?4:3});
  let frame=0,preRoll=scenario.preRoll,boundGame=null,lastAmbient=null;
  const peak={bullets:0,lasers:0,commands:0,particles:0,meshCalls:0,vertices:0};
  const measured={frames:0,firstClock:null,lastClock:null,ambientFrames:0},rngTrace=[];
  function bindGame(){
    const game=app.core.game;if(!game)return;
    check(!boundGame||game===boundGame,'The paired workload must remain in one scene');
    if(boundGame)return;boundGame=game;
    check(game.background?.atmosphere,'Production StageAtmosphere must be present');
    if(!scenario.ambient)game.background.atmosphere.draw=(_draw,stage,clock)=>({stage,clock,particles:0,features:[],meshCalls:0,vertices:0});
  }
  function update(){app.update(scenario.mask??0);bindGame();}
  return{
    update(){
      // The extra 900 updates finish during the first 15 discarded renders.
      for(let i=0;i<64&&preRoll>0;i++,preRoll--)update();
      update();frame++;
      if(frame>scenario.warmup){
        check(preRoll===0,'Preroll must finish before measurement');
        const game=app.core.game;check(game,'A measured frame needs the production game');
        peak.bullets=Math.max(peak.bullets,game.bullets.bullets.length);
        peak.lasers=Math.max(peak.lasers,game.lasers.lasers.length);
        rngTrace.push([frame,game.frame,game.rng.state,game.visualRng.state,game.director.rng.state]);
      }
    },
    render(){
      const commands=app.render();
      if(frame>scenario.warmup){
        const background=app.core.game.background.stats,ambient=background?.atmosphere;
        check(background?.roadVisible&&ambient,'Measured scene must draw the road and ambience slot');
        check(ambient.stage===scenario.stage,'Requested stage must remain active');
        measured.frames++;measured.firstClock??=ambient.clock;measured.lastClock=ambient.clock;
        if(ambient.particles>0)measured.ambientFrames++;
        peak.commands=Math.max(peak.commands,commands.length);
        for(const key of ['particles','meshCalls','vertices'])peak[key]=Math.max(peak[key],ambient[key]);
        lastAmbient={...ambient};
      }
      return commands;
    },
    snapshot(){
      check(frame===scenario.frames&&measured.frames===scenario.frames-scenario.warmup,'Every requested frame must finish');
      const application=app.snapshot();delete application.backend;
      const gameplayHash=stateHash(application);
      return{backend:native.backend,stage:scenario.stage,ambient:scenario.ambient,frame,preRollRemaining:preRoll,mask:scenario.mask??0,
        measured,peak,lastAmbient,rngTrace,gameplayHash,application,memoryWrites,nativeUserdataWrites:0};
    },
    destroy(){app.destroy();},
  };
}
