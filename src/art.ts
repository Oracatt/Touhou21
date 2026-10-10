import type {NativeHost} from '@ts-stg/thlib';
import type {AnmDrawList as DrawList} from '@ts-stg/thlib/touhou';

import {withAlpha} from '@ts-stg/thlib';

export interface ArtTexture{id:number;width:number;height:number;bounds:{x:number;y:number;width:number;height:number};}
export class GameArt {
 declare host:NativeHost;declare cache:Map<string,ArtTexture>;declare manifest:Record<string,Omit<ArtTexture,'id'>>;
  constructor(host:NativeHost){this.host=host;this.cache=new Map();try{this.manifest=JSON.parse(host.readText('assets/art-manifest.json')).assets;}catch{this.manifest={};}}
  load(path:string){
    if(this.cache.has(path))return this.cache.get(path)!;
    const id=this.host.loadTexture(path),known=this.manifest[path];
    if(known){const value={id,width:known.width,height:known.height,bounds:known.bounds};this.cache.set(path,value);return value;}
    const surface=this.host.readTexturePixels(id);
    // Find the painted subject's bounds without altering the generated alpha.
    let left=surface.width,top=surface.height,right=-1,bottom=-1;
    for(let y=0;y<surface.height;y++)for(let x=0;x<surface.width;x++)if(surface.pixels[(y*surface.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    const value={id,width:surface.width,height:surface.height,bounds:{x:left,y:top,width:Math.max(1,right-left+1),height:Math.max(1,bottom-top+1)}};
    this.cache.set(path,value);return value;
  }
  portrait(draw:DrawList,id:string,x:number,y:number,height:number,{alpha=1,tint=0xffffffff,rotation=0}={}){
    const value=this.load(`assets/portraits/${id}.png`),b=value.bounds,width=height*b.width/b.height;
    draw.sampler(value.id,'bilinear','clamp','clamp').spriteRegion(value.id,b.x,b.y,b.width,b.height,x+width/2,y+height/2,width,height,rotation,withAlpha(tint,alpha));return width;
  }
  background(draw:DrawList,id:string,x=336,y=360,width=576,height=672,{alpha=1,offset=0}={}){
    const value=this.load(`assets/art/${id}.png`),scale=Math.max(width/value.width,height/value.height);
    draw.sampler(value.id,'bilinear','clamp','clamp').sprite(value.id,x,y+offset,value.width*scale,value.height*scale,0,withAlpha(0xffffffff,alpha));
  }
  destroy(){for(const value of this.cache.values())this.host.unloadTexture(value.id);this.cache.clear();}
}
