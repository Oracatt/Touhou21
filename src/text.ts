import type {NativeHost,SystemTextTexture} from '@ts-stg/thlib';
import type {AnmDrawList as DrawList} from '@ts-stg/thlib/touhou';

// Cached vector text is an application skin, not a gameplay owner.
export interface TextOptions{size?:number;width?:number;height?:number;color?:number;outline?:number;stroke?:number;align?:'left'|'center'|'right';font?:string;scale?:number;alpha?:number;}
export class TextPainter {
 declare host:NativeHost;declare cache:Map<string,SystemTextTexture>;declare font:string;declare titleFont:string;declare limit:number;
  constructor(host:NativeHost,{limit=320}={}) {
    this.host=host;this.limit=limit;this.cache=new Map();
    this.font=['Microsoft YaHei','Yu Gothic','Arial'].find(name=>host.hasSystemFont(name))??'Arial';
    this.titleFont=host.hasSystemFont('KaiTi')?'KaiTi':this.font;
  }
  texture(text:string,{size=24,width=850,height=90,color=0xf4ead1ff,outline=0x071022ff,stroke=2,align='left',font=this.font}:TextOptions={}) {
    const key=JSON.stringify([String(text),size,width,height,color,outline,stroke,align,font]);
    if(this.cache.has(key)){const value=this.cache.get(key)!;this.cache.delete(key);this.cache.set(key,value);return value;}
    const layout=this.host.createTextLayout(String(text),{fontFamily:font,fontSize:size,width,height,horizontalAlign:align,verticalAlign:'top',locale:'zh-CN'});
    let value;try{value=this.host.rasterizeTextLayout(layout,{width,height,fill:color,outline,strokeWidth:stroke});}finally{this.host.destroyTextLayout(layout);}
    this.cache.set(key,value);
    while(this.cache.size>this.limit){const oldest=this.cache.keys().next().value!,previous=this.cache.get(oldest)!;this.cache.delete(oldest);if(previous.texture)this.host.unloadTexture(previous.texture);}
    return value;
  }
  /** `scale` enlarges the cached raster about the text box origin (x, y). */
  draw(draw:DrawList,text:string,x:number,y:number,options:TextOptions={}) {
    const value=this.texture(text,options),s=options.scale??1;
    if(value.texture)draw.sprite(value.texture,x+(value.x+value.width/2)*s,y+(value.y+value.height/2)*s,value.width*s,value.height*s,0,options.alpha===undefined?0xffffffff:((0xffffff00|Math.round(Math.max(0,Math.min(1,options.alpha))*255))>>>0));
    return draw;
  }
  destroy(){for(const value of this.cache.values())if(value.texture)this.host.unloadTexture(value.texture);this.cache.clear();}
}
