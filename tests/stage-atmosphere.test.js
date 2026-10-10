import test from 'node:test';
import assert from 'node:assert/strict';
import {DrawList} from '@ts-stg/thlib';
import {StageAtmosphere,STAGE_ATMOSPHERE_FEATURES} from '../dist/src/stage-atmosphere.js';
import {cameraForStage,lookAt3d,multiply3d,perspective3d,project3d,viewport3d} from '../dist/src/background.js';

// Public pack shape only: these tests require no private pixels or engine host.
const manifest={format:'ts-stg-sprite-pack-v1',textures:{
  petals:{file:'petals.png',width:64,height:64},aura:{file:'aura.png',width:128,height:64},
},sprites:{
  'charge.circle':{texture:'petals',x:0,y:32,width:32,height:32},
  'charge.leaf':{texture:'petals',x:32,y:0,width:32,height:32},
  'boss.aura-ring':{texture:'aura',x:52,y:6,width:39,height:39},
}};
function fixture(seed=123,inject=true){
  const loads=[],reads=[],unloads=[],handles=new Map();
  const art={host:{readText:path=>{reads.push(path);return JSON.stringify(manifest);},unloadTexture:id=>unloads.push(id)},
    load:path=>{if(!handles.has(path)){handles.set(path,[...path].reduce((hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))>>>0,1));loads.push(path);}return{id:handles.get(path),width:1254,height:1254};}};
  return{owner:new StageAtmosphere({art,seed,...(inject?{manifest}:{})}),loads,reads,unloads,handles};
}
function capture(owner,stage,clock){const draw=new DrawList(),stats=owner.draw(draw,stage,clock);return{commands:draw.commands,stats};}
function meshes(frame){return frame.commands.filter(command=>command[0]==='mesh');}
/** Mesh commands paired with the blend that precedes them. */
function batches(frame){
  const out=[];let additive=null;
  for(const command of frame.commands){if(command[0]==='blendFactors')additive=command[2]==='one';if(command[0]==='mesh')out.push({additive,texture:command[1],vertices:command[2],indices:command[3]});}
  return out;
}
/** Connected triangle groups, i.e. the individual shapes inside one batch. */
function shapes({vertices,indices}){
  const roots=vertices.map((_,i)=>i),root=index=>{while(roots[index]!==index)index=roots[index];return index;};
  for(let i=0;i<indices.length;i+=3){const a=root(indices[i]);roots[root(indices[i+1])]=a;roots[root(indices[i+2])]=a;}
  const groups=new Map();
  for(let i=0;i<vertices.length;i++){const key=root(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
  return[...groups.values()];
}

test('seven distinct themes batch finite, translucent geometry inside the playfield',()=>{
  const {owner,reads}=fixture(),features=new Set();
  for(let stage=1;stage<=7;stage++)for(const clock of [0,1,60,487,3600,1000000]){
    const frame=capture(owner,stage,clock),commands=meshes(frame),stats=frame.stats;
    assert.equal(stats.stage,stage);assert.equal(stats.clock,clock);
    assert.deepEqual(stats.features,STAGE_ATMOSPHERE_FEATURES[stage-1]);features.add(stats.features.join(','));
    assert.equal(stats.meshCalls,commands.length);assert.ok(commands.length>0&&commands.length<=4);
    assert.equal(stats.vertices,commands.reduce((sum,command)=>sum+command[2].length,0));
    assert.ok(stats.particles*4<=stats.vertices);assert.ok(stats.vertices<=600);
    assert.ok(Number.isInteger(stats.visible)&&stats.visible>=0&&stats.visible<=stats.particles);
    assert.ok(frame.commands.every(command=>['sampler','blendFactors','mesh','blendEnd'].includes(command[0])), 'ambience must not change compositor state');
    for(const {additive,texture,vertices,indices} of batches(frame)){
      assert.ok(texture>0);assert.ok(indices.length>0&&indices.length%3===0);
      assert.ok(indices.every(index=>Number.isInteger(index)&&index>=0&&index<vertices.length));
      for(const [x,y,u,v,color] of vertices){
        assert.ok([x,y,u,v,color].every(Number.isFinite));
        assert.ok(x>=48-1e-6&&x<=624+1e-6&&y>=24-1e-6&&y<=696+1e-6);
        assert.ok(u>0&&u<1&&v>0&&v<1);
        assert.ok((color&255)<=(additive?122:170),'environment must stay translucent');
      }
    }
  }
  assert.equal(features.size,7);assert.deepEqual(reads,[]);
});

test('same clock is idempotent after other stages and times; seed changes only the visual arrangement',()=>{
  const a=fixture(718),b=fixture(718),c=fixture(719),random=Math.random;
  Math.random=()=>{throw new Error('Ambience must never consume ambient RNG');};
  try{
    for(let stage=1;stage<=7;stage++){
      const first=capture(a.owner,stage,630);
      capture(a.owner,stage,4000);capture(a.owner,8-stage,17);
      assert.deepEqual(capture(a.owner,stage,630),first);
      assert.deepEqual(capture(b.owner,stage,630),first);
      assert.notDeepEqual(meshes(capture(c.owner,stage,630)),meshes(first));
      assert.notDeepEqual(meshes(capture(a.owner,stage,660)),meshes(first));
    }
  }finally{Math.random=random;}
});

test('every reuse, cull and edge exit is invisible rather than teleporting a visible particle',()=>{
  for(let stage=1;stage<=7;stage++){
    const {owner}=fixture();let previous=meshes(capture(owner,stage,0)),wraps=0,lively=0;
    const layout=previous.map(command=>command[2].length);
    for(let clock=1;clock<=800;clock++){
      const frame=capture(owner,stage,clock),current=meshes(frame);if(frame.stats.visible>0)lively++;
      assert.deepEqual(current.map(command=>command[2].length),layout,'each slot keeps its vertex layout');
      current.forEach((command,batch)=>{
        const vertices=command[2],old=previous[batch][2];
        for(let i=0;i<vertices.length;i++){
          const distance=Math.hypot(vertices[i][0]-old[i][0],vertices[i][1]-old[i][1]);
          if(distance>25){wraps++;assert.ok((old[i][4]&255)<=1&&(vertices[i][4]&255)<=1,`stage ${stage}: visible lifecycle discontinuity`);}
        }
      });previous=current;
    }
    assert.ok(wraps>0,`stage ${stage} did not exercise a reuse`);
    // Painted doors and bridges may briefly hide everything behind them.
    assert.ok(lively>=600,`stage ${stage} is visibly animated in only ${lively} of 800 frames`);
  }
});

test('rain, river and mirror ripples are soft rings lying on the ground plane',()=>{
  for(const stage of [2,3,7]){
    const {owner}=fixture();let rings=0;
    for(let clock=300;clock<=2400&&rings<3;clock+=7){
      for(const batch of batches(capture(owner,stage,clock)))for(const group of shapes(batch)){
        if(group.length!==48)continue;
        const points=group.map(index=>batch.vertices[index]),alpha=points.map(point=>point[4]&255);
        if(!alpha.some(value=>value>1))continue;
        rings++;
        assert.ok(alpha.slice(0,16).every(value=>value===0)&&alpha.slice(32).every(value=>value===0),'both ring edges are transparent');
        assert.ok(alpha.slice(16,32).every(value=>value>0),'the band itself is visible all round');
        const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
        const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
        assert.ok(width>height*1.3,'a ground ripple is foreshortened by the road camera');
        const centre=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2],members=new Set(group);
        for(let i=0;i<batch.indices.length;i+=3){
          if(!members.has(batch.indices[i]))continue;
          const triangle=batch.indices.slice(i,i+3).map(index=>batch.vertices[index]);
          const cross=triangle.map((a,j)=>{const b=triangle[(j+1)%3];return(b[0]-a[0])*(centre[1]-a[1])-(b[1]-a[1])*(centre[0]-a[0]);});
          assert.ok(cross.some(value=>value>1e-8)&&cross.some(value=>value< -1e-8),'a ripple triangle fills its centre');
        }
      }
    }
    assert.ok(rings>=3,`stage ${stage} has no actual ring geometry`);
  }
});

test('ambience is projected by the road camera: lantern glows sit on the painted lantern windows',()=>{
  const {owner}=fixture();let checked=0;
  for(const clock of [0,333,1200,4100]){
    const camera=cameraForStage(1,clock),eye=camera.eye[2];
    const matrix=multiply3d(viewport3d(),multiply3d(perspective3d(camera.fov),lookAt3d([camera.eye[0],camera.eye[1],0],[camera.target[0],camera.target[1],camera.target[2]-eye],camera.up)));
    // Road geometry: lanterns at x=±10, z=9/37 (+1.2 per variant) in every 48-unit tile.
    const windows=[];
    for(let tile=Math.floor(eye/48)-1;tile<=Math.floor(eye/48)+3;tile++)for(const local of [9,37])for(const side of [-1,1]){
      const p=project3d(matrix,[side*10,7,tile*48+local+(((tile%3)+3)%3)*1.2-eye]);if(p)windows.push(p);
    }
    for(const batch of batches(capture(owner,1,clock)).filter(batch=>batch.additive))for(const group of shapes(batch)){
      if(group.length!==17)continue;
      const [x,y,,,color]=batch.vertices[group[0]];if((color&255)===0)continue;
      checked++;assert.ok(windows.some(p=>Math.hypot(p.x-x,p.y-y)<1e-6),`glow at ${x},${y} is not on a lantern`);
    }
  }
  assert.ok(checked>=8);
});

test('public material manifest is lazy and borrowed GameArt textures remain owned by GameArt',()=>{
  const {owner,reads,loads,unloads}=fixture(9,false);
  assert.deepEqual(reads,[]);capture(owner,1,20);capture(owner,4,200);capture(owner,4,200);
  assert.deepEqual(reads,['packages/thlib/assets/spell-common/manifest.json']);
  assert.equal(new Set(loads).size,loads.length);
  assert.ok(loads.length>0&&loads.every(path=>path.startsWith('packages/thlib/assets/spell-common/')),'only public common materials are borrowed');
  owner.destroy();owner.destroy();assert.deepEqual(unloads,[]);
  assert.throws(()=>capture(owner,1,20),/destroyed/);
});

test('invalid stage and non-simulation clocks fail before material loading',()=>{
  const {owner,loads,reads}=fixture(3,false);
  for(const [stage,clock] of [[0,1],[8,1],[1,NaN],[1,-1],[1,.5],[1,Infinity]])assert.throws(()=>capture(owner,stage,clock),RangeError);
  assert.deepEqual(loads,[]);assert.deepEqual(reads,[]);
});
