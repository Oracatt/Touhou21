import {ProjectApplication} from '../src/application.js';
import {Keys} from '@ts-stg/thlib';
const native=globalThis.tsstg,scenario=JSON.parse(native.readText('build/performance-scenario.json'));
const memory=new Map([['userdata/guiming-settings.json',JSON.stringify({musicVolume:0,soundVolume:0,startingLives:2,autoSaveReplay:false})]]);
const host=Object.fromEntries(Object.getOwnPropertyNames(native).map(key=>[key,native[key]]));
host.readText=path=>path.startsWith('userdata/')?memory.get(path)??'':native.readText(path);
host.writeText=(name,value)=>memory.set(`userdata/${name}`,value);
const app=new ProjectApplication(host,{testing:true,fixedClock:true,invincible:true,seed:2107,...scenario.options});
let frame=0,preRoll=scenario.preRoll??0;const peak={bullets:0,lasers:0,commands:0};
globalThis.__tsstg_game={
  update(){
    // Finish bounded preroll inside the discarded warmup; measured frames
    // always use exactly one simulation update and the actual moving scene.
    for(let i=0;i<64&&preRoll>0;i++,preRoll--)app.update(0);
    app.update(frame===scenario.bombFrame?Keys.BOMB:scenario.mask??0);frame++;
    peak.bullets=Math.max(peak.bullets,app.core.game?.bullets.bullets.length??0);
    peak.lasers=Math.max(peak.lasers,app.core.game?.lasers.lasers.length??0);
  },
  render(){const commands=app.render();peak.commands=Math.max(peak.commands,commands.length);return commands;},
  snapshot:()=>({frame,peak,application:app.snapshot()}),
};
