import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DrawList} from '@ts-stg/thlib';
import {BACKGROUND_VIEWPORT,StageBackground,cameraForStage,lookAt3d,multiply3d,perspective3d,project3d,transform3d,viewport3d} from '../src/background.js';
import {SCENERY_ATLASES,SPELL_BACKGROUND_STYLES,sceneryRegion} from '../src/background-art.js';
import {DynamicSpellBackground,SPELL_BACKGROUND_TIMING} from '../src/spell-background.js';

const close=(a,b,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
function artFixture({width=1024,height=1024,baseSize=[width,height],patternSize=[width,height]}={}){
  const unloads=[],loads=[],backgrounds=[];
  return{unloads,loads,backgrounds,host:{createTexture:()=>{throw new Error('Scenery must use generated PNGs');},unloadTexture:id=>unloads.push(id)},load:path=>{
    loads.push(path);const base=path.endsWith('-base.png'),spell=path.startsWith('assets/spells/'),size=spell?(base?baseSize:patternSize):[width,height];return{id:spell?(base?93:94):92,width:size[0],height:size[1]};},
    background(draw,id){backgrounds.push(id);draw.rect(48,24,576,672,0x12343dff);}};
}

test('column-major multiplication and look-at retain the camera-space world geometry',()=>{
  const view=lookAt3d([5,7,3],[5,7,13]);
  assert.deepEqual(transform3d(view,[5,7,3]),[0,0,0,1]);
  assert.deepEqual(transform3d(view,[5,7,13]),[0,0,10,1]);
  assert.deepEqual(transform3d(view,[7,9,13]),[2,2,10,1]);
  const p=perspective3d(),point=[2,3,25],combined=multiply3d(p,view);
  const first=transform3d(view,point),expected=transform3d(p,first),actual=transform3d(combined,point);
  actual.forEach((value,index)=>close(value,expected[index]));
});

test('the actual perspective keeps clip W and converts both clipping planes correctly',()=>{
  const matrix=perspective3d(Math.PI/3,1,2,185);
  const near=transform3d(matrix,[0,0,2]),far=transform3d(matrix,[0,0,185]);
  close(near[2]/near[3],-1);close(far[2]/far[3],1);
  assert.equal(near[3],2);assert.equal(far[3],185);
  const a=project3d(matrix,[2,0,10]),b=project3d(matrix,[2,0,20]);
  close(a.x-480,(b.x-480)*2);
  assert.equal(project3d(matrix,[0,0,-1]),null);
  assert.throws(()=>perspective3d(0));assert.throws(()=>lookAt3d([0,0,0],[0,0,0]));
});

test('clip coordinates map exactly onto the portrait playfield, outside the side HUD',()=>{
  const mapping=viewport3d();
  const topLeft=project3d(mapping,[-1,1,0]),bottomRight=project3d(mapping,[1,-1,0]),center=project3d(mapping,[0,0,0]);
  close(topLeft.x,48);close(topLeft.y,24);close(bottomRight.x,624);close(bottomRight.y,696);
  close(center.x,336);close(center.y,360);
  assert.equal(BACKGROUND_VIEWPORT.canvasWidth,960);
  assert.equal(BACKGROUND_VIEWPORT.canvasHeight,720);
});

test('seven material-atlas roads retain distinct 3D landmarks and world depth',()=>{
  const background=new StageBackground({art:artFixture()}),roads=new Set();
  const expected=['torii','bamboo','arched-bridge','loom','bookshelf','name-pillar','mirror-pillar'];
  for(let id=1;id<=7;id++){
    background.setStage(id);assert.ok(background.geometryVariants.some(mesh=>mesh.features.has(expected[id-1])),`${id}/${expected[id-1]}`);
    for(const mesh of background.geometryVariants){
      if(mesh===background.geometry)roads.add(createHash('sha256').update(JSON.stringify(mesh.vertices)).digest('hex'));
      const ys=mesh.vertices.map(v=>v[1]),zs=mesh.vertices.map(v=>v[2]);
      assert.ok(Math.max(...ys)-Math.min(...ys)>6,'a flat picture is not a 3D scene');
      assert.ok(Math.max(...zs)-Math.min(...zs)>10,'the scene has no world depth');
    }
  }
  assert.equal(roads.size,7);assert.ok(!('spellGeometry'in background));background.destroy();
});

test('road camera flight remains deterministic and continuously moves',()=>{
  for(let id=1;id<=7;id++){
    const a=cameraForStage(id,1000),b=cameraForStage(id,1001);
    assert.deepEqual(a,cameraForStage({id},1000));assert.notDeepEqual(a.eye,b.eye);
    assert.ok(Math.hypot(...a.eye.map((value,index)=>value-b.eye[index]))<.2);
    for(const vector of [a.eye,a.target])assert.ok(vector.every(Number.isFinite));
  }
});

test('native draw commands have valid UVs, finite MVPs and cached static vertices',()=>{
  const background=new StageBackground({art:artFixture()});
  for(let id=1;id<=7;id++)for(const active of [false,true]){
    background.setStage(id);const game={frame:480,spell:{active,id:2,age:{current:0}}};background.update(game);
    game.frame=540;game.spell.age.current=60;background.update(game);
    const draw=new DrawList();background.draw(draw,game);
    const meshes=draw.commands.filter(command=>command[0]==='mesh3d');
    assert.equal(meshes.length,active?0:7);assert.ok(background.stats.vertices<=432);
    for(const [,texture,vertices,indices,mvp] of meshes){
      assert.equal(texture,92);assert.equal(mvp.length,16);assert.ok(mvp.every(Number.isFinite));
      assert.ok(vertices.every(v=>v.length===6&&v.every(Number.isFinite)&&v[3]>=0&&v[3]<=1&&v[4]>=0&&v[4]<=1));
      assert.ok(indices.length>0&&indices.length%3===0);
      assert.ok(indices.every(index=>Number.isInteger(index)&&index>=0&&index<vertices.length));
      const cachedMeshes=background.geometryVariants;
      assert.ok(cachedMeshes.some(mesh=>[...mesh.fogCache.values()].some(cached=>cached[0]===vertices[0])),'static vertices were rebuilt');
    }
    const source=background.geometry.vertices;background.setStage(id);assert.equal(background.geometry.vertices,source);
    assert.ok(!draw.commands.some(command=>command[0]==='scissor'||command[0]==='scissorEnd'),'public compositor owns clipping');
  }
  background.destroy();
});

test('seven Boss themes animate their independent full-image abstract textures without road geometry',()=>{
  const signatures=new Set();
  for(let id=1;id<=7;id++){
    const art=artFixture(),background=new StageBackground({art,seed:771});background.setStage(id);
    const game={frame:0,spell:{active:false}};background.update(game);
    game.spell={active:true,id:34,age:{current:0}};game.frame=1;background.update(game);
    game.frame=61;background.update(game);const a=new DrawList();background.draw(a,game);
    game.frame=181;background.update(game);const b=new DrawList();background.draw(b,game);
    const animatedA=a.commands.filter(command=>command[0]==='mesh'),animatedB=b.commands.filter(command=>command[0]==='mesh');
    assert.equal(animatedA.length,3);assert.equal(animatedA.length,animatedB.length);
    assert.notDeepEqual(animatedA,animatedB,'changing only a 3D camera is not texture animation');
    const displacement=Math.max(...animatedA.flatMap((command,n)=>command[2].map((v,i)=>Math.hypot(v[0]-animatedB[n][2][i][0],v[1]-animatedB[n][2][i][1]))));
    assert.ok(displacement>25,'motion must be plainly visible over two seconds');
    signatures.add(createHash('sha256').update(JSON.stringify(animatedA)).digest('hex'));
    for(const [,texture,vertices,indices]of animatedB){assert.ok(texture===93||texture===94);assert.ok(vertices.every(v=>v.length===5&&v.every(Number.isFinite)&&v[2]>=0&&v[2]<=1&&v[3]>=0&&v[3]<=1));assert.ok(indices.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length));}
    assert.equal(background.stats.roadVisible,false);assert.equal(background.stats.meshCalls,3);assert.ok(background.stats.vertices<=102);
    assert.ok(!a.commands.some(command=>command[0]==='mesh3d'));assert.equal(art.backgrounds.length,0,'steady cards must never submit distant road scenery');
    assert.ok(art.loads.includes(SPELL_BACKGROUND_STYLES[id-1].textures.base));assert.ok(art.loads.includes(SPELL_BACKGROUND_STYLES[id-1].textures.pattern));background.destroy();
  }
  assert.equal(signatures.size,7);
});

test('spell clock is seeded and reproducible; draw calls and pause cannot advance it',()=>{
  const fixture=()=>new DynamicSpellBackground({art:artFixture(),seed:671}),a=fixture(),b=fixture();
  const game={frame:10,spell:{active:false},context:{boss:{bossId:'shizuri'}}};a.update(game);b.update(game);
  game.frame=11;game.spell={active:true,id:4,captureIndex:2,age:{current:0}};a.update(game);b.update(game);
  game.frame=131;a.update(game);b.update(game);assert.deepEqual(a.snapshot(),b.snapshot());
  const card=a.visibleCards()[0],drawA=new DrawList(),drawB=new DrawList();a.drawCard(drawA,card);b.drawCard(drawB,b.visibleCards()[0]);assert.deepEqual(drawA.commands,drawB.commands);
  const snapshot=a.snapshot();a.update({...game,frame:1000,paused:true});a.drawCard(new DrawList(),card);assert.deepEqual(a.snapshot(),snapshot);
  const background=new StageBackground({art:artFixture(),seed:671});background.setStage(2);background.update(game);
  const first=new DrawList();background.draw(first,game);const paused={...game,paused:true,frame:999};background.update(paused);
  const repeat=new DrawList();background.draw(repeat,paused,{clock:999});assert.deepEqual(first.commands,repeat.commands,'pause renders must keep every scenery layer frozen');background.destroy();
  const different=new DynamicSpellBackground({art:artFixture(),seed:672});different.update({...game,spell:{...game.spell,age:{current:120}}});assert.notEqual(different.visibleCards()[0].phase,card.phase);
  assert.ok(drawA.commands.some(command=>command[0]==='blendEnd'));assert.ok(!drawA.commands.some(command=>['scissor','scissorEnd','targetBegin','targetEnd'].includes(command[0])));
  a.destroy();b.destroy();different.destroy();
});

test('spell entry and retirement fade over simulation frames; rapid changes stay bounded',()=>{
  const art=artFixture(),background=new StageBackground({art});background.setStage(7);
  const game={frame:0,spell:{active:false},context:{boss:{bossId:'fusae'}}};background.update(game);
  game.frame=1;game.spell={active:true,id:22,age:{current:0}};background.update(game);
  assert.equal(background.spellBackground.visibleCards().length,0);
  game.frame=31;background.update(game);close(background.spellBackground.visibleCards()[0].opacity,.5);
  game.frame=61;background.update(game);const card=background.spellBackground.visibleCards()[0];assert.equal(card.style,5,'Extra midboss has her own theme');assert.equal(card.opacity,1);
  const extraMid=new DrawList();background.draw(extraMid,game);assert.ok(art.loads.includes('assets/spells/fusae.png'));assert.ok(!art.loads.includes('assets/spells/mio.png'));
  game.frame=62;game.spell.active=false;background.update(game);assert.equal(background.spellBackground.visibleCards()[0].opacity,1);
  game.frame=74;background.update(game);close(background.spellBackground.visibleCards()[0].opacity,.5);
  game.frame=86;background.update(game);assert.equal(background.spellBackground.visibleCards().length,0);
  const road=new DrawList();background.draw(road,game);assert.equal(background.stats.meshCalls,7);
  game.context.boss.bossId='mio';game.spell.active=true;
  for(let i=0;i<8;i++){game.frame+=4;game.spell.id=30+i;background.update(game);assert.ok(background.spellBackground.cards.length<=SPELL_BACKGROUND_TIMING.maxCards);}
  game.frame+=12;background.update(game);const draw=new DrawList();background.draw(draw,game);assert.ok(background.stats.meshCalls<=13);assert.ok(background.stats.vertices<=636);
  background.setStage(1);assert.equal(background.spellBackground.cards.length,0);background.destroy();assert.equal(background.spellBackground.cards.length,0);
});

test('painted cutouts and their ground share the same distance-sorted batch',()=>{
  const background=new StageBackground({art:artFixture()});background.setStage(5);
  const mesh=background.geometry,forward=[.13,-.21,.97];
  const indices=mesh.orderedIndices(forward);
  const order=[],layers=[],faces=mesh.faces;
  const byFirstIndex=new Map(faces.map(face=>[face.indices[0],face]));
  for(let i=0;i<indices.length;){const face=byFirstIndex.get(indices[i]);assert.ok(face);order.push(face.center.reduce((sum,value,axis)=>sum+value*forward[axis],0));layers.push(face.layer);i+=face.indices.length;}
  for(let i=1;i<order.length;i++){assert.ok(layers[i]>=layers[i-1]);if(layers[i]===layers[i-1])assert.ok(order[i]<=order[i-1]+1e-12);}
  assert.ok(mesh.faces.some(face=>face.region==='ground'));assert.ok(mesh.faces.some(face=>face.region==='detail'));
  assert.ok(mesh.faces.some(face=>face.region==='landmark'));background.destroy();
});

test('near-plane crossings remain homogeneous and bounded through the entire tile seam',()=>{
  const background=new StageBackground({art:artFixture()});
  for(let id=1;id<=7;id++)for(const clock of [0,1,200,201,215,216,999,1000,1000000]){
    const draw=new DrawList();background.draw(draw,{frame:clock,spell:{active:false}},{stage:id});
    const meshes=draw.commands.filter(command=>command[0]==='mesh3d');
    assert.ok(meshes.length>0&&meshes.length<=7);
    for(const command of meshes){
      assert.ok(command[4].every(value=>Number.isFinite(value)&&Math.abs(value)<1000000));
      for(const vertex of command[2].filter((_,index)=>index%19===0))assert.ok(transform3d(command[4],vertex).every(Number.isFinite));
    }
  }
  background.destroy();
});

test('stage changes release CPU scenery and leave borrowed texture ownership to GameArt',()=>{
  const art=artFixture(),background=new StageBackground({art});background.setStage(1);
  const mesh=background.geometry;background.draw(new DrawList(),{frame:200});assert.ok(mesh.fogCache.size>0);
  background.setStage(2);assert.notEqual(background.geometry,mesh);
  background.destroy();background.destroy();assert.deepEqual(art.unloads,[]);
  assert.deepEqual(art.loads,['assets/scenery/stage01-atlas.png','assets/scenery/stage02-atlas.png']);
  assert.throws(()=>background.draw(new DrawList(),{frame:0}),/destroyed/);
});

test('the ground UV is continuous at every subdivision and atlas cells cannot sample their neighbours',()=>{
  const background=new StageBackground({art:artFixture()});
  for(let id=1;id<=7;id++){
    background.setStage(id);
    for(const mesh of background.geometryVariants){
      const floors=mesh.faces.filter(face=>face.region==='ground');
      for(let i=1;i<floors.length;i++){
        const a=mesh.vertices[floors[i-1].indices[2]],b=mesh.vertices[floors[i].indices[0]];
        close(a[2],b[2]);close(a[4],b[4]);
      }
    }
    for(const region of ['ground','landmark','edge','detail']){
      const [u0,v0,u1,v1]=sceneryRegion(id,region);assert.ok(u0<u1&&v0<v1);
      assert.ok(Math.min(u0,u1)>=0&&Math.max(u0,u1)<=1&&Math.min(v0,v1)>=0&&Math.max(v0,v1)<=1);
      for(const value of [u0,v0,u1,v1])assert.notEqual(value,.5,'bilinear texture reads could leak from neighbouring cells');
    }
  }
  assert.equal(new Set(SCENERY_ATLASES.map(asset=>asset.path)).size,7);background.destroy();
});

test('whole-image spell planes cover every playfield corner through rotation, drift, waves and actual texture dimensions',()=>{
  const contains=(point,a,b,c)=>{
    const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    const values=[cross(a,b,point),cross(b,c,point),cross(c,a,point)];
    return values.every(v=>v>=-1e-7)||values.every(v=>v<=1e-7);
  };
  const corners=[[48,24],[624,24],[624,696],[48,696]];
  for(const [width,height]of [[1024,1024],[1254,1254],[1536,1536],[1536,1024]])for(const profile of SPELL_BACKGROUND_STYLES){
    const owner=new DynamicSpellBackground({art:artFixture({baseSize:[width,height],patternSize:[height,width]}),seed:105});
    owner.update({frame:120,context:{boss:{bossId:profile.bossId}},spell:{active:true,id:1,age:{current:120}}});
    const original=owner.visibleCards()[0];
    for(const age of [0,31,120,240,999,10000,1000000]){
      const draw=new DrawList();owner.drawCard(draw,{...original,age,opacity:1});
      const meshes=draw.commands.filter(command=>command[0]==='mesh');assert.equal(meshes.length,3);
      for(const [,texture,vertices,indices]of meshes){
        assert.ok(texture===93||texture===94);assert.ok(vertices.length<=49);
        assert.ok(vertices.every(vertex=>vertex.every(Number.isFinite)&&vertex[2]>=0&&vertex[2]<=1&&vertex[3]>=0&&vertex[3]<=1));
        assert.equal(Math.min(...vertices.map(v=>v[2])),0);assert.equal(Math.max(...vertices.map(v=>v[2])),1);
        assert.equal(Math.min(...vertices.map(v=>v[3])),0);assert.equal(Math.max(...vertices.map(v=>v[3])),1);
        for(const corner of corners)assert.ok(indices.some((_,i)=>i%3===0&&contains(corner,vertices[indices[i]],vertices[indices[i+1]],vertices[indices[i+2]])),`${profile.bossId}/${age} leaves a playfield corner uncovered`);
      }
      assert.ok(meshes[0][2].every(vertex=>(vertex[4]&255)===255),'the primary image must be opaque at steady state');
      assert.ok(meshes[1][2].every(vertex=>(vertex[4]&255)<=140),'primary pattern opacity is independent of the opaque base');
      assert.ok(meshes[2][2].every(vertex=>(vertex[4]&255)<30),'echo flow must remain low alpha');
    }
    owner.destroy();
  }
});

test('rain, ripple, brocade, mandala and mirrored echo deform shared image vertices without changing UVs or introducing tile seams',()=>{
  for(const bossId of ['shizuri','watari','shino','kotone','mio']){
    const owner=new DynamicSpellBackground({art:artFixture(),seed:13});
    owner.update({frame:100,context:{boss:{bossId}},spell:{active:true,id:1,age:{current:100}}});
    const a=new DrawList(),b=new DrawList(),card=owner.visibleCards()[0];owner.drawCard(a,card);owner.drawCard(b,{...card,age:card.age+60});
    const meshes=a.commands.filter(command=>command[0]==='mesh'),other=b.commands.filter(command=>command[0]==='mesh');
    for(let n=1;n<meshes.length;n++){
      const vertices=meshes[n][2];assert.equal(vertices.length,49);assert.deepEqual(vertices.map(v=>v.slice(2,4)),other[n][2].map(v=>v.slice(2,4)));
      const bend=Math.max(...[1,2,3,4,5].map(i=>Math.hypot(vertices[i][0]-(vertices[0][0]+(vertices[6][0]-vertices[0][0])*i/6),vertices[i][1]-(vertices[0][1]+(vertices[6][1]-vertices[0][1])*i/6))));
      assert.ok(bend>.5,'the image must bend rather than only rotate');
      assert.notDeepEqual(vertices,other[n][2]);
      assert.ok(meshes[n][3].length===216&&new Set(meshes[n][3]).size===49,'cells share their border vertices');
    }
    owner.destroy();
  }
});

test('two abstract cards have a bounded shared capture lifecycle without submitting old spell scenery',()=>{
  const art=artFixture(),background=new StageBackground({art});background.setStage(1);
  const game={frame:0,spell:{active:false},context:{boss:{bossId:'akari'}}};background.update(game);
  game.frame=1;game.spell={active:true,id:1,age:{current:0}};background.update(game);
  game.frame=61;background.update(game);game.frame=62;game.spell.id=2;background.update(game);
  let draw=new DrawList();background.draw(draw,game);assert.equal(background.stats.roadVisible,false);assert.equal(background.stats.meshCalls,3);
  game.frame=74;background.update(game);draw=new DrawList();background.draw(draw,game);
  assert.equal(background.spellBackground.visibleCards().length,2);assert.equal(background.stats.meshCalls,13);
  assert.equal(draw.commands.filter(command=>command[0]==='mesh').length,6);assert.equal(draw.commands.filter(command=>command[0]==='mesh3d').length,7);
  assert.ok(!('spellSets'in background));assert.ok(!('spellGeometry'in background));assert.ok(background.stats.vertices<=636);
  game.frame=122;background.update(game);draw=new DrawList();background.draw(draw,game);
  assert.equal(background.stats.roadVisible,false);assert.equal(background.stats.meshCalls,3);assert.equal(draw.commands.filter(command=>command[0]==='mesh3d').length,0);
  background.destroy();assert.deepEqual(art.unloads,[]);
});

test('each Boss uses two different texture handles and explicit, independent blending for all three layers',()=>{
  const blends=new Set();
  for(const profile of SPELL_BACKGROUND_STYLES){
    const art=artFixture({baseSize:[1536,1024],patternSize:[1024,1536]}),owner=new DynamicSpellBackground({art,seed:129});
    owner.update({frame:120,context:{boss:{bossId:profile.bossId}},spell:{active:true,id:1,age:{current:120}}});
    const snapshot=owner.snapshot(),draw=new DrawList();owner.drawCard(draw,owner.visibleCards()[0]);assert.deepEqual(owner.snapshot(),snapshot);
    assert.notEqual(profile.textures.base,profile.textures.pattern);assert.deepEqual(art.loads,[profile.textures.base,profile.textures.pattern]);
    const meshes=draw.commands.filter(command=>command[0]==='mesh');assert.deepEqual(meshes.map(command=>command[1]),[93,94,94]);
    assert.deepEqual(profile.layers.map(layer=>layer.texture),['base','pattern','pattern']);
    let activeBlend=null,index=0;
    for(const command of draw.commands){
      if(command[0]==='blendFactors'){assert.equal(activeBlend,null);activeBlend=command;}
      else if(command[0]==='blendEnd'){assert.notEqual(activeBlend,null);activeBlend=null;}
      else if(command[0]==='mesh'){
        const layer=profile.layers[index++];blends.add(layer.blend);
        assert.deepEqual(activeBlend,['blendFactors','srcAlpha',layer.blend==='alpha'?'oneMinusSrcAlpha':'one',layer.blend==='subtract'?'reverseSubtract':'add','zero','one','add']);
        assert.ok(command[2].every(vertex=>(vertex[4]&255)===Math.round(layer.opacity*(layer.tint&255))));
        assert.ok(command[2].every(vertex=>(vertex[4]>>>8)===(layer.tint>>>8)),'each layer uses its own tint');
      }
    }
    assert.equal(index,3);assert.equal(activeBlend,null);owner.destroy();assert.deepEqual(art.unloads,[]);
  }
  assert.deepEqual([...blends].sort(),['add','alpha','subtract']);
});

test('the independent base alone covers roads after the 60-frame entry and every layer shares the retirement envelope',()=>{
  assert.deepEqual(SPELL_BACKGROUND_TIMING,{fadeIn:60,fadeOut:24,maxCards:2});
  const owner=new DynamicSpellBackground({art:artFixture(),seed:18}),game={frame:0,spell:{active:false},context:{boss:{bossId:'watari'}}};owner.update(game);
  game.frame=1;game.spell={active:true,id:2,age:{current:0}};owner.update(game);assert.equal(owner.visibleCards().length,0);
  game.frame=31;owner.update(game);assert.equal(owner.coversRoad(owner.visibleCards()[0]),false);close(owner.visibleCards()[0].opacity,.5);
  game.frame=60;owner.update(game);assert.equal(owner.coversRoad(owner.visibleCards()[0]),false);
  game.frame=61;owner.update(game);assert.equal(owner.coversRoad(owner.visibleCards()[0]),true);
  game.frame=62;game.spell.active=false;owner.update(game);game.frame=74;owner.update(game);
  const card=owner.visibleCards()[0],profile=SPELL_BACKGROUND_STYLES[2],draw=new DrawList();close(card.opacity,.5);assert.equal(owner.coversRoad(card),false);owner.drawCard(draw,card);
  const meshes=draw.commands.filter(command=>command[0]==='mesh');
  meshes.forEach((command,index)=>assert.ok(command[2].every(vertex=>(vertex[4]&255)===Math.round(.5*profile.layers[index].opacity*(profile.layers[index].tint&255)))));
  const paused=owner.snapshot();owner.update({...game,frame:1000,paused:true});assert.deepEqual(owner.snapshot(),paused);
  game.frame=86;owner.update(game);assert.equal(owner.visibleCards().length,0);owner.destroy();
});

test('all scene faces sample an authored atlas cell, including walls facing into a 3D corridor',()=>{
  const background=new StageBackground({art:artFixture()});
  for(let id=1;id<=7;id++){
    background.setStage(id);
    for(const mesh of background.geometryVariants)for(const face of mesh.faces){
      const [u0,v0,u1,v1]=sceneryRegion(id,face.region);
      for(const index of new Set(face.indices)){const v=mesh.vertices[index];assert.ok(v[3]>=u0&&v[3]<=u1&&v[4]>=v0&&v[4]<=v1);}
    }
  }
  background.setStage(5);
  const shelves=background.geometry.faces.filter(face=>face.tag==='bookshelf');assert.equal(shelves.length,6);
  for(const face of shelves){
    const points=[...new Set(face.indices)].map(i=>background.geometry.vertices[i]);
    assert.ok(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))<.001,'bookshelf must face into the corridor, not face the camera');
    assert.ok(Math.max(...points.map(p=>p[2]))-Math.min(...points.map(p=>p[2]))>16,'wall has actual world-space depth');
  }
  background.destroy();
});
