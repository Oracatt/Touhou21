import {withAlpha} from '@ts-stg/thlib';
import {anmEasing} from '@ts-stg/thlib/touhou';
import type {AnmDrawList} from '@ts-stg/thlib/touhou';
import type {ArtTexture,GameArt} from './art.js';

/** Original st01enm scripts17–20: a 60-frame converging reveal, a clear
 * card through frame319, then a 60-frame dispersal. The authored PNG belongs
 * to this game; GPU source regions supply two complementary fragment groups
 * without rewriting its alpha or making generated derivative textures. */
export class BossNameCard {
  readonly bossId:string;
  readonly asset:ArtTexture;
  age=0;
  exitAge:number|null=null;
  alive=true;
  constructor(art:GameArt,bossId:string){
    this.bossId=bossId;this.asset=art.load(`assets/boss-names/${bossId}.png`);
  }
  finish(){if(this.alive&&this.exitAge===null)this.exitAge=0;}
  update(){
    if(!this.alive)return;
    this.age++;
    if(this.exitAge!==null)this.exitAge++;
    if(this.age>=380||this.exitAge!==null&&this.exitAge>=20)this.alive=false;
  }
  destroy(){this.alive=false;}
  draw(draw:AnmDrawList,screenScale=1.5){
    if(!this.alive)return;
    const b=this.asset.bounds,fit=Math.min(128/b.width,64/b.height)*screenScale;
    const cx=320*screenScale,cy=370*screenScale,fade=this.exitAge===null?1:1-this.exitAge/20;
    const entry=this.age<60,exit=this.age>=320;
    const progress=entry?this.age/60:exit?(this.age-320)/60:0;
    const alpha=(entry?progress:exit?1-progress:1)*fade;
    if(alpha<=0)return;
    draw.sampler(this.asset.id,'bilinear','clamp','clamp');
    const color=withAlpha(0xffffffff,alpha);
    if(!entry&&!exit){
      draw.spriteRegion(this.asset.id,b.x,b.y,b.width,b.height,cx,cy,b.width*fit,b.height*fit,0,color);return;
    }
    // The source stores two disjoint scattered glyph masks. New artwork is
    // partitioned at draw time instead, while retaining its two source clocks.
    const columns=12,rows=6;
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const group=(row+column)%2;
      const scale=entry?1+(group?.4:.5)*(1-anmEasing(group?1:4,this.age,60)):1;
      const offset=entry?-(group?48:32)*(1-progress):(group?24:32)*progress;
      const left=b.width*column/columns,right=b.width*(column+1)/columns;
      const top=b.height*row/rows,bottom=b.height*(row+1)/rows;
      draw.spriteRegion(this.asset.id,b.x+left,b.y+top,right-left,bottom-top,
        cx+offset*.5*screenScale+((left+right)/2-b.width/2)*fit*scale,
        cy+((top+bottom)/2-b.height/2)*fit*scale,
        (right-left)*fit*scale,(bottom-top)*fit*scale,0,color);
    }
  }
  snapshot(){return{bossId:this.bossId,age:this.age,exitAge:this.exitAge,alive:this.alive};}
}
