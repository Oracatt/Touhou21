import {Keys,stateHash} from '@ts-stg/thlib';
import {TouhouGame,TouhouPlayer,TouhouBulletField,TouhouLaserField,TouhouSpell,TouhouEnemy,TouhouHealth,TouhouItems,TouhouBossPresentation,TouhouBossHud,TouhouGameOver} from '@ts-stg/thlib/touhou';
import {ProjectApplication} from '../src/application.js';
import {STAGES,ALL_SPELLS} from '../src/content.js';
import {GAME_REVISION} from '../src/storage.js';

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
    if(frames%128===0)yield;
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
  application=make({autostart:true,invincible:true});const app=application,game=app.core.game,visited=[];
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
  application=make({autostart:true,invincible:true});const app=application,source=app.core.game,visited=[];
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
  const recorded=source.recorder.toJSON(),expected=source.snapshot(),progress=JSON.stringify(app.storage.progress),beforeWrites=writes;
  app.playbackSource=recorded;app.core.start(recorded.config);const playing=app.core.game;
  for(let i=0;i<recorded.frames;i++){app.update(0);assert(app.page===null,'Replayed external requests cannot leave a live UI page freezing gameplay');if(i%128===127)yield;}
  assert(playing.playback.desync===null&&stateHash(playing.snapshot())===stateHash(expected),'Deferred external-close callbacks reproduce every recorded waiting/restoration frame');
  app.update(0);assert(app.replayFinished,'Pause/page replay reaches App completion');
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
  tick(app,20);assert(game.playback.frame===position,'Replay control page freezes the recorded stream');app.update(Keys.SHOOT);
  assert(app.page===null&&game.playback.frame===position,'Z resumes without consuming an extra recorded frame');
  tick(app,1);assert(game.playback.frame===position+1,'Normal replay advances exactly one input per application update');
  const speedPosition=game.playback.frame;tick(app,10,Keys.FOCUS);assert(game.playback.frame===speedPosition+20,'Live Shift advances two recorded inputs per update');
  while(!app.replayFinished){app.update(0);if(game.playback.frame%128===0)yield;}
  assert(game.playback.desync===null,'Live controls preserve actual replay checkpoints');
  app.replayFinished=false;app.playbackSource=recorded;app.core.start(recorded.config);tick(app,20);tap(app,Keys.PAUSE);tick(app,12);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);
  assert(app.core.mode==='title'&&app.page===null,'Live control menu exits replay to title');
  const damaged=JSON.parse(JSON.stringify(recorded));damaged.checkpoints[0].hash='00000000';app.playbackSource=damaged;app.core.start(damaged.config);
  for(let i=0;i<600;i++){app.update(0);if(i%128===127)yield;}
  assert(app.page?.title==='回放无法继续'&&app.core.game.playback.desync?.frame===600,'A damaged checkpoint stops on a friendly replay result page');
  const stopped=app.core.game.playback.frame;tick(app,15);assert(app.core.game.playback.frame===stopped,'A stopped replay consumes no further input');tap(app,Keys.SHOOT);assert(app.core.mode==='title','Damaged replay can return to title');
  result={kind:'replay-controls',frames:recorded.frames,applicationFrames:app.frame,checkedFrames:recorded.frames,checkpoints:recorded.checkpoints,memoryWrites:writes,snapshot:app.snapshot()};
}
function* gameOverExternalPages(){
  memory.set('userdata/guiming-settings.json',JSON.stringify({startingLives:0}));
  memory.set('userdata/guiming-progress.json',JSON.stringify({scores:[{character:0,difficulty:1,mode:'normal',score:12345678}]}));
  application=make({autostart:true});const app=application,game=app.core.game,visited=[];
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
function* manualSave(){
  memory.set('userdata/guiming-settings.json',JSON.stringify({autoSaveReplay:false}));
  application=make({autostart:true,testing:false,invincible:true});const app=application;tick(app,40);tap(app,Keys.PAUSE);tick(app,12);
  for(let i=0;i<2;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,34);tap(app,Keys.UP);tap(app,Keys.SHOOT);tick(app,22);
  assert(app.page?.title==='保存回放','Public Pause Save Replay choice opens the manual save page');tick(app,12);tap(app,Keys.SHOOT);
  assert(app.core.mode==='title'&&app.storage.replays.length===1,'Manual force save exits to title even when automatic saving is disabled');
  assert(memory.has('userdata/guiming-replays.json'),'Production save writes only to the fixture userdata adapter');
  const data=JSON.parse(memory.get('userdata/guiming-replays.json'));assert(data.length===1&&data[0].replay.frames>0,'Saved replay includes the actual recorder input stream');
  result={kind:'manual-save',frames:app.frame,replayFrames:data[0].replay.frames,memoryWrites:writes,snapshot:app.snapshot()};
}
function* replayTermination(){
  const ended=[];
  for(const [choice,action]of [[5,'restart'],[1,'exit']]){
    memory.clear();application=make({autostart:true,testing:false,invincible:true});const app=application,source=app.core.game;
    for(let i=0;i<620;i++){app.update(0);if(i%128===127)yield;}
    tap(app,Keys.PAUSE);tick(app,12);assert(source.paused&&source.pauseVisual.phase===6,'Termination is chosen through the real public Pause menu');
    for(let i=0;source.pauseVisual.selection!==choice&&i<6;i++)tap(app,Keys.DOWN);assert(source.pauseVisual.selection===choice,`Pause selects ${action}`);tap(app,Keys.SHOOT);tick(app,34);
    assert(source.pauseVisual.phase===7&&source.pauseVisual.count===2,'Public termination opens its Yes/No confirmation');tap(app,Keys.UP);tap(app,Keys.SHOOT);
    let tail=0;while(app.core.game===source&&tail++<80)app.update(0);
    assert(source.destroyed&&app.core.game!==source,`Recorded ${action} performs its live scene transition`);
    assert(action==='restart'?app.core.mode==='game'&&!!app.core.game.recorder:app.core.mode==='title',`Live ${action} keeps its actual application behavior`);
    const recorded=app.storage.replays[0]?.replay;
    assert(recorded?.frames>620&&recorded.checkpoints.some(point=>point.frame===600),'Real saved replay retains Pause confirmation inputs and a prior simulation checkpoint');
    // Match the real replay selector: settle any just-created live restart
    // before measuring read-only playback, then enter the replay scene.
    app.core.game?.saveRun({aborted:true});
    const progress=JSON.stringify(app.storage.progress),beforeWrites=writes,beforePlays=app.storage.progress.plays,beforeReplays=app.storage.replays.length;
    app.page=null;app.playbackSource=recorded;app.core.start(recorded.config);const playing=app.core.game;
    assert(!playing.recorder&&playing.playback,'Actual playback has no new recorder');
    for(let i=0;i<recorded.frames;i++){
      app.update(0);assert(app.core.game===playing&&!playing.destroyed&&!playing.recorder,`Recorded ${action} cannot launch a live run or leave the replay scene`);
      assert(playing.playback.frame===i+1,`Recorded ${action} consumes each saved input exactly once`);if(i%128===127)yield;
    }
    assert(playing.playback.finished&&playing.playback.desync===null,`Recorded ${action} reaches the end of its full verified input stream`);
    app.update(0);assert(app.page?.title==='回放结束'&&app.page.rows[0].label.includes('校验通过'),'Production playback displays the normal successful replay completion page');
    const stopped=playing.playback.frame;tick(app,12);assert(playing.playback.frame===stopped&&app.core.game===playing,'Completion page freezes the finished replay');
    assert(writes===beforeWrites&&app.storage.progress.plays===beforePlays&&app.storage.replays.length===beforeReplays&&JSON.stringify(app.storage.progress)===progress,'Playback termination creates no play, replay or progress writes');
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
  app.storage.replays=[{revision:GAME_REVISION,summary:{character:0,difficulty:1,score:0},replay:sample}];
  main(4);tick(app,12);tap(app,Keys.SHOOT);assert(app.playbackSource===sample,'Replay selection passes real recorder format into application');tick(app,100);assert(app.replayFinished,'Selected replay completes after the shared scene transition');visited.push('replay-playback');
  result={kind:'ui',visited,frames:app.frame,memoryWrites:writes,snapshot:app.snapshot()};
}
const runners={campaign,replay,'continuation-replay':continuationReplay,ui,'pause-external-pages':pauseExternalPages,'pause-page-replay':pausePageReplay,'replay-controls':replayControls,'gameover-external-pages':gameOverExternalPages,'manual-save':manualSave,'replay-termination':replayTermination};
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
