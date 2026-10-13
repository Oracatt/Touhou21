import type {AttackKit, BossAttacks} from '../danmaku.js';
﻿/** 御影房枝 — Stage 5 and the Extra midboss. Paper obeys rules: rows with a
 * blank cell, sorted colours, folds, five seals and a signature star. */
import {T,C,C8,DOWN,TAU,clamp,lerp} from '../danmaku.js';
import {polygon,star,burstShape} from './shapes.js';

/** A falling row of paper with a blank stretch around `blank` (cells). */
function pageRow(k: AttackKit,{spacing,blank,width=1,speed,color,y=-4,type=T.AMULET,angle=DOWN,shift=0}:{spacing:number;blank:number;width?:number;speed:number;color:number;y?:number;type?:number;angle?:number;shift?:number}){
  const cells=Math.floor(368/spacing)+1,start=-184+(368-(cells-1)*spacing)/2+shift;
  for(let i=0;i<cells;i++){if(Math.abs(i-blank)<=width)continue;
    k.shot(start+i*spacing,y,angle,speed,type,color,null,{silent:i>0,safe:2304});}
  return cells;
}

/** Midboss (stage 5): shelves of paper fall with a gap at the player's column. */
function shelfSorting(k: AttackKit){
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
 * its own bank, so the crossing of the two curtains walks down to the player.
 * Between bursts the Boss issues a card: a diamond, then a square, red and
 * green in turn. */
function nonTransferableCard(k: AttackKit){
  const period=k.pick(64,50,42,36),spacing=k.pick(46,38,33,29),lean=.42,slope=Math.tan(lean);
  if(k.every(period)){
    const cross=k.signed()*70;
    for(const [color,dir] of [[C.RED,1],[C.GREEN,-1]])
      for(let x=-184+k.unit()*spacing,i=0;x<=184;x+=spacing,i++){
        const y=clamp(118+dir*slope*(x-cross),24,220);
        k.shot(k.ox,k.oy,Math.atan2(y-k.oy,x-k.ox),.4,T.AMULET,color,[k.goTo(x,y,34),k.stopTo(14,DOWN+dir*lean,1.9)],{silent:i>0});
      }
  }
  if(k.every(period*2,period)){const card=k.t/(period*2)|0;
    burstShape(k,k.ox,k.oy,polygon(4,k.pick(4,5,6,7)),1.3,card%2?Math.PI/4:0,T.AMULET,card%2?C.GREEN:C.RED);}
  if(k.every(period*4,period*3))k.wander(40,{y:[92,118]});
}
nonTransferableCard.home={x:0,y:104};

/** Nonspell 1: a sequence of vermilion seals is stamped in a line that
 * sweeps across the player, while blank-paper rings alternate between a gap
 * and a card toward the player. */
function sealSequence(k: AttackKit){
  const c=k.t%140,seals=k.pick(3,5,5,6),sweep=(k.t/140|0)%2?1:-1;
  if(c<seals*14&&c%14===0)k.aimed(k.ox,k.oy,1,1.9,0,T.BIG,C8.RED,null,{offset:(c/14-(seals-1)/2)*.09*sweep});
  const ringEvery=k.pick(28,22,19,16),n=k.pick(14,20,24,28);
  if(c%ringEvery===0)k.ringGap(k.ox,k.oy,n,2.1,T.AMULET,(c/22|0)%2?C.PALE:C.GREEN,null,{offset:(c/ringEvery&1)*Math.PI/n});
  if(c===120)k.wander(40);
}

/** Nonspell 3: index lines leave the Boss diagonally in alternating
 * directions, crossing into a lattice of entries. */
function indexOfNames(k: AttackKit){
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
function closedStacks(k: AttackKit){
  const period=k.pick(48,38,32,28);
  if(k.every(period)){
    const rows=k.pick(5,6,7,8);
    for(const side of[-1,1])for(let i=0;i<rows;i++)
      k.shot(side*188,40+i*24,side<0?.55:Math.PI-.55,1.9,T.AMULET,side<0?C.GREEN:C.PALE,[k.curve(-side*.0035,90)],{silent:i>0||side>0,safe:2304});
  }
  if(k.every(period,period/2|0))k.aimed(k.ox,k.oy,k.pick(1,3,3,5),2.7,.2,T.BIG,C8.RED);
}

/** 札符「不收原件之书库」: rows of blank pages fall with a winding
 * empty cell; vermilion seals are stamped down that aisle. Each row sits a
 * third of a cell off the one before, so the shelves slant and only the
 * aisle stays open. */
function archiveRefusesOriginals(k: AttackKit){
  const period=k.pick(28,23,20,18),spacing=k.pick(30,26,24,22),cells=Math.floor(368/spacing)+1;
  if(k.every(period)){
    const row=k.t/period|0,shift=(row%3-1)*spacing/3;
    let blank=k.state.blank??Math.floor(cells/2);
    blank=clamp(blank+(k.unit()<.5?-1:1),2,cells-3);k.state.blank=blank;
    pageRow(k,{spacing,blank,width:k.pick(2,1,1,1),speed:1.7,color:row&1?C.WHITE:C.PALE,shift});
    if(k.rank>=1&&row%k.pick(5,5,4,4)===2)
      k.shot(-184+(368-(cells-1)*spacing)/2+shift+blank*spacing,-4,DOWN,1.7,T.BIG,C8.RED,null,{silent:true,safe:2304});
  }
}
archiveRefusesOriginals.home={x:0,y:84};

/** 翻页「今名旧名之错页」: radial page lines sweep across like a page
 * turning, then every line folds aside; pages alternate direction. */
function misfiledPages(k: AttackKit){
  const cycle=k.pick(104,90,80,72),c=k.t%cycle,side=(k.t/cycle|0)%2?1:-1,steps=k.pick(11,14,16,18);
  if(c<steps*3&&c%3===0){
    const i=c/3,a=DOWN+side*(1.25-i*2.5/(steps-1));
    k.fan(k.ox,k.oy,1,2.9,a,0,T.AMULET,side<0?C.WHITE:C.GREEN,[k.wait(38),k.stopTurn(20,side*1.15,2)],{rows:k.pick(3,4,4,5),speedStep:1.6});
  }
  if(k.rank>=2&&c===steps*3+8)k.ringGap(k.ox,k.oy,24,1.7,T.BALL,C.RED);
}
misfiledPages.home={x:0,y:100};

/** 印符「五重禁带出之印」: five seals orbit the Boss, each writing an arm of
 * a spiral; together they periodically stamp rings with a gap, and now and
 * then each stamps a vermilion seal outward along its own arm. */
function fivefoldSeal(k: AttackKit){
  const radius=k.rank===3?70+16*Math.sin(k.t*.02):70,a0=k.t*.018;
  if(k.every(k.pick(7,5,4,3)))for(let j=0;j<5;j++){
    const a=a0+j*TAU/5;k.shot(k.ox+Math.cos(a)*radius,k.oy+Math.sin(a)*radius*.8,a,2.2,T.AMULET,j%2?C.RED:C.PALE,null,{silent:j>0||k.t%10!==0});
  }
  if(k.every(k.pick(110,96,84,74),40))for(let j=0;j<5;j++){
    const a=a0+j*TAU/5;k.ringGap(k.ox+Math.cos(a)*radius,k.oy+Math.sin(a)*radius*.8,k.pick(8,10,12,14),1.6,T.BALL,C.GREEN,null,{silent:j>0});
  }
  if(k.every(160,100))for(let j=0;j<5;j++){
    const a=a0+j*TAU/5;k.shot(k.ox+Math.cos(a)*radius,k.oy+Math.sin(a)*radius*.8,a,1.5,T.BIG,C8.RED,null,{silent:j>0});
  }
}
fivefoldSeal.home={x:0,y:120};

/** 式札「守门人无字签名」: the gatekeeper signs a five-pointed star of
 * paper toward the player, a point and a notch in turn; after a breath the
 * whole signature folds to one side. A smaller countersignature, inverted,
 * leaves with it and folds the other way, so the two cross into a lattice.
 * Five seals are stamped at the points of a pentagon, one at the player. */
function blankSignature(k: AttackKit){
  const period=k.pick(80,62,52,46);
  if(k.every(period)){
    const wave=k.t/period|0,fold=(wave%2?1:-1)*.75,edge=k.pick(5,6,7,8),a=k.aim()+wave*Math.PI/5;
    burstShape(k,k.ox,k.oy,star(5,edge,.4),2.3,a,T.AMULET,wave%2?C.RED:C.WHITE,[k.wait(44),k.stopTurn(22,fold,1.9)]);
    if(k.rank>=1)burstShape(k,k.ox,k.oy,star(5,edge-2,.4),1.55,a+Math.PI/5,T.AMULET,wave%2?C.WHITE:C.RED,[k.wait(44),k.stopTurn(22,-fold,1.6)],{extra:{silent:true}});
  }
  const seal=k.pick(120,104,96,88);
  if(k.every(seal,seal/2))k.ring(k.ox,k.oy,5,1.7,k.aim(),T.BIG,C8.RED);
}
blankSignature.home={x:0,y:108};

/** Extra midboss 1 — 抄札「仅限借阅之旧名目录」: dashed columns of copies
 * fall, each page laid half a column aside from the last, so the lanes below
 * step like brickwork. All the way down, paired columns trade lanes back and
 * forth and braid into chains of X; every other page the Boss rings out
 * vermilion return slips. */
function borrowOnlyCatalogue(k: AttackKit){
  const spacing=48,slot=6,page=48,dash=6,swap=36,gap=10,c=k.t%page,odd=(k.t/page|0)%2;
  if(c%slot===0&&c/slot<dash){
    const columns=odd?7:8,x0=odd?-144:-168,lean=Math.asin(spacing/(1.9*k.sp*swap)),sway=Math.asin(12/(1.9*k.sp*swap));
    for(let i=0;i<columns;i++){
      // Even pages swap every pair; odd pages swap the outer pairs and sway the middle three together,
      // a quarter column, so they never close on the outer pairs.
      const partner=odd?(i<2?i^1:i===5?6:i===6?5:-1):i^1,dir=partner<0?0:Math.sign(partner-i);
      // Five turns carry a copy off the bottom; a bullet runs at most 24 commands.
      const cmds=[k.wait(30)];
      for(let turn=0;turn<5;turn++){const s=turn%2?-1:1;cmds.push(k.set(DOWN-s*(dir?dir*lean:sway),1.9),k.wait(swap),k.set(DOWN,1.9),k.wait(gap));}
      k.shot(x0+i*spacing,-4,DOWN,1.9,T.AMULET,dir>0?C.PALE:dir<0?C.GREEN:C.WHITE,cmds,{silent:i>0,safe:2304});
    }
  }
  if(k.every(page*2,page))k.ring(k.ox,k.oy,20,1.3,(k.t/(page*2)|0)*Math.PI/20,T.BALL,C.RED);
}
borrowOnlyCatalogue.home={x:0,y:90};

/** Extra midboss 2 — 封印「回声不可携出之页」: square pages open, are pulled
 * back through the seal, and open again on the other side; four seals are
 * stamped toward the player in two layers, one corner always at her. */
function echoMayNotLeave(k: AttackKit){
  const period=42;
  if(k.every(period)){
    const wave=k.t/period|0;
    burstShape(k,k.ox,k.oy,polygon(4,13),3.4,wave*.33,T.AMULET,wave%2?C.RED:C.PALE,[k.stopTurn(46,Math.PI,2.3)]);
  }
  if(k.every(60,30))k.ring(k.ox,k.oy,4,2.2,k.aim(),T.BIG,C8.RED,null,{rows:2,speedStep:1.5});
}
echoMayNotLeave.home={x:0,y:110};

/** Extra midboss 3 — 订正「原件归还，抄本留存」: originals return to the
 * archive; at each turning point a copy is left hanging, then drifts away
 * from the archive, so the copies scatter in every direction. Between
 * returns a green five-pointed correction mark spreads, upright and inverted
 * in turn. */
function originalsReturned(k: AttackKit){
  const period=44;
  if(k.every(period)){
    const n=22,a=k.unit()*TAU,originals=k.ring(k.ox,k.oy,n,3.2,a,T.AMULET,C.RED,[k.stopTurn(40,Math.PI,2.4)]);
    k.later(44,originals,b=>k.shot(b.x,b.y,Math.atan2(b.y-k.oy,b.x-k.ox)+(k.unit()-.5)*.2,0,T.AMULET,C.WHITE,[k.wait(40),k.accel(.022,90)],{silent:true}));
  }
  if(k.every(period*2,22))burstShape(k,k.ox,k.oy,star(5,5,.42),1.5,DOWN+(k.t/(period*2)|0)*TAU/10,T.RICE,C.GREEN);
}
originalsReturned.home={x:0,y:104};

export const FUSAE: BossAttacks=Object.freeze({
  id:'fusae',
  nonspells:[sealSequence,indexOfNames,closedStacks],
  spells:[archiveRefusesOriginals,misfiledPages,fivefoldSeal,blankSignature],
  midboss:{nonspell:shelfSorting,spells:[nonTransferableCard]},
  extraMidboss:[borrowOnlyCatalogue,echoMayNotLeave,originalsReturned],
});
