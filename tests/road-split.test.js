import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys,stateHash} from '@ts-stg/thlib';
import {TouhouGame,TouhouRNG,createTouhouResources} from '@ts-stg/thlib/touhou';
import {AttackKit,kit,T,C,DOWN} from '../dist/src/danmaku.js';
import {scheduleRoadSplit,clearRoadSplits} from '../dist/src/road-bullet-splits.js';
import {spawnRoadFormation} from '../dist/src/roads.js';
import {CampaignDirector} from '../dist/src/director.js';
import {CampaignScene} from '../dist/src/scene.js';
import {STAGES,MIDBOSSES} from '../dist/src/content.js';
import {createDanmakuLab} from '../tools/danmaku-lab.js';

const needsAssets=fs.existsSync('packages/thlib/assets/touhou-common/manifest.json')?{}:
  {skip:'requires the private touhou-common resource pack (tools/setup-local.ps1)'};
const cases=[
  {attack:'lantern',stageId:1,delay:48,parentType:T.ORB,parentCount:1,children:5},
  {attack:'letter',stageId:2,delay:58,parentType:T.AMULET,parentCount:1,children:5},
  {attack:'motif',stageId:2,delay:54,parentType:T.AMULET,parentCount:3,children:24},
];
const live=bullet=>bullet.state===1||bullet.state===2;
function actualFixture(){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:91});
  game.player.invulnerability.set(9999999);
  const emissions=[],emit=game.bullets.emit.bind(game.bullets);
  game.bullets.emit=(parameters,options)=>{const bullets=emit(parameters,options);
    emissions.push({at:game.bullets.age,parameters:{...parameters},bullets});return bullets;};
  return{game,emissions,dispose(){game.destroy();resources.dispose();}};
}
function launchFormation(f,scenario,{canFire=()=>true,seed=73}={}){
  const events=[],rng=new TouhouRNG(seed),{game,emissions}=f;
  const [enemy]=spawnRoadFormation({game,stageId:scenario.stageId,difficulty:1,rng,canFire,
    wave:{id:'split-regression',sectionId:'split-regression',at:0,fireUntil:400,formation:'anchor',
      attack:scenario.attack,count:1,side:1,role:'guard',life:400},onAttack:event=>events.push(event)});
  let source;
  for(let i=0;i<100&&!source;i++){
    game.update(0);source=emissions.find(entry=>entry.parameters.type===scenario.parentType);
  }
  assert.ok(source,`${scenario.attack} launches its carrier through the real enemy update`);
  assert.equal(source.bullets.length,scenario.parentCount);
  assert.ok(source.bullets.every(live));
  return{enemy,source,events,rng,due:source.at+scenario.delay};
}
function finishSplit(f,launch,scenario,beforeUpdate=()=>{}){
  const {game,emissions}=f,start=game.bullets.nextId;
  while(game.bullets.age<launch.due){beforeUpdate();game.update(0);}
  assert.equal(game.bullets.nextId,start,'the children do not appear one frame early');
  const positions=launch.source.bullets.map(({x,y})=>({x,y}));
  beforeUpdate();game.update(0);
  const children=emissions.filter(entry=>entry.at===launch.due);
  assert.equal(game.bullets.nextId-start,scenario.children,'the authored delay does not gain an extra scheduler frame');
  assert.equal(children.length,scenario.parentCount);
  children.forEach((entry,index)=>assert.deepEqual({x:entry.parameters.x,y:entry.parameters.y},positions[index],
    'children use the flying carrier position'));
  assert.ok(launch.events.some(event=>event.source==='bullet'&&event.age===launch.source.at+scenario.delay&&event.count===scenario.children),
    'road attack tracing includes the delayed children');
}

for(const scenario of cases)test(`${scenario.attack} carriers split after the real fairy is defeated`,needsAssets,()=>{
  const f=actualFixture();
  try{
    const launch=launchFormation(f,scenario);
    launch.enemy.damage(100000,{kind:'split-regression'},f.game.context);
    assert.equal(launch.enemy.alive,false);
    // The shared authoring kit is routinely rebound by other actors and labs.
    const other=createDanmakuLab({difficulty:3,seed:999});
    kit.bind({game:other.game,difficulty:3,rng:other.game.rng,state:{},frame:700});
    finishSplit(f,launch,scenario);
    assert.equal(other.emitted,0,'a rebound shared kit cannot redirect this volley into another game');
  }finally{f.dispose();}
});

test('flying carriers keep their clock when the living fairy cannot fire or leaves the firing area',needsAssets,()=>{
  for(const reason of ['fire-cutoff','outside-area']){
    const f=actualFixture();let canFire=true;
    try{
      const scenario=cases[0],launch=launchFormation(f,scenario,{canFire:()=>canFire});
      if(reason==='fire-cutoff')canFire=false;
      const outside=()=>{if(reason==='outside-area'){
        launch.enemy.y=310;launch.enemy.motion.position.y=310;launch.enemy.animation.y=310;
      }};
      finishSplit(f,launch,scenario,outside);
      assert.equal(launch.enemy.alive,true,'the carrier no longer depends on the enemy attack update');
    }finally{f.dispose();}
  }
});

function stationaryCarrier(game,{x=0,y=100}={}){
  const author=new AttackKit().bind({game,difficulty:1,rng:game.rng,state:{}});
  return{author,bullet:author.shot(x,y,DOWN,0,T.ORB,C.RED,null,{safe:0})[0]};
}

test('cancelled carriers and recycled bullet slots cannot produce delayed children',()=>{
  for(const retirement of ['cancel','retire-and-reuse']){
    const lab=createDanmakuLab({capacity:2}),{game}=lab,{author,bullet}=stationaryCarrier(game);
    let fired=0;
    scheduleRoadSplit(author,8,[bullet],(parent,ownKit)=>{
      fired++;ownKit.shot(parent.x,parent.y,DOWN,1,T.BALL,C.BLUE,null,{safe:0});
    });
    if(retirement==='cancel')game.bullets.cancel(bullet,0);
    else{
      game.bullets.retire(bullet);
      const replacement=stationaryCarrier(game).bullet;
      assert.equal(replacement.slot,bullet.slot,'the retired pool slot is actually reused');
      assert.notEqual(replacement.id,bullet.id);
      assert.notEqual(replacement,bullet);
    }
    const emitted=lab.emitted;
    for(let frame=0;frame<20;frame++)lab.step(null);
    assert.equal(fired,0);assert.equal(lab.emitted,emitted);
  }
});

test('a public game pause freezes the pending carrier split until play resumes',needsAssets,()=>{
  const f=actualFixture();
  try{
    const scenario=cases[0],launch=launchFormation(f,scenario);
    launch.enemy.damage(100000,{kind:'split-regression'},f.game.context);
    f.game.update(Keys.PAUSE);
    assert.equal(f.game.paused,true);
    const age=f.game.bullets.age,frame=f.game.frame,count=f.game.bullets.nextId;
    for(let i=0;i<80;i++)f.game.update(0);
    assert.equal(f.game.frame,frame);assert.equal(f.game.bullets.age,age);assert.equal(f.game.bullets.nextId,count);
    f.game.update(Keys.PAUSE);
    for(let i=0;i<30&&f.game.paused;i++)f.game.update(0);
    assert.equal(f.game.paused,false);
    finishSplit(f,launch,scenario);
  }finally{f.dispose();}
});

test('director clear, stage restart and destroy cancel pending splits beyond the cancel circle',needsAssets,()=>{
  for(const action of ['_clear','_startStage','destroy']){
    const f=actualFixture(),{game}=f;
    const director=new CampaignDirector({stages:STAGES,midbosses:MIDBOSSES,mode:'stage-practice',seed:73}).attach(game);
    try{
      game.stage=null;
      const {author,bullet}=stationaryCarrier(game,{x:1000,y:100});bullet.autoBounds=false;
      let fired=0;scheduleRoadSplit(author,8,[bullet],()=>{fired++;});
      director[action](game);
      assert.ok(live(bullet),'the explicit lifecycle clear covers carriers outside the 640 px cancel radius');
      for(let i=0;i<16;i++)game.update(0);
      assert.equal(fired,0,`${action} prevents an old road from spawning children`);
    }finally{director.destroy();f.dispose();}
  }
});

test('covered scene cleanup and game destruction retire pending carrier work',needsAssets,()=>{
  for(const action of ['covered-stage','game-destroy']){
    const f=actualFixture(),{game}=f;
    try{
      const {author,bullet}=stationaryCarrier(game);let fired=0;
      scheduleRoadSplit(author,8,[bullet],()=>{fired++;});
      if(action==='covered-stage')CampaignScene.prototype.cleanStageActors.call(game);
      else game.destroy();
      for(let i=0;i<16;i++){
        // Explicit runner updates also prove that cancellation is final.
        game.tasks.update(game.context);game.bullets.age++;
      }
      assert.equal(fired,0);
      assert.equal(game.tasks.size,0);
    }finally{f.dispose();}
  }
});

test('clearing one game leaves another game split and its captured difficulty and RNG intact',()=>{
  const first=createDanmakuLab({seed:73}),second=createDanmakuLab({seed:91});
  const a=stationaryCarrier(first.game),b=stationaryCarrier(second.game),expected=new TouhouRNG(second.game.rng.state).unit();
  let firstRuns=0,secondRuns=0;
  a.author.bind({game:first.game,difficulty:0,rng:first.game.rng,state:{}});
  b.author.bind({game:second.game,difficulty:2,rng:second.game.rng,state:{}});
  scheduleRoadSplit(a.author,5,[a.bullet],()=>{firstRuns++;});
  scheduleRoadSplit(b.author,5,[b.bullet],(parent,ownKit)=>{
    secondRuns++;assert.equal(ownKit.pick(1,2,3,4),3);assert.equal(ownKit.unit(),expected);
    ownKit.shot(parent.x,parent.y,DOWN,1,T.BALL,C.BLUE,null,{safe:0});
  });
  b.author.bind({game:first.game,difficulty:0,rng:first.game.rng,state:{}});
  clearRoadSplits(first.game);
  for(let i=0;i<10;i++){first.step(null);second.step(null);}
  assert.equal(firstRuns,0);assert.equal(secondRuns,1);assert.equal(second.emitted,2);
});

test('interleaved games keep independent difficulty and RNG after the shared kit is rebound',()=>{
  const first=createDanmakuLab({seed:73}),second=createDanmakuLab({seed:91}),seen=[];
  for(const [lab,difficulty] of [[first,0],[second,3]]){
    kit.bind({game:lab.game,difficulty,rng:lab.game.rng,state:{}});
    const parents=kit.shot(0,100,DOWN,0,T.ORB,C.RED,null,{safe:0});
    const expected=new TouhouRNG(lab.game.rng.state).unit();
    scheduleRoadSplit(kit,5,parents,(parent,ownKit)=>{
      assert.equal(ownKit.game,lab.game);assert.equal(ownKit.unit(),expected);
      seen.push(difficulty);ownKit.ring(parent.x,parent.y,ownKit.pick(4,5,6,8),1,DOWN,T.BALL,C.BLUE,null,{safe:0});
    });
  }
  for(let i=0;i<10;i++){first.step(null);second.step(null);}
  assert.deepEqual(seen,[0,3]);assert.equal(first.emitted,5);assert.equal(second.emitted,9);
  assert.ok(first.live().filter(b=>b.type===T.BALL).every(b=>Math.abs(b.initialSpeed-.86)<1e-6));
  assert.ok(second.live().filter(b=>b.type===T.BALL).every(b=>Math.abs(b.initialSpeed-1.16)<1e-6));
});

test('the same seeded road and kill timing produce the same delayed geometry and author RNG',()=>{
  const simulate=seed=>{
    const lab=createDanmakuLab({seed}),rng=new TouhouRNG(seed),records=[];
    const [enemy]=spawnRoadFormation({game:lab.game,stageId:1,difficulty:1,rng,
      wave:{id:'seeded-split',sectionId:'seeded-split',at:0,fireUntil:400,formation:'anchor',attack:'lantern',count:1,side:1,role:'guard',life:400}});
    for(let frame=0;frame<100;frame++){
      lab.step(null);if(frame===40)enemy.damage(100000);
      if(frame>=83)records.push(lab.game.bullets.bullets.filter(live).map(b=>[b.id,b.type,b.color,b.x,b.y,b.angle]));
    }
    assert.equal(lab.emitted,6,'a killed fairy still completes one five-child lantern split');
    return{geometry:stateHash(records),rng:rng.state};
  };
  assert.deepEqual(simulate(73),simulate(73));assert.notDeepEqual(simulate(73),simulate(74));
});
