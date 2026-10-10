import test from 'node:test';
import assert from 'node:assert/strict';
import {DrawList} from '@ts-stg/thlib';
import {StageAtmosphere,STAGE_ATMOSPHERE_FEATURES} from '../dist/src/stage-atmosphere.js';

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

test('seven distinct themes batch finite, low-alpha geometry inside the playfield',()=>{
  const {owner,reads}=fixture(),features=new Set();
  for(let stage=1;stage<=7;stage++)for(const clock of [0,1,60,487,3600,1000000]){
    const frame=capture(owner,stage,clock),commands=meshes(frame),stats=frame.stats;
    assert.equal(stats.stage,stage);assert.equal(stats.clock,clock);
    assert.deepEqual(stats.features,STAGE_ATMOSPHERE_FEATURES[stage-1]);features.add(stats.features.join(','));
    assert.equal(stats.meshCalls,commands.length);assert.ok(commands.length>0&&commands.length<=4);
    assert.equal(stats.vertices,commands.reduce((sum,command)=>sum+command[2].length,0));
    assert.ok(stats.particles*4<=stats.vertices);assert.ok(stats.vertices<=600);
    assert.ok(frame.commands.every(command=>['sampler','blendFactors','mesh','blendEnd'].includes(command[0])), 'ambience must not change compositor state');
    for(const [,texture,vertices,indices] of commands){
      assert.ok(texture>0);assert.ok(indices.length>0&&indices.length%3===0);
      assert.ok(indices.every(index=>Number.isInteger(index)&&index>=0&&index<vertices.length));
      for(const [x,y,u,v,color] of vertices){
        assert.ok([x,y,u,v,color].every(Number.isFinite));
        assert.ok(x>=48-1e-6&&x<=624+1e-6&&y>=24-1e-6&&y<=696+1e-6);
        assert.ok(u>0&&u<1&&v>0&&v<1);assert.ok((color&255)<=122,'environment must stay translucent');
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

test('trajectory wrap is invisible rather than teleporting an opaque particle',()=>{
  for(const stage of [1,2,7]){
    const {owner}=fixture();let previous=meshes(capture(owner,stage,0)),wraps=0;
    for(let clock=1;clock<=800;clock++){
      const current=meshes(capture(owner,stage,clock));
      current.forEach((command,batch)=>{
        const vertices=command[2],old=previous[batch][2];
        for(let i=0;i<vertices.length;i++){
          const distance=Math.hypot(vertices[i][0]-old[i][0],vertices[i][1]-old[i][1]);
          if(distance>25){wraps++;assert.ok((old[i][4]&255)<=1&&(vertices[i][4]&255)<=1,'visible lifecycle discontinuity');}
        }
      });previous=current;
    }
    assert.ok(wraps>0,`stage ${stage} did not exercise a wrap`);
  }
});

test('water, rain, bell and mirror rings have a geometric transparent centre',()=>{
  for(const stage of [2,3,6,7]){
    const {owner,handles}=fixture(),frame=capture(owner,stage,487),texture=handles.get('packages/thlib/assets/spell-common/aura.png');
    let rings=0;
    for(const [,id,vertices,indices] of meshes(frame).filter(command=>command[1]===texture)){
      assert.equal(id,texture);
      const roots=vertices.map((_,i)=>i),root=index=>{while(roots[index]!==index)index=roots[index];return index;};
      for(let i=0;i<indices.length;i+=3){const a=root(indices[i]);roots[root(indices[i+1])]=a;roots[root(indices[i+2])]=a;}
      const groups=new Map();
      for(let i=0;i<vertices.length;i++){const key=root(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
      for(const group of groups.values()){
        rings++;const points=group.map(index=>vertices[index]),xs=points.map(v=>v[0]),ys=points.map(v=>v[1]);
        const centre=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2],members=new Set(group);
        assert.ok(points.every(point=>Math.hypot(point[0]-centre[0],point[1]-centre[1])>.5));
        for(let i=0;i<indices.length;i+=3){
          if(!members.has(indices[i]))continue;
          const triangle=indices.slice(i,i+3).map(index=>vertices[index]);
          const cross=triangle.map((a,j)=>{const b=triangle[(j+1)%3];return(b[0]-a[0])*(centre[1]-a[1])-(b[1]-a[1])*(centre[0]-a[0]);});
          assert.ok(cross.some(value=>value>1e-8)&&cross.some(value=>value< -1e-8),'a ripple triangle fills its centre');
        }
      }
    }
    assert.ok(rings>=3,`stage ${stage} has no actual ring geometry`);
  }
});

test('public material manifest is lazy and borrowed GameArt textures remain owned by GameArt',()=>{
  const {owner,reads,loads,unloads}=fixture(9,false);
  assert.deepEqual(reads,[]);capture(owner,1,20);capture(owner,4,200);capture(owner,4,200);
  assert.deepEqual(reads,['packages/thlib/assets/spell-common/manifest.json']);
  assert.equal(new Set(loads).size,loads.length);assert.ok(loads.some(path=>path==='assets/scenery/stage04-atlas.png'));
  owner.destroy();owner.destroy();assert.deepEqual(unloads,[]);
  assert.throws(()=>capture(owner,1,20),/destroyed/);
});

test('invalid stage and non-simulation clocks fail before material loading',()=>{
  const {owner,loads,reads}=fixture(3,false);
  for(const [stage,clock] of [[0,1],[8,1],[1,NaN],[1,-1],[1,.5],[1,Infinity]])assert.throws(()=>capture(owner,stage,clock),RangeError);
  assert.deepEqual(loads,[]);assert.deepEqual(reads,[]);
});
