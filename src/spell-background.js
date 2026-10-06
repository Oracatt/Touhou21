/** Consumer-owned, clocked spell scenery. Like the TS-STG Rush demo's artwork
 * owner, retired cards keep moving while fading. This is deliberately outside
 * TouhouSpell.background: its public finish destroys that ANM immediately.
 * All graphics borrow existing generated RGBA atlases, never create pixels. */
import {SCENERY_ATLASES,sceneryRegion,spellBackgroundStyle} from './background-art.js';
const TAU=Math.PI*2,FADE_IN=48,FADE_OUT=24,MAX_CARDS=2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mod=(value,period)=>((value%period)+period)%period;
const alpha=(color,value)=>((color&0xffffff00)|Math.round(clamp(value,0,1)*(color&255)))>>>0;
const indices=(base=0)=>[base,base+1,base+2,base,base+2,base+3];
function phaseFor(seed,key){let word=(seed??0)>>>0;for(let i=0;i<key.length;i++){word=Math.imul(word^key.charCodeAt(i),16777619)>>>0;}return(word/4294967296)*TAU;}
function quad(vertices,faces,rect,x,y,width,height,rotation,color,{wave=0,time=0}={}){
  const [u0,v0,u1,v1]=rect,c=Math.cos(rotation),s=Math.sin(rotation),base=vertices.length;
  const corners=[[-.5,-.5,u0,v0],[.5,-.5,u1,v0],[.5,.5,u1,v1],[-.5,.5,u0,v1]];
  for(const [px,py,u,v]of corners){const lx=px*width,ly=py*height;
    vertices.push([x+lx*c-ly*s+Math.sin(time+py*2.1)*wave,y+lx*s+ly*c+Math.cos(time+px*2.7)*wave,u,v,color]);}
  faces.push(...indices(base));
}

export const SPELL_BACKGROUND_TIMING=Object.freeze({fadeIn:FADE_IN,fadeOut:FADE_OUT,maxCards:MAX_CARDS});
export function spellBackgroundOpacity(card,clock){const entry=clamp((clock-card.born)/FADE_IN,0,1);return card.retired===null?entry:card.retireAlpha*clamp(1-(clock-card.retired)/FADE_OUT,0,1);}

/** update advances only with a simulation frame. draw is idempotent and uses
 * no wall time, RNG, mutable host animation or additional resource owner. */
export class DynamicSpellBackground{
  constructor({art,seed=0}={}){if(!art?.load)throw new TypeError('Spell background requires GameArt');this.art=art;this.seed=seed>>>0;this.cards=[];this.activeKey=null;this.clock=null;this.stage=1;this.destroyed=false;}
  reset(stage=1){if(this.destroyed)throw new Error('Spell background is destroyed');this.stage=stage;this.cards.length=0;this.activeKey=null;this.clock=null;return this;}
  update(game,{clock=game?.frame??0,bossId=game?.context?.boss?.bossId}={}){
    if(this.destroyed)throw new Error('Spell background is destroyed');if(!Number.isInteger(clock)||clock<0)throw new RangeError('Spell visual clock must be a nonnegative integer');
    if(game?.paused)return this;if(this.clock!==null&&clock<this.clock)this.reset(this.stage);
    const active=!!game?.spell?.active,style=spellBackgroundStyle(bossId,this.stage),key=active?`${style.bossId}:${game.spell.id??0}:${game.spell.captureIndex??0}`:null;
    if(key!==this.activeKey){
      const old=this.cards.find(card=>card.key===this.activeKey&&card.retired===null);
      if(old){old.retireAlpha=spellBackgroundOpacity(old,clock);old.retired=clock;}
      if(key){
        const age=game.spell.age?.current;
        // A direct practice/fixture may first observe an already-running card.
        // Genuine combat first enters after ordinary stage updates, age 0..1.
        const initialAge=this.clock===null?(Number.isFinite(age)?Math.max(0,age):FADE_IN):0;
        this.cards.push({key,bossId:style.bossId,style:style.stage,born:clock-initialAge,retired:null,retireAlpha:1,phase:phaseFor(this.seed,key)});
        if(this.cards.length>MAX_CARDS)this.cards.splice(0,this.cards.length-MAX_CARDS);
      }
      this.activeKey=key;
    }
    this.clock=clock;this.cards=this.cards.filter(card=>card.retired===null||spellBackgroundOpacity(card,clock)>0);return this;
  }
  visibleCards(){return this.clock===null?[]:this.cards.map(card=>({...card,opacity:spellBackgroundOpacity(card,this.clock),age:Math.max(0,this.clock-card.born)})).filter(card=>card.opacity>0);}
  /** Scroll each tile through screen space rather than wrapping the whole
   * atlas: UVs remain inside their authored cell, so neighbour art never leaks.
   * Large tiles rotate as a layer; water also bends tile corners gently. */
  _flow(card,profile,{x,y,width,height},counter=false){
    const vertices=[],faces=[],time=card.age,size=profile.tile*(counter?.81:1),direction=counter?-1:1;
    const angle=card.phase*.06+time*profile.rotation*direction,c=Math.cos(angle),s=Math.sin(angle),half=Math.hypot(width,height)/2;
    const offsetX=mod(time*profile.flow[0]*direction,size),offsetY=mod(time*profile.flow[1]*direction,size),range=Math.ceil(half/size)+1;
    const rect=sceneryRegion(card.style,'ground'),color=alpha(profile.tint,card.opacity*profile.veil*(counter?.47:1));
    for(let row=-range;row<=range;row++)for(let column=-range;column<=range;column++){
      const a=column*size+offsetX-size/2,b=row*size+offsetY-size/2;
      quad(vertices,faces,rect,x+width/2+a*c-b*s,y+height/2+a*s+b*c,size+.6,size+.6,angle,color,{wave:profile.motif==='water-current'?4:0,time:time*.023});
    }
    return{vertices,faces};
  }
  _motifs(card,profile,{x,y,width,height}){
    const vertices=[],faces=[],time=card.age,phase=card.phase,cx=x+width/2,cy=y+height*.40;
    const detail=sceneryRegion(card.style,'detail'),edge=sceneryRegion(card.style,'edge');
    const put=(rect,px,py,w,h,rotation,opacity)=>quad(vertices,faces,rect,px,py,w,h,rotation,alpha(profile.tint,opacity*card.opacity));
    for(let i=0;i<profile.count;i++){
      const a=phase+i*TAU/profile.count,depth=(i%3)/2;
      if(profile.motif==='lantern-orbit'){
        const turn=a+time*.0041,r=142+Math.sin(a*3)*38,scale=.73+depth*.28;
        put(detail,cx+Math.cos(turn)*r,cy+Math.sin(turn)*r*.94,42*scale,110*scale,Math.sin(time*.012+a)*.08,.36+depth*.12);
      }else if(profile.motif==='letter-rain'){
        const py=y-90+mod(i*93+time*(1.16+depth*.37),height+180),px=x+30+mod(i*139+Math.sin(time*.014+a)*39,width-60);
        put(detail,px,py,61+depth*22,55+depth*20,time*(i%2?.003:-.004)+a*.3,.25+depth*.12);
      }else if(profile.motif==='water-current'){
        const turn=a-time*.0036,r=137+i%3*39;
        put(detail,cx+Math.cos(turn)*r+Math.sin(time*.017+a)*16,cy+Math.sin(turn)*r*.8,30+depth*14,32+depth*15,Math.sin(time*.01+a)*.06,.38+depth*.1);
      }else if(profile.motif==='silk-weave'){
        const px=x-150+mod(i*107+time*(i%2?-.78:.94),width+300),py=y+height*.25+(i%4)*117+Math.sin(time*.014+a)*31;
        put(detail,px,py,201+depth*40,155+depth*32,(i%2?-.5:.5)+Math.sin(time*.007+a)*.12,.15+depth*.055);
      }else if(profile.motif==='seal-procession'){
        const py=y-95+mod(i*99-time*(.72+depth*.45),height+190),px=x+45+mod(i*127+Math.sin(time*.011+a)*29,width-90);
        put(detail,px,py,15+depth*8,85+depth*44,Math.sin(time*.009+a)*.24,.33+depth*.1);
      }else if(profile.motif==='cloud-chime'){
        const px=x-210+mod(i*131-time*(.59+depth*.36),width+420),py=y+75+(i%4)*173+Math.sin(time*.009+a)*22;
        put(edge,px,py,283+depth*95,145+depth*49,Math.sin(time*.004+a)*.05,.15+depth*.065);
        if(i%2===0){const turn=a+time*.0029;put(detail,cx+Math.cos(turn)*205,cy+Math.sin(turn)*177,34,81,Math.sin(time*.02+a)*.13,.31);}
      }else{
        const turn=a-time*.0046,r=152+(i%3)*24;
        if(i%2===0)put(edge,cx+Math.cos(turn)*r,cy+Math.sin(turn)*r,47,143,turn*.31,.20+depth*.06);
        else put(detail,cx+Math.cos(turn)*r,cy+Math.sin(turn)*r,33,82,-turn*.27,.29+depth*.06);
      }
    }
    return{vertices,faces};
  }
  drawCard(draw,card,{viewport={x:48,y:24,width:576,height:672}}={}){
    if(this.destroyed)throw new Error('Spell background is destroyed');if(card.opacity<=0)return{meshCalls:0,vertices:0};
    const profile=spellBackgroundStyle(card.bossId,card.style),texture=this.art.load(SCENERY_ATLASES[card.style-1].path).id;
    const flow=this._flow(card,profile,viewport),motifs=this._motifs(card,profile,viewport);
    draw.sampler(texture,'bilinear','clamp','clamp')
      .blendFactors('srcAlpha','oneMinusSrcAlpha','add','one','zero','add').mesh(texture,flow.vertices,flow.faces).mesh(texture,motifs.vertices,motifs.faces).blendEnd();
    let count=2,vertices=flow.vertices.length+motifs.vertices.length;
    if(profile.motif==='mirror-echo'){
      const echo=this._flow(card,profile,viewport,true);draw.blendFactors('srcAlpha','one','add','one','zero','add').mesh(texture,echo.vertices,echo.faces).blendEnd();count++;vertices+=echo.vertices.length;
    }
    return{meshCalls:count,vertices};
  }
  snapshot(){return{clock:this.clock,stage:this.stage,activeKey:this.activeKey,cards:this.visibleCards().map(card=>({key:card.key,bossId:card.bossId,style:card.style,age:card.age,opacity:card.opacity,retired:card.retired,phase:card.phase}))};}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.cards.length=0;this.activeKey=null;this.clock=null;/* All textures are borrowed from GameArt. */}
}
