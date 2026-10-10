import type {AnmDrawList as DrawList} from '@ts-stg/thlib/touhou';
import type {SpritePackManifest} from '@ts-stg/thlib';
import type {GameArt,ArtTexture} from './art.js';

import type {BackgroundGame,StageIdentity,MeshVertex3D,PanelOptions} from './ui-types.js';
/** Hand-painted alpha panels in a real perspective world, not solid geometric
 * approximations of buildings. Scenery stays in this game's business layer. */
import {SCENERY_ATLASES,sceneryRegion} from './background-art.js';
import {DynamicSpellBackground} from './spell-background.js';
import {StageAtmosphere} from './stage-atmosphere.js';
import {cameraForStage,lookAt3d,multiply3d,perspective3d,viewport3d} from './stage-camera.js';
export {BACKGROUND_VIEWPORT,cameraForStage,lookAt3d,multiply3d,perspective3d,project3d,transform3d,viewport3d} from './stage-camera.js';
const TILE=48;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const dot=(a:number[],b:number[])=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]);
const unit=(v:number[])=>{const n=Math.hypot(...v);if(!(n>1e-8))throw new RangeError('Degenerate camera vector');return v.map(c=>c/n);};
const rgba=(r:number,g:number,b:number,a=255)=>((Math.round(clamp(r,0,255))<<24)|(Math.round(clamp(g,0,255))<<16)|(Math.round(clamp(b,0,255))<<8)|Math.round(clamp(a,0,255)))>>>0;
const translation=(x:number,y:number,z:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const THEMES=[
  {fog:0x15232fff,tint:[255,240,223]},
  {fog:0x162e38ff,tint:[219,243,250]},
  {fog:0x162d3cff,tint:[224,247,241]},
  {fog:0x27253aff,tint:[250,231,253]},
  {fog:0x172b27ff,tint:[224,243,225]},
  {fog:0x2e4c48ff,tint:[233,249,239]},
  {fog:0x19283fff,tint:[228,236,255]},
];
/** One painted atlas with many independent world planes. Alpha mattes and
 * ground are sorted together; static vertices and bounded fog caches persist. */
class SceneryBatch{
  declare stage: number;
  declare theme: { fog: number; tint: number[]; };
  declare label: string;

 declare vertices:MeshVertex3D[];declare faces:{center:number[];indices:number[];region:string;tag:string;layer:number}[];declare features:Set<string>;declare fogCache:Map<number,MeshVertex3D[]>;
  constructor(stage:number,label:string){this.stage=stage;this.theme=THEMES[stage-1];this.label=label;this.vertices=[];this.faces=[];this.features=new Set();this.fogCache=new Map();}
  quad(points:number[][],region:string,{tag=region,alpha=255,light=1,flip=false,v0=0,v1=1}:PanelOptions={}){
    const[u0,t0,u1,t1]=sceneryRegion(this.stage,region),top=t0+(t1-t0)*v0,bottom=t0+(t1-t0)*v1;
    const uv=flip?[[u1,bottom],[u0,bottom],[u0,top],[u1,top]]:[[u0,bottom],[u1,bottom],[u1,top],[u0,top]];
    const start=this.vertices.length,paint=rgba(...this.theme.tint.map(c=>c*light) as [number,number,number],alpha);
    points.forEach((p,i)=>this.vertices.push([...p.map(Math.fround),...uv[i],paint] as MeshVertex3D));
    const layer=tag.includes('cloud-bank')?0:region==='ground'?1:2;
    this.faces.push({center:[0,1,2].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/4),indices:[start,start+1,start+2,start,start+2,start+3],region,tag,layer});this.features.add(tag);return this;
  }
  panel(region:string,x:number,y:number,z:number,width:number,height:number,{yaw=0,...options}:PanelOptions={}){
    const dx=Math.cos(yaw)*width/2,dz=Math.sin(yaw)*width/2;
    return this.quad([[x-dx,y,z-dz],[x+dx,y,z+dz],[x+dx,y+height,z+dz],[x-dx,y+height,z-dz]],region,options);
  }
  surface(x:number,y:number,z:number,width:number,depth:number,{region='ground',rise=0,...options}:PanelOptions={}){
    return this.quad([[x-width/2,y,z],[x+width/2,y,z],[x+width/2,y+rise,z+depth],[x-width/2,y+rise,z+depth]],region,options);
  }
  orderedIndices(forward:number[]){
    // The topology is deliberately stratified: clouds lie below the floor,
    // opaque ground below standing cutouts. A centroid-only sort would let a
    // ground strip paint over the foot of a tall bridge. Within each layer
    // far-to-near order retains transparent landscape and ornament depth.
    const order=this.faces.map((f,i)=>({i,layer:f.layer,depth:dot(f.center,forward)})).sort((a,b)=>a.layer-b.layer||b.depth-a.depth||a.i-b.i),indices=[];
    for(const f of order)indices.push(...this.faces[f.i].indices);return indices;
  }
  fogVertices(level=0){
    const key=clamp(Math.round(level),0,8);if(this.fogCache.has(key))return this.fogCache.get(key)!;
    // Original alpha is retained. Distance light/coverage attenuation reveals
    // the atmospheric painted distance, without an opaque glow sprite box.
    const light=1-key*.058,alpha=1-key*.073;
    const vertices=key===0?this.vertices:this.vertices.map(v=>[...v.slice(0,5),rgba((v[5]>>>24)*light,((v[5]>>>16)&255)*light,((v[5]>>>8)&255)*light,(v[5]&255)*alpha)] as MeshVertex3D);
    this.fogCache.set(key,vertices);return vertices;
  }
}
function floor(g:SceneryBatch,{width=60,y=0,depth=TILE,start=0,tag='painted-ground'}={}){
  const pieces=Math.ceil(depth/12),step=depth/pieces;
  for(let i=0;i<pieces;i++)g.surface(0,y,start+i*step,width,step,{tag,light:.82,v0:(pieces-i-1)/pieces,v1:(pieces-i)/pieces});
}
function grove(g:SceneryBatch,variant:number,tag:string){
  for(const side of [-1,1])for(let i=0;i<3;i++)g.panel('edge',side*(18+(i%2)*6),-.6,5+i*17+(side===1?5:0),25*(1+(i%2)*.16),23*(1+(i%2)*.16),{yaw:side*.19,flip:side===1,light:.78-(i%2)*.06,tag});
  if(variant===1)g.panel('edge',-29,0,31,34,30,{yaw:.27,light:.65,tag});
}
function roadGeometry(stage:number,variant:number){
  const g=new SceneryBatch(stage,`stage${stage}-road-${variant}`);
  if(stage===1){
    floor(g);grove(g,variant,'pine-maple');
    if(variant!==1)g.panel('landmark',0,0,variant===0?32:18,27,24,{tag:'torii',light:.92});
    for(const side of [-1,1])for(const z of [9,37])g.panel('detail',side*10,0,z+variant*1.2,3.9,10,{yaw:side*.12,tag:'lantern'});
  }else if(stage===2){
    floor(g,{tag:'wet-path-stream'});grove(g,variant,'bamboo');
    g.panel('landmark',variant%2?-16:16,0,27,17,16,{yaw:variant%2?.28:-.28,tag:'letter-shelter',light:.86});
    for(let i=0;i<3;i++)g.panel('detail',-5+i*5,7+i*.5,9+i*13,4.8,4.8,{yaw:(i-1)*.19,alpha:190,tag:'rain-letters',light:.82});
  }else if(stage===3){
    floor(g,{width:82,y:-.35,tag:'painted-river'});
    if(variant===1)g.panel('landmark',0,-.05,32,42,14,{tag:'arched-bridge',light:.88});
    for(const side of [-1,1]){
      g.panel('edge',side*(14+variant*3),-.02,12+variant*4,15,10,{yaw:side*.21,flip:side===1,tag:'ferry-boat',light:.85});
      for(let i=0;i<2;i++)g.panel('detail',side*(7+i*7),.05,7+i*24,2.7,3.1,{tag:'water-lantern'});
    }
  }else if(stage===4){
    floor(g,{tag:'woven-courtyard'});grove(g,variant,'plum-tree');
    for(const side of [-1,1])g.panel('landmark',side*12,0,18+variant*8,12,15,{yaw:side*.22,tag:'loom',light:.9});
    for(let i=0;i<3;i++)g.panel('detail',-11+i*10,8+i*.9,6+i*16,18,10,{yaw:(i-1)*.17,alpha:138,tag:'gold-thread-sash',light:.78});
  }else if(stage===5){
    floor(g,{width:22,tag:'library-floor'});
    for(const side of [-1,1])for(let i=0;i<3;i++)g.panel('landmark',side*10,0,8+i*16,16.3,18,{yaw:side*Math.PI/2,tag:'bookshelf',light:.81});
    if(variant!==1)g.panel('edge',0,0,38,23,22,{tag:'archive-door',light:.84});
    for(let i=0;i<3;i++)g.panel('detail',-6+i*6,9.5,12+i*13,1.4,4,{yaw:(i-1)*.21,alpha:215,tag:'hanging-talisman',light:.88});
  }else if(stage===6){
    floor(g,{width:22,y:.8,tag:'cloud-stairway'});
    for(const side of [-1,1]){
      for(let i=0;i<3;i++)g.surface(side*(17+i*5),-1.5+i*.2,2+i*17,34,28,{region:'edge',tag:'cloud-bank',alpha:185-i*20,light:.83});
      g.panel('landmark',side*12,1,12+variant*7,7.5,22,{yaw:side*.17,tag:'name-pillar',light:.9});
      g.panel('detail',side*12,19,29-variant*4,4.5,10,{yaw:side*.12,tag:'ritual-bell',light:.95});
    }
  }else{
    floor(g,{width:30,tag:'mirror-water-floor'});
    for(const side of [-1,1])for(let i=0;i<2;i++){
      g.panel('landmark',side*12,0,10+i*26+variant*2,8.5,20,{yaw:side*.32,tag:'mirror-pillar',light:.86});
      g.panel('detail',side*10,15,18+i*22,3.6,8,{tag:'inverted-bell',light:.9});
    }
    for(let i=0;i<3;i++)g.panel('edge',-5+i*5,10,5+i*19,6,16,{yaw:(i-1)*.13,alpha:160,tag:'red-white-ribbons',light:.81});
  }
  return g;
}
export class StageBackground{
 declare stats:{stage:number;spell:boolean;roadVisible:boolean;meshCalls:number;vertices:number;camera:ReturnType<typeof cameraForStage>;texture:string;features:string[];dynamic:ReturnType<DynamicSpellBackground['snapshot']>;atmosphere:ReturnType<StageAtmosphere['draw']>|null}|null;
  declare viewport: number[];
  declare spellBackground: DynamicSpellBackground;
  declare atmosphere: StageAtmosphere;
  declare destroyed: boolean;

 declare art:GameArt;declare stage:StageIdentity|null;declare texture:ArtTexture|null;declare geometry:SceneryBatch|null;declare geometryVariants:SceneryBatch[]|null;
  constructor({art,seed=0,atmosphereManifest}:{art:GameArt;seed?:number;atmosphereManifest?:SpritePackManifest}={} as {art:GameArt}){if(!art?.load||!art?.background)throw new TypeError('StageBackground requires GameArt');this.art=art;this.viewport=viewport3d();this.stage=null;this.texture=null;this.geometry=null;this.geometryVariants=null;this.spellBackground=new DynamicSpellBackground({art,seed});this.atmosphere=new StageAtmosphere({art,seed,manifest:atmosphereManifest});this.stats=null;this.destroyed=false;}
  setStage(stage:number|StageIdentity){
    if(this.destroyed)throw new Error('StageBackground is destroyed');const id=typeof stage==='number'?stage:stage?.id;if(!Number.isInteger(id)||id<1||id>7)throw new RangeError('Stage must be 1..7');if(this.stage?.id===id)return this;
    this.stage=typeof stage==='number'?{id,background:`stage0${id}`}:stage;this.texture=this.art.load(SCENERY_ATLASES[id-1].path);this.geometryVariants=[0,1,2].map(v=>roadGeometry(id,v));this.geometry=this.geometryVariants[0];this.spellBackground.reset(id);this.stats=null;return this;
  }
  /** Call after a successful unpaused game update. Rendering only samples
   * this frame; neither pause renders nor multiple capture passes advance it. */
  update(game:BackgroundGame,options={}){if(this.destroyed)throw new Error('StageBackground is destroyed');this.spellBackground.update(game,options);return this;}
  draw(draw:DrawList,game:BackgroundGame,{stage=this.stage,clock=game?.frame??0}={}){
    if(this.destroyed)throw new Error('StageBackground is destroyed');if(stage)this.setStage(stage);if(!this.stage)throw new Error('StageBackground has no stage');if(!Number.isFinite(clock))throw new RangeError('Invalid visual clock');
    // Standalone consumers may draw an already-running card before their
    // first update. This one-time initial sync is not a render-time ticker.
    if(this.spellBackground.clock===null)this.update(game,{clock});
    const visualClock=this.spellBackground.clock??clock,cards=this.spellBackground.visibleCards();
    const id=this.stage.id,spell=Boolean(game?.spell?.active),theme=THEMES[id-1],camera=cameraForStage(id,visualClock);
    const roadVisible=!cards.some(card=>this.spellBackground.coversRoad(card));
    draw.rect(48,24,576,672,theme.fog);
    let meshCalls=0,vertices=0;
    let atmosphere:ReturnType<StageAtmosphere['draw']>|null=null;
    if(roadVisible){
      this.art.background(draw,this.stage.background??`stage0${id}`,336,360,576,672,{alpha:.37,offset:0});
      const eye=[...camera.eye],target=[...camera.target],first=Math.floor(camera.eye[2]/TILE)-1,origin=first*TILE;
      eye[2]-=origin;target[2]-=origin;
      const forward=unit(sub(target,eye)),view=lookAt3d(eye,target,camera.up),vp=multiply3d(this.viewport,multiply3d(perspective3d(camera.fov),view));draw.sampler(this.texture!.id,'bilinear','clamp','clamp');
      for(let tile=6;tile>=0;tile--){const variant=((first+tile)%3+3)%3,m=this.geometryVariants![variant],v=m.fogVertices(tile<2?0:tile-1);draw.mesh3d(this.texture!.id,v,m.orderedIndices(forward),multiply3d(vp,translation(0,0,tile*TILE)));meshCalls++;vertices+=v.length;}
      // Ambient weather belongs to the same captured road as its scenery.
      // Spell images cover it; public bullets, actors and HUD remain above it.
      atmosphere=this.atmosphere.draw(draw,id,visualClock);meshCalls+=atmosphere.meshCalls;vertices+=atmosphere.vertices;
    }
    for(const card of cards){
      const dynamic=this.spellBackground.drawCard(draw,card);meshCalls+=dynamic.meshCalls;vertices+=dynamic.vertices;
    }
    draw.rect(48,24,576,672,cards.length?0x08101d3a:0x08101d1d).rect(48,24,576,105,0x070e1818);
    this.stats={stage:id,spell,roadVisible,meshCalls,vertices,camera,texture:SCENERY_ATLASES[id-1].path,features:cards.length?['abstract-pattern',cards.at(-1)!.bossId]:[...this.geometry!.features,...(atmosphere?.features??[])].sort(),dynamic:this.spellBackground.snapshot(),atmosphere};return this;
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.spellBackground.destroy();this.atmosphere.destroy();this.geometry=null;this.geometryVariants=null;this.texture=null;this.stage=null;this.stats=null;/* GameArt owns the borrowed textures. */}
}
