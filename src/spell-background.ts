import type {AnmDrawList as DrawList} from '@ts-stg/thlib/touhou';
import type {GameArt,ArtTexture} from './art.js';

import type {BackgroundGame,SpellVisualCard,VisibleSpellCard,MeshVertex} from './ui-types.js';
/** Consumer-owned abstract spell patterns. These borrow GameArt textures and
 * never reuse road scenery, touch battle RNG or own a rendering target. */
import {spellBackgroundStyle} from './background-art.js';
const TAU=Math.PI*2,FADE_IN=60,FADE_OUT=24,MAX_CARDS=2;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const alpha=(color:number,value:number)=>((color&0xffffff00)|Math.round(clamp(value,0,1)*(color&255)))>>>0;
function phaseFor(seed:number,key:string){let word=(seed??0)>>>0;for(let i=0;i<key.length;i++){word=Math.imul(word^key.charCodeAt(i),16777619)>>>0;}return(word/4294967296)*TAU;}

export const SPELL_BACKGROUND_TIMING=Object.freeze({fadeIn:FADE_IN,fadeOut:FADE_OUT,maxCards:MAX_CARDS});
export function spellBackgroundOpacity(card:SpellVisualCard,clock:number){const entry=clamp((clock-card.born)/FADE_IN,0,1);return card.retired===null?entry:card.retireAlpha*clamp(1-(clock-card.retired)/FADE_OUT,0,1);}

/** The overlay shimmers: its opacity breathes between (1-pulse)*opacity and
 * opacity, so the pattern layer and its additive echo can trade brightness
 * (they are half a period apart). Pure function of the card's age and seed. */
export function spellLayerOpacity(layer:import('./background-art.js').SpellLayer,card:{age:number;phase:number}){
  const depth=layer.pulse??0;if(!depth)return layer.opacity;
  const wave=.5+.5*Math.sin(card.age*(layer.pulseRate??0)+card.phase*1.9+(layer.pulsePhase??0));
  return layer.opacity*(1-depth+depth*wave);
}

/** A whole-image plane with shared low-density vertices for subtle flow.
 * Overscan covers the viewport diagonal, every drift and the deformation even
 * after rotation. No wrap, repeated tile, atlas crop or out-of-range UV exists. */
function textureLayer(card:VisibleSpellCard,layer:import('./background-art.js').SpellLayer,texture:ArtTexture,{x,y,width,height}:{x:number;y:number;width:number;height:number},index:number){
  const time=card.age,phase=card.phase+index*1.37;
  const dx=Math.sin(time*layer.rate[0]+phase)*layer.drift[0],dy=Math.cos(time*layer.rate[1]+phase*.79)*layer.drift[1];
  const rotation=layer.angle+phase*.027+time*layer.rotation+Math.sin(time*.0027+phase)*(layer.sway??0);
  const flow=layer.flow??1,ripple=layer.ripple??0;
  const pad=Math.hypot(...layer.drift)+(layer.wave+ripple)*2+24;
  const size=Math.hypot(width,height)+pad*2;
  const zoom=1.015+layer.zoom*(1+Math.sin(time*layer.breath+phase))/2;
  const scale=size*zoom/Math.min(texture.width,texture.height),w=texture.width*scale,h=texture.height*scale;
  const c=Math.cos(rotation),s=Math.sin(rotation),cx=x+width/2+dx,cy=y+height/2+dy;
  const vertices:MeshVertex[]=[],indices:number[]=[],grid=layer.grid;
  const color=alpha(layer.tint,card.opacity*spellLayerOpacity(layer,card));
  for(let row=0;row<=grid;row++)for(let column=0;column<=grid;column++){
    const u=column/grid,v=row/grid,lx=(u-.5)*w,ly=(v-.5)*h;
    // Waves deform the image plane rather than sample neighbouring images.
    // All cells share their edge vertices, so movement cannot open seams.
    const waveX=Math.sin(v*TAU*2+time*.024*flow+phase)*layer.wave;
    const waveY=Math.sin(u*TAU*2-time*.019*flow+phase*.71)*layer.wave*.65;
    // A ring swell runs outward from the centre of the plane, like a ripple
    // travelling through ink, so the pattern never just slides or spins.
    const rx=lx*c-ly*s,ry=lx*s+ly*c,radius=Math.hypot(rx,ry)||1;
    const swell=ripple?Math.sin(radius/(Math.max(w,h)/2)*TAU*1.25-time*.045*flow+phase)*ripple:0;
    vertices.push([cx+rx+waveX+rx/radius*swell,cy+ry+waveY+ry/radius*swell,layer.mirror?1-u:u,v,color]);
  }
  for(let row=0;row<grid;row++)for(let column=0;column<grid;column++){
    const a=row*(grid+1)+column,b=a+1,d=a+grid+1,e=d+1;indices.push(a,b,e,a,e,d);
  }
  return{vertices,indices};
}

/** update advances only on the simulation clock. draw is idempotent, including
 * entering, retiring and overlapping cards during pause or repeated captures. */
export class DynamicSpellBackground{
  declare seed: number;
  declare stage: number;
  declare destroyed: boolean;

 declare art:GameArt;declare cards:SpellVisualCard[];declare activeKey:string|null;declare clock:number|null;
  constructor({art,seed=0}:{art:GameArt;seed?:number}={} as {art:GameArt}){if(!art?.load)throw new TypeError('Spell background requires GameArt');this.art=art;this.seed=seed>>>0;this.cards=[];this.activeKey=null;this.clock=null;this.stage=1;this.destroyed=false;}
  reset(stage=1){if(this.destroyed)throw new Error('Spell background is destroyed');this.stage=stage;this.cards.length=0;this.activeKey=null;this.clock=null;return this;}
  update(game:BackgroundGame,{clock=game?.frame??0,bossId=game?.context?.boss?.bossId}={}){
    if(this.destroyed)throw new Error('Spell background is destroyed');if(!Number.isInteger(clock)||clock<0)throw new RangeError('Spell visual clock must be a nonnegative integer');
    if(game?.paused)return this;if(this.clock!==null&&clock<this.clock)this.reset(this.stage);
    const active=!!game?.spell?.active,style=spellBackgroundStyle(bossId,this.stage),key=active?`${style.bossId}:${game.spell!.id??0}:${game.spell!.captureIndex??0}`:null;
    if(key!==this.activeKey){
      const old=this.cards.find(card=>card.key===this.activeKey&&card.retired===null);
      if(old){old.retireAlpha=spellBackgroundOpacity(old,clock);old.retired=clock;}
      if(key){
        const age=game.spell!.age?.current;
        const initialAge=this.clock===null?(Number.isFinite(age)?Math.max(0,age!):FADE_IN):0;
        this.cards.push({key,bossId:style.bossId,style:style.stage,born:clock-initialAge,retired:null,retireAlpha:1,phase:phaseFor(this.seed,key)});
        if(this.cards.length>MAX_CARDS)this.cards.splice(0,this.cards.length-MAX_CARDS);
      }
      this.activeKey=key;
    }
    this.clock=clock;this.cards=this.cards.filter(card=>card.retired===null||spellBackgroundOpacity(card,clock)>0);return this;
  }
  visibleCards(){return this.clock===null?[]:this.cards.map(card=>({...card,opacity:spellBackgroundOpacity(card,this.clock!),age:Math.max(0,this.clock!-card.born)})).filter(card=>card.opacity>0);}
  coversRoad(card:VisibleSpellCard){
    const base=spellBackgroundStyle(card.bossId,card.style).layers.find(layer=>layer.texture==='base');
    return !!base&&base.blend==='alpha'&&card.opacity*base.opacity===1;
  }
  drawCard(draw:DrawList,card:VisibleSpellCard,{viewport={x:48,y:24,width:576,height:672}}={}){
    if(this.destroyed)throw new Error('Spell background is destroyed');if(card.opacity<=0)return{meshCalls:0,vertices:0};
    const profile=spellBackgroundStyle(card.bossId,card.style),textures=new Map<string,ArtTexture>();let vertices=0;
    profile.layers.forEach((layer,index)=>{
      const file=profile.textures[layer.texture];if(!file)throw new RangeError('Unknown spell texture '+layer.texture);
      let texture=textures.get(file);if(!texture){texture=this.art.load(file);textures.set(file,texture);}
      if(!(texture.width>0&&texture.height>0&&Number.isFinite(texture.width)&&Number.isFinite(texture.height)))throw new RangeError('Spell artwork requires its actual positive dimensions');
      const mesh=textureLayer(card,layer,texture,viewport,index);vertices+=mesh.vertices.length;
      const destination=layer.blend==='alpha'?'oneMinusSrcAlpha':'one',operation=layer.blend==='subtract'?'reverseSubtract':'add';
      if(!['alpha','add','subtract'].includes(layer.blend))throw new RangeError('Unknown spell blend '+layer.blend);
      draw.sampler(texture.id,'bilinear','clamp','clamp').blendFactors('srcAlpha',destination,operation,'zero','one','add')
        .mesh(texture.id,mesh.vertices,mesh.indices).blendEnd();
    });
    return{meshCalls:profile.layers.length,vertices};
  }
  snapshot(){return{clock:this.clock,stage:this.stage,activeKey:this.activeKey,cards:this.visibleCards().map(card=>({key:card.key,bossId:card.bossId,style:card.style,age:card.age,opacity:card.opacity,retired:card.retired,phase:card.phase}))};}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.cards.length=0;this.activeKey=null;this.clock=null;/* GameArt owns all borrowed textures. */}
}
