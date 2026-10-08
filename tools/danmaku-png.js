/** Dependency-free RGBA canvas and PNG encoder for danmaku contact sheets. */
import zlib from 'node:zlib';

const CRC=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=bytes=>{let c=0xffffffff;for(const byte of bytes)c=CRC[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0;};

export class Canvas {
  constructor(width,height,background=[8,10,20]){
    this.width=width;this.height=height;this.pixels=new Uint8Array(width*height*4);
    for(let i=0;i<width*height;i++)this.pixels.set([...background,255],i*4);
  }
  blend(x,y,[r,g,b],alpha=1){
    x|=0;y|=0;if(x<0||y<0||x>=this.width||y>=this.height||alpha<=0)return;
    const i=(y*this.width+x)*4,a=Math.min(1,alpha),p=this.pixels;
    p[i]=p[i]+(r-p[i])*a;p[i+1]=p[i+1]+(g-p[i+1])*a;p[i+2]=p[i+2]+(b-p[i+2])*a;
  }
  rect(x,y,width,height,color,alpha=1){for(let j=Math.max(0,y|0);j<Math.min(this.height,y+height);j++)for(let i=Math.max(0,x|0);i<Math.min(this.width,x+width);i++)this.blend(i,j,color,alpha);}
  circle(cx,cy,radius,color,alpha=1){
    const r=Math.max(.6,radius);
    for(let y=Math.floor(cy-r-1);y<=Math.ceil(cy+r+1);y++)for(let x=Math.floor(cx-r-1);x<=Math.ceil(cx+r+1);x++){
      const d=Math.hypot(x+.5-cx,y+.5-cy);if(d<=r+.5)this.blend(x,y,color,alpha*Math.min(1,r+.5-d));
    }
  }
  ellipse(cx,cy,rx,ry,angle,color,alpha=1){
    const c=Math.cos(angle),s=Math.sin(angle),m=Math.max(rx,ry)+1;
    for(let y=Math.floor(cy-m);y<=Math.ceil(cy+m);y++)for(let x=Math.floor(cx-m);x<=Math.ceil(cx+m);x++){
      const dx=x+.5-cx,dy=y+.5-cy,u=(dx*c+dy*s)/rx,v=(-dx*s+dy*c)/ry,d=u*u+v*v;
      if(d<=1)this.blend(x,y,color,alpha*Math.min(1,(1-d)*Math.max(rx,ry)));
    }
  }
  line(x1,y1,x2,y2,width,color,alpha=1){
    const length=Math.hypot(x2-x1,y2-y1),steps=Math.max(1,Math.ceil(length));
    for(let i=0;i<=steps;i++){const t=i/steps;this.circle(x1+(x2-x1)*t,y1+(y2-y1)*t,width/2,color,alpha*.6);}
  }
  png(){
    const raw=Buffer.alloc((this.width*4+1)*this.height);
    for(let y=0;y<this.height;y++){raw[y*(this.width*4+1)]=0;Buffer.from(this.pixels.buffer,y*this.width*4,this.width*4).copy(raw,y*(this.width*4+1)+1);}
    const chunk=(type,data)=>{const body=Buffer.concat([Buffer.from(type,'ascii'),data]),out=Buffer.alloc(body.length+8);
      out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(crc32(body),body.length+4);return out;};
    const header=Buffer.alloc(13);header.writeUInt32BE(this.width,0);header.writeUInt32BE(this.height,4);header.set([8,6,0,0,0],8);
    return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]);
  }
}

const PALETTE16=[[150,150,160],[235,40,40],[255,140,140],[220,40,220],[255,150,255],[50,80,255],[140,150,255],[30,150,255],
  [130,215,255],[40,220,60],[150,255,150],[200,255,210],[245,235,40],[255,255,160],[255,190,90],[255,255,255]];
const PALETTE8=[[150,150,160],[255,110,110],[255,120,255],[110,120,255],[120,215,255],[110,255,120],[255,240,110],[255,255,255]];
const PALETTE4=[[255,110,110],[110,120,255],[110,255,120],[255,240,110]];
export function bulletColor(type,color){
  if(type===32)return PALETTE4[color&3];
  if((type>=17&&type<=33)||type>=43)return PALETTE8[color&7];
  return PALETTE16[color&15];
}
/** Approximate visual footprint of each standard sprite family. */
export function bulletShape(type){
  if([8,9,10,13,15,35,36].includes(type))return{rx:2.6,ry:5.2,oriented:true};
  if(type===11)return{rx:3.6,ry:5.4,oriented:true};
  if(type===12)return{rx:2.4,ry:6.5,oriented:true};
  if([20,21].includes(type))return{rx:4.5,ry:8.5,oriented:true};
  if([22,23,24,29,30,48,49].includes(type))return{rx:8,ry:8,oriented:false};
  if([18,19].includes(type))return{rx:9,ry:9,oriented:false};
  if(type===32||type===33)return{rx:16,ry:16,oriented:false};
  if(type===46||type===47)return{rx:30,ry:30,oriented:false};
  if([4,5,6,7,16,17,31,37,38].includes(type))return{rx:5.2,ry:5.2,oriented:false};
  return{rx:3.2,ry:3.2,oriented:false};
}
