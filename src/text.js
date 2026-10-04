// Cached vector text is an application skin, not a gameplay owner.
export class TextPainter {
  constructor(host,{limit=320}={}) {
    this.host=host;this.limit=limit;this.cache=new Map();
    this.font=['Microsoft YaHei','Yu Gothic','Arial'].find(name=>host.hasSystemFont(name))??'Arial';
    this.titleFont=host.hasSystemFont('KaiTi')?'KaiTi':this.font;
  }
  texture(text,{size=24,width=850,height=90,color=0xf4ead1ff,outline=0x071022ff,stroke=2,align='left',font=this.font}={}) {
    const key=JSON.stringify([String(text),size,width,height,color,outline,stroke,align,font]);
    if(this.cache.has(key)){const value=this.cache.get(key);this.cache.delete(key);this.cache.set(key,value);return value;}
    const layout=this.host.createTextLayout(String(text),{fontFamily:font,fontSize:size,width,height,horizontalAlign:align,verticalAlign:'top',locale:'zh-CN'});
    let value;try{value=this.host.rasterizeTextLayout(layout,{width,height,fill:color,outline,strokeWidth:stroke});}finally{this.host.destroyTextLayout(layout);}
    this.cache.set(key,value);
    while(this.cache.size>this.limit){const oldest=this.cache.keys().next().value,previous=this.cache.get(oldest);this.cache.delete(oldest);if(previous.texture)this.host.unloadTexture(previous.texture);}
    return value;
  }
  draw(draw,text,x,y,options={}) {
    const value=this.texture(text,options);if(value.texture)draw.sprite(value.texture,x+value.x+value.width/2,y+value.y+value.height/2,value.width,value.height,0,options.alpha===undefined?0xffffffff:((0xffffff00|Math.round(Math.max(0,Math.min(1,options.alpha))*255))>>>0));
    return draw;
  }
  destroy(){for(const value of this.cache.values())if(value.texture)this.host.unloadTexture(value.texture);this.cache.clear();}
}
