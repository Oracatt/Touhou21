import {TouhouBossPhasePlan,TouhouItemType,clearTouhouBossPhase,TouhouRNG} from '@ts-stg/thlib/touhou';
import {updateSpellPattern,updateMidbossSpellPattern,updateNonspellPattern,STAGE_PATTERN_OFFSETS} from './patterns.js';
import {createRoadPlan,spawnRoadFormation} from './roads.js';
import {bossNonspellHealth,midbossNormalHealth} from './boss-health.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MODES=new Set(['normal','extra','stage-practice','spell-practice']);
const actorPosition=(enemy,x,y)=>{enemy.x=Math.fround(x);enemy.y=Math.fround(y);
  Object.assign(enemy.motion.position,{x:enemy.x,y:enemy.y});Object.assign(enemy.animation,{x:enemy.x,y:enemy.y});};

/** This game's script director. Common thlib owns the complete player and
 * collision rules, enemy HP, segmented HUD, card bonus, drops and presentation.
 * Callback continuations are idempotent and do not advance fixed attack clocks. */
export class CampaignDirector{
  constructor({stages,midbosses=[],character=0,difficulty=1,mode='normal',stageId=1,spellId=null,callbacks={},seed=1}={}){
    if(!Array.isArray(stages)||stages.length!==7)throw new TypeError('The campaign requires six stages and Extra');
    if(!MODES.has(mode))throw new RangeError('Unknown campaign mode');
    if(!Number.isInteger(difficulty)||difficulty<0||difficulty>4)throw new RangeError('Unknown difficulty');
    this.stages=stages;this.midbosses=midbosses;this.character=character?1:0;this.difficulty=mode==='extra'?4:difficulty;
    this.mode=mode;this.stageId=mode==='extra'?7:stageId;this.spellId=spellId;this.callbacks=callbacks;
    this.rng=new TouhouRNG(seed);this.state='new';this.stageFrame=0;this.phaseFrame=0;this.phaseIndex=-1;
    this.waitFrames=0;this.boss=null;this.phases=[];this.phasePlan=null;this.patternState={};
    this.captures=[];this.completed=false;this.destroyed=false;this.dialogueContinuation=null;this.stageContinuation=null;
    this.midbossDone=false;this.finishing=false;this.finalResult=null;this.events=[];this.totalClock=0;
    this.chargeCue=null;
  }
  attach(game){
    if(this.game)throw new Error('Director already attached');this.game=game;
    this.originalStage=game.stage;this.originalEvent=game.onEvent;
    this.originalInteraction={dialogue:game.context.dialogue,inputBlocked:game.context.inputBlocked,
      bossSuppressed:game.context.bossSuppressed,enemyContactBlocked:game.context.enemyContactBlocked};
    game.stage=(scene,frame)=>this.update(scene,frame);
    game.onEvent=(name,data)=>{this.onEvent(name,data,game);this.originalEvent?.(name,data);};
    game.session.mode=this.mode==='spell-practice'?2:this.mode==='stage-practice'?1:0;
    game.spell.mode=game.session.mode;this._startStage(game);return this;
  }
  get stage(){return this.stages.find(stage=>stage.id===this.stageId);}
  get phase(){return this.phases[this.phaseIndex]??null;}
  _onBossDefeated({boss,source}){
    if(this.destroyed||boss!==this.boss)return;
    if(this.state==='midboss-combat'){
      if(this.midbossPhases?.length)this._finishMidbossPhase(this.game,{source});else this._finishMidboss(this.game,source);
    }else if(this.state==='combat')this._finishPhase(this.game,{defeated:true,source});
  }
  _startStage(game){
    const stage=this.stage;if(!stage)throw new RangeError(`Missing stage ${this.stageId}`);
    this.stageFrame=0;this.phaseFrame=0;this.phaseIndex=-1;this.midbossDone=false;this.boss=null;this.patternState={};
    this.roadPlan=createRoadPlan(stage.id,stage.roadFrames);this.roadWaveIndex=0;this.roadSectionIndex=-1;
    game.session.stage=stage.id;game.spell.stage=stage.id;game.context.bossSuppressed=false;game.context.enemyContactBlocked=false;
    game.context.dialogue=false;game.context.inputBlocked=false;
    game.setBoss(null);game.stopBossCombat();game.bossPresentation?.clearCharges();this.callbacks.stageStart?.(stage);
    this.callbacks.music?.(this.mode==='spell-practice'?stage.bgmBoss:stage.bgmStage);
    if(this.mode==='spell-practice')this._spawnBoss(game,{practice:true});else this.state='road';
  }
  _clear(game){
    clearTouhouBossPhase({x:this.boss?.x??0,y:this.boss?.y??128,cancelCircle:game.context.cancelCircle,
      clearEnemies:()=>{for(const enemy of game.enemies)if(enemy!==this.boss&&enemy.alive)game.removeBoss(enemy);
        for(const enemy of game.enemies)if(enemy!==this.boss)for(const effect of enemy.effects??[])effect.destroy();},
      stopAttack:()=>{this.patternState={};game.bossPresentation?.clearCharges();}});
  }
  _spawnRoadWave(game,wave){
    const actors=spawnRoadFormation({game,wave,stageId:this.stageId,difficulty:this.difficulty,rng:this.rng,
      isActive:()=>this.state==='road',canFire:()=>this.stageFrame<wave.fireUntil,onAttack:this.callbacks.roadAttack});
    this.events.push({event:'road-wave',stage:this.stageId,waveId:wave.id,sectionId:wave.sectionId,
      attack:wave.attack,formation:wave.formation,role:wave.role,count:actors.length,roadFrame:this.stageFrame,frame:this.totalClock});
  }
  _spawnMidboss(game){
    this._clear(game);this.midbossDone=true;this.state='midboss-enter';this.phaseFrame=0;
    this.midbossSpec=this.midbosses.find(entry=>entry.stageId===this.stageId);
    this.midbossDuration=Math.round((this.midbossSpec?.seconds??25)*60);
    if(!Number.isSafeInteger(this.midbossDuration)||this.midbossDuration<=0)throw new RangeError('Midboss time limit must be positive integer frames');
    this.midbossExit=this.midbossSpec?.exit??((this.midbossSpec?.bossId??this.stage.bossId)===this.stage.bossId?'escape':'defeat');
    if(!['escape','defeat'].includes(this.midbossExit))throw new RangeError('Unknown midboss exit');
    this.midbossPhases=(this.midbossSpec?.spells??[]).map((spec,spellIndex)=>({spell:true,spec,spellIndex,
      hp:2300+spellIndex*180,duration:Math.round(spec.seconds*60),code:32+spellIndex,midboss:true}));
    this.midbossPhaseIndex=0;
    const hp=this.midbossPhases.length?this.midbossPhases[0].hp:midbossNormalHealth(this.stageId);
    const boss=game.spawnEnemy({x:150,y:20,hp,radius:16,script:30,directional:false,damageInvulnerability:0,
      deathBank:game.banks.effect,drop:[]});
    game.registerBoss(boss,{onDefeated:event=>this._onBossDefeated(event)});
    boss.kind='midboss';boss.bossId=this.midbossSpec?.bossId??this.stage.bossId;boss.maximumHp=hp;boss.invulnerable=true;this.boss=boss;
    game.enterBoss(boss,{entrance:{mode:'flyIn',readyFrame:60,follow:boss}});
    game.setBossHud({name:this.stage.midbossName??this.stage.bossId,remainingSpells:0,dialogue:true,
      healthBars:[{current:hp,maximum:hp,phaseHealth:hp,markers:[]}]});
    this.callbacks.bossSpawn?.(boss,{bossId:boss.bossId,midboss:true});
  }
  _beginMidbossPhase(game,index){
    this.midbossPhaseIndex=index;this.phaseFrame=0;this.patternState={};this.state='midboss-combat';
    const phase=this.midbossPhases[index],boss=this.boss;boss.invulnerable=!!phase.spec.survival;
    boss.motion.flags=0;boss.motion.speed=0;Object.assign(boss.motion.delta,{x:0,y:0,z:0});
    boss.prepareSpellHealth(phase.hp);boss.maximumHp=phase.hp;game.resumeBoss(boss);boss.invulnerable=!!phase.spec.survival;game.startBossCombat();
    game.context.bossSuppressed=false;game.context.enemyContactBlocked=false;
    game.setBossHud({dialogue:false,remainingSpells:this.midbossPhases.length-index-1,
      healthBars:[{current:phase.hp,maximum:phase.hp,phaseHealth:phase.hp,markers:[],animateFill:false}]});
    this._charge(game,'red');
    game.beginSpell({...this._spellPresentation(phase,boss,true),id:phase.code,name:phase.spec.name,
      duration:phase.duration,survival:!!phase.spec.survival,boss});
  }
  _spellPresentation(phase,boss,midboss=false){
    const visual=this.callbacks.spellStart?.(phase.spec,{code:phase.code,stage:this.stage,boss,bossId:boss.bossId,midboss})??{};
    return{background:visual.background??null,portrait:visual.portrait??null,keepStageBackground:visual.keepStageBackground??true};
  }
  _charge(game,color){
    // st01bs Boss1: one ECL307 charge, sound54, wait60, one release.
    const charge=game.bossPresentation?.beginCharge({color,follow:this.boss,repeatCount:1,releaseFrame:60,clock:()=>this.phaseFrame});
    this.chargeCue=charge?{owner:charge,releasePlayed:false}:null;
    if(charge)game.context.sound?.(54,this.boss.x);
    return charge;
  }
  _releaseChargeSound(game){
    const cue=this.chargeCue;
    if(!cue)return;
    if(cue.owner.stopped||!cue.owner.alive){this.chargeCue=null;return;}
    if(!cue.releasePlayed&&cue.owner.release&&this.phaseFrame>=cue.owner.releaseFrame){
      cue.releasePlayed=true;game.context.sound?.(6,this.boss?.x??cue.owner.position.x);
    }
  }
  _finishMidbossPhase(game,{timeout=false,source=null}={}){
    if(this.state!=='midboss-combat'||this.finishing)return;this.finishing=true;
    const phase=this.midbossPhases[this.midbossPhaseIndex];this.boss.invulnerable=true;
    if(game.spell.active){if(timeout)game.spell.timeout(game.context);else game.spell.capture(game.context);}
    this._clear(game);game.items.spawnBossDrops(this.boss,{counts:{[TouhouItemType.POWER]:4,[TouhouItemType.POINT]:5},
      timedOut:timeout,survival:!!phase.spec.survival,mode:game.session.mode});this.finishing=false;
    if(this.midbossPhaseIndex+1<this.midbossPhases.length){
      game.context.sound?.(27,this.boss.x);this.state='midboss-phase-wait';this.waitFrames=60;
    }
    else this._finishMidboss(game,source,{timeout});
  }
  _finishMidboss(game,source=null,{timeout=false}={}){
    if(!['midboss-combat','midboss-phase-wait'].includes(this.state))return;this.state='midboss-exit';this.phaseFrame=0;
    const boss=this.boss;this._clear(game);boss.invulnerable=true;
    game.items.spawnBossDrops(boss,{counts:{[TouhouItemType.LARGE_POWER]:2,[TouhouItemType.POINT]:5},centerType:TouhouItemType.BOMB_FRAGMENT,
      timedOut:timeout,mode:game.session.mode});
    game.stopBossCombat();
    if(this.midbossExit==='escape'||timeout){
      game.beginBossEscape(boss,{source,target:{x:timeout?0:192,y:-32},duration:60,easing:4});
      this.events.push({event:'midboss-retreat',stage:this.stageId,timeout,frame:this.totalClock});
    }else{
      game.bossPresentation?.beginDeath({x:boss.x,y:boss.y,follow:null,delayFrames:0});
      game.removeBoss(boss);game.setBoss(null);this.boss=null;
    }
  }
  _buildPhases(){
    const stage=this.stage;
    if(this.mode==='spell-practice'){
      let spellIndex=stage.spells.findIndex(spell=>spell.id===this.spellId),spells=stage.spells,midboss=false;
      if(spellIndex<0){spells=this.midbosses.find(entry=>entry.stageId===stage.id)?.spells??[];
        spellIndex=spells.findIndex(spell=>spell.id===this.spellId);midboss=true;}
      if(spellIndex<0)throw new RangeError(`Missing practice spell ${this.spellId}`);
      const spec=spells[spellIndex];return[{spell:true,spec,spellIndex,midboss,hp:1800+stage.id*220+spellIndex*110,
        code:midboss?32+spellIndex:1+STAGE_PATTERN_OFFSETS[stage.id-1]+spellIndex,duration:Math.round(spec.seconds*60)}];
    }
    const phases=[];
    stage.spells.forEach((spec,spellIndex)=>{
      phases.push({spell:false,hp:bossNonspellHealth(stage.id,spellIndex),duration:(32+Math.min(18,stage.id*3))*60,spellIndex});
      phases.push({spell:true,spec,spellIndex,code:1+STAGE_PATTERN_OFFSETS[stage.id-1]+spellIndex,
        hp:1800+stage.id*220+spellIndex*110,duration:Math.round(spec.seconds*60)});
    });return phases;
  }
  _spawnBoss(game,{practice=false}={}){
    this._clear(game);this.phases=this._buildPhases();this.phasePlan=new TouhouBossPhasePlan(this.phases);
    this.phaseIndex=-1;this.phaseFrame=0;this.state='boss-enter';
    const boss=game.spawnEnemy({x:0,y:105,hp:this.phases[0].hp,radius:16,script:30,directional:false,
      deathBank:game.banks.effect,drop:[],damageInvulnerability:0});
    game.registerBoss(boss,{onDefeated:event=>this._onBossDefeated(event)});
    boss.kind='boss';boss.bossId=this.phases[0].midboss?this.midbosses.find(entry=>entry.stageId===this.stageId)?.bossId??'fusae':this.stage.bossId;
    boss.invulnerable=true;this.boss=boss;
    game.enterBoss(boss,{entrance:{mode:practice?'flyIn':'blackFog',follow:boss}});
    game.setBossHud({name:this.stage.bossName??this.stage.bossId,dialogue:true,...this.phasePlan.hudState(0)});
    this.callbacks.bossSpawn?.(boss,{bossId:boss.bossId,midboss:false});
    this.callbacks.music?.(this.stage.bgmBoss);
  }
  _dialogue(game,kind,continuation,linesOverride=null){
    this.state='dialogue';this.dialogueKind=kind;this.dialogueContinuation=continuation;
    game.stopBossCombat();game.bossPresentation?.clearCharges();game.context.bossSuppressed=true;game.context.enemyContactBlocked=true;
    game.context.dialogue=true;game.context.inputBlocked=true;
    if(this.boss)this.boss.invulnerable=true;game.setBossHud({dialogue:true});
    const route=this.character?'marisa':'reimu',lines=linesOverride??this.stage.dialogues?.[route]?.[kind]??[];
    if(!lines.length||!this.callbacks.dialogue){this.continueDialogue();return;}
    this.callbacks.dialogue(lines,{stage:this.stage,bossId:this.boss?.bossId??this.stage.bossId,kind,onComplete:()=>this.continueDialogue()});
  }
  continueDialogue(){
    if(this.state!=='dialogue'||!this.dialogueContinuation)return false;
    const next=this.dialogueContinuation;this.dialogueContinuation=null;
    this.game.context.bossSuppressed=false;this.game.context.enemyContactBlocked=false;
    this.game.context.dialogue=false;this.game.context.inputBlocked=false;next();return true;
  }
  _beginPhase(game,index){
    if(index<0||index>=this.phases.length)throw new RangeError('Invalid phase transition');
    this.phaseIndex=index;this.phaseFrame=0;this.patternState={};this.state='combat';const phase=this.phase,boss=this.boss;
    boss.motion.flags=0;boss.motion.speed=0;Object.assign(boss.motion.delta,{x:0,y:0,z:0});
    boss.primaryFlags&=~0x93;boss.invulnerable=!!phase.spec?.survival;
    boss.maximumHp=phase.hp;phase.spell?boss.prepareSpellHealth(phase.hp):boss.prepareNormalHealth(phase.hp);
    game.resumeBoss(boss);boss.primaryFlags&=~0x93;boss.invulnerable=!!phase.spec?.survival;
    game.startBossCombat();game.context.bossSuppressed=false;game.context.enemyContactBlocked=false;
    game.setBossHud({name:this.stage.bossName??this.stage.bossId,dialogue:false,...this.phasePlan.hudState(index)});
    // Ring fill must be finished before an attack begins. A shared ring carries
    // its remaining segment from nonspell into its spell without a new refill.
    if(index===0||!phase.spell)game.setBossHud({healthBars:this.phasePlan.hudState(index).healthBars.map(bar=>({...bar,animateFill:false}))});
    this._charge(game,['yellow','cyan','yellow','magenta','red','yellow','white'][this.stageId-1]);
    if(phase.spell)game.beginSpell({...this._spellPresentation(phase,boss,!!phase.midboss),id:phase.code,name:phase.spec.name,
      duration:phase.duration,survival:!!phase.spec.survival,boss});
    this.events.push({event:'phase-start',stage:this.stageId,index,spell:phase.spell,frame:this.totalClock});
  }
  _finishPhase(game,{defeated=false,timeout=false,source=null}={}){
    if(this.state!=='combat'||this.finishing)return;this.finishing=true;
    const phase=this.phase,final=this.phaseIndex===this.phases.length-1;
    if(final){
      this.state='boss-defeat';this.boss.invulnerable=true;this.finalResult={timeout,survival:!!phase.spec?.survival};
      game.bossPresentation?.clearCharges();
      game.beginBossDefeat(this.boss,{source});this.finishing=false;return;
    }
    this.boss.invulnerable=true;
    if(phase.spell&&game.spell.active){if(timeout)game.spell.timeout(game.context);else game.spell.capture(game.context);}
    // Ordinary ECL phase handoff (st01bs Boss2 / BossCard1). This is separate
    // from the public successful-bonus sound46 and final Boss burst sound5.
    game.context.sound?.(27,this.boss.x);
    this._clear(game);
    if(phase.spell)game.items.spawnBossDrops(this.boss,{counts:{[TouhouItemType.POWER]:5,[TouhouItemType.POINT]:6},
      centerType:phase.spellIndex%2?TouhouItemType.BOMB_FRAGMENT:TouhouItemType.LIFE_FRAGMENT,
      mode:game.session.mode,timedOut:timeout,survival:!!phase.spec?.survival});
    this.events.push({event:'phase-end',stage:this.stageId,index:this.phaseIndex,defeated,timeout,frame:this.totalClock});
    this.finishing=false;
    if(!phase.spell)this._beginPhase(game,this.phaseIndex+1);
    else{
      this.state='phase-wait';this.waitFrames=60;this.phaseFrame=0;
      const next=this.phases[this.phaseIndex+1];this.boss.prepareNormalHealth(next.hp);this.boss.maximumHp=next.hp;
      game.setBossHud({...this.phasePlan.hudState(this.phaseIndex+1),dialogue:false,
        healthBars:this.phasePlan.hudState(this.phaseIndex+1).healthBars.map(bar=>({...bar,animateFill:false}))});
    }
  }
  onEvent(name,data,game=this.game){
    if(this.destroyed)return;
    if(name==='spellFinish'){
      this.captures.push({stage:this.stageId,...data});
      if(this.state==='combat'&&!this.finishing)this._finishPhase(game,{timeout:data.timeout||game.spell.survival});
      else if(this.state==='midboss-combat'&&this.midbossPhases?.length&&!this.finishing)
        this._finishMidbossPhase(game,{timeout:data.timeout||game.spell.survival});
    }else if(name==='bossescape'&&data.enemy===this.boss&&this.state==='midboss-exit'){
      this.events.push({event:'midboss-escaped',stage:this.stageId,frame:this.totalClock});this.boss=null;
    }else if(name==='bossburst'&&data.enemy===this.boss&&this.state==='boss-defeat'){
      game.stopBossCombat();
      game.items.spawnBossDrops(data.enemy,{counts:{[TouhouItemType.LARGE_POWER]:3,[TouhouItemType.POINT]:12},
        centerType:TouhouItemType.LIFE_FRAGMENT,mode:game.session.mode,timedOut:!!this.finalResult?.timeout,
        survival:!!this.finalResult?.survival});
      this.events.push({event:'boss-burst',stage:this.stageId,frame:this.totalClock});
      if(this.mode==='spell-practice'){game.setBoss(null);this.boss=null;this._complete(game);}
      else this._dialogue(game,'after',()=>this._clearStage(game));
    }
  }
  _clearStage(game){
    game.setBoss(null);this.boss=null;this.state='stage-clear';game.context.bossSuppressed=true;game.context.enemyContactBlocked=true;
    game.context.inputBlocked=true;
    this.stageContinuation=()=>{
      if(this.mode==='stage-practice'||this.mode==='extra'||this.stageId===6)this._complete(game);
      else{this.stageId++;this._startStage(game);}
    };
    if(this.callbacks.stageClear)this.callbacks.stageClear(this.stage,{onComplete:()=>this.continueStage()});
    else this.continueStage();
  }
  continueStage(){if(this.state!=='stage-clear'||!this.stageContinuation)return false;
    const next=this.stageContinuation;this.stageContinuation=null;next();return true;}
  _complete(game){
    if(this.completed)return;this.completed=true;this.state='complete';game.stopBossCombat();game.context.bossSuppressed=true;
    game.context.enemyContactBlocked=true;game.context.inputBlocked=true;
    const continues=game.session.continues??game.player.continues??0;
    this.callbacks.complete?.({ending:this.mode==='extra'?'extra':continues?'bad':'good',character:this.character,
      difficulty:this.difficulty,mode:this.mode,score:game.player.score??0,continues,stageId:this.stageId,captures:this.captures.slice()});
  }
  update(game=this.game,frame=game?.frame??0){
    if(this.destroyed||this.completed)return;this.totalClock++;
    if(this.state==='road'){
      const t=this.stageFrame,roadFrames=this.stage.roadFrames;
      while(this.roadSectionIndex+1<this.roadPlan.sections.length&&this.roadPlan.sections[this.roadSectionIndex+1].start<=t){
        const section=this.roadPlan.sections[++this.roadSectionIndex];
        this.events.push({event:'road-section',stage:this.stageId,sectionId:section.id,roadFrame:t,frame:this.totalClock});
        this.callbacks.roadSection?.(section,{stage:this.stage,roadFrame:t});
      }
      while(this.roadWaveIndex<this.roadPlan.waves.length&&this.roadPlan.waves[this.roadWaveIndex].at<=t){
        const wave=this.roadPlan.waves[this.roadWaveIndex++];if(wave.at===t)this._spawnRoadWave(game,wave);
      }
      if(!this.midbossDone&&t>=(this.midbosses.find(entry=>entry.stageId===this.stageId)?.atFrame??Math.floor(roadFrames*.43))){this._spawnMidboss(game);return;}
      if(t>=roadFrames){this._spawnBoss(game);return;}this.stageFrame++;
    }else if(this.state==='midboss-enter'){
      this.phaseFrame++;const fraction=Math.min(1,this.phaseFrame/60);
      actorPosition(this.boss,150*(1-fraction),20+fraction*85);
      if(this.phaseFrame>=60&&game.bossPresentation.entranceReady){
        if(this.midbossPhases.length){const route=this.character?'marisa':'reimu';
          this._dialogue(game,'midboss',()=>this._beginMidbossPhase(game,0),this.midbossSpec?.dialogues?.[route]??[]);}
        else{this.state='midboss-combat';this.phaseFrame=0;game.resumeBoss(this.boss);this.boss.invulnerable=false;game.startBossCombat();game.setBossHud({dialogue:false});
          this._charge(game,['yellow','cyan','yellow','magenta','red','yellow','white'][this.stageId-1]);}}
    }else if(this.state==='midboss-combat'){
      if(this.midbossPhases.length)updateMidbossSpellPattern({game,boss:this.boss,frame:this.phaseFrame,difficulty:this.difficulty,
        spellIndex:this.midbossPhaseIndex,state:this.patternState});
      else updateNonspellPattern({game,boss:this.boss,frame:this.phaseFrame,difficulty:this.difficulty,stageId:this.stageId,phaseIndex:0,state:this.patternState,rng:this.rng});
      const hp=this.boss.maximumHp;game.setBossHud({healthBars:[{current:Math.max(0,this.boss.hp),maximum:hp,phaseHealth:this.boss.hp,markers:[]}]});
      this.phaseFrame++;if(!this.midbossPhases.length&&this.phaseFrame>=this.midbossDuration)this._finishMidboss(game,null,{timeout:true});
    }else if(this.state==='midboss-phase-wait'){
      if(--this.waitFrames<=0)this._beginMidbossPhase(game,this.midbossPhaseIndex+1);
    }else if(this.state==='midboss-exit'){
      if(++this.phaseFrame>=70){this.state='road';this.stageFrame++;this.phaseFrame=0;}
    }else if(this.state==='boss-enter'){
      if(game.bossPresentation.entranceReady){
        if(this.mode==='spell-practice')this._beginPhase(game,0);
        else this._dialogue(game,'before',()=>this._beginPhase(game,0));
      }
    }else if(this.state==='phase-wait'){
      // The ring is already shown with the upcoming group's HP while the
      // sixty-frame card result and movement preparation run.
      const target=80*Math.sin((this.phaseIndex+1)*1.7),boss=this.boss;
      actorPosition(boss,boss.x+(target-boss.x)*.035,boss.y+(105-boss.y)*.035);
      if(--this.waitFrames<=0)this._beginPhase(game,this.phaseIndex+1);
    }else if(this.state==='combat'){
      const phase=this.phase,boss=this.boss,t=this.phaseFrame;
      // Each authored score owns its reposition/windup. Do not move every Boss
      // on an unrelated universal clock while its aimed phrase is firing.
      const hud=this.phasePlan.hudState(this.phaseIndex,{hp:Math.max(0,boss.hp),maximumHp:phase.hp});
      if(!phase.spell)game.setBossHud({...hud,remainingFrames:Math.max(0,phase.duration-t)});
      else game.setBossHud(hud);
      if(phase.spell)(phase.midboss?updateMidbossSpellPattern:updateSpellPattern)({game,boss,frame:t,difficulty:this.difficulty,stageId:this.stageId,spellIndex:phase.spellIndex,state:this.patternState});
      else updateNonspellPattern({game,boss,frame:t,difficulty:this.difficulty,stageId:this.stageId,phaseIndex:this.phaseIndex,state:this.patternState,rng:this.rng});
      this.phaseFrame++;
      if(!phase.spell&&this.phaseFrame>=phase.duration)this._finishPhase(game,{timeout:true});
    }
    this._releaseChargeSound(game);
  }
  snapshot(){return{state:this.state,stageId:this.stageId,stageFrame:this.stageFrame,phaseFrame:this.phaseFrame,
    phaseIndex:this.phaseIndex,waitFrames:this.waitFrames,bossId:this.boss?.bossId??null,bossHp:this.boss?.hp??null,
    mode:this.mode,difficulty:this.difficulty,character:this.character,midbossDone:this.midbossDone,
    completed:this.completed,dialogueKind:this.dialogueKind??null,captures:this.captures.map(record=>({...record})),
    rng:this.rng.state,totalClock:this.totalClock,pattern:this.phase?.spell?this.phase.spec.id:null};}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.dialogueContinuation=null;this.stageContinuation=null;
    if(this.game){this.game.stage=this.originalStage;this.game.onEvent=this.originalEvent;
      if(this.boss?.alive)this.game.removeBoss(this.boss);Object.assign(this.game.context,this.originalInteraction);}
  }
}
