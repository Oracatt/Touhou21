import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys,stateHash} from '@ts-stg/thlib';
import {createTouhouResources,TouhouGame,TouhouEnemy,TouhouBulletField,TouhouLaserField,TouhouRNG,
  TOUHOU_BULLET_STYLES,TOUHOU_PLAYER_RULES,TOUHOU_PLAYER_DATA,touhouCircleCollision,touhouLaserIntersectsCircle} from '@ts-stg/thlib/touhou';
import {NONSPELL_STYLES,updateThemedNonspell} from '../src/nonspells.js';
import {updateNonspellPattern} from '../src/patterns.js';
import {STAGES} from '../src/content.js';

const makeResources=()=>createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
const settle=(resources)=>{for(const bank of Object.values(resources.banks))bank?.collect?.();};

/** Actual public field/ANM/motion trace. Player collision is queried below
 * using public geometry; fields update without a player so hits cannot erase
 * the evidence. The target at the attack update precedes that frame's move. */
function trace(resources,{stageId,difficulty=1,phaseIndex=0,seed=73,frames=1700,path=null}={}){
  const events=[],positions=[],slices=[],state={},style=NONSPELL_STYLES[stageId-1];
  const game={player:{x:0,y:392},rng:new TouhouRNG(seed)};
  game.bullets=new TouhouBulletField({bank:resources.banks.bullet,styles:resources.styles});
  game.lasers=new TouhouLaserField({bank:resources.banks.bullet,styles:resources.styles});
  const boss=new TouhouEnemy({id:1,bank:resources.banks.enemy,script:30,directional:false,x:0,y:105,hp:999999});
  let peak=0;
  for(let frame=0;frame<frames;frame++){
    game.player.x=path?.[Math.max(0,frame-1)]??0;game.bullets.player=game.player;
    updateThemedNonspell({game,boss,frame,difficulty,stageId,phaseIndex,state,onAttack:event=>events.push(event)});
    boss.update({enemyContactBlocked:true});game.bullets.update(null,{});game.lasers.update(null,{});
    const bullets=game.bullets.bullets.filter(b=>[1,2].includes(b.state)&&b.collisionEnabled).map(b=>({id:b.id,x:b.x,y:b.y,radius:b.radius,type:b.type,vx:b.vx,vy:b.vy}));
    const lasers=game.lasers.lasers.filter(l=>l.alive).map(l=>({...l,position:{...l.position},p:{...l.p}}));
    slices.push({bullets,lasers});positions.push({x:boss.x,y:boss.y});peak=Math.max(peak,game.bullets.count);
    for(const b of bullets){assert.equal(b.radius,TOUHOU_BULLET_STYLES[b.type].radius);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));}
  }
  const hash=stateHash(events.filter(e=>e.commands).map(({frame,x,y,angle,speed,count,angleStep,type,commands})=>[frame,x,y,angle,speed,count,angleStep,type,commands]));
  for(let drain=0;drain<800&&(game.bullets.count||game.lasers.count);drain++){game.bullets.update(null,{});game.lasers.update(null,{});}
  assert.equal(game.bullets.count,0,'After the score stops, public bounds retire every remaining shot');
  assert.equal(game.lasers.count,0,'All warned lasers finish their public shrink lifecycle');
  for(const b of game.bullets.bullets)game.bullets.retire(b);for(const l of game.lasers.lasers)game.lasers.retire(l);boss.animation.destroy();settle(resources);
  return{events,positions,slices,peak,hash,rng:game.rng.state,style};
}
const blocked=(slice,x,y=392,radius=TOUHOU_PLAYER_RULES.focusRadius+2)=>
  slice.bullets.some(b=>Math.abs(b.x-x)<24&&Math.abs(b.y-y)<24&&touhouCircleCollision(x,y,radius,b.x,b.y,b.radius)===1)||
  slice.lasers.some(l=>touhouLaserIntersectsCircle(l,x,y,radius));

/** Reachability at the real Reimu focus speed, constrained to one lower row.
 * Every saved aim keeps its original bait by requiring x=0 one frame before
 * that lock, so the resulting witness can be replayed against live retargeting.
 * Public hit geometry uses an additional 2px player-radius margin. */
function findWitness(trace){
  const step=TOUHOU_PLAYER_DATA[0].speeds[1],xs=Array.from({length:171},(_,i)=>-170+i*step),start=85;
  assert.equal(step,2);const anchors=new Set(trace.events.filter(e=>e.kind==='lock').map(e=>Math.max(0,e.frame-1)));
  let frontier=new Set([start]),previous=null;const parents=[],widths=[];
  for(let frame=0;frame<trace.slices.length;frame++){
    const row=new Int16Array(xs.length).fill(-1),current=trace.slices[frame],next=new Set();
    for(const from of frontier)for(const offset of[0,-1,1]){
      const to=from+offset;if(to<0||to>=xs.length||next.has(to)||anchors.has(frame)&&to!==start||blocked(current,xs[to]))continue;
      const midpoint=(xs[from]+xs[to])/2;
      if(blocked(current,midpoint)||previous&&blocked(previous,midpoint))continue;
      row[to]=from;next.add(to);
    }
    assert.ok(next.size,`No continuously reachable lower-row path at frame ${frame} (${trace.style.bossId})`);
    parents.push(row);widths.push(next.size);frontier=next;previous=current;
  }
  let index=[...frontier].sort((a,b)=>Math.abs(a-start)-Math.abs(b-start))[0];const path=[];
  for(let frame=parents.length-1;frame>=0;frame--){path[frame]=xs[index];index=parents[frame][index];}
  return{path,minWidth:Math.min(...widths),anchors};
}

test('seven Boss identities preserve different motifs and movement routes across their unnamed groups',()=>{
  const resources=makeResources();try{
    assert.equal(NONSPELL_STYLES.length,7);assert.equal(new Set(NONSPELL_STYLES.map(s=>s.id)).size,7);
    const rows=NONSPELL_STYLES.map((style,i)=>trace(resources,{stageId:i+1,frames:style.cycle*3,difficulty:i===6?4:1}));
    assert.equal(new Set(rows.map(r=>r.hash)).size,7);assert.equal(new Set(rows.map(r=>stateHash(r.positions))).size,7);
    for(let i=0;i<rows.length;i++){
      const r=rows[i],style=NONSPELL_STYLES[i];assert.equal(style.bossId,STAGES[i].bossId);
      const shots=r.events.filter(e=>e.commands);assert.ok(shots.reduce((n,e)=>n+e.count,0)>70);
      assert.ok(shots.every(e=>e.localFrame>style.moveFrames&&e.localFrame<=style.lastVolley),'Movement and recovery do not emit new fire');
      for(const e of shots){assert.equal(e.commands[0][8],1);assert.equal(e.minimumPlayerDistanceSquared,4096);assert.ok(e.speed<=3.5);assert.ok(!e.commands.some(op=>[29,31].includes(op[8])),'No altered hitboxes or continuous homing');}
      const later=trace(resources,{stageId:i+1,frames:style.cycle*3,difficulty:i===6?4:1,phaseIndex:(STAGES[i].spells.length-1)*2});
      assert.notEqual(r.hash,later.hash,'Later group develops the same motif');assert.equal(new Set(later.events.map(e=>e.style)).size,1);
      assert.ok(style.cycle-style.lastVolley>=100,'Every motif retains a substantial reposition/recovery window');
    }
  }finally{resources.dispose();}
});

test('all main unnamed groups and four difficulties remain deterministic, finite and within public pools',t=>{
  const resources=makeResources();try{
    for(let stageId=1;stageId<=7;stageId++){
      const style=NONSPELL_STYLES[stageId-1],difficulties=stageId===7?[4]:[0,1,2,3],groupHashes=new Set();let peak=0;
      for(const difficulty of difficulties)for(let chapter=0;chapter<STAGES[stageId-1].spells.length;chapter++){
        const r=trace(resources,{stageId,difficulty,phaseIndex:chapter*2,frames:style.cycle*3});peak=Math.max(peak,r.peak);assert.ok(r.peak<500);
        if(difficulty===(stageId===7?4:1))groupHashes.add(r.hash);
      }
      assert.equal(groupHashes.size,STAGES[stageId-1].spells.length,'Every group has a distinct phrase within the same Boss motif');
      const a=trace(resources,{stageId,frames:style.cycle*3}),b=trace(resources,{stageId,frames:style.cycle*3});assert.equal(a.hash,b.hash);assert.equal(a.rng,b.rng);
      const other=trace(resources,{stageId,seed:74,frames:style.cycle*3});assert.notEqual(a.hash,other.hash,'Seed affects actual posted passage position');
      t.diagnostic(JSON.stringify({stage:stageId,boss:style.bossId,groups:STAGES[stageId-1].spells.length,difficulties,peak}));
    }
  }finally{resources.dispose();}
});

test('Easy and Normal have live-replayable focus-speed paths with margin, including the strongest group',t=>{
  const resources=makeResources();try{
    for(let stageId=1;stageId<=6;stageId++)for(const difficulty of[0,1]){
      const phaseIndex=(STAGES[stageId-1].spells.length-1)*2,frames=Math.max(1700,NONSPELL_STYLES[stageId-1].cycle*4);
      const baseline=trace(resources,{stageId,difficulty,phaseIndex,frames}),witness=findWitness(baseline);
      const replay=trace(resources,{stageId,difficulty,phaseIndex,frames,path:witness.path});assert.equal(replay.hash,baseline.hash,'Witness does not change any locked shot address');
      let traveled=0;
      for(let frame=0;frame<frames;frame++){
        assert.equal(blocked(replay.slices[frame],witness.path[frame]),false);const prior=frame?witness.path[frame-1]:0;
        assert.ok(Math.abs(witness.path[frame]-prior)<=2,'No teleporting, high-speed move or invulnerability');traveled+=Math.abs(witness.path[frame]-prior);
      }
      assert.ok(traveled>20,'The path really evades active aimed fire');
      t.diagnostic(JSON.stringify({stage:stageId,difficulty,phaseIndex,frames,focusSpeed:2,radiusMargin:2,traveled,peak:replay.peak}));
    }
  }finally{resources.dispose();}
});

test('an evasion witness also runs through the actual common player controls without Bomb or Miss',()=>{
  const resources=makeResources();try{
    for(let stageId=1;stageId<=6;stageId++){
      const frames=1700,phaseIndex=(STAGES[stageId-1].spells.length-1)*2,baseline=trace(resources,{stageId,difficulty:1,phaseIndex,frames}),{path}=findWitness(baseline);
      const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:73});
      game.player.state=1;game.player.fixedX=0;game.player.fixedY=392*128;game.player.x=0;game.player.y=392;game.player.invulnerability.set(0);
      const boss=game.spawnEnemy({x:0,y:105,hp:999999,script:30,directional:false});boss.invulnerable=true;
      const state={},lives=game.player.lives;
      let frame=0;game.stage=()=>updateNonspellPattern({game,boss,frame:frame++,difficulty:1,stageId,phaseIndex,state});
      for(let i=0;i<frames;i++){
        const offset=path[i]-game.player.x;game.update(Keys.FOCUS|(offset<0?Keys.LEFT:offset>0?Keys.RIGHT:0));
        assert.equal(game.player.x,path[i],'Actual focused movement exactly follows the reachable witness');assert.equal(game.player.invulnerability.current,0);
        assert.equal(game.player.state,1,`${stageId} must not enter the deathbomb or Miss branch`);
      }
      assert.equal(game.player.lives,lives);game.destroy();settle(resources);
    }
  }finally{resources.dispose();}
});
