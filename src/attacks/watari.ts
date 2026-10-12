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
 * fountain; ticket bundles are thrown toward both banks in between. */
function copperCoinFerry(k: AttackKit){
  if(k.every(k.pick(5,3,3,2)))for(let i=k.pick(1,1,2,2);i>0;i--){
    const angle=-DOWN+(k.unit()-.5)*2.6;
    k.shot(k.ox,k.oy,angle,lerp(2.1,3.3,k.unit()),T.BALL,C.YELLOW,[k.accel(.042,240,DOWN)],{silent:k.t%12!==0});
  }
  if(k.every(k.pick(110,90,76,66),70))k.ringGap(k.ox,k.oy,k.pick(10,14,18,22),2.2,T.AMULET,C.ORANGE,[k.accel(.02,160,DOWN)]);
  if(k.rank>=2&&k.every(11,5))k.shot(k.ox,k.oy,-DOWN+(k.unit()-.5)*1.4,lerp(1.6,2.4,k.unit()),T.STAR,C.ORANGE,[k.accel(.032,240,DOWN)],{silent:true});
  if(k.every(k.pick(96,80,70,60),40))for(const side of[-1,1])
    k.fan(k.ox,k.oy,k.pick(3,4,5,5),2.5,DOWN+side*.62,.15,T.AMULET,C.MINT,null,{rows:2,speedStep:1.9,silent:side>0});
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
 * into the river. Banks alternate, so arcs cross in a woven X. Now and then
 * the Boss punches a hoop of tickets that opens, stops, and then every ticket
 * sets off for the player from where it hung. */
function oneWayTicket(k: AttackKit){
  const period=k.pick(30,23,20,17),n=k.pick(7,10,12,13);
  if(k.every(period)){
    const wave=k.t/period|0,side=wave%2?1:-1,y=[46,96,146,96][(wave>>1)%4],inward=side<0?.32:Math.PI-.32;
    k.fan(side*186,y,n,2.25,inward,.13,T.AMULET,side<0?C.MINT:C.WHITE,[k.curve(-side*.0058,130)],{safe:2304});
  }
  const every=k.pick(180,150,136,120);
  if(k.every(every,every/2)){const hoop=k.t/every|0,count=k.pick(12,16,18,20);
    k.ring(k.ox,k.oy,count,2.2,hoop*Math.PI/count,T.SCALE,C.AZURE,[k.wait(24),k.stopAim(22,k.pick(1,1.15,1.3,1.45))]);}
}
oneWayTicket.home={x:0,y:96};

/** 水路「去而复返之舟」: rings of boats brake, turn around and return to
 * the place they left, crossing the next ring on its way out. Every other
 * pair of rings stirs two eddies at the banks; they spin against each other
 * and fling curling arms of scales across the water. */
function returningFerry(k: AttackKit){
  const period=k.pick(72,56,46,40),n=k.pick(18,24,30,36);
  k.place(Math.sin(k.t*.011)*70,104+Math.sin(k.t*.017)*10);
  if(k.every(period)){
    const wave=k.t/period|0,spin=wave%2?.0035:-.0035;
    k.ring(k.ox,k.oy,n,3.3,wave*.21,T.OVAL,wave%2?C8.CYAN:C8.GREEN,
      k.rank>=2?[k.stopTurn(52,Math.PI,1.6),k.curve(spin,120)]:[k.stopTurn(52,Math.PI,1.6)]);
  }
  const c=k.t%(period*2)-period/2;
  if(c>=0&&c<24&&c%3===0){
    const pool=k.t/(period*2)|0,step=c/3,arms=k.pick(3,3,4,4);
    for(const side of[-1,1])
      k.ring(side*132,84,arms,1.35,pool*.7+side*step*.24,T.SCALE,step%2?C.BLUE:C.WHITE,[k.curve(side*.016,110)],{silent:step>0||side>0});
  }
}
returningFerry.home={x:0,y:104};

/** 渡符「两岸无应之芦苇洲」: reeds fall from evenly spaced lanes and keep
 * swaying left and right; neighbouring lanes sway against each other, so the
 * reeds twist into a woven bed. Each lane grows a reed for a random while,
 * then stays empty for a random while, so the bed is never complete. Paper
 * boats cross at any height; their wake rests on the water for a moment, then
 * slowly spreads up and down in a V. The Boss calls to both banks; the calls
 * arc over and fall into the reeds unanswered. */
function silentReedBanks(k: AttackKit){
  const sources=k.pick(6,6,8,8),reedEvery=k.pick(13,10,8,6),turn=.012,bend=56;
  const length=[[50,110],[60,130],[80,150],[90,170]][k.extra?3:k.rank],gap=[[70,160],[60,140],[40,110],[30,90]][k.extra?3:k.rank];
  const swingOf=(w:number)=>2*k.sp*(1-Math.cos(w*bend))/w;
  // Lanes leave room for the widest swing and the largest shift, so no reed reaches a bank.
  const lane=(384-2*swingOf(turn*1.1)-20)/(sources-1);
  const lanes=(k.state.reeds??=Array.from({length:sources},()=>({from:k.t+lerp(0,gap[1]*.6,k.unit()),until:0,turn,shift:0})));
  if(k.every(reedEvery)){
    let loud=true;
    lanes.forEach((reed,i)=>{
      if(reed.until===0)reed.until=reed.from+lerp(length[0],length[1],k.unit());
      if(k.t>=reed.until){
        reed.from=k.t+lerp(gap[0],gap[1],k.unit());reed.until=reed.from+lerp(length[0],length[1],k.unit());
        reed.turn=turn*lerp(.9,1.1,k.unit());reed.shift=(k.unit()-.5)*12;
      }
      if(k.t<reed.from)return;
      // Consecutive turns must be separated by wait(0), or the later turn replaces the earlier one at once.
      const w=i%2?-reed.turn:reed.turn,swing=swingOf(reed.turn),centre=-192+10+swingOf(turn*1.1)+lane*i+reed.shift;
      const sway=[k.curve(w,bend),k.wait(0),k.curve(-w,bend*2),k.wait(0),k.curve(w,bend*2),k.wait(0),k.curve(-w,bend*2)];
      k.shot(centre+(i%2?swing:-swing),-4,DOWN,2,T.RICE,i%2?C.GREEN:C.LIME,sway,{silent:!loud,safe:0});loud=false;
    });
  }
  const boatPeriod=k.pick(210,170,140,115),wakeEvery=k.pick(20,18,15,13);
  if(k.every(boatPeriod,30)){
    const side=(k.t/boatPeriod|0)%2?1:-1,y=lerp(70,330,k.unit());
    const boat=k.shot(side*190,y,side<0?0:Math.PI,1.3,T.OVAL,C8.WHITE,null,{safe:3600});
    for(let step=1;step<=Math.ceil(300/wakeEvery);step++)k.later(step*wakeEvery,boat,b=>{
      for(const up of[-1,1])k.shot(b.x,b.y,up*DOWN,0,T.BALL,C.SKY,[k.wait(24),k.speedTo(.8,60)],{silent:true});
    });
  }
  if(k.every(k.pick(150,120,92,72),55))for(const side of[-1,1])
    k.fan(k.ox,k.oy,k.pick(3,3,5,5),2.4,side<0?Math.PI+.35:-.35,.14,T.AMULET,C.WHITE,[k.curve(side*.011,140)],{silent:side>0});
}
silentReedBanks.home={x:0,y:96};

export const WATARI: BossAttacks=Object.freeze({
  id:'watari',
  nonspells:[pairedCurrents,ticketsHomeward,ripplesBeforeLanding],
  spells:[oneWayTicket,returningFerry,silentReedBanks],
  midboss:{nonspell:oarStrokes,spells:[copperCoinFerry]},
});
