import type {AttackKit, BossAttacks} from '../danmaku.js';
﻿/** 白识言音 — Stage 6. Calls and answers: bells ring with a gap, households
 * reply, names are written and drip, and the last card returns every motif. */
import {T,C,C8,DOWN,TAU,clamp,lerp,wrap} from '../danmaku.js';
import {polygon,rose,inGap,burstShape} from './shapes.js';

/** Midboss: a trial call — triple bell rings with a gap, then white tags. */
function trialCall(k: AttackKit){
  const period=k.pick(56,44,38,32);
  if(k.every(period))k.ringGap(k.ox,k.oy,k.pick(14,18,22,26),2.4,T.BALL,C.YELLOW,null,{rows:k.pick(2,2,3,3),speedStep:1.5,offset:(k.t/period&1)*.12});
  if(k.every(90,45))k.aimed(k.ox,k.oy,k.pick(3,5,5,7),2.6,.17,T.AMULET,C.WHITE,null,{rows:2,speedStep:1.9});
  if(k.every(180,140))k.wander(40);
}

/** 名札「请在空白处写上名字」: the god writes strokes of white tags across
 * the sky; each stroke rests, then drips down as a curtain of its own shape. */
function writeANameHere(k: AttackKit){
  const period=k.pick(64,50,43,37);
  if(k.every(period)){
    const m=k.pick(10,13,15,17),x0=lerp(-150,150,k.unit()),y0=lerp(40,120,k.unit());
    const dir=k.unit()*TAU,bend=k.signed()*.012,length=lerp(130,200,k.unit());
    let x=x0,y=y0,a=dir;
    for(let i=0;i<m;i++){
      x=clamp(x+Math.cos(a)*length/m,-180,180);y=clamp(y+Math.sin(a)*length/m,24,190);a+=bend*length/m;
      k.shot(k.ox,k.oy,0,0,T.AMULET,i%3?C.WHITE:C.PALE,[k.goTo(x,y,30),k.wait(40-i),k.set(DOWN+(k.unit()-.5)*.25,lerp(1.3,1.7,k.unit()))],{silent:i>0});
    }
  }
  if(k.rank>=1&&k.every(k.pick(120,96,84,72),30))k.ringGap(k.ox,k.oy,k.pick(14,18,22,26),2,T.BALL,C.YELLOW);
}
writeANameHere.home={x:0,y:96};

/** Nonspell 1: the first call — two bells sway alternately and each rings
 * a wide half circle toward the ground. */
function firstCalling(k: AttackKit){
  const period=k.pick(30,23,20,17);
  if(k.every(period)){
    const beat=k.t/period|0,side=beat%2?1:-1,n=k.pick(10,13,16,17),sway=Math.sin(beat*.7)*.35;
    k.fan(k.ox+side*54,k.oy+6,n,2.1,DOWN+sway,Math.PI/(n-1),T.BALL,side<0?C.YELLOW:C.ORANGE,null,{rows:k.rank>=2?2:1,speedStep:1.55});
  }
  if(k.every(120,60))k.aimed(k.ox,k.oy,3,2.9,.15,T.STAR,C.PALE,null,{rows:k.pick(1,2,3,3),speedStep:2.1});
  if(k.every(240,210))k.wander(40);
}

/** Nonspell 2: mint voiceprints — three wavering streams draw sine waves. */
function mintVoiceprint(k: AttackKit){
  if(k.every(k.pick(4,3,2,2))){
    const arms=k.pick(3,3,4,5),wave=.62*Math.sin(k.t*.075);
    for(let j=0;j<arms;j++)k.shot(k.ox,k.oy,k.t*.006+j*TAU/arms+wave,2.2,T.RICE,j%2?C.MINT:C.WHITE,null,{silent:j>0||k.t%8!==0});
  }
  if(k.every(84,40))k.ringGap(k.ox,k.oy,k.pick(14,18,22,26),1.7,T.BALL,C.YELLOW);
}

/** Nonspell 4: silent answers — a ring stops in mid-air; its bullets answer
 * one after another around the circle, so the restart sweeps like a hand. */
function silentAnswer(k: AttackKit){
  const period=k.pick(70,54,46,40);
  if(k.every(period)){
    const n=k.pick(16,22,26,30),a=k.unit()*TAU,dir=(k.t/period|0)%2?1:-1;
    for(let i=0;i<n;i++){const angle=a+dir*i*TAU/n;
      k.shot(k.ox,k.oy,angle,2.6,T.BALL,C.YELLOW,[k.hold(30),k.wait(4+Math.round(i*40/n)),k.set(angle,2)],{silent:i>0});}
  }
  if(k.every(120,90))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),3,.17,T.STAR,C.WHITE,null,{rows:2,speedStep:2.2});
  if(k.every(period*3,period*2))k.wander(40);
}

/** Nonspell 5: before the last page — golden roses bloom in turn while a
 * white tag ring keeps one gap toward the player. */
function beforeTheLastPage(k: AttackKit){
  const period=k.pick(74,58,48,42);
  if(k.every(period)){const wave=k.t/period|0;
    burstShape(k,k.ox,k.oy,rose(k.pick(4,5,5,6),k.pick(28,36,44,50)),2.3,wave*.37,T.STAR,wave%2?C.YELLOW:C.ORANGE);}
  if(k.every(period,period/2|0))k.ringGap(k.ox,k.oy,k.pick(16,22,26,30),1.7,T.AMULET,C.WHITE);
  if(k.every(period*3,period*2))k.wander(40);
}

/** 名符「无人再唤之白纸神」: three paper familiars circle the god; each
 * releases rings of blank paper, gaps toward the player, that bend
 * alternately in wide arcs all the way down to the player's height. */
function paperGodUncalled(k: AttackKit){
  const period=k.pick(38,29,25,21),a0=k.t*.012;
  if(k.every(period)){
    const wave=k.t/period|0;
    for(let j=0;j<3;j++){
      const a=a0+j*TAU/3,x=k.ox+Math.cos(a)*58,y=k.oy+Math.sin(a)*40,dir=(j+wave)%2?1:-1;
      k.ringGap(x,y,k.pick(10,13,16,19),1.75,T.AMULET,j===1?C.PALE:C.WHITE,[k.curve(dir*.0085,160)],{silent:j>0});
    }
  }
}
paperGodUncalled.home={x:0,y:112};

/** 铃名「千户应答之金色声纹」: on every beat the god calls with a golden
 * ring; houses on both banks answer in turn with aimed replies. */
function thousandHouseholdsAnswer(k: AttackKit){
  const beat=k.pick(42,34,29,25),b=k.t/beat|0,c=k.t%beat;
  if(c===0)k.ringGap(k.ox,k.oy,k.pick(18,24,30,34),2,T.BALL,b%2?C.YELLOW:C.ORANGE,null,{offset:(b%2)*.08});
  if(c===(beat>>1)){
    const house=b%4,y=70+house*52;
    for(const side of[-1,1])k.aimed(side*182,y,k.pick(1,3,3,3),2.5,.17,T.RICE,C.WHITE,null,{rows:k.pick(1,2,3,3),speedStep:1.8,silent:side>0,safe:2304});
  }
  if(k.rank>=2&&c===(beat>>2))k.ring(k.ox,k.oy,12,1.4,b*.4,T.STAR,C.PALE);
}
thousandHouseholdsAnswer.home={x:0,y:104};

/** 归名「生者旧称之错列」: warm living names fall one way, cold old names
 * the other, crossing into a moving lattice; every few seconds the rows pause
 * for a breath and then swap directions. In each breath the Boss opens a
 * six-petal flower, warm and cold petals in turn; halfway through the rows
 * she sends a ring of name slips with one slip pointed at the player. */
function livingAndOldNames(k: AttackKit){
  const period=k.pick(28,23,20,17),spacing=k.pick(68,60,54,50),swap=(k.t/300|0)%2?-1:1;
  if(k.every(period)&&k.t%300<270){
    const row=k.t/period|0,shift=(row%2)*spacing/2;
    for(let x=-184+shift;x<=184;x+=spacing){
      k.shot(x,-4,DOWN-swap*.42,1.55,T.BALL,C.ORANGE,[k.wrapX(1)],{silent:x>-184+shift,safe:2304});
      k.shot(x+spacing/4,-4,DOWN+swap*.42,1.55,T.BALL,C.SKY,[k.wrapX(1)],{silent:true,safe:2304});
    }
  }
  if(k.every(300,272)){const petal=TAU/6;
    burstShape(k,k.ox,k.oy,rose(6,k.pick(36,48,60,72)),1.7,(k.t/300|0)*petal/2,T.RICE,C.ORANGE,null,
      {colorOf:(i,p)=>Math.round(p.angle/petal)%2?C.SKY:C.ORANGE});}
  if(k.every(300,135))k.ring(k.ox,k.oy,k.pick(10,12,14,16),1.35,k.aim(),T.AMULET,C.PALE,null,{rows:k.pick(1,2,2,3),speedStep:1.1});
}
livingAndOldNames.home={x:0,y:92};

/** Directions from (ox, oy) to points around the playfield edge. Amulets fired along
 * them stay at most 8 px apart until they leave the screen, and the hitbox needs
 * more than 8.2 px to pass between two of them. */
function fenceAngles(ox: number,oy: number){
  const out: number[]=[],toward=(x: number,y: number)=>out.push(Math.atan2(y-oy,x-ox));
  for(let y=-2;y<442;y+=8)toward(186,y);
  for(let x=186;x>-186;x-=8)toward(x,442);
  for(let y=442;y>-2;y-=8)toward(-186,y);
  for(let x=-186;x<186;x+=8)toward(x,-2);
  return out;
}

/** 神名「忘却亦不可及之庭」 (survival): fences of white paper spread from the
 * Boss one after another. Of six gates in the lower garden one stands open between
 * two golden posts; the other five are sealed with gold stars that break into
 * sparks halfway out. From fence to fence the open gate stays or moves to a
 * neighbour. As the card goes on the fences come closer together, the gates
 * narrow, the open gate rests less often and the seals throw more sparks. */
function gardenBeyondForgetting(k: AttackKit){
  if(k.t<(k.state.nextAt??0))return;
  // Fences fired after about 27 seconds no longer reach the player before time runs out.
  const ramp=(a: number,b: number)=>lerp(a,b,Math.min(1,k.t/1650));
  k.state.nextAt=k.t+Math.round(ramp(k.pick(100,84,72,64),k.pick(72,58,48,42)));
  const door=k.state.door,half=ramp(k.pick(.23,.2,.18,.16),k.pick(.19,.16,.14,.12)),gate=(g: number)=>DOWN+(g-2.5)*.2;
  const stay=k.unit()<ramp(k.pick(.5,.4,.3,.2),k.pick(.3,.2,.1,0));
  k.state.door=door===undefined?(k.unit()<.5?2:3):stay?door:door===0?1:door===5?4:door+(k.unit()<.5?-1:1);
  const open=gate(k.state.door),seals=[0,1,2,3,4,5].filter(g=>g!==k.state.door).map(gate);
  let first=true;
  for(const a of fenceAngles(k.ox,k.oy)){
    if(inGap(a,open,half))continue;
    k.shot(k.ox,k.oy,a,2,T.AMULET,C.WHITE,null,{silent:!first});first=false;
  }
  const sealed=seals.flatMap(a=>k.shot(k.ox,k.oy,a,2,T.BIGSTAR,C8.YELLOW,null,{silent:true}));
  const sparks=Math.round(ramp(k.pick(2,3,4,4),k.pick(4,5,6,8)));
  k.later(Math.round(80/k.sp),sealed,b=>k.ring(b.x,b.y,sparks,1.3,k.unit()*TAU,T.RICE,C.YELLOW));
  for(const side of[-1,1])k.laser(k.ox,k.oy,open+side*half,2,30,{width:8,color:C.YELLOW,sound:side>0?-1:18});
}
gardenBeyondForgetting.home={x:0,y:84};

/** 「将每一个名字写回幻想乡」: a golden name-rose blooms throughout; every
 * ten seconds a different journey motif returns beside it — lantern doors,
 * rain letters, returning boats, crossed chains, page rows and bells. */
function writeBackEveryName(k: AttackKit){
  const chapter=Math.min(5,k.t/600|0),c=k.t%600;k.state.chapter=chapter;
  const roseEvery=k.pick(84,66,56,48);
  if(k.every(roseEvery))burstShape(k,k.ox,k.oy,rose(5,k.pick(30,40,48,56)),2,k.t*.006,T.STAR,(k.t/roseEvery|0)%2?C.YELLOW:C.PALE);
  if(chapter===0&&c%k.pick(66,52,44,38)===0){
    const door=k.aim(),halfDoor=k.pick(.34,.27,.23,.2);
    burstShape(k,k.ox,k.oy,polygon(4,k.pick(9,12,14,16)),1.55,c*.011,T.AMULET,C.ORANGE,null,{skip:(p,a)=>inGap(a,door,halfDoor)});
  }else if(chapter===1){
    if(c%k.pick(6,4,3,3)===0)k.shot(lerp(-186,186,k.unit()),-6,DOWN+.1,lerp(2.3,3.1,k.unit()),T.NEEDLE,C.SKY,null,{safe:2304,silent:true});
    if(c%k.pick(90,72,60,52)===0){const letters=k.fan(k.ox,k.oy,4,2.6,DOWN,.42,T.AMULET,C.WHITE,[k.hold(46),k.wait(22),k.vanish()]);
      k.later(60,letters,b=>k.ring(b.x,b.y,k.pick(8,10,12,14),1.5,k.unit()*TAU,T.BALL,C.AZURE,null,{silent:true}));}
  }else if(chapter===2&&c%k.pick(78,60,50,44)===0){
    k.ring(k.ox,k.oy,k.pick(18,24,30,34),3.2,c*.2,T.OVAL,C8.CYAN,[k.stopTurn(50,Math.PI,1.6)]);
  }else if(chapter===3&&c%k.pick(8,6,5,4)===0){
    const a=c*.031;for(let j=0;j<3;j++){k.shot(k.ox,k.oy,a+j*TAU/3,1.9,T.BALL,C.PINK,null,{silent:j>0});k.shot(k.ox,k.oy,-a+j*TAU/3+Math.PI/3,1.7,T.BALL,C.SKY,null,{silent:true});}
  }else if(chapter===4&&c%k.pick(34,28,24,21)===0){
    const spacing=k.pick(34,30,28,26),cells=Math.floor(368/spacing)+1;
    k.state.blank=clamp((k.state.blank??cells>>1)+(k.unit()<.5?-1:1),2,cells-3);
    for(let i=0;i<cells;i++)if(Math.abs(i-k.state.blank)>k.pick(2,1,1,1))k.shot(-184+i*spacing,-4,DOWN,1.7,T.AMULET,C.PALE,null,{silent:i>0,safe:2304});
  }else if(chapter===5&&c%k.pick(52,42,36,31)===0){
    k.ringGap(k.ox,k.oy,k.pick(16,22,26,30),2.3,T.BALL,C.YELLOW,null,{rows:3,speedStep:1.4});
  }
}
writeBackEveryName.home={x:0,y:104};

export const KOTONE: BossAttacks=Object.freeze({
  id:'kotone',
  nonspells:[firstCalling,mintVoiceprint,silentAnswer,beforeTheLastPage],
  spells:[paperGodUncalled,thousandHouseholdsAnswer,livingAndOldNames,gardenBeyondForgetting,writeBackEveryName],
  midboss:{nonspell:trialCall,spells:[writeANameHere]},
});
