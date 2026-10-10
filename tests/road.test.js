import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stateHash,Keys} from '@ts-stg/thlib';
import {TouhouGame,TouhouEnemy,TouhouMotion,TouhouRNG,createTouhouResources,TOUHOU_BULLET_STYLES,TOUHOU_ENEMY_PRESETS} from '@ts-stg/thlib/touhou';
import {ROAD_SCRIPTS,ROAD_ROLES,ROAD_FORMATIONS,ROAD_ATTACKS,ROAD_MIDBOSS_FRAMES,createRoadPlan,spawnRoadFormation,roadPath,updateRoadEnemy} from '../dist/src/roads.js';
import {CampaignDirector} from '../dist/src/director.js';
import {STAGES,MIDBOSSES} from '../dist/src/content.js';
import {createDanmakuLab} from '../tools/danmaku-lab.js';

const assets=fs.existsSync('packages/thlib/assets/touhou-common/manifest.json');
const needsAssets=assets?{}:{skip:'requires the private touhou-common resource pack (tools/setup-local.ps1)'};

/** Full-score trace on the real thlib bullet field with TouhouEnemy-shaped
 * actors and the public Motion order. Nobody shoots, so guards live out
 * their full routes: counts are an upper bound on real pressure. */
function trace(stageId,difficulty,seed=73){
  const plan=createRoadPlan(stageId),rng=new TouhouRNG(seed),lab=createDanmakuLab({seed,difficulty}),movement=[],attacks=[];
  let cursor=0,spawned=0,outsideFire=0,clock=0;
  for(;clock<plan.roadFrames;clock++){
    while(cursor<plan.waves.length&&plan.waves[cursor].at===clock){const wave=plan.waves[cursor++];
      spawned+=spawnRoadFormation({game:lab.game,wave,stageId,difficulty,rng,canFire:()=>clock<wave.fireUntil,
        onAttack:p=>{attacks.push({frame:clock,wave:wave.id,...p});const e=lab.game.enemies.find(a=>a.id===p.enemyId);if(e&&(e.y<10||e.y>290))outsideFire++;}}).length;}
    lab.step(null);
    if(clock%24===0)for(const e of lab.game.enemies)movement.push([clock,e.roadWaveId,Math.round(e.x*10),Math.round(e.y*10)]);
  }
  return{plan,attacks,spawned,emitted:lab.emitted,peak:lab.peak,outsideFire,rng:rng.state,pathHash:stateHash(movement),
    geometryHash:stateHash(lab.game.bullets.bullets.filter(b=>b.state).map(b=>[b.type,Math.round(b.x),Math.round(b.y)])),
    mechanisms:new Set(attacks.map(a=>a.attack))};
}

test('seven road scores are finite, continuous and leave the midboss and Boss approach clear',()=>{
  assert.equal(ROAD_SCRIPTS.length,7);const ids=new Set();
  for(const [name,role] of Object.entries(ROAD_ROLES)){
    const prefab=TOUHOU_ENEMY_PRESETS.find(p=>p.script===role.script);
    assert.ok(prefab,`${name} uses an available public Enemy animation`);
    assert.equal(role.directional??true,prefab.directional,`${name} cannot select adjacent unrelated animation scripts`);
  }
  for(const stage of STAGES){
    const plan=createRoadPlan(stage.id),mid=MIDBOSSES.find(m=>m.stageId===stage.id);
    assert.equal(plan.roadFrames,stage.roadFrames);assert.equal(plan.midbossAt,mid.atFrame);assert.equal(ROAD_MIDBOSS_FRAMES[stage.id-1],stage.midbossAt);
    assert.equal(plan.sections[0].start,0);assert.equal(plan.sections.at(-1).end,stage.roadFrames);
    for(let i=1;i<plan.sections.length;i++)assert.equal(plan.sections[i-1].end,plan.sections[i].start,'sections cover the road continuously');
    assert.ok(plan.waves.length>=24&&plan.waves.length<=36,`stage ${stage.id} is a full authored score`);
    const midSpace=plan.sections.find(s=>s.start<=mid.atFrame&&s.end>mid.atFrame);assert.equal(midSpace.waves.length,0,'the midboss arrives in a cleared section');
    assert.ok(plan.sections.at(-1).waves.length===0&&plan.sections.at(-1).end-plan.sections.at(-1).start>=280,'quiet approach before the Boss');
    assert.ok(plan.waves.filter(w=>w.role==='guard').length>=4,'large fairies set pieces through the stage');
    assert.ok(plan.waves.some(w=>w.attack==='motif'&&w.at<mid.atFrame)&&plan.waves.some(w=>w.attack==='motif'&&w.at>mid.atFrame),'signature guards both before and after the midboss');
    for(const wave of plan.waves){assert.ok(!ids.has(wave.id));ids.add(wave.id);assert.ok(ROAD_ROLES[wave.role]);assert.ok(ROAD_FORMATIONS.includes(wave.formation));
      assert.ok(ROAD_ATTACKS.includes(wave.attack));assert.ok(wave.at>=0&&wave.at<stage.roadFrames-280);assert.ok(wave.fireUntil>wave.at);}
  }
});

test('whole roads attack on the real bullet field, rise after the midboss and keep pool headroom',t=>{
  for(const stage of STAGES){
    const difficulty=stage.extra?4:1,row=trace(stage.id,difficulty),mid=row.plan.midbossAt;
    assert.ok(row.emitted>600&&row.spawned>90,`stage ${stage.id}: sustained choreography (${row.emitted} bullets, ${row.spawned} fairies)`);
    assert.ok(row.mechanisms.size>=6,'several independent fairy roles');assert.ok(row.mechanisms.has('motif'));
    assert.ok(row.peak<1000,`stage ${stage.id}: pool headroom (${row.peak})`);
    assert.equal(row.outsideFire,0,'fairies only fire from the upper field');
    const before=row.attacks.filter(a=>a.frame<mid).reduce((n,a)=>n+a.count,0),after=row.attacks.filter(a=>a.frame>mid).reduce((n,a)=>n+a.count,0);
    assert.ok(after>before,'the second half raises the pressure');
    for(const quiet of row.plan.sections.filter(s=>!s.waves.length))
      assert.ok(row.attacks.filter(a=>a.frame>=quiet.start+40&&a.frame<quiet.end).length===0,`stage ${stage.id}: ${quiet.id} stays quiet`);
    t.diagnostic(JSON.stringify({stage:stage.id,waves:row.plan.waves.length,fairies:row.spawned,bullets:row.emitted,peak:row.peak}));
  }
});

test('road difficulty raises density on every stage and seeds change real routes reproducibly',()=>{
  for(let stageId=1;stageId<=6;stageId++){
    const rows=[0,1,2,3].map(rank=>trace(stageId,rank));
    for(let rank=1;rank<4;rank++)assert.ok(rows[rank].emitted>rows[rank-1].emitted,`${stageId}/${rank} increases pressure`);
  }
  for(let id=1;id<=7;id++){
    const difficulty=id===7?4:1,a=trace(id,difficulty,73),b=trace(id,difficulty,73),other=trace(id,difficulty,74);
    assert.equal(a.pathHash,b.pathHash);assert.equal(a.geometryHash,b.geometryHash);assert.equal(a.rng,b.rng);
    assert.notEqual(a.pathHash,other.pathHash,'seed changes formation jitter');
  }
});

test('aimed fire relays through each formation and every stage enters on its own routes',()=>{
  const owners=new Map();
  for(let stageId=1;stageId<=6;stageId++)for(const wave of createRoadPlan(stageId).waves)if(wave.role!=='guard'&&wave.formation!=='drop'){
    const owner=owners.get(wave.formation)??stageId;owners.set(wave.formation,owner);
    assert.equal(owner,stageId,`stage ${stageId} reuses stage ${owner}'s ${wave.formation} route`);
  }
  const aimed=new Set(['aim','stream','echo','letter','seal']);
  for(let stageId=1;stageId<=7;stageId++)for(const difficulty of stageId===7?[4]:[1,3]){
    const waves=new Map();
    for(const a of trace(stageId,difficulty).attacks)if(aimed.has(a.attack)){const list=waves.get(a.wave)??[];list.push(a);waves.set(a.wave,list);}
    for(const [wave,list] of waves)for(const a of list){
      const shooters=new Set(list.filter(b=>b.frame>=a.frame&&b.frame<a.frame+10).map(b=>b.enemyId));
      assert.ok(shooters.size<=2,`${wave} on ${difficulty}: ${shooters.size} fairies open aimed fire within 10 frames`);
    }
  }
});

test('finite route primitives enter the world, turn, and leave without undefined points',()=>{
  for(const formation of ROAD_FORMATIONS){const points=[];
    for(let age=0;age<=380;age++){const p=roadPath(formation,{index:1,count:4,side:-1,life:380,jitter:0,rank:2},age);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));points.push(p);}
    assert.ok(points.some(p=>Math.abs(p.x)<185&&p.y>20&&p.y<250),`${formation} reaches combat space`);
    assert.ok(Math.abs(points.at(-1).x)>192||points.at(-1).y>448||points.at(-1).y<0,`${formation} has an actual exit`);
  }
});

function actualFixture(){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:91});
  game.player.invulnerability.set(9999999);return{game,resources,dispose(){game.destroy();resources.dispose();}};
}
test('every road attack uses actual public birth, collision styles and finite laser warmup',needsAssets,()=>{
  const f=actualFixture(),game=f.game;
  for(const attack of ROAD_ATTACKS)for(const stageId of[1,4,7]){const enemy={id:1,x:60,y:100},state={};
    for(let frame=0;frame<300;frame++){game.player.invulnerability.set(9999999);updateRoadEnemy({game,enemy,frame,attack,state,stageId,difficulty:3,side:-1,rng:new TouhouRNG(frame+1)});game.update(0);
      assert.ok(game.bullets.count<1900);for(const b of game.bullets.bullets)if(b.state){assert.equal(b.radius,TOUHOU_BULLET_STYLES[b.type].radius);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));}}
    for(const bullet of game.bullets.bullets)game.bullets.retire(bullet);for(const laser of game.lasers.lasers)game.lasers.erase(laser,{check:false});
  }f.dispose();
});

test('roads still attack a continuously shooting full-power public player through the real midboss',needsAssets,t=>{
  for(let stageId=1;stageId<=7;stageId++){
    const f=actualFixture(),game=f.game;game.difficulty=stageId===7?4:1;game.player.power=400;let shots=0,kills=0;
    const drop=game.items.spawnEnemyDrops.bind(game.items);game.items.spawnEnemyDrops=(enemy,options)=>{if(enemy.roadWaveId)kills++;return drop(enemy,options);};
    const director=new CampaignDirector({stages:STAGES,midbosses:MIDBOSSES,mode:stageId===7?'extra':'stage-practice',stageId,difficulty:game.difficulty,seed:73,
      callbacks:{dialogue:(lines,{onComplete})=>onComplete(),roadAttack:p=>{shots+=p.count??0;}}}).attach(game);
    for(let frame=0;frame<30000&&!['boss-enter','combat'].includes(director.state);frame++){
      game.player.invulnerability.set(999999);if(director.state==='midboss-combat'&&director.phaseFrame>70&&!director.midbossPhase?.spec?.survival)director.boss.damage(100000,{type:'road-test'},game.context);
      game.update(Keys.SHOOT);
    }
    assert.equal(director.stageFrame,STAGES[stageId-1].roadFrames,'the full road runs around the midboss suspension');
    assert.ok(shots>300&&kills>20,'real weapons kill fairies, yet the choreography still fires');
    t.diagnostic(JSON.stringify({stageId,shots,kills}));director.destroy();f.dispose();
  }
});

test('director dispatches authored road events and public Boss holds resume at ordinary phase boundaries',needsAssets,()=>{
  const f=actualFixture(),game=f.game,originalHook=game.context.deferEnemyDefeat;
  const director=new CampaignDirector({stages:STAGES,midbosses:MIDBOSSES,seed:73,callbacks:{dialogue:(lines,{onComplete})=>onComplete()}}).attach(game);
  assert.equal(game.context.deferEnemyDefeat,originalHook,'no consumer replacement of common death ownership');
  for(let frame=0;frame<900;frame++){game.player.invulnerability.set(9999999);game.update(0);}
  const events=director.events.filter(e=>e.event==='road-wave');assert.ok(events.length>=7);
  assert.ok(game.enemies.some(enemy=>enemy instanceof TouhouEnemy&&enemy.roadRole==='guard'));
  director.midbossDone=true;director.stageFrame=STAGES[0].roadFrames;for(let i=0;i<105;i++)game.update(0);
  const boss=director.boss,maximum=director.phasePlan.groups[0].maximum;assert.ok(game.bossRegistry.has(boss));
  boss.damage(100000,{type:'test'},game.context);assert.equal(director.phaseIndex,1);assert.equal(game.isBossHeld(boss),false);assert.equal(game.bossHudState.healthBars[0].maximum,maximum);
  boss.damage(100000,{type:'test'},game.context);assert.equal(director.state,'phase-wait');assert.equal(game.isBossHeld(boss),true);
  for(let i=0;i<60;i++)game.update(0);assert.equal(director.phaseIndex,2);assert.equal(game.isBossHeld(boss),false);assert.equal(game.bossPresentation.charges.length,1);
  director.destroy();assert.equal(game.bossRegistry.size,0);assert.equal(game.bossHolds.size,0);f.dispose();
});

test('every repeating road shot is heard: the first volley sounds and no stretch of fire stays silent',needsAssets,()=>{
  const f=actualFixture(),game=f.game,emit=game.bullets.emit.bind(game.bullets);let calls=[];
  game.bullets.emit=params=>{calls.push({sound:params.shotSound});return emit(params);};
  try{
    for(const attack of ROAD_ATTACKS)for(const stageId of[1,2,3,4,5,6,7])for(let difficulty=0;difficulty<=4;difficulty++)for(const index of[0,2]){
      const enemy={id:1,x:60,y:100},state={};let lastSound=-Infinity,firing=0;
      for(let frame=0;frame<420;frame++){
        calls=[];game.player.invulnerability.set(9999999);
        updateRoadEnemy({game,enemy,frame,attack,state,stageId,difficulty,index,count:4,side:-1,rng:new TouhouRNG(frame+1)});game.update(0);
        const direct=calls.length>0,heard=calls.some(c=>c.sound>=0);if(heard)lastSound=frame;
        if(direct){firing++;assert.ok(frame-lastSound<=96,`${attack} on stage ${stageId} at difficulty ${difficulty}, member ${index} stayed silent from frame ${lastSound} to ${frame}`);}
      }
      for(const bullet of game.bullets.bullets)game.bullets.retire(bullet);for(const laser of game.lasers.lasers)game.lasers.erase(laser,{check:false});
    }
  }finally{f.dispose();}
});