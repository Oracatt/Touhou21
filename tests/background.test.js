import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DrawList} from '@ts-stg/thlib';
import {BACKGROUND_VIEWPORT,StageBackground,cameraForStage,lookAt3d,multiply3d,perspective3d,project3d,transform3d,viewport3d} from '../src/background.js';
import {SCENERY_ATLASES,sceneryRegion} from '../src/background-art.js';

const close=(a,b,epsilon=1e-9)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
function artFixture(){
  const unloads=[],loads=[];
  return{unloads,loads,host:{createTexture:()=>{throw new Error('Scenery must use generated PNGs');},unloadTexture:id=>unloads.push(id)},load:path=>{loads.push(path);return{id:92,width:1024,height:1024};},
    background(draw){draw.rect(48,24,576,672,0x12343dff);}};
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

test('seven material-atlas roads and spell sets have distinct 3D landmarks and world depth',()=>{
  const background=new StageBackground({art:artFixture()}),roads=new Set(),arenas=new Set();
  const expected=['torii','bamboo','arched-bridge','loom','bookshelf','name-pillar','mirror-pillar'];
  for(let id=1;id<=7;id++){
    background.setStage(id);assert.ok(background.geometryVariants.some(mesh=>mesh.features.has(expected[id-1])),`${id}/${expected[id-1]}`);
    assert.ok(background.spellGeometry.features.has(expected[id-1]),`${id}/spell/${expected[id-1]}`);
    for(const [mesh,signatures] of [[background.geometry,roads],[background.spellGeometry,arenas]]){
      signatures.add(createHash('sha256').update(JSON.stringify(mesh.vertices)).digest('hex'));
      const ys=mesh.vertices.map(v=>v[1]),zs=mesh.vertices.map(v=>v[2]);
      assert.ok(Math.max(...ys)-Math.min(...ys)>6,'a flat picture is not a 3D scene');
      assert.ok(Math.max(...zs)-Math.min(...zs)>10,'the scene has no world depth');
    }
  }
  assert.equal(roads.size,7);assert.equal(arenas.size,7);background.destroy();
});

test('camera flight and slower spell orbit are deterministic and continuously move',()=>{
  for(let id=1;id<=7;id++)for(const spell of [false,true]){
    const a=cameraForStage(id,1000,spell),b=cameraForStage(id,1001,spell);
    assert.deepEqual(a,cameraForStage({id},1000,spell));assert.notDeepEqual(a.eye,b.eye);
    assert.ok(Math.hypot(...a.eye.map((value,index)=>value-b.eye[index]))<.2);
    for(const vector of [a.eye,a.target])assert.ok(vector.every(Number.isFinite));
  }
});

test('native draw commands have valid UVs, finite MVPs and cached static vertices',()=>{
  const background=new StageBackground({art:artFixture()});
  for(let id=1;id<=7;id++)for(const active of [false,true]){
    const draw=new DrawList();background.draw(draw,{frame:480,spell:{active}},{stage:id});
    const meshes=draw.commands.filter(command=>command[0]==='mesh3d');
    assert.equal(meshes.length,active?1:7);assert.ok(background.stats.vertices<=600);
    for(const [,texture,vertices,indices,mvp] of meshes){
      assert.equal(texture,92);assert.equal(mvp.length,16);assert.ok(mvp.every(Number.isFinite));
      assert.ok(vertices.every(v=>v.length===6&&v.every(Number.isFinite)&&v[3]>=0&&v[3]<=1&&v[4]>=0&&v[4]<=1));
      assert.ok(indices.length>0&&indices.length%3===0);
      assert.ok(indices.every(index=>Number.isInteger(index)&&index>=0&&index<vertices.length));
      const cachedMeshes=active?[background.spellGeometry]:background.geometryVariants;
      assert.ok(cachedMeshes.some(mesh=>[...mesh.fogCache.values()].some(cached=>cached[0]===vertices[0])),'static vertices were rebuilt');
    }
    const source=background.geometry.vertices;background.setStage(id);assert.equal(background.geometry.vertices,source);
    assert.ok(!draw.commands.some(command=>command[0]==='scissor'||command[0]==='scissorEnd'),'public compositor owns clipping');
  }
  background.destroy();
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
  background.setStage(2);assert.notEqual(background.geometry,mesh);assert.notEqual(background.spellGeometry.label,'stage1-spell');
  background.destroy();background.destroy();assert.deepEqual(art.unloads,[]);
  assert.deepEqual(art.loads,['assets/scenery/stage01-atlas.png','assets/scenery/stage02-atlas.png']);
  assert.throws(()=>background.draw(new DrawList(),{frame:0}),/destroyed/);
});

test('the ground UV is continuous at every subdivision and atlas cells cannot sample their neighbours',()=>{
  const background=new StageBackground({art:artFixture()});
  for(let id=1;id<=7;id++){
    background.setStage(id);
    for(const mesh of [background.geometry,background.spellGeometry]){
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

test('all scene faces sample an authored atlas cell, including walls facing into a 3D corridor',()=>{
  const background=new StageBackground({art:artFixture()});
  for(let id=1;id<=7;id++){
    background.setStage(id);
    for(const mesh of [...background.geometryVariants,background.spellGeometry])for(const face of mesh.faces){
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
