import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stateHash,Keys} from '@ts-stg/thlib';
import {TouhouGame,TouhouEnemy,TouhouMotion,TouhouRNG,createTouhouResources,TOUHOU_BULLET_STYLES,TOUHOU_ENEMY_PRESETS} from '@ts-stg/thlib/touhou';
import {ROAD_SCRIPTS,ROAD_ROLES,ROAD_FORMATIONS,createRoadPlan,spawnRoadFormation,roadPath} from '../src/roads.js';
import {ROAD_ATTACKS,updateRoadEnemy} from '../src/patterns.js';
import {CampaignDirector} from '../src/director.js';
import {STAGES,MIDBOSSES} from '../src/content.js';

/** Fast full-score tracer uses the real public Motion and exact authored shot
 * arguments. A separate real-ANM test below checks public field/collision use. */
function trace(stageId,difficulty,seed=73){
  const plan=createRoadPlan(stageId),rng=new TouhouRNG(seed),enemies=[],shots=[],beams=[],movement=[],attacks=[];
  const game={player:{x:45,y:400},banks:{effect:{}},items:{spawnEnemyDrops(){}},
    bullets:{emit(p){shots.push({frame:clock,...p});return[];}},lasers:{spawnInfinite(p){beams.push({frame:clock,...p});}},
    spawnEnemy(options){const actor={id:enemies.length+1,...options,alive:true,entered:false,motion:new TouhouMotion({position:options}),animation:{destroy(){}}};enemies.push(actor);return actor;}};
  let clock=0,cursor=0;
  for(;clock<plan.roadFrames;clock++){
    while(cursor<plan.waves.length&&plan.waves[cursor].at===clock){const wave=plan.waves[cursor++];spawnRoadFormation({game,wave,stageId,difficulty,rng,canFire:()=>clock<wave.fireUntil,onAttack:p=>attacks.push({frame:clock,...p})});}
    for(const enemy of enemies)if(enemy.alive){enemy.onUpdate(enemy);enemy.motion.update();enemy.x=enemy.motion.position.x;enemy.y=enemy.motion.position.y;
      assert.ok(Number.isFinite(enemy.x)&&Number.isFinite(enemy.y));if(Math.abs(enemy.x)<200&&enemy.y>=-15&&enemy.y<=465)enemy.entered=true;
      else if(enemy.entered)enemy.alive=false;
      if(clock%24===0)movement.push([clock,enemy.roadWaveId,Math.round(enemy.x*100)/100,Math.round(enemy.y*100)/100]);}
  }
  const geometry=shots.map(({frame,x,y,angle,speed,count,angleStep,type,commands})=>[frame,x,y,angle,speed,count,angleStep,type,commands]);
  return{shots,beams,movement,attacks,enemies:enemies.length,bullets:shots.reduce((n,p)=>n+p.count,0),
    geometryHash:stateHash(geometry),pathHash:stateHash(movement),rng:rng.state,mechanisms:[...new Set(attacks.map(p=>p.mechanism))].sort()};
}

test('seven complete road scores validate finite events, roles, pauses and original midboss timing',()=>{
  assert.equal(ROAD_SCRIPTS.length,7);const ids=new Set();
  for(const [name,role] of Object.entries(ROAD_ROLES)){
    const prefab=TOUHOU_ENEMY_PRESETS.find(p=>p.script===role.script);
    assert.ok(prefab,`${name} uses an available public Enemy animation`);
    assert.equal(role.directional??true,prefab.directional,`${name} cannot select adjacent unrelated animation scripts`);
  }
  for(const stage of STAGES){const plan=createRoadPlan(stage.id),mid=MIDBOSSES.find(m=>m.stageId===stage.id);
    assert.equal(plan.roadFrames,stage.roadFrames);assert.equal(plan.sections.length,9);assert.equal(plan.sections[0].start,0);assert.equal(plan.sections.at(-1).end,stage.roadFrames);
    for(let i=1;i<plan.sections.length;i++)assert.equal(plan.sections[i-1].end,plan.sections[i].start,'Sections cover the whole road continuously');
    assert.ok(plan.waves.length>=18&&plan.waves.length<=28,'Each stage is a finite score of authored formations');
    assert.ok(plan.waves.some(w=>w.at<mid.atFrame)&&plan.waves.some(w=>w.at>mid.atFrame));
    const midSpace=plan.sections.find(s=>s.start<=mid.atFrame&&s.end>mid.atFrame);assert.equal(midSpace.waves.length,0,'Original midboss point is inside deliberate breathing space');
    assert.ok(plan.sections.at(-1).end-plan.sections.at(-1).start>=280,'Boss approach retains a collection/recovery window');
    for(const wave of plan.waves){assert.ok(!ids.has(wave.id));ids.add(wave.id);assert.ok(ROAD_ROLES[wave.role]);assert.ok(ROAD_FORMATIONS.includes(wave.formation));assert.ok(ROAD_ATTACKS.includes(wave.attack));assert.ok(wave.at>=0&&wave.at<stage.roadFrames-280);assert.ok(wave.fireUntil>wave.at);}
    assert.ok(new Set(plan.waves.map(w=>w.formation)).size>=3);assert.ok(new Set(plan.waves.map(w=>w.attack)).size===3);assert.ok(plan.waves.some(w=>w.role==='guard'));
  }
});

test('full road motion and emitted geometry differ by stage, without relying on color or names',t=>{
  const rows=STAGES.map(stage=>trace(stage.id,stage.id===7?4:1));
  assert.equal(new Set(rows.map(r=>r.geometryHash)).size,7);assert.equal(new Set(rows.map(r=>r.pathHash)).size,7);
  for(let i=0;i<rows.length;i++){const row=rows[i],plan=createRoadPlan(i+1);
    assert.ok(row.bullets>180&&row.enemies>45,'Whole roads produce real, sustained choreography');
    assert.ok(row.mechanisms.length>=6,'Roles produce independent movement/attack tasks');
    for(const quiet of plan.sections.filter(s=>!s.waves.length))assert.equal(row.attacks.filter(a=>a.frame>=quiet.start&&a.frame<quiet.end).length,0,'Quiet sections cannot start new volleys');
    const mid=MIDBOSSES[i].atFrame;assert.ok(row.shots.filter(s=>s.frame>mid).reduce((n,s)=>n+s.count,0)>row.shots.filter(s=>s.frame<mid).reduce((n,s)=>n+s.count,0),'Post-midboss segment increases pressure before the final approach');
    t.diagnostic(JSON.stringify({stage:i+1,waves:plan.waves.length,enemies:row.enemies,bulletRequests:row.bullets,laserRequests:row.beams.length,mechanisms:row.mechanisms.length}));
  }
});

function actualRoad(stageId,difficulty=1){
  const f=actualFixture(),game=f.game;game.difficulty=difficulty;game.player.power=400;
  let shots=0,lasers=0,peak=0,kills=0;const drop=game.items.spawnEnemyDrops.bind(game.items);
  game.items.spawnEnemyDrops=(enemy,options)=>{if(enemy.roadWaveId)kills++;return drop(enemy,options);};
  const director=new CampaignDirector({stages:STAGES,midbosses:MIDBOSSES,mode:stageId===7?'extra':'stage-practice',stageId,difficulty,seed:73,
    callbacks:{dialogue:(lines,{onComplete})=>onComplete(),roadAttack:p=>{shots+=p.count??0;if(p.mechanism==='telegraphed-laser')lasers++;}}}).attach(game);
  let frame=0;for(;frame<20000&&!['boss-enter','combat'].includes(director.state);frame++){
    game.player.invulnerability.set(999999);if(director.state==='midboss-combat'&&director.phaseFrame>70)director.boss.damage(100000,{type:'road-test'},game.context);
    game.update(Keys.SHOOT);peak=Math.max(peak,game.bullets.count);
  }
  assert.equal(director.stageFrame,STAGES[stageId-1].roadFrames,'Actual public player/enemies run the full road and original midboss suspension');
  director.destroy();f.dispose();return{stageId,difficulty,shots,lasers,peak,kills,frames:frame};
}
test('roads still attack a continuously shooting full-power public player; difficulty pressure survives kills',t=>{
  for(let stageId=1;stageId<=7;stageId++){const row=actualRoad(stageId,stageId===7?4:1);assert.ok(row.shots>150,'Actual thlib weapon damage cannot erase all choreography before it fires');assert.ok(row.kills>10,'The same held-Z input must actually defeat public enemies and produce their common drops');assert.ok(row.peak<1600,'Complete roads keep bullet pool headroom');t.diagnostic(JSON.stringify(row));}
  const ranks=[0,1,2,3].map(rank=>actualRoad(1,rank));for(let i=1;i<ranks.length;i++)assert.ok(ranks[i].shots>ranks[i-1].shots,'Difficulty increases survive the same real shooting input');
});

test('four road difficulties change geometry/mechanisms, not just speed, color and quantity',()=>{
  for(let stageId=1;stageId<=6;stageId++){
    const rows=[0,1,2,3].map(rank=>trace(stageId,rank));
    for(let rank=1;rank<4;rank++)assert.ok(rows[rank].bullets>rows[rank-1].bullets,`${stageId}/${rank} increases effective pressure`);
    assert.ok(rows[1].mechanisms.length>rows[0].mechanisms.length,'Normal adds an independent companion geometry');
    assert.ok(rows[2].mechanisms.length>rows[1].mechanisms.length,'Hard adds delayed turns/lasers');
    assert.ok(rows[3].mechanisms.length>rows[2].mechanisms.length,'Lunatic adds offbeat responses');
    const structural=rows.map(r=>stateHash(r.shots.map(p=>[p.angle,p.angleStep,p.commands])));
    assert.equal(new Set(structural).size,4,'Structure differs after density/speed/color fields are removed');
  }
});

test('whole-road seeded choreography reproduces exactly and seed changes actual routes',()=>{
  for(let id=1;id<=7;id++){
    const difficulty=id===7?4:1,a=trace(id,difficulty,73),b=trace(id,difficulty,73),other=trace(id,difficulty,74);
    assert.equal(a.geometryHash,b.geometryHash);assert.equal(a.pathHash,b.pathHash);assert.equal(a.rng,b.rng);
    assert.notEqual(a.geometryHash,other.geometryHash,'Seed changes emitted origins, not just metadata');
    assert.notEqual(a.pathHash,other.pathHash);
  }
});

test('finite route primitives enter the world, turn, and leave without undefined points',()=>{
  for(const formation of ROAD_FORMATIONS){const points=[];
    for(let age=0;age<=340;age++){const p=roadPath(formation,{index:1,count:4,side:-1,life:340,jitter:0,rank:2},age);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));points.push(p);}
    assert.ok(points.some(p=>Math.abs(p.x)<185&&p.y>20&&p.y<250),`${formation} reaches combat space`);
    assert.ok(Math.abs(points.at(-1).x)>192||points.at(-1).y>448||points.at(-1).y<0,`${formation} has an actual exit`);
  }
});

function actualFixture(){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:91});
  game.player.invulnerability.set(9999999);return{game,resources,dispose(){game.destroy();resources.dispose();}};
}
test('every road attack uses actual public birth, collision styles and finite laser warmup',()=>{
  const f=actualFixture(),game=f.game;
  for(const attack of ROAD_ATTACKS){const enemy={id:1,x:60,y:100},state={};
    for(let frame=0;frame<250;frame++){game.player.invulnerability.set(9999999);updateRoadEnemy({game,enemy,frame,attack,state,difficulty:3,side:-1});game.update(0);
      assert.ok(game.bullets.count<1900,'Road volleys retain pool margin');for(const b of game.bullets.bullets)if(b.state){assert.equal(b.radius,TOUHOU_BULLET_STYLES[b.type].radius);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));}}
    for(const bullet of game.bullets.bullets)game.bullets.retire(bullet);for(const laser of game.lasers.lasers)game.lasers.erase(laser,{check:false});
  }f.dispose();
});

test('director dispatches authored events and public Boss holds resume at ordinary phase boundaries',()=>{
  const f=actualFixture(),game=f.game,originalHook=game.context.deferEnemyDefeat;
  const director=new CampaignDirector({stages:STAGES,midbosses:MIDBOSSES,seed:73,callbacks:{dialogue:(lines,{onComplete})=>onComplete()}}).attach(game);
  assert.equal(game.context.deferEnemyDefeat,originalHook,'No consumer replacement of common death ownership');
  for(let frame=0;frame<900;frame++){game.player.invulnerability.set(9999999);game.update(0);}
  const events=director.events.filter(e=>e.event==='road-wave');assert.equal(events.length,5);assert.equal(new Set(events.map(e=>e.attack)).size,3);
  assert.ok(game.enemies.some(enemy=>enemy instanceof TouhouEnemy&&enemy.roadRole==='guard'));
  director.midbossDone=true;director.stageFrame=STAGES[0].roadFrames;for(let i=0;i<105;i++)game.update(0);
  const boss=director.boss,maximum=director.phasePlan.groups[0].maximum;assert.ok(game.bossRegistry.has(boss));
  boss.damage(100000,{type:'test'},game.context);assert.equal(director.phaseIndex,1);assert.equal(game.isBossHeld(boss),false);assert.equal(game.bossHudState.healthBars[0].maximum,maximum);
  boss.damage(100000,{type:'test'},game.context);assert.equal(director.state,'phase-wait');assert.equal(game.isBossHeld(boss),true);
  for(let i=0;i<60;i++)game.update(0);assert.equal(director.phaseIndex,2);assert.equal(game.isBossHeld(boss),false);assert.equal(game.bossPresentation.charges.length,1);
  director.destroy();assert.equal(game.bossRegistry.size,0);assert.equal(game.bossHolds.size,0);f.dispose();
});
