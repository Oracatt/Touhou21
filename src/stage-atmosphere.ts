import {SpriteAtlas} from '@ts-stg/thlib';
import type {SpritePackManifest} from '@ts-stg/thlib';
import type {AnmDrawList} from '@ts-stg/thlib/touhou';
import type {GameArt} from './art.js';
import type {MeshVertex} from './ui-types.js';
import {BACKGROUND_VIEWPORT,cameraForStage,lookAt3d,multiply3d,perspective3d,stageTravel,viewport3d} from './stage-camera.js';

const TAU=Math.PI*2;
const DEFAULT_MATERIAL_PATH='packages/thlib/assets/spell-common';
const FIELD=Object.freeze({left:48,top:24,right:624,bottom:696});
const EDGE_FADE=18,TILE=48,RING=16;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const smooth=(value:number)=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const tint=(rgb:number,opacity:number)=>((rgb<<8)|Math.round(clamp(opacity,0,1)*255))>>>0;
const shade=(rgb:number,light:number)=>{
  const channel=(shift:number)=>Math.round(clamp(((rgb>>shift)&255)*light,0,255))<<shift;
  return channel(16)|channel(8)|channel(0);
};
const hash=(seed:number,stage:number,index:number,lane:number,turn:number)=>{
  let word=(seed^Math.imul(stage,0x9e3779b1)^Math.imul(index+1,0x85ebca6b)^Math.imul(lane+1,0xc2b2ae35)^Math.imul(turn+1,0x27d4eb2f))>>>0;
  word=Math.imul(word^(word>>>16),0x7feb352d);word=Math.imul(word^(word>>>15),0x846ca68b);
  return((word^(word>>>16))>>>0)/4294967296;
};
// Cosine and sine columns: the QuickJS backend pays heavily for per-frame
// array destructuring and temporary arrays in these inner loops.
const loop=(count:number,turn=0)=>Object.freeze({
  cos:Object.freeze(Array.from({length:count},(_,i)=>Math.cos(i/count*TAU+turn))),
  sin:Object.freeze(Array.from({length:count},(_,i)=>Math.sin(i/count*TAU+turn))),
});
const HEX=loop(6,.52),OCT=loop(8,.39),RING_UNIT=loop(RING);
const RING_TURN3=Object.freeze(Array.from({length:RING},(_,i)=>i/RING*TAU*3)),RING_TURN5=Object.freeze(Array.from({length:RING},(_,i)=>i/RING*TAU*5));
/** Ripple bands are brighter on their far side. */
const RING_SHADE=Object.freeze(RING_UNIT.sin.map(s=>.45+.55*smooth(.5+s*.6)));
const RING_WOBBLE=new Float64Array(RING),RING_X=new Float64Array(RING*3),RING_Y=new Float64Array(RING*3);
const variantOf=(tile:number)=>((tile%3)+3)%3;
type Blend='alpha'|'add';
interface Material{texture:number;uv:readonly number[];}
interface Batch{texture:number;blend:Blend;vertices:MeshVertex[];indices:number[];}
interface Point{x:number;y:number;scale:number;}
/** particles: submitted slots (constant per stage); visible: slots with any alpha this frame. */
export interface StageAtmosphereStats{stage:number;clock:number;particles:number;visible:number;features:string[];meshCalls:number;vertices:number;}
export interface StageAtmosphereOptions{art:GameArt;seed?:number;manifest?:SpritePackManifest;materialPath?:string;}

export const STAGE_ATMOSPHERE_FEATURES:readonly (readonly string[])[]=Object.freeze([
  ['falling-maple','lantern-glow','warm-fireflies'],
  ['fine-rain','path-ripples'],
  ['water-glints','river-rings','low-mist'],
  ['plum-petals','gold-motes'],
  ['archive-dust','paper-scraps'],
  ['rising-motes','cloud-wisps','bell-glow'],
  ['mirror-shards','rising-drizzle','mirror-ripples'],
].map(features=>Object.freeze(features)));

/** Consumer-owned ambience inside the road's own 3D space. Particles have
 * world positions and are projected with the road camera, so they gain size,
 * parallax and distance fading with the scenery. Every slot is sampled from
 * the simulation clock and fades to zero before it is reused; drawing never
 * advances an RNG, a lifetime, or the background camera.
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
  /** The common "charge.circle" is a hollow ring and the aura a hard-edged
   * blob; neither is a soft dot. Soft shapes therefore sample one opaque
   * white texel at the aura's centre and take their falloff from vertex alpha. */
  private solid():Material{
    const cached=this.materials.get('solid');if(cached)return cached;
    const aura=this.common('boss.aura-ring'),u=(aura.uv[0]+aura.uv[2])/2,v=(aura.uv[1]+aura.uv[3])/2;
    const material={texture:aura.texture,uv:[u,v,u,v]};this.materials.set('solid',material);return material;
  }
  draw(draw:AnmDrawList,stage:number,clock:number):StageAtmosphereStats{
    if(this.destroyed)throw new Error('Stage atmosphere is destroyed');
    if(!Number.isInteger(stage)||stage<1||stage>7||!Number.isSafeInteger(clock)||clock<0)throw new RangeError('Invalid stage atmosphere clock or stage');
    const camera=cameraForStage(stage,clock),eye=camera.eye[2];
    // Camera-relative depth keeps float precision at long clocks; otherwise
    // this is the road's own view, perspective and playfield viewport.
    const matrix=multiply3d(viewport3d(),multiply3d(perspective3d(camera.fov),lookAt3d([camera.eye[0],camera.eye[1],0],[camera.target[0],camera.target[1],camera.target[2]-eye],camera.up)));
    const focal=BACKGROUND_VIEWPORT.height/2/Math.tan(camera.fov/2),{canvasWidth,canvasHeight}=BACKGROUND_VIEWPORT;
    const m0=matrix[0],m1=matrix[1],m3=matrix[3],m4=matrix[4],m5=matrix[5],m7=matrix[7],m8=matrix[8],m9=matrix[9],m11=matrix[11],m12=matrix[12],m13=matrix[13],m15=matrix[15];
    // project3d with the same operation order (identical results), minus its
    // temporary arrays: this runs hundreds of times a frame.
    const at=(x:number,y:number,z:number):Point|null=>{
      const d=z-eye,w=m3*x+m7*y+m11*d+m15;if(!(w>1))return null;
      return{x:((m0*x+m4*y+m8*d+m12)/w+1)*canvasWidth/2,y:(1-(m1*x+m5*y+m9*d+m13)/w)*canvasHeight/2,scale:focal/w};
    };
    const seed=this.seed,random=(index:number,lane:number,turn=0)=>hash(seed,stage,index,lane,turn);
    // A slot overtaken by the camera re-enters at the far end as a new cell.
    // t runs from 1 (far) to 0 (near); both ends are fully transparent.
    const cell=(lane:number,index:number,near:number,depth:number)=>{
      const offset=random(index,lane)*depth,turn=Math.floor((eye+near-offset)/depth)+1,z=offset+turn*depth;
      return{z,turn,t:(z-eye-near)/depth};
    };
    const distance=(t:number)=>smooth(t/.16)*smooth((1-t)/.24)*(1-.42*t);
    const cycle=(period:number,phase:number)=>{const age=clock/period+phase,turn=Math.floor(age),t=age-turn;return{turn,t,age:t*period,left:(1-t)*period};};
    // Frame-exact ends: a slot is fully transparent on the frame it wraps.
    const envelope=(life:{age:number;left:number},rise:number,fall:number)=>smooth((life.age-1)/rise)*smooth((life.left-1)/fall);
    const ease=(t:number)=>1-(1-t)*(1-t);

    const solid=this.solid(),batches=new Map<string,Batch>();let particles=0,visible=0,leafMaterial:Material|null=null;
    const batchFor=(material:Material,blend:Blend)=>{
      const key=`${material.texture}:${blend}`;let batch=batches.get(key);
      if(!batch){batch={texture:material.texture,blend,vertices:[],indices:[]};batches.set(key,batch);}
      return batch;
    };
    const room=(x:number,y:number,rx:number,ry:number)=>Math.min(x-rx-FIELD.left,FIELD.right-x-rx,y-ry-FIELD.top,FIELD.bottom-y-ry);
    // Clipping belongs to the public compositor, so ambience fades out before
    // touching the playfield edge. Hidden slots keep their shape as fully
    // transparent vertices clamped into the field: every frame has the same
    // layout, and nothing jumps when a shape fades back in.
    const opacityAt=(opacity:number,space:number)=>{const alpha=space>0?opacity*smooth(space/EDGE_FADE):0;return alpha*255>=.5?alpha:0;};
    const put=(batch:Batch,x:number,y:number,u:number,v:number,color:number)=>{batch.vertices.push([clamp(x,FIELD.left,FIELD.right),clamp(y,FIELD.top,FIELD.bottom),u,v,color]);};
    const park=(batch:Batch,material:Material,count:number,x=336,y=360)=>{
      const uv=material.uv,u=(uv[0]+uv[2])/2,v=(uv[1]+uv[3])/2;for(let i=0;i<count;i++)put(batch,x,y,u,v,0);
    };

    /** Radial soft dot; "soft" adds an inner ring for a gaussian-like halo.
     * Broad mist fades by its core ("reach"); its clear rim may be clamped. */
    const glow=(blend:Blend,p:Point|null,rx:number,ry:number,rgb:number,opacity:number,soft=false,reach=1)=>{
      const batch=batchFor(solid,blend),start=batch.vertices.length,{cos,sin}=soft?OCT:HEX,n=cos.length;
      particles++;
      for(let i=0;i<n;i++){
        const a=start+1+i,b=start+1+(i+1)%n;batch.indices.push(start,a,b);
        if(soft)batch.indices.push(a,a+n,b+n,a,b+n,b);
      }
      if(!p)return park(batch,solid,soft?1+n*2:1+n);
      const alpha=opacityAt(opacity,room(p.x,p.y,rx*reach,ry*reach)),u=solid.uv[0],v=solid.uv[1],clear=tint(rgb,0);
      put(batch,p.x,p.y,u,v,tint(rgb,alpha));
      if(soft){const middle=tint(rgb,alpha*.36);for(let i=0;i<n;i++)put(batch,p.x+cos[i]*rx*.42,p.y+sin[i]*ry*.42,u,v,middle);}
      for(let i=0;i<n;i++)put(batch,p.x+cos[i]*rx,p.y+sin[i]*ry,u,v,clear);
      if(alpha)visible++;
    };
    /** Tapered motion streak, brightest near its head, soft on both sides. */
    const streak=(blend:Blend,tail:Point|null,head:Point|null,width:number,rgb:number,opacity:number)=>{
      const batch=batchFor(solid,blend),start=batch.vertices.length;
      particles++;
      batch.indices.push(start,start+1,start+2,start,start+2,start+3,start+2,start+1,start+4,start+2,start+4,start+3);
      if(!tail||!head)return park(batch,solid,5,head?.x,head?.y);
      const dx=head.x-tail.x,dy=head.y-tail.y,length=Math.hypot(dx,dy)||1,nx=-dy/length*width/2,ny=dx/length*width/2;
      const alpha=opacityAt(opacity,room((tail.x+head.x)/2,(tail.y+head.y)/2,Math.abs(dx)/2+width,Math.abs(dy)/2+width));
      const mx=tail.x+dx*.78,my=tail.y+dy*.78,u=solid.uv[0],v=solid.uv[1],clear=tint(rgb,0);
      put(batch,tail.x,tail.y,u,v,clear);put(batch,mx+nx,my+ny,u,v,clear);put(batch,mx,my,u,v,tint(rgb,alpha));
      put(batch,mx-nx,my-ny,u,v,clear);put(batch,head.x,head.y,u,v,tint(rgb,alpha*.4));
      if(alpha)visible++;
    };
    /** Ripple lying on a horizontal world plane: a soft band between two
     * transparent loops, perspective-projected point by point. A slight
     * wobble and a brighter far side keep it from reading as a drawn ellipse. */
    const ripple=(blend:Blend,x:number,y:number,z:number,radius:number,thickness:number,rgb:number,opacity:number,phase:number)=>{
      const batch=batchFor(solid,blend),start=batch.vertices.length;
      particles++;
      for(let i=0;i<RING;i++){
        const j=(i+1)%RING,o0=start+i,o1=start+j,m0=o0+RING,m1=o1+RING,n0=m0+RING,n1=m1+RING;
        batch.indices.push(o0,m0,o1,o1,m0,m1,m0,n0,m1,m1,n0,n1);
      }
      const {cos,sin}=RING_UNIT;
      for(let i=0;i<RING;i++)RING_WOBBLE[i]=1+.06*Math.sin(RING_TURN3[i]+phase)+.035*Math.sin(RING_TURN5[i]+phase*1.7);
      for(let band=0;band<3;band++){
        const r=band===0?radius+thickness/2:band===1?radius:Math.max(0,radius-thickness/2);
        for(let i=0;i<RING;i++){
          const point=at(x+cos[i]*r*RING_WOBBLE[i],y,z+sin[i]*r*RING_WOBBLE[i]);
          if(!point){const centre=at(x,y,z);return park(batch,solid,RING*3,centre?.x,centre?.y);}
          RING_X[band*RING+i]=point.x;RING_Y[band*RING+i]=point.y;
        }
      }
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(let i=0;i<RING;i++){left=Math.min(left,RING_X[i]);right=Math.max(right,RING_X[i]);top=Math.min(top,RING_Y[i]);bottom=Math.max(bottom,RING_Y[i]);}
      const alpha=opacityAt(opacity,room((left+right)/2,(top+bottom)/2,(right-left)/2,(bottom-top)/2)),u=solid.uv[0],v=solid.uv[1],clear=tint(rgb,0);
      for(let k=0;k<RING*3;k++)put(batch,RING_X[k],RING_Y[k],u,v,k>=RING&&k<RING*2?tint(rgb,alpha*RING_SHADE[k-RING]):clear);
      if(alpha)visible++;
    };
    /** Leaf or petal sprite; "flip" (-1..1) is its turn about the long axis. */
    const leaf=(p:Point|null,size:number,rotation:number,flip:number,rgb:number,opacity:number)=>{
      const material=leafMaterial??=this.common('charge.leaf'),batch=batchFor(material,'alpha'),start=batch.vertices.length;
      particles++;
      batch.indices.push(start,start+1,start+2,start,start+2,start+3);
      if(!p)return park(batch,material,4);
      const width=size*(.2+.8*Math.abs(flip)),c=Math.cos(rotation),s=Math.sin(rotation);
      const alpha=opacityAt(opacity,room(p.x,p.y,(Math.abs(c)*width+Math.abs(s)*size)/2,(Math.abs(s)*width+Math.abs(c)*size)/2));
      const uv=material.uv,near=flip<0?uv[2]:uv[0],far=flip<0?uv[0]:uv[2],color=tint(shade(rgb,.8+.2*flip),alpha);
      const corner=(px:number,py:number,u:number,v:number)=>put(batch,p.x+px*c-py*s,p.y+px*s+py*c,u,v,color);
      corner(-width/2,-size/2,near,uv[1]);corner(width/2,-size/2,far,uv[1]);corner(width/2,size/2,far,uv[3]);corner(-width/2,size/2,near,uv[3]);
      if(alpha)visible++;
    };
    /** Flat sheet (paper scrap) or glinting kite (mirror shard). */
    const card=(blend:Blend,p:Point|null,width:number,height:number,rotation:number,rgb:number,opacity:number,kite=false)=>{
      const batch=batchFor(solid,blend),start=batch.vertices.length,c=Math.cos(rotation),s=Math.sin(rotation);
      particles++;
      batch.indices.push(start,start+1,start+3,start+1,start+2,start+3);
      if(!p)return park(batch,solid,4);
      const alpha=opacityAt(opacity,room(p.x,p.y,(Math.abs(c)*width+Math.abs(s)*height)/2,(Math.abs(s)*width+Math.abs(c)*height)/2));
      const u=solid.uv[0],v=solid.uv[1],corner=(px:number,py:number,light:number)=>put(batch,p.x+px*c-py*s,p.y+px*s+py*c,u,v,tint(rgb,alpha*light));
      if(kite){corner(0,-height/2,1);corner(width/2,height*.12,.5);corner(0,height/2,.14);corner(-width/2,height*.12,.5);}
      else{corner(-width/2,-height/2,1);corner(width/2,-height/2,1);corner(width/2,height/2,1);corner(-width/2,height/2,1);}
      if(alpha)visible++;
    };
    // Painted occluders that span the whole corridor: nothing behind them is drawn.
    const nextPlane=(local:number,present:(variant:number)=>boolean)=>{
      for(let tile=Math.floor((eye-local)/TILE);;tile++){const z=tile*TILE+local;if(z>eye+1&&present(variantOf(tile)))return z;}
    };

    if(stage===1){
      // Bloom around each stone lantern window (x=±10, z=9/37 per tile).
      const lantern=(j:number)=>{const tile=Math.floor(j/2);return tile*TILE+(j%2?37:9)+variantOf(tile)*1.2;};
      let first=Math.max(0,Math.floor((eye+4)/TILE)*2-2);while(lantern(first)<=eye+4)first++;
      for(let slot=0;slot<4;slot++)for(const side of [-1,1]){
        const j=first+((slot-first)%4+4)%4,z=lantern(j),rel=z-eye,p=at(side*10,7,z);
        const flicker=.86+.09*Math.sin(clock*.13+j*1.7+side)+.05*Math.sin(clock*.31+j*2.3);
        const radius=p?clamp(1.9*p.scale,4,64):0;
        glow('add',p,radius,radius,0xffbf73,.2*flicker*smooth((rel-4)/12)*smooth((92-rel)/26),true);
      }
      for(let i=0;i<8;i++){
        const c=cell(2,i,8,70),r=(lane:number)=>random(i,lane,c.turn);
        const x=-11+r(0)*22+Math.sin(clock*(.007+r(1)*.006)+r(2)*TAU)*1.3,y=1.2+r(3)*5+Math.sin(clock*(.011+r(4)*.008)+r(5)*TAU)*.6;
        const p=at(x,y,c.z+Math.sin(clock*.005+r(6)*TAU)),pulse=.5+.5*Math.sin(clock*(.02+r(7)*.02)+r(8)*TAU),radius=p?clamp(.4*p.scale,2.2,9):0;
        glow('add',p,radius,radius,0xffd28a,.46*pulse*distance(c.t));
      }
      const maple=[0xb24a2e,0xc96535,0x9c3a2c,0xd4893f];
      for(let i=0;i<26;i++){
        const c=cell(3,i,6,72),r=(lane:number)=>random(i,lane,c.turn),fall=.011+r(0)*.008,life=cycle(24/fall,r(1)),k=(lane:number)=>random(i,lane,c.turn*977+life.turn);
        const x=-14+k(0)*28+Math.sin(clock*(.008+r(2)*.006)+r(3)*TAU)*1.3+life.age*.0025,y=24*(1-life.t);
        const p=at(x,y,c.z),turn=clock*(.012+r(4)*.022)*(r(5)<.5?-1:1)+r(6)*TAU,flip=Math.cos(clock*(.021+r(7)*.025)+r(8)*TAU);
        leaf(p,p?Math.min(40,(.95+r(9)*.5)*p.scale):0,turn,flip,maple[(i+life.turn)%4],.66*envelope(life,24/fall*.06,24/fall*.07)*distance(c.t));
      }
    }else if(stage===2){
      for(let i=0;i<64;i++){
        const fall=.58+random(i,1)*.1,life=cycle(24/fall,random(i,2)),k=(lane:number)=>random(i,lane,life.turn);
        // Spawned ahead of the player area: even the nearest drop moves under
        // 25 px a frame. The world depth is fixed at spawn, like the road.
        const z=stageTravel(stage,clock-life.age)+26+k(0)*50,rel=z-eye,x=-15+k(1)*30+life.age*.06,y=24*(1-life.t);
        const head=at(x,y,z),tail=at(x-.1,y+fall*1.7,z),width=head?.09*head.scale:0;
        streak('alpha',tail,head,clamp(width,1.5,2.8),0xb4ccd4,.46*Math.min(1,width/1.5)*envelope(life,24/fall*.12,24/fall*.06)*smooth((rel-23)/8)*smooth((80-rel)/16));
      }
      for(let i=0;i<5;i++){
        const period=70+random(i,3)*36,life=cycle(period,random(i,4)),k=(lane:number)=>random(i,lane,life.turn),p=life.age/48;
        const z=stageTravel(stage,clock-life.age)+20+k(5)*28;
        ripple('alpha',-7+k(6)*14,.03,z,.2+1.5*ease(Math.min(p,1)),.2+.12*p,0xc3dade,p<1?.55*smooth((life.age-1)/5)*Math.pow(1-p,1.5):0,k(7)*TAU);
      }
    }else if(stage===3){
      const bridge=nextPlane(32,v=>v===1),shown=(z:number)=>z<bridge-.5?1:0;
      for(let i=0;i<40;i++){
        const c=cell(5,i,10,56),r=(lane:number)=>random(i,lane,c.turn),p=at(-9+r(0)*18+Math.sin(clock*.004+r(1)*TAU)*.5,-.33,c.z);
        const shine=Math.max(0,Math.sin(clock*(.03+r(2)*.035)+r(3)*TAU)),rx=p?clamp((.9+r(4)*.9)*p.scale,3,32):0;
        glow('add',p,rx,Math.max(1.3,rx*.15),0xdcf2e8,.47*shine*shine*distance(c.t)*shown(c.z));
      }
      for(let i=0;i<4;i++){
        const period=120+random(i,6)*50,life=cycle(period,random(i,7)),k=(lane:number)=>random(i,lane,life.turn),p=life.age/84;
        const z=stageTravel(stage,clock-life.age)+18+k(8)*36;
        ripple('add',-8+k(9)*16,-.32,z,.25+2*ease(Math.min(p,1)),.3+.2*p,0xbfe2d8,p<1?.36*smooth((life.age-1)/7)*Math.pow(1-p,1.4)*shown(z):0,k(10)*TAU);
      }
      for(let i=0;i<3;i++){
        const c=cell(8,i,26,84),r=(lane:number)=>random(i,lane,c.turn),p=at(-10+r(0)*20+Math.sin(clock*.0012+r(1)*TAU)*3,1.4,c.z),rx=p?(10+r(2)*6)*p.scale:0;
        glow('alpha',p,rx,rx*.22,0xa7c6c0,.12*distance(c.t)*shown(c.z),true,.35);
      }
    }else if(stage===4){
      const plum=[0xf2b9cd,0xe7a2be,0xf8d5e1,0xdc96b6];
      for(let i=0;i<30;i++){
        const c=cell(9,i,6,64),r=(lane:number)=>random(i,lane,c.turn),fall=.008+r(0)*.006,life=cycle(22/fall,r(1)),k=(lane:number)=>random(i,lane,c.turn*977+life.turn);
        const x=-14+k(0)*28+Math.sin(clock*(.009+r(2)*.007)+r(3)*TAU)*1.5+life.age*.002,y=22*(1-life.t);
        const p=at(x,y,c.z),turn=clock*(.016+r(4)*.03)*(r(5)<.5?-1:1)+r(6)*TAU,flip=Math.cos(clock*(.03+r(7)*.03)+r(8)*TAU);
        leaf(p,p?Math.min(30,(.62+r(9)*.36)*p.scale):0,turn,flip,plum[(i+life.turn)%4],.66*envelope(life,22/fall*.06,22/fall*.07)*distance(c.t));
      }
      for(let i=0;i<16;i++){
        const c=cell(10,i,8,70),r=(lane:number)=>random(i,lane,c.turn);
        const p=at(-12+r(0)*24+Math.sin(clock*(.006+r(1)*.005)+r(2)*TAU)*1.2,2.5+r(3)*11+Math.sin(clock*(.008+r(4)*.006)+r(5)*TAU)*.8,c.z);
        const shine=Math.max(0,Math.sin(clock*(.018+r(6)*.02)+r(7)*TAU)),radius=p?clamp(.3*p.scale,1.8,8):0;
        glow('add',p,radius,radius,0xf3d58f,.46*(.25+.75*shine*shine)*distance(c.t));
      }
    }else if(stage===5){
      const door=nextPlane(38,v=>v!==1),shown=(z:number)=>z<door-.5?1:0;
      for(let i=0;i<44;i++){
        const c=cell(11,i,4,54),r=(lane:number)=>random(i,lane,c.turn),z=c.z+Math.sin(clock*.003+r(0)*TAU)*.6;
        const p=at(-8+r(1)*16+Math.sin(clock*(.004+r(2)*.004)+r(3)*TAU)*.7,1.5+r(4)*13+Math.sin(clock*(.005+r(5)*.004)+r(6)*TAU)*.6,z);
        const radius=p?clamp(.16*p.scale,1.5,6):0;
        glow('add',p,radius,radius,0xeadcae,.46*(.55+.45*Math.sin(clock*(.025+r(7)*.03)+r(8)*TAU))*distance(c.t)*shown(z));
      }
      for(let i=0;i<6;i++){
        const c=cell(12,i,6,50),r=(lane:number)=>random(i,lane,c.turn),fall=.012+r(0)*.007,life=cycle(17/fall,r(1)),k=(lane:number)=>random(i,lane,c.turn*977+life.turn);
        const p=at(-7+k(0)*14+Math.sin(clock*(.01+r(2)*.006)+r(3)*TAU)*1.4,17*(1-life.t),c.z);
        const flip=Math.cos(clock*(.03+r(4)*.02)+r(5)*TAU),width=p?Math.min(30,.8*p.scale):0,height=p?Math.min(40,1.05*p.scale):0;
        card('alpha',p,width*(.18+.82*Math.abs(flip)),height,r(6)*TAU+clock*(.015+r(7)*.02)*(r(8)<.5?-1:1),shade(0xc8b893,.6+.4*Math.abs(flip)),
          .6*envelope(life,17/fall*.06,17/fall*.08)*distance(c.t)*shown(c.z));
      }
    }else if(stage===6){
      for(let i=0;i<36;i++){
        const c=cell(13,i,6,86),r=(lane:number)=>random(i,lane,c.turn),rise=.012+r(0)*.009,life=cycle(22/rise,r(1)),k=(lane:number)=>random(i,lane,c.turn*977+life.turn);
        const p=at(-13+k(0)*26+Math.sin(clock*(.007+r(2)*.006)+r(3)*TAU)*.9,22*life.t-.5,c.z),radius=p?clamp(.34*p.scale,2.4,10):0;
        glow('add',p,radius,radius,i%2?0xc4f0e2:0xffe2a0,.46*(.6+.4*Math.sin(clock*(.02+r(4)*.02)+r(5)*TAU))*envelope(life,22/rise*.1,22/rise*.14)*distance(c.t));
      }
      // Bells hang at x=±12, about y=23.5, z=29-4*variant in each tile.
      const bell=(tile:number)=>tile*TILE+29-variantOf(tile)*4;
      let first=Math.max(0,Math.floor((eye+6)/TILE)-1);while(bell(first)<=eye+6)first++;
      for(let slot=0;slot<2;slot++)for(const side of [-1,1]){
        const tile=first+((slot-first)%2+2)%2,z=bell(tile),rel=z-eye,p=at(side*12,23.5,z),life=cycle(300,(tile*.37+side*.19+2)%1);
        const strike=smooth(life.t/.04)*Math.pow(1-life.t,3),radius=p?clamp(2.6*p.scale,6,70):0;
        glow('add',p,radius,radius,0xf4e2a8,(.06+.16*strike)*smooth((rel-6)/12)*smooth((92-rel)/26),true);
      }
      for(let i=0;i<4;i++){
        const c=cell(14,i,26,90),r=(lane:number)=>random(i,lane,c.turn),side=i%2?1:-1;
        const p=at(side*(14+r(0)*6)+Math.sin(clock*.0016+r(1)*TAU)*2.5,.5,c.z),rx=p?(9+r(2)*5)*p.scale:0;
        glow('alpha',p,rx,rx*.25,0xe4efea,.14*distance(c.t),true,.35);
      }
    }else{
      for(let i=0;i<24;i++){
        const c=cell(15,i,6,70),r=(lane:number)=>random(i,lane,c.turn),rise=.008+r(0)*.006,life=cycle(22/rise,r(1)),k=(lane:number)=>random(i,lane,c.turn*977+life.turn);
        const p=at(-11+k(0)*22+Math.sin(clock*(.006+r(2)*.005)+r(3)*TAU)*.8,22*life.t,c.z),spin=clock*(.02+r(4)*.03)+r(5)*TAU;
        const length=p?Math.min(44,(1.6+r(6)*1)*p.scale):0,face=Math.abs(Math.cos(spin));
        card('add',p,length*.3*(.25+.75*face),length,r(7)*TAU+clock*(.006+r(8)*.008)*(r(9)<.5?-1:1),i%2?0xd9cff6:0xcad8ff,
          .47*(.45+.55*Math.pow(face,4))*envelope(life,22/rise*.08,22/rise*.12)*distance(c.t),true);
      }
      for(let i=0;i<26;i++){
        const rise=.26+random(i,16)*.08,life=cycle(18/rise,random(i,17)),k=(lane:number)=>random(i,lane,life.turn);
        const z=stageTravel(stage,clock-life.age)+24+k(0)*48,rel=z-eye,x=-12+k(1)*24,y=18*life.t;
        const head=at(x,y,z),tail=at(x,y-rise*2.2,z),width=head?.07*head.scale:0;
        streak('alpha',tail,head,clamp(width,1.5,2.6),0xc2ccf4,.42*Math.min(1,width/1.5)*envelope(life,18/rise*.1,18/rise*.2)*smooth((rel-21)/8)*smooth((76-rel)/14));
      }
      for(let i=0;i<4;i++){
        const period=90+random(i,18)*40,life=cycle(period,random(i,19)),k=(lane:number)=>random(i,lane,life.turn),p=life.age/56;
        const z=stageTravel(stage,clock-life.age)+20+k(2)*30;
        ripple('add',-9+k(3)*18,.02,z,.2+1.6*ease(Math.min(p,1)),.22+.14*p,0xc5cff5,p<1?.4*smooth((life.age-1)/6)*Math.pow(1-p,1.5):0,k(4)*TAU);
      }
    }
    let vertices=0;
    for(const batch of batches.values()){
      draw.sampler(batch.texture,'bilinear','clamp','clamp')
        .blendFactors('srcAlpha',batch.blend==='add'?'one':'oneMinusSrcAlpha','add','zero','one','add')
        .mesh(batch.texture,batch.vertices,batch.indices).blendEnd();vertices+=batch.vertices.length;
    }
    return{stage,clock,particles,visible,features:[...STAGE_ATMOSPHERE_FEATURES[stage-1]],meshCalls:batches.size,vertices};
  }
  destroy(){
    if(this.destroyed)return;this.destroyed=true;this.atlas?.dispose();this.atlas=null;this.materials.clear();
    // The adapter intentionally does not unload: GameArt owns every texture.
  }
}
