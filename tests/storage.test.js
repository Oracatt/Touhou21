import test from 'node:test';
import assert from 'node:assert/strict';
import {GameStorage,GAME_REVISION,REPLAY_SLOT_COUNT,DEFAULT_SETTINGS} from '../dist/src/storage.js';
function host(initial={}){const files=new Map(Object.entries(initial)),writes=[];return{files,writes,readText:path=>files.get(path.replace(/^userdata\//,''))??'',writeText:(path,value)=>{writes.push(path);files.set(path,value);}};}
const replay=(frames=60,config={})=>({format:'ts-stg-replay',version:1,config:{game:'touhou21',revision:GAME_REVISION,backend:'v8',character:0,difficulty:1,mode:'normal',stageId:1,spellId:null,seed:1,startingLives:2,initialSpellRecords:{},spellTimes:[],...config},frames,runs:frames?[[0,frames]]:[],checkpoints:[]});
const entry=(index,config={})=>({date:1000+index,revision:config.revision??GAME_REVISION,summary:{score:index,character:0,difficulty:1},replay:replay(60+index,config)});
test('Easy no-continue clear unlocks Extra permanently across subsequent continued clears',()=>{const adapter=host(),storage=new GameStorage(adapter);storage.recordClear({character:0,difficulty:0,mode:'normal',continues:0,score:100});assert.equal(storage.extraUnlocked,true);storage.recordClear({character:0,difficulty:0,mode:'normal',continues:2,score:200});assert.equal(storage.extraUnlocked,true);const restored=new GameStorage(adapter);assert.equal(restored.extraUnlocked,true);assert.equal(restored.progress.clears['0:0'].score,200);assert.equal(restored.progress.clears['0:0'].continues,0);});
test('practice and replay-shaped summaries cannot unlock the main story',()=>{const storage=new GameStorage(host());for(const mode of ['stage-practice','spell-practice'])storage.recordClear({character:0,difficulty:1,mode,continues:0,score:100});assert.equal(storage.extraUnlocked,false);});
test('new storage exposes twenty empty numbered slots without writing a replay file',()=>{
  const adapter=host(),storage=new GameStorage(adapter);
  assert.equal(REPLAY_SLOT_COUNT,20);assert.deepEqual(storage.replays,Array(20).fill(null));assert.equal(storage.replayCount,0);
  assert.deepEqual(adapter.writes,[]);assert.equal(adapter.files.has('guiming-replays.json'),false);
});

test('legacy newest-first recordings retain every existing slot and old revision/backend',()=>{
  const legacy=Array.from({length:20},(_,i)=>entry(i,i===4?{revision:17,backend:'quickjs'}:{}));
  const adapter=host({'guiming-replays.json':JSON.stringify(legacy)}),storage=new GameStorage(adapter);
  assert.deepEqual(storage.replays,legacy);assert.equal(storage.replayCount,20);assert.deepEqual(adapter.writes,[]);
  storage.saveReplay(19,replay(),{score:900});
  const restored=new GameStorage(adapter);assert.deepEqual(restored.replays.slice(0,19),legacy.slice(0,19));assert.equal(restored.replays[19].summary.score,900);
  assert.equal(restored.replays[4].revision,17);assert.equal(restored.replays[4].replay.config.backend,'quickjs');
});

test('short legacy lists are padded and sparse slot identities survive saving and reloading',()=>{
  const first=entry(0),third=entry(2),adapter=host({'guiming-replays.json':JSON.stringify([first,null,third])}),storage=new GameStorage(adapter);
  assert.equal(storage.replays.length,20);assert.equal(storage.replayCount,2);assert.deepEqual(storage.replays.slice(0,4),[first,null,third,null]);
  storage.saveReplay(14,replay(42),{score:14});
  const restored=new GameStorage(adapter);assert.equal(restored.replayCount,3);assert.deepEqual(restored.replays[0],first);assert.equal(restored.replays[1],null);assert.deepEqual(restored.replays[2],third);assert.equal(restored.replays[14].replay.frames,42);assert.equal(restored.replays[19],null);
  assert.ok([...adapter.files.keys()].every(path=>path.startsWith('guiming-')));
});

test('explicit saves replace only the chosen slot and detach mutable recorder data',()=>{
  const adapter=host(),storage=new GameStorage(adapter),first=replay(80),summary={score:123,captures:[{captured:true}]};
  const saved=storage.saveReplay(7,first,summary);assert.equal(storage.replays[7],saved);assert.equal(storage.replayCount,1);assert.equal(saved.revision,GAME_REVISION);
  first.config.seed=999;first.runs[0][1]=777;summary.captures[0].captured=false;
  assert.equal(saved.replay.config.seed,1);assert.deepEqual(saved.replay.runs,[[0,80]]);assert.equal(saved.summary.captures[0].captured,true);
  const before=storage.replays.slice();storage.saveReplay(7,replay(120),{score:456});
  assert.equal(storage.replayCount,1);assert.equal(storage.replays[7].summary.score,456);
  for(let slot=0;slot<20;slot++)if(slot!==7)assert.equal(storage.replays[slot],before[slot]);
  assert.deepEqual(new GameStorage(adapter).replays,storage.replays);
});

test('out-of-range slots and malformed recordings cannot overwrite a stored replay',()=>{
  const adapter=host(),storage=new GameStorage(adapter);storage.saveReplay(0,replay(),{score:123});
  const before=JSON.stringify(storage.replays),disk=adapter.files.get('guiming-replays.json'),writes=adapter.writes.length;
  for(const slot of [-1,20,1.5,NaN,Infinity,undefined,'1'])assert.throws(()=>storage.saveReplay(slot,replay()),RangeError);
  assert.throws(()=>storage.saveReplay(0,{...replay(),frames:999}),TypeError);
  assert.equal(JSON.stringify(storage.replays),before);assert.equal(adapter.files.get('guiming-replays.json'),disk);assert.equal(adapter.writes.length,writes);
});

test('failed writes preserve the old slot and a retry can commit the replacement',()=>{
  const adapter=host(),storage=new GameStorage(adapter);storage.saveReplay(3,replay(),{score:123});
  const before=storage.replays,old=storage.replays[3],disk=adapter.files.get('guiming-replays.json'),write=adapter.writeText;
  adapter.writeText=()=>{throw new Error('disk full');};
  assert.throws(()=>storage.saveReplay(3,replay(120),{score:456}),/disk full/);
  assert.equal(storage.replays,before);assert.equal(storage.replays[3],old);assert.equal(adapter.files.get('guiming-replays.json'),disk);
  adapter.writeText=write;storage.saveReplay(3,replay(120),{score:456});assert.equal(new GameStorage(adapter).replays[3].summary.score,456);
});

test('corrupt replay data cannot shift or remove neighboring valid old recordings',()=>{
  const old=entry(3,{revision:12,backend:'quickjs'}),adapter=host({'guiming-replays.json':JSON.stringify([42,{replay:{}},{...entry(2),replay:{...replay(),frames:70}},old])});
  const storage=new GameStorage(adapter);assert.deepEqual(storage.replays.slice(0,4),[null,null,null,old]);assert.equal(storage.replayCount,1);assert.deepEqual(adapter.writes,[]);
  for(const raw of ['{broken',JSON.stringify({slots:[]}),JSON.stringify(null)]){
    const data=host({'guiming-replays.json':raw});assert.deepEqual(new GameStorage(data).replays,Array(20).fill(null));assert.deepEqual(data.writes,[]);
  }
});

test('legacy replay metadata omissions remain readable without discarding valid input',()=>{
  const legacy={replay:replay(15,{revision:18,backend:'quickjs'})},adapter=host({'guiming-replays.json':JSON.stringify([legacy])}),storage=new GameStorage(adapter);
  assert.equal(storage.replayCount,1);assert.equal(storage.replays[0].revision,18);assert.equal(storage.replays[0].date,0);assert.deepEqual(storage.replays[0].summary,{});assert.deepEqual(storage.replays[0].replay,legacy.replay);
});

test('obsolete automatic-save and initial-life settings are ignored while audio settings retain their values',()=>{
  const adapter=host({'guiming-settings.json':JSON.stringify({musicVolume:45,soundVolume:0,startingLives:0,autoSaveReplay:false,obsolete:1})}),storage=new GameStorage(adapter);
  assert.deepEqual(storage.settings,{musicVolume:45,soundVolume:0,startingLives:2});assert.equal('autoSaveReplay' in DEFAULT_SETTINGS,false);assert.deepEqual(adapter.writes,[]);
  storage.saveSettings();assert.deepEqual(JSON.parse(adapter.files.get('guiming-settings.json')),storage.settings);assert.deepEqual(new GameStorage(adapter).settings,storage.settings);
  assert.deepEqual(new GameStorage(host({'guiming-settings.json':JSON.stringify({musicVolume:'loud',soundVolume:null,startingLives:-1})})).settings,DEFAULT_SETTINGS);
  for(const startingLives of [0,1,5,99])assert.equal(new GameStorage(host({'guiming-settings.json':JSON.stringify({startingLives})})).settings.startingLives,2);
});
