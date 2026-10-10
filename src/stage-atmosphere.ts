import {SpriteAtlas} from '@ts-stg/thlib';
import type {SpritePackManifest} from '@ts-stg/thlib';
import type {AnmDrawList} from '@ts-stg/thlib/touhou';
import type {GameArt} from './art.js';
import type {MeshVertex} from './ui-types.js';
import {SCENERY_ATLASES,sceneryRegion} from './background-art.js';

const TAU=Math.PI*2;
const DEFAULT_MATERIAL_PATH='packages/thlib/assets/spell-common';
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const smooth=(value:number)=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const tint=(rgb:number,opacity:number)=>((rgb<<8)|Math.round(clamp(opacity,0,1)*255))>>>0;
const RING_UNITS=new Map([12,16].map(count=>[count,Array.from({length:count+1},(_,i)=>[Math.cos(i/count*TAU),Math.sin(i/count*TAU)])]));
type Blend='alpha'|'add';
interface Material{texture:number;uv:readonly number[];}
interface Batch{texture:number;blend:Blend;vertices:MeshVertex[];indices:number[];}
interface Drift{t:number;fade:number;phase:number;x:number;near:boolean;scale:number;}
export interface StageAtmosphereStats{stage:number;clock:number;particles:number;features:string[];meshCalls:number;vertices:number;}
export interface StageAtmosphereOptions{art:GameArt;seed?:number;manifest?:SpritePackManifest;materialPath?:string;}

export const STAGE_ATMOSPHERE_FEATURES:readonly (readonly string[])[]=Object.freeze([
  ['lantern-embers','falling-leaves','warm-haze'],
  ['layered-rain','rain-ripples','drifting-letters'],
  ['water-glints','expanding-water-rings','river-mist'],
  ['flowing-silk','gold-fibres','plum-petals'],
  ['turning-pages','archive-dust','quiet-light'],
  ['bell-resonance','rising-gold-dust','cloud-breath'],
  ['mirrored-shards','inverted-bell-echo','mirror-ripples'],
].map(features=>Object.freeze(features)));

/** Consumer-owned ambience sampled from the simulation clock. Every slot has
 * its own seeded phase and fades to zero before repeating; drawing never
 * advances an RNG, a lifetime, or the background camera. Public common sprites
 * are borrowed through GameArt, alongside this game's existing painted detail.
 */
export class StageAtmosphere{
  declare art:GameArt;declare seed:number;declare manifest:SpritePackManifest|undefined;
  declare materialPath:string;declare atlas:SpriteAtlas|null;declare materials:Map<string,Material>;
  declare destroyed:boolean;
  constructor({art,seed=0,manifest,materialPath=DEFAULT_MATERIAL_PATH}:StageAtmosphereOptions){
    if(!art?.load)throw new TypeError('Stage atmosphere requires GameArt');
    this.art=art;this.seed=seed>>>0;this.manifest=manifest;this.materialPath=materialPath;
    this.atlas=null;this.materials=new Map();this.destroyed=false;
  }
  private common(name:string):Material{
    const key=`common:${name}`,cached=this.materials.get(key);if(cached)return cached;
    if(!this.atlas){
      const manifest=this.manifest??JSON.parse(this.art.host.readText(`${this.materialPath}/manifest.json`)) as SpritePackManifest;
      this.atlas=new SpriteAtlas(manifest,{loadTexture:path=>this.art.load(path).id,unloadTexture:()=>{}},{basePath:this.materialPath});
    }
    const sprite=this.atlas.getSprite(name),texture=this.atlas.manifest.textures[sprite.texture];
    // Half-texel inset keeps bilinear samples inside the named sprite. The
    // neighbouring common atlas regions include lettering, so no UV wrapping.
    const material={texture:this.atlas.texture(sprite.texture),uv:[(sprite.x+.5)/texture.width,(sprite.y+.5)/texture.height,
      (sprite.x+sprite.width-.5)/texture.width,(sprite.y+sprite.height-.5)/texture.height]};
    this.materials.set(key,material);return material;
  }
  private detail(stage:number):Material{
    const key=`detail:${stage}`,cached=this.materials.get(key);if(cached)return cached;
    const material={texture:this.art.load(SCENERY_ATLASES[stage-1].path).id,uv:sceneryRegion(stage,'detail')};
    this.materials.set(key,material);return material;
  }
  private random(stage:number,index:number,lane:number){
    let word=(this.seed^Math.imul(stage,0x9e3779b1)^Math.imul(index+1,0x85ebca6b)^Math.imul(lane+1,0xc2b2ae35))>>>0;
    word=Math.imul(word^(word>>>16),0x7feb352d);word=Math.imul(word^(word>>>15),0x846ca68b);
    return((word^(word>>>16))>>>0)/4294967296;
  }
  private drift(stage:number,index:number,clock:number,period:number):Drift{
    const near=index%3===0,duration=period*(near?.66:1.12)*(.86+this.random(stage,index,1)*.28);
    const age=clock/duration+this.random(stage,index,2),t=age-Math.floor(age);
    return{t,fade:smooth(t/.13)*smooth((1-t)/.2),phase:this.random(stage,index,3)*TAU,
      x:80+this.random(stage,index,4)*512,near,scale:near?1.35:.78};
  }
  draw(draw:AnmDrawList,stage:number,clock:number):StageAtmosphereStats{
    if(this.destroyed)throw new Error('Stage atmosphere is destroyed');
    if(!Number.isInteger(stage)||stage<1||stage>7||!Number.isSafeInteger(clock)||clock<0)throw new RangeError('Invalid stage atmosphere clock or stage');
    const batches=new Map<string,Batch>();let particles=0;
    const batchFor=(material:Material,blend:Blend)=>{
      const key=`${material.texture}:${blend}`;let batch=batches.get(key);
      if(!batch){batch={texture:material.texture,blend,vertices:[],indices:[]};batches.set(key,batch);}
      return batch;
    };
    const quad=(material:Material,x:number,y:number,width:number,height:number,rotation:number,rgb:number,opacity:number,blend:Blend='alpha',mirror=false)=>{
      const c=Math.cos(rotation),s=Math.sin(rotation),rx=(Math.abs(c)*width+Math.abs(s)*height)/2,ry=(Math.abs(s)*width+Math.abs(c)*height)/2;
      // Clipping belongs to the public compositor. Keep all ambience geometry
      // inside its playfield without changing scissor or render targets.
      x=clamp(x,48+rx,624-rx);y=clamp(y,24+ry,696-ry);
      const batch=batchFor(material,blend);
      const start=batch.vertices.length,[u0,v0,u1,v1]=material.uv,color=tint(rgb,opacity);
      const uv=mirror?[[u1,v0],[u0,v0],[u0,v1],[u1,v1]]:[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
      [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].forEach(([px,py],i)=>{
        batch!.vertices.push([x+px*c-py*s,y+px*s+py*c,uv[i][0],uv[i][1],color]);
      });
      batch.indices.push(start,start+1,start+2,start,start+2,start+3);particles++;
    };
    const circle=this.common('charge.circle'),leaf=()=>this.common('charge.leaf'),ring=()=>this.common('boss.aura-ring');
    const annulus=(x:number,y:number,width:number,height:number,rotation:number,rgb:number,opacity:number,blend:Blend='alpha',segments=16)=>{
      const material=ring(),batch=batchFor(material,blend),start=batch.vertices.length,c=Math.cos(rotation),s=Math.sin(rotation);
      const a=width/2,b=height/2,thickness=Math.min(b*.3,1.15+width*.008),rx=Math.hypot(a*c,b*s),ry=Math.hypot(a*s,b*c);
      x=clamp(x,48+rx,624-rx);y=clamp(y,24+ry,696-ry);
      const [u0,v0,u1,v1]=material.uv,color=tint(rgb,opacity),v=(v0+v1)/2;
      // The common aura is a soft solid shape, not a ring. Sample its middle
      // row across a narrow annular band; no triangle enters the central hole.
      // Reusing cached circular topology also keeps expanding ripples cheap.
      for(const [dx,dy] of RING_UNITS.get(segments)!){
        for(let side=0;side<2;side++){
          const px=dx*(a-side*thickness),py=dy*(b-side*thickness);
          batch.vertices.push([x+px*c-py*s,y+px*s+py*c,side?u1:u0,v,color]);
        }
      }
      for(let i=0;i<segments;i++){const n=start+i*2;batch.indices.push(n,n+2,n+1,n+2,n+3,n+1);}
      particles++;
    };
    const wind=(p:Drift,amount=22)=>Math.sin(clock*(p.near?.006:.0036)+p.phase)*amount;
    // Broad, extremely faint haze moves at its own pace behind the small
    // particles. It shares their material and adds no extra draw calls.
    for(let i=0;i<3;i++){
      const p=this.drift(stage,90+i,clock,1100),watery=stage===3||stage===6||stage===7;
      const rgb=[0xe4af68,0x7fa4b7,0x7ac7be,0xab83b9,0xc0c6a0,0xb8d6c0,0x91a5da][stage-1];
      if(watery)annulus(154+i*176+wind(p,28),160+p.t*450,190+p.t*62,stage===6?62:26,
        Math.sin(p.phase+clock*.001)*.07,rgb,p.fade*.055,'alpha',12);
      else quad(circle,154+i*176+wind(p,28),160+p.t*450,190+p.t*62,80,
        Math.sin(p.phase+clock*.001)*.07,rgb,p.fade*.025);
    }
    if(stage===1){
      for(let i=0;i<34;i++){
        const p=this.drift(stage,i,clock,740),flicker=.78+.22*Math.sin(clock*.031+p.phase);
        quad(circle,p.x+wind(p),654-p.t*570,3*p.scale,7*p.scale,.16*Math.sin(p.phase),0xf0b166,p.fade*.36*flicker,'add');
      }
      for(let i=0;i<12;i++){
        const p=this.drift(stage,40+i,clock,600),turn=clock*.006+p.phase,size=p.scale*(p.near?1.7:1);
        quad(leaf(),p.x+wind(p,36),56+p.t*590,(5+Math.abs(Math.cos(turn))*7)*size,8*size,turn,
          i%2?0xbe874e:0xd49b61,p.fade*.43);
      }
    }else if(stage===2){
      for(let i=0;i<60;i++){
        const p=this.drift(stage,i,clock,190);
        quad(circle,p.x+wind(p,11)+p.t*23,44+p.t*632,(p.near?1.7:1.0),p.near?25:14,-.13,0x9dbfc9,p.fade*(p.near?.33:.2));
      }
      for(let i=0;i<8;i++){
        const p=this.drift(stage,64+i,clock,155),width=12+p.t*42;
        annulus(p.x,352+this.random(stage,i,7)*288,width,width*.22,0,0xabc4c8,p.fade*(1-p.t)*.25);
      }
      for(let i=0;i<3;i++){
        const p=this.drift(stage,76+i,clock,860);
        quad(this.detail(stage),p.x+wind(p,30),108+p.t*470,30*p.scale,27*p.scale,Math.sin(clock*.005+p.phase)*.45,0xc6d1ca,p.fade*.26);
      }
    }else if(stage===3){
      for(let i=0;i<28;i++){
        const p=this.drift(stage,i,clock,680);
        quad(circle,p.x+wind(p,25),206+p.t*450,10*p.scale,2*p.scale,-.04,0x9cdbcc,p.fade*.29);
      }
      for(let i=0;i<12;i++){
        const p=this.drift(stage,40+i,clock,340),width=(14+p.t*67)*p.scale;
        annulus(p.x+wind(p,7),190+this.random(stage,i,8)*450,width,width*.25,Math.sin(p.phase)*.07,0xafd5ce,p.fade*(1-p.t*.55)*.27);
      }
    }else if(stage===4){
      for(let i=0;i<4;i++){
        const p=this.drift(stage,70+i,clock,930),x=i%2?530:142;
        quad(this.detail(stage),x+wind(p,22),90+p.t*490,90*p.scale,108*p.scale,Math.sin(clock*.002+p.phase)*.22,0xc4adcc,p.fade*.2);
      }
      for(let i=0;i<16;i++){
        const p=this.drift(stage,i,clock,620);
        quad(circle,p.x+wind(p,33),64+p.t*560,1.1*p.scale,(32+this.random(stage,i,5)*35)*p.scale,
          (i%2?-.65:.5)+Math.sin(clock*.003+p.phase)*.15,0xd2b889,p.fade*.29);
      }
      for(let i=0;i<24;i++){
        const p=this.drift(stage,24+i,clock,760),angle=clock*.004+p.phase,size=p.scale*(p.near?1.5:1);
        quad(leaf(),p.x+wind(p,31),74+p.t*550,(3+Math.abs(Math.cos(angle))*4)*size,5*size,angle,0xc89cae,p.fade*.34);
      }
    }else if(stage===5){
      for(let i=0;i<16;i++){
        const p=this.drift(stage,i,clock,810),turn=clock*.008+p.phase;
        quad(this.detail(stage),p.x+wind(p,30),104+p.t*520,(2+Math.abs(Math.cos(turn))*6)*p.scale,32*p.scale,
          Math.sin(clock*.003+p.phase)*.6,0xe4d9b7,p.fade*.47, 'alpha',Math.cos(turn)<0);
      }
      for(let i=0;i<28;i++){
        const p=this.drift(stage,32+i,clock,960);
        quad(circle,p.x+wind(p,18),652-p.t*546,2.2*p.scale,4.8*p.scale,.1,0xc5c39a,p.fade*.24,'add');
      }
    }else if(stage===6){
      for(let i=0;i<8;i++){
        const p=this.drift(stage,42+i,clock,430),width=18+p.t*104;
        annulus(i%2?490:182,156+this.random(stage,i,9)*405,width,width*.48,Math.sin(p.phase)*.16,0xc7d4ad,p.fade*(1-p.t*.65)*.23,'add');
      }
      for(let i=0;i<32;i++){
        const p=this.drift(stage,i,clock,710);
        quad(circle,p.x+wind(p,18),652-p.t*580,2.7*p.scale,7*p.scale,.1*Math.sin(p.phase),i%2?0xd8c893:0xa9d0c8,p.fade*.29,'add');
      }
    }else{
      for(let i=0;i<16;i++){
        const p=this.drift(stage,i,clock,730),x=118+this.random(stage,i,6)*168+wind(p,16),y=74+p.t*548,turn=clock*.005+p.phase;
        const size=p.scale*(p.near?1.75:1),width=(2.5+Math.abs(Math.cos(turn))*3)*size,height=15*size;
        quad(leaf(),x,y,width,height,turn,0xb4c4e4,p.fade*.37);
        quad(leaf(),672-x,y+Math.sin(clock*.007+p.phase)*9,width,height,-turn,0xb1a6c9,p.fade*.22,'alpha',true);
      }
      for(let i=0;i<2;i++){
        const p=this.drift(stage,66+i,clock,1000);
        quad(this.detail(stage),i?523:149,180+p.t*350,24,57,Math.sin(clock*.002+p.phase)*.14,0xbdc3d7,p.fade*.17,'alpha',i===1);
      }
    }
    let vertices=0;
    for(const batch of batches.values()){
      draw.sampler(batch.texture,'bilinear','clamp','clamp')
        .blendFactors('srcAlpha',batch.blend==='add'?'one':'oneMinusSrcAlpha','add','zero','one','add')
        .mesh(batch.texture,batch.vertices,batch.indices).blendEnd();vertices+=batch.vertices.length;
    }
    return{stage,clock,particles,features:[...STAGE_ATMOSPHERE_FEATURES[stage-1]],meshCalls:batches.size,vertices};
  }
  destroy(){
    if(this.destroyed)return;this.destroyed=true;this.atlas?.dispose();this.atlas=null;this.materials.clear();
    // The adapter intentionally does not unload: GameArt owns every texture.
  }
}
