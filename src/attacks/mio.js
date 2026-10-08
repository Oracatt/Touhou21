/** 玉继未央 — Extra. Every attack has an echo: a delayed, mirrored or
 * reversed copy. The original teaches the shape; the echo tests the timing. */
import {T,C,C8,DOWN,TAU,clamp,lerp,wrap} from '../danmaku.js';
import {polygon,star,rose,inGap,burstShape} from './shapes.js';
import {FUSAE} from './fusae.js';

/** Queue an echo `delay` frames later; `fire(k)` runs at that time. */
function echo(k,delay,fire){(k.state.echoes??=[]).push({at:k.t+delay,fire});}
function runEchoes(k){
  const queue=k.state.echoes;if(!queue?.length)return;
  for(let i=0;i<queue.length;){if(queue[i].at===k.t){const e=queue.splice(i,1)[0];e.fire(k);}else i++;}
}
const echoed=attack=>{const run=k=>{runEchoes(k);attack(k);};Object.defineProperty(run,'name',{value:attack.name});if(attack.home)run.home=attack.home;return run;};

/* ---- ten nonspells ---- */
function halfSpokenVoice(k){
  if(k.every(46)){const aim=k.aim(),x=k.ox,y=k.oy;
    k.fan(x,y,7,3.1,aim,.13,T.RICE,C.BLUE,null,{rows:2,speedStep:2.3});
    echo(k,18,k=>k.fan(-x,y,7,2.7,Math.atan2(k.py-y,k.px+x),.13,T.RICE,C.SKY,null,{rows:2,speedStep:2}));}
  if(k.every(92,60))k.ringGap(k.ox,k.oy,28,1.8,T.BALL,C.WHITE);
  if(k.every(184,150))k.wander(40);
}
function lateResponse(k){
  if(k.every(40)){const a=k.unit()*TAU,x=k.ox,y=k.oy;k.ring(x,y,28,2.3,a,T.BALL,C.BLUE);
    echo(k,14,k=>k.ring(x,y,28,1.85,a+Math.PI/28,T.BALL,C.WHITE));}
  if(k.every(120,80))k.aimed(k.ox,k.oy,5,3,.15,T.SCALE,C.RED,null,{rows:3,speedStep:2.1});
  if(k.every(160,130))k.wander(40);
}
function reversedTail(k){
  if(k.every(36)){const wave=k.t/36|0;k.ring(k.ox,k.oy,30,3,wave*.19,T.SCALE,wave%2?C.SKY:C.BLUE,[k.stopTurn(44,Math.PI,1.8)]);}
  if(k.every(108,70))k.aimed(k.ox,k.oy,3,3.2,.2,T.RICE,C.RED,null,{rows:3,speedStep:2.2});
  if(k.every(216,180))k.wander(40);
}
function betweenTwoVoices(k){
  if(k.every(3)){const a=k.t*.052;
    for(const side of[-1,1])for(let j=0;j<2;j++)k.shot(k.ox+side*68,k.oy,side*a+j*Math.PI,2.1,T.BALL,side<0?C.BLUE:C.ROSE,null,{silent:side>0||j>0||k.t%9!==0});}
  if(k.every(100,50))k.aimed(k.ox,k.oy,5,2.8,.14,T.AMULET,C.WHITE,null,{rows:2,speedStep:2});
}
function oldNameKnocks(k){
  const c=k.t%72;
  if(c<24&&c%8===0)k.aimed(k.ox,k.oy,3,3.4,.11,T.SCALE,C.RED,null,{rows:3,speedStep:2.4,offset:(c/8-1)*.09});
  if(c===40)k.ringGap(k.ox,k.oy,36,2.1,T.BALL,C.BLUE,null,{rows:2,speedStep:1.5});
  if(c===60&&(k.t/72|0)%2)k.wander(36);
}
function halfAJoke(k){
  if(k.every(34)){const wave=k.t/34|0,w=(wave%2?1:-1)*.024;
    k.ring(k.ox,k.oy,22,2,wave*.31,T.BUTTERFLY,wave%2?C8.RED:C8.BLUE,[k.curve(w,18),k.curve(-w,36),k.curve(w,36),k.curve(-w,36),k.curve(w,36)]);}
  if(k.every(68,50))k.aimed(k.ox,k.oy,7,3,.12,T.RICE,C.WHITE,null,{rows:3,speedStep:2.1});
  if(k.every(136,110))k.wander(36);
}
function overlappingCorridor(k){
  const spacing=44;
  if(k.every(14)){const row=k.t/14|0;
    for(let x=-176+(row%2?6:0);x<=176;x+=spacing)k.shot(x,-4,DOWN,2.5,T.NEEDLE,C.SKY,null,{silent:x>-170,safe:2304});
    echo(k,20,k=>{for(let x=-176+spacing/2;x<=176;x+=spacing)k.shot(x,-4,DOWN,2.1,T.NEEDLE,C.ROSE,null,{silent:true,safe:2304});});}
  if(k.every(80,40))k.aimed(k.ox,k.oy,3,2.9,.22,T.BALL,C.WHITE,null,{rows:2,speedStep:2});
}
function unheardNames(k){
  if(k.every(90)){const n=24,a=k.unit()*TAU;
    for(let i=0;i<n;i++)k.shot(k.ox,k.oy,a+i*TAU/n,2.6,T.AMULET,i%2?C.WHITE:C.SKY,[k.hold(30),k.wait(i*2),k.aimNow(2.9)],{silent:i>0});}
  if(k.every(45,20))k.ring(k.ox,k.oy,20,1.5,k.t*.07,T.BALL,C.BLUE);
  if(k.every(180,150))k.wander(40);
}
function laughterAfterBell(k){
  if(k.every(3)){const a=-DOWN+(k.unit()-.5)*2.6;k.shot(k.ox,k.oy,a,lerp(2.2,3.4,k.unit()),T.STAR,k.t%2?C.ROSE:C.WHITE,[k.accel(.045,220,DOWN)],{silent:k.t%12!==0});}
  if(k.every(70,35))k.ringGap(k.ox,k.oy,30,2,T.BALL,C.BLUE,null,{rows:2,speedStep:1.5});
}
function speakingAgain(k){
  if(k.every(32)){const a=k.aim(),x=k.ox,y=k.oy;k.ringGap(x,y,32,2.2,T.BALL,C.BLUE);
    echo(k,16,k=>k.ring(-x,y,32,1.8,Math.atan2(k.py-y,k.px+x)+Math.PI/32,T.BALL,C.ROSE));}
  if(k.every(5))k.shot(k.ox,k.oy,k.t*.07,2.3,T.RICE,C.WHITE,null,{silent:true});
  if(k.every(120,90))k.wander(40);
}

/* ---- ten spell cards ---- */
/** 回声「迟到半拍的自我介绍」 */
function lateSelfIntroduction(k){
  const beat=30;
  if(k.every(beat)){const b=k.t/beat|0,a=b*.27,x=k.ox,y=k.oy;
    k.ring(x,y,32,2.2,a,T.BALL,C.BLUE);
    echo(k,15,k=>k.ring(-x,y,32,2,a+Math.PI/32,T.BALL,C.RED));}
  if(k.every(beat*3,beat)){const aim=k.aim();k.fan(k.ox,k.oy,5,3.2,aim,.1,T.SCALE,C.WHITE,null,{rows:3,speedStep:2.3});
    echo(k,15,k=>k.fan(k.ox,k.oy,5,3,aim,.1,T.SCALE,C.SKY,null,{rows:3,speedStep:2.1}));}
  if(k.every(beat*4,beat*2))k.moveTo(-k.ox*.6+k.signed()*30,lerp(92,124,k.unit()),40);
}
lateSelfIntroduction.home={x:50,y:104};

/** 倒铃「从铃口归来的声音」 */
function voiceFromBellMouth(k){
  if(k.every(34)){const wave=k.t/34|0;
    k.ring(k.ox,k.oy,34,3.3,wave*.23,T.SCALE,wave%2?C.ROSE:C.SKY,[k.stopTurn(36,Math.PI,2.2),k.wait(34),k.stopTurn(28,Math.PI+(wave%2?.4:-.4),2.5)]);}
  if(k.every(136,68))k.aimed(k.ox,k.oy,5,2.6,.2,T.BIG,C8.WHITE);
}
voiceFromBellMouth.home={x:0,y:120};

/** 旧名「无人居住的门牌街」 */
function uninhabitedNameplateStreet(k){
  if(k.every(38)){const wave=k.t/38|0,rotation=wave*.37,door=k.aim(),x=k.ox,y=k.oy;
    burstShape(k,x,y,polygon(4,17),1.65,rotation,T.AMULET,C.SKY,null,{skip:(p,a)=>inGap(a,door,.2)});
    echo(k,16,k=>{const late=Math.atan2(k.py-y,k.px-x);burstShape(k,x,y,polygon(4,13),1.25,rotation+Math.PI/4,T.AMULET,C.BLUE,null,{skip:(p,a)=>inGap(a,late,.23)});});}
  if(k.every(120,60))for(const side of[-1,1])k.aimed(k.ox+side*46,k.oy,1,2.4,0,T.ORB,C8.CYAN,null,{rows:3,speedStep:1.7});
}
uninhabitedNameplateStreet.home={x:0,y:104};

/** 复雨「同一封信的两个昨日」 */
function twoYesterdaysOfALetter(k){
  if(k.every(2))k.shot(lerp(-186,186,k.unit()),-6,DOWN+.06*Math.sin(k.t*.01),lerp(2.4,3.3,k.unit()),T.NEEDLE,C.SKY,null,{safe:2304,silent:true});
  if(k.every(7))k.shot(lerp(-186,186,k.unit()),446,-DOWN+.05*Math.sin(k.t*.013),lerp(1.2,1.7,k.unit()),T.NEEDLE,C.ROSE,null,{safe:4096,silent:true});
  if(k.every(60)){const letters=k.aimed(k.ox,k.oy,5,3.1,.3,T.AMULET,C.WHITE,[k.hold(46),k.wait(22),k.vanish()]);
    k.later(60,letters,b=>k.ring(b.x,b.y,12,1.55,k.unit()*TAU,T.BALL,C.BLUE,null,{silent:true}));}
}
twoYesterdaysOfALetter.home={x:0,y:108};

/** 彼岸声「错过末班船的呼唤」 */
function missedLastFerry(k){
  if(k.every(19)){const wave=k.t/19|0,side=wave%2?1:-1,y=[46,96,146,96][(wave>>1)%4];
    k.fan(side*186,y,12,2.15,side<0?.32:Math.PI-.32,.13,T.AMULET,side<0?C.SKY:C.WHITE,[k.curve(-side*.0058,130)],{safe:2304});}
  if(k.every(64,30)){const wave=k.t/64|0;k.ring(k.ox,k.oy,26,3,wave*.2,T.OVAL,C8.BLUE,[k.stopTurn(52,Math.PI,1.45)]);}
}
missedLastFerry.home={x:0,y:100};

/** 结声「说不尽的八重尾音」 */
function endlessEightfoldNote(k){
  const cycle=300,c=k.t%cycle,round=k.t/cycle|0;
  if(c===0)for(let j=0;j<8;j++)k.beam(k.ox,k.oy,round*Math.PI/8+j*Math.PI/4,{width:9,delay:60,grow:12,sustain:200,shrink:14,color:C.ROSE,angular:(round%2?1:-1)*.0028,sound:j?-1:26});
  if(k.every(4)){const a=k.t*.029;for(let j=0;j<3;j++){
    k.shot(k.ox,k.oy,a+j*TAU/3,1.9,T.BALL,C.SKY,null,{silent:j>0||k.t%12!==0});k.shot(k.ox,k.oy,-a+j*TAU/3+Math.PI/3,1.65,T.BALL,C.WHITE,null,{silent:true});}}
}
endlessEightfoldNote.home={x:0,y:116};

/** 封名「旧册背面的白纸花」 */
function whitePaperFlowerOnBack(k){
  if(k.every(46)){const wave=k.t/46|0,dir=wave%2?1:-1;
    burstShape(k,k.ox,k.oy,rose(5,60),2.6,wave*.41,T.AMULET,wave%2?C.WHITE:C.ROSE,[k.wait(30),k.stopTurn(24,dir*2.2,2.1)]);}
  if(k.every(92,46))k.aimed(k.ox,k.oy,3,3,.12,T.NEEDLE,C.SKY,null,{rows:4,speedStep:2});
}
whitePaperFlowerOnBack.home={x:0,y:112};

/** 耐响「最后一次呼唤的六十余息」 (survival): six echoes of the journey,
 * each a little quieter than the one before. */
function lastCallSixtyBreaths(k){
  const segment=Math.min(5,k.t/620|0),c=k.t%620,ease=1+segment*.12;k.state.segment=segment;
  if(c>=590)return;
  if(segment===0&&c%Math.round(36*ease)===0){const door=k.aim();burstShape(k,k.ox,k.oy,polygon(4,16),1.6,c*.012,T.AMULET,C.ORANGE,null,{skip:(p,a)=>inGap(a,door,.21)});}
  else if(segment===1){if(c%2===0)k.shot(lerp(-186,186,k.unit()),-6,DOWN+.08,lerp(2.4,3.1,k.unit()),T.NEEDLE,C.SKY,null,{safe:2304,silent:true});
    if(c%Math.round(60*ease)===0){const l=k.aimed(k.ox,k.oy,5,3,.3,T.AMULET,C.WHITE,[k.hold(46),k.wait(22),k.vanish()]);k.later(60,l,b=>k.ring(b.x,b.y,12,1.5,k.unit()*TAU,T.BALL,C.AZURE,null,{silent:true}));}}
  else if(segment===2&&c%Math.round(42*ease)===0)k.ring(k.ox,k.oy,32,3.2,c*.2,T.OVAL,C8.CYAN,[k.stopTurn(50,Math.PI,1.6)]);
  else if(segment===3){if(c%300===0&&c<560)for(let j=0;j<8;j++)k.beam(k.ox,k.oy,j*Math.PI/4+Math.PI/8,{width:9,delay:60,sustain:200,color:C.PALE,angular:c?-.0026:.0026,sound:j?-1:26});
    if(c>=60&&c%Math.round(30*ease)===0)k.ring(k.ox,k.oy,36,1.25,c*.13,T.BALL,C.MAGENTA);}
  else if(segment===4&&c%Math.round(20*ease)===0){const cells=14;k.state.blank=clamp((k.state.blank??7)+(k.unit()<.5?-1:1),2,cells-3);
    for(let i=0;i<cells;i++)if(Math.abs(i-k.state.blank)>1)k.shot(-182+i*28,-4,DOWN,1.7,T.AMULET,C.PALE,null,{silent:i>0,safe:2304});}
  else if(segment===5&&c%Math.round(34*ease)===0)k.ringGap(k.ox,k.oy,28,2.2,T.BALL,C.YELLOW,null,{rows:3,speedStep:1.4});
}
lastCallSixtyBreaths.home={x:0,y:108};

/** 言灵「没有说出口的第一个名字」 */
function firstUnspokenName(k){
  const a1=k.t*.032,a2=a1+Math.PI-.7*Math.sin(k.t*.011);
  const p1={x:k.ox+Math.cos(a1)*70,y:k.oy+Math.sin(a1)*44},p2={x:k.ox+Math.cos(a2)*70,y:k.oy+Math.sin(a2)*44};
  if(k.every(26))k.ringGap(p1.x,p1.y,22,2.1,T.BALL,C.BLUE);
  if(k.every(26,13))k.ringGap(p2.x,p2.y,22,2.1,T.BALL,C.ROSE);
  if(k.every(6))k.shot(k.ox,k.oy,k.t*.09,1.8,T.STAR,C.WHITE,null,{silent:true});
  if(k.every(100,50))k.aimed(k.ox,k.oy,5,3,.14,T.SCALE,C.WHITE,null,{rows:3,speedStep:2.1});
}
firstUnspokenName.home={x:0,y:112};

/** 「愿旧名也有人轻轻应答」: six shapes and their echoes; the echo starts
 * opposed (half a turn away) and turns toward agreement as the card ends. */
function mayOldNamesBeAnswered(k){
  const shape=Math.min(5,k.t/620|0),agreement=Math.min(1,k.t/3600),offset=Math.PI*(1-agreement);k.state.chapter=shape;
  const period=[44,40,40,36,42,34][shape];
  if(k.every(period)){
    const r=k.t*.009,x=k.ox,y=k.oy,outline=[polygon(4,14),star(5,6,.42),polygon(6,9),rose(5,48),star(8,4,.55),polygon(3,16)][shape];
    const colors=[[C.ORANGE,C.RED],[C.SKY,C.WHITE],[C.CYAN,C.GREEN],[C.MAGENTA,C.PALE],[C.GREEN,C.RED],[C.YELLOW,C.WHITE]][shape];
    burstShape(k,x,y,outline,2,r,T.AMULET,colors[0]);
    echo(k,14,k=>burstShape(k,x,y,outline,1.7,r+offset,T.AMULET,colors[1],null,{extra:{silent:true}}));
  }
  if(k.every(5))k.shot(k.ox,k.oy,k.t*.061,1.9,T.BALL,C.BLUE,null,{silent:true});
  if(k.every(140,70))k.aimed(k.ox,k.oy,5,2.9,.13,T.STAR,C.WHITE,null,{rows:3,speedStep:2});
}
mayOldNamesBeAnswered.home={x:0,y:110};

export const MIO=Object.freeze({
  id:'mio',
  nonspells:[halfSpokenVoice,lateResponse,reversedTail,betweenTwoVoices,oldNameKnocks,halfAJoke,
    overlappingCorridor,unheardNames,laughterAfterBell,speakingAgain].map(echoed),
  spells:[lateSelfIntroduction,voiceFromBellMouth,uninhabitedNameplateStreet,twoYesterdaysOfALetter,missedLastFerry,
    endlessEightfoldNote,whitePaperFlowerOnBack,lastCallSixtyBreaths,firstUnspokenName,mayOldNamesBeAnswered].map(echoed),
  midboss:{nonspell:null,spells:FUSAE.extraMidboss},
});
