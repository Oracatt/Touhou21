/** Original campaign attack choreography. The field owns movement, birth mist,
 * collision, grazing, bounds and cancellation; this module only authors shots. */
import {touhouBulletCommand,touhouCurveSample} from '@ts-stg/thlib/touhou';

const TAU=Math.PI*2;
const birth=touhouBulletCommand(1,{ints:[0]});
const turn=(angle,speed,duration=48,mode=0,count=1)=>touhouBulletCommand(4,{floats:[angle,speed,0],ints:[duration,count,mode]});
const curve=(angular,duration=90,acceleration=0)=>touhouBulletCommand(3,{floats:[acceleration,angular],ints:[duration]});
const accelerate=(acceleration,duration=90)=>touhouBulletCommand(3,{floats:[acceleration,0],ints:[duration]});
const bounce=(count=1)=>touhouBulletCommand(6,{floats:[-999,384,448],ints:[count,12]});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export const DIFFICULTY_PROFILES=Object.freeze([
  Object.freeze({density:.68,speed:.82,interval:1.24,rank:0}),
  Object.freeze({density:1,speed:1,interval:1,rank:1}),
  Object.freeze({density:1.3,speed:1.17,interval:.85,rank:2}),
  Object.freeze({density:1.65,speed:1.32,interval:.74,rank:3}),
  Object.freeze({density:1.45,speed:1.16,interval:.82,rank:4}),
]);

function attackContext(game,boss,frame,difficulty,state){
  const d=DIFFICULTY_PROFILES[difficulty]??DIFFICULTY_PROFILES[1];
  let shotSoundPlayed=false;
  const every=period=>frame%Math.max(5,Math.round(period*d.interval))===0;
  const n=(base,min=3)=>Math.max(min,Math.round(base*d.density));
  const shoot=(x,y,angle,speed,type=0,color=1,commands=[])=>{
    const shotSound=shotSoundPlayed?-1:21;shotSoundPlayed=true;
    return game.bullets.emit({x,y,angle,speed:speed*d.speed,type,color,pattern:1,count:1,shotSound,
      minimumPlayerDistanceSquared:1024,commands:[birth,...commands]});
  };
  const ring=(x,y,count,speed,angle=0,type=0,color=1,commands=[])=>game.bullets.emit({x,y,angle,speed:speed*d.speed,type,color,
    pattern:3,count:n(count),shotSound:21,minimumPlayerDistanceSquared:1024,commands:[birth,...commands]});
  const fan=(x,y,count,speed,angle=aim(x,y),spread=.12,type=0,color=1,commands=[])=>game.bullets.emit({x,y,angle,angleStep:spread,
    speed:speed*d.speed,type,color,pattern:1,count:n(count),shotSound:21,minimumPlayerDistanceSquared:1024,commands:[birth,...commands]});
  const aim=(x=boss.x,y=boss.y)=>Math.atan2(game.player.y-y,game.player.x-x);
  const beam=(x,y,angle,{width=8,delay=60,sustain=100,color=6,angular=0}={})=>game.lasers.spawnInfinite({x,y,angle,width,
    length:600,color,type:0,delay,grow:20,sustain,shrink:24,angularVelocity:angular,sound:26});
  const ribbon=(x,y,angle,angular,speed=2.6,color=6)=>{
    const bend={kind:2,begin:0,end:241,position:{x,y,z:0},angle,speed:speed*d.speed,acceleration:0,angularAcceleration:angular};
    const terminal=touhouCurveSample([bend],240);bend.end=240;
    return game.lasers.spawnCurve({x,y,angle,width:9,speed:speed*d.speed,type:0,color,count:72,
      path:[bend,{kind:0,begin:240,end:99999,position:terminal.position,angle:terminal.angle,speed:terminal.speed,
        acceleration:0,angularAcceleration:0}],sound:26});
  };
  return {game,boss,frame,state,d,every,n,shoot,ring,fan,aim,beam,ribbon};
}

// Lantern petals. Two rotating flowers overlap while an aimed center fireball
// asks the player to stream instead of standing inside one comfortable gap.
function lanternPetals(c){const{boss:b,frame:t,every,ring,fan,d}=c;
  if(every(48))for(const side of[-1,1])ring(b.x+side*52,b.y+12,14,1.55,t*.011*side,0,side<0?2:12,[curve(side*.008,100)]);
  if(every(110))fan(b.x,b.y,3,2.7,undefined,.19,5,1);
  if(d.rank>=2&&every(96))ring(b.x,b.y,10,2.5,t*.009,3,14);
}
function paperFlames(c){const{boss:b,frame:t,every,shoot,n,fan,d}=c;
  if(every(80)){const count=n(18);for(let i=0;i<count;i++){const a=TAU*i/count+t*.01;
    shoot(b.x,b.y,a,2.6,3,i%2?1:12,[turn(Math.PI*.8,2.2,55)]);}}
  if(every(145))fan(b.x,b.y,5,3.1,undefined,.105,0,2);
  if(d.rank>=2&&every(40))shoot(b.x+Math.sin(t*.04)*75,b.y,Math.PI/2,2.8,4,14);
}
function addressRain(c){const{frame:t,every,shoot,n,fan,boss:b,d}=c;
  if(every(20)){const count=n(11);const gap=80*Math.sin(t*.008);for(let i=0;i<count;i++){const x=-180+i*360/(count-1);
    if(Math.abs(x-gap)>29)shoot(x,8,Math.PI/2+.14*Math.sin(t*.015),2.2,3,6);}}
  if(every(115))fan(b.x,b.y,5,3,undefined,.1,0,15);
  if(d.rank>=2&&every(80))fan(-170,100,7,2.5,.38,.13,2,7);
}
function postmarks(c){const{boss:b,frame:t,every,ring,shoot,n,d}=c;
  if(every(100)){const centers=[{x:-100,y:80},{x:100,y:150},{x:0,y:220}];
    for(let k=0;k<centers.length;k++){const p=centers[k],count=n(13);for(let i=0;i<count;i++){
      const a=TAU*i/count;shoot(p.x+Math.cos(a)*40,p.y+Math.sin(a)*40,a,0,2,k*2+5,[turn(Math.PI/2,2.5,40+k*22,4)]);}}}
  if(d.rank>=2&&every(160))ring(b.x,b.y,22,1.7,t*.018,0,7);
}
function rainSignatures(c){const{boss:b,frame:t,every,shoot,n,beam,d}=c;
  if(every(12)){for(const sign of[-1,1])for(let i=0;i<n(3,2);i++){
    const x=sign*(80+35*Math.sin(t*.025+i*.2));shoot(x,b.y+i*8,Math.PI/2+sign*.33,1.8,3,sign<0?5:7,[curve(sign*.009,130)]);}}
  if(every(150))beam(b.x,b.y,Math.PI/2+.45*Math.sin(t*.018),{width:7,delay:75,sustain:85,color:6});
  if(d.rank>=2&&every(90))c.fan(b.x,b.y,5,3.2,undefined,.12,2,15);
}
function crossingTickets(c){const{frame:t,every,shoot,n,boss:b,fan,d}=c;
  if(every(42)){const count=n(8);for(let i=0;i<count;i++){const y=32+i*16;
    shoot(-170,y,.48,2.5,3,12,[turn(Math.PI/2,2.2,52,4)]);
    shoot(170,y,Math.PI-.48,2.5,3,6,[turn(Math.PI/2,2.2,52,4)]);}}
  if(every(150))fan(b.x,b.y,3,3.5,undefined,.16,5,14);
  if(d.rank>=2&&every(84))c.ring(b.x,b.y,18,1.4,t*.006,0,9);
}
function tollGates(c){const{frame:t,every,shoot,n,beam,d}=c;
  const gap=95*Math.sin(t*.005);
  if(every(70)){for(let i=0,count=n(26);i<count;i++){const x=-184+i*368/(count-1);
    if(Math.abs(x-gap)>36)shoot(x,20,Math.PI/2,2.25,2,12);}}
  if(every(160))for(const side of[-1,1])beam(clamp(gap+side*60,-175,175),20,Math.PI/2,{width:8,delay:65,sustain:55,color:14});
  if(d.rank>=2&&every(105))c.fan(0,105,7,2.8,undefined,.1,0,6);
}
function riverCursive(c){const{frame:t,every,ribbon,shoot,boss:b,d}=c;
  if(every(85))for(const sign of[-1,1])ribbon(sign*95,25,Math.PI/2-sign*.42,sign*.008,2.5,sign<0?7:12);
  if(every(22))shoot(b.x+Math.sin(t*.04)*65,b.y,Math.PI/2,2,0,15,[curve(Math.sin(t*.017)*.018,100)]);
  if(d.rank>=2&&every(125))c.ring(b.x,b.y,20,2,t*.018,3,6);
}
function eightSpokeWeb(c){const{boss:b,frame:t,every,beam,shoot,n,d}=c;
  if(every(190)){const offset=Math.sin(t*.007)*.3;for(let i=0;i<8;i++)beam(b.x,b.y,TAU*i/8+offset,{width:6,delay:85,sustain:85,color:4});}
  if(every(45)){const count=n(22);for(let i=0;i<count;i++){const a=TAU*i/count+t*.006;
    shoot(b.x,b.y,a,1.8+((i%3)*.16),2,4,[curve((i%2?1:-1)*.003,140)]);}}
  if(d.rank>=2&&every(130))c.fan(b.x,b.y,5,3.1,undefined,.13,0,3);
}
function shuttleThreads(c){const{boss:b,frame:t,every,shoot,n,fan,d}=c;
  if(every(28)){const sign=(Math.floor(t/140)&1)?1:-1;const count=n(9);
    for(let i=0;i<count;i++)shoot(sign*175,25+i*20,sign<0?.43:Math.PI-.43,2.3,3,4,[turn(sign*.8,2.2,65)]);}
  if(every(140))fan(b.x,b.y,7,2.6,undefined,.07,0,9);
  if(d.rank>=2&&every(100))c.ribbon(b.x,b.y,Math.PI/2,.004*Math.sin(t*.01),3,4);
}
function stoppedMemory(c){const{boss:b,frame:t,every,ring,fan,d}=c;
  if(every(125))ring(b.x,b.y,30,2.6,t*.023,3,3,[turn(-999999,0,35,4),turn(999999,2.6,50,1)]);
  if(every(180))fan(b.x,b.y,5,3.2,undefined,.14,2,9);
  if(d.rank>=2&&every(125))ring(b.x,b.y,16,1.3,t*.015,0,15,[curve(-.014,180)]);
}
function knots(c){const{boss:b,frame:t,every,shoot,n,d}=c;
  if(every(14)){const count=n(6);for(let i=0;i<count;i++){const a=t*.034+TAU*i/count;
    shoot(b.x+Math.cos(a)*50,b.y+Math.sin(a)*25,a,1.8,2,i%2?4:10,[curve(-.017,160)]);}}
  if(every(170))c.beam(b.x,b.y,c.aim(),{width:10,delay:80,sustain:55,color:4});
  if(d.rank>=2&&every(85))c.fan(b.x,b.y,5,2.8,undefined,.15,5,3);
}
function foldedForms(c){const{boss:b,frame:t,every,fan,ring,d}=c;
  if(every(60))for(const sign of[-1,1])fan(b.x+sign*35,b.y,11,3,Math.PI/2+sign*.7,.095,3,15,[turn(-sign*1.1,2.2,50)]);
  if(every(155))ring(b.x,b.y,24,1.7,t*.013,2,1);
  if(d.rank>=2&&every(90))c.beam(-140,50,.88,{width:7,delay:70,sustain:65,color:1});
}
function vermilionSeals(c){const{boss:b,frame:t,every,beam,shoot,n,d}=c;
  if(every(165)){const x=clamp(c.game.player.x,-120,120);for(const side of[-1,1]){
    beam(x+side*45,18,Math.PI/2,{width:9,delay:75,sustain:80,color:1});
    beam(side*175,80,side<0?.6:Math.PI-.6,{width:7,delay:100,sustain:55,color:1});}}
  if(every(35)){const count=n(9);for(let i=0;i<count;i++)shoot(b.x,b.y,Math.PI/2+(i-(count-1)/2)*.085,2.6,2,1,[curve(i%2?.006:-.006,85)]);}
  if(d.rank>=2&&every(120))c.ring(b.x,b.y,18,1.4,t*.021,0,15);
}
function foldedCranes(c){const{boss:b,frame:t,every,shoot,n,d}=c;
  if(every(80)){const count=n(22);for(let i=0;i<count;i++){
    const a=TAU*i/count;const speed=2.1*(.8+.35*Math.abs(Math.cos(a*2)));
    shoot(b.x,b.y,a+t*.017,speed,3,i%2?15:1,[turn(i%2?.8:-.8,2.5,58)]);}}
  if(every(170))c.fan(b.x,b.y,7,3.4,undefined,.075,0,12);
  if(d.rank>=2&&every(160))c.ribbon(-140,25,.75,.004,2.8,1);
}
function archiveColumns(c){const{frame:t,every,shoot,n,boss:b,d}=c;
  if(every(36)){const gap=110*Math.sin(t*.012);for(let i=0,count=n(16);i<count;i++){
    const x=-175+i*350/(count-1);if(Math.abs(x-gap)>30)shoot(x,18,Math.PI/2,1.9,3,(Math.floor(t/36)+i)%2?1:15,[accelerate(.009,120)]);}}
  if(every(150))c.ring(b.x,b.y,16,2.2,t*.04,5,12);
  if(d.rank>=2&&every(90))c.fan(b.x,b.y,5,3.4,undefined,.13,0,1);
}
function nameStrokes(c){const{frame:t,every,shoot,n,boss:b,d}=c;
  if(every(95)){const sign=(Math.floor(t/95)&1)?1:-1;for(let i=0,count=n(15);i<count;i++){
    shoot(-165+i*330/(count-1),40,Math.PI/2+sign*.22,2.2,3,12);
    if(i%2===0)shoot(sign*170,35+i*10,sign<0?.22:Math.PI-.22,2.8,3,14,[turn(Math.PI/2,2.3,55,4)]);}}
  if(every(190))c.fan(b.x,b.y,5,3.4,undefined,.12,5,15);
  if(d.rank>=2&&every(130))c.beam(b.x,b.y,c.aim(),{width:7,delay:85,sustain:70,color:12});
}
function spokenCross(c){const{boss:b,frame:t,every,ring,beam,d}=c;
  if(every(62))ring(b.x,b.y,32,2,t*.012,0,14,[curve(Math.sin(t*.014)*.014,120)]);
  if(every(180)){const a=c.aim();for(let k=-1;k<=1;k++)beam(b.x,b.y,a+k*Math.PI/2,{width:8,delay:80,sustain:85,color:12});}
  if(d.rank>=2&&every(124))c.fan(b.x,b.y,7,3.1,undefined,.085,3,15);
}
function counterfeitNames(c){const{boss:b,frame:t,every,shoot,n,fan,d}=c;
  if(every(100)){const count=n(28);for(let i=0;i<count;i++){
    const a=TAU*i/count;const sign=i%2?1:-1;
    shoot(b.x+Math.cos(a)*28,b.y+Math.sin(a)*28,a,2.3,2,sign<0?12:15,[turn(sign*Math.PI*.65,2.2,55)]);}}
  if(every(140))fan(b.x,b.y,9,3.1,undefined,.07,3,14,[curve(.008,90)]);
  if(d.rank>=2&&every(160))for(const s of[-1,1])c.ribbon(s*145,20,Math.PI/2-s*.4,s*.008,2.7,12);
}
function blankIndex(c){const{frame:t,every,shoot,n,d}=c;
  if(every(26)){const gap=120*Math.sin(t*.006)+15*Math.sin(t*.031);
    for(let i=0,count=n(24);i<count;i++){const x=-185+i*370/(count-1);
      if(Math.abs(x-gap)>38)shoot(x,10,Math.PI/2,2.3,2,15);}}
  if(every(130)){const gap=120*Math.sin((t+100)*.006);for(const sign of[-1,1])c.beam(clamp(gap+sign*55,-170,170),15,Math.PI/2,{width:6,delay:85,sustain:45,color:14});}
  if(d.rank>=2&&every(110))c.fan(0,90,3,3.3,undefined,.17,0,12);
}
function namingBloom(c){const{boss:b,frame:t,every,shoot,n,ring,d}=c;
  if(every(10)){for(let k=0;k<n(5);k++){const a=TAU*k/n(5)+t*.02;
    shoot(b.x,b.y,a,2.4+Math.sin(t*.04)*.5,0,12,[curve(-.008,120)]);}}
  if(every(90))ring(b.x,b.y,22,1.3,t*.03,5,15,[accelerate(.007,100)]);
  if(every(240))for(const sign of[-1,1])c.ribbon(b.x,b.y,Math.PI/2+sign*.8,sign*.006,2.8,14);
  if(d.rank>=2&&every(150))c.fan(b.x,b.y,7,3.7,undefined,.085,3,1);
}

function yesterdayStream(c){const{boss:b,frame:t,every,fan,ring,state}=c;
  if(every(85)){state.aims??=[];state.aims.push(c.aim());if(state.aims.length>3)state.aims.shift();
    state.aims.forEach((a,i)=>fan(b.x,b.y,5,1.8+i*.45,a,.09,3,i%2?6:4,[turn(.3,2.4,60)]));}
  if(every(155))ring(b.x,b.y,24,2.2,t*.017,0,4);
}
function returnCurrent(c){const{boss:b,frame:t,every,ring,fan}=c;
  if(every(120))ring(b.x,b.y,32,2.9,t*.008,2,7,[turn(Math.PI,2.7,60),turn(Math.PI*.55,2.4,70)]);
  if(every(175))fan(b.x,b.y,7,3.4,undefined,.12,0,15);
}
function reflectingEdges(c){const{boss:b,frame:t,every,shoot,n}=c;
  if(every(90)){const count=n(14);for(let i=0;i<count;i++){
    const sign=i%2?1:-1;shoot(b.x,b.y,Math.PI/2+sign*(.65+i*.035),2.4,3,6,[bounce(1)]);}}
  if(every(140))c.fan(b.x,b.y,5,3.5,undefined,.09,0,4);
}
function fiveSyllables(c){const{boss:b,frame:t,every,shoot,n}=c;
  if(every(105)){for(let k=0;k<5;k++){const a=k*TAU/5+t*.014;
    const x=b.x+Math.cos(a)*58,y=b.y+Math.sin(a)*40;
    for(let i=0,count=n(8);i<count;i++)shoot(x,y,a+Math.PI+(i-(count-1)/2)*.11,2.3,2,4,[curve((k%2?1:-1)*.01,100)]);}}
  if(every(185))c.beam(b.x,b.y,c.aim(),{width:10,delay:90,sustain:65,color:4});
}
function oldCursive(c){const{frame:t,every,ribbon,boss:b,shoot}=c;
  if(every(70))for(const sign of[-1,1])ribbon(sign*130,25,Math.PI/2-sign*.5,sign*.009,2.5,sign<0?4:6);
  if(every(20))shoot(b.x,b.y,Math.PI/2+Math.sin(t*.08)*.9,2.5,3,15,[curve(Math.sin(t*.01)*.015,130)]);
}
function erasedMargin(c){const{frame:t,every,shoot,n}=c;
  if(every(45)){const gap=100*Math.sin(t*.011);for(let i=0,count=n(28);i<count;i++){
    const x=-182+i*364/(count-1);if(Math.abs(x-gap)>34)shoot(x,10,Math.PI/2,2.15,0,15,[turn(Math.PI/2,2.9,70,4)]);}}
  if(every(210))for(const s of[-1,1])c.beam(s*170,40,s<0?.7:Math.PI-.7,{width:7,delay:85,sustain:100,color:4});
}
function borderExpansion(c){const{boss:b,frame:t,every,shoot,n}=c;
  if(every(72)){const count=n(30);for(let i=0;i<count;i++){const a=TAU*i/count;
    const r=50+20*Math.sin(a*4+t*.015);shoot(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r,a,1.5,5,4,[accelerate(.018,100)]);}}
  if(every(135))c.fan(b.x,b.y,9,3.5,undefined,.07,3,6,[curve(-.012,90)]);
}
function delayedEcho(c){const{boss:b,frame:t,every,shoot,n}=c;
  if(every(130)){for(let k=0;k<3;k++)for(let i=0,count=n(16);i<count;i++){
    const a=TAU*i/count+k*.07+t*.006;shoot(b.x,b.y,a,2.5,2,k===1?15:4,[turn(-999999,0,25+k*15,4),turn(a+.65,2.8,50-k*8,4)]);}}
  if(every(195))c.beam(b.x,b.y,c.aim(),{width:8,delay:90,sustain:50,color:6});
}
function twinNames(c){const{frame:t,every,fan,ring,beam}=c;
  const x=95*Math.sin(t*.009);if(every(55))for(const sign of[-1,1]){
    fan(sign*x,100,9,2.9,Math.PI/2+sign*.2,.085,3,sign<0?4:6,[turn(-sign*.45,2.3,55)]);}
  if(every(180))for(const sign of[-1,1])beam(sign*x,100,Math.PI/2-sign*.4,{width:7,delay:85,sustain:75,color:sign<0?4:6});
  if(every(140))ring(0,80,24,1.5,t*.021,0,15);
}
function allForgottenNames(c){const{boss:b,frame:t,every,state}=c;
  const chapter=Math.floor(t/480)%6;
  // This final card quotes the journey's geometry in a new combined cadence.
  if(chapter===0)lanternPetals(c);
  else if(chapter===1)rainSignatures(c);
  else if(chapter===2)crossingTickets(c);
  else if(chapter===3)knots(c);
  else if(chapter===4)foldedForms(c);
  else namingBloom(c);
  if(every(180))c.ring(b.x,b.y,18,1.8,t*.007,0,15,[turn(.6,2.7,75)]);
  state.chapter=chapter;
}

const names=['lantern-petals','paper-flames','address-rain','postmarks','rain-signatures','crossing-tickets','toll-gates','river-cursive',
  'eight-spoke-web','shuttle-threads','stopped-memory','knots','folded-forms','vermilion-seals','folded-cranes','archive-columns',
  'name-strokes','spoken-cross','counterfeit-names','blank-index','naming-bloom','yesterday-stream','return-current','reflecting-edges',
  'five-syllables','old-cursive','erased-margin','border-expansion','delayed-echo','twin-names','all-forgotten-names'];
const functions=[lanternPetals,paperFlames,addressRain,postmarks,rainSignatures,crossingTickets,tollGates,riverCursive,
  eightSpokeWeb,shuttleThreads,stoppedMemory,knots,foldedForms,vermilionSeals,foldedCranes,archiveColumns,
  nameStrokes,spokenCross,counterfeitNames,blankIndex,namingBloom,yesterdayStream,returnCurrent,reflectingEdges,
  fiveSyllables,oldCursive,erasedMargin,borderExpansion,delayedEcho,twinNames,allForgottenNames];
export const SPELL_PATTERNS=Object.freeze(functions.map((update,index)=>Object.freeze({id:names[index],index,update})));
export const STAGE_PATTERN_OFFSETS=Object.freeze([0,2,5,8,12,16,21]);

function archiveCopies(c){const{boss:b,frame:t,every,shoot,n}=c;
  if(every(60)){const gap=100*Math.sin(t*.018);for(let i=0,count=n(18);i<count;i++){
    const x=-174+i*348/(count-1);if(Math.abs(x-gap)>35)shoot(x,15,Math.PI/2,2.35,3,15,[turn(Math.PI/2+.12,2.8,75,4)]);}}
  if(every(145))c.fan(b.x,b.y,5,3.1,undefined,.12,0,1);
}
function sealedEcho(c){const{boss:b,frame:t,every,shoot,n,beam}=c;
  if(every(95)){for(let i=0,count=n(26);i<count;i++){
    const a=TAU*i/count;const max=Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),radius=52/max;
    shoot(b.x+Math.cos(a)*radius,b.y+Math.sin(a)*radius,a+t*.006,1.85,2,1,[turn((i%2?1:-1)*.62,2.7,58)]);}}
  if(every(185))for(const side of[-1,1])beam(side*155,25,Math.PI/2-side*.5,{width:8,delay:85,sustain:55,color:1});
}
function archiveErrata(c){const{boss:b,frame:t,every,shoot,n}=c;
  if(every(70))for(const side of[-1,1])for(let i=0,count=n(11);i<count;i++){
    shoot(side*175,35+i*12,side<0?.48:Math.PI-.48,2.75,3,15,[turn(-side*.52,2.2,60)]);}
  if(every(130))c.ring(b.x,b.y,22,2.2,t*.015,0,1,[turn(Math.PI*.75,2.4,70)]);
  if(every(210))c.fan(b.x,b.y,5,3.5,undefined,.075,3,12);
}
export const MIDBOSS_PATTERNS=Object.freeze([
  Object.freeze({id:'archive-copies',update:archiveCopies}),Object.freeze({id:'sealed-echo',update:sealedEcho}),
  Object.freeze({id:'archive-errata',update:archiveErrata}),
]);
export function updateMidbossSpellPattern({game,boss,frame,difficulty=4,spellIndex=0,state={}}){
  const pattern=MIDBOSS_PATTERNS[spellIndex];if(!pattern)throw new RangeError('Undefined Extra midboss card');
  if(frame>=60)pattern.update(attackContext(game,boss,frame-60,difficulty,state));return pattern.id;
}

export function updateSpellPattern({game,boss,frame,difficulty=1,stageId=1,spellIndex=0,state={}}){
  const index=(STAGE_PATTERN_OFFSETS[stageId-1]??0)+spellIndex;
  const pattern=SPELL_PATTERNS[index];if(!pattern)throw new RangeError(`Undefined spell geometry ${stageId}/${spellIndex}`);
  if(frame>=60)pattern.update(attackContext(game,boss,frame-60,difficulty,state));
  return pattern.id;
}

export function updateNonspellPattern({game,boss,frame,difficulty=1,stageId=1,phaseIndex=0,state={}}){
  if(frame<35)return;const c=attackContext(game,boss,frame-35,difficulty,state);
  const b=boss,t=frame-35,chapter=(stageId+phaseIndex)%7;
  if(c.every(60))c.fan(b.x,b.y,3+chapter,2+stageId*.14,undefined,.105,chapter%2?3:0,[1,6,12,4,15,7,14][chapter]);
  if(c.every(105))c.ring(b.x,b.y,12+stageId*2,1.2+stageId*.08,t*.011*(phaseIndex%2?1:-1),2,chapter%2?6:12,
    chapter>=3?[curve((phaseIndex%2?1:-1)*.006,90)]:[]);
  if(stageId>=3&&c.every(210))c.beam(b.x,b.y,c.aim()+.5,{width:6,delay:80,sustain:60,color:6});
  if(c.d.rank>=2&&c.every(150))c.fan(b.x,b.y,5,3.2,undefined,.07,3,15);
}

export const ROAD_ATTACKS=Object.freeze([
  'lantern-aim','ember-petals','wing-cross','rain-columns','rain-sweep','rain-stagger',
  'ferry-current','ferry-cross','wake-chase','weft-thread','weaver-needle','memory-knot',
  'paper-columns','paper-fold','seal-corners','bell-strike','bell-reply','bell-chorus',
  'echo-stencil','echo-reverse','echo-chase',
]);

/** Road attacks are finite volleys tied to a body's route, rather than one
 * timer-driven fan shared by every stage. Boss choreography above is separate. */
export function updateRoadEnemy({game,enemy,frame:t,difficulty=1,stageId=1,attack,state={},index=0,side=1,onAttack}){
  if(!ROAD_ATTACKS.includes(attack))throw new RangeError(`Undefined road attack ${attack}`);
  const rank=Math.min(3,difficulty),d=DIFFICULTY_PROFILES[difficulty]??DIFFICULTY_PROFILES[1],x=enemy.x,y=enemy.y;
  const at=(...times)=>times.includes(t),aim=()=>Math.atan2(game.player.y-y,game.player.x-x),down=Math.PI/2;
  const report=(mechanism,parameters)=>onAttack?.({attack,mechanism,enemyId:enemy.id,stageId,age:t,...parameters});
  let sounded=false;
  const shot=(angle,speed,count=1,spread=.1,type=0,color=1,commands=[],mechanism='direct',origin={x,y})=>{
    const parameters={...origin,angle,speed:speed*d.speed,pattern:1,count,angleStep:spread,type,color,
      commands:[birth,...commands],shotSound:sounded?-1:21,minimumPlayerDistanceSquared:4096};
    sounded=true;report(mechanism,parameters);return game.bullets.emit(parameters);
  };
  const beam=(angle,color=6,offset=0)=>{const p={x:x+offset,y,angle,width:5,length:560,color,type:0,delay:70,grow:18,sustain:55,shrink:22,sound:26};report('telegraphed-laser',p);return game.lasers.spawnInfinite(p);};
  const count=base=>Math.max(1,base+(rank===0?-1:rank===3?1:0));
  switch(attack){
    case 'lantern-aim':
      if(at(64,112,173)){shot(aim(),2.25,count(2),.07,0,2,[],'aimed-stream');
        if(rank>=1)shot(down+side*.32,1.6,2,.2,3,12,[],'fixed-wing');
        if(rank>=2)shot(aim()-side*.34,1.75,3,.12,0,14,[turn(side*.55,2.45,48)],'turning-wing');}
      if(rank===3&&at(138,204))shot(aim(),2.7,2,.04,5,1,[],'offbeat-snipe');break;
    case 'ember-petals':
      if(at(91,145,202)){for(let petal=0;petal<(rank===0?3:5);petal++){
        const a=down+(petal-2)*.31+side*(t===145?.12:-.12);
        shot(a,1.55,count(2),.055,0,12,[curve(side*.007,95)],'curved-petals');}
        if(rank>=1)shot(aim(),2.6,1,0,5,2,[],'petal-center-snipe');
        if(rank>=2)shot(down,1.8,3,.23,3,1,[turn(-side*.65,2.7,60)],'folding-embers');}
      if(rank===3&&at(175))shot(down,0,5,.22,2,14,[turn(down-side*.4,2.65,38,4)],'delayed-embers');break;
    case 'wing-cross':
      if(at(54,94,138)){shot(down+side*.64,2.05,count(4),.09,3,2,rank>=2?[turn(-side*.3,2.35,50)]:[],'crossing-wings');
        if(rank>=1&&t===94)shot(aim(),2.7,1,0,5,12,[],'cross-snipe');}
      if(rank===3&&at(170))shot(down-side*.45,2.5,4,.06,0,1,[],'counter-cross');break;
    case 'rain-columns':
      if(at(55,84,115,151,190)){shot(down,2.05,rank===0?1:2,.07,3,6,rank>=2?[curve(side*.006,100)]:[],'vertical-rain');
        if(rank>=1&&at(115,190))shot(down-side*.25,1.65,2,.06,0,7,[],'slanted-rain');
        if(rank===3&&t===151)shot(down,0,3,.1,3,15,[turn(down+side*.35,2.75,38,4)],'late-rain');}break;
    case 'rain-sweep':
      if(at(52,79,107,139,170)){state.aim??=aim();shot(state.aim+side*(t-107)*.004,2.3,count(2),.08,0,6,[],'swept-address');
        if(rank>=1&&at(79,139))shot(down-side*.45,1.85,2,.12,3,7,[],'crosswind');
        if(rank>=2&&t===107)shot(state.aim,1.15,4,.1,2,15,[turn(down+side*.42,2.55,55,4)],'wind-change');}
      if(rank===3&&at(196))shot(state.aim??aim(),2.9,3,.04,5,6,[],'last-delivery');break;
    case 'rain-stagger':
      if(at(88,147,211)){state.aim=aim();for(let lane=0;lane<count(4);lane++)shot(state.aim+(lane-1.5)*.2,0,1,0,2,7,
        [turn(down+side*(lane-1.5)*.12,2.2,35+lane*13,4)],'staggered-release');
        if(rank>=1)shot(down,1.9,3,.24,3,6,[],'rain-frame');
        if(rank>=2)shot(state.aim,2.1,3,.085,0,15,[curve(-side*.014,78)],'curling-letter');}
      if(rank===3&&at(177))shot(aim(),2.75,3,.065,5,7,[],'receipt-snipe');break;
    case 'ferry-current':
      if(at(62,102,145,191)){shot(down+side*.4,1.95,count(3),.095,0,6,[curve(-side*.009,110)],'water-current');
        if(rank>=1&&at(102,191))shot(down-side*.32,1.7,2,.12,3,12,[curve(side*.006,95)],'counter-current');
        if(rank>=2&&t===145)shot(down,1.8,3,.17,2,7,[turn(side*.65,2.5,65)],'river-bend');}
      if(rank===3&&at(228))shot(aim(),2.9,2,.05,5,14,[],'boat-wake-snipe');break;
    case 'ferry-cross':
      if(at(48,86,127,167)){shot(side<0?.48:Math.PI-.48,2.4,count(3),.065,3,12,
        [turn(down,2.1,rank>=2?42:62,4)],'cross-then-down');
        if(rank>=1&&at(86,167))shot(aim(),2.8,1,0,0,6,[],'ferry-snipe');
        if(rank>=2&&t===127)shot(down-side*.45,1.6,3,.14,2,14,[curve(side*.011,90)],'sluice-return');}
      if(rank===3&&at(200))shot(down+side*.4,2.6,4,.08,3,7,[],'second-crossing');break;
    case 'wake-chase':
      if(at(75,106,144,187)){if(t===75)state.aim=aim();shot(state.aim??aim(),1.95+(t-75)*.004,count(2),.065,0,14,[],'remembered-wake');
        if(rank>=1&&at(106,187))shot(down+side*.3,1.8,3,.1,3,6,[],'wake-sides');
        if(rank>=2&&t===144)shot(state.aim,1.1,3,.085,2,7,[turn(side*.55,2.65,60)],'wake-turn');}
      if(rank===3&&at(220))shot(aim(),2.95,3,.06,5,12,[],'fresh-wake');break;
    case 'weft-thread':
      if(at(47,77,109,147,185)){shot(down+side*.68,2.15,count(3),.07,3,4,[],'diagonal-weft');
        if(rank>=1&&at(77,147))shot(down-side*.3,1.75,2,.16,0,6,[],'vertical-warp');
        if(rank>=2&&t===109)shot(down+side*.6,1.3,4,.1,2,15,[turn(-side*.75,2.4,55)],'folded-thread');}
      if(rank===3&&at(212))shot(down-side*.55,2.4,4,.1,3,4,[],'cross-weft');break;
    case 'weaver-needle':
      if(at(76,124,176)){shot(aim(),2.8,count(2),.045,3,4,[],'needle-snipe');
        if(rank>=1)shot(down+side*.4,1.55,4,.12,0,15,[],'needle-trail');
        if(rank>=2&&t===124)beam(down-side*.28,6);}
      if(rank===3&&at(208))shot(down,0,5,.16,2,4,[turn(down+side*.4,2.5,42,4)],'sleeping-needles');break;
    case 'memory-knot':
      if(at(91,158,223)){for(let k=0;k<count(5);k++){const a=k*TAU/5,origin={x:x+Math.cos(a)*24,y:y+Math.sin(a)*24};
        shot(down+(k-2)*.18,0,1,0,2,4,[turn(down+(k-2)*.14,2.05,25+k*12,4)],'five-point-knot',origin);}
        if(rank>=1)shot(aim(),2.5,2,.055,3,6,[],'knot-center');
        if(rank>=2)shot(down,1.4,4,.2,0,15,[curve(side*.013,120)],'curling-weft');}
      if(rank===3&&at(190))beam(down+side*.36,4);break;
    case 'paper-columns':
      if(at(80,123,172,220)){shot(down,1.95,count(3),.045,3,15,[],'index-column');
        if(rank>=1&&at(123,220))shot(down+side*.42,1.5,2,.065,2,1,[],'annotation');
        if(rank>=2&&t===172)shot(down,0,4,.1,3,15,[turn(down-side*.35,2.4,30+index*5,4)],'delayed-index');}
      if(rank===3&&at(248))shot(aim(),2.8,3,.05,5,1,[],'index-snipe');break;
    case 'paper-fold':
      if(at(59,97,140,180)){shot(down+side*.66,2.15,count(4),.08,3,15,[turn(-side*.8,2.35,55)],'folded-paper');
        if(rank>=1&&at(97,180))shot(down-side*.45,1.5,3,.12,2,1,[],'opposite-page');
        if(rank>=2&&t===140)shot(aim(),2.75,3,.055,0,12,[],'margin-snipe');}
      if(rank===3&&at(208))shot(down-side*.3,1.9,3,.1,3,15,[curve(side*.014,110)],'curled-margin');break;
    case 'seal-corners':
      if(at(93,164,231)){for(const corner of[-1,1])for(const row of[-1,1])shot(down+corner*.36,1.55,count(2),.065,2,1,
        rank>=2?[turn(-corner*.55,2.25,58)]:[],'square-seal',{x:x+corner*28,y:y+row*24});
        if(rank>=1)shot(aim(),2.65,2,.07,3,15,[],'seal-center');}
      if(rank===3&&at(198))shot(down,0,5,.14,0,12,[turn(down-side*.45,2.5,40,4)],'late-stamp');break;
    case 'bell-strike':
      if(at(65,118,178)){for(let note=0;note<(rank===0?2:3);note++)shot(down+(note-1)*.23,1.6+note*.36,2,.055,0,14,[],'three-note-chord');
        if(rank>=1)shot(aim(),2.45,1,0,5,12,[],'clear-note');
        if(rank>=2)shot(down+side*.45,1.2,3,.09,2,7,[turn(-side*.7,2.45,58)],'bent-note');}
      if(rank===3&&at(214))shot(down-side*.3,2.5,3,.065,3,14,[],'answer-note');break;
    case 'bell-reply':
      if(at(74,128,183)){if(t===74)state.aim=aim();shot(state.aim??aim(),2.3,count(2),.065,0,7,[],'remembered-answer');
        if(rank>=1)shot(state.aim??aim(),0,2,.085,2,14,[turn(state.aim??aim(),2.6,42,4)],'delayed-answer');
        if(rank>=2)shot(down-side*.5,1.6,3,.1,3,12,[curve(side*.012,98)],'side-voice');}
      if(rank===3&&at(223))shot(aim(),2.95,2,.05,5,7,[],'new-answer');break;
    case 'bell-chorus':
      if(at(92,167,235)){for(let voice=0;voice<(rank===0?2:3);voice++)shot(down+(voice-1)*.35,1.5+voice*.25,count(3),.065,0,14,[],'chorus-voices');
        if(rank>=1)beam(down+side*.25,12);
        if(rank>=2)shot(aim(),1.35,4,.08,2,7,[turn(side*.65,2.7,55)],'chorus-turn');}
      if(rank===3&&at(201))shot(down-side*.5,2.6,4,.075,3,14,[],'chorus-countervoice');break;
    case 'echo-stencil':
      if(at(84,145,214)){state.aim=aim();for(let cell=0;cell<count(4);cell++)shot(down+(cell-1.5)*.18,0,1,0,3,15,
        [turn(down-side*.4,2.1,30+cell*14,4),turn(side*.75,2.75,75)],'echo-stencil');
        if(rank>=1)shot(state.aim,2.4,2,.065,0,4,[],'stencil-center');
        if(rank>=2)shot(down+side*.42,1.6,3,.1,2,6,[curve(-side*.014,110)],'stencil-return');}
      if(rank===3&&at(180))beam(down-side*.28,4);break;
    case 'echo-reverse':
      if(at(55,98,146,194)){shot(down+side*.55,1.9,count(4),.08,0,4,[curve(-side*.012,110)],'reversed-current');
        if(rank>=1)shot(down-side*.4,1.55,2,.12,3,6,[turn(side*.8,2.35,65)],'reverse-fold');
        if(rank>=2&&at(98,194))shot(aim(),0,3,.065,2,15,[turn(aim(),2.8,36,4)],'late-old-name');}
      if(rank===3&&at(224))shot(down-side*.62,2.55,4,.08,3,7,[],'counter-echo');break;
    case 'echo-chase':
      if(at(70,105,147,195)){state.aims??=[];state.aims.push(aim());if(state.aims.length>3)state.aims.shift();
        shot(state.aims[0],2.15,count(2),.06,0,4,[],'oldest-aim');
        if(rank>=1)shot(state.aims.at(-1),0,2,.06,2,6,[turn(state.aims.at(-1),2.65,45,4)],'late-new-aim');
        if(rank>=2)shot(down+side*.5,1.5,3,.09,3,15,[turn(-side*.9,2.6,65)],'echo-crossing');}
      if(rank===3&&at(226))shot(aim(),2.9,3,.05,5,7,[],'final-syllable');break;
  }
}
