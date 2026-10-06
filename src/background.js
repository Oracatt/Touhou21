/** Hand-painted alpha panels in a real perspective world, not solid geometric
 * approximations of buildings. Scenery stays in this game's business layer. */
import {SCENERY_ATLASES,sceneryRegion} from './background-art.js';
import {DynamicSpellBackground} from './spell-background.js';
export const BACKGROUND_VIEWPORT=Object.freeze({x:48,y:24,width:576,height:672,canvasWidth:960,canvasHeight:720});
const TILE=48,NEAR=2,FAR=220,TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const unit=v=>{const n=Math.hypot(...v);if(!(n>1e-8))throw new RangeError('Degenerate camera vector');return v.map(c=>c/n);};
const rgba=(r,g,b,a=255)=>((Math.round(clamp(r,0,255))<<24)|(Math.round(clamp(g,0,255))<<16)|(Math.round(clamp(b,0,255))<<8)|Math.round(clamp(a,0,255)))>>>0;
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const translation=(x,y,z)=>{const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;};
/** Column-major product: b acts first, then a. Clip W reaches the GPU intact. */
export function multiply3d(a,b){const m=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m;}
export function perspective3d(fov=Math.PI*.30,aspect=576/672,near=NEAR,far=FAR){
  if(!(fov>0&&fov<Math.PI&&aspect>0&&near>0&&far>near))throw new RangeError('Invalid perspective');
  const f=1/Math.tan(fov/2);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(far-near),1,0,0,-2*near*far/(far-near),0];
}
export function lookAt3d(eye,target,up=[0,1,0]){
  const forward=unit(sub(target,eye)),right=unit(cross(up,forward)),vertical=cross(forward,right);
  return[right[0],vertical[0],forward[0],0,right[1],vertical[1],forward[1],0,right[2],vertical[2],forward[2],0,-dot(right,eye),-dot(vertical,eye),-dot(forward,eye),1];
}
export function viewport3d(viewport=BACKGROUND_VIEWPORT){const {x,y,width,height,canvasWidth,canvasHeight}=viewport,m=identity();m[0]=width/canvasWidth;m[5]=height/canvasHeight;m[12]=(x*2+width)/canvasWidth-1;m[13]=1-(y*2+height)/canvasHeight;return m;}
export function transform3d(m,point){const[x,y,z,w=1]=point;return[0,1,2,3].map(r=>m[r]*x+m[4+r]*y+m[8+r]*z+m[12+r]*w);}
export function project3d(m,point,viewport=BACKGROUND_VIEWPORT){const[x,y,z,w]=transform3d(m,point);if(!(w>0))return null;return{x:(x/w+1)*viewport.canvasWidth/2,y:(1-y/w)*viewport.canvasHeight/2,depth:z/w,w};}
const THEMES=[
  {fog:0x15232fff,height:15,speed:.095,tint:[255,240,223]},
  {fog:0x162e38ff,height:14,speed:.085,tint:[219,243,250]},
  {fog:0x162d3cff,height:17,speed:.082,tint:[224,247,241]},
  {fog:0x27253aff,height:15,speed:.089,tint:[250,231,253]},
  {fog:0x172b27ff,height:12,speed:.081,tint:[224,243,225]},
  {fog:0x2e4c48ff,height:18,speed:.079,tint:[233,249,239]},
  {fog:0x19283fff,height:15,speed:.092,tint:[228,236,255]},
];
/** One painted atlas with many independent world planes. Alpha mattes and
 * ground are sorted together; static vertices and bounded fog caches persist. */
class SceneryBatch{
  constructor(stage,label){this.stage=stage;this.theme=THEMES[stage-1];this.label=label;this.vertices=[];this.faces=[];this.features=new Set();this.fogCache=new Map();}
  quad(points,region,{tag=region,alpha=255,light=1,flip=false,v0=0,v1=1}={}){
    const[u0,t0,u1,t1]=sceneryRegion(this.stage,region),top=t0+(t1-t0)*v0,bottom=t0+(t1-t0)*v1;
    const uv=flip?[[u1,bottom],[u0,bottom],[u0,top],[u1,top]]:[[u0,bottom],[u1,bottom],[u1,top],[u0,top]];
    const start=this.vertices.length,paint=rgba(...this.theme.tint.map(c=>c*light),alpha);
    points.forEach((p,i)=>this.vertices.push([...p.map(Math.fround),...uv[i],paint]));
    const layer=tag.includes('cloud-bank')?0:region==='ground'?1:2;
    this.faces.push({center:[0,1,2].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/4),indices:[start,start+1,start+2,start,start+2,start+3],region,tag,layer});this.features.add(tag);return this;
  }
  panel(region,x,y,z,width,height,{yaw=0,...options}={}){
    const dx=Math.cos(yaw)*width/2,dz=Math.sin(yaw)*width/2;
    return this.quad([[x-dx,y,z-dz],[x+dx,y,z+dz],[x+dx,y+height,z+dz],[x-dx,y+height,z-dz]],region,options);
  }
  surface(x,y,z,width,depth,{region='ground',rise=0,...options}={}){
    return this.quad([[x-width/2,y,z],[x+width/2,y,z],[x+width/2,y+rise,z+depth],[x-width/2,y+rise,z+depth]],region,options);
  }
  orderedIndices(forward){
    // The topology is deliberately stratified: clouds lie below the floor,
    // opaque ground below standing cutouts. A centroid-only sort would let a
    // ground strip paint over the foot of a tall bridge. Within each layer
    // far-to-near order retains transparent landscape and ornament depth.
    const order=this.faces.map((f,i)=>({i,layer:f.layer,depth:dot(f.center,forward)})).sort((a,b)=>a.layer-b.layer||b.depth-a.depth||a.i-b.i),indices=[];
    for(const f of order)indices.push(...this.faces[f.i].indices);return indices;
  }
  fogVertices(level=0){
    const key=clamp(Math.round(level),0,8);if(this.fogCache.has(key))return this.fogCache.get(key);
    // Original alpha is retained. Distance light/coverage attenuation reveals
    // the atmospheric painted distance, without an opaque glow sprite box.
    const light=1-key*.058,alpha=1-key*.073;
    const vertices=key===0?this.vertices:this.vertices.map(v=>[...v.slice(0,5),rgba((v[5]>>>24)*light,((v[5]>>>16)&255)*light,((v[5]>>>8)&255)*light,(v[5]&255)*alpha)]);
    this.fogCache.set(key,vertices);return vertices;
  }
}
function floor(g,{width=60,y=0,depth=TILE,start=0,tag='painted-ground'}={}){
  const pieces=Math.ceil(depth/12),step=depth/pieces;
  for(let i=0;i<pieces;i++)g.surface(0,y,start+i*step,width,step,{tag,light:.82,v0:(pieces-i-1)/pieces,v1:(pieces-i)/pieces});
}
function grove(g,variant,tag){
  for(const side of [-1,1])for(let i=0;i<3;i++)g.panel('edge',side*(18+(i%2)*6),-.6,5+i*17+(side===1?5:0),25*(1+(i%2)*.16),23*(1+(i%2)*.16),{yaw:side*.19,flip:side===1,light:.78-(i%2)*.06,tag});
  if(variant===1)g.panel('edge',-29,0,31,34,30,{yaw:.27,light:.65,tag});
}
function roadGeometry(stage,variant){
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
/** Independent spell scenery with a bounded orbital arc. Full rotations
 * would expose a painting's back, so the camera drifts around its front. */
function spellGeometry(stage){
  const g=new SceneryBatch(stage,`stage${stage}-spell`);floor(g,{width:92,y:stage===3?-.35:0,depth:216,start:-48,tag:'spell-painted-floor'});
  if(stage===1){
    g.panel('landmark',0,0,35,37,31,{tag:'torii',light:.73});
    for(const x of [-20,20])g.panel('edge',x,-.5,45,31,29,{yaw:x>0?.15:-.15,tag:'spell-autumn-grove',light:.68});
    for(let i=0;i<6;i++){const a=i*TAU/6;g.panel('detail',Math.cos(a)*17,0,23+Math.sin(a)*15,3.9,10,{yaw:Math.cos(a)*.18,tag:'spell-lantern',light:.8});}
  }else if(stage===2){
    for(let i=0;i<5;i++)g.panel('edge',-28+i*14,0,22+Math.abs(2-i)*8,24,30,{yaw:(i-2)*.12,tag:'bamboo',light:.63});
    g.panel('landmark',0,0,50,27,25,{tag:'spell-letter-shelter',light:.7});
    for(let i=0;i<7;i++)g.panel('detail',Math.sin(i*1.61)*17,5+i*.7,12+i*6,5.6,5.6,{yaw:Math.sin(i)*.35,tag:'spell-rain-letters',alpha:156,light:.83});
  }else if(stage===3){
    g.panel('landmark',0,-.02,35,48,16,{tag:'arched-bridge',light:.7});
    for(const side of [-1,1])g.panel('edge',side*20,0,48,19,12,{yaw:side*.18,flip:side===1,tag:'spell-ferry',light:.72});
    for(let i=0;i<10;i++){const a=i*TAU/10;g.panel('detail',Math.cos(a)*21,.05,27+Math.sin(a)*21,3.2,3.8,{tag:'spell-water-lantern',light:.86});}
  }else if(stage===4){
    for(const side of [-1,1]){g.panel('edge',side*26,0,38,29,27,{yaw:side*.15,tag:'spell-plum',light:.64});g.panel('landmark',side*15,0,29,15,20,{yaw:side*.23,tag:'loom',light:.73});}
    for(let i=0;i<6;i++)g.panel('detail',Math.sin(i*2.3)*12,4+i,9+i*9,27,14,{yaw:Math.sin(i)*.26,tag:'spell-gold-silk',alpha:107,light:.7});
  }else if(stage===5){
    for(const side of [-1,1])for(let i=0;i<5;i++)g.panel('landmark',side*15,0,-5+i*19,20,25,{yaw:side*Math.PI/2,tag:'bookshelf',light:.65});
    g.panel('edge',0,0,61,34,30,{tag:'spell-archive-door',light:.69});
    for(let i=0;i<8;i++)g.panel('detail',Math.sin(i*2.1)*12,5+i*.8,10+i*7,2.2,6.3,{yaw:Math.sin(i)*.4,tag:'spell-seal-paper',alpha:185,light:.85});
  }else if(stage===6){
    for(let i=0;i<6;i++){const a=i*TAU/6;g.panel('landmark',Math.cos(a)*23,1,31+Math.sin(a)*21,9.5,27,{yaw:Math.cos(a)*.19,tag:'name-pillar',light:.73});}
    for(const side of [-1,1])g.surface(side*23,-1,0,54,92,{region:'edge',tag:'spell-cloud-bank',alpha:157,light:.8});
    g.panel('detail',0,16,45,11,25,{tag:'spell-great-bell',light:.85});
  }else{
    for(const side of [-1,1])for(let i=0;i<3;i++)g.panel('landmark',side*18,0,6+i*21,10,25,{yaw:side*.34,tag:'mirror-pillar',light:.66});
    for(let i=0;i<4;i++)g.panel('edge',Math.sin(i*2)*8,8,7+i*15,9,24,{yaw:Math.sin(i)*.21,tag:'spell-echo-ribbons',alpha:95,light:.7});
    g.panel('detail',-5,12,33,8,19,{tag:'spell-inverted-bell',light:.8});g.panel('detail',8,18,52,6,15,{tag:'spell-inverted-bell',light:.77});
  }
  return g;
}
export function cameraForStage(stage,clock=0,spell=false){
  const id=typeof stage==='number'?stage:stage?.id;if(!Number.isInteger(id)||id<1||id>7||!Number.isFinite(clock))throw new RangeError('Invalid stage camera');const t=THEMES[id-1];
  if(spell){const a=clock*.00057+id*.52,roll=id===7?Math.sin(a*.7)*.023:Math.sin(a*.43)*.006;return{eye:[Math.sin(a)*5.2,t.height+Math.sin(a*.71)*.7,-17+Math.cos(a)*2.2].map(Math.fround),target:[Math.sin(a+.4)*1.5,4.3,35],up:[Math.sin(roll),Math.cos(roll),0],fov:Math.fround(Math.PI*.31)};}
  const travel=clock*t.speed,sway=Math.sin(clock*.0011+id*.73),lift=Math.sin(clock*.00081+id)*.65,turn=Math.sin(clock*.00053+id)*.9,roll=id===7?Math.sin(clock*.00074)*.019:0;
  return{eye:[sway*(id===5?.65:2.3),t.height+lift,travel].map(Math.fround),target:[sway*.55+turn,id===6?3.5:2.7,travel+46].map(Math.fround),up:[Math.sin(roll),Math.cos(roll),0],fov:Math.fround(Math.PI*.30)};
}
export class StageBackground{
  constructor({art,seed=0}={}){if(!art?.load||!art?.background)throw new TypeError('StageBackground requires GameArt');this.art=art;this.viewport=viewport3d();this.stage=null;this.texture=null;this.geometry=null;this.geometryVariants=null;this.spellGeometry=null;this.spellSets=new Map();this.spellBackground=new DynamicSpellBackground({art,seed});this.stats=null;this.destroyed=false;}
  setStage(stage){
    if(this.destroyed)throw new Error('StageBackground is destroyed');const id=typeof stage==='number'?stage:stage?.id;if(!Number.isInteger(id)||id<1||id>7)throw new RangeError('Stage must be 1..7');if(this.stage?.id===id)return this;
    this.stage=typeof stage==='number'?{id,background:`stage0${id}`}:stage;this.texture=this.art.load(SCENERY_ATLASES[id-1].path);this.geometryVariants=[0,1,2].map(v=>roadGeometry(id,v));this.geometry=this.geometryVariants[0];this.spellGeometry=spellGeometry(id);this.spellSets.clear();this.spellSets.set(id,this.spellGeometry);this.spellBackground.reset(id);this.stats=null;return this;
  }
  /** Call after a successful unpaused game update. Rendering only samples
   * this frame; neither pause renders nor multiple capture passes advance it. */
  update(game,options={}){if(this.destroyed)throw new Error('StageBackground is destroyed');this.spellBackground.update(game,options);return this;}
  draw(draw,game,{stage=this.stage,clock=game?.frame??0}={}){
    if(this.destroyed)throw new Error('StageBackground is destroyed');if(stage)this.setStage(stage);if(!this.stage)throw new Error('StageBackground has no stage');if(!Number.isFinite(clock))throw new RangeError('Invalid visual clock');
    // Standalone consumers may draw an already-running card before their
    // first update. This one-time initial sync is not a render-time ticker.
    if(this.spellBackground.clock===null)this.update(game,{clock});
    const visualClock=this.spellBackground.clock??clock,cards=this.spellBackground.visibleCards();
    const id=this.stage.id,spell=Boolean(game?.spell?.active),theme=THEMES[id-1],camera=cameraForStage(id,visualClock,false);
    draw.rect(48,24,576,672,theme.fog);this.art.background(draw,this.stage.background??`stage0${id}`,336,360,576,672,{alpha:.37,offset:0});
    const eye=[...camera.eye],target=[...camera.target];let first=0;
    first=Math.floor(camera.eye[2]/TILE)-1;const origin=first*TILE;eye[2]-=origin;target[2]-=origin;
    const forward=unit(sub(target,eye)),view=lookAt3d(eye,target,camera.up),vp=multiply3d(this.viewport,multiply3d(perspective3d(camera.fov),view));draw.sampler(this.texture.id,'bilinear','clamp','clamp');
    let meshCalls=0,vertices=0;
    for(let tile=6;tile>=0;tile--){const variant=((first+tile)%3+3)%3,m=this.geometryVariants[variant],v=m.fogVertices(tile<2?0:tile-1);draw.mesh3d(this.texture.id,v,m.orderedIndices(forward),multiply3d(vp,translation(0,0,tile*TILE)));meshCalls++;vertices+=v.length;}
    for(const card of cards){
      const style=card.style,cardTheme=THEMES[style-1];
      draw.rect(48,24,576,672,((cardTheme.fog&0xffffff00)|Math.round(card.opacity*226))>>>0);
      let m=this.spellSets.get(style);if(!m){m=spellGeometry(style);this.spellSets.set(style,m);}
      const spellCamera=cameraForStage(style,card.age,true),direction=unit(sub(spellCamera.target,spellCamera.eye));
      const clip=multiply3d(this.viewport,multiply3d(perspective3d(spellCamera.fov),lookAt3d(spellCamera.eye,spellCamera.target,spellCamera.up)));
      const source=m.fogVertices(1),v=card.opacity===1?source:source.map(vertex=>[...vertex.slice(0,5),((vertex[5]&0xffffff00)|Math.round((vertex[5]&255)*card.opacity))>>>0]);
      const texture=this.art.load(SCENERY_ATLASES[style-1].path).id;draw.sampler(texture,'bilinear','clamp','clamp').mesh3d(texture,v,m.orderedIndices(direction),clip);meshCalls++;vertices+=v.length;
      const dynamic=this.spellBackground.drawCard(draw,card);meshCalls+=dynamic.meshCalls;vertices+=dynamic.vertices;
    }
    draw.rect(48,24,576,672,cards.length?0x08101d3a:0x08101d1d).rect(48,24,576,105,0x070e1818);
    this.stats={stage:id,spell,meshCalls,vertices,camera,texture:SCENERY_ATLASES[id-1].path,features:[...(cards.length?this.spellSets.get(cards.at(-1).style):this.geometry).features].sort(),dynamic:this.spellBackground.snapshot()};return this;
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.spellBackground.destroy();this.spellSets.clear();this.geometry=null;this.geometryVariants=null;this.spellGeometry=null;this.texture=null;this.stage=null;this.stats=null;/* GameArt owns the borrowed atlases. */}
}
