import {Keys,stateHash} from '@ts-stg/thlib';
import {TouhouGame,TouhouPlayer,TouhouBulletField,TouhouLaserField,TouhouSpell,TouhouEnemy,TouhouHealth,TouhouItems,TouhouBossPresentation,TouhouBossHud,TouhouGameOver} from '@ts-stg/thlib/touhou';
import {ProjectApplication} from '../dist/src/application.js';
import {STAGES,ALL_SPELLS} from '../dist/src/content.js';
import {GAME_REVISION} from '../dist/src/storage.js';

// Dedicated native headless QA entry. Player userdata is replaced by memory;
// only dedicated userdata/integration files test the real native path adapter.
// Real resources, native hosts and every public gameplay owner stay in use.
export function createIntegrationFixture(scenarioPath){
const native=globalThis.tsstg;
const scenario=JSON.parse(native.readText(scenarioPath));
const memory=new Map();let writes=0,sceneUpdateCalls=0,applicationUpdateCalls=0;
const isUserData=path=>String(path).replaceAll('\\','/').startsWith('userdata/');
const host=Object.create(native);
Object.defineProperties(host,{
  readText:{value:path=>isUserData(path)?memory.get(path)??'':native.readText(path)},
  // Native writeText resolves beneath userdata; readText resolves at root.
  writeText:{value:(path,value)=>{const name=String(path).replaceAll('\\','/');assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA path remains inside userdata');memory.set(`userdata/${name}`,value);writes++;}},
});
let result=null,application=null;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const tick=(app,frames=1,mask=0)=>{for(let i=0;i<frames;i++)app.update(typeof mask==='function'?mask(i):mask);};
const tap=(app,mask)=>{app.update(mask);app.update(0);};
const make=options=>{
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210721,...options}),track=game=>{
    const update=game.update.bind(game);game.update=mask=>{sceneUpdateCalls++;return update(mask);};return game;
  };
  if(app.core.game)track(app.core.game);const create=app.core.createGame;
  app.core.createGame=(settings,core)=>track(create(settings,core));
  const update=app.update.bind(app);app.update=mask=>{applicationUpdateCalls++;return update(mask);};return app;
};
function owners(game){return{game:game instanceof TouhouGame,player:game.player instanceof TouhouPlayer,
  bullets:game.bullets instanceof TouhouBulletField,lasers:game.lasers instanceof TouhouLaserField,spell:game.spell instanceof TouhouSpell,
  items:game.items instanceof TouhouItems,bossPresentation:game.bossPresentation instanceof TouhouBossPresentation,bossHud:game.bossHud instanceof TouhouBossHud,
  playerBank:game.player.bank===game.banks[game.player.character?'pl01':'pl00'],bulletBank:game.bullets.bank===game.banks.bullet};}
function* campaign(){
  const options={autostart:true,invincible:true,autoCapture:true,autoDialogue:true,autoStageClear:true,...scenario.options,skipRoad:false};
  application=make(options);const game=application.core.game,identity=owners(game);
  assert(Object.values(identity).every(Boolean),'Scene must compose the shared public owners and banks');
  const visited=[game.currentStage.id],states={},roadMax={},peak={bullets:0,lasers:0,enemies:0},bodies={},rendered=[];let frames=0;
  while(!application.finishedResult&&frames<100000){
    application.update(Keys.SHOOT);frames++;
    const d=game.director;states[d.state]=(states[d.state]??0)+1;roadMax[d.stageId]=Math.max(roadMax[d.stageId]??0,d.stageFrame);
    if(visited.at(-1)!==d.stageId)visited.push(d.stageId);
    if(d.boss&&!bodies[d.boss.bossId]){const boss=d.boss;bodies[boss.bossId]={enemy:boss instanceof TouhouEnemy,health:boss.health instanceof TouhouHealth,animationBank:boss.animation.bank===game.banks.enemy};assert(Object.values(bodies[boss.bossId]).every(Boolean),'Every business Boss body keeps public Enemy/Health/ANM ownership');}
    if(d.boss&&d.phaseFrame===61&&['combat','midboss-combat'].includes(d.state)&&!rendered.some(entry=>entry.bossId===d.boss.bossId)){const commands=application.render();assert(commands.length>0,'Actual application produces gameplay draw commands');rendered.push({bossId:d.boss.bossId,commands:commands.length,types:[...new Set(commands.map(command=>command[0]))].sort()});}
    peak.bullets=Math.max(peak.bullets,game.bullets.bullets.length);peak.lasers=Math.max(peak.lasers,game.lasers.lasers.length);peak.enemies=Math.max(peak.enemies,game.enemies.length);
    // Match the normal host boundary: one application frame per native call.
    // Batching 128 dense frames consumed QuickJS's 5-second per-call watchdog
    // even though individual frames completed. No simulation step is skipped.
    yield;
  }
  assert(application.finishedResult,'Complete original-length route must reach App.finished');
  const expected=options.mode==='extra'?[7]:options.mode==='stage-practice'?[options.stageId]:[1,2,3,4,5,6];
  assert(JSON.stringify(visited)===JSON.stringify(expected),'Route visits every requested stage');
  for(const id of expected)assert(roadMax[id]>=STAGES[id-1].roadFrames,`Stage ${id} must run its whole real road`);
  const cards=id=>STAGES[id-1].spells.length+STAGES[id-1].midbossSpells.length;
  const count=options.mode==='extra'?13:options.mode==='stage-practice'?cards(options.stageId):[1,2,3,4,5,6].reduce((n,id)=>n+cards(id),0);
  assert(game.director.captures.length===count,`Expected ${count} card settlements`);
  assert(writes===0,'QA route must not persist records or replays');
  result={kind:'campaign',frames,visited,roadMax,states,peak,identity,bodies,rendered,events:game.director.events,finished:application.finishedResult,snapshot:application.snapshot(),memoryWrites:writes};
}
function* replay(){
  application=make({autostart:true,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id,difficulty:1,character:0});
  const source=application.core.game;source.player.lives=5;source.recorder.config.startingLives=5;
  const events={hit:0,miss:0,bomb:0,pausedFrames:0,spellFinish:0},event=source.onEvent;
  source.onEvent=(name,data)=>{if(name in events)events[name]++;event?.(name,data);};
  let frames=0,bombInput=null;
  while(!application.finishedResult&&frames<6000){
    let mask=frames>=600?Keys.RIGHT:0;
    if(frames===400||frames===440)mask=Keys.PAUSE;
    // Pattern edits change natural Miss times. Send one real X after recovery,
    // rather than assuming a fixed frame cannot fall in the respawn entrance.
    if(bombInput===null&&frames>=900&&events.miss>0&&!source.paused&&!source.context.inputBlocked&&
      source.player.state===1&&source.player.canBomb(source.context)){
      bombInput={applicationFrame:frames,gameFrame:source.frame,state:source.player.state,bombs:source.player.bombs};mask|=Keys.BOMB;
    }
    application.update(mask);if(source.paused)events.pausedFrames++;frames++;
    assert(!source.pendingGameOver,'Replay sample retains enough stock to cross a natural card settlement');
    if(frames%128===0)yield;
  }
  assert(application.finishedResult,'Real public timer/damage must finish the card');
  assert(events.bomb>0,'Recorded X input must trigger a real public Bomb');
  assert(bombInput?.state===1,'Single recorded X follows a real Miss and ordinary respawn recovery');
  assert(events.miss>0,'Original patterned bullets must cause a real collision and miss');
  assert(events.pausedFrames>0,'Recorded Esc input must exercise pause and resume');
  assert(events.spellFinish===1,'Sample crosses exactly one natural card settlement');
  const recorded=source.recorder.toJSON(),expected=source.snapshot(),stock=source.player.lives;
  application.storage.settings.startingLives=1;
  application.storage.progress.scores=[{character:0,difficulty:1,mode:'normal',score:99999999}];
  application.storage.progress.spellRecords['0:1']={1:{name:'records changed after recording',captures:[17,13],attempts:[85,77]}};
  const progress=JSON.stringify(application.storage.progress),beforeWrites=writes;
  application.finishedResult=null;application.playbackSource=recorded;application.core.start(recorded.config);
  const playing=application.core.game;
  assert(playing.player.lives===5,'Playback restores recorded initial stock, ignoring current options');
  for(let i=0;i<recorded.frames;i++){application.update(0);if(i%128===127)yield;}
  assert(playing.playback.desync===null,'All actual public ReplayPlayer checkpoints pass');
  assert(stateHash(playing.snapshot())===stateHash(expected),'Recorded and replayed final simulation states are identical');
  assert(playing.player.lives===stock,'Replay follows the same public misses and stock changes');
  application.update(0);assert(application.replayFinished,'App receives replay completion callback');
  assert(JSON.stringify(application.storage.progress)===progress&&writes===beforeWrites,'Replay changes no persistent progress');
  result={kind:'replay',frames,events,bombInput,config:recorded.config,inputRuns:recorded.runs,checkpoints:recorded.checkpoints,
    checkedFinalHash:stateHash(expected),replayFinalHash:stateHash(playing.snapshot()),finished:source.finishedResult,identity:owners(playing),memoryWrites:writes};
}
function* continuationReplay(){
  // Fixture-only low stock makes the first real road collision reach GameOver.
  memory.set('userdata/guiming-settings.json',JSON.stringify({startingLives:0}));
  memory.set('userdata/guiming-progress.json',JSON.stringify({scores:[{character:0,difficulty:1,mode:'normal',score:12345678}]}));
  application=make({autostart:true,mode:'normal',difficulty:1,character:0});
  const source=application.core.game,events={miss:0,gameover:0},event=source.onEvent;
  source.onEvent=(name,data)=>{if(name in events)events[name]++;event?.(name,data);};
  let frames=0,continuedAt=null,continuedPause=false,continuedResume=false;const tracks=new Set();
  while(frames<5000&&(continuedAt===null||frames<continuedAt+750)){
    let mask=continuedAt===null?0:Keys.RIGHT;
    if(source.paused&&source.pauseVisual instanceof TouhouGameOver&&source.pauseVisual.phase===6)mask=Keys.SHOOT;
    else if(continuedAt!==null&&!continuedPause&&frames>=continuedAt+90){mask=Keys.PAUSE;continuedPause=true;}
    else if(continuedPause&&!continuedResume&&source.paused&&source.pauseVisual.phase===6&&source.pauseVisual.age>=20){
      const replayRow=source.pauseVisual.child(121);
      assert(source.pauseVisual.excluded.has(2)&&replayRow?.flashColor===null,'Continued pause keeps replay disabled but visibly gray');
      mask=Keys.PAUSE;continuedResume=true;
    }
    application.update(mask);frames++;tracks.add(application.music.current?.id);
    if(source.session.continues===1&&continuedAt===null)continuedAt=frames;
    if(frames%128===0)yield;
  }
  assert(continuedAt!==null&&events.gameover>=1&&events.miss>=1,'Real road collision and GameOver inputs reach the common Continue restoration');
  assert(continuedPause&&continuedResume&&!source.paused,'The recorded run also opens and resumes the continued pause menu');
  assert(tracks.has('playersScore')&&application.music.current?.id===STAGES[0].bgmStage,'GameOver plays Player\'s Score and Continue returns to the stage BGM');
  assert(source.session.continues===1&&source.session.credits===4,'Continue consumes one of the original five credits');
  assert(source.player.highScore===12345678&&source.session.highScore===12345678,'Continue keeps an existing high score greater than the current run');
  const recorded=source.recorder.toJSON(),expected=source.snapshot();
  assert(recorded.frames===frames,'Recorder preserves every paused GameOver/Continue input frame');
  assert(recorded.checkpoints.some(point=>point.frame>continuedAt),'At least one checkpoint covers simulation after Continue');
  application.storage.settings.startingLives=5;
  application.storage.progress.scores=[{character:0,difficulty:1,mode:'normal',score:99999999}];
  application.storage.progress.spellRecords['0:1']={1:{name:'new records',captures:[5,6],attempts:[7,8]}};
  const progress=JSON.stringify(application.storage.progress),beforeWrites=writes;
  application.playbackSource=recorded;application.core.start(recorded.config);const playing=application.core.game;
  for(let i=0;i<recorded.frames;i++){application.update(0);if(i%128===127)yield;}
  assert(playing.playback.desync===null,'Continued replay verifies every actual public checkpoint');
  assert(stateHash(playing.snapshot())===stateHash(expected),'Public Continue, respawn, stock and road clocks reproduce exactly');
  application.update(0);assert(application.replayFinished,'App signals completion for a replay containing Continue');
  assert(JSON.stringify(application.storage.progress)===progress&&writes===beforeWrites,'Continued replay writes no current progress');
  result={kind:'continuation-replay',frames,continuedAt,events,config:recorded.config,inputRuns:recorded.runs,checkpoints:recorded.checkpoints,
    checkedFinalHash:stateHash(expected),replayFinalHash:stateHash(playing.snapshot()),snapshot:expected,memoryWrites:writes};
}
function* pauseExternalPages(){
  application=make({autostart:true,testing:false,invincible:true});const app=application,game=app.core.game,visited=[];
  tick(app,40);
  for(const [selection,title]of [[3,'游戏说明'],[2,'保存回放']]){
    tap(app,Keys.PAUSE);tick(app,12);assert(game.paused&&game.pauseVisual.phase===6,'Public Pause opens its normal menu');
    for(let i=0;i<selection;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);
    if(selection===2){tick(app,34);tap(app,Keys.UP);tap(app,Keys.SHOOT);}
    tick(app,22);assert(app.page?.title===title,`Pause opens ${title}`);visited.push(title);
    const frozen=game.snapshot();tick(app,12);tap(app,Keys.BOMB);
    assert(app.page===null&&game.paused&&game.pauseVisual.phase===6&&game.pauseVisual.panelVisible,'Closing external page restores its public Pause owner');
    assert(game.frame===frozen.frame,'External page freezes gameplay');
    tap(app,Keys.PAUSE);tick(app,16);assert(!game.paused,'Returned menu resumes gameplay with Esc');
    yield;
  }
  result={kind:'pause-external-pages',frames:app.frame,visited,memoryWrites:writes,snapshot:game.snapshot()};
}
function* pausePageReplay(){
  application=make({autostart:true,testing:false,invincible:true});const app=application,source=app.core.game,visited=[];
  tick(app,100);
  for(const [selection,title]of [[3,'游戏说明'],[2,'保存回放']]){
    tap(app,Keys.PAUSE);tick(app,12);for(let i=0;i<selection;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);
    if(selection===2){tick(app,34);tap(app,Keys.UP);tap(app,Keys.SHOOT);}
    tick(app,22);
    assert(app.page?.title===title,`Recording opens real Pause ${title}`);visited.push(title);
    const recordedBefore=source.recorder.frames;tick(app,40);app.update(Keys.BOMB);
    assert(source.recorder.frames===recordedBefore,'External UI inputs never enter the gameplay input stream');
    assert(source.pauseVisual.phase===6,'External UI closes through the public callback');
    app.update(0);
    tap(app,Keys.PAUSE);tick(app,16);assert(!source.paused,'Recording returns through public Pause resume');yield;
  }
  while(source.recorder.frames<1800){app.update(0);if(source.recorder.frames%128===0)yield;}
  source.saveRun({aborted:true});
  const recorded=source.recorder.toJSON(),expected=source.snapshot(),progress=JSON.stringify(app.storage.progress),beforeWrites=writes;
  app.playbackSource=recorded;app.core.start(recorded.config);const playing=app.core.game;
  for(let i=0;i<recorded.frames;i++){app.update(0);assert(app.page===null,'Replayed external requests cannot leave a live UI page freezing gameplay');if(i%128===127)yield;}
  assert(playing.playback.desync===null&&stateHash(playing.snapshot())===stateHash(expected),'Deferred external-close callbacks reproduce every recorded waiting/restoration frame');
  app.update(0);assert(app.page?.title==='回放结束','Pause/page replay reaches the real App completion page');
  assert(JSON.stringify(app.storage.progress)===progress&&writes===beforeWrites,'Pause/page replay does not mutate progress');
  result={kind:'pause-page-replay',frames:recorded.frames,applicationFrames:app.frame,visited,config:recorded.config,inputRuns:recorded.runs,checkpoints:recorded.checkpoints,
    checkedFinalHash:stateHash(expected),replayFinalHash:stateHash(playing.snapshot()),snapshot:expected,memoryWrites:writes};
}
function* replayControls(){
  application=make({autostart:true,invincible:true});const app=application;
  for(let i=0;i<1200;i++){app.update(i%160<80?Keys.LEFT:Keys.RIGHT);if(i%128===127)yield;}
  const recorded=app.core.game.recorder.toJSON();app.playbackSource=recorded;app.core.start(recorded.config);const game=app.core.game;
  tick(app,100);const position=game.playback.frame;tap(app,Keys.PAUSE);
  assert(app.page&&game.playback.frame===position,'Live Esc opens a replay control page without consuming recorded inputs');
  tick(app,20,Keys.FAST_FORWARD);assert(game.playback.frame===position,'Held Ctrl cannot advance a paused replay');app.update(Keys.SHOOT);
  assert(app.page===null&&game.playback.frame===position,'Z resumes without consuming an extra recorded frame');
  tick(app,1);assert(game.playback.frame===position+1,'Normal replay advances exactly one input per application update');
  const speedPosition=game.playback.frame;tick(app,10,Keys.FOCUS);assert(game.playback.frame===speedPosition+10,'Live Shift does not change replay speed');
  const fastPosition=game.playback.frame;tick(app,10,Keys.FAST_FORWARD);assert(game.playback.frame===fastPosition+80,'Public held Ctrl advances eight complete inputs per update');
  app.update(0);assert(game.playback.frame===fastPosition+81,'Releasing Ctrl immediately restores one input per update');
  while(!app.replayFinished){app.update(0);if(game.playback.frame%128===0)yield;}
  assert(game.playback.desync===null,'Live controls preserve actual replay checkpoints');
  app.replayFinished=false;app.playbackSource=recorded;app.core.start(recorded.config);tick(app,20);tap(app,Keys.PAUSE);tick(app,12);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);
  assert(app.core.mode==='title'&&app.page===null,'Live control menu exits replay to title');
  const damaged=JSON.parse(JSON.stringify(recorded));damaged.checkpoints[0].hash='00000000';app.playbackSource=damaged;app.core.start(damaged.config);
  for(let i=0;i<75;i++){app.update(Keys.FAST_FORWARD);if(i%16===15)yield;}
  assert(app.page?.title==='回放无法继续'&&app.core.game.playback.desync?.frame===600,'A damaged checkpoint stops on a friendly replay result page');
  const stopped=app.core.game.playback.frame;tick(app,15);assert(app.core.game.playback.frame===stopped,'A stopped replay consumes no further input');tap(app,Keys.SHOOT);assert(app.core.mode==='title','Damaged replay can return to title');
  result={kind:'replay-controls',frames:recorded.frames,applicationFrames:app.frame,checkedFrames:recorded.frames,checkpoints:recorded.checkpoints,memoryWrites:writes,snapshot:app.snapshot()};
}
function* replayFastForward(){
  const options={autostart:true,mode:'stage-practice',stageId:1,character:0,difficulty:1,invincible:true,autoCapture:true,autoDialogue:true,autoStageClear:true};
  application=make(options);const app=application,source=app.core.game;let frames=0;
  while(!app.finishedResult&&frames<15000){
    app.update(Keys.SHOOT|(frames%240<120?Keys.LEFT:Keys.RIGHT));
    app.render();frames++;yield;
  }
  assert(app.finishedResult&&frames>1200,'Sample crosses the real road, midboss and final Boss settlements');
  const recorded=source.recorder.toJSON(),expected=source.snapshot(),records=JSON.stringify(source.spell.records),checks=recorded.checkpoints.length;
  assert(checks>=2&&source.director.captures.length===2,'Recorded route includes periodic checks and both first-stage cards');
  const beforeWrites=writes,progress=JSON.stringify(app.storage.progress),runs=[];
  for(const speed of [1,8]){
    app.finishedResult=null;app.replayFinished=false;app.playbackSource=recorded;app.core.start(recorded.config);
    const playing=app.core.game;let calls=0;
    while(!app.replayFinished&&calls<recorded.frames+10){
      app.update(speed===8?Keys.FAST_FORWARD:0);app.render();calls++;
      assert(!app.page,'Replay must not stop on a desync page');yield;
    }
    assert(app.replayFinished&&playing.playback.desync===null,'Both playback speeds reach EOF and pass every checkpoint');
    assert(stateHash(playing.snapshot())===stateHash(expected),'Rendering once per host update cannot change replay state');
    assert(JSON.stringify(playing.spell.records)===records,'Replay preserves recorded spell attempts and captures');
    runs.push({speed,calls,frames:playing.playback.frame,checkedFinalHash:stateHash(playing.snapshot())});
  }
  assert(writes===beforeWrites&&JSON.stringify(app.storage.progress)===progress,'Playback does not write player progress');
  result={kind:'replay-fast-forward',frames,checks,runs,memoryWrites:writes};
}
function* gameOverExternalPages(){
  memory.set('userdata/guiming-settings.json',JSON.stringify({startingLives:0}));
  memory.set('userdata/guiming-progress.json',JSON.stringify({scores:[{character:0,difficulty:1,mode:'normal',score:12345678}]}));
  application=make({autostart:true,testing:false});const app=application,game=app.core.game,visited=[];
  let frames=0,stageTrack=null;while(!(game.paused&&game.pauseVisual instanceof TouhouGameOver&&game.pauseVisual.phase===6)&&frames<3000){if(!game.paused)stageTrack=app.music.current?.id;app.update(0);frames++;if(frames%128===0)yield;}
  assert(game.paused&&game.pauseVisual instanceof TouhouGameOver,'Real road miss opens the public GameOver owner');
  assert(stageTrack===STAGES[0].bgmStage&&app.music.current?.id==='playersScore'&&!app.music.paused,'GameOver interrupts the stage BGM with Player\'s Score');
  for(const [selection,title]of [[3,'游戏说明'],[2,'保存回放']]){
    let steps=0;while(game.pauseVisual.selection!==selection&&steps++<6)tap(app,Keys.DOWN);assert(game.pauseVisual.selection===selection,'GameOver choice remains available');
    tap(app,Keys.SHOOT);tick(app,22);assert(app.page?.title===title,`GameOver opens ${title}`);visited.push(title);
    const position=game.frame;tick(app,12);tap(app,Keys.BOMB);
    assert(app.page===null&&game.pauseVisual.phase===6&&game.pauseVisual.panelVisible,'Closing external utility restores its public GameOver result menu');assert(game.frame===position,'GameOver utility freezes gameplay');
    assert(app.music.current?.id==='playersScore','GameOver utility pages keep Player\'s Score');yield;
  }
  let steps=0;while(game.pauseVisual.selection!==0&&steps++<6)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,16);
  assert(!game.paused&&game.session.continues===1&&game.player.highScore===12345678,'Continue after utility pages restores play and preserves the previous high score');
  assert(app.music.current?.id===stageTrack&&!app.music.paused,'Continue restores the interrupted stage BGM');
  result={kind:'gameover-external-pages',frames:app.frame,visited,music:{stage:stageTrack,gameOver:'playersScore',continued:app.music.current.id},memoryWrites:writes,snapshot:game.snapshot()};
}
function selectReplaySlot(app,slot){
  assert(app.page?.title==='保存回放'&&app.page.rows.length===20,'The save page contains all twenty fixed slots');
  tick(app,12);let moves=0;while(app.page.selection!==slot&&moves++<20)tap(app,Keys.DOWN);
  assert(app.page.selection===slot&&app.page.row.slot===slot,'Direction inputs select the requested stable slot');
}
function pauseChoice(app,selection){
  const game=app.core.game;
  if(!game.paused){tap(app,Keys.PAUSE);tick(app,12);}
  assert(game.pauseVisual.phase===6,'The real pause/result menu is ready for input');
  let moves=0;while(game.pauseVisual.selection!==selection&&moves++<6)tap(app,Keys.DOWN);
  assert(game.pauseVisual.selection===selection,'The requested public pause/result choice is selectable');tap(app,Keys.SHOOT);
  if(!(game.pauseVisual instanceof TouhouGameOver)&&(selection===1||selection===2||selection===5)){
    tick(app,34);assert([7,9].includes(game.pauseVisual.phase),'Pause opens the public Yes/No confirmation');tap(app,Keys.UP);tap(app,Keys.SHOOT);
  }
  tick(app,40);
}
function* manualSave(){
  application=make({autostart:true,testing:false,invincible:true});const app=application;tick(app,40);tap(app,Keys.PAUSE);tick(app,12);
  for(let i=0;i<2;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,34);tap(app,Keys.UP);tap(app,Keys.SHOOT);tick(app,22);
  assert(app.page?.title==='保存回放','Public Pause Save Replay choice opens the manual save page');selectReplaySlot(app,6);tap(app,Keys.SHOOT);
  assert(app.core.mode==='title'&&app.storage.replayCount===1,'Confirmed manual slot save returns to title');
  assert(memory.has('userdata/guiming-replays.json'),'Production save writes only to the fixture userdata adapter');
  const data=JSON.parse(memory.get('userdata/guiming-replays.json'));assert(data.length===20&&data[6].replay.frames>0&&data.filter(Boolean).length===1,'Only slot 07 contains the actual recorder input stream');
  result={kind:'manual-save',slot:7,frames:app.frame,replayFrames:data[6].replay.frames,memoryWrites:writes,snapshot:app.snapshot()};
}
function* replaySlots(){
  const visited=[],syntheticCompletions=[],replayFile='userdata/guiming-replays.json';let frames=0;
  const disk=()=>memory.get(replayFile),unchanged=(before,label)=>assert(disk()===before,label);
  const closeApplication=()=>{frames+=application.frame;application.destroy();application=null;};
  const seedReplay={format:'ts-stg-replay',version:1,config:{game:'guiming',revision:GAME_REVISION,backend:host.backend,character:0,difficulty:1,mode:'normal',stageId:1,spellId:null,seed:210721,startingLives:2,initialSpellRecords:{},spellTimes:[]},frames:20,runs:[[0,20]],checkpoints:[]};
  const initial=Array(20).fill(null);
  for(const slot of [0,6,18])initial[slot]={date:1700000000000+slot,revision:GAME_REVISION,summary:{character:0,difficulty:1,mode:'normal',score:slot+100,stageId:1},replay:seedReplay};
  memory.set(replayFile,JSON.stringify(initial));
  application=make({autostart:true,testing:false,invincible:true});let app=application,game=app.core.game;tick(app,40);
  const originalDisk=disk();pauseChoice(app,2);
  assert(app.storage.replayCount===3&&app.page?.rows.length===20,'Existing data occupies its fixed slots and all empty slots remain visible');
  const frozenFrames=game.recorder.frames;tick(app,24);app.update(Keys.BOMB);
  assert(app.page===null&&game.paused&&game.pauseVisual.phase===6&&game.recorder.frames===frozenFrames,'Cancel returns to the real Pause menu without recording slot-page inputs');
  app.update(0);
  unchanged(originalDisk,'Opening and cancelling slot selection never writes or shifts existing recordings');visited.push('pause-cancel');yield;

  pauseChoice(app,2);selectReplaySlot(app,19);
  const adapter=app.storage.store.adapter,originalWrite=adapter.writeText;let rejected=false;
  adapter.writeText=(name,text)=>{if(name==='guiming-replays.json'&&!rejected){rejected=true;throw new Error('QA replay write rejected');}return originalWrite(name,text);};
  const failedFrames=game.recorder.frames;tap(app,Keys.SHOOT);adapter.writeText=originalWrite;
  assert(rejected&&app.page?.title==='保存回放'&&app.page.message.includes('QA replay write rejected'),'A native storage-adapter write failure remains on the save page with a useful message');
  assert(!game.replaySaved&&!game.savedRun&&!game.pendingReplay,'A failed manual save cannot settle or freeze a still-playable recording');
  unchanged(originalDisk,'Failed save preserves every original slot on disk');
  tap(app,Keys.BOMB);assert(app.page===null&&game.paused,'Failed-save cancellation restores Pause');
  tap(app,Keys.PAUSE);tick(app,16);assert(!game.paused,'The actual run resumes after the failed save');tick(app,70,Keys.RIGHT);
  assert(game.recorder.frames>failedFrames+70,'Recording continues after a cancelled failed save');visited.push('write-failure-resume');yield;

  pauseChoice(app,2);selectReplaySlot(app,6);tap(app,Keys.SHOOT);
  assert(app.page?.title==='覆盖回放？'&&app.page.selection===0,'Occupied-slot confirmation defaults to Cancel');
  tick(app,12);tap(app,Keys.SHOOT);assert(app.page?.title==='保存回放'&&app.page.selection===6,'Default Cancel restores the exact selected slot');
  unchanged(originalDisk,'Default overwrite cancellation leaves every occupied slot intact');
  tap(app,Keys.SHOOT);tick(app,12);tap(app,Keys.BOMB);assert(app.page?.title==='保存回放'&&app.page.selection===6,'X also cancels overwrite and preserves cursor position');
  unchanged(originalDisk,'X overwrite cancellation does not persist');
  tap(app,Keys.SHOOT);tick(app,12);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);
  assert(app.core.mode==='title'&&app.storage.replayCount===3,'Explicit overwrite confirmation saves and exits without creating extra entries');
  const replaced=JSON.parse(disk());
  for(let slot=0;slot<20;slot++)if(slot!==6)assert(JSON.stringify(replaced[slot])===JSON.stringify(initial[slot]),'Overwrite cannot move or change any other numbered slot');
  assert(replaced[6].replay.frames>failedFrames+70&&replaced[6].replay.runs.some(([mask,count])=>mask===Keys.RIGHT&&count>=70),'Retried save includes subsequent gameplay inputs instead of the failed snapshot');
  visited.push('overwrite-cancel','overwrite-confirm','failed-save-retry-current-inputs');closeApplication();yield;

  const beforeExit=disk();application=make({autostart:true,testing:false,invincible:true});app=application;tick(app,40);pauseChoice(app,1);
  assert(app.page?.title==='保存回放'&&app.core.mode==='game','Confirmed exit offers slots before disposing the run');
  unchanged(beforeExit,'Reaching the exit save page never automatically writes');tick(app,12);tap(app,Keys.BOMB);
  assert(app.core.mode==='title'&&app.page===null,'Cancel on final exit discards the pending recording and returns to title');unchanged(beforeExit,'Discarding an exited run leaves all prior replays unchanged');
  visited.push('exit-discard');closeApplication();yield;

  application=make({autostart:true,testing:false,invincible:true});app=application;tick(app,40);pauseChoice(app,1);selectReplaySlot(app,19);tap(app,Keys.SHOOT);
  const last=JSON.parse(disk());assert(app.core.mode==='title'&&app.storage.replayCount===4&&last.length===20&&last[19]?.replay.frames>0,'Slot 20 is reachable and persists the exiting run');
  for(let slot=0;slot<19;slot++)assert(JSON.stringify(last[slot])===JSON.stringify(replaced[slot]),'Saving slot 20 preserves all earlier slots');
  visited.push('exit-save-slot-20');closeApplication();yield;

  memory.set('userdata/guiming-settings.json',JSON.stringify({startingLives:0}));
  application=make({autostart:true,testing:false});app=application;game=app.core.game;const beforeGameOver=disk();let elapsed=0;
  while(!(game.paused&&game.pauseVisual instanceof TouhouGameOver&&game.pauseVisual.phase===6)&&elapsed++<3000){app.update(0);if(elapsed%128===0)yield;}
  assert(game.pauseVisual instanceof TouhouGameOver&&game.pauseVisual.phase===6,'Real road collision reaches the normal GameOver menu');
  unchanged(beforeGameOver,'Normal GameOver never auto-saves a recording');pauseChoice(app,2);selectReplaySlot(app,19);tap(app,Keys.BOMB);
  assert(app.page===null&&game.pauseVisual instanceof TouhouGameOver&&game.pauseVisual.phase===6,'Cancelling GameOver save restores its exact result owner');unchanged(beforeGameOver,'GameOver save cancellation does not write');
  pauseChoice(app,0);assert(game.session.continues===1&&!game.paused&&!game.canSaveReplay,'A real Continue disables recording saves at the scene boundary');
  let blocked=false;try{game.saveReplay(19);}catch(error){blocked=String(error.message).includes('续关');}
  assert(blocked,'Calling the public explicit save API cannot bypass the continued-run restriction');
  tap(app,Keys.PAUSE);tick(app,12);assert(game.pauseVisual.excluded.has(2),'Continued Pause keeps Save Replay disabled');
  pauseChoice(app,1);assert(app.core.mode==='title'&&app.page===null,'Exiting a continued run bypasses slot selection');unchanged(beforeGameOver,'Continued exit and destruction do not write or overwrite recordings');
  visited.push('gameover-cancel','continue-save-rejected','continued-exit');closeApplication();yield;

  memory.set('userdata/guiming-settings.json',JSON.stringify({startingLives:2}));
  application=make({autostart:true,testing:false,invincible:true,autoCapture:true,autoDialogue:true,mode:'spell-practice',stageId:1,spellId:ALL_SPELLS[0].id});app=application;game=app.core.game;const beforeClear=disk();elapsed=0;
  while(!app.page&&elapsed++<6000){app.update(0);if(elapsed%128===0)yield;}
  assert(app.page?.title==='练习结果'&&game.finishedResult&&game.pendingReplay?.replay.frames>0,'Actual spell completion freezes an available recording for its result page');
  unchanged(beforeClear,'Completing a card settles progress without auto-saving a replay');
  const resultPage=app.page;tick(app,12);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);selectReplaySlot(app,19);tap(app,Keys.BOMB);
  assert(app.page===resultPage,'Cancelling a completed-practice save restores its result page');unchanged(beforeClear,'Result-page cancellation preserves existing recordings');
  tick(app,12);tap(app,Keys.BOMB);assert(app.page?.title==='保存回放','Leaving a completed run still offers explicit slot selection');tick(app,12);tap(app,Keys.BOMB);
  assert(app.core.mode==='title','Completed run can be discarded without an implicit save');unchanged(beforeClear,'Discarding completed results performs no replay write');
  visited.push('actual-clear-no-auto-save','practice-result-cancel','completed-discard');closeApplication();yield;

  // These two cases inject settlement, not a completed six-stage route. They
  // exercise only the production Ending/Staff/result/save UI with real input.
  for(const continues of [0,1]){
    application=make({autostart:true,testing:false,invincible:true});app=application;game=app.core.game;tick(app,40);
    game.session.continues=continues;game.player.continues=continues;
    const beforeEnding=disk(),completed={ending:continues?'bad':'good',character:0,difficulty:1,mode:'normal',score:game.player.score,continues,stageId:6,captures:[]};
    game.completeCampaign(completed);game.dispatchCompletion();
    assert(app.page?.phase==='ending'&&game.finishedResult?.stageId===6,'Synthetic settlement opens the production Ending page');
    unchanged(beforeEnding,'Entering a completed-route Ending page never auto-saves replay data');
    const recordedFrames=game.recorder.frames;let lines=0;
    while(app.page?.phase==='ending'&&lines++<20){tick(app,61);tap(app,Keys.SHOOT);}
    assert(app.page?.phase==='staff','Real confirm inputs advance each Ending line to Staff');
    tick(app,92);tap(app,Keys.SHOOT);assert(app.page?.phase==='result','Real confirm input advances Staff to the results page');
    unchanged(beforeEnding,'Ending and Staff transitions do not persist replay data');
    assert(game.recorder.frames===recordedFrames,'Ending and Staff inputs never enter the finished recording');
    tick(app,42);tap(app,Keys.SHOOT);
    if(continues){
      assert(app.core.mode==='title'&&app.page===null,'A continued ending returns directly to title without slot selection');
      unchanged(beforeEnding,'A continued ending cannot persist a replay');visited.push('synthetic-continued-ending-no-save');
    }else{
      assert(app.page?.title==='保存回放'&&app.core.mode==='game','A no-continue result offers slots while keeping its finished recording');
      unchanged(beforeEnding,'The result-to-slot transition never saves before confirmation');
      assert(game.pendingReplay?.replay.frames===recordedFrames,'The slot page uses the frozen completed recording');
      const pending=JSON.stringify(game.pendingReplay.replay);selectReplaySlot(app,15);assert(app.page.row.empty,'Synthetic ending uses a known empty slot');tap(app,Keys.SHOOT);
      const saved=app.storage.replays[15];
      assert(app.core.mode==='title'&&saved&&JSON.stringify(saved.replay)===pending,'Slot confirmation persists the full pending recording and returns to title');
      assert(saved.summary.ending==='good'&&saved.summary.stageId===6&&saved.summary.mode==='normal'&&saved.summary.continues===0,'Saving from results preserves completed-route summary metadata');
      const before=JSON.parse(beforeEnding),after=JSON.parse(disk());
      for(let slot=0;slot<20;slot++)if(slot!==15)assert(JSON.stringify(after[slot])===JSON.stringify(before[slot]),'Ending save does not change any other slot');
      visited.push('synthetic-ending-staff-result-slot-save');
    }
    syntheticCompletions.push({continues,ending:completed.ending,stageId:6,recordedFrames,endingLines:lines,applicationFrames:app.frame,savedSlot:continues?null:16});
    closeApplication();yield;
  }

  const metadataSlots=JSON.parse(disk());metadataSlots[18]={revision:GAME_REVISION,replay:{...seedReplay,config:{...seedReplay.config,character:1,mode:'spell-practice',stageId:3}}};memory.set(replayFile,JSON.stringify(metadataSlots));
  const beforeMetadata=disk();application=make({testing:false,page:'replays'});app=application;const entryBefore=JSON.stringify(app.storage.replays[18]);
  tick(app,12);for(let i=0;i<18;i++)tap(app,Keys.DOWN);
  const metadataRow=app.page.row,metadataDetail=app.page.detail(metadataRow,app.page);
  assert(metadataRow.slot===18&&metadataRow.label.includes('魔理沙')&&metadataDetail.includes('符卡练习')&&metadataDetail.includes('关卡 3')&&metadataDetail.includes('日期未知'),'A legacy entry without summary/date uses its recorded character, mode and stage and shows an unknown date');
  assert(JSON.stringify(app.storage.replays[18])===entryBefore,'Displaying legacy metadata never mutates its loaded recording');unchanged(beforeMetadata,'Viewing missing legacy metadata never rewrites the persisted slots');
  visited.push('legacy-metadata-read-only');closeApplication();
  result={kind:'replay-slots',frames,visited,slotCount:20,recordings:JSON.parse(disk()).filter(Boolean).length,failedSaveFrame:failedFrames,retrySavedFrames:replaced[6].replay.frames,
    syntheticCompletions,syntheticCompletionScope:'Synthetic settlement tests Ending/Staff/result/slot UI only; it is not a full six-stage clear or a replay of a synthesized clear.',memoryWrites:writes};
}
function* replayTermination(){
  const ended=[];
  for(const [choice,action]of [[5,'restart'],[1,'exit']]){
    memory.clear();application=make({autostart:true,testing:false,invincible:true});const app=application,source=app.core.game;
    for(let i=0;i<620;i++){app.update(0);if(i%128===127)yield;}
    tap(app,Keys.PAUSE);tick(app,12);assert(source.paused&&source.pauseVisual.phase===6,'Termination is chosen through the real public Pause menu');
    for(let i=0;source.pauseVisual.selection!==choice&&i<6;i++)tap(app,Keys.DOWN);assert(source.pauseVisual.selection===choice,`Pause selects ${action}`);tap(app,Keys.SHOOT);tick(app,34);
    assert(source.pauseVisual.phase===7&&source.pauseVisual.count===2,'Public termination opens its Yes/No confirmation');tap(app,Keys.UP);tap(app,Keys.SHOOT);
    let tail=0;while(app.core.game===source&&!app.page&&tail++<80)app.update(0);
    assert(app.storage.replayCount===0&&!memory.has('userdata/guiming-replays.json'),'Exit and restart never write a replay automatically');
    let recorded;
    if(action==='exit'){
      assert(!source.destroyed&&app.page?.title==='保存回放','Confirmed exit keeps the source run alive until slot selection');
      selectReplaySlot(app,4);tap(app,Keys.SHOOT);recorded=app.storage.replays[4]?.replay;
    }else{
      recorded=source.pendingReplay?.replay??source.recorder.toJSON();
      // This setup intentionally archives a legacy restart-terminated stream
      // for playback compatibility; live restart itself must never save it.
      app.storage.saveReplay(4,recorded,{character:0,difficulty:1,mode:'normal',aborted:true});
    }
    assert(source.destroyed&&app.core.game!==source,`Recorded ${action} performs its live scene transition`);
    assert(action==='restart'?app.core.mode==='game'&&!!app.core.game.recorder:app.core.mode==='title',`Live ${action} keeps its actual application behavior`);
    assert(recorded?.frames>620&&recorded.checkpoints.some(point=>point.frame===600),'Real saved replay retains Pause confirmation inputs and a prior simulation checkpoint');
    // Match the real replay selector: settle any just-created live restart
    // before measuring read-only playback, then enter the replay scene.
    app.core.game?.saveRun({aborted:true});
    const progress=JSON.stringify(app.storage.progress),beforeWrites=writes,beforePlays=app.storage.progress.plays,beforeReplays=app.storage.replayCount;
    app.page=null;app.playbackSource=recorded;app.core.start(recorded.config);const playing=app.core.game;
    assert(!playing.recorder&&playing.playback,'Actual playback has no new recorder');
    for(let i=0;i<recorded.frames;i++){
      app.update(0);assert(app.core.game===playing&&!playing.destroyed&&!playing.recorder,`Recorded ${action} cannot launch a live run or leave the replay scene`);
      assert(playing.playback.frame===i+1,`Recorded ${action} consumes each saved input exactly once`);if(i%128===127)yield;
    }
    assert(playing.playback.finished&&playing.playback.desync===null,`Recorded ${action} reaches the end of its full verified input stream`);
    app.update(0);assert(app.page?.title==='回放结束'&&app.page.rows[0].label==='返回标题'&&app.page.detail(app.page.row,app.page)==='回放播放完毕。','Production playback displays completion and the return action without internal verification details');
    const stopped=playing.playback.frame;tick(app,12);assert(playing.playback.frame===stopped&&app.core.game===playing,'Completion page freezes the finished replay');
    assert(writes===beforeWrites&&app.storage.progress.plays===beforePlays&&app.storage.replayCount===beforeReplays&&JSON.stringify(app.storage.progress)===progress,'Playback termination creates no play, replay or progress writes');
    ended.push({action,frames:recorded.frames,playedFrames:playing.playback.frame,checkpoints:recorded.checkpoints,plays:beforePlays,replayCount:beforeReplays,writesDuringPlayback:writes-beforeWrites,completion:app.page.title,snapshot:playing.snapshot()});
    tick(app,12);tap(app,Keys.BOMB);assert(app.core.mode==='title'&&writes===beforeWrites,'Completed replay returns to title without saving a new run');app.destroy();application=null;yield;
  }
  result={kind:'replay-termination',frames:ended.reduce((sum,value)=>sum+value.frames,0),ended,memoryWrites:writes};
}
function* ui(){
  application=make({unlockAll:true});const app=application,visited=[];
  // Yield between real UI journeys. Thousands of simulated frames in one
  // host callback would trip QuickJS's per-call watchdog despite valid input.
  function menuReady(){tick(app,140);assert(app.core.menu.state==='main'&&app.core.menu.phase===2,'Title menu ready');}
  function main(index){menuReady();for(let i=0;i<index;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,23);}
  function close(){tick(app,12);tap(app,Keys.BOMB);assert(app.page===null,'X returns from page');}
  function startNormal(label){
    main(0);assert(app.core.menu.state==='difficulty'&&app.core.menu.difficulty>=0&&app.core.menu.difficulty<=3,`${label}: Normal restores four-difficulty selection`);
    tick(app,10);tap(app,Keys.SHOOT);tick(app,16);assert(app.core.menu.state==='character',`${label}: Normal reaches character selection`);
    tick(app,10);tap(app,Keys.SHOOT);tick(app,100);const config=app.core.game.config;
    assert(app.core.mode==='game'&&config.mode==='normal'&&config.stageId===1&&config.spellId===null&&config.difficulty<=3&&app.core.game.currentStage.id===1,`${label}: Actual normal game begins at stage one without an old practice/Extra selection`);
    assert(config.seed===210721,`${label}: New run restores the explicit application seed`);visited.push(label);app.leaveGame();
  }
  main(0);assert(app.core.menu.state==='difficulty','Title Z enters difficulty');visited.push('title','difficulty');
  tick(app,10);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,16);assert(app.core.menu.state==='character','Difficulty Z enters character');visited.push('character');
  tick(app,10);tap(app,Keys.RIGHT);assert(app.core.menu.selection===1,'Character input selects Marisa');
  tap(app,Keys.SHOOT);tick(app,100);assert(app.core.mode==='game'&&app.core.game.config.character===1&&app.core.game.config.difficulty===2,'Input selection launches chosen self and difficulty through public scene transition');visited.push('title-game-transition');app.leaveGame();yield;
  main(1);assert(app.core.menu.state==='character'&&app.core.menu.difficulty===4,'Extra enters its fixed-difficulty character selector');tick(app,10);tap(app,Keys.BOMB);tick(app,12);
  assert(app.core.menu.state==='main'&&Object.keys(app.extraSelection).length===0,'Cancelled Extra returns to a clean main menu');startNormal('normal-after-extra-cancel');yield;
  main(2);assert(app.page?.rows.length===6,'Stage practice has six stages');visited.push('stage-practice');tick(app,10);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.core.menu.state==='difficulty'&&app.extraSelection.stageId===2,'Stage choice reaches shared selectors');
  tick(app,10);tap(app,Keys.BOMB);tick(app,10);assert(Object.keys(app.extraSelection).length===0,'Cancelled stage practice clears its business selection');startNormal('normal-after-stage-practice-cancel');yield;
  const extraMidboss=ALL_SPELLS.findIndex(card=>card.id==='ex-mid-01');
  main(3);assert(app.page?.rows.length===39,'Practice contains all 39 main and midboss cards');visited.push('spell-practice');tick(app,10);for(let i=0;i<extraMidboss;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.core.menu.state==='character'&&app.extraSelection.stageId===7,'Extra midboss card reaches character selector');
  tick(app,10);tap(app,Keys.BOMB);tick(app,12);assert(app.core.menu.state==='main','Extra character cancellation returns to title');
  assert(Object.keys(app.extraSelection).length===0,'Cancelled Extra card clears its business selection');startNormal('normal-after-extra-card-cancel');yield;
  main(3);tick(app,10);for(let i=0;i<extraMidboss;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,10);tap(app,Keys.SHOOT);tick(app,100);
  assert(app.core.mode==='game'&&app.core.game.config.spellId===ALL_SPELLS[extraMidboss].id&&app.core.game.difficulty===4,'Extra midboss practice launches through public transition with difficulty four');visited.push('midboss-spell-practice-game');app.leaveGame();
  yield;startNormal('normal-after-extra-card-game');yield;
  main(2);tick(app,10);for(let i=0;i<2;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,10);tap(app,Keys.SHOOT);tick(app,16);tick(app,10);tap(app,Keys.SHOOT);tick(app,100);
  assert(app.core.mode==='game'&&app.core.game.config.mode==='stage-practice'&&app.core.game.config.stageId===3,'Actual stage practice begins at selected stage');visited.push('stage-practice-game');app.leaveGame();yield;startNormal('normal-after-stage-practice-game');yield;
  main(1);tick(app,10);tap(app,Keys.SHOOT);tick(app,100);
  assert(app.core.mode==='game'&&app.core.game.config.mode==='extra'&&app.core.game.config.stageId===7&&app.core.game.config.spellId===null&&app.core.game.currentStage.id===7,'Actual Extra begins at stage seven without an old card selection');visited.push('extra-game-after-practice');app.leaveGame();yield;startNormal('normal-after-extra-game');yield;
  for(const [index,name] of [[5,'records'],[6,'music'],[7,'options'],[8,'manual'],[4,'replay']]){
    main(index);assert(app.page,`${name} opens through title input`);visited.push(name);tick(app,12);
    if(name==='records'){
      app.storage.progress.spellRecords['0:1']={1:{captures:[2,3],attempts:[4,5]}};
      tap(app,Keys.SHOOT);assert(app.page?.rows.length===5,'Records open four difficulties and Extra');tick(app,12);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);
      assert(app.page?.rows.length===26,'Normal records list every main and midboss card');const detail=app.page.detail(app.page.row);assert(detail.includes('2 / 4')&&detail.includes('3 / 5'),'Records display the selected character/difficulty real and practice counters');visited.push('spell-records-main');
      tick(app,12);tap(app,Keys.BOMB);tick(app,12);for(let i=0;i<4;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.page?.rows.length===13,'Extra records contain ten final Boss and three midboss cards');visited.push('spell-records-extra');
      tick(app,12);tap(app,Keys.BOMB);tick(app,12);tap(app,Keys.BOMB);assert(app.page?.title==='玩家记录','Nested record pages return to the player record page');
    }
    if(name==='music'){tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.music.current.id===app.page.row.track.id,'Music selection loads requested authored BGM');assert(typeof app.page.detail(app.page.row)==='string','Music comment is text');}
    if(name==='options'){const previous=app.storage.settings.musicVolume;tap(app,Keys.RIGHT);assert(app.storage.settings.musicVolume===previous+5,'Option input changes settings');assert(memory.has('userdata/guiming-settings.json'),'Settings are saved only in QA memory');}
    if(name==='manual'){tap(app,Keys.RIGHT);assert(app.page.index===1,'Manual turns pages');tap(app,Keys.LEFT);assert(app.page.index===0,'Manual returns a page');}
    close();yield;
  }
  // Populate a valid recorded fixture, then choose it through the Replay page.
  const sample={format:'ts-stg-replay',version:1,config:{game:'guiming',revision:GAME_REVISION,backend:host.backend,character:0,difficulty:1,mode:'spell-practice',stageId:1,spellId:ALL_SPELLS[0].id,seed:210721,startingLives:2,initialSpellRecords:{},spellTimes:[]},frames:20,runs:[[0,20]],checkpoints:[]};
  app.storage.replays[0]={date:1700000000000,revision:GAME_REVISION,summary:{character:0,difficulty:1,score:0},replay:sample};
  main(4);tick(app,12);tap(app,Keys.SHOOT);assert(app.playbackSource===sample,'Replay selection passes real recorder format into application');tick(app,100);assert(app.replayFinished,'Selected replay completes after the shared scene transition');visited.push('replay-playback');
  result={kind:'ui',visited,frames:app.frame,memoryWrites:writes,snapshot:app.snapshot()};
}
const runners={campaign,replay,'continuation-replay':continuationReplay,ui,'pause-external-pages':pauseExternalPages,'pause-page-replay':pausePageReplay,'replay-controls':replayControls,'replay-fast-forward':replayFastForward,'gameover-external-pages':gameOverExternalPages,'manual-save':manualSave,'replay-slots':replaySlots,'replay-termination':replayTermination};
const runner=runners[scenario.kind]?.()??null;
let started=null;
return{
  update(){if(result)return;const first=started===null;started??=Date.now();try{
    if(first){const path=`integration/native-roundtrip-${native.backend}.json`,value=JSON.stringify({game:'touhou21',backend:native.backend,fixture:'native-path-roundtrip'});native.writeText(path,value);assert(native.readText(`userdata/${path}`)===value,'Actual native writeText/readText path semantics round-trip');}
    if(!runner)throw new Error('Unknown QA scenario');const status=runner.next();if(status.done){result.passed=true;result.sceneUpdateCalls=sceneUpdateCalls;result.applicationUpdateCalls=applicationUpdateCalls;result.nativeUserDataRoundTrip=true;result.elapsedMs=Date.now()-started;application?.destroy();}
  }catch(error){result={passed:false,kind:scenario.kind,error:error.stack??String(error),snapshot:application?.snapshot()??null,elapsedMs:Date.now()-started,memoryWrites:writes};application?.destroy();}},
  render:()=>[],snapshot:()=>result??{passed:false,error:'Fixture did not update'},
};
}
