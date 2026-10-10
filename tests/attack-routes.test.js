import test from 'node:test';
import assert from 'node:assert/strict';
import {Keys} from '@ts-stg/thlib';
import {touhouCircleCollision} from '@ts-stg/thlib/touhou';
import {attackOccupancy,attackMarginCollision,backtrackAttackPrefix,findAttackRoute,replayAttackRoute,searchAttackRoute,ATTACK_ROUTE_GRID} from '../tools/attack-routes.mjs';
import {attackRouteCases} from '../tools/verify-attack-routes.mjs';

test('QA catalog covers every authored card with its own full duration and difficulty',()=>{
  const spells=attackRouteCases();assert.equal(spells.length,39);assert.equal(new Set(spells.map(spec=>spec.id)).size,39);
  assert.equal(spells.filter(spec=>spec.kind==='midboss').length,8);
  assert.deepEqual(spells.filter(spec=>spec.kind==='midboss').map(spec=>spec.stageId),[2,3,4,5,6,7,7,7]);
  for(const spec of spells){assert.ok(spec.frames>0&&spec.frames%4===0);assert.equal(spec.difficulty,spec.stageId===7?4:1);}
  assert.equal(attackRouteCases({kind:'nonspell'}).length,25);
});

test('grid interpolation follows real focused Reimu controls at exactly two units per frame',()=>{
  const masks=Array.from({length:20},(_,frame)=>Keys.FOCUS|(frame<10?Keys.RIGHT:Keys.UP));
  const result=replayAttackRoute({kind:'spell',stageId:1,spellIndex:0,difficulty:1,frames:20},masks);
  assert.equal(result.x,20);assert.equal(result.y,380);assert.equal(result.positionMismatches,0);
  assert.equal(result.gameplayFrames,20);assert.equal(result.hits,0);assert.equal(result.protectedCollisionFrames,0);
  assert.equal(result.marginBlockedFrames,0);assert.equal(result.firstMarginBlock,null);
  assert.throws(()=>replayAttackRoute({frames:1},[Keys.FOCUS|Keys.BOMB]),/only accepts/);
});

test('a physical zero-hit prefix is backtracked when it crosses only the extra QA margin',()=>{
  const fake={bullets:{bullets:[{id:17,state:1,collisionEnabled:true,radius:4,x:6,y:400}]},lasers:{lasers:[]}};
  assert.notEqual(touhouCircleCollision(0,400,3,6,400,4),1,'This example must be physically safe');
  assert.deepEqual(attackMarginCollision(fake,0,400),{kind:'bullet',id:17});
  const frames=Array.from({length:4},()=>attackOccupancy(fake)),masks=new Uint16Array(4).fill(Keys.FOCUS);
  assert.equal(findAttackRoute(frames,{referenceMasks:masks,prefixFrames:4}).passed,false);
  const prefix=backtrackAttackPrefix(4,{frame:0,x:0,y:400,kind:'bullet',id:17});
  assert.equal(prefix,0);
  const route=findAttackRoute(frames,{referenceMasks:masks,prefixFrames:prefix});
  assert.equal(route.passed,true);assert.notEqual(route.masks[0],Keys.FOCUS);
  let x=0,y=400;
  for(const mask of route.masks){x+=mask&Keys.LEFT?-2:mask&Keys.RIGHT?2:0;y+=mask&Keys.UP?-2:mask&Keys.DOWN?2:0;
    assert.equal(attackMarginCollision(fake,x,y),null,'Every recovered intermediate position must retain the same margin');}
  assert.equal(backtrackAttackPrefix(4,{frame:4}),4,'A collision after the committed prefix does not rewind it');
});

test('occupancy keeps protected bullets and DP checks intermediate frames rather than endpoints alone',()=>{
  const grid=attackOccupancy({bullets:{bullets:[{state:1,collisionEnabled:true,protectedFrames:20,radius:4,x:0,y:400}]},lasers:{lasers:[]}});
  const width=177,at=(x,y)=>(y-ATTACK_ROUTE_GRID.minY)/2*width+(x-ATTACK_ROUTE_GRID.minX)/2;
  assert.equal(grid[at(0,400)],1);
  const frames=Array.from({length:4},()=>new Uint8Array(177*73));frames[1][at(0,400)]=1;
  const route=findAttackRoute(frames);assert.equal(route.passed,true);
  assert.notEqual(route.masks[0],Keys.FOCUS,'An endpoint-only check would incorrectly stay in the intermediate hazard');
  assert.equal(findAttackRoute(frames,{referenceMasks:new Uint16Array(4).fill(Keys.FOCUS),prefixFrames:4}).passed,false);
});

test('the stage 6 survival garden keeps a focused zero-hit route through its open gates to the end',()=>{
  const card=attackRouteCases().find(spec=>spec.id==='s06-04');
  for(const difficulty of[1,3]){
    const spec={...card,difficulty};
    const result=searchAttackRoute(spec,{iterations:8});assert.equal(result.passed,true,`difficulty ${difficulty}`);
    const replay=replayAttackRoute(spec,result.route);
    assert.equal(replay.hits,0);assert.equal(replay.misses,0);assert.equal(replay.gameplayFrames,card.frames);
  }
});

test('safe-prefix refinement produces a collision-enabled zero-hit replay for the aimed lantern experiment',()=>{
  const spec={kind:'spell',stageId:1,spellIndex:0,difficulty:1,frames:1200};
  const result=searchAttackRoute(spec,{iterations:20});assert.equal(result.passed,true);
  const replay=replayAttackRoute(spec,result.route);assert.equal(replay.hits,0);assert.equal(replay.misses,0);
  assert.equal(replay.protectedCollisionFrames,0);assert.equal(replay.positionMismatches,0);assert.equal(replay.lives,replay.initialLives);
  assert.equal(replay.marginBlockedFrames,0);assert.equal(replay.firstMarginBlock,null);assert.equal(result.qaVersion,2);
  assert.equal(replay.gameplayFrames,1200);assert.equal(replay.trajectoryHash,result.trajectoryHash);
});
