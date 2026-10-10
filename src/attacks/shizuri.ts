import type {AttackKit, BossAttacks} from '../danmaku.js';
﻿/** 雨巻静织 — Stage 2. Rain is a texture to micro-dodge; letters are the
 * events: they travel, stop, open, and are delivered toward the player. */
import {T,C,C8,DOWN,TAU,clamp,lerp} from '../danmaku.js';
import {polygon,burstShape} from './shapes.js';

/** Needles from the top edge; `lean` tilts the rain away from vertical. */
function drizzle(k: AttackKit,count:number,{lean=0,speed=[2.4,3.2],color=C.SKY,type=T.NEEDLE,span=[-186,186]}:{lean?:number;speed?:number[];color?:number;type?:number;span?:number[]}={}){
  for(let i=0;i<count;i++){
    const x=lerp(span[0],span[1],k.unit()),v=lerp(speed[0],speed[1],k.unit());
    k.shot(x,-6,DOWN+lean+(k.unit()-.5)*.06,v,type,color,null,{safe:2304,silent:true});
  }
}

/** Midboss: light rain with short aimed bundles of letters. */
function postmanBeforeRain(k: AttackKit){
  if(k.every(k.pick(6,4,3,2)))drizzle(k,1,{lean:.1});
  if(k.every(k.pick(70,56,48,42),30))k.aimed(k.ox,k.oy,k.pick(3,5,5,7),2.6,.2,T.AMULET,C.WHITE,null,{rows:k.pick(2,2,3,3),speedStep:1.8});
  if(k.every(144,100))k.wander(44);
}

/** 封缄「雨停前请勿拆阅」: sealed envelopes rise and hang in the air; they
 * open one after another along the row, each letting a short fan of rain
 * fall before the letter itself is delivered toward the player. */
function sealedUntilRainStops(k: AttackKit){
  const period=k.pick(104,84,70,60);
  if(k.every(k.pick(12,10,8,7)))drizzle(k,1,{lean:.05,speed:[1.9,2.6]});
  if(k.every(period)){
    const m=k.pick(4,5,7,9),wave=k.t/period|0,spread=2.4/(m-1),first=-DOWN+(wave%2?.12:-.12)-spread*(m-1)/2;
    const envelopes=[];
    for(let i=0;i<m;i++){
      const turn=wave%2?m-1-i:i;
      envelopes.push(...k.shot(k.ox,k.oy,first+i*spread,3.1,T.AMULET,wave%2?C.PALE:C.WHITE,
        [k.hold(40),k.wait(30+turn*k.pick(9,8,6,5)),k.aimNow(k.pick(1.6,1.9,2.1,2.3))],{silent:i>0}));
    }
    k.later(70,envelopes,b=>k.fan(b.x,b.y,k.pick(2,3,4,5),1.8,DOWN,k.pick(.4,.3,.24,.2),T.NEEDLE,C.SKY));
  }
}

/** Nonspell 1: chevrons of letters with folded corners fly at the player in
 * short phrases; a passing shower falls between them. Each chevron is a tight
 * stack that crosses the player's row quickly, and every phrase ends with a
 * rest, so a player streaming one way can always turn back. */
function foldedCorners(k: AttackKit){
  const gap=k.pick(44,36,30,26),burst=k.pick(3,3,4,4),cycle=gap*(burst-1)+k.pick(84,80,76,72),beat=k.t%cycle;
  if(beat%gap===0&&beat<gap*burst){
    const aim=k.aim(),length=k.pick(4,5,6,7),odd=(beat/gap)&1;
    for(const wing of k.rank>=1?[.3,.62]:[.3])for(const side of[-1,1])
      k.fan(k.ox,k.oy,1,3.3,aim+side*wing,0,T.AMULET,odd?C.SKY:C.AZURE,null,{rows:length,speedStep:2.4});
    if(k.rank>=2)k.aimed(k.ox,k.oy,1,3,0,T.NEEDLE,C.WHITE,null,{rows:4,speedStep:2.4});
  }
  if(k.every(k.pick(9,6,6,5)))drizzle(k,1,{lean:.08});
  if(k.every(160,120))k.wander(42);
}

/** Nonspell 3: greetings scatter as fountains of letters that fall back
 * under gravity; the second fountain fills the first one's gaps. */
function scatteredGreetings(k: AttackKit){
  const period=k.pick(54,40,34,30),n=k.pick(12,18,22,26);
  if(k.every(period)){
    const turn=(k.t/period|0)*.7;
    k.ring(k.ox,k.oy,n,2.3,turn,T.AMULET,C.WHITE,[k.accel(.034,180,DOWN)]);
    if(k.rank>=2)k.ring(k.ox,k.oy,n,1.7,turn+Math.PI/n,T.AMULET,C.PALE,[k.accel(.03,180,DOWN)]);
  }
  if(k.every(120,60))k.aimed(k.ox,k.oy,3,2.8,.18,T.NEEDLE,C.SKY,null,{rows:k.pick(1,2,3,3),speedStep:2});
  if(k.every(180,150))k.wander(42);
}

/** 雨符「无人签收之雨」: fine swaying rain is the texture. Envelopes
 * aimed at the player stop, then burst open into rings of blank addresses. */
function blankAddresseeDrizzle(k: AttackKit){
  const sway=.16*Math.sin(k.t*.004);
  // Slower rain, envelopes and rings on every difficulty. Slower needles
  // linger longer, so they are also spawned less often to keep the on-screen
  // density at or below the old value.
  const rain=[[1.5,2.1],[1.75,2.45],[1.7,2.35],[1.6,2.2]][k.extra?3:k.rank];
  if(k.every(k.pick(6,4,3,4)))drizzle(k,k.pick(1,1,1,2),{lean:sway,speed:rain});
  const period=k.pick(82,64,54,46);
  if(k.every(period)){
    const envelopes=k.aimed(k.ox,k.oy,k.pick(1,3,3,5),k.pick(2.5,2.8,2.6,2.3),k.pick(0,.34,.3,.26),T.AMULET,C.WHITE,[k.hold(48),k.wait(22),k.vanish()]);
    k.later(62,envelopes,b=>k.ring(b.x,b.y,k.pick(8,10,12,14),k.pick(1.3,1.4,1.3,1.15),k.unit()*TAU,T.BALL,C.AZURE,null,{silent:true}));
  }
}
blankAddresseeDrizzle.home={x:0,y:100};

/** 墨雨「洗去首句问候」: ink drops are lobbed high and fall under
 * gravity; where each lands it splashes into a ring. Light rain continues. */
function washedGreeting(k: AttackKit){
  if(k.every(k.pick(11,8,6,5)))drizzle(k,1,{type:T.RICE,lean:.04,speed:[2.1,2.7],color:C.SKY});
  const period=k.pick(52,40,33,28);
  if(k.every(period)){
    const drops=k.pick(1,1,2,2);
    for(let i=0;i<drops;i++){
      const angle=-DOWN+(k.unit()-.5)*1.9,speed=lerp(2.2,3,k.unit()),g=.045;
      const splashY=lerp(210,290,k.unit()),vy=Math.sin(angle)*speed*k.sp,ga=g*k.sp;
      const time=Math.round((-vy+Math.sqrt(vy*vy+2*ga*(splashY-k.oy)))/ga);
      const drop=k.shot(k.ox,k.oy,angle,speed,T.ORB,C8.BLUE,[k.accel(g,time+12,DOWN),k.vanish()]);
      k.later(time+8,drop,b=>{
        k.ring(b.x,b.y,k.pick(10,14,18,20),1.45,k.unit()*TAU,T.BALL,C.BLUE,null,{silent:true,...(k.rank===3?{rows:2,speedStep:1}:null)});
        if(k.rank>=1)k.fan(b.x,b.y,3,2.2,-DOWN,.5,T.RICE,C.GRAY,[k.accel(.04,120,DOWN)],{silent:true});
      });
    }
  }
}
washedGreeting.home={x:0,y:118};

/** 送雨「千万封未达之信」: square bundles of letters spread, stop, and
 * are all re-addressed toward the player at once. Blooming seeds fill the margins. */
function undeliveredLetters(k: AttackKit){
  const period=k.pick(110,86,72,62),edge=k.pick(7,9,10,12),speed=k.pick(2.2,2.6,2.8,3);
  const bundle=(rotation:number,color:number,delay:number)=>burstShape(k,k.ox,k.oy,polygon(4,edge),3.6,rotation,T.AMULET,color,
    [k.wait(14),k.hold(36),k.wait(delay),k.aimNow(speed)]);
  if(k.every(period)){
    const wave=k.t/period|0,rotation=(wave%2?Math.PI/4:0)+k.signed()*.2;
    bundle(rotation,wave%2?C.PALE:C.WHITE,k.pick(24,20,16,14));
    if(k.rank>=2)k.state.second={at:k.t+10,rotation:rotation+Math.PI/4};
  }
  if(k.state.second?.at===k.t){bundle(k.state.second.rotation,C.SKY,k.pick(24,20,22,20));k.state.second=null;}
  // Blooms instead of random rain: seeds fall from a fixed lattice that shifts
  // half a step every wave (symmetric about the centre), then open into rings at a set height. The gaps are
  // readable, so surviving no longer depends on where random needles landed.
  const bloomEvery=k.pick(96,78,66,60),seeds=k.pick(3,3,4,4),bloomAt=k.pick(64,62,60,58),petals=k.pick(8,10,12,14);
  if(k.every(bloomEvery,24)){
    const wave=(k.t-24)/bloomEvery|0,step=360/seeds;
    const odd=wave%2===1;
    for(let i=0;i<(odd?seeds-1:seeds);i++){
      const x=-180+step*(i+(odd?1:.5)),seed=k.shot(x,-6,DOWN,2.1,T.ORB,C.PALE,[k.wait(bloomAt+6),k.vanish()],{safe:2304,silent:true});
      k.later(bloomAt,seed,b=>k.ring(b.x,b.y,petals,1.3,wave%2?Math.PI/petals:0,T.BALL,wave%2?C.SKY:C.AZURE,null,{silent:true}));
    }
  }
  if(k.every(period*2,period))k.wander(46,{y:[90,120]});
}
undeliveredLetters.home={x:0,y:104};

export const SHIZURI: BossAttacks=Object.freeze({
  id:'shizuri',
  nonspells:[foldedCorners,scatteredGreetings],
  spells:[blankAddresseeDrizzle,washedGreeting,undeliveredLetters],
  midboss:{nonspell:postmanBeforeRain,spells:[sealedUntilRainStops]},
});
