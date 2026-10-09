import type {AttackKit, BossAttacks} from '../danmaku.js';
﻿/** 糸守紫乃 — Stage 4. Threads first divide space, then beads travel inside
 * it: lattices, counter-rotating chains and an eight-spoke web. */
import {T,C,C8,DOWN,TAU,clamp,lerp} from '../danmaku.js';

/** Midboss: two shuttles orbit the Boss and spray needles along their path. */
function spinningShuttle(k: AttackKit){
  const shuttles=k.pick(1,2,2,3);
  if(k.every(k.pick(4,3,3,2)))for(let s=0;s<shuttles;s++){
    const a=k.t*.045+s*TAU/shuttles,x=k.ox+Math.cos(a)*56,y=k.oy+Math.sin(a)*34;
    k.shot(x,y,a+Math.PI/2-.35,2.4,T.NEEDLE,s%2?C.PALE:C.MAGENTA,null,{silent:s>0||k.t%9!==0});
  }
  if(k.every(84,40))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),2.8,.2,T.BALL,C.PINK,null,{rows:k.pick(2,3,3,4),speedStep:1.9});
  if(k.every(210,170))k.wander(40);
}

/** 缝符「缝影一针」: needles fly to a ring around the player's
 * shadow, hold the circle, then stitch inward through the old centre. */
function stitchTheShadow(k: AttackKit){
  const period=k.pick(132,108,94,84);
  if(k.every(period)){
    const cx=k.px,cy=k.py,n=k.pick(12,16,20,24),r=k.pick(106,96,88,82),turn=k.unit()*TAU;
    for(let i=0;i<n;i++){
      const a=turn+i*TAU/n,tx=clamp(cx+Math.cos(a)*r,-184,184),ty=clamp(cy+Math.sin(a)*r,16,440);
      k.shot(k.ox,k.oy,a,0,T.NEEDLE,i%2?C.MAGENTA:C.PALE,[k.goTo(tx,ty,48),k.wait(k.pick(30,26,24,22)),k.set(Math.atan2(cy-ty,cx-tx),2.5)],{silent:i>0});
    }
  }
  if(k.every(k.pick(40,30,26,22),20))for(const side of[-1,1])
    k.fan(k.ox+side*40,k.oy,k.pick(3,4,5,5),2.1,DOWN-side*(.55+.25*Math.sin(k.t*.03)),.16,T.RICE,C.PINK,null,{silent:side>0});
  if(k.every(period,period/2|0))k.ringGap(k.ox,k.oy,k.pick(14,18,22,26),1.9,T.BALL,C.MAGENTA);
}
stitchTheShadow.home={x:0,y:96};

/** Nonspell 1: radial warp lines fall from the Boss; weft rows slide in
 * from the banks and drop down across them. */
function warpAndWeft(k: AttackKit){
  const period=k.pick(32,25,21,18);
  if(k.every(period)){
    const odd=(k.t/period)&1,n=k.pick(5,7,9,11);
    k.fan(k.ox,k.oy,n,2.5,DOWN+(odd?1:-1)*.05,2/(n-1),T.BALL,odd?C.PINK:C.MAGENTA,null,{rows:3,speedStep:1.6});
  }
  if(k.every(96,48))for(const side of[-1,1])for(let i=0;i<k.pick(3,4,5,6);i++)
    k.shot(side*188,70+i*28,side<0?0:Math.PI,1.7,T.NEEDLE,C.PALE,[k.wait(36+i*6),k.stopTo(20,DOWN,1.8)],{silent:i>0,safe:2304});
  if(k.every(220,190))k.wander(40);
}

/** Nonspell 2: old memories behind threads — warned beams fence the aim
 * while rings pass between them; every other ring points a bead at the
 * player instead of a gap, so the player sidesteps from ring to ring. */
function memoriesBehindThreads(k: AttackKit){
  if(k.every(150)){const aim=k.aim();for(const off of k.rank>=2?[-.5,0,.5]:[-.42,.42])k.beam(k.ox,k.oy,aim+off,{width:10,delay:54,sustain:44,color:C.MAGENTA});}
  const ringEvery=k.pick(40,30,26,22),n=k.pick(16,22,28,32);
  if(k.every(ringEvery,12))k.ringGap(k.ox,k.oy,n,1.95,T.BALL,C.PALE,null,{offset:((k.t-12)/ringEvery&1)*Math.PI/n});
  if(k.every(300,250))k.wander(36);
}

/** Nonspell 4: knots — small rings loop tightly around three points, then
 * untie and fly off in rotated directions. */
function untiedKnots(k: AttackKit){
  const period=k.pick(48,38,32,28);
  if(k.every(period)){
    const wave=k.t/period|0;
    for(let j=0;j<3;j++){
      const a=wave*.6+j*TAU/3,x=k.ox+Math.cos(a)*52,y=k.oy+Math.sin(a)*30,dir=wave%2?1:-1;
      k.ring(x,y,k.pick(6,8,10,12),1.8,a,T.BALL,j%2?C.PINK:C.PALE,[k.curve(dir*.034,52)],{silent:j>0});
    }
  }
  if(k.every(120,70))k.aimed(k.ox,k.oy,1,3,0,T.NEEDLE,C.WHITE,null,{rows:k.pick(3,4,5,6),speedStep:1.8});
  if(k.every(240,200))k.wander(40);
}

/** 糸符「相识者之经纬」: warned vertical threads divide the field into
 * corridors while beads fall inside them; each cycle the lattice loosens and
 * shifts by half a corridor. */
function acquaintanceWarpWeft(k: AttackKit){
  const cycle=k.pick(220,200,190,180),c=k.t%cycle,round=k.t/cycle|0,spacing=k.pick(104,92,82,74);
  if(c===0){
    const offset=round%2?spacing/2:0;k.state.threads=[];
    for(let x=-192+offset+spacing/2;x<192;x+=spacing){
      if(Math.abs(x)>182)continue;k.state.threads.push(x);
      k.beam(x,-12,DOWN,{width:10,delay:56,grow:12,sustain:cycle-90,shrink:14,color:C.MAGENTA,sound:k.state.threads.length===1?18:-1});
    }
  }
  const threads=k.state.threads??[];
  if(c>=40&&c<cycle-28&&k.every(k.pick(11,8,7,6))){
    const edges=[-192,...threads,192];
    for(let i=0;i+1<edges.length;i++){
      const a=edges[i]+12,b=edges[i+1]-12;if(b-a<16)continue;
      for(let n=k.pick(1,1,1,2);n>0;n--)k.shot(lerp(a,b,k.unit()),-4,DOWN,lerp(1.8,2.4,k.unit()),T.BALL,i%2?C.PINK:C.PALE,null,{silent:true,safe:2304});
    }
  }
  if(k.rank>=2&&c>=56&&c<cycle-40&&c%40===0)k.ringGap(k.ox,k.oy,k.pick(16,16,20,24),1.7,T.NEEDLE,C.WHITE);
  if(c===cycle-24)k.aimed(k.ox,k.oy,k.pick(3,5,7,9),2.8,.14,T.NEEDLE,C.WHITE,null,{rows:2,speedStep:2});
}
acquaintanceWarpWeft.home={x:0,y:92};

/** 结忆「昨日明日之错针」: yesterday's chain turns one way, tomorrow's
 * the other; where they cross, diamond-shaped openings appear and move. */
function crossedStitchesOfDays(k: AttackKit){
  const interval=k.pick(7,5,4,3),arms=k.pick(3,3,4,5);
  if(k.every(interval)){
    const a=k.t*.031;
    for(let j=0;j<arms;j++){
      k.shot(k.ox,k.oy,a+j*TAU/arms,2,T.BALL,C.PINK,null,{silent:j>0});
      k.shot(k.ox,k.oy,-a+j*TAU/arms+Math.PI/arms,1.75,T.BALL,C.SKY,null,{silent:true});
    }
  }
  if(k.rank>=1&&k.every(140,70))k.aimed(k.ox,k.oy,3,3,.12,T.NEEDLE,C.WHITE,null,{rows:k.pick(1,3,4,5),speedStep:2});
}
crossedStitchesOfDays.home={x:0,y:120};

/** 蛛符「八方归路之丝庭」: eight warned spokes turn slowly; web rings
 * expand between them, so the safe sector travels around the Boss. */
function eightfoldWebGarden(k: AttackKit){
  const cycle=300,c=k.t%cycle,round=k.t/cycle|0;
  if(c===0){
    const base=round*Math.PI/8,turn=(round%2?1:-1)*k.pick(.0022,.0025,.0027,.0028);
    for(let j=0;j<8;j++)k.beam(k.ox,k.oy,base+j*Math.PI/4,{width:9,delay:62,grow:12,sustain:200,shrink:14,color:C.PALE,angular:turn,sound:j?-1:18});
  }
  if(c>=62&&c<276&&k.every(k.pick(42,33,28,25),62))
    k.ring(k.ox,k.oy,k.pick(24,32,38,44),1.25,k.unit()*TAU,T.BALL,C.MAGENTA);
  if(k.rank>=1&&c===180)k.aimed(k.ox,k.oy,k.pick(1,3,3,5),2.6,.18,T.NEEDLE,C.WHITE,null,{rows:2,speedStep:1.8});
}
eightfoldWebGarden.home={x:0,y:112};

/** 缝忆「无署名之团圆衣」: two sleeves swing beads up against the walls
 * and the ceiling; each bead reflects once, loses its momentum and drops as
 * part of a hem that drapes across the lower field. Square patches of beads
 * are sent toward the player. */
function unsignedReunionRobe(k: AttackKit){
  if(k.every(k.pick(7,5,4,4)))for(const side of[-1,1]){
    const swing=.5+.5*Math.sin(k.t*.04+(side<0?0:Math.PI)),lift=lerp(.12,1.3,swing);
    const drape=lerp(.55,1.55,.5+.5*Math.sin(k.t*.017+(side<0?Math.PI/2:0)));
    k.shot(k.ox+side*62,k.oy+6,side<0?Math.PI+lift:-lift,2.5,T.BALL,side<0?C.PINK:C.PALE,
      [k.bounce(1,13,drape),k.accel(.026,100,DOWN)],{silent:side>0||k.t%9!==0});
  }
  if(k.every(k.pick(130,110,96,86),50)){
    const aim=k.aim(),size=k.pick(2,3,3,4);
    for(let i=0;i<size;i++)for(let j=0;j<size;j++){
      const ox=(i-(size-1)/2)*11,oy=(j-(size-1)/2)*11;
      k.shot(k.ox+ox,k.oy+oy,aim,2.4,T.BALL,C.MAGENTA,null,{silent:i+j>0});
    }
  }
  if(k.rank>=2&&k.every(90,30))k.ringGap(k.ox,k.oy,k.pick(16,20,24,28),1.5,T.NEEDLE,C.WHITE);
}
unsignedReunionRobe.home={x:0,y:118};

export const SHINO: BossAttacks=Object.freeze({
  id:'shino',
  nonspells:[warpAndWeft,memoriesBehindThreads,untiedKnots],
  spells:[acquaintanceWarpWeft,crossedStitchesOfDays,eightfoldWebGarden,unsignedReunionRobe],
  midboss:{nonspell:spinningShuttle,spells:[stitchTheShadow]},
});
