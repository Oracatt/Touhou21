import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TouhouGame,createTouhouResources,TOUHOU_BULLET_STYLES,TouhouRNG,TouhouStageTransition} from '@ts-stg/thlib/touhou';
import {Keys} from '@ts-stg/thlib';
import {STAGES,MIDBOSSES} from '../src/content.js';
import {CampaignDirector} from '../src/director.js';
import {SPELL_PATTERNS,STAGE_PATTERN_OFFSETS,updateSpellPattern} from '../src/patterns.js';
import {CampaignScene,createSpellPortrait} from '../src/scene.js';
import {DrawList} from '@ts-stg/thlib';

function sceneFixture({character=0,difficulty=1,mode='spell-practice',spellId=STAGES[0].spells[0].id,stageId=1,
  storage=null,playbackSource=null,options={},onComplete,onSpellPracticeEnd}={}){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  resources.encodeText=text=>new Uint8Array(Array.from(text).flatMap(char=>char.charCodeAt(0)>127?[65,65]:[65]));
  resources.writeAnimationText=vm=>vm;
  storage??={settings:{startingLives:2,autoSaveReplay:true},progress:{spellRecords:{},seenSpells:[],stageUnlock:1,scores:[]},
    saved:0,replays:[],saveProgress(){this.saved++;},saveReplay(replay,summary){this.replays.push({replay,summary});},recordClear(){this.saved++;}};
  const art={host:{createTexture:()=>89,unloadTexture(){}},load:()=>({id:81,width:512,height:512,bounds:{x:0,y:0,width:265,height:512}}),portrait:()=>{},background:()=>{}};
  const text={draw:()=>{}},host={backend:'v8'},music={play(){},pause(){},resume(){},fadeOut(){}};
  const rng=new TouhouRNG(73),visualRng=new TouhouRNG(73^0x6d2b79f5);
  for(const bank of Object.values(resources.banks)){bank.rng=visualRng;bank.environment={...bank.environment,rng:visualRng};}
  const scene=new CampaignScene({banks:resources.banks,font:resources.font,sht:resources.shots[character],styles:resources.styles,
    rng,visualRng,power:400},{resources,host,art,text,music,storage,
    config:{character,difficulty,mode,spellId,stageId,seed:73},playbackSource,options:{fixedClock:true,...options},onComplete,onSpellPracticeEnd});
  return{scene,storage,resources,dispose(){scene.destroy();resources.dispose();}};
}

function fixture(options={}){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,
    seed:91,visualRng:undefined,...options});
  game.player.invulnerability.set(9999999);
  return{game,resources,dispose(){game.destroy();resources.dispose();}};
}
const step=(game,director,{damage=false}={})=>{
  game.player.invulnerability.set(9999999);
  if(damage&&director.boss&&(['combat','midboss-combat'].includes(director.state))&&director.phaseFrame>90&&!director.phase?.spec?.survival)
    director.boss.damage(100000,{type:'test-strike'},game.context);
  game.update(0);
};

test('covered stage cleanup cancels registered Boss holds and actor-owned sequences',()=>{
  const f=sceneFixture(),boss=f.scene.director.boss;let executions=0;
  f.scene.holdBoss(boss);
  f.scene.runBossSequence(boss,(function*(){executions++;yield 1;executions++;})());
  assert.equal(f.scene.isBossHeld(boss),true);
  f.scene.cleanStageActors();f.scene.tasks.update(f.scene.context);
  assert.equal(executions,0,'a retired stage cannot resume an old Boss script');
  assert.equal(f.scene.bossRegistry.size,0);assert.equal(f.scene.bossHolds.size,0);
  assert.equal(f.scene.bossEscapes.length,0);assert.equal(f.scene.context.boss,null);
  assert.equal(f.scene.enemies.length,0);assert.equal(boss.alive,false);f.dispose();
});

test('every authored boss card has a distinct public-field choreography and valid original collision geometry',()=>{
  assert.equal(SPELL_PATTERNS.length,31);assert.equal(new Set(SPELL_PATTERNS.map(p=>p.id)).size,31);
  assert.deepEqual(STAGES.map(stage=>stage.spells.length),[2,3,3,4,4,5,10]);
  const signatures=[];
  for(const stage of STAGES)for(let spellIndex=0;spellIndex<stage.spells.length;spellIndex++){
    const f=fixture(),boss=f.game.spawnEnemy({x:0,y:100,hp:100000,damageInvulnerability:0,directional:false}),state={};
    boss.invulnerable=true;f.game.setBoss(boss);f.game.startBossCombat();
    const samples=[];
    for(let frame=0;frame<360;frame++){
      updateSpellPattern({game:f.game,boss,frame,difficulty:1,stageId:stage.id,spellIndex,state});f.game.update(0);
      if(frame%60===59)samples.push([f.game.bullets.nextId,f.game.lasers.nextId,f.game.bullets.bullets.filter(b=>[1,2].includes(b.state)).slice(0,12).map(b=>[b.type,b.color,b.x.toFixed(2),b.y.toFixed(2)])]);
    }
    const live=f.game.bullets.bullets.filter(b=>[1,2].includes(b.state));
    assert.ok(live.length+f.game.lasers.count>0,`${stage.id}/${spellIndex} actually attacks`);
    for(const bullet of live){assert.equal(bullet.radius,TOUHOU_BULLET_STYLES[bullet.type].radius);assert.ok(Number.isFinite(bullet.x)&&Number.isFinite(bullet.y));}
    assert.ok(f.game.bullets.count<2000,'patterns stay below the public bullet pool');
    signatures.push(JSON.stringify(samples));f.dispose();
  }
  assert.equal(new Set(signatures).size,31,'cards are not just relabelled identical attacks');
});

test('all four difficulties emit actual attacks, with Hard and Lunatic extra geometry',()=>{
  const results=[];
  for(let difficulty=0;difficulty<4;difficulty++){
    const f=fixture(),boss=f.game.spawnEnemy({x:0,y:100,hp:100000,directional:false}),state={};
    boss.invulnerable=true;f.game.setBoss(boss);f.game.startBossCombat();
    for(let frame=0;frame<360;frame++){updateSpellPattern({game:f.game,boss,frame,difficulty,stageId:1,spellIndex:0,state});f.game.update();}
    results.push({count:f.game.bullets.nextId,types:new Set(f.game.bullets.bullets.map(b=>b.type))});f.dispose();
  }
  assert.ok(results[0].count<results[1].count);assert.ok(results[1].count<results[2].count);assert.ok(results[2].count<results[3].count);
  assert.ok(results[2].count>results[1].count*1.2,'Hard adds the inner door frames, not only speed');
});

test('breaking a moving nonspell clears its motion before the next spell opening',()=>{
  const f=fixture(),g=f.game;
  const director=new CampaignDirector({stages:STAGES,callbacks:{dialogue:(lines,{onComplete})=>onComplete()}}).attach(g);
  director._spawnBoss(g);director._beginPhase(g,0);
  const b=director.boss;b.motion.speed=2;b.motion.delta.x=2;b.motion.flags=16;
  director._finishPhase(g,{defeated:true});
  assert.equal(director.phase.spell,true);assert.equal(b.motion.speed,0);assert.equal(b.motion.flags,0);
  assert.deepEqual(b.motion.delta,{x:0,y:0,z:0});
  director.destroy();f.dispose();
});

test('dialogue freezes road and card clocks while the real player continues updating',()=>{
  const f=fixture();let done;
  const director=new CampaignDirector({stages:STAGES,callbacks:{dialogue:(lines,{onComplete})=>{done=onComplete;}}}).attach(f.game);
  director.midbossDone=true;director.stageFrame=STAGES[0].roadFrames;
  for(let i=0;i<105;i++)step(f.game,director);
  assert.equal(director.state,'dialogue');assert.equal(f.game.bossPresentation.combatActive,false);
  const before=director.snapshot(),playerAge=f.game.player.timer.current;
  const bombs=f.game.player.bombs,shots=f.game.player.shots.length;
  for(let i=0;i<40;i++)f.game.update(Keys.SHOOT|Keys.BOMB);
  assert.equal(director.stageFrame,before.stageFrame);assert.equal(director.phaseFrame,before.phaseFrame);
  assert.ok(f.game.player.timer.current>playerAge);assert.equal(f.game.player.bombs,bombs);
  assert.equal(f.game.player.shots.length,shots,'dialogue never creates shots');done();done();
  for(let i=0;i<400&&director.state!=='combat';i++)step(f.game,director);
  assert.equal(director.state,'combat');assert.equal(director.phaseIndex,0);
  director.destroy();f.dispose();
});

test('the player speaks alone, the Boss appears mid-dialogue and its theme starts a few lines later',()=>{
  for(const character of [0,1]){
    const f=fixture(),log=[];let done,seen;
    const director=new CampaignDirector({stages:STAGES,character,callbacks:{
      music:id=>log.push(`music:${id}`),bossSpawn:()=>log.push('boss'),
      dialogue:(lines,options)=>{if(options.kind==='before'){seen={lines,options};done=options.onComplete;}else options.onComplete();},
    }}).attach(f.game);
    log.length=0;director.midbossDone=true;director.stageFrame=STAGES[0].roadFrames;
    for(let i=0;i<5;i++)step(f.game,director);
    assert.equal(director.state,'dialogue');assert.equal(director.boss,null,'no Boss while the player is still alone');
    assert.deepEqual(log,[],'the stage theme keeps playing during the monologue');
    const {appear,music}=seen.options.cues,speakers=seen.lines.map(line=>line.speaker);
    assert.ok(appear>=2,'at least two lines of self-talk');assert.ok(speakers.slice(0,appear).every(name=>name!=='boss'));
    assert.equal(speakers[appear],'boss');assert.ok(music>appear&&music<=speakers.length-1,'the theme starts after some conversation');
    seen.options.cue('appear');assert.ok(director.boss?.alive);assert.deepEqual(log,['boss'],'the stage theme is not cut when the Boss appears');
    seen.options.cue('appear');assert.equal(log.length,1,'a cue is delivered once');
    seen.options.cue('music');assert.deepEqual(log.slice(1),['music:boss01']);seen.options.cue('music');assert.equal(log.length,2);
    done();assert.equal(director.state,'boss-enter');assert.equal(log.length,2,'ending the dialogue does not restart the theme');
    for(let i=0;i<400&&director.state!=='combat';i++)step(f.game,director);assert.equal(director.state,'combat');
    director.destroy();f.dispose();
  }
});

test('a dialogue that never delivers cues still brings in the Boss and its theme',()=>{
  const f=fixture(),log=[];
  const director=new CampaignDirector({stages:STAGES,callbacks:{music:id=>log.push(id),dialogue:(lines,{onComplete})=>onComplete()}}).attach(f.game);
  log.length=0;director.midbossDone=true;director.stageFrame=STAGES[0].roadFrames;
  for(let i=0;i<5;i++)step(f.game,director);
  assert.ok(director.boss?.alive);assert.deepEqual(log,['boss01']);director.destroy();f.dispose();
});

test('application-injected spell background and portrait remain owned by public spell presentation',()=>{
  const f=fixture();let metadata,updates=0,draws=0,destroys=0;
  const background={alive:true,update(){updates++;},draw(){draws++;},destroy(){this.alive=false;destroys++;}};
  const portrait={alive:true,update(){updates++;},draw(){draws++;},destroy(){this.alive=false;destroys++;}};
  const director=new CampaignDirector({stages:STAGES,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id,
    callbacks:{spellStart:(spec,options)=>{metadata=options;return{background,portrait};}}}).attach(f.game);
  f.game.update();assert.equal(metadata.code,1);assert.equal(metadata.bossId,'akari');assert.equal(metadata.midboss,false);
  assert.equal(f.game.spell.background,background);assert.ok(f.game.spell.visuals.includes(portrait));
  assert.ok(updates>=2);f.game.render();assert.ok(draws>=2);
  director.boss.damage(100000,{type:'test-strike'},f.game.context);
  for(let i=0;i<60;i++)step(f.game,director);
  assert.ok(destroys>=1,'common spell owner retires its background at finish');
  director.destroy();f.dispose();assert.equal(destroys,2,'scene teardown owns the remaining portrait');
});

test('native pause ownership freezes every director clock before stage callback dispatch',()=>{
  const f=fixture(),director=new CampaignDirector({stages:STAGES}).attach(f.game);
  for(let i=0;i<40;i++)step(f.game,director);
  const before=director.snapshot();f.game.update(Keys.PAUSE);assert.ok(f.game.paused);
  for(let i=0;i<25;i++)f.game.update(0);
  assert.deepEqual(director.snapshot(),before);
  director.destroy();f.dispose();
});

test('nonspell defeat immediately enters its spell on the remaining shared HP segment',()=>{
  const f=fixture();const director=new CampaignDirector({stages:STAGES,callbacks:{dialogue:(lines,{onComplete})=>onComplete()}}).attach(f.game);
  director.midbossDone=true;director.stageFrame=STAGES[0].roadFrames;for(let i=0;i<105;i++)step(f.game,director);
  const ringMaximum=director.phasePlan.groups[0].maximum,spellHp=director.phases[1].hp;
  director.boss.damage(100000,{type:'test-strike'},f.game.context);
  assert.equal(director.phaseIndex,1);assert.equal(director.state,'combat');assert.ok(f.game.spell.active);
  assert.equal(director.boss.hp,spellHp);assert.equal(director.boss.health.scaledHp,spellHp*7);
  assert.equal(f.game.bossHudState.healthBars[0].maximum,ringMaximum);
  assert.equal(f.game.bossHudState.healthBars[0].current,spellHp);
  assert.equal(f.game.bossDefeats.length,0,'ordinary nonspell is not final Boss defeat');
  director.boss.damage(100000,{type:'test-strike'},f.game.context);
  assert.equal(director.state,'phase-wait');assert.equal(director.waitFrames,60);
  assert.equal(f.game.bossHudState.healthBars[0].current,director.phases[2].hp+director.phases[3].hp);
  for(let i=0;i<60;i++)step(f.game,director);
  assert.equal(director.phaseIndex,2);assert.equal(director.state,'combat');
  director.destroy();f.dispose();
});

test('final card uses the original 60-frame clearing wave and burst before dialogue',()=>{
  const f=fixture();const seen=[];
  const director=new CampaignDirector({stages:STAGES,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id,
    callbacks:{complete:result=>seen.push(result)}}).attach(f.game);
  step(f.game,director);assert.equal(director.state,'combat');
  f.game.bullets.emit({x:-100,y:200,angle:Math.PI/2,speed:.2,type:0,color:1,count:5,pattern:3});
  director.boss.damage(100000,{type:'test-strike'},f.game.context);
  assert.equal(director.state,'boss-defeat');assert.equal(f.game.bossDefeats.length,1);
  for(let i=0;i<59;i++)step(f.game,director);assert.equal(seen.length,0);assert.ok(director.boss.alive);
  step(f.game,director);assert.equal(seen.length,1);assert.equal(director.state,'complete');
  assert.equal(director.captures.length,1);assert.equal(director.captures[0].captured,true);
  assert.ok(f.game.bullets.bullets.every(b=>![1,2].includes(b.state)));
  director.destroy();f.dispose();
});

test('all six stages and Extra complete with original entities, stage continuations and deterministic seeds',()=>{
  function run(mode){
    const f=fixture(),stages=STAGES.map(stage=>({...stage,roadFrames:180,spells:stage.spells.map(spell=>({...spell,seconds:6}))}));
    const visits=[],dialogs=[],music=[],finished=[];
    const midbosses=MIDBOSSES.map(mid=>({...mid,atFrame:75,spells:mid.spells.map(spell=>({...spell,seconds:6}))}));
    const director=new CampaignDirector({stages,midbosses,mode,seed:73,callbacks:{
      stageStart:stage=>visits.push(stage.id),music:track=>music.push(track),
      dialogue:(lines,options)=>{dialogs.push(`${options.stage.id}/${options.kind}`);options.onComplete();},
      stageClear:(stage,{onComplete})=>onComplete(),complete:result=>finished.push(result),
    }}).attach(f.game);
    let frames=0;while(!director.completed&&frames++<15000)step(f.game,director,{damage:true});
    assert.ok(director.completed,`${mode} ends within its complete designed route`);assert.equal(finished.length,1);
    const snapshot=director.snapshot();director.destroy();f.dispose();return{visits,dialogs,music,finished,snapshot};
  }
  const main=run('normal');assert.deepEqual(main.visits,[1,2,3,4,5,6]);assert.equal(main.dialogs.length,12);
  assert.equal(main.snapshot.captures.length,26);assert.equal(main.finished[0].ending,'good');
  assert.deepEqual(run('normal'),main,'fixed input and seed reproduce every phase and reward');
  const extra=run('extra');assert.deepEqual(extra.visits,[7]);assert.equal(extra.snapshot.captures.length,13);
  assert.ok(extra.dialogs.includes('7/midboss'));assert.deepEqual(extra.snapshot.captures.slice(0,3).map(card=>card.id),[32,33,34]);
  assert.equal(extra.finished[0].ending,'extra');
});

test('practice selects exactly one stage or card and ordinary timeout settles as bonus failed',()=>{
  const f=fixture();const stages=STAGES.map(stage=>({...stage,roadFrames:120,spells:stage.spells.map(spell=>({...spell,seconds:6}))}));
  const director=new CampaignDirector({stages,mode:'spell-practice',stageId:2,spellId:stages[1].spells[2].id}).attach(f.game);
  for(let i=0;i<500&&!director.completed;i++)step(f.game,director);
  assert.ok(director.completed);assert.equal(director.captures.length,1);assert.equal(director.captures[0].captured,false);
  assert.equal(director.captures[0].timeout,true);director.destroy();f.dispose();
});

test('all 39 cards on four difficulties settle through the actual public spell clock, including survival cards',()=>{
  const stages=STAGES.map(stage=>({...stage,spells:stage.spells.map(spec=>({...spec,seconds:6}))}));
  const midbosses=MIDBOSSES.map(mid=>({...mid,spells:mid.spells.map(spec=>({...spec,seconds:6}))}));
  const catalog=[...stages.flatMap(stage=>stage.spells.map(spec=>({stageId:stage.id,spec}))),
    ...midbosses.flatMap(mid=>mid.spells.map(spec=>({stageId:mid.stageId,spec})))];
  assert.equal(catalog.length,39);const ids=new Set();let checkedSurvival=0;
  for(let difficulty=0;difficulty<4;difficulty++)for(const {stageId,spec} of catalog){
    const f=fixture();const director=new CampaignDirector({stages,midbosses,mode:'spell-practice',stageId,spellId:spec.id,difficulty}).attach(f.game);
    for(let frame=0;frame<500&&!director.completed;frame++)step(f.game,director);
    assert.equal(director.completed,true,`${spec.id}/${difficulty} exits after its actual public timeout`);
    assert.equal(director.captures.length,1);const result=director.captures[0];ids.add(result.id);
    assert.equal(typeof result.id,'number');assert.equal(result.captured,!!spec.survival,`${spec.id} survival/capture policy`);
    if(spec.survival){checkedSurvival++;assert.equal(result.timeout,false,'successful survival is a captured expiry');}
    else assert.equal(result.timeout,true,'ordinary timeout is not a capture');
    assert.ok(f.game.bullets.bullets.every(b=>![1,2].includes(b.state)),`${spec.id} no residual live bullets`);
    assert.equal(f.game.lasers.count,0,`${spec.id} no residual lasers`);
    director.destroy();f.dispose();
  }
  assert.equal(ids.size,39);assert.ok(checkedSurvival>0);
});

test('cut-in uses the original ANM entry/drift/exit clock and destroys its private VM without unloading borrowed artwork',()=>{
  const art={load:()=>({id:81,width:512,height:512,bounds:{x:0,y:0,width:265,height:512}})};
  const portrait=createSpellPortrait({art,bossId:'akari',visualRng:new TouhouRNG(1)}),draw=new DrawList();
  assert.equal(portrait.layer,6);assert.equal(portrait.drawPriority,16);assert.ok(portrait.worldPosition().x>350);assert.ok(portrait.worldPosition().y<-100);
  for(let i=0;i<29;i++)portrait.update();assert.ok(Math.abs(portrait.worldPosition().x+4)<.1);assert.ok(Math.abs(portrait.worldPosition().y+16)<.1);
  portrait.draw(draw,{x:336,y:24,scale:1.5,screenScale:1});assert.ok(draw.commands.some(c=>c[0]==='statefulQuad'));
  for(let i=0;i<90;i++)portrait.update();assert.ok(Math.abs(portrait.worldPosition().x+36)<.1);assert.equal(portrait.alive,true);
  for(let i=0;i<31;i++)portrait.update();assert.equal(portrait.alive,false);assert.equal(portrait.bank.disposed,true);
  portrait.destroy();assert.equal(portrait.bank.textures.size,0);
});

test('scene isolates public spell records by character and difficulty, and records final encoded spell timing before save',()=>{
  const a=sceneFixture();a.scene.update();assert.equal(a.scene.spell.records[1].attempts[1],1);
  assert.equal(a.storage.progress.spellRecords['0:1'][1].attempts[1],1);
  for(let i=0;i<70;i++)a.scene.update();a.scene.director.boss.damage(100000,{type:'test-strike'},a.scene.context);
  for(let i=0;i<60;i++)a.scene.update();assert.equal(a.storage.replays.length,1);
  const replay=a.storage.replays[0].replay;
  assert.equal(replay.config.spellTimes.length,1);assert.equal(replay.config.spellTimes[0].stage,1);
  assert.equal(replay.config.initialSpellRecords[1],undefined,'recording saves the pre-attempt HUD counters');
  assert.equal(replay.config.startingLives,2);
  const b=sceneFixture({character:1,difficulty:2,storage:a.storage});b.scene.update();
  assert.equal(b.storage.progress.spellRecords['1:2'][1].attempts[1],1);assert.equal(a.storage.progress.spellRecords['0:1'][1].attempts[1],1);
  b.dispose();a.dispose();
});

test('scene replay keeps recorded stock, HUD counters and state checkpoints while persistent progress remains unchanged',()=>{
  const recording=sceneFixture();for(let i=0;i<660;i++)recording.scene.update(0);
  const replay=recording.scene.recorder.toJSON();recording.dispose();
  const progress={spellRecords:{'0:1':{1:{name:'changed since recording',captures:[15,12],attempts:[80,60]}}},seenSpells:['anything'],stageUnlock:6,scores:[{character:0,difficulty:1,mode:'spell-practice',score:9999999}]};
  const storage={settings:{startingLives:5,autoSaveReplay:true},progress,replays:[],saved:0,
    saveProgress(){this.saved++;},saveReplay(){this.saved++;},recordClear(){this.saved++;}};
  const before=JSON.stringify(progress),playing=sceneFixture({storage,playbackSource:replay});
  for(let i=0;i<660;i++)playing.scene.update(0);
  assert.equal(playing.scene.player.lives,recording.scene.player.lives);assert.equal(playing.scene.spell.records[1].attempts[1],1);
  assert.equal(playing.scene.playback.desync,null);assert.equal(JSON.stringify(progress),before);assert.equal(storage.saved,0);
  playing.dispose();assert.equal(storage.saved,0);
});

test('scene stage cover draws before the common player body, and Extra public systems use difficulty four',()=>{
  const f=sceneFixture({mode:'extra',difficulty:1,stageId:7,options:{testing:true,skipRoad:true}});
  assert.equal(f.scene.difficulty,4);assert.equal(f.scene.spell.difficulty,4);assert.equal(f.scene.items.difficulty,4);
  assert.equal(f.scene.director.stageFrame,STAGES[6].roadFrames);assert.equal(f.scene.director.midbossDone,true);
  f.scene.stageTransition=new TouhouStageTransition();for(let i=0;i<15;i++)f.scene.stageTransition.update();
  const drawPlayer=f.scene.player.draw.bind(f.scene.player);
  f.scene.player.draw=(draw,view)=>{draw.enqueuePriority(30,target=>target.rect(321,654,1,1,0x123456ff));return drawPlayer(draw,view);};
  const commands=f.scene.render(),cover=commands.findIndex(c=>c[0]==='rect'&&c[1]===48&&c[2]===24&&c[3]===576&&c[4]===672&&c[5]===127);
  const player=commands.findIndex(c=>c[0]==='rect'&&c[1]===321&&c[2]===654&&c[5]===0x123456ff);
  assert.ok(cover>=0);assert.ok(cover<player,'cover never erases the foreground player');f.dispose();
});

test('naturally finished practice replay restores the final encoded clock before its completion checkpoint',()=>{
  const recording=sceneFixture({options:{invincible:true}});let frames=0;
  while(!recording.scene.director.completed&&frames++<2400)recording.scene.update(0);
  assert.equal(recording.scene.director.completed,true);const replay=recording.storage.replays[0].replay;
  assert.equal(replay.config.spellTimes.length,1);assert.equal(replay.frames,frames);
  const encoded=recording.scene.spell.encodedTime,expected=recording.scene.snapshot();recording.dispose();
  let writes=0;const storage={settings:{startingLives:5,autoSaveReplay:true},progress:{spellRecords:{},seenSpells:[],stageUnlock:1,scores:[]},
    saveProgress(){writes++;},saveReplay(){writes++;},recordClear(){writes++;}};
  const playing=sceneFixture({playbackSource:replay,storage,options:{invincible:true}});
  for(let i=0;i<replay.frames;i++)playing.scene.update(0);
  assert.equal(playing.scene.spell.encodedTime,encoded);assert.deepEqual(playing.scene.snapshot(),expected);
  assert.equal(playing.scene.playback.desync,null);assert.equal(writes,0);playing.dispose();
});
