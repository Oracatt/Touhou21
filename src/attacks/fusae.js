/** 御影房枝 — Stage 5 and the Extra midboss. Paper obeys rules: rows with a
 * blank cell, sorted colours, folds, five seals and a signature star. */
import {T,C,C8,DOWN,TAU,clamp,lerp} from '../danmaku.js';
import {polygon,star,burstShape} from './shapes.js';

/** A falling row of paper with a blank stretch around `blank` (cells). */
function pageRow(k,{spacing,blank,width=1,speed,color,y=-4,type=T.AMULET,angle=DOWN}){
  const cells=Math.floor(368/spacing)+1,start=-184+(368-(cells-1)*spacing)/2;
  for(let i=0;i<cells;i++){if(Math.abs(i-blank)<=width)continue;
    k.shot(start+i*spacing,y,angle,speed,type,color,null,{silent:i>0,safe:2304});}
  return cells;
}

/** Midboss (stage 5): shelves of paper fall with a gap at the player's column. */
function shelfSorting(k){
  const period=k.pick(38,30,25,21),spacing=k.pick(30,26,23,21);
  if(k.every(period)){
    const cells=Math.floor(368/spacing)+1,blank=Math.round((k.px+184)/368*(cells-1));
    pageRow(k,{spacing,blank,width:k.pick(2,1,1,1),speed:1.9,color:(k.t/period)&1?C.GREEN:C.PALE,y:k.oy+10});
  }
  if(k.every(100,50))k.aimed(k.ox,k.oy,3,1.7,.34,T.BIG,C8.RED);
  if(k.every(200,160))k.wander(40);
}

/** 规章「借阅证不得转借」: every burst of cards is sorted onto two slanted
 * shelves, red and green, that cross in an X; each shelf then slides toward
 * its own bank, so the crossing of the two curtains walks down to the player. */
function nonTransferableCard(k){
  const period=k.pick(64,50,42,36),spacing=k.pick(46,38,33,29),lean=.42,slope=Math.tan(lean);
  if(k.every(period)){
    const cross=k.signed()*70;
    for(const [color,dir] of [[C.RED,1],[C.GREEN,-1]])
      for(let x=-184+k.unit()*spacing,i=0;x<=184;x+=spacing,i++){
        const y=clamp(118+dir*slope*(x-cross),24,220);
        k.shot(k.ox,k.oy,Math.atan2(y-k.oy,x-k.ox),.4,T.AMULET,color,[k.goTo(x,y,34),k.stopTo(14,DOWN+dir*lean,1.9)],{silent:i>0});
      }
  }
  if(k.rank>=2&&k.every(120,80))k.aimed(k.ox,k.oy,5,2.9,.13,T.AMULET,C.WHITE,null,{rows:2,speedStep:2});
  if(k.every(period*4,period*3))k.wander(40,{y:[92,118]});
}
nonTransferableCard.home={x:0,y:104};

/** Nonspell 1: a sequence of vermilion seals is stamped in a line that
 * sweeps across the player, while blank-paper rings alternate between a gap
 * and a card toward the player. */
function sealSequence(k){
  const c=k.t%140,seals=k.pick(3,5,5,6),sweep=(k.t/140|0)%2?1:-1;
  if(c<seals*14&&c%14===0)k.aimed(k.ox,k.oy,1,1.9,0,T.BIG,C8.RED,null,{offset:(c/14-(seals-1)/2)*.09*sweep});
  const ringEvery=k.pick(28,22,19,16),n=k.pick(14,20,24,28);
  if(c%ringEvery===0)k.ringGap(k.ox,k.oy,n,2.1,T.AMULET,(c/22|0)%2?C.PALE:C.GREEN,null,{offset:(c/ringEvery&1)*Math.PI/n});
  if(c===120)k.wander(40);
}

/** Nonspell 3: index lines leave the Boss diagonally in alternating
 * directions, crossing into a lattice of entries. */
function indexOfNames(k){
  const period=k.pick(34,26,22,19);
  if(k.every(period)){
    const wave=k.t/period|0,lean=wave%2?.42:-.42,n=k.pick(9,11,13,15);
    for(let i=0;i<n;i++){const x=k.ox+(i-(n-1)/2)*22;k.shot(x,k.oy+8,DOWN+lean,1.9,T.AMULET,wave%2?C.PALE:C.GREEN,null,{silent:i>0});}
  }
  if(k.every(120,60))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),3,.16,T.RICE,C.RED,null,{rows:3,speedStep:2});
  if(k.every(240,200))k.wander(40);
}

/** Nonspell 4: closed stacks — shelves slide in from both walls and close
 * diagonally downward, leaving the aisle under the Boss. */
function closedStacks(k){
  const period=k.pick(48,38,32,28);
  if(k.every(period)){
    const rows=k.pick(5,6,7,8);
    for(const side of[-1,1])for(let i=0;i<rows;i++)
      k.shot(side*188,40+i*24,side<0?.55:Math.PI-.55,1.9,T.AMULET,side<0?C.GREEN:C.PALE,[k.curve(-side*.0035,90)],{silent:i>0||side>0,safe:2304});
  }
  if(k.every(period,period/2|0))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),2.7,.2,T.BIG,C8.RED);
}

/** 札符「不收原件的归名书库」: rows of blank pages fall with a winding
 * empty cell; vermilion seals are stamped down that aisle. */
function archiveRefusesOriginals(k){
  const period=k.pick(28,23,20,18),spacing=k.pick(32,28,26,24),cells=Math.floor(368/spacing)+1;
  if(k.every(period)){
    let blank=k.state.blank??Math.floor(cells/2);
    blank=clamp(blank+(k.unit()<.5?-1:1),2,cells-3);k.state.blank=blank;
    pageRow(k,{spacing,blank,width:k.pick(2,1,1,1),speed:1.7,color:(k.t/period)&1?C.WHITE:C.PALE});
  }
  if(k.rank>=1&&k.every(k.pick(120,110,94,82),60))k.aimed(k.ox,k.oy,1,1.6,0,T.BIG,C8.RED);
}
archiveRefusesOriginals.home={x:0,y:84};

/** 翻页「今名与旧名的错页」: radial page lines sweep across like a page
 * turning, then every line folds aside; pages alternate direction. */
function misfiledPages(k){
  const cycle=k.pick(104,90,80,72),c=k.t%cycle,side=(k.t/cycle|0)%2?1:-1,steps=k.pick(11,14,16,18);
  if(c<steps*3&&c%3===0){
    const i=c/3,a=DOWN+side*(1.25-i*2.5/(steps-1));
    k.fan(k.ox,k.oy,1,2.9,a,0,T.AMULET,side<0?C.WHITE:C.GREEN,[k.wait(38),k.stopTurn(20,side*1.15,2)],{rows:k.pick(3,4,4,5),speedStep:1.6});
  }
  if(k.rank>=2&&c===steps*3+8)k.ringGap(k.ox,k.oy,24,1.7,T.BALL,C.RED);
}
misfiledPages.home={x:0,y:100};

/** 印符「五重禁带出之印」: five seals orbit the Boss, each writing an arm of
 * a spiral; together they periodically stamp rings with a gap. */
function fivefoldSeal(k){
  const radius=k.rank===3?70+16*Math.sin(k.t*.02):70,a0=k.t*.018;
  if(k.every(k.pick(7,5,4,3)))for(let j=0;j<5;j++){
    const a=a0+j*TAU/5;k.shot(k.ox+Math.cos(a)*radius,k.oy+Math.sin(a)*radius*.8,a,2.2,T.AMULET,j%2?C.RED:C.PALE,null,{silent:j>0||k.t%10!==0});
  }
  if(k.every(k.pick(110,96,84,74),40))for(let j=0;j<5;j++){
    const a=a0+j*TAU/5;k.ringGap(k.ox+Math.cos(a)*radius,k.oy+Math.sin(a)*radius*.8,k.pick(8,10,12,14),1.6,T.BALL,C.GREEN,null,{silent:j>0});
  }
  if(k.every(160,100))k.aimed(k.ox,k.oy,1,1.5,0,T.BIG,C8.RED);
}
fivefoldSeal.home={x:0,y:120};

/** 式札「守门人无字的签名」: the gatekeeper signs a five-pointed star of
 * paper; after a breath the whole signature folds to one side. */
function blankSignature(k){
  const period=k.pick(80,62,52,46);
  if(k.every(period)){
    const wave=k.t/period|0,fold=(wave%2?1:-1)*.75;
    burstShape(k,k.ox,k.oy,star(5,k.pick(5,6,7,8),.4),2.3,wave*Math.PI/5+k.aim()-DOWN,T.AMULET,wave%2?C.RED:C.WHITE,[k.wait(44),k.stopTurn(22,fold,1.9)]);
  }
  if(k.every(120,60))k.aimed(k.ox,k.oy,3,1.7,.42,T.BIG,C8.RED);
}
blankSignature.home={x:0,y:108};

/** Extra midboss 1 — 抄札「只准借阅的旧名目录」: columns of copies fall;
 * halfway down, alternate columns trade lanes with their neighbours. */
function borrowOnlyCatalogue(k){
  const period=8,spacing=46,lanes=Math.floor(352/spacing)+1;
  if(k.every(period)){
    const shift=(k.t/period|0)%2?3:0;
    for(let i=0;i<lanes;i++){
      const x=-176+i*spacing+shift,dir=i%2?1:-1,lean=Math.atan2(spacing/2,30*1.9)*dir;
      k.shot(x,-4,DOWN,1.9,T.AMULET,i%2?C.PALE:C.GREEN,[k.wait(70),k.set(DOWN-lean,1.9),k.wait(30),k.set(DOWN,1.9)],{silent:i>0,safe:2304});
    }
  }
  if(k.every(90,40))k.aimed(k.ox,k.oy,5,3,.12,T.AMULET,C.RED,null,{rows:3,speedStep:2.1});
}
borrowOnlyCatalogue.home={x:0,y:90};

/** Extra midboss 2 — 封印「回声不可携出之页」: square pages open, are pulled
 * back through the seal, and open again on the other side. */
function echoMayNotLeave(k){
  const period=50;
  if(k.every(period)){
    const wave=k.t/period|0;
    burstShape(k,k.ox,k.oy,polygon(4,11),3.4,wave*.33,T.AMULET,wave%2?C.RED:C.PALE,[k.stopTurn(46,Math.PI,2.1)]);
  }
  if(k.every(75,30))k.aimed(k.ox,k.oy,3,1.8,.3,T.BIG,C8.RED);
}
echoMayNotLeave.home={x:0,y:110};

/** Extra midboss 3 — 订正「原件归还，抄本留存」: originals return to the
 * archive; at each turning point a copy is left hanging, then falls. */
function originalsReturned(k){
  const period=44;
  if(k.every(period)){
    const n=18,a=k.unit()*TAU,originals=k.ring(k.ox,k.oy,n,3.2,a,T.AMULET,C.RED,[k.stopTurn(40,Math.PI,2.4)]);
    k.later(44,originals,b=>k.shot(b.x,b.y,DOWN+(k.unit()-.5)*.4,0,T.AMULET,C.WHITE,[k.wait(40),k.accel(.025,80,DOWN)],{silent:true}));
  }
  if(k.every(110,60))k.aimed(k.ox,k.oy,7,2.8,.11,T.RICE,C.GREEN,null,{rows:2,speedStep:2});
}
originalsReturned.home={x:0,y:104};

export const FUSAE=Object.freeze({
  id:'fusae',
  nonspells:[sealSequence,indexOfNames,closedStacks],
  spells:[archiveRefusesOriginals,misfiledPages,fivefoldSeal,blankSignature],
  midboss:{nonspell:shelfSorting,spells:[nonTransferableCard]},
  extraMidboss:[borrowOnlyCatalogue,echoMayNotLeave,originalsReturned],
});
