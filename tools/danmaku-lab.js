/** Asset-free danmaku laboratory. The real thlib bullet and laser fields run
 * every authored emission and motion command; a minimal ANM stand-in only
 * supplies birth readiness, cancel lifetime and sprite extents. Enemies use a
 * small TouhouEnemy-shaped actor with the same onUpdate -> Motion order. */
import {TouhouBulletField,TouhouLaserField,TouhouRNG,TOUHOU_BULLET_STYLES,
  touhouCircleCollision,touhouLaserIntersectsCircle} from '@ts-stg/thlib/touhou';

const BIRTH_FRAMES={7:8,8:16,9:24};
const extentOf=type=>type===46||type===47?96:type===32||type===33?64:
  [18,19,20,21,22,23,24,29,30,43,44,45,48,49].includes(type)?32:16;

class StandInAnimation {
  constructor(script,{x=0,y=0,spriteRemap=null}={}){
    Object.assign(this,{scriptId:script,x,y,spriteRemap,alive:true,ready:false,birth:BIRTH_FRAMES[8],dying:-1,
      children:[],orientation:false,width:16,height:16,spriteIndex:0,words:new Map()});
  }
  U(address,value){if(value===undefined)return address===0x444?(this.ready?1:0):this.words.get(address)??0;this.words.set(address,value>>>0);return value;}
  F(address,value){if(value===undefined)return this.words.get(address)??0;this.words.set(address,value);return value;}
  B(address,value){return this.F(address,value);}
  setSprite(index,remap=false){this.spriteIndex=remap&&this.spriteRemap?this.spriteRemap(index):index;}
  interrupt(label){
    if(label===2){this.ready=true;this.birth=0;}
    else if(BIRTH_FRAMES[label])this.birth=BIRTH_FRAMES[label];
    else if(label===1&&this.dying<0)this.dying=12;
  }
  interruptNow(label){this.interrupt(label);}
  update(){
    if(!this.ready&&--this.birth<=0)this.ready=true;
    if(this.dying>=0&&--this.dying<0)this.alive=false;
  }
  destroy(){this.alive=false;}
  interpolate(){}flag(){}draw(){}drawSelf(){}
  snapshot(){return{script:this.scriptId,sprite:this.spriteIndex,ready:this.ready};}
}

export function createStandInBank(styles=TOUHOU_BULLET_STYLES){
  const sprites=[];
  for(const style of styles)for(const row of style.colors){const id=row[0]|0;if(id>=0){const size=extentOf(style.type);sprites[id]={width:size,height:size};}}
  const bank={data:{sprites},instances:[],create(script,options={}){
    const vm=new StandInAnimation(script,options);bank.instances.push(vm);options.beforeStart?.(vm);return vm;
  }};
  return bank;
}

function standInEnemy(lab,options){
  const position={x:Math.fround(options.x??0),y:Math.fround(options.y??0),z:0};
  const actor={...options,id:++lab.enemyIds,x:position.x,y:position.y,alive:true,entered:false,age:0,
    hp:options.hp??40,maximumHp:options.hp??40,animation:{destroy(){},x:position.x,y:position.y},
    motion:{position,angle:0,speed:0,flags:0,delta:{x:0,y:0,z:0}},
    damage(amount){if(!actor.alive||actor.invulnerable)return 0;actor.hp-=amount;if(actor.hp<=0){actor.alive=false;actor.onDefeat?.(actor);}return amount;}};
  lab.game.enemies.push(actor);return actor;
}
function updateEnemy(actor){
  if(!actor.alive)return;
  actor.onUpdate?.(actor,{});if(!actor.alive)return;
  const m=actor.motion;m.position.x=Math.fround(m.position.x+Math.cos(m.angle)*m.speed);
  m.position.y=Math.fround(m.position.y+Math.sin(m.angle)*m.speed);actor.x=m.position.x;actor.y=m.position.y;
  const outside=Math.abs(actor.x)>208||actor.y<-16||actor.y>464;
  if(!outside)actor.entered=true;else if(actor.entered)actor.alive=false;
  actor.age++;
}

export function standInBoss(x=0,y=112){
  const position={x,y,z:0};
  return{x,y,hp:1e9,maximumHp:1e9,invulnerable:true,alive:true,bossId:'lab',
    motion:{position,angle:0,speed:0,flags:0,delta:{x:0,y:0,z:0}},animation:{x,y}};
}

/** Lab field. `step()` runs one frame in TouhouGame order after the caller's
 * script update: enemies, player movement, bullets, lasers. */
export function createDanmakuLab({seed=73,x=0,y=400,capacity=4000,difficulty=1}={}){
  const bank=createStandInBank();
  const player={x,y,collisionCircle:()=>0,collisionRectangle:()=>0,addGraze(){}};
  const lab={enemyIds:0,frame:0,emitted:0,lasersSpawned:0,peak:0,peakLasers:0};
  const bullets=new TouhouBulletField({bank,styles:TOUHOU_BULLET_STYLES,capacity});
  const lasers=new TouhouLaserField({bank:null,styles:TOUHOU_BULLET_STYLES});
  const emit=bullets.emit.bind(bullets),spawn=lasers.spawn.bind(lasers);
  bullets.emit=(parameters,options)=>{const out=emit(parameters,options);lab.emitted+=out.length;return out;};
  lasers.spawn=(kind,parameters)=>{const out=spawn(kind,parameters);if(out)lab.lasersSpawned++;return out;};
  lab.game={player,difficulty,rng:new TouhouRNG(seed),bullets,lasers,enemies:[],banks:{effect:null},
    items:{spawnEnemyDrops(){},spawnBossDrops(){}},spawnEnemy:options=>standInEnemy(lab,options)};
  bullets.player=player;
  lab.step=(move)=>{
    for(const actor of lab.game.enemies)updateEnemy(actor);
    lab.game.enemies=lab.game.enemies.filter(actor=>actor.alive);
    if(move){player.x=Math.max(-184,Math.min(184,move.x));player.y=Math.max(16,Math.min(440,move.y));}
    bullets.update(player,{});lasers.update(player,{});lab.frame++;
    lab.peak=Math.max(lab.peak,bullets.count);lab.peakLasers=Math.max(lab.peakLasers,lasers.count);
  };
  lab.live=()=>bullets.bullets.filter(b=>(b.state===1||b.state===2)&&b.collisionEnabled);
  lab.hit=(px=player.x,py=player.y,radius=3)=>{
    for(const b of bullets.bullets)if((b.state===1||b.state===2)&&b.collisionEnabled&&Math.abs(b.x-px)<40&&Math.abs(b.y-py)<40&&
      touhouCircleCollision(px,py,radius,b.x,b.y,b.radius)===1)return true;
    for(const l of lasers.lasers)if(l.alive&&touhouLaserIntersectsCircle(l,px,py,radius))return true;
    return false;
  };
  return lab;
}

const DIRECTIONS=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2],[-Math.SQRT1_2,Math.SQRT1_2],[Math.SQRT1_2,-Math.SQRT1_2],[-Math.SQRT1_2,-Math.SQRT1_2]];
const segmentDistance=(px,py,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l));return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));};

/** Heuristic dodging pilot: it never alters bullets and only proposes a legal
 * focused (2 px) or unfocused (4.5 px) step. Surviving with it is evidence of
 * open routes; a hit only marks a spot for review, not proof of a wall. */
export function createPilot({home={x:0,y:396},margin=1.5,horizon=16,slow=2,fast=4.5,top=236}={}){
  return{home,decide(lab){
    const p=lab.game.player,threats=[],beams=[];
    for(const b of lab.game.bullets.bullets){
      if(!(b.state===1||b.state===2)||!b.collisionEnabled)continue;
      const dx=b.x-p.x,dy=b.y-p.y;if(dx*dx+dy*dy<190*190)threats.push(b);
    }
    for(const l of lab.game.lasers.lasers)if(l.alive&&l.kind===1&&l.state!==5)beams.push(l);
    let best=null;
    for(const speed of[slow,fast])for(const [ux,uy] of DIRECTIONS){
      if(speed===fast&&!ux&&!uy)continue;
      let clearance=Infinity;
      for(let t=1;t<=horizon;t++){
        const px=Math.max(-184,Math.min(184,p.x+ux*speed*t)),py=Math.max(top,Math.min(440,p.y+uy*speed*t));
        const weight=1+(horizon-t)*.06;
        for(const b of threats){
          const rate=b.state===2?.5:1,bx=b.x+b.vx*t*rate,by=b.y+b.vy*t*rate;
          const gap=(Math.hypot(bx-px,by-py)-b.radius-3-margin)*weight;if(gap<clearance)clearance=gap;
        }
        for(const l of beams){
          const active=l.state===2||l.state===4||(l.state===3&&l.p.delay-l.age.current<=t+2);if(!active)continue;
          const angle=l.angle+(l.p.angularVelocity||0)*t,ex=l.position.x+Math.cos(angle)*l.length,ey=l.position.y+Math.sin(angle)*l.length;
          const gap=(segmentDistance(px,py,l.position.x,l.position.y,ex,ey)-l.p.width*.26-3-margin)*weight;if(gap<clearance)clearance=gap;
        }
        if(clearance<-40)break;
      }
      const nx=Math.max(-184,Math.min(184,p.x+ux*speed)),ny=Math.max(top,Math.min(440,p.y+uy*speed));
      const drift=Math.hypot(nx-home.x,ny-home.y)*.016+Math.max(0,Math.abs(nx)-140)*.08+(speed===fast?.35:0)+(ux||uy?.05:0);
      const score=Math.min(clearance,24)-drift;
      if(!best||score>best.score)best={score,x:nx,y:ny};
    }
    return best;
  }};
}

/** Run one scripted attack in the lab. `update(lab,frame)` performs the
 * authored script call; the pilot (optional) supplies player movement. */
export function runAttack({update,frames,seed=73,difficulty=1,pilot=true,onFrame,drain=0}={}){
  const lab=createDanmakuLab({seed,difficulty}),driver=pilot===true?createPilot():pilot||null;
  let hits=0,hitFrames=0,lastHit=-999;const hitTimes=[];
  for(let frame=0;frame<frames;frame++){
    update(lab,frame);
    lab.step(driver?driver.decide(lab):null);
    if(driver&&lab.hit()){hitFrames++;if(frame-lastHit>45){hits++;hitTimes.push(frame);}lastHit=frame;}
    onFrame?.(lab,frame);
  }
  for(let i=0;i<drain;i++)lab.step(null);
  return{lab,hits,hitFrames,hitTimes,peak:lab.peak,peakLasers:lab.peakLasers,emitted:lab.emitted,lasers:lab.lasersSpawned};
}
