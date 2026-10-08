/** Render asset-free contact sheets and pilot statistics for authored attacks.
 * node tools/preview-danmaku.mjs --stage 1 [--kind spell|nonspell|midboss|road|all] [--difficulty 1,3]
 * Images are written to the ignored reports/danmaku/ directory. They show
 * geometry only; native sprites, blending and HUD need a real engine run. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runAttack,standInBoss} from './danmaku-lab.js';
import {Canvas,bulletColor,bulletShape} from './danmaku-png.js';
import {attackCatalog} from './danmaku-catalog.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SCALE=.6,CELL_W=Math.round(384*SCALE),CELL_H=Math.round(448*SCALE);

export function drawField(canvas,lab,boss,ox,oy){
  canvas.rect(ox,oy,CELL_W,CELL_H,[14,18,34]);
  const X=x=>ox+(x+192)*SCALE,Y=y=>oy+y*SCALE;
  for(const l of lab.game.lasers.lasers){
    if(!l.alive)continue;
    if(l.kind===1){
      const ex=l.position.x+Math.cos(l.angle)*l.length,ey=l.position.y+Math.sin(l.angle)*l.length;
      const warning=l.state===3,color=bulletColor(0,l.p.color);
      canvas.line(X(l.position.x),Y(l.position.y),X(ex),Y(ey),warning?1:Math.max(1.2,l.width*SCALE*.7),color,warning?.35:.85);
    }else if(l.samples){for(let i=1;i<l.samples.length;i++){const a=l.samples[i-1].position,b=l.samples[i].position;canvas.line(X(a.x),Y(a.y),X(b.x),Y(b.y),Math.max(1.2,l.p.width*SCALE*.6),bulletColor(0,l.p.color),.8);}}
    else{const ex=l.position.x+Math.cos(l.angle)*l.length,ey=l.position.y+Math.sin(l.angle)*l.length;canvas.line(X(l.position.x),Y(l.position.y),X(ex),Y(ey),Math.max(1.2,l.width*SCALE*.6),bulletColor(0,l.p.color),.85);}
  }
  for(const actor of lab.game.enemies)if(actor.alive)canvas.circle(X(actor.x),Y(actor.y),actor.roadRole==='guard'?8:5,[80,220,140],.8);
  if(boss)canvas.circle(X(boss.x),Y(boss.y),9,[230,90,200],.9);
  for(const b of lab.game.bullets.bullets){
    if(!(b.state===1||b.state===2))continue;
    const shape=bulletShape(b.type),color=bulletColor(b.type,b.color),alpha=b.state===2?.45:1;
    if(shape.oriented)canvas.ellipse(X(b.x),Y(b.y),shape.ry*SCALE,shape.rx*SCALE,b.angle,color,alpha);
    else canvas.circle(X(b.x),Y(b.y),shape.rx*SCALE,color,alpha);
    canvas.circle(X(b.x),Y(b.y),Math.max(.7,shape.rx*SCALE*.42),[255,255,255],alpha*.8);
  }
  const p=lab.game.player;canvas.circle(X(p.x),Y(p.y),4,[255,255,255]);canvas.circle(X(p.x),Y(p.y),1.6,[255,40,40]);
}

export function previewAttack(entry,{difficulty,shots=8,seed=73,at=null,out=path.join(ROOT,'reports','danmaku')}={}){
  const frames=entry.frames,boss=entry.kind==='road'?null:standInBoss(entry.bossX??0,entry.bossY??112);
  if(at)shots=at.length;
  const marks=new Set(at??Array.from({length:shots},(_,i)=>Math.round(entry.preview?.[i]??(150+(frames-180)*i/Math.max(1,shots-1)))));
  const columns=4,rows=Math.ceil(shots/columns),canvas=new Canvas(columns*CELL_W+(columns+1)*6,rows*CELL_H+(rows+1)*6);
  let cell=0,total=0,samples=0;const update=entry.create({difficulty,seed,boss});
  const result=runAttack({frames,seed,difficulty,update,onFrame:(lab,frame)=>{
    total+=lab.game.bullets.count;samples++;
    if(marks.has(frame)&&cell<shots){const ox=6+(cell%columns)*(CELL_W+6),oy=6+(cell/columns|0)*(CELL_H+6);drawField(canvas,lab,boss,ox,oy);
      canvas.rect(ox,oy+CELL_H-3,Math.round(CELL_W*frame/frames),3,[255,210,120]);cell++;}
  }});
  fs.mkdirSync(out,{recursive:true});
  const file=path.join(out,`${entry.key}-d${difficulty}.png`);fs.writeFileSync(file,canvas.png());
  return{key:entry.key,name:entry.name,difficulty,frames,peak:result.peak,mean:Math.round(total/samples),emitted:result.emitted,
    lasers:result.lasers,pilotHits:result.hits,hitFrames:result.hitFrames,hitTimes:result.hitTimes,file:path.relative(ROOT,file)};
}

function argument(name,fallback){const i=process.argv.indexOf(`--${name}`);return i>0?process.argv[i+1]:fallback;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const stage=argument('stage','all'),kind=argument('kind','all'),only=argument('key',null),shots=Number(argument('shots','8'));
  const at=argument('at',null)?.split(',').map(Number)??null;
  const difficulties=argument('difficulty','1,3').split(',').map(Number);
  const entries=attackCatalog().filter(e=>(stage==='all'||e.stageId===Number(stage))&&(kind==='all'||e.kind===kind)&&(!only||e.key.includes(only)));
  for(const entry of entries)for(const difficulty of entry.stageId===7?[4]:difficulties){
    const row=previewAttack(entry,{difficulty,shots,at});
    console.log(process.argv.includes('--json')?JSON.stringify(row):
      `${row.key.padEnd(48)} d${difficulty} peak ${String(row.peak).padStart(4)} mean ${String(row.mean).padStart(4)} lasers ${String(row.lasers).padStart(3)} pilotHits ${row.pilotHits}${row.hitTimes.length?` at ${row.hitTimes.join(',')}`:''}`);
  }
}
