import type {AttackKit, BossAttacks} from '../danmaku.js';
﻿/** 渡守澪舟 — Stage 3. Water has direction: currents bend, boats return to
 * where they left, tickets arrive from both banks. Read the flow, not dots. */
import {T,C,C8,DOWN,TAU,lerp} from '../danmaku.js';

/** Midboss: oar strokes sweep from one bank across to the other. */
function oarStrokes(k: AttackKit){
  const c=k.t%96,side=(k.t/96|0)%2?1:-1,strokes=k.pick(8,10,12,13);
  if(c<strokes*3&&c%3===0){
    const i=c/3,angle=DOWN+side*(1-i*2/(strokes-1))*.95;
    k.fan(k.ox,k.oy,k.pick(3,4,5,5),2.5,angle,.09,T.SCALE,i%2?C.AZURE:C.CYAN);
  }
  if(c===60)k.aimed(k.ox,k.oy,k.pick(1,3,3,5),3,.2,T.RICE,C.MINT,null,{rows:k.pick(2,2,3,3),speedStep:2.1});
  if(c===80&&(k.t/96|0)%2)k.wander(36);
}

/** 船费「一文钱渡口」: copper coins are tossed in arcs and fall like a
 * fountain; ticket bundles are sold to the player in between. */
function copperCoinFerry(k: AttackKit){
  if(k.every(k.pick(5,3,3,2)))for(let i=k.pick(1,1,2,2);i>0;i--){
    const angle=-DOWN+(k.unit()-.5)*2.6;
    k.shot(k.ox,k.oy,angle,lerp(2.1,3.3,k.unit()),T.BALL,C.YELLOW,[k.accel(.042,240,DOWN)],{silent:k.t%12!==0});
  }
  if(k.every(k.pick(110,90,76,66),70))k.ringGap(k.ox,k.oy,k.pick(10,14,18,22),2.2,T.AMULET,C.ORANGE,[k.accel(.02,160,DOWN)]);
  if(k.rank>=2&&k.every(11,5))k.shot(k.ox,k.oy,-DOWN+(k.unit()-.5)*1.4,lerp(1.6,2.4,k.unit()),T.STAR,C.ORANGE,[k.accel(.032,240,DOWN)],{silent:true});
  if(k.every(k.pick(96,80,70,60),40))k.aimed(k.ox,k.oy,k.pick(3,5,5,7),2.7,.19,T.AMULET,C.MINT,null,{rows:2,speedStep:1.9});
  if(k.every(200,160))k.wander(40,{dx:[20,50]});
}
copperCoinFerry.home={x:0,y:108};

/** Nonspell 1: two currents leave the Boss's sides and bend outward, so the
 * water parts around the middle; aimed reeds cut across the channel. */
function pairedCurrents(k: AttackKit){
  if(k.every(k.pick(5,4,3,3)))for(const side of[-1,1]){
    const angle=DOWN-side*(.55+.28*Math.sin(k.t*.031));
    k.fan(k.ox+side*44,k.oy+4,k.pick(1,1,2,2),2.3,angle,.24,T.SCALE,side<0?C.AZURE:C.CYAN,[k.curve(side*.0065,90)],{silent:k.t%10!==0});
  }
  if(k.every(90,40))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),3,.17,T.RICE,C.GREEN,null,{rows:k.pick(2,3,3,4),speedStep:2});
  if(k.every(240,200))k.wander(44);
}

/** Nonspell 2: wide ticket fans are thrown out behind the Boss, brake,
 * swing back diagonally past her and cross the next outgoing fan on their
 * way down to the passenger. */
function ticketsHomeward(k: AttackKit){
  const period=k.pick(70,54,46,40);
  if(k.every(period)){
    const wave=k.t/period|0,turn=Math.PI+(wave%2?.5:-.5),n=k.pick(9,13,15,19),step=1.8/(n-1);
    k.fan(k.ox,k.oy,n,3.2,k.aim()+Math.PI+k.signed()*step/2,step,T.AMULET,wave%2?C.MINT:C.WHITE,[k.stopTurn(46,turn,1.9)]);
  }
  if(k.rank>=1&&k.every(period,period/2|0))k.ringGap(k.ox,k.oy,k.pick(12,16,22,26),1.8,T.SCALE,C.AZURE);
  if(k.every(period*3,period*2))k.wander(44);
}

/** Nonspell 3: drops land on the river ahead and raise triple ripples. */
function ripplesBeforeLanding(k: AttackKit){
  const period=k.pick(64,48,40,34);
  if(k.every(period)){
    const x=lerp(-130,130,k.unit()),y=lerp(70,150,k.unit()),n=k.pick(12,16,20,24);
    k.ring(x,y,n,1.9,k.unit()*TAU,T.BALL,C.CYAN,null,{rows:k.pick(2,3,3,3),speedStep:1,safe:2304});
  }
  if(k.every(96,48))k.aimed(k.ox,k.oy,k.pick(1,3,5,5),2.9,.16,T.SCALE,C.WHITE,null,{rows:2,speedStep:2.2});
  if(k.every(192,150))k.wander(40);
}

/** 舟符「无岸单程票」: tickets launch from both banks and bend down
 * into the river. Banks alternate, so arcs cross in a woven X. */
function oneWayTicket(k: AttackKit){
  const period=k.pick(30,23,20,17),n=k.pick(7,10,12,13);
  if(k.every(period)){
    const wave=k.t/period|0,side=wave%2?1:-1,y=[46,96,146,96][(wave>>1)%4],inward=side<0?.32:Math.PI-.32;
    k.fan(side*186,y,n,2.25,inward,.13,T.AMULET,side<0?C.MINT:C.WHITE,[k.curve(-side*.0058,130)],{safe:2304});
  }
  if(k.every(120,60))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),2.8,.15,T.SCALE,C.AZURE,null,{rows:k.pick(2,3,3,4),speedStep:1.9});
}
oneWayTicket.home={x:0,y:96};

/** 水路「去而复返之舟」: rings of boats brake, turn around and return to
 * the place they left, crossing the next ring on its way out. */
function returningFerry(k: AttackKit){
  const period=k.pick(72,56,46,40),n=k.pick(18,24,30,36);
  k.place(Math.sin(k.t*.011)*70,104+Math.sin(k.t*.017)*10);
  if(k.every(period)){
    const wave=k.t/period|0,spin=wave%2?.0035:-.0035;
    k.ring(k.ox,k.oy,n,3.3,wave*.21,T.OVAL,wave%2?C8.CYAN:C8.GREEN,
      k.rank>=2?[k.stopTurn(52,Math.PI,1.6),k.curve(spin,120)]:[k.stopTurn(52,Math.PI,1.6)]);
  }
  if(k.rank>=1&&k.every(period*2,period))k.aimed(k.ox,k.oy,3,2.6,.25,T.SCALE,C.WHITE,null,{rows:2,speedStep:1.8});
}
returningFerry.home={x:0,y:104};

/** 渡符「两岸无应之芦苇洲」: reeds fall in swaying columns; paper boats
 * cross between them and leave a wake that slowly sinks. */
function silentReedBanks(k: AttackKit){
  const spacing=k.pick(72,58,50,46),columns=Math.floor(352/spacing)+1,reedEvery=k.pick(14,10,7,6);
  if(k.every(reedEvery)){
    const lane=(k.t/reedEvery|0)%2;
    for(let i=0;i<columns;i++){
      const x=-176+i*spacing+lane*4,w=(i%2?1:-1)*.013;
      k.shot(x,-4,DOWN,2,T.RICE,i%2?C.GREEN:C.LIME,[k.curve(w,28),k.curve(-w,56),k.curve(w,56),k.curve(-w,56),k.curve(w,56)],{silent:i>0,safe:2304});
    }
  }
  // Boats cross from one bank each time; a second boat comes from the other bank on Lunatic, and every boat leaves a longer wake.
  const boatPeriod=k.pick(180,140,112,90),wakeLength=k.pick(16,22,24,28),wakeCount=2;
  if(k.every(boatPeriod,30)){
    const first=(k.t/boatPeriod|0)%2?1:-1;
    for(const side of k.rank>=3?[first,-first]:[first]){
      const y=lerp(170,300,k.unit());
      const boat=k.shot(side*190,y,side<0?0:Math.PI,1.3,T.OVAL,C8.WHITE,null,{safe:3600});
      for(let step=1;step<=wakeLength;step++)k.later(step*11,boat,b=>k.fan(b.x,b.y,wakeCount,.9,side<0?Math.PI*.75:Math.PI*.25,1.6,T.BALL,C.SKY,[k.accel(.01,90,DOWN)],{silent:true}));
    }
  }
  if(k.rank>=1&&k.every(k.pick(999,120,92,72),55))k.aimed(k.ox,k.oy,k.pick(1,1,3,3),2.7,.2,T.AMULET,C.WHITE,null,{rows:k.pick(1,2,2,3),speedStep:2});
  // A ring with a gap rolls down from the Boss on Hard and Lunatic: the
  // channel narrows before the next reeds arrive.
  if(k.rank>=2&&k.every(k.pick(999,999,230,170),95))k.ringGap(k.ox,k.oy,k.pick(18,18,20,22),1.7,T.BALL,C.SKY,[k.accel(.02,160,DOWN)]);
}
silentReedBanks.home={x:0,y:96};

export const WATARI: BossAttacks=Object.freeze({
  id:'watari',
  nonspells:[pairedCurrents,ticketsHomeward,ripplesBeforeLanding],
  spells:[oneWayTicket,returningFerry,silentReedBanks],
  midboss:{nonspell:oarStrokes,spells:[copperCoinFerry]},
});
