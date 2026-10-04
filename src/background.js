/** Original, real-time 3D stage scenery. All coordinates remain in world space;
 * the host's mesh3d command retains clip W for perspective-correct rendering. */
export const BACKGROUND_VIEWPORT = Object.freeze({x:48,y:24,width:576,height:672,canvasWidth:960,canvasHeight:720});
const TAU=Math.PI*2,TILE=28,NEAR=2,FAR=185;
const clamp=(value,a,b)=>Math.max(a,Math.min(b,value));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((value,index)=>value-b[index]);
const unit=vector=>{const length=Math.hypot(...vector);if(!(length>1e-8))throw new RangeError('Degenerate camera vector');return vector.map(value=>value/length);};
const rgba=(r,g,b,a=255)=>((Math.round(clamp(r,0,255))<<24)|(Math.round(clamp(g,0,255))<<16)|(Math.round(clamp(b,0,255))<<8)|Math.round(clamp(a,0,255)))>>>0;
const hex=color=>[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
const color=(value,light=1,alpha=255)=>{const rgb=typeof value==='string'?hex(value):value;return rgba(rgb[0]*light,rgb[1]*light,rgb[2]*light,alpha);};

/** Column-major multiplication: the resulting transform applies b, then a. */
export function multiply3d(a,b){
  const result=Array(16).fill(0);
  for(let column=0;column<4;column++)for(let row=0;row<4;row++)
    for(let k=0;k<4;k++)result[column*4+row]+=a[k*4+row]*b[column*4+k];
  return result;
}
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const translation=(x,y,z)=>{const matrix=identity();matrix[12]=x;matrix[13]=y;matrix[14]=z;return matrix;};

/** Positive world Z is forward. Depth is converted to OpenGL's [-W,+W]. */
export function perspective3d(fov=Math.PI*.30,aspect=576/672,near=NEAR,far=FAR){
  if(!(fov>0&&fov<Math.PI&&aspect>0&&near>0&&far>near))throw new RangeError('Invalid perspective');
  const f=1/Math.tan(fov/2);
  return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(far-near),1,0,0,-2*near*far/(far-near),0];
}
export function lookAt3d(eye,target,up=[0,1,0]){
  const forward=unit(sub(target,eye)),right=unit(cross(up,forward)),vertical=cross(forward,right);
  return[right[0],vertical[0],forward[0],0,right[1],vertical[1],forward[1],0,
    right[2],vertical[2],forward[2],0,-dot(right,eye),-dot(vertical,eye),-dot(forward,eye),1];
}
export function viewport3d(viewport=BACKGROUND_VIEWPORT){
  const {x,y,width,height,canvasWidth,canvasHeight}=viewport,matrix=identity();
  matrix[0]=width/canvasWidth;matrix[5]=height/canvasHeight;
  matrix[12]=(x*2+width)/canvasWidth-1;matrix[13]=1-(y*2+height)/canvasHeight;return matrix;
}
export function transform3d(matrix,point){
  const [x,y,z,w=1]=point;
  return[0,1,2,3].map(row=>matrix[row]*x+matrix[4+row]*y+matrix[8+row]*z+matrix[12+row]*w);
}
export function project3d(matrix,point,viewport=BACKGROUND_VIEWPORT){
  const [x,y,z,w]=transform3d(matrix,point);
  if(!(w>0))return null;
  return{x:(x/w+1)*viewport.canvasWidth/2,y:(1-y/w)*viewport.canvasHeight/2,depth:z/w,w};
}

const PALETTES=[
  {fog:'#182330',ground:'#364140',stone:'#74786C',wood:'#614439',accent:'#CB8149',light:'#EBD494'},
  {fog:'#1A303C',ground:'#334D48',stone:'#5F7B7D',wood:'#416254',accent:'#80A9AD',light:'#C7DADC'},
  {fog:'#162F40',ground:'#305057',stone:'#677B78',wood:'#5B5C4A',accent:'#6CA99B',light:'#C8CF9E'},
  {fog:'#27233C',ground:'#474154',stone:'#8F8574',wood:'#6B516F',accent:'#947CAB',light:'#D0BD88'},
  {fog:'#182E2A',ground:'#354A40',stone:'#79806A',wood:'#405345',accent:'#AE6657',light:'#C4BC93'},
  {fog:'#36544F',ground:'#6D8880',stone:'#BCBDA1',wood:'#C3B377',accent:'#A3C9B5',light:'#E1D3A1'},
  {fog:'#1E2944',ground:'#36445C',stone:'#8796AA',wood:'#495269',accent:'#A25969',light:'#D4D7E2'},
];

class Geometry{
  constructor(palette,label){this.palette=palette;this.label=label;this.vertices=[];this.faces=[];this.features=new Set();this.fogCache=new Map();}
  face(points,tint,{alpha=255,light=true,tag='surface'}={}){
    points=points.map(point=>point.map(Math.fround));
    this.features.add(tag);const start=this.vertices.length;
    const normal=points.length>=3?unit(cross(sub(points[1],points[0]),sub(points[2],points[0]))):[0,1,0];
    const shade=light ? .68+Math.abs(dot(normal,[-.34,.80,-.48]))*.25 : 1;
    // The left atlas half is a matte paper/stone grain, the right half is the
    // soft-alpha billboard. One material permits a single global face order.
    const paint=color(tint,shade,alpha),uv=[[0,1],[.44,1],[.44,0],[0,0]];
    for(let i=0;i<points.length;i++)this.vertices.push([...points[i],...uv[i%4],paint]);
    const center=[0,1,2].map(axis=>Math.fround(points.reduce((sum,point)=>sum+point[axis],0)/points.length)),indices=[];
    for(let i=1;i<points.length-1;i++)indices.push(start,start+i,start+i+1);
    this.faces.push({center,indices});return this;
  }
  box(x,y,z,w,h,d,tint,tag='box'){
    const a=x-w/2,b=x+w/2,c=y,e=y+h,f=z-d/2,g=z+d/2;
    return this.face([[a,c,f],[b,c,f],[b,e,f],[a,e,f]],tint,{tag})
      .face([[b,c,g],[a,c,g],[a,e,g],[b,e,g]],tint,{tag})
      .face([[a,c,g],[a,c,f],[a,e,f],[a,e,g]],tint,{tag})
      .face([[b,c,f],[b,c,g],[b,e,g],[b,e,f]],tint,{tag})
      .face([[a,e,f],[b,e,f],[b,e,g],[a,e,g]],tint,{tag})
      .face([[a,c,g],[b,c,g],[b,c,f],[a,c,f]],tint,{tag});
  }
  plane(x,y,z,w,d,tint,tag='ground'){
    return this.face([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],tint,{tag});
  }
  cylinder(x,y,z,r,h,tint,{segments=6,topRadius=r,tag='cylinder'}={}){
    const top=[],bottom=[];
    for(let i=0;i<segments;i++){
      const a=i*TAU/segments,b=(i+1)*TAU/segments;
      const p=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,y,z+Math.sin(b)*r];
      const u=[x+Math.cos(b)*topRadius,y+h,z+Math.sin(b)*topRadius],v=[x+Math.cos(a)*topRadius,y+h,z+Math.sin(a)*topRadius];
      this.face(topRadius>0?[p,q,u,v]:[p,q,[x,y+h,z]],tint,{tag});top.push(v);bottom.unshift(p);
    }
    if(topRadius>0)this.face(top,tint,{tag});this.face(bottom,tint,{tag});return this;
  }
  strand(a,b,width,tint,tag='thread',alpha=255){
    const direction=unit(sub(b,a)),offset=unit(Math.abs(direction[1])>.9?cross(direction,[1,0,0]):cross(direction,[0,1,0]));
    const p=a.map((v,i)=>v+offset[i]*width),q=a.map((v,i)=>v-offset[i]*width);
    const r=b.map((v,i)=>v-offset[i]*width),s=b.map((v,i)=>v+offset[i]*width);
    return this.face([p,q,r,s],tint,{tag,light:false,alpha});
  }
  ring(x,y,z,r,width,tint,{segments=24,vertical=false,tag='ring'}={}){
    for(let i=0;i<segments;i++){
      const a=i*TAU/segments,b=(i+1)*TAU/segments;
      const point=(angle,radius)=>vertical?[x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,z]:[x+Math.cos(angle)*radius,y,z+Math.sin(angle)*radius];
      this.face([point(a,r),point(b,r),point(b,r-width),point(a,r-width)],tint,{tag,light:false});
    }return this;
  }
  orderedIndices(forward,extraFaces=[],offset=this.vertices.length){
    // Vertices never move here. Sorting a few hundred face centres, rather
    // than rebuilding thousands of world-space vertices, gives painter order
    // for the host's deliberately depth-buffer-free renderer.
    const combined=this.faces.concat(extraFaces.map(face=>({center:face.center,indices:face.indices.map(index=>index+offset)})));
    const faces=combined.map((face,index)=>({index,depth:dot(face.center,forward)}));
    faces.sort((a,b)=>b.depth-a.depth||a.index-b.index);
    const indices=[];for(const entry of faces)indices.push(...combined[entry.index].indices);return indices;
  }
  fogVertices(level=0){
    const key=clamp(Math.round(level),0,5);if(this.fogCache.has(key))return this.fogCache.get(key);
    const fog=hex(this.palette.fog),amount=key*.14;
    const vertices=key===0?this.vertices:this.vertices.map(v=>{
      const c=v[5],rgb=[c>>>24,(c>>>16)&255,(c>>>8)&255];
      return[...v.slice(0,5),rgba(...rgb.map((component,i)=>component*(1-amount)+fog[i]*amount),c&255)];
    });this.fogCache.set(key,vertices);return vertices;
  }
}

function torii(g,x,z,scale=1){const p=g.palette,s=scale;
  g.box(x-4.6*s,0,z,.65*s,10.2*s,.75*s,p.wood,'torii');g.box(x+4.6*s,0,z,.65*s,10.2*s,.75*s,p.wood,'torii');
  g.box(x,7.9*s,z,11*s,.55*s,.9*s,p.accent,'torii');g.box(x,9.8*s,z,13*s,.75*s,1.5*s,p.wood,'torii');
  g.box(x,9.25*s,z,11.5*s,.32*s,1.12*s,p.accent,'torii');g.box(x,7.8*s,z,.5*s,2.2*s,.32*s,p.stone,'nametag');
}
function lantern(g,x,z,height=5){const p=g.palette;
  g.box(x,0,z,.30,height,.3,p.wood,'lantern');g.box(x,height,z,1.55,1.8,1.45,p.accent,'lantern');
  g.box(x,height+1.8,z,1.9,.3,1.8,p.wood,'lantern');
  g.face([[x-.51,height+.3,z-.73],[x+.51,height+.3,z-.73],[x+.51,height+1.5,z-.73],[x-.51,height+1.5,z-.73]],p.light,{light:false,tag:'lamp-panel'});
}
function tree(g,x,z,height=10){const p=g.palette;
  g.cylinder(x,0,z,.46,height*.55,p.wood,{segments:5,tag:'tree'});
  g.cylinder(x,height*.28,z,3.3,height*.68,p.ground,{segments:6,topRadius:0,tag:'tree'});
}
function bamboo(g,x,z,height){const p=g.palette;
  g.cylinder(x,0,z,.28,height,p.wood,{segments:5,tag:'bamboo'});
  for(let i=1;i<4;i++)g.cylinder(x,height*i/4,z,.32,.12,p.stone,{segments:5,tag:'bamboo-node'});
  for(let side=-1;side<=1;side+=2){const y=height*.7;
    g.face([[x,y,z],[x+side*2.8,y+1,z+.8],[x+side*3.4,y+1.4,z+.6],[x+side*.65,y+.5,z]],p.accent,{tag:'bamboo-leaf'});}
}
function boat(g,x,z){const p=g.palette;
  g.face([[x-1.5,.25,z-3.8],[x+1.5,.25,z-3.8],[x+2,.25,z+2.7],[x,.25,z+4],[x-2,.25,z+2.7]],p.wood,{tag:'boat'});
  g.face([[x-1.5,.25,z-3.8],[x-2,.25,z+2.7],[x-1.15,-.7,z+2],[x-.75,-.7,z-3]],p.stone,{tag:'boat'});
  g.face([[x+2,.25,z+2.7],[x+1.5,.25,z-3.8],[x+.75,-.7,z-3],[x+1.15,-.7,z+2]],p.wood,{tag:'boat'});
  g.box(x,.25,z,3,.22,.45,p.stone,'boat-seat');g.strand([x-2,.5,z-1],[x+3,.6,z+1],.15,p.wood,'oar');
}
function bridge(g,z){const p=g.palette;
  for(let i=0;i<9;i++){const x=-13+i*3.25,h=2.2+4.3*Math.sin(i*Math.PI/8);
    g.box(x,h,z,3.35,.45,4.4,p.stone,'arched-bridge');
    for(const side of [-1,1]){g.box(x,h+.3,z+side*2.3,.18,2.2,.2,p.wood,'bridge-rail');
      if(i<8){const next=2.2+4.3*Math.sin((i+1)*Math.PI/8);g.strand([x,h+2.2,z+side*2.3],[x+3.25,next+2.2,z+side*2.3],.15,p.wood,'bridge-rail');}}
  }
}
function loom(g,x,z){const p=g.palette;
  for(const side of [-1,1])g.box(x+side*2.1,0,z,.28,7,.3,p.wood,'loom');
  g.box(x,6.7,z,4.6,.3,.42,p.stone,'loom');g.box(x,1,z,4.6,.3,.42,p.stone,'loom');
  for(let i=0;i<8;i++)g.strand([x-1.7+i*.49,1.2,z],[x-1.7+i*.49,6.5,z],.035,p.light,'gold-thread');
  for(let i=0;i<4;i++)g.strand([x-1.9,2+i,z-.04],[x+1.9,2+i,z-.04],.035,p.accent,'weft');
}
function bookshelf(g,x,z){const p=g.palette;
  for(const side of [-1,1])g.box(x+side*2.9,0,z,.28,10,1.55,p.wood,'bookshelf');
  g.box(x,0,z+.76,5.9,10,.18,p.wood,'bookshelf');
  for(let row=0;row<3;row++){g.box(x,row*3.2,z,6,.22,1.75,p.stone,'shelf');
    for(let book=0;book<5;book++)g.box(x-2.3+book*1.13,.28+row*3.2,z-.1,.7,1.8+(book%2)*.55,1.35,
      [p.accent,p.stone,p.ground,p.light,p.wood][(row+book)%5],'book');}
  g.box(x,9.8,z,6.4,.34,1.9,p.wood,'shelf');
}
function bell(g,x,y,z,scale=1){const p=g.palette,s=scale;
  g.cylinder(x,y,z,1.15*s,1.45*s,p.accent,{segments:8,topRadius:.5*s,tag:'bell'});
  g.cylinder(x,y-.16*s,z,1.3*s,.20*s,p.light,{segments:8,tag:'bell-lip'});
  g.strand([x,y+1.45*s,z],[x,y+3*s,z],.07*s,p.wood,'bell-cord');
}
function namepillar(g,x,z,height=12){const p=g.palette;
  g.box(x,1.5,z,2.4,height,.9,p.stone,'name-pillar');
  g.box(x,1.8,z-.48,1.86,height-.7,.08,p.light,'blank-name');
  g.box(x,1.15,z,3.5,.5,2,p.wood,'pillar-plinth');
}
function mirror(g,x,z){const p=g.palette;
  g.box(x,.3,z,3,11,1.2,p.wood,'mirror-pillar');
  g.box(x,.65,z-.64,2.45,10.2,.10,p.stone,'mirror');
  for(let i=0;i<4;i++)g.face([[x-1.16,.85+i*2.4,z-.71],[x+.85,2.5+i*2.4,z-.71],[x+1.1,2.82+i*2.4,z-.71],[x-.9,1.15+i*2.4,z-.71]],p.light,{alpha:65,light:false,tag:'mirror-highlight'});
}

function roadGeometry(stage,variant=0){
  const p=PALETTES[stage-1],g=new Geometry(p,`stage${stage}-road-${variant}`);
  const center=TILE/2;
  if(stage===3){g.plane(0,-.55,center,68,TILE,p.ground,'water');
    for(let i=0;i<8;i++)g.plane(0,-.52,2+i*3.6,47,.12,p.accent,'water-reflection');
    if(variant===0)bridge(g,17);
    boat(g,-9,5+variant*3);boat(g,10,8+variant*4);for(const x of [-17,17])lantern(g,x,11,2.7);
    if(variant===2)for(const x of [-20,20])g.cylinder(x,-.45,18,4,.7,p.stone,{segments:7,tag:'reed-island'});
    for(const x of [-25,25])g.box(x,-.7,center,7,.9,TILE,p.wood,'riverbank');
  }else{
    g.plane(0,stage===6?-.6:0,center,65,TILE,p.ground,'ground');
    g.plane(0,.05,center,12,TILE,p.stone,stage===5?'library-floor':'path');
    for(let i=0;i<7;i++)g.plane(0,.07,2+i*4,11.9,.11,p.wood,'path-joint');
    for(const x of [-6.2,6.2])g.box(x,.04,center,.17,.13,TILE,p.wood,'path-border');
    if(stage===1){
      if(variant!==1)torii(g,0,variant===2?9:20,.88);
      else{g.box(-13,0,18,4.5,5,3.5,p.wood,'roadside-shrine');g.box(-13,5,18,5.8,.45,4.8,p.stone,'shrine-roof');}
      for(const x of [-9,9]){lantern(g,x,7);lantern(g,x,24,4);}
      for(let i=0;i<6;i++)tree(g,(i%2?1:-1)*(16+(i%3)*4),3+i*4.4,10+(i%3)*2);
    }else if(stage===2){
      g.plane(9,.08,center,3.4,TILE,p.accent,'stream');
      for(let i=0;i<10;i++)bamboo(g,(i%2?1:-1)*(9+((i+variant)%3)*3.3),2+i*2.7,12+((i+variant)%4)*2.3);
      for(let i=0;i<3;i++)g.face([[-2+i*2.1,6+i*.6,9],[-.6+i*2.1,6+i*.6,9],[-.6+i*2.1,7.4+i*.6,9],[-2+i*2.1,7.4+i*.6,9]],p.light,{tag:'letter'});
    }else if(stage===4){
      for(const x of [-10,10]){loom(g,x,7+variant);loom(g,x,23-variant);}
      for(let i=0;i<8;i++)g.strand([-21,2+i*.9,4],[21,5+i*.35,24],.025,p.light,'memory-thread',95);
      torii(g,0,24,.83);for(const x of [-17,17])tree(g,x,12,8);
    }else if(stage===5){
      for(const x of [-9.5,9.5])bookshelf(g,x,10+variant*2);
      for(const x of [-17,17])g.box(x,0,center,1.2,18,1.2,p.wood,'library-column');
      g.box(0,16.5,center,36,.8,1.8,p.wood,'library-beam');
      for(let i=0;i<4;i++){const x=-5+i*3.3;g.face([[x,11,19],[x+1.1,11,19],[x+1.1,14,19],[x,14,19]],p.light,{tag:'hanging-talisman'});}
    }else if(stage===6){
      for(let i=0;i<8;i++)g.box(0,.22*Math.sin(i*Math.PI/7),2+i*3.6,12,.3,3.45,p.stone,'cloud-stair');
      for(const x of [-11,11]){namepillar(g,x,7,13-variant);namepillar(g,x,24,10+variant);bell(g,x,15,7,.6);}
      for(const x of [-24,24])g.cylinder(x,-1,center,7,1.1,p.accent,{segments:10,tag:'cloud-platform'});
    }else if(stage===7){
      for(const x of [-9,9]){mirror(g,x,8+variant);mirror(g,x,23-variant);bell(g,x,13,15,.8);}
      for(let i=0;i<8;i++)g.strand([-15,10+i*.3,3+i*3],[15,12-i*.3,7+i*2.2],.20,
        i%2?p.light:p.accent,i%2?'white-ribbon':'red-ribbon',78);
      g.box(0,16,center,28,.5,1.4,p.wood,'inverted-corridor');
      for(let i=0;i<6;i++)g.plane(0,.10,3+i*4,8,.75,i%2?p.accent:p.light,'mirror-floor');
    }
  }
  return g;
}

function spellGeometry(stage){
  const p=PALETTES[stage-1],g=new Geometry(p,`stage${stage}-spell`);
  g.cylinder(0,-1.2,0,14,.8,p.ground,{segments:24,tag:'spell-platform'});
  g.ring(0,-.35,0,13,.15,p.light,{tag:'spell-circle'});g.ring(0,-.34,0,9,.12,p.accent,{tag:'spell-circle'});
  if(stage===1){torii(g,0,0,.95);for(let i=0;i<6;i++){const a=i*TAU/6;lantern(g,Math.cos(a)*10,Math.sin(a)*10,4);}}
  if(stage===2){for(let i=0;i<8;i++){const a=i*TAU/8;bamboo(g,Math.cos(a)*10,Math.sin(a)*10,11);}
    for(let i=0;i<6;i++){const a=i*TAU/6,x=Math.cos(a)*7,z=Math.sin(a)*7;g.box(x,3,z,1.5,2.2,.12,p.light,'spell-letter');}}
  if(stage===3){bridge(g,0);for(let i=0;i<3;i++){const a=i*TAU/3;boat(g,Math.cos(a)*10,Math.sin(a)*10);}g.ring(0,-.28,0,11,.35,p.accent,{tag:'water-ring'});}
  if(stage===4){for(let i=0;i<4;i++){const a=i*TAU/4;loom(g,Math.cos(a)*9,Math.sin(a)*9);}
    for(let i=0;i<8;i++){const a=i*TAU/8;g.strand([Math.cos(a)*13,2,Math.sin(a)*13],[Math.cos(a+Math.PI)*13,9,Math.sin(a+Math.PI)*13],.035,p.light,'spell-thread');}}
  if(stage===5){for(const x of [-9,9])bookshelf(g,x,0);for(const z of [-10,10])g.box(0,0,z,7,12,1,p.wood,'archive-door');
    for(let i=0;i<5;i++){const a=i*TAU/5,x=Math.cos(a)*9,z=Math.sin(a)*9;g.ring(x,8,z,1.8,.22,p.accent,{segments:4,vertical:true,tag:'spell-stamp'});}}
  if(stage===6){for(let i=0;i<6;i++){const a=i*TAU/6;namepillar(g,Math.cos(a)*11,Math.sin(a)*11,13);}
    bell(g,0,12,0,2.1);g.ring(0,5,0,6,.25,p.accent,{vertical:true,tag:'name-sound'});}
  if(stage===7){for(let i=0;i<6;i++){const a=i*TAU/6;mirror(g,Math.cos(a)*11,Math.sin(a)*11);}
    bell(g,-4,11,0,1.5);bell(g,4,6,0,1.5);g.ring(0,7,0,6,.25,p.accent,{vertical:true,tag:'echo-circle'});
    g.ring(0,7,1,8,.20,p.light,{vertical:true,tag:'echo-circle'});}
  return g;
}

export function cameraForStage(stage,clock=0,spell=false){
  const id=typeof stage==='number'?stage:stage.id;
  if(!Number.isInteger(id)||id<1||id>7||!Number.isFinite(clock))throw new RangeError('Invalid stage camera');
  if(spell){const angle=clock*.0009+id*.53;
    return{eye:[Math.sin(angle)*30,18+Math.sin(angle*.61)*1.5,-Math.cos(angle)*30].map(Math.fround),target:[0,5,0],fov:Math.fround(Math.PI*.34)};}
  const travel=clock*[.13,.105,.095,.105,.10,.095,.11][id-1],sway=Math.sin(clock*.0016+id*.8);
  const height=[15,14,18,15,14,19,16][id-1]+Math.sin(clock*.0011+id)*.55;
  return{eye:[sway*(id===5?1.1:2.4),height,travel].map(Math.fround),target:[sway*.8,2.7,travel+42].map(Math.fround),fov:Math.fround(Math.PI*.30)};
}

export class StageBackground{
  constructor({art}={}){
    if(!art?.load||!art?.background||!art?.host?.createTexture)throw new TypeError('StageBackground requires GameArt');
    this.art=art;
    const size=128,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const offset=(y*size+x)*4,glow=x>=64;
      const shade=glow?255:241+((x*71+y*37+(x*y)%17)%15);
      pixels[offset]=pixels[offset+1]=pixels[offset+2]=shade;
      const radius=Math.hypot((x-96)/30,(y-64)/60);
      pixels[offset+3]=glow?Math.round(255*Math.max(0,1-radius)**2):255;
    }
    this.texture=art.host.createTexture(size,size,pixels);
    this.stage=null;this.geometry=null;this.geometryVariants=null;this.spellGeometry=null;this.destroyed=false;this.stats=null;
    this.viewport=viewport3d();
  }
  setStage(stage){
    const id=typeof stage==='number'?stage:stage?.id;
    if(!Number.isInteger(id)||id<1||id>7)throw new RangeError('Stage must be 1..7');
    if(this.stage?.id===id)return this;
    this.stage=typeof stage==='number'?{id,background:`stage0${id}`} : stage;
    // Only the current pair of scenery meshes is retained, so stage changes do
    // not accumulate mesh/texture copies. Art manages its own shared textures.
    this.geometryVariants=[0,1,2].map(variant=>roadGeometry(id,variant));this.geometry=this.geometryVariants[0];
    this.spellGeometry=spellGeometry(id);this.stats=null;return this;
  }
  _billboards(id,clock,camera,spell=false){
    const forward=unit(sub(camera.target,camera.eye)),right=unit(cross([0,1,0],forward)),up=cross(forward,right);
    const vertices=[],faces=[],p=PALETTES[id-1],number=id===2?12:6;
    for(let i=0;i<number;i++){
      const phase=(clock*(id===2 ? .043 : .009)+i*7.19)%TILE;
      const x=Math.sin(i*13.2+id)*14,y=id===2?18-phase*.63:4+Math.sin(clock*.015+i)*1.7;
      const z=3+(i*4.31)%22,size=id===2 ? .16 : .18+(i%3)*.09;
      const center=[x,y,z],index=vertices.length,paint=color(p.light,.85,id===2?85:135);
      for(const [sx,sy,u,v] of [[-1,-1,0,1],[1,-1,1,1],[1,1,1,0],[-1,1,0,0]]){
        const width=spell?size*1.4:size,height=id===2?size*7:size;
        vertices.push([...center.map((value,axis)=>value+right[axis]*sx*width+up[axis]*sy*height),.5+u*.5,v,paint]);
      }
      faces.push({center,indices:[index,index+1,index+2,index,index+2,index+3]});
    }
    return{vertices,faces};
  }
  draw(draw,game,{stage=this.stage,clock=game?.frame??0}={}){
    if(this.destroyed)throw new Error('Background has been destroyed');if(!stage)return draw;
    this.setStage(stage);const id=this.stage.id,spell=!!game?.spell?.active,p=PALETTES[id-1];
    const camera=cameraForStage(id,clock,spell),view=lookAt3d(camera.eye,camera.target),projection=perspective3d(camera.fov);
    const vp=multiply3d(this.viewport,multiply3d(projection,view)),forward=unit(sub(camera.target,camera.eye));
    // Painted art is a distant sky/mountain layer. The road, buildings, steps,
    // water and all nearby landmarks below are actual world-space meshes.
    draw.rect(48,24,576,672,color(p.fog));
    this.art.background(draw,this.stage.background??`stage0${id}`,336,360,576,672,{alpha:spell ? .20 : .37});
    draw.rect(48,24,576,672,color(p.fog,1,spell?160:80));
    draw.sampler(this.texture,'bilinear','clamp','clamp');
    let meshCalls=0,vertexCount=0;
    if(spell){
      const mesh=this.spellGeometry,glints=this._billboards(id,clock,camera,true);
      const vertices=mesh.fogVertices(1).concat(glints.vertices),indices=mesh.orderedIndices(forward,glints.faces);
      draw.mesh3d(this.texture,vertices,indices,vp);meshCalls++;vertexCount+=vertices.length;
    }else{
      const first=Math.floor(camera.eye[2]/TILE),particles=this._billboards(id,clock,camera);
      const indices=this.geometryVariants.map(mesh=>mesh.orderedIndices(forward,particles.faces)),frameVertices=new Map();
      for(let tile=first+6;tile>=first;tile--){
        const variant=((tile%3)+3)%3,mesh=this.geometryVariants[variant],z=tile*TILE,depth=dot(sub([0,5,z+TILE/2],camera.eye),forward);
        if(depth>FAR+TILE||depth<-TILE)continue;
        const fogLevel=clamp(Math.round((depth-35)/26),0,5);
        const key=variant*6+fogLevel;
        if(!frameVertices.has(key))frameVertices.set(key,mesh.fogVertices(fogLevel).concat(particles.vertices));
        const vertices=frameVertices.get(key),mvp=multiply3d(vp,translation(0,0,z));
        draw.mesh3d(this.texture,vertices,indices[variant],mvp);meshCalls++;vertexCount+=vertices.length;
      }
    }
    // Dim the upper region behind timer/rings while preserving the perspective
    // geometry. HUD and spell title are drawn later by thlib's compositor.
    draw.rect(48,24,576,672,0x00000022).rect(48,24,576,128,color(p.fog,1,52));
    this.stats={stage:id,spell,meshCalls,vertices:vertexCount,camera,features:[...(spell?this.spellGeometry:this.geometry).features]};
    return draw;
  }
  destroy(){if(this.destroyed)return;this.destroyed=true;this.art.host.unloadTexture(this.texture);this.geometry=null;this.geometryVariants=null;this.spellGeometry=null;}
}
