import type {StageIdentity} from './ui-types.js';

/** The road camera shared by the painted 3D scenery and the ambience that
 * lives inside it. Matrices are column-major; clip W reaches the GPU intact. */
export const BACKGROUND_VIEWPORT=Object.freeze({x:48,y:24,width:576,height:672,canvasWidth:960,canvasHeight:720});
const NEAR=2,FAR=220;
const dot=(a:number[],b:number[])=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a:number[],b:number[])=>a.map((v,i)=>v-b[i]);
const unit=(v:number[])=>{const n=Math.hypot(...v);if(!(n>1e-8))throw new RangeError('Degenerate camera vector');return v.map(c=>c/n);};
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
/** Column-major product: b acts first, then a. Clip W reaches the GPU intact. */
export function multiply3d(a:number[],b:number[]){const m=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m;}
export function perspective3d(fov=Math.PI*.30,aspect=576/672,near=NEAR,far=FAR){
  if(!(fov>0&&fov<Math.PI&&aspect>0&&near>0&&far>near))throw new RangeError('Invalid perspective');
  const f=1/Math.tan(fov/2);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(far-near),1,0,0,-2*near*far/(far-near),0];
}
export function lookAt3d(eye:number[],target:number[],up=[0,1,0]){
  const forward=unit(sub(target,eye)),right=unit(cross(up,forward)),vertical=cross(forward,right);
  return[right[0],vertical[0],forward[0],0,right[1],vertical[1],forward[1],0,right[2],vertical[2],forward[2],0,-dot(right,eye),-dot(vertical,eye),-dot(forward,eye),1];
}
export function viewport3d(viewport=BACKGROUND_VIEWPORT){const {x,y,width,height,canvasWidth,canvasHeight}=viewport,m=identity();m[0]=width/canvasWidth;m[5]=height/canvasHeight;m[12]=(x*2+width)/canvasWidth-1;m[13]=1-(y*2+height)/canvasHeight;return m;}
export function transform3d(m:number[],point:number[]){const[x,y,z,w=1]=point;return[0,1,2,3].map(r=>m[r]*x+m[4+r]*y+m[8+r]*z+m[12+r]*w);}
export function project3d(m:number[],point:number[],viewport=BACKGROUND_VIEWPORT){const[x,y,z,w]=transform3d(m,point);if(!(w>0))return null;return{x:(x/w+1)*viewport.canvasWidth/2,y:(1-y/w)*viewport.canvasHeight/2,depth:z/w,w};}
const FLIGHTS=[
  {height:15,speed:.095},{height:14,speed:.085},{height:17,speed:.082},{height:15,speed:.089},
  {height:12,speed:.081},{height:18,speed:.079},{height:15,speed:.092},
];
export function cameraForStage(stage:number|StageIdentity,clock=0){
  const id=typeof stage==='number'?stage:stage?.id;if(!Number.isInteger(id)||id<1||id>7||!Number.isFinite(clock))throw new RangeError('Invalid stage camera');const t=FLIGHTS[id-1];
  const travel=clock*t.speed,sway=Math.sin(clock*.0011+id*.73),lift=Math.sin(clock*.00081+id)*.65,turn=Math.sin(clock*.00053+id)*.9,roll=id===7?Math.sin(clock*.00074)*.019:0;
  return{eye:[sway*(id===5?.65:2.3),t.height+lift,travel].map(Math.fround),target:[sway*.55+turn,id===6?3.5:2.7,travel+46].map(Math.fround),up:[Math.sin(roll),Math.cos(roll),0],fov:Math.fround(Math.PI*.30)};
}
