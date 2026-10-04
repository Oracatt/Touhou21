import {Keys,stateHash} from '@ts-stg/thlib';
import {TouhouGame,TouhouPlayer,TouhouBulletField,TouhouLaserField,TouhouSpell,TouhouEnemy,TouhouHealth,TouhouItems,TouhouBossPresentation,TouhouBossHud,TouhouGameOver} from '@ts-stg/thlib/touhou';
import {ProjectApplication} from '../src/application.js';
import {STAGES,ALL_SPELLS} from '../src/content.js';
import {GAME_REVISION} from '../src/storage.js';

// Dedicated native headless QA entry. It never reads or writes real userdata.
// Real resources, native hosts and every public gameplay owner stay in use.
export function createIntegrationFixture(scenarioPath){
const native=globalThis.tsstg;
const scenario=JSON.parse(native.readText(scenarioPath));
const memory=new Map();let writes=0;
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
const make=options=>new ProjectApplication(host,{testing:true,fixedClock:true,seed:210721,...options});
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
  const count=options.mode==='extra'?13:options.mode==='stage-practice'?STAGES[options.stageId-1].spells.length:21;
  assert(game.director.captures.length===count,`Expected ${count} card settlements`);
  assert(writes===0,'QA route must not persist records or replays');
  result={kind:'campaign',frames,visited,roadMax,states,peak,identity,bodies,rendered,events:game.director.events,finished:application.finishedResult,snapshot:application.snapshot(),memoryWrites:writes};
}
function* replay(){
  application=make({autostart:true,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id,difficulty:1,character:0});
  const source=application.core.game;source.player.lives=5;source.recorder.config.startingLives=5;
  const events={hit:0,miss:0,bomb:0,pausedFrames:0,spellFinish:0},event=source.onEvent;
  source.onEvent=(name,data)=>{if(name in events)events[name]++;event?.(name,data);};
  let frames=0;
  while(!application.finishedResult&&frames<6000){
    let mask=frames>=600?Keys.RIGHT:0;
    if(frames===400||frames===440)mask=Keys.PAUSE;
    if(frames===1250)mask|=Keys.BOMB;
    application.update(mask);if(source.paused)events.pausedFrames++;frames++;
    assert(!source.pendingGameOver,'Replay sample retains enough stock to cross a natural card settlement');
    if(frames%128===0)yield;
  }
  assert(application.finishedResult,'Real public timer/damage must finish the card');
  assert(events.bomb>0,'Recorded X input must trigger a real public Bomb');
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
  result={kind:'replay',frames,events,config:recorded.config,inputRuns:recorded.runs,checkpoints:recorded.checkpoints,
    checkedFinalHash:stateHash(expected),replayFinalHash:stateHash(playing.snapshot()),finished:source.finishedResult,identity:owners(playing),memoryWrites:writes};
}
function* continuationReplay(){
  // Fixture-only low stock makes the first real road collision reach GameOver.
  memory.set('userdata/guiming-settings.json',JSON.stringify({startingLives:0}));
  application=make({autostart:true,mode:'normal',difficulty:1,character:0});
  const source=application.core.game,events={miss:0,gameover:0},event=source.onEvent;
  source.onEvent=(name,data)=>{if(name in events)events[name]++;event?.(name,data);};
  let frames=0,continuedAt=null;
  while(frames<5000&&(continuedAt===null||frames<continuedAt+750)){
    let mask=continuedAt===null?0:Keys.RIGHT;
    if(source.paused&&source.pauseVisual instanceof TouhouGameOver&&source.pauseVisual.phase===6)mask=Keys.SHOOT;
    application.update(mask);frames++;
    if(source.session.continues===1&&continuedAt===null)continuedAt=frames;
    if(frames%128===0)yield;
  }
  assert(continuedAt!==null&&events.gameover>=1&&events.miss>=1,'Real road collision and GameOver inputs reach the common Continue restoration');
  assert(source.session.continues===1&&source.session.credits===4,'Continue consumes one of the original five credits');
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
function* ui(){
  application=make({unlockAll:true});const app=application,visited=[];
  function menuReady(){tick(app,140);assert(app.core.menu.state==='main'&&app.core.menu.phase===2,'Title menu ready');}
  function main(index){menuReady();for(let i=0;i<index;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,23);}
  function close(){tick(app,12);tap(app,Keys.BOMB);assert(app.page===null,'X returns from page');}
  main(0);assert(app.core.menu.state==='difficulty','Title Z enters difficulty');visited.push('title','difficulty');
  tick(app,10);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,16);assert(app.core.menu.state==='character','Difficulty Z enters character');visited.push('character');
  tick(app,10);tap(app,Keys.RIGHT);assert(app.core.menu.selection===1,'Character input selects Marisa');
  tap(app,Keys.SHOOT);tick(app,100);assert(app.core.mode==='game'&&app.core.game.config.character===1&&app.core.game.config.difficulty===2,'Input selection launches chosen self and difficulty through public scene transition');visited.push('title-game-transition');app.leaveGame();
  main(2);assert(app.page?.rows.length===6,'Stage practice has six stages');visited.push('stage-practice');tick(app,10);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.core.menu.state==='difficulty'&&app.extraSelection.stageId===2,'Stage choice reaches shared selectors');
  tick(app,10);tap(app,Keys.BOMB);tick(app,10);
  main(3);assert(app.page?.rows.length===34,'Practice contains all 34 main and midboss cards');visited.push('spell-practice');tick(app,10);for(let i=0;i<31;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.core.menu.state==='character'&&app.extraSelection.stageId===7,'Extra midboss card reaches character selector');
  tick(app,10);tap(app,Keys.BOMB);tick(app,12);assert(app.core.menu.state==='main','Extra character cancellation returns to title');
  main(3);tick(app,10);for(let i=0;i<31;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);tick(app,10);tap(app,Keys.SHOOT);tick(app,100);
  assert(app.core.mode==='game'&&app.core.game.config.spellId===ALL_SPELLS[31].id&&app.core.game.difficulty===4,'Extra midboss practice launches through public transition with difficulty four');visited.push('midboss-spell-practice-game');app.leaveGame();
  for(const [index,name] of [[5,'records'],[6,'music'],[7,'options'],[8,'manual'],[4,'replay']]){
    main(index);assert(app.page,`${name} opens through title input`);visited.push(name);tick(app,12);
    if(name==='records'){
      app.storage.progress.spellRecords['0:1']={1:{captures:[2,3],attempts:[4,5]}};
      tap(app,Keys.SHOOT);assert(app.page?.rows.length===5,'Records open four difficulties and Extra');tick(app,12);tap(app,Keys.DOWN);tap(app,Keys.SHOOT);
      assert(app.page?.rows.length===21,'Normal records list every main card');const detail=app.page.detail(app.page.row);assert(detail.includes('2 / 4')&&detail.includes('3 / 5'),'Records display the selected character/difficulty real and practice counters');visited.push('spell-records-main');
      tick(app,12);tap(app,Keys.BOMB);tick(app,12);for(let i=0;i<4;i++)tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.page?.rows.length===13,'Extra records contain ten final Boss and three midboss cards');visited.push('spell-records-extra');
      tick(app,12);tap(app,Keys.BOMB);tick(app,12);tap(app,Keys.BOMB);assert(app.page?.title==='玩家记录','Nested record pages return to the player record page');
    }
    if(name==='music'){tap(app,Keys.DOWN);tap(app,Keys.SHOOT);assert(app.music.current.id===app.page.row.track.id,'Music selection loads requested authored BGM');assert(typeof app.page.detail(app.page.row)==='string','Music comment is text');}
    if(name==='options'){const previous=app.storage.settings.musicVolume;tap(app,Keys.RIGHT);assert(app.storage.settings.musicVolume===previous+5,'Option input changes settings');assert(memory.has('userdata/guiming-settings.json'),'Settings are saved only in QA memory');}
    if(name==='manual'){tap(app,Keys.RIGHT);assert(app.page.index===1,'Manual turns pages');tap(app,Keys.LEFT);assert(app.page.index===0,'Manual returns a page');}
    close();
  }
  // Populate a valid recorded fixture, then choose it through the Replay page.
  const sample={format:'ts-stg-replay',version:1,config:{game:'guiming',revision:GAME_REVISION,backend:host.backend,character:0,difficulty:1,mode:'spell-practice',stageId:1,spellId:ALL_SPELLS[0].id,seed:210721,startingLives:2,initialSpellRecords:{},spellTimes:[]},frames:20,runs:[[0,20]],checkpoints:[]};
  app.storage.replays=[{revision:GAME_REVISION,summary:{character:0,difficulty:1,score:0},replay:sample}];
  main(4);tick(app,12);tap(app,Keys.SHOOT);assert(app.playbackSource===sample,'Replay selection passes real recorder format into application');tick(app,100);assert(app.replayFinished,'Selected replay completes after the shared scene transition');visited.push('replay-playback');
  result={kind:'ui',visited,frames:app.frame,memoryWrites:writes,snapshot:app.snapshot()};
}
const runner=scenario.kind==='campaign'?campaign():scenario.kind==='replay'?replay():scenario.kind==='continuation-replay'?continuationReplay():scenario.kind==='ui'?ui():null;
let started=null;
return{
  update(){if(result)return;const first=started===null;started??=Date.now();try{
    if(first){const path=`integration/native-roundtrip-${native.backend}.json`,value=JSON.stringify({game:'touhou21',backend:native.backend,fixture:'native-path-roundtrip'});native.writeText(path,value);assert(native.readText(`userdata/${path}`)===value,'Actual native writeText/readText path semantics round-trip');}
    if(!runner)throw new Error('Unknown QA scenario');const status=runner.next();if(status.done){result.passed=true;result.nativeUserDataRoundTrip=true;result.elapsedMs=Date.now()-started;application?.destroy();}
  }catch(error){result={passed:false,kind:scenario.kind,error:error.stack??String(error),snapshot:application?.snapshot()??null,elapsedMs:Date.now()-started,memoryWrites:writes};application?.destroy();}},
  render:()=>[],snapshot:()=>result??{passed:false,error:'Fixture did not update'},
};
}
