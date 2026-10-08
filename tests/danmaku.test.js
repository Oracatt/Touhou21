import test from 'node:test';
import assert from 'node:assert/strict';
import {stateHash} from '@ts-stg/thlib';
import {TOUHOU_BULLET_STYLES} from '@ts-stg/thlib/touhou';
import {STAGES,MIDBOSSES} from '../src/content.js';
import {SPELL_PATTERNS,MIDBOSS_SPELL_PATTERNS,NONSPELL_PATTERNS,MIDBOSS_NONSPELL_PATTERNS,STAGE_PATTERN_OFFSETS,ATTACK_START} from '../src/patterns.js';
import {AttackKit,SPEED_SCALE} from '../src/danmaku.js';
import {runAttack} from '../tools/danmaku-lab.js';
import {attackCatalog} from '../tools/danmaku-catalog.js';

const scripted=attackCatalog().filter(entry=>entry.kind!=='road');
const difficultiesOf=entry=>entry.stageId===7?[4]:[0,1,2,3];
const signature=lab=>stateHash(lab.game.bullets.bullets.filter(b=>b.state).slice(0,40).map(b=>[b.type,b.color,Math.round(b.x*8),Math.round(b.y*8)]));

test('the attack catalogue covers every card, ordinary attack and midboss phase in the content',()=>{
  assert.equal(SPELL_PATTERNS.length,31);assert.equal(new Set(SPELL_PATTERNS.map(p=>p.id)).size,31);
  assert.deepEqual(STAGE_PATTERN_OFFSETS,[0,2,5,8,12,16,21]);
  for(const stage of STAGES){
    assert.equal(SPELL_PATTERNS.filter(p=>p.stageId===stage.id).length,stage.spells.length,`stage ${stage.id} cards`);
    assert.equal(NONSPELL_PATTERNS[stage.id-1].length,stage.spells.length,`stage ${stage.id} ordinary attacks pair with cards`);
    const midboss=MIDBOSSES.find(m=>m.stageId===stage.id);
    assert.equal(MIDBOSS_SPELL_PATTERNS.filter(p=>p.stageId===stage.id).length,midboss.spells.length,`stage ${stage.id} midboss cards`);
    assert.equal(!!MIDBOSS_NONSPELL_PATTERNS[stage.id-1],midboss.nonspell,`stage ${stage.id} midboss ordinary attack`);
  }
  const ids=[...SPELL_PATTERNS,...MIDBOSS_SPELL_PATTERNS,...NONSPELL_PATTERNS.flat(),...MIDBOSS_NONSPELL_PATTERNS.filter(Boolean)].map(p=>p.id);
  assert.equal(new Set(ids).size,ids.length,'every attack has its own authored function');
  assert.equal(ATTACK_START.nonspell,60);assert.ok(ATTACK_START.spell>=60,'cards wait for the public charge release');
});

test('every attack runs its full duration on every difficulty with public styles, finite geometry and pool headroom',t=>{
  for(const entry of scripted)for(const difficulty of difficultiesOf(entry)){
    const result=runAttack({update:entry.create({difficulty,seed:73,boss:standIn()}),frames:entry.frames,difficulty,pilot:false,drain:0,
      onFrame:(lab,frame)=>{if(frame%30)return;for(const b of lab.game.bullets.bullets)if(b.state){
        assert.equal(b.radius,TOUHOU_BULLET_STYLES[b.type].radius,`${entry.key} keeps the public hitbox`);
        assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y),`${entry.key} finite position`);}}});
    assert.ok(result.emitted>0||result.lasers>0,`${entry.key}/${difficulty} attacks`);
    assert.ok(result.peak<1400,`${entry.key}/${difficulty} keeps public pool headroom (peak ${result.peak})`);
  }
  t.diagnostic(`${scripted.length} attacks`);
});

test('same seed reproduces each attack exactly; the author stream is the director RNG, not Math.random',()=>{
  const random=Math.random;Math.random=()=>{throw new Error('Math.random is not deterministic');};
  try{
    for(const entry of scripted){
      const difficulty=entry.stageId===7?4:1,run=seed=>{let hash='';runAttack({update:entry.create({difficulty,seed,boss:standIn()}),
        frames:Math.min(entry.frames,900),difficulty,pilot:false,onFrame:(lab,frame)=>{if(frame===899||frame===entry.frames-1)hash=signature(lab);}});return hash;};
      assert.equal(run(73),run(73),`${entry.key} reproduces`);
    }
  }finally{Math.random=random;}
});

test('higher difficulties emit more pressure for every main-campaign attack',()=>{
  for(const entry of scripted.filter(e=>e.stageId<=6)){
    const emitted=[0,1,2,3].map(difficulty=>runAttack({update:entry.create({difficulty,seed:73,boss:standIn()}),frames:Math.min(entry.frames,1800),difficulty,pilot:false}).emitted);
    for(let i=1;i<4;i++)assert.ok(emitted[i]>=emitted[i-1],`${entry.key}: difficulty ${i} >= ${i-1} (${emitted.join('/')})`);
    assert.ok(emitted[3]>emitted[0]*1.3,`${entry.key}: Lunatic is substantially denser than Easy (${emitted.join('/')})`);
  }
});

test('a heuristic dodging pilot clears every Normal attack, and Extra with at most one slip per card',t=>{
  let extraSlips=0;
  for(const entry of scripted){
    const difficulty=entry.stageId===7?4:1;
    const result=runAttack({update:entry.create({difficulty,seed:73,boss:standIn()}),frames:entry.frames,difficulty});
    if(difficulty===4){assert.ok(result.hits<=1,`${entry.key}: Extra pilot hits ${result.hits} at ${result.hitTimes}`);extraSlips+=result.hits;}
    else assert.equal(result.hits,0,`${entry.key}: Normal pilot hit at ${result.hitTimes}`);
  }
  assert.ok(extraSlips<=3,'Extra remains learnable as a whole');t.diagnostic(`extra pilot slips ${extraSlips}`);
});

test('the authoring kit scales launch and command speeds by difficulty without rotating trajectories',()=>{
  const k=new AttackKit(),emitted=[];
  const game={player:{x:0,y:400},rng:null,bullets:{emit:p=>{emitted.push(p);return[];}},lasers:{spawnInfinite:()=>null,spawnStraight:()=>null}};
  for(const difficulty of[0,1,2,3,4]){
    k.bind({game,frame:0,difficulty,state:{}});
    k.shot(0,0,Math.PI/2,2,4,1,[k.stopAim(30,2.5)]);
    const p=emitted.at(-1),view=new DataView(new ArrayBuffer(4));view.setUint32(0,p.commands[1][1],true);
    assert.ok(Math.abs(p.speed-2*SPEED_SCALE[difficulty])<1e-9);assert.ok(Math.abs(view.getFloat32(0,true)-2.5*SPEED_SCALE[difficulty])<1e-5);
    assert.equal(p.angle,Math.PI/2);assert.equal(p.commands[0][8],1,'public birth command first');
    assert.ok(p.minimumPlayerDistanceSquared>=1024,'no point-blank spawns');
  }
  k.bind({game,frame:0,difficulty:2,state:{}});assert.equal(k.pick(1,2,3,4,5),3);
  k.bind({game,frame:0,difficulty:4,state:{}});assert.equal(k.pick(1,2,3,4,5),5);assert.equal(k.pick(1,2,3,4),4);
});

function standIn(){return{x:0,y:112,hp:1e9,invulnerable:true,alive:true,motion:{position:{x:0,y:112,z:0},angle:0,speed:0,flags:0,delta:{x:0,y:0,z:0}},animation:{x:0,y:112}};}
