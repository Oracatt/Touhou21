/** 扉灯祈 — Stage 1. Lanterns mark doors: every attack teaches one readable
 * idea (a gap that faces you, rings that weave, a lit sequence to follow). */
import {T,C,C8,DOWN} from '../danmaku.js';
import {polygon,inGap,burstShape} from './shapes.js';

/** Midboss: a lantern greeting of short ring bursts and one aimed stack. */
function lanternGreeting(k){
  const c=k.t%150;
  if(c===0)k.wander(50);
  const bursts=k.pick(2,3,3,4);
  if(c>=56&&c<56+bursts*9&&(c-56)%9===0){
    const i=(c-56)/9;k.state.spin=(k.state.spin??0)+.41;
    k.ring(k.ox,k.oy,k.pick(12,18,22,28),1.55+i*.18,k.state.spin,T.BALL,i%2?C.YELLOW:C.ORANGE);
  }
  if(c===104)k.aimed(k.ox,k.oy,k.pick(1,3,3,5),3.1,.21,T.RICE,C.RED,null,{rows:k.pick(2,3,4,4),speedStep:1.9});
}

/** Nonspell 1: rings that bend alternately left and right weave a lattice
 * of lantern light; a short aimed stack keeps the player moving. */
function lanternSpin(k){
  const period=k.pick(42,30,25,21);
  if(k.every(period)){
    const odd=(k.t/period)&1;
    k.ring(k.ox,k.oy,k.pick(12,16,20,24),1.7,k.t*.013,T.BALL,odd?C.YELLOW:C.ORANGE,[k.curve(odd?.0062:-.0062,120)]);
  }
  if(k.every(100,50))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),3,.24,T.RICE,C.RED,null,{rows:k.pick(2,3,3,4),speedStep:2});
  if(k.every(200,150))k.wander(48);
}

/** Nonspell 2: wide rows of lanterns leave one door toward the player; the
 * next row's door slides a step aside, then a ring opens its own gap. */
function lanternRows(k){
  const c=k.t%130,rows=k.pick(2,3,3,4);
  if(c===0)k.state.door=k.aim();
  if(c<rows*15&&c%15===0){
    const i=c/15,n=k.pick(13,17,21,25),span=2.7,side=(k.t/130|0)%2?1:-1;
    const door=k.state.door+(i-(rows-1)/2)*.13*side,half=k.pick(.24,.19,.17,.15);
    for(let j=0;j<n;j++){const a=DOWN+(j/(n-1)-.5)*span;if(!inGap(a,door,half))k.shot(k.ox,k.oy,a,1.85,T.ORB,i%2?C8.YELLOW:C8.RED);}
  }
  if(c===78)k.ringGap(k.ox,k.oy,k.pick(16,24,30,36),2.15,T.BALL,C.ORANGE);
  if(k.rank>=2&&c===92)k.ringGap(k.ox,k.oy,k.pick(16,24,30,36),1.6,T.BALL,C.YELLOW,null,{offset:Math.PI/k.pick(16,24,30,36)});
  if(c===112)k.wander(46);
}

/** 灯符「无主门灯」: expanding square door frames of door plates.
 * Each frame leaves its door facing where the player stood at that moment. */
function unclaimedDoorLamp(k){
  const period=k.pick(62,47,40,34),edge=k.pick(10,13,16,19);
  if(k.every(period)){
    const wave=k.t/period|0,rotation=(k.state.rotation=(k.state.rotation??.4)+.37),door=k.aim(),half=k.pick(.33,.26,.22,.19);
    burstShape(k,k.ox,k.oy,polygon(4,edge),1.6,rotation,T.AMULET,wave%2?C.RED:C.ORANGE,null,{skip:(p,a)=>inGap(a,door,half)});
    if(k.rank>=2&&wave%2)burstShape(k,k.ox,k.oy,polygon(4,edge-4),1.05,rotation+Math.PI/4,T.AMULET,C.YELLOW,null,{skip:(p,a)=>inGap(a,door,half+.06)});
  }
  if(k.every(180,90))for(const side of[-1,1])
    k.aimed(k.ox+side*46,k.oy+6,1,2.4,0,T.ORB,C8.YELLOW,null,{rows:k.pick(1,2,3,3),speedStep:1.7});
}
unclaimedDoorLamp.home={x:0,y:104};

/** 迎火「百户无字灯笼坂」: lanterns on both sides of the slope light from
 * the top toward the player. Each releases a slowly swirling ring whose gap
 * faces the player, so the crossing rings form a street with readable doors. */
function lanternSlope(k){
  const step=k.pick(24,19,16,14),cycle=step*6+60,c=k.t%cycle,round=k.t/cycle|0;
  if(c<step*6&&c%step===0){
    const i=c/step,side=(i+round)%2?1:-1,row=i>>1,x=side*(116-row*20),y=58+row*50,n=k.pick(14,18,22,24);
    k.ringGap(x,y,n,1.45,T.BALL,[C.ORANGE,C.RED,C.YELLOW][row],[k.curve(side*.0034,170)],
      k.rank===3?{rows:2,speedStep:1.1}:null);
    if(k.rank>=1)k.shot(x,y,DOWN,0,T.ORB,C8.YELLOW,[k.wait(cycle-c+10),k.set(DOWN,1.2)],{safe:2304});
  }
  if(k.rank>=1&&c===step*6+24)k.aimed(k.ox,k.oy,3,2.9,.2,T.RICE,C.RED,null,{rows:k.pick(1,2,3,3),speedStep:2.1});
  if(c===step*6+40)k.wander(40,{dx:[16,40],y:[84,104]});
}
lanternSlope.home={x:0,y:92};

export const AKARI=Object.freeze({
  id:'akari',
  nonspells:[lanternSpin,lanternRows],
  spells:[unclaimedDoorLamp,lanternSlope],
  midboss:{nonspell:lanternGreeting,spells:[]},
});
