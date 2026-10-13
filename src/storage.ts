import type {NativeHost} from '@ts-stg/thlib';

import type {Progress,RunResult,RunSummary,RunReplayData} from './shared-types.js';

import {ReplayPlayer,SaveStore} from '@ts-stg/thlib';
export const GAME_REVISION=22;
export const REPLAY_SLOT_COUNT=20;
export const DEFAULT_SETTINGS=Object.freeze({musicVolume:72,soundVolume:70,startingLives:2});
export interface Settings{musicVolume:number;soundVolume:number;startingLives:number;}
export interface ReplayEntry{date:number;revision:number;summary:RunSummary;replay:RunReplayData;}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function replayEntry(value:unknown):ReplayEntry|null{
  if(!object(value)||!object(value.replay)||!object(value.replay.config))return null;
  // Validate the recording format, not this game's current revision/backend.
  // Old recordings remain in their slots even when this build cannot play them.
  try{new ReplayPlayer(value.replay as unknown as RunReplayData);}catch{return null;}
  const revision=value.revision??value.replay.config.revision;
  if(!Number.isSafeInteger(revision)||Number(revision)<0)return null;
  return{date:typeof value.date==='number'&&Number.isFinite(value.date)?value.date:0,
    revision:revision as number,summary:object(value.summary)?value.summary as RunSummary:{},replay:value.replay as unknown as RunReplayData};
}
function replaySlots(value:unknown):(ReplayEntry|null)[]{
  // The former newest-first list keeps exactly its existing numbered order.
  // Invalid entries leave holes rather than shifting every subsequent slot.
  return Array.from({length:REPLAY_SLOT_COUNT},(_,slot)=>Array.isArray(value)?replayEntry(value[slot]):null);
}
function settingsFrom(value:unknown):Settings{
  const stored=object(value)?value:{},settings:Settings={...DEFAULT_SETTINGS};
  for(const key of ['musicVolume','soundVolume'] as const){
    const number=stored[key];if(typeof number==='number'&&Number.isFinite(number)&&number>=0)settings[key]=number;
  }
  return settings;
}
export class GameStorage {
 declare store:SaveStore;declare settings:Settings;declare progress:Progress;declare replays:(ReplayEntry|null)[];
  constructor(host:NativeHost){this.store=new SaveStore({readText:file=>host.readText(`userdata/${file}`),writeText:(file,text:string)=>host.writeText(file,text)},'guiming');this.settings=settingsFrom(this.store.get<unknown>('settings',{}));this.progress={clears:{},extraClears:{},stageUnlock:1,seenSpells:[],spellRecords:{},scores:[],plays:0,...this.store.get<Partial<Progress>>('progress',{})};this.replays=replaySlots(this.store.get<unknown>('replays',[]));}
  saveSettings(){this.store.set('settings',this.settings);}
  saveProgress(){this.store.set('progress',this.progress);}
  get replayCount(){return this.replays.filter(entry=>entry!==null).length;}
  saveReplay(slot:number,replay:RunReplayData,summary:RunSummary={}):ReplayEntry{
    if(!Number.isInteger(slot)||slot<0||slot>=REPLAY_SLOT_COUNT)throw new RangeError('Replay slot must be between 0 and 19');
    const entry=replayEntry(JSON.parse(JSON.stringify({date:Date.now(),revision:GAME_REVISION,summary,replay})));
    if(!entry)throw new TypeError('Invalid replay recording');
    const next=this.replays.slice();next[slot]=entry;
    // A rejected native write must neither replace the old slot in memory nor
    // appear to succeed to the save screen. The caller can display/retry it.
    this.store.set('replays',next);this.replays=next;return entry;
  }
  get extraUnlocked(){return Object.values(this.progress.clears).some(clear=>clear.noContinueClear||clear.continues===0);}
  recordClear(result:RunResult){const key=`${result.character}:${result.difficulty}`,previous=this.progress.clears[key];
    if(result.mode==='normal')this.progress.clears[key]={difficulty:result.difficulty,continues:Math.min(previous?.continues??Infinity,result.continues),score:Math.max(previous?.score??0,result.score),noContinueClear:!!previous?.noContinueClear||previous?.continues===0||result.continues===0};
    if(result.mode==='extra')this.progress.extraClears[result.character]=Math.max(this.progress.extraClears[result.character]??0,result.score);
    this.progress.scores.unshift({...result,date:Date.now()});this.progress.scores=this.progress.scores.slice(0,30);this.saveProgress();}
}
