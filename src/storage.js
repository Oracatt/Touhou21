import {SaveStore} from '@ts-stg/thlib';
export const GAME_REVISION=2;
export const DEFAULT_SETTINGS=Object.freeze({musicVolume:72,soundVolume:70,startingLives:2,autoSaveReplay:true});
export class GameStorage {
  constructor(host){this.store=new SaveStore({readText:file=>host.readText(`userdata/${file}`),writeText:(file,text)=>host.writeText(file,text)},'guiming');this.settings={...DEFAULT_SETTINGS,...this.store.get('settings',{})};this.progress={clears:{},extraClears:{},stageUnlock:1,seenSpells:[],spellRecords:{},scores:[],plays:0,...this.store.get('progress',{})};this.replays=this.store.get('replays',[]);}
  saveSettings(){this.store.set('settings',this.settings);}
  saveProgress(){this.store.set('progress',this.progress);}
  saveReplay(replay,summary={}){this.replays.unshift({date:Date.now(),revision:GAME_REVISION,summary,replay});this.replays=this.replays.slice(0,20);this.store.set('replays',this.replays);}
  get extraUnlocked(){return Object.values(this.progress.clears).some(clear=>clear.noContinueClear||clear.continues===0);}
  recordClear(result){const key=`${result.character}:${result.difficulty}`,previous=this.progress.clears[key];
    if(result.mode==='normal')this.progress.clears[key]={difficulty:result.difficulty,continues:Math.min(previous?.continues??Infinity,result.continues),score:Math.max(previous?.score??0,result.score),noContinueClear:!!previous?.noContinueClear||previous?.continues===0||result.continues===0};
    if(result.mode==='extra')this.progress.extraClears[result.character]=Math.max(this.progress.extraClears[result.character]??0,result.score);
    this.progress.scores.unshift({...result,date:Date.now()});this.progress.scores=this.progress.scores.slice(0,30);this.saveProgress();}
}
