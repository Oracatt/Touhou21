/** Asset-free stand-in for the parts of TouhouGame the campaign director
 * talks to. Real thlib bullet/laser fields run underneath (danmaku-lab); the
 * Boss lifecycle is reduced to its observable contract: entrance readiness,
 * HP, the spell clock with capture / timeout / survival expiry, escape and
 * final burst events. It checks director flow, not public presentation. */
import {createDanmakuLab} from './danmaku-lab.js';

export function createDirectorGame({seed=73,difficulty=1}={}){
  const lab=createDanmakuLab({seed,difficulty}),game=lab.game,events=[],timers=[];
  const after=(frames,fire)=>timers.push({at:lab.frame+frames,fire});
  game.lab=lab;game.frame=0;game.events=events;game.session={mode:0,stage:1,continues:0};
  game.player.score=0;game.player.continues=0;game.bossHudState={};game.bossRegistry=new Map();
  game.context={sound(){},dialogue:false,inputBlocked:false,bossSuppressed:false,enemyContactBlocked:false,boss:null,
    cancelCircle:(x,y,radius)=>{game.bullets.cancelCircle(x,y,radius);game.lasers.cancelCircle(x,y,radius);}};
  game.drops=[];game.items.spawnBossDrops=(boss,options)=>game.drops.push({x:boss.x,y:boss.y,...options});
  game.bossPresentation={entranceReady:false,charges:[],clearCharges(){this.charges.length=0;},
    beginCharge(options){const charge={...options,alive:true,stopped:false,release:true,releaseFrame:options.releaseFrame??60};this.charges.push(charge);return charge;},
    beginDeath(){}};
  game.spell={active:false,mode:0,stage:1,survival:false,id:0,remaining:0,
    finish(captured,timeout){if(!this.active)return;this.active=false;game.onEvent?.('spellFinish',{id:this.id,captured,timeout});},
    capture(){this.finish(true,false);},timeout(){this.finish(false,true);}};
  game.setBoss=boss=>{game.context.boss=boss;};
  game.registerBoss=(boss,{onDefeated})=>{game.bossRegistry.set(boss,onDefeated);
    const damage=boss.damage;boss.damage=(amount,source)=>{if(!boss.alive||boss.invulnerable)return 0;boss.hp-=amount;
      if(boss.hp<=0){boss.hp=0;onDefeated({boss,source});}return amount;};};
  const prepare=boss=>{boss.prepareSpellHealth=hp=>{boss.hp=hp;boss.spellHealth=true;return boss;};
    boss.prepareNormalHealth=hp=>{boss.hp=hp;boss.spellHealth=false;return boss;};};
  const spawn=game.spawnEnemy;game.spawnEnemy=options=>{const enemy=spawn(options);prepare(enemy);return enemy;};
  game.enterBoss=(boss,{entrance})=>{game.context.boss=boss;game.bossPresentation.entranceReady=false;
    after(entrance?.readyFrame??90,()=>{game.bossPresentation.entranceReady=true;});};
  game.setBossHud=state=>{Object.assign(game.bossHudState,state);};
  game.resumeBoss=()=>{};game.startBossCombat=()=>{game.combat=true;};game.stopBossCombat=()=>{game.combat=false;};
  game.beginSpell=({id,duration,survival})=>{Object.assign(game.spell,{active:true,id,remaining:duration,survival:!!survival});};
  game.removeBoss=enemy=>{enemy.alive=false;game.bossRegistry.delete(enemy);if(game.context.boss===enemy)game.context.boss=null;};
  game.beginBossEscape=(boss,{duration=60})=>{game.context.boss=null;after(duration,()=>{game.onEvent?.('bossescape',{enemy:boss});game.removeBoss(boss);});};
  game.beginBossDefeat=boss=>{after(60,()=>{game.spell.finish(true,false);game.onEvent?.('bossburst',{enemy:boss});});};
  game.update=()=>{
    if(typeof game.stage==='function')game.stage(game,game.frame);
    if(game.spell.active&&--game.spell.remaining<=0)game.spell.finish(game.spell.survival,!game.spell.survival);
    lab.step(null);game.frame++;
    for(const timer of timers.splice(0).filter(t=>{if(t.at<=lab.frame){t.fire();return false;}return true;}))timers.push(timer);
  };
  return game;
}

/** Drive a whole director route. `strike(director)` may damage the current
 * Boss; the default defeats each phase shortly after it starts attacking. */
export function runDirectorRoute(Director,{stages,midbosses,mode='stage-practice',stageId=1,spellId=null,difficulty=1,seed=73,
  limit=60000,strikeAfter=150,strike=null}={}){
  const game=createDirectorGame({seed,difficulty}),log=[];let finished=null;
  const director=new Director({stages,midbosses,mode,stageId,spellId,difficulty,seed,callbacks:{
    dialogue:(lines,{onComplete,kind,stage})=>{log.push(`dialogue:${stage.id}:${kind}`);onComplete();},
    stageClear:(stage,{onComplete})=>{log.push(`clear:${stage.id}`);onComplete();},
    complete:result=>{finished=result;},
  }}).attach(game);
  let frames=0,peak=0;
  for(;frames<limit&&!director.completed;frames++){
    const d=director;
    if(strike)strike(d,game);
    else if(['combat','midboss-combat'].includes(d.state)&&d.phaseFrame>=strikeAfter&&d.boss&&!(d.state==='combat'?d.phase?.spec?.survival:d.midbossPhase?.spec?.survival))
      d.boss.damage(1e9,{type:'lab-strike'});
    game.update();peak=Math.max(peak,game.bullets.count);
  }
  return{director,game,log,finished,frames,peak,events:director.events};
}
