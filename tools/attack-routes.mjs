/** QA only: search for a witness using actual thlib trajectories and replay it
 * with real focused directional inputs. This is not a player assist in-game. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Keys} from '@ts-stg/thlib';
import {TouhouGame,TouhouRNG,createTouhouResources,touhouCircleCollision,getTouhouLaserCollisionSegments} from '@ts-stg/thlib/touhou';
import {rectangleCircle,mul} from '../packages/thlib/src/touhou/math.js';
import {updateSpellPattern,updateMidbossSpellPattern,updateNonspellPattern} from '../src/patterns.js';

const X=-176,Y=288,WIDTH=177,HEIGHT=73,COLS=45,ROWS=19,N=COLS*ROWS,STEP=4;
const moves=[{dx:0,dy:0,key:0},{dx:-1,dy:0,key:Keys.LEFT},{dx:1,dy:0,key:Keys.RIGHT},
  {dx:0,dy:-1,key:Keys.UP},{dx:0,dy:1,key:Keys.DOWN}];
const radius=3,margin=1.5;
export const ATTACK_ROUTE_QA_VERSION=2;
export const ATTACK_ROUTE_GRID=Object.freeze({minX:X,maxX:X+(WIDTH-1)*2,minY:Y,maxY:Y+(HEIGHT-1)*2,
  occupancySpacing:2,nodeSpacing:8,framesPerMove:STEP,startX:0,startY:400,focusSpeed:2,playerRadius:radius,margin,
  directions:'stay / left / right / up / down; no diagonals, shoot or Bomb'});
function paddedBulletRadius(b){
  const r=b.scaleEnabled?mul(b.radius,b.scale):b.radius,reach=Math.sqrt(radius*radius+r*r)+margin;
  return {reach,paddedRadius:Math.sqrt(reach*reach-radius*radius)};
}
/** Pure post-update query on the real current geometry. The padding is a QA
 * clearance requirement, never a change to the public player's hit radius. */
export function attackMarginCollision(game,x,y){
  for(const b of game.bullets.bullets){
    if(![1,2].includes(b.state)||!b.collisionEnabled||b.radius<=0)continue;
    if(touhouCircleCollision(x,y,radius,b.x,b.y,paddedBulletRadius(b).paddedRadius)===1)
      return {kind:'bullet',id:b.id};
  }
  for(const l of game.lasers.lasers){
    if(!l.alive||l.collisionEnabled===false)continue;
    if(getTouhouLaserCollisionSegments(l.kind===2?{...l}:l).some(s=>
      rectangleCircle(s.position.x,s.position.y,s.length,s.width,s.angle,x,y,radius+margin)))
      return {kind:'laser',id:l.id};
  }
  return null;
}
/** A physically safe old prefix may nevertheless cross the enlarged QA
 * geometry. Only commit frames proved safe under the same clearance test. */
export function backtrackAttackPrefix(prefixFrames,firstMarginBlock,{lookback=STEP}={}){
  if(!firstMarginBlock||firstMarginBlock.frame>=prefixFrames)return prefixFrames;
  return Math.floor(Math.max(0,firstMarginBlock.frame-lookback)/STEP)*STEP;
}
function make(spec){
  const resources=createTouhouResources({readText:p=>fs.readFileSync(p,'utf8'),loadTexture:()=>1});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,
    rng:new TouhouRNG(spec.seed??73),visualRng:new TouhouRNG(19),power:400});
  const boss=game.spawnEnemy({x:0,y:100,hp:1000000,directional:false,damageInvulnerability:0});
  boss.invulnerable=true;game.setBoss(boss);game.startBossCombat();
  game.player.focusTimer.set(4);game.player.invulnerability.set(0);
  assert.equal(game.player.speeds[1]/128,2,'This route grid is specific to the public Reimu focused speed');
  assert.equal(game.player.focusRadius,radius);assert.equal(game.player.x,0);assert.equal(game.player.y,400);
  const state={};let frame=0;
  game.stage=()=>{const fn=spec.kind==='nonspell'?updateNonspellPattern:spec.kind==='midboss'?updateMidbossSpellPattern:updateSpellPattern;
    fn({game,boss,frame:frame++,difficulty:spec.difficulty,stageId:spec.stageId,spellIndex:spec.spellIndex??0,phaseIndex:spec.phaseIndex??0,state});};
  return{game,dispose(){game.destroy();resources.dispose();}};
}
export function attackOccupancy(game){
  const grid=new Uint8Array(WIDTH*HEIGHT);
  const mark=(minX,maxX,minY,maxY,hit)=>{
    const x0=Math.max(0,Math.ceil((minX-X)/2)),x1=Math.min(WIDTH-1,Math.floor((maxX-X)/2));
    const y0=Math.max(0,Math.ceil((minY-Y)/2)),y1=Math.min(HEIGHT-1,Math.floor((maxY-Y)/2));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(hit(X+x*2,Y+y*2))grid[y*WIDTH+x]=1;
  };
  for(const b of game.bullets.bullets){
    // Protection controls subsequent projectile retirement, not the player's
    // initial circle query. Keeping these bodies is conservative and faithful.
    if(![1,2].includes(b.state)||!b.collisionEnabled||b.radius<=0)continue;
    const {reach,paddedRadius}=paddedBulletRadius(b);
    mark(b.x-reach,b.x+reach,b.y-reach,b.y+reach,(x,y)=>touhouCircleCollision(x,y,radius,b.x,b.y,paddedRadius)===1);
  }
  for(const l of game.lasers.lasers){
    if(!l.alive||l.collisionEnabled===false)continue;
    for(const s of getTouhouLaserCollisionSegments(l.kind===2?{...l}:l)){
      const rx=Math.abs(Math.cos(s.angle))*s.length/2+Math.abs(Math.sin(s.angle))*s.width/2+radius+margin;
      const ry=Math.abs(Math.sin(s.angle))*s.length/2+Math.abs(Math.cos(s.angle))*s.width/2+radius+margin;
      mark(s.position.x-rx,s.position.x+rx,s.position.y-ry,s.position.y+ry,
        (x,y)=>rectangleCircle(s.position.x,s.position.y,s.length,s.width,s.angle,x,y,radius+margin));
    }
  }
  return grid;
}
export function findAttackRoute(grids,{referenceMasks=null,prefixFrames=0}={}){
  let costs=new Float64Array(N).fill(Infinity);costs[14*COLS+22]=0;const history=[];
  let minimumReachable=N;
  for(let start=0;start<grids.length;start+=STEP){
    const next=new Float64Array(N).fill(Infinity),parents=new Uint16Array(N).fill(65535);
    for(let source=0;source<N;source++){
      if(!Number.isFinite(costs[source]))continue;const sx=source%COLS,sy=Math.floor(source/COLS);
      for(const m of moves){const tx=sx+m.dx,ty=sy+m.dy;if(tx<0||tx>=COLS||ty<0||ty>=ROWS)continue;
        if(start<prefixFrames&&(referenceMasks?.[start]??Keys.FOCUS)!==(Keys.FOCUS|m.key))continue;
        let safe=true;
        for(let f=0;f<STEP&&start+f<grids.length;f++){
          const px=sx*4+m.dx*(f+1),py=sy*4+m.dy*(f+1);
          if(grids[start+f][py*WIDTH+px]){safe=false;break;}
        }
        if(!safe)continue;
        const target=ty*COLS+tx,cost=costs[source]+(m.key?.3:0)+Math.abs(ty-14)*.008;
        if(cost<next[target]){next[target]=cost;parents[target]=source;}
      }
    }
    const reachable=next.reduce((n,v)=>n+Number.isFinite(v),0);minimumReachable=Math.min(minimumReachable,reachable);
    if(!reachable)return{passed:false,blockedFrame:start,minimumReachable};
    history.push(parents);costs=next;
  }
  let cursor=0;for(let i=1;i<N;i++)if(costs[i]<costs[cursor])cursor=i;
  const masks=new Uint16Array(grids.length);let travel=0;
  for(let chunk=history.length-1;chunk>=0;chunk--){
    const from=history[chunk][cursor],dx=cursor%COLS-from%COLS,dy=Math.floor(cursor/COLS)-Math.floor(from/COLS);
    const m=moves.find(m=>m.dx===dx&&m.dy===dy);if(m.key)travel+=8;
    for(let f=chunk*STEP;f<Math.min(grids.length,(chunk+1)*STEP);f++)masks[f]=Keys.FOCUS|m.key;
    cursor=from;
  }
  return{passed:true,masks,travel,minimumReachable};
}
export function replayAttackRoute(spec,masks,{plan=false}={}){
  assert.ok(Number.isSafeInteger(spec.frames)&&spec.frames>0);
  if(masks){assert.equal(masks.length,spec.frames,'Witness must specify every frame');
    const allowed=new Set(moves.map(move=>Keys.FOCUS|move.key));
    for(const mask of masks)assert.ok(allowed.has(mask),'Witness only accepts focused cardinal movement or stay');}
  const f=make(spec),g=f.game,grids=[];let misses=0,hits=0,firstHit=null,peak=0;
  const positions=[],projectileHash=createHash('sha256');let protectedCollisionFrames=0,marginBlockedFrames=0,firstMarginBlock=null;
  let expectedX=0,expectedY=400,positionMismatches=0;const initialLives=g.player.lives;
  g.context.bossSuppressed=plan;
  const event=g.onEvent;g.onEvent=(name,data)=>{if(name==='miss')misses++;if(name==='hit'){hits++;firstHit??={frame:g.frame,x:data.x,y:data.y};}event?.(name,data);};
  for(let frame=0;frame<spec.frames;frame++){
    g.update(masks?.[frame]??Keys.FOCUS);peak=Math.max(peak,g.bullets.count);
    const move=moves.find(move=>(Keys.FOCUS|move.key)===(masks?.[frame]??Keys.FOCUS));expectedX+=move.dx*2;expectedY+=move.dy*2;
    if(g.player.x!==expectedX||g.player.y!==expectedY)positionMismatches++;
    positions.push([g.player.x,g.player.y]);
    const marginBlock=attackMarginCollision(g,g.player.x,g.player.y);
    if(marginBlock){marginBlockedFrames++;firstMarginBlock??={frame,x:g.player.x,y:g.player.y,...marginBlock};}
    if(g.player.invulnerability.current>0||g.player.state!==1)protectedCollisionFrames++;
    projectileHash.update(JSON.stringify([g.frame,g.bullets.bullets.filter(b=>[1,2].includes(b.state)).map(b=>[b.id,b.state,b.x,b.y,b.radius,b.scale,b.scaleEnabled,b.collisionEnabled,b.protectedFrames]),
      g.lasers.lasers.filter(l=>l.alive).map(l=>[l.id,l.kind,l.state,l.position.x,l.position.y,l.angle,l.width,l.length,
        l.samples?.map(s=>[s.position.x,s.position.y,s.angle,s.speed])])])+'\n');
    if(plan)grids.push(attackOccupancy(g));
  }
  const result={grids,positions,misses,hits,firstHit,lives:g.player.lives,peak,x:g.player.x,y:g.player.y,
    gameplayFrames:g.frame,protectedCollisionFrames,positionMismatches,initialLives,marginBlockedFrames,firstMarginBlock,
    trajectoryHash:projectileHash.digest('hex')};f.dispose();return result;
}
export function searchAttackRoute(spec,{iterations=40,lookback=64}={}){
  if(!Number.isSafeInteger(iterations)||iterations<1||!Number.isSafeInteger(lookback)||lookback<STEP)throw new RangeError('Search requires positive integer iterations and a lookback of at least four frames');
  if(spec.frames%STEP)throw new RangeError('Route duration must be a multiple of four frames');
  let masks=null,route=null,peak=0,lastReplay=null,prefixFrames=0;const attempts=[];
  for(let attempt=0;attempt<iterations;attempt++){
    const sample=replayAttackRoute(spec,masks,{plan:true});peak=Math.max(peak,sample.peak);
    const prefixBeforePaddingCheck=prefixFrames;
    prefixFrames=backtrackAttackPrefix(prefixFrames,sample.firstMarginBlock,{lookback});
    route=findAttackRoute(sample.grids,{referenceMasks:masks,prefixFrames});
    if(!route.passed)return{...spec,qaVersion:ATTACK_ROUTE_QA_VERSION,passed:false,attempts:attempt+1,blockedFrame:route.blockedFrame,peak,lastReplay,diagnostics:attempts,grid:ATTACK_ROUTE_GRID,
      reason:'No continuation found in the tested lower-field grid with the committed input prefix; this is not proof of an unavoidable attack'};
    const replay=replayAttackRoute(spec,route.masks);
    lastReplay={hits:replay.hits,misses:replay.misses,firstHit:replay.firstHit,marginBlockedFrames:replay.marginBlockedFrames,firstMarginBlock:replay.firstMarginBlock};
    const routeHash=createHash('sha256').update(Buffer.from(route.masks.buffer)).digest('hex');
    attempts.push({attempt:attempt+1,prefixFrames,prefixBeforePaddingCheck,prefixBacktracked:prefixFrames<prefixBeforePaddingCheck,
      routeHash,...lastReplay,forecastMatchesReplay:sample.trajectoryHash===replay.trajectoryHash});
    if(replay.hits===0&&replay.misses===0&&replay.marginBlockedFrames===0&&replay.protectedCollisionFrames===0&&replay.positionMismatches===0&&replay.lives===replay.initialLives&&replay.gameplayFrames===spec.frames){
      const confirmation=replayAttackRoute(spec,route.masks);
      assert.equal(confirmation.hits,0);assert.equal(confirmation.misses,0);assert.equal(confirmation.protectedCollisionFrames,0);
      assert.equal(confirmation.positionMismatches,0);assert.equal(confirmation.gameplayFrames,spec.frames);
      assert.equal(confirmation.marginBlockedFrames,0);assert.equal(confirmation.lives,confirmation.initialLives);
      assert.equal(confirmation.trajectoryHash,replay.trajectoryHash,'Same actual inputs must reproduce identical live geometry');
      return{
      ...spec,qaVersion:ATTACK_ROUTE_QA_VERSION,passed:true,attempts:attempt+1,peak,travel:route.travel,minimumReachable:route.minimumReachable,hits:0,misses:0,marginBlockedFrames:0,
      protectedCollisionFrames:0,positionMismatches:0,gameplayFrames:replay.gameplayFrames,lives:replay.lives,initialLives:replay.initialLives,trajectoryHash:replay.trajectoryHash,routeHash,
      diagnostics:attempts,grid:ATTACK_ROUTE_GRID,route:Array.from(route.masks),liveReplayCount:2,geometryIdentityVerified:true,
      scope:'Real Reimu focus inputs, no shoot/Bomb/invulnerability; limited lower-field witness with 1.5-unit clearance verified on every frame of both actual replays, not human playability proof'};
    }
    // The first padded contact usually precedes the physical hit. Freezing
    // through it would force DP into an occupied cell even if no hit occurred.
    const firstBlockFrame=Math.min(replay.firstHit?.frame??Infinity,replay.firstMarginBlock?.frame??Infinity);
    if(Number.isFinite(firstBlockFrame))prefixFrames=Math.floor(Math.max(0,firstBlockFrame-lookback)/STEP)*STEP;
    masks=route.masks;
  }
  return{...spec,qaVersion:ATTACK_ROUTE_QA_VERSION,passed:false,attempts:iterations,peak,lastReplay,diagnostics:attempts,grid:ATTACK_ROUTE_GRID,
    reason:'The limited aimed-trajectory search did not converge to a zero-hit replay preserving the 1.5-unit margin; this is not proof of an unavoidable attack'};
}
