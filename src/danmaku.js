/** Authoring vocabulary shared by roads, nonspells and spell cards. Public
 * thlib keeps bullet birth, motion execution, collision, bounds, lasers and
 * cancellation; this module only chooses what is emitted and when. */
import {touhouBulletCommand,TouhouRNG} from '@ts-stg/thlib/touhou';

export const TAU=Math.PI*2,DOWN=Math.PI/2;
/** Standard bullet table rows. ORB and later rows have eight colors (C8). */
export const T=Object.freeze({PELLET:0,BALL:4,RING:6,RICE:8,SCALE:9,NEEDLE:10,AMULET:11,BULLET:13,STAR:16,
  ORB:18,OVAL:20,KNIFE:21,BUTTERFLY:22,BIGSTAR:23,BIG:33});
export const C=Object.freeze({GRAY:0,RED:1,ROSE:2,MAGENTA:3,PINK:4,BLUE:5,SKY:6,AZURE:7,CYAN:8,GREEN:9,LIME:10,
  MINT:11,YELLOW:12,PALE:13,ORANGE:14,WHITE:15});
export const C8=Object.freeze({GRAY:0,RED:1,PINK:2,BLUE:3,CYAN:4,GREEN:5,YELLOW:6,WHITE:7});
/** Easy, Normal, Hard, Lunatic, Extra. Applied to launch and command speeds. */
export const SPEED_SCALE=Object.freeze([.86,1,1.08,1.16,1.14]);

const BIRTH=[0,1,2].map(kind=>touhouBulletCommand(1,{ints:[kind]}));
const ease=t=>t*t*(3-2*t);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

/** Place an actor through public Motion, matching the director's handoffs. */
export function placeActor(actor,x,y){
  const fx=Math.fround(x),fy=Math.fround(y);actor.x=fx;actor.y=fy;
  if(actor.motion?.position){actor.motion.position.x=fx;actor.motion.position.y=fy;}
  if(actor.animation){actor.animation.x=fx;actor.animation.y=fy;}
}

/** One reusable script context. Attack updates are synchronous, so a single
 * instance is rebound per call instead of allocating closures every frame. */
export class AttackKit {
  bind({game,boss=null,frame=0,difficulty=1,state={},rng=null,origin=null,start=0}){
    this.game=game;this.boss=boss;this.difficulty=difficulty;this.rank=Math.min(3,difficulty);this.extra=difficulty>=4;
    this.state=state;this.frame=frame;this.t=frame-start;this.sp=SPEED_SCALE[difficulty]??1;this.sounded=false;
    this.rng=rng??(state.authorRng??=new TouhouRNG(((game.rng?.state??1)^0x5bd1e995)>>>0||1));
    this.ox=origin?.x??boss?.x??0;this.oy=origin?.y??boss?.y??0;return this;
  }
  /** Easy / Normal / Hard / Lunatic, and an Extra value defaulting to Lunatic. */
  pick(e,n,h,l,x=l){return this.extra?x:this.rank===0?e:this.rank===1?n:this.rank===2?h:l;}
  every(period,offset=0,until=Infinity){const t=this.t-offset;return t>=0&&this.t<until&&t%Math.max(1,Math.round(period))===0;}
  get px(){return this.game.player.x;}
  get py(){return this.game.player.y;}
  aim(x=this.ox,y=this.oy){return Math.atan2(this.game.player.y-y,this.game.player.x-x);}
  unit(){return this.rng.unit();}
  signed(){return this.rng.signed();}

  /** Command words; every speed or acceleration follows the difficulty scale. */
  curve(angular,frames,acceleration=0){return touhouBulletCommand(3,{floats:[acceleration*this.sp,angular],ints:[frames]});}
  accel(acceleration,frames,angle=-999999){return touhouBulletCommand(2,{floats:[acceleration*this.sp,angle,0],ints:[frames]});}
  speedTo(speed,frames){return touhouBulletCommand(21,{floats:[speed*this.sp,-999999,0],ints:[frames]});}
  /** Decelerate to rest over `frames`, then relaunch toward the player. */
  stopAim(frames,speed,offset=0){return touhouBulletCommand(4,{floats:[offset,speed*this.sp,0],ints:[frames,1,1]});}
  /** Decelerate to rest, then rotate by `delta` and relaunch. */
  stopTurn(frames,delta,speed){return touhouBulletCommand(4,{floats:[delta,speed*this.sp,0],ints:[frames,1,0]});}
  /** Decelerate to rest, then relaunch along an absolute angle. */
  stopTo(frames,angle,speed){return touhouBulletCommand(4,{floats:[angle,speed*this.sp,0],ints:[frames,1,4]});}
  /** Hold the current heading at zero speed for `frames`. */
  hold(frames){return touhouBulletCommand(4,{floats:[-999999,0,0],ints:[frames,1,4]});}
  wait(frames){return touhouBulletCommand(30,{ints:[frames]});}
  /** Instant redirect; angle >= 990 means player-relative (angle - 999). */
  set(angle,speed){return touhouBulletCommand(18,{floats:[angle,speed<-990?speed:speed*this.sp]});}
  aimNow(speed,offset=0){return this.set(999+offset,speed);}
  bounce(count=1,mask=12){return touhouBulletCommand(6,{floats:[-999,384,448],ints:[count,mask]});}
  /** Re-enter from the opposite side wall `count` times (screen wrap). */
  wrapX(count=1){return touhouBulletCommand(12,{ints:[count,12]});}
  restyle(type,color){return touhouBulletCommand(9,{ints:[type,color]});}
  keepOffscreen(frames){return touhouBulletCommand(8,{ints:[frames,0]});}
  /** Cancel this bullet through the public cancel effect (no item drop). */
  vanish(){return touhouBulletCommand(10,{ints:[0]});}
  /** Glide to an absolute point; the launch speed is restored on arrival. */
  goTo(x,y,frames,easing=4){return touhouBulletCommand(17,{floats:[x,y],ints:[frames,easing&255]});}

  emit(p){
    const out=this.game.bullets.emit({x:p.x,y:p.y,angle:p.angle??0,speed:(p.speed??1)*this.sp,
      speedStep:(p.speedStep??p.speed??1)*this.sp,type:p.type??T.BALL,color:p.color??C.RED,pattern:p.pattern??1,
      count:p.count??1,rows:p.rows??1,angleStep:p.angleStep??0,commands:p.cmds?[BIRTH[p.birth??0],...p.cmds]:[BIRTH[p.birth??0]],
      shotSound:p.silent||this.sounded?-1:21,commandSound:p.commandSound??-1,minimumPlayerDistanceSquared:p.safe??1024});
    if(!p.silent)this.sounded=true;return out;
  }
  shot(x,y,angle,speed,type,color,cmds,extra){return this.emit({x,y,angle,speed,type,color,cmds,...extra});}
  /** Pattern 3: `count` bullets around the circle starting at `angle`. */
  ring(x,y,count,speed,angle,type,color,cmds,extra){return this.emit({x,y,angle,speed,type,color,cmds,pattern:3,count,...extra});}
  /** Pattern 1: a fan centred on `angle`; rows stack speed..speedStep. */
  fan(x,y,count,speed,angle,spread,type,color,cmds,extra){return this.emit({x,y,angle,speed,type,color,cmds,pattern:1,count,angleStep:spread,...extra});}
  /** Pattern 0: a fan centred on the player's current position. */
  aimed(x,y,count,speed,spread,type,color,cmds,extra){return this.emit({x,y,angle:extra?.offset??0,speed,type,color,cmds,pattern:0,count,angleStep:spread,...extra});}
  /** Pattern 4: a ring whose nearest gap faces the player. */
  ringGap(x,y,count,speed,type,color,cmds,extra){return this.emit({x,y,angle:extra?.offset??0,speed,type,color,cmds,pattern:4,count,...extra});}

  beam(x,y,angle,{width=14,delay=60,grow=14,sustain=60,shrink=14,color=C.WHITE,length=720,angular=0,sound=26}={}){
    return this.game.lasers.spawnInfinite({x,y,angle,width,length,color,type:0,delay,grow,sustain,shrink,angularVelocity:angular,sound});
  }
  laser(x,y,angle,speed,length,{width=10,color=C.WHITE,sound=-1}={}){
    return this.game.lasers.spawnStraight({x,y,angle,speed:speed*this.sp,length,width,color,type:0,initialLength:0,sound});
  }
  sound(id,x=this.ox){this.game.context?.sound?.(id,x);}

  /** Spawn children later from bullets still flying at that time. */
  later(delay,bullets,spawn){(this.state.later??=[]).push({at:this.t+delay,bullets,spawn});}
  runLater(){
    const queue=this.state.later;if(!queue?.length)return;
    for(let i=0;i<queue.length;){
      const entry=queue[i];if(entry.at>this.t){i++;continue;}
      queue.splice(i,1);for(const b of entry.bullets)if(b.state===1||b.state===2)entry.spawn(b);
    }
  }
  /** Smoothly move the scripted actor; the move survives across frames. */
  moveTo(x,y,frames=50){const b=this.boss;if(!b)return;this.state.move={x0:b.x,y0:b.y,x:clamp(x,-150,150),y:clamp(y,48,190),age:0,frames};}
  wander(frames=50,{dx=[24,64],y=[88,136],x=[-110,110]}={}){
    const b=this.boss;if(!b)return;const side=b.x>x[1]-20?-1:b.x<x[0]+20?1:this.unit()<.5?-1:1;
    this.moveTo(clamp(b.x+side*lerp(dx[0],dx[1],this.unit()),x[0],x[1]),lerp(y[0],y[1],this.unit()),frames);
  }
  /** Follow an authored path directly; cancels any pending eased move. */
  place(x,y){if(!this.boss)return;this.state.move=null;placeActor(this.boss,x,y);this.ox=this.boss.x;this.oy=this.boss.y;}
  moveTick(){
    const m=this.state.move;if(!m||!this.boss)return;m.age++;const f=ease(Math.min(1,m.age/m.frames));
    placeActor(this.boss,lerp(m.x0,m.x,f),lerp(m.y0,m.y,f));this.ox=this.boss.x;this.oy=this.boss.y;
    if(m.age>=m.frames)this.state.move=null;
  }
}

export const kit=new AttackKit();

/** One frame of an authored attack. `start` frames of preparation precede
 * the first volley; an attack's optional `home` is reached during them. */
export function driveAttack(attack,{start=0,...options}){
  const k=kit.bind({...options,start});
  if(k.t===-start&&attack.home&&k.boss)k.moveTo(attack.home.x,attack.home.y,Math.max(20,start-10));
  k.moveTick();k.runLater();
  if(k.t>=0)attack(k);
  return k;
}
