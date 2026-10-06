import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {createTouhouResources,TouhouGame,TouhouEnemy,TouhouBulletField,TouhouLaserField,TouhouRNG,
  TOUHOU_PLAYER_RULES,touhouCircleCollision} from '@ts-stg/thlib/touhou';
import {bossNonspellHealth,midbossNormalHealth,BOSS_NONSPELL_HEALTH,MIDBOSS_NORMAL_HEALTH} from '../src/boss-health.js';
import {NONSPELL_STYLES,updateThemedNonspell} from '../src/nonspells.js';
import {STAGES} from '../src/content.js';

const resources=()=>createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
const settle=r=>{for(const bank of Object.values(r.banks))bank.collect?.();};
const setupPlayer=p=>{p.setPosition(0,392);p.state=1;p.invulnerability.set(0);p.focusTimer.set(8);};
const gameFor=(r,character,power)=>new TouhouGame({banks:r.banks,font:r.font,sht:r.shots[character],styles:r.styles,character,power,seed:73});

test('unnamed damage budgets subtract the original shared-ring spell threshold, with explicit authored extensions',()=>{
  const original=[
    [[14200,2200],[14000,2000]],
    [[17600,2600],[17600,2600]],
    [[23000,3000],[23200,3200],[23200,3400]],
    [[22800,2800],[22800,2800],[22800,2500]],
    [[19500,3500],[19200,3200],[19200,3200]],
    [[21900,3900],[21900,3900],[20000,4000],[20000,4000],[17000,4000]],
    [[22000,4000],[22000,4000],[22000,4000],[22000,4000],[21000,5000],[21000,5000],[19500,3500],[22000,6000]],
  ];
  assert.deepEqual(BOSS_NONSPELL_HEALTH.map(row=>row.length),STAGES.map(stage=>stage.spells.length));
  for(let stage=1;stage<=7;stage++)for(let group=0;group<STAGES[stage-1].spells.length;group++){
    const [total,threshold]=original[stage-1][Math.min(group,original[stage-1].length-1)];
    assert.equal(bossNonspellHealth(stage,group),total-threshold);
  }
  assert.deepEqual(MIDBOSS_NORMAL_HEALTH,[11000,15000,16000,17000,22000,18000]);
  for(let stage=1;stage<=6;stage++)assert.equal(midbossNormalHealth(stage),MIDBOSS_NORMAL_HEALTH[stage-1]);
  for(const invalid of[0,8,1.5,'1'])assert.throws(()=>bossNonspellHealth(invalid,0),RangeError);
  for(const invalid of[-1,2,0.5,'0'])assert.throws(()=>bossNonspellHealth(1,invalid),RangeError);
  assert.throws(()=>midbossNormalHealth(7),RangeError,'Extra has spells, not a normal midboss HP budget');
});

test('imported Reimu and Marisa shots consume real normal HP and preserve a substantial firing interval',t=>{
  const r=resources();try{
    for(const character of[0,1])for(const power of[200,400]){
      const g=gameFor(r,character,power);setupPlayer(g.player);
      const hp=bossNonspellHealth(1,0),boss=g.spawnEnemy({x:0,y:105,hp,radius:16,script:30,directional:false,damageInvulnerability:0});
      const lives=g.player.lives;let frames=0,firstHit=-1,at120=0,damageTotal=0;
      while(boss.alive&&frames<2100){
        const before=boss.hp;g.update(Keys.SHOOT|Keys.FOCUS);
        if(firstHit<0&&boss.hp<before)firstHit=frames;
        damageTotal+=Math.max(0,before-boss.hp);frames++;
        if(frames===120)at120=damageTotal;
        assert.equal(g.player.invulnerability.current,0);assert.equal(g.player.state,1);
      }
      assert.equal(boss.alive,false,'Only common weapon hits exhaust the normal HP');
      assert.ok(firstHit>=20,'Projectiles must actually travel to the target');
      assert.ok(frames>NONSPELL_STYLES[0].cycle,'A healthy first group lasts beyond one full authored movement/fire/recovery phrase');
      assert.ok(frames<900,'The first group remains killable without Bomb at P2 or P4');
      assert.ok(damageTotal>=hp);assert.equal(boss.health.flags&1,0,'Normal health has no sevenfold spell scaling');
      assert.equal(g.player.lives,lives);assert.equal(g.player.power,power);
      t.diagnostic(JSON.stringify({case:'stationary-range',character,power,hp,frames,seconds:frames/60,firstHit,
        steadyDps:(damageTotal-at120)/((frames-120)/60)}));
      g.destroy();settle(r);
    }
  }finally{r.dispose();}
});

/** Plan a conservative real-speed input route against the actual public field.
 * Address locks are still aimed at x=0: require that exact player position on
 * the preceding frame, rather than changing aim or disabling hostile shots.
 * Parent links minimise horizontal distance from the Boss for sensible shooting.
 */
function firstGroupRoute(r,frames){
  const field=new TouhouBulletField({bank:r.banks.bullet,styles:r.styles});
  const lasers=new TouhouLaserField({bank:r.banks.bullet,styles:r.styles});
  const player={x:0,y:392},g={player,bullets:field,lasers,rng:new TouhouRNG(73)},rng=new TouhouRNG(73);
  const boss=new TouhouEnemy({id:1,bank:r.banks.enemy,x:0,y:105,hp:bossNonspellHealth(1,0),radius:16,script:30,directional:false});
  const state={},slices=[],positions=[],anchors=new Set();
  for(let frame=0;frame<frames;frame++){
    updateThemedNonspell({game:g,boss,frame,difficulty:1,stageId:1,phaseIndex:0,state,rng,
      onAttack:event=>{if(event.kind==='lock')anchors.add(Math.max(0,event.frame-1));}});
    boss.update({enemyContactBlocked:true});field.update(null,{});lasers.update(null,{});
    slices.push(field.bullets.filter(b=>[1,2].includes(b.state)&&b.collisionEnabled).map(b=>({x:b.x,y:b.y,radius:b.radius})));
    positions.push(boss.x);
  }
  assert.equal(lasers.count,0,'This representative lamp score uses public bullets only');
  const width=171,start=85,xs=Array.from({length:width},(_,i)=>-170+i*2),parents=[];
  const blocked=(slice,x)=>slice.some(b=>Math.abs(b.x-x)<24&&Math.abs(b.y-392)<24&&
    touhouCircleCollision(x,392,TOUHOU_PLAYER_RULES.focusRadius+2,b.x,b.y,b.radius)===1);
  let costs=new Float64Array(width).fill(Infinity);costs[start]=0;
  for(let frame=0;frame<frames;frame++){
    const next=new Float64Array(width).fill(Infinity),row=new Int16Array(width).fill(-1);
    for(let from=0;from<width;from++)if(Number.isFinite(costs[from]))for(const offset of[0,-1,1]){
      const to=from+offset;if(to<0||to>=width||anchors.has(frame)&&to!==start)continue;
      const midpoint=(xs[from]+xs[to])/2;
      if(blocked(slices[frame],xs[to])||blocked(slices[frame],midpoint)||frame&&blocked(slices[frame-1],midpoint))continue;
      const cost=costs[from]+Math.abs(xs[to]-positions[frame])*.01+Math.abs(offset)*.05;
      if(cost<next[to]){next[to]=cost;row[to]=from;}
    }
    assert.ok(next.some(Number.isFinite),`There must be a reachable, margin-protected input path at frame ${frame}`);
    parents.push(row);costs=next;
  }
  let index=0;for(let i=1;i<width;i++)if(costs[i]<costs[index])index=i;
  const route=[];for(let frame=frames-1;frame>=0;frame--){route[frame]=xs[index];index=parents[frame][index];}
  for(const b of field.bullets)field.retire(b);boss.animation.destroy();settle(r);return route;
}

test('both real players can shoot through complete first-group phrases with Boss motion, live aimed fire and no invulnerability',t=>{
  const r=resources();try{
    const route=firstGroupRoute(r,2100);
    for(const character of[0,1])for(const power of[200,400]){
      const g=gameFor(r,character,power);setupPlayer(g.player);
      const hp=bossNonspellHealth(1,0),boss=g.spawnEnemy({x:0,y:105,hp,radius:16,script:30,directional:false,damageInvulnerability:0});
      let completed=false,frame=0,shots=0,lastVolley=-1;
      const state={},rng=new TouhouRNG(73),lives=g.player.lives;
      g.registerBoss(boss,{onDefeated:()=>{completed=true;}});g.startBossCombat(boss);
      g.stage=()=>updateThemedNonspell({game:g,boss,frame,difficulty:1,stageId:1,phaseIndex:0,state,rng,
        onAttack:event=>{if(event.commands){shots+=event.count;lastVolley=frame;}}});
      while(!completed&&frame<route.length){
        const delta=route[frame]-g.player.x;
        assert.ok(Math.abs(delta)<=2,'Each witness step fits public focused speed');
        g.update(Keys.SHOOT|Keys.FOCUS|(delta<0?Keys.LEFT:delta>0?Keys.RIGHT:0));
        assert.equal(g.player.x,route[frame]);assert.equal(g.player.invulnerability.current,0);
        assert.equal(g.player.state,1,'Actual collisions must not trigger deathbomb, Miss or respawn');frame++;
      }
      assert.equal(completed,true,'The battle finishes solely through imported weapons and public damage');
      assert.ok(frame>NONSPELL_STYLES[0].cycle,'Both players see a full movement, attacks and recovery phrase');
      assert.ok(lastVolley>=NONSPELL_STYLES[0].lastVolley);assert.ok(shots>40);
      assert.equal(g.player.lives,lives);assert.equal(g.player.power,power);assert.ok(boss.hp<=0);
      assert.equal(g.spell.active,false);assert.equal(g.player.bomb?.alive??false,false);
      t.diagnostic(JSON.stringify({case:'live-first-group',character,power,hp,frames:frame,seconds:frame/60,hostileShots:shots,lastVolley}));
      g.destroy();settle(r);
    }
  }finally{r.dispose();}
});
