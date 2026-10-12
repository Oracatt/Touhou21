import type {AttackKit, Attack, BossAttacks} from '../danmaku.js';
﻿/** 玉继未央 — Extra. Every attack has an echo: a delayed, mirrored or
 * reversed copy. The original teaches the shape; the echo tests the timing. */
import {T,C,C8,DOWN,TAU,clamp,lerp,wrap} from '../danmaku.js';
import {polygon,star,rose,inGap,burstShape} from './shapes.js';
import {FUSAE} from './fusae.js';
import {anmEasing} from '@ts-stg/thlib/touhou';

/** Queue an echo `delay` frames later; `fire(k)` runs at that time. */
function echo(k: AttackKit,delay:number,fire:Attack){(k.state.echoes??=[]).push({at:k.t+delay,fire});}
function runEchoes(k: AttackKit){
  const queue=k.state.echoes;if(!queue?.length)return;
  for(let i=0;i<queue.length;){if(queue[i].at===k.t){const e=queue.splice(i,1)[0];e.fire(k);}else i++;}
}
const echoed=(attack:Attack):Attack=>{const run:Attack=(k: AttackKit)=>{runEchoes(k);attack(k);};Object.defineProperty(run,'name',{value:attack.name});if(attack.home)run.home=attack.home;return run;};

/** Join a continuous authored path from the actual actor position. Keeping the
 * attack clock untouched preserves volleys and delayed echoes when a survival
 * section starts halfway through another attack's periodic movement. */
function followVoicePath(k:AttackKit,id:string,x:number,y:number,finishAt=Infinity){
  let entry=k.state.pathEntry;
  if(!entry||entry.id!==id||entry.lastFrame!==k.t-1)
    entry=k.state.pathEntry={id,lastFrame:k.t,age:0,x:k.boss!.x,y:k.boss!.y};
  else{entry.age++;entry.lastFrame=k.t;}
  const join=anmEasing(9,Math.min(60,entry.age),60);
  const settle=anmEasing(9,clamp(finishAt-k.t,0,30),30);
  k.place(lerp(k.boss!.x,lerp(entry.x,x,join),settle),lerp(k.boss!.y,lerp(entry.y,y,join),settle));
}

/* ---- eight nonspells ---- */
function halfSpokenVoice(k: AttackKit){
  if(k.every(46)){const aim=k.aim(),x=k.ox,y=k.oy;
    k.fan(x,y,7,3.1,aim,.13,T.RICE,C.BLUE,null,{rows:2,speedStep:2.3});
    echo(k,18,(k: AttackKit)=>k.fan(-x,y,7,2.7,Math.atan2(k.py-y,k.px+x),.13,T.RICE,C.SKY,null,{rows:2,speedStep:2}));}
  if(k.every(92,60))k.ringGap(k.ox,k.oy,28,1.8,T.BALL,C.WHITE);
  if(k.every(184,150))k.wander(40);
}
function betweenTwoVoices(k: AttackKit){
  if(k.every(3)){const a=k.t*.052;
    for(const side of[-1,1])for(let j=0;j<2;j++)k.shot(k.ox+side*68,k.oy,side*a+j*Math.PI,2.1,T.BALL,side<0?C.BLUE:C.ROSE,null,{silent:side>0||j>0||k.t%9!==0});}
  if(k.every(100,50))k.aimed(k.ox,k.oy,5,2.8,.14,T.AMULET,C.WHITE,null,{rows:2,speedStep:2});
}
function oldNameKnocks(k: AttackKit){
  const c=k.t%72;
  if(c<24&&c%8===0)k.aimed(k.ox,k.oy,3,3.4,.11,T.SCALE,C.RED,null,{rows:3,speedStep:2.4,offset:(c/8-1)*.09});
  if(c===40)k.ringGap(k.ox,k.oy,36,2.1,T.BALL,C.BLUE,null,{rows:2,speedStep:1.5});
  if(c===60&&(k.t/72|0)%2)k.wander(36);
}
function halfAJoke(k: AttackKit){
  if(k.every(34)){const wave=k.t/34|0,w=(wave%2?1:-1)*.024;
    k.ring(k.ox,k.oy,22,2,wave*.31,T.BUTTERFLY,wave%2?C8.RED:C8.BLUE,[k.curve(w,18),k.curve(-w,36),k.curve(w,36),k.curve(-w,36),k.curve(w,36)]);}
  if(k.every(68,50))k.aimed(k.ox,k.oy,7,3,.12,T.RICE,C.WHITE,null,{rows:3,speedStep:2.1});
  if(k.every(136,110))k.wander(36);
}
function overlappingCorridor(k: AttackKit){
  const spacing=44;
  if(k.every(14)){const row=k.t/14|0;
    for(let x=-176+(row%2?6:0);x<=176;x+=spacing)k.shot(x,-4,DOWN,2.5,T.NEEDLE,C.SKY,null,{silent:x>-170,safe:2304});
    echo(k,20,(k: AttackKit)=>{for(let x=-176+spacing/2;x<=176;x+=spacing)k.shot(x,-4,DOWN,2.1,T.NEEDLE,C.ROSE,null,{silent:true,safe:2304});});}
  if(k.every(80,40))k.aimed(k.ox,k.oy,3,2.9,.22,T.BALL,C.WHITE,null,{rows:2,speedStep:2});
}
function unheardNames(k: AttackKit){
  if(k.every(90)){const n=24,a=k.unit()*TAU;
    for(let i=0;i<n;i++)k.shot(k.ox,k.oy,a+i*TAU/n,2.6,T.AMULET,i%2?C.WHITE:C.SKY,[k.hold(30),k.wait(i*2),k.aimNow(2.9)],{silent:i>0});}
  if(k.every(45,20))k.ring(k.ox,k.oy,20,1.5,k.t*.07,T.BALL,C.BLUE);
  if(k.every(180,150))k.wander(40);
}
/** The voice meets the side wall and comes back across the hall; the echo
 * leaves a beat later toward the opposite wall. */
function wallOfEcho(k: AttackKit){
  const period=k.pick(64,52,46,40);
  if(k.every(period)){
    const wave=k.t/period|0,side=wave%2?1:-1,x=k.ox,y=k.oy,n=k.pick(5,7,9,11);
    k.fan(x,y,n,2.4,DOWN+side*1.15,.16,T.RICE,side<0?C.BLUE:C.SKY,[k.bounce(1,12)]);
    echo(k,22,(k: AttackKit)=>k.fan(x,y,n,2.4,DOWN-side*1.15,.16,T.RICE,side<0?C.SKY:C.BLUE,[k.bounce(1,12)]));
  }
  if(k.every(110,70))k.aimed(k.ox,k.oy,3,2.8,.2,T.AMULET,C.WHITE,null,{rows:2,speedStep:1.9});
  if(k.every(220,170))k.wander(40);
}

/** The voice is replayed: the Boss walks a slow loop leaving a still dot every
 * few frames, and after a breath the dots fall in the order they were left,
 * so the path it walked comes down as a slanted curtain. */
function replayedVoice(k: AttackKit,finishAt=Infinity){
  const a=k.t*.035;
  followVoicePath(k,'replayed',Math.sin(a)*90,92+Math.sin(a*2)*26,finishAt);
  if(k.every(k.pick(10,9,8,7))){
    const lean=Math.sin(k.t*.011)*.18;
    k.shot(k.ox,k.oy,DOWN,0,T.AMULET,(k.t/7|0)%2?C.SKY:C.WHITE,[k.wait(110),k.set(DOWN+lean,k.pick(1.6,1.8,1.9,2))],{silent:k.t%28!==0});
  }
  if(k.every(100,40)){const x=k.ox,y=k.oy;
    k.aimed(x,y,3,2.7,.2,T.RICE,C.ROSE,null,{rows:2,speedStep:1.8});}
}
replayedVoice.home={x:0,y:92};

/* ---- ten spell cards ---- */
/** 回声「迟到半拍之自我介绍」 */
function lateSelfIntroduction(k: AttackKit){
  const beat=30;
  if(k.every(beat)){const b=k.t/beat|0,a=b*.27,x=k.ox,y=k.oy;
    k.ring(x,y,32,2.2,a,T.BALL,C.BLUE);
    echo(k,15,(k: AttackKit)=>k.ring(-x,y,32,2,a+Math.PI/32,T.BALL,C.RED));}
  if(k.every(beat*3,beat)){const x=k.ox,y=k.oy,r=DOWN+(k.t/(beat*3)|0)*.4;
    burstShape(k,x,y,star(5,3,.45),2.6,r,T.SCALE,C.WHITE);
    echo(k,15,(k: AttackKit)=>burstShape(k,-x,y,star(5,3,.45),2.3,r+Math.PI/5,T.SCALE,C.SKY,null,{extra:{silent:true}}));}
  if(k.every(beat*4,beat*2))k.moveTo(-k.ox*.6+k.signed()*30,lerp(92,124,k.unit()),40);
}
lateSelfIntroduction.home={x:50,y:104};

/** 倒铃「自铃口归来之声」: rings of voices leave, turn back into the bell
 * mouth and turn out again askew. Now and then the bell tolls: a slow ring of
 * great beads, and its echo half a step round. */
function voiceFromBellMouth(k: AttackKit){
  if(k.every(34)){const wave=k.t/34|0;
    k.ring(k.ox,k.oy,34,3.3,wave*.23,T.SCALE,wave%2?C.ROSE:C.SKY,[k.stopTurn(36,Math.PI,2.2),k.wait(34),k.stopTurn(28,Math.PI+(wave%2?.4:-.4),2.5)]);}
  if(k.every(136,68)){const x=k.ox,y=k.oy,a=(k.t/136|0)*.31;
    k.ring(x,y,10,1.35,a,T.BIG,C8.WHITE);
    echo(k,16,(k: AttackKit)=>k.ring(x,y,10,1.2,a+Math.PI/10,T.BIG,C8.BLUE,null,{silent:true}));}
}
voiceFromBellMouth.home={x:0,y:120};

/** 回廊「唯静默可通之长廊」: dotted lanes of voices cross the hall in
 * alternating directions, slightly tilted so the lanes weave. Every lane
 * keeps one silence, and the silences are staggered from lane to lane.
 * A swaying fan from the Boss answers itself from the mirrored side. */
function silentCorridor(k: AttackKit){
  const rows=7,step=k.pick(18,16,15,14),speed=k.pick(1.5,1.65,1.8,1.9),cycle=k.pick(5,5,6,6);
  if(k.every(step)){
    const beat=k.t/step|0;
    for(let i=0;i<rows;i++){
      if((beat+i*3)%cycle===0)continue;
      const fromLeft=i%2===0,tilt=(i%4<2?1:-1)*.07;
      k.shot(fromLeft?-190:190,170+i*40,fromLeft?tilt:Math.PI-tilt,speed,T.RICE,i%2?C.ROSE:C.SKY,null,{silent:i>0||k.t%(step*3)!==0,safe:2304});
    }
  }
  if(k.every(96,48)){const a=DOWN+.45*Math.sin(k.t*.017),x=k.ox,y=k.oy;
    k.fan(x,y,5,2.6,a,.14,T.SCALE,C.WHITE,null,{rows:2,speedStep:1.9});
    echo(k,20,(k: AttackKit)=>k.fan(-x,y,5,2.4,Math.PI-a,.14,T.SCALE,C.SKY,null,{rows:2,speedStep:1.8}));}
}
silentCorridor.home={x:0,y:96};

/** 余响「远方迟来之钟」: slow bells drift down the hall. Each one rings
 * again and again as it falls, and every ring keeps a gap toward you; the
 * Boss's own bell answers with a gapped ring and its quieter echo. */
function farBells(k: AttackKit){
  const period=k.pick(290,250,220,200),pulse=k.pick(66,58,54,50),n=k.pick(8,10,12,12);
  if(k.every(period)){
    const x=lerp(-120,120,k.unit()),bells=k.fan(x,-6,k.pick(1,1,2,2),.9,DOWN,.8,T.BIG,C8.WHITE,[k.wait(5*pulse+12),k.vanish()],{safe:4096});
    for(let s=1;s<=5;s++)k.later(s*pulse,bells,b=>{
      const bx=b.x,by=b.y;k.ring(bx,by,n,1.3,k.unit()*TAU,T.BALL,s%2?C.BLUE:C.SKY,null,{silent:s%3!==1,safe:3600});
      if(s%2===0)echo(k,16,(k: AttackKit)=>k.ring(bx,by,n,1.0,k.unit()*TAU,T.BALL,C.WHITE,null,{silent:true,safe:3600}));
    });
  }
  if(k.every(110,60)){const x=k.ox,y=k.oy,count=k.pick(16,20,22,24);
    k.ringGap(x,y,count,1.9,T.AMULET,C.WHITE);
    echo(k,18,(k: AttackKit)=>k.ringGap(x,y,count,1.55,T.AMULET,C.SKY,null,{offset:Math.PI/count,silent:true}));}
  if(k.every(220,170))k.wander(40);
}
farBells.home={x:0,y:96};

/** 回环「回旋呼唤」: rings curl into tight spirals as they leave, and
 * the echo ring curls the other way through the gaps of the first. Between
 * them a four-petal call opens, and its echo opens between its petals. */
function windingCalls(k: AttackKit){
  const period=k.pick(58,46,40,36),n=k.pick(8,10,12,14);
  if(k.every(period)){
    const wave=k.t/period|0,w=(wave%2?1:-1)*.058,a=wave*.39,x=k.ox,y=k.oy;
    k.ring(x,y,n,1.15,a,T.BALL,wave%2?C.SKY:C.ROSE,[k.curve(w,110,.017)]);
    echo(k,18,(k: AttackKit)=>k.ring(x,y,n,1.0,a+Math.PI/n,T.BALL,C.WHITE,[k.curve(-w,110,.015)]));
  }
  if(k.every(96,48)){const x=k.ox,y=k.oy,r=(k.t/96|0)*.3;
    burstShape(k,x,y,rose(4,k.pick(32,36,40,44)),1.8,r,T.RICE,C.WHITE);
    echo(k,18,(k: AttackKit)=>burstShape(k,x,y,rose(4,k.pick(32,36,40,44)),1.6,r+Math.PI/4,T.RICE,C.SKY,null,{extra:{silent:true}}));}
}
windingCalls.home={x:0,y:104};

/** 镜声「与汝相反之回响」: the Boss drifts to the opposite side of the hall
 * from you and pours a sweeping curtain down; aimed fans arrive from both the
 * Boss and its mirror image. */
function mirroredVoice(k: AttackKit,finishAt=Infinity){
  const target=clamp(-k.px*.85,-140,140);
  followVoicePath(k,'mirrored',k.boss!.x+(target-k.boss!.x)*.045,96+10*Math.sin(k.t*.03),finishAt);
  if(k.every(9))k.shot(k.ox,k.oy,DOWN+Math.sin(k.t*.045)*.2,2.1,T.NEEDLE,C.SKY,null,{silent:k.t%27!==0});
  if(k.every(k.pick(100,88,80,74),30)){const x=k.ox,y=k.oy;
    k.aimed(x,y,k.pick(3,3,5,5),2.7,.15,T.RICE,C.WHITE,null,{rows:2,speedStep:1.8});
    echo(k,22,(k: AttackKit)=>k.aimed(-x,y,3,2.5,.15,T.RICE,C.ROSE,null,{rows:2,speedStep:1.7}));}
}
mirroredVoice.home={x:0,y:96};

/** 耐响「末次呼唤之六十余息」 (survival): six echoes of this hall, ten
 * seconds each, with a breath between them. */
function lastCallSixtyBreaths(k: AttackKit){
  const segment=Math.min(5,k.t/620|0),c=k.t%620;k.state.segment=segment;
  if(c>=590)return;
  const finishAt=k.t+590-c;
  if(segment===3)mirroredVoice(k,finishAt);
  else if(segment===5)replayedVoice(k,finishAt);
  else [silentCorridor,farBells,windingCalls,mirroredVoice,wallOfEcho,replayedVoice][segment](k);
}
lastCallSixtyBreaths.home={x:0,y:108};

/** 封名「旧册背面白纸花」: paper flowers open, stop and turn as they fold.
 * Petals shed from the Boss drift down in a ring, and their echo falls on
 * the mirrored side of the hall. */
function whitePaperFlowerOnBack(k: AttackKit){
  if(k.every(46)){const wave=k.t/46|0,dir=wave%2?1:-1;
    burstShape(k,k.ox,k.oy,rose(5,60),2.6,wave*.41,T.AMULET,wave%2?C.WHITE:C.ROSE,[k.wait(30),k.stopTurn(24,dir*2.2,2.1)]);}
  if(k.every(92,23)){const x=k.ox,y=k.oy,a=(k.t/92|0)*.37;
    k.ring(x,y,12,1.5,a,T.RICE,C.PINK,[k.accel(.018,100,DOWN)]);
    echo(k,20,(k: AttackKit)=>k.ring(-x,y,12,1.4,Math.PI-a,T.RICE,C.WHITE,[k.accel(.018,100,DOWN)],{silent:true}));}
}
whitePaperFlowerOnBack.home={x:0,y:112};

/** 耐响「末次呼唤之六十余息」 (survival): six echoes of the journey,
 * each a little quieter than the one before. */
/** 言灵「未出口之初名」: two voices circle the Boss and each rings with a
 * gap; a thread of stars spirals out between them. Now and then a triangle
 * of the unspoken name spreads, and its echo turned a sixth completes a
 * six-pointed star. */
function firstUnspokenName(k: AttackKit){
  const a1=k.t*.032,a2=a1+Math.PI-.7*Math.sin(k.t*.011);
  const p1={x:k.ox+Math.cos(a1)*70,y:k.oy+Math.sin(a1)*44},p2={x:k.ox+Math.cos(a2)*70,y:k.oy+Math.sin(a2)*44};
  if(k.every(26))k.ringGap(p1.x,p1.y,22,2.1,T.BALL,C.BLUE);
  if(k.every(26,13))k.ringGap(p2.x,p2.y,22,2.1,T.BALL,C.ROSE);
  if(k.every(6))k.shot(k.ox,k.oy,k.t*.09,1.8,T.STAR,C.WHITE,null,{silent:true});
  if(k.every(100,50)){const x=k.ox,y=k.oy,r=DOWN+(k.t/100|0)*.29;
    burstShape(k,x,y,polygon(3,9),2.2,r,T.SCALE,C.WHITE);
    echo(k,14,(k: AttackKit)=>burstShape(k,x,y,polygon(3,9),2,r+Math.PI/3,T.SCALE,C.SKY,null,{extra:{silent:true}}));}
}
firstUnspokenName.home={x:0,y:112};

/** 「愿旧名也有人轻轻应答」: six shapes and their echoes; the echo starts
 * opposed (half a turn away) and turns toward agreement as the card ends.
 * A ring of stars curls one way and its echo curls back the other. */
function mayOldNamesBeAnswered(k: AttackKit){
  const shape=Math.min(5,k.t/620|0),agreement=Math.min(1,k.t/3600),offset=Math.PI*(1-agreement);k.state.chapter=shape;
  const period=[44,40,40,36,42,34][shape];
  if(k.every(period)){
    const r=k.t*.009,x=k.ox,y=k.oy,outline=[polygon(4,14),star(5,6,.42),polygon(6,9),rose(5,48),star(8,4,.55),polygon(3,16)][shape];
    const colors=[[C.ORANGE,C.RED],[C.SKY,C.WHITE],[C.CYAN,C.GREEN],[C.MAGENTA,C.PALE],[C.GREEN,C.RED],[C.YELLOW,C.WHITE]][shape];
    burstShape(k,x,y,outline,2,r,T.AMULET,colors[0]);
    echo(k,14,(k: AttackKit)=>burstShape(k,x,y,outline,1.7,r+offset,T.AMULET,colors[1],null,{extra:{silent:true}}));
  }
  if(k.every(5))k.shot(k.ox,k.oy,k.t*.061,1.9,T.BALL,C.BLUE,null,{silent:true});
  if(k.every(140,70)){const x=k.ox,y=k.oy,a=k.t*.009;
    k.ring(x,y,12,1.6,a,T.STAR,C.WHITE,[k.curve(.006,110)]);
    echo(k,14,(k: AttackKit)=>k.ring(x,y,12,1.45,a+offset+Math.PI/12,T.STAR,C.YELLOW,[k.curve(-.006,110)],{silent:true}));}
}
mayOldNamesBeAnswered.home={x:0,y:110};

export const MIO: BossAttacks=Object.freeze({
  id:'mio',
  nonspells:[halfSpokenVoice,betweenTwoVoices,oldNameKnocks,wallOfEcho,halfAJoke,overlappingCorridor,replayedVoice,unheardNames].map(echoed),
  spells:[lateSelfIntroduction,voiceFromBellMouth,silentCorridor,farBells,windingCalls,mirroredVoice,
    whitePaperFlowerOnBack,lastCallSixtyBreaths,firstUnspokenName,mayOldNamesBeAnswered].map(echoed),
  midboss:{nonspell:null,spells:FUSAE.extraMidboss!},
});
