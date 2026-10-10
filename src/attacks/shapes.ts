/** Geometry for bursts that keep a recognisable outline while expanding:
 * every bullet leaves one origin with velocity proportional to its point on
 * a unit outline, so the outline scales homothetically over time. */
import {TAU,wrap} from '../danmaku.js';
import type {AttackKit, BulletExtras} from '../danmaku.js';
import type {TouhouBulletCommand} from '@ts-stg/thlib/touhou';
export interface ShapePoint {angle:number;radius:number;}
export interface ShapeOptions {
  skip?:((point:ShapePoint,angle:number,index:number)=>boolean)|null;
  colorOf?:((index:number,point:ShapePoint)=>number)|null;extra?:BulletExtras;
}

const cache=new Map<string,readonly ShapePoint[]>();
const memo=(key:string,build:()=>ShapePoint[])=>{if(!cache.has(key))cache.set(key,Object.freeze(build()));return cache.get(key)!;};

function outline(vertices:number[][],perEdge:number){
  const points=[];
  for(let i=0;i<vertices.length;i++){
    const [ax,ay]=vertices[i],[bx,by]=vertices[(i+1)%vertices.length];
    for(let j=0;j<perEdge;j++){const t=j/perEdge,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;points.push({angle:Math.atan2(y,x),radius:Math.hypot(x,y)});}
  }
  return points;
}
/** Regular polygon with a vertex at angle 0 and circumradius 1. */
export const polygon=(sides:number,perEdge:number)=>memo(`p${sides}:${perEdge}`,()=>outline(
  Array.from({length:sides},(_,i)=>[Math.cos(i*TAU/sides),Math.sin(i*TAU/sides)]),perEdge));
/** Star outline: alternating outer (1) and inner (`inner`) radii. */
export const star=(points:number,perEdge:number,inner=.42)=>memo(`s${points}:${perEdge}:${inner}`,()=>outline(
  Array.from({length:points*2},(_,i)=>{const r=i%2?inner:1,a=i*Math.PI/points;return[Math.cos(a)*r,Math.sin(a)*r];}),perEdge));
/** Rose curve r = |cos(petals θ / 2)| sampled evenly in angle. */
export const rose=(petals:number,count:number,floor=.18)=>memo(`r${petals}:${count}:${floor}`,()=>Array.from({length:count},(_,i)=>{
  const angle=i*TAU/count;return{angle,radius:floor+(1-floor)*Math.abs(Math.cos(angle*petals/2))};}));

/** True when `angle` lies inside a gap of half-width `half` around `center`. */
export const inGap=(angle:number,center:number,half:number)=>Math.abs(wrap(angle-center))<half;

/** Emit an expanding outline; `skip(point, absoluteAngle)` may open doors. */
export function burstShape(k:AttackKit,x:number,y:number,shape:readonly ShapePoint[],speed:number,rotation:number,type:number,color:number,cmds?:TouhouBulletCommand[]|null,{skip=null,colorOf=null,extra=null}:ShapeOptions={}){
  for(let i=0;i<shape.length;i++){
    const p=shape[i],angle=p.angle+rotation;
    if(skip?.(p,angle,i))continue;
    k.shot(x,y,angle,Math.max(.05,speed*p.radius),type,colorOf?colorOf(i,p):color,cmds,extra);
  }
}
