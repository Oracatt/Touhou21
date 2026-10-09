import {DrawList,Keys,ReplayRecorder,ReplayPlayer} from '@ts-stg/thlib';
import {TouhouGame,TouhouDialogue,TouhouStageClear,TouhouStageTransition,TouhouRNG,AnmBank,TOUHOU_POINT_VALUE_PROFILES} from '@ts-stg/thlib/touhou';
import {STAGES,MIDBOSSES,CHARACTERS,PLAYERS,GAME} from './content.js';
import {CampaignDirector} from './director.js';
import type {DialogueContext} from './director.js';
import {StageBackground} from './background.js';
import {BossSpriteCatalog} from './boss-sprites.js';
import {GameFrameSkin} from './frame-skin.js';
import {CampaignBossHud} from './campaign-boss-hud.js';
import {GAME_REVISION} from './storage.js';
import {musicTrack} from './music-data.js';
import type {NativeHost} from '@ts-stg/thlib';
import type {AnmData,AnmInstruction,AnmInstance,AnmView,AnmDrawList,TouhouResources,TouhouGameOptions,TouhouGameContext,TouhouSpellResult,TouhouDialogueStep,TouhouDialogueEvent,TouhouPlayer} from '@ts-stg/thlib/touhou';
import type {GameArt} from './art.js';
import type {TextPainter} from './text.js';
import type {MusicController} from './music.js';
import type {GameStorage} from './storage.js';
import type {StageDefinition,SpellDefinition,DialogueLine,RunConfig,RunOptions,RunResult,RunSummary,RunReplayData,RunRecorder,RunPlayback,CampaignEnemy,CampaignBoss} from './shared-types.js';

interface SceneServices {
  resources:TouhouResources;host:NativeHost;art:GameArt;text:TextPainter;music:MusicController;storage:GameStorage;
  config:RunConfig;playbackSource?:RunReplayData|null;options?:RunOptions;
  onComplete?:(result:RunResult,scene:CampaignScene)=>void;onReplayDone?:(scene:CampaignScene)=>void;
  onSpellPracticeEnd?:(result:RunResult,scene:CampaignScene)=>void;
}
type TextHostCapabilities = Partial<Pick<NativeHost,'rasterizeBitmapText'|'encodeText'>>;

const names=new Map(CHARACTERS.map(value=>[value.id,value.name]));
const stages=STAGES.map(value=>({...value,bossName:names.get(value.bossId),midbossName:names.get(MIDBOSSES.find(midboss=>midboss.stageId===value.id)?.bossId??value.bossId)}));
const formatScore=(value:number)=>String(Math.trunc(value*10)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const BGM_CAPTION_FRAMES=360;
const DIALOGUE_SCREEN_SCALE=1.5;
const HUD_NUMBER_PALETTE=Object.freeze({
  highScore:{color:0xffbdc6d2,shadowColor:0xe0101929},
  score:{color:0xfff1e6cf,shadowColor:0xe0101929},
  stock:{color:0xffe4ecea,shadowColor:0xff101929},
  power:{color:0xffedc1ab,shadowColor:0xe0101929},
  pointValue:{color:0xffdbc0e1,shadowColor:0xe0101929},
  graze:{color:0xffc3dedc,shadowColor:0xe0101929},
});
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const rgba=(value:number)=>((value<<8)|(value>>>24))>>>0;
const floatBits=new DataView(new ArrayBuffer(4));
const floatWord=(value:number)=>{floatBits.setFloat32(0,value,true);return floatBits.getUint32(0,true);};

/** Business artwork on the original st01enm.anm script21 cut-in clock:
 * 30-frame entry/color reveal, 90-frame drift, 30-frame departing darkening.
 * The common ANM VM and layer6/priority16 own interpolation and rendering.
 * The private bank borrows GameArt's texture; GameArt owns its lifetime. */
export function createSpellPortrait({art,bossId,visualRng}:{art:GameArt;bossId:string;visualRng:TouhouRNG}){
  const path=`assets/portraits/${bossId}.png`,asset=art.load(path),bounds=asset.bounds;
  const fit=Math.min(265/bounds.width,512/bounds.height),instructions:AnmInstruction[]=[];let offset=0;
  const op=(time:number,opcode:number,args:number[]=[])=>{const size=8+args.length*4;instructions.push({offset,opcode,size,time,mask:0,args});offset+=size;};
  op(0,300,[0]);op(0,304,[6]);op(0,421,[65536]);op(0,302,[2]);op(0,402,[floatWord(fit),floatWord(fit)]);
  op(0,400,[floatWord(380),floatWord(-112),0]);op(0,404,[0,0,0]);op(0,408,[30,0,255,255,255]);
  op(0,407,[30,0,floatWord(-4),floatWord(-16),0]);op(30,407,[90,0,floatWord(-36),0,0]);
  op(120,407,[30,0,floatWord(-420),floatWord(96),0]);op(120,408,[30,0,0,0,1]);op(150,1);
  const data={format:'touhou-anm-v8',name:`guiming-cutin-${bossId}`,byteLength:0,opcodeCounts:{},
    entries:[{index:0,name:path,width:asset.width,height:asset.height,originalWidth:asset.width,originalHeight:asset.height,
      lowResScale:0,spriteBase:0,scriptBase:0,spriteCount:1,scriptCount:1,texture:{kind:'external',path}}],
    sprites:[{index:0,entry:0,storedId:0,x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
      pivotX:0,pivotY:0,scaleX:1,scaleY:1,rotation:0}],
    scripts:[{index:0,storedId:0,entry:0,offset:0,instructions}]};
  // Authored banks contain the VM data; binary file offsets are unused here.
  const bank=new AnmBank(data as AnmData,{rng:visualRng,paddedTextures:false,loadTexture:()=>asset.id,unloadTexture:()=>{}}),vm=bank.create(0) as AnmInstance & {bossId:string};
  const update=vm.update.bind(vm),destroy=vm.destroy.bind(vm);let released=false;
  const release=()=>{if(!released){released=true;bank.dispose();}};
  vm.update=()=>{update();if(!vm.alive)release();};vm.destroy=()=>{destroy();release();};
  vm.bossId=bossId;return vm;
}

export class CampaignScene extends TouhouGame {
  declare resources:TouhouResources;declare host:NativeHost;declare art:GameArt;declare text:TextPainter;
  declare music:MusicController;declare storage:GameStorage;declare config:RunConfig;declare options:RunOptions;
  declare background:StageBackground;declare frameSkin:GameFrameSkin;declare bossSprites:BossSpriteCatalog;
  declare director:CampaignDirector;declare dialogue:TouhouDialogue|null;declare stageClear:TouhouStageClear|null;
  declare stageTransition:TouhouStageTransition|null;declare stageCaptionAge:number;declare currentStage:StageDefinition|null;
  declare bgmCaption:{title:string;age:number}|null;declare outerDraw:DrawList;declare savedRun:boolean;declare replayDone:boolean;
  declare finishedResult:RunResult|null;declare pendingCompletion:RunResult|null|undefined;declare replaySaved:boolean|undefined;
  declare playback:RunPlayback|null;declare recorder:RunRecorder|null;declare dialogueResources:TouhouResources;
  declare player:TouhouPlayer & {highScore:number};declare character:number|undefined;
  declare context:TouhouGameContext & {boss?:CampaignEnemy|null};
  declare onComplete:SceneServices['onComplete'];declare onReplayDone:SceneServices['onReplayDone'];
  declare onSpellPracticeEnd:SceneServices['onSpellPracticeEnd'];
  constructor(settings:TouhouGameOptions,{resources,host,art,text,music,storage,config,playbackSource=null,options={},onComplete,onReplayDone,onSpellPracticeEnd}:SceneServices={} as SceneServices) {
    config={...config,difficulty:config.mode==='extra'?4:config.difficulty};
    const recordNamespace=`${config.character}:${config.difficulty}`,persistentRecords=storage.progress.spellRecords[recordNamespace]??{};
    const initialSpellRecords=clone(playbackSource?.config?.initialSpellRecords??persistentRecords);
    const records=playbackSource||options.testing?initialSpellRecords:persistentRecords;
    if(!playbackSource&&!options.testing)storage.progress.spellRecords[recordNamespace]=records;
    const background=new StageBackground({art,seed:config.seed});
    const frameSkin=new GameFrameSkin({art});
    super({...settings,character:config.character,difficulty:config.difficulty,seed:config.seed,
      systemOptions:{...settings.systemOptions,
        player:{...settings.systemOptions?.player,rules:{...TOUHOU_POINT_VALUE_PROFILES.classic,...settings.systemOptions?.player?.rules}},
        hud:{...settings.systemOptions?.hud,skin:frameSkin,
        palette:{...settings.systemOptions?.hud?.palette,...HUD_NUMBER_PALETTE},replay:!!playbackSource}},
      factories:{...settings.factories,bossHud:(hudOptions,game)=>new CampaignBossHud(hudOptions,game as CampaignScene)},
      rng:settings.rng??new TouhouRNG(config.seed),visualRng:settings.visualRng??new TouhouRNG(config.seed^0x6d2b79f5),
      renderBackground:(draw,game)=>{background.draw(draw,game as CampaignScene);(game as CampaignScene).stageTransition?.draw(draw,{x:48,y:24,width:576,height:672});},
      spellContext:{...settings.spellContext,...((host as TextHostCapabilities)?.rasterizeBitmapText&&(host as TextHostCapabilities)?.encodeText?{
        createNameAnimation:(name,options)=>resources.createNameAnimation(name,{...options,codePage:936},settings.banks.text)}:{})},
      spellOptions:{...settings.spellOptions,records,fallbackRecords:{},viewIndex:0,playback:!!playbackSource,mode:config.mode==='spell-practice'?2:0},
      gameOverOptions:{...settings.gameOverOptions,music:'playersScore',musicPlayer:music}});
    Object.assign(this,{resources,host,art,text,music,storage,config,options,background,frameSkin,onComplete,onReplayDone,onSpellPracticeEnd});
    this.bossSprites=new BossSpriteCatalog({art});
    this.dialogue=null;this.stageClear=null;this.stageTransition=null;this.stageCaptionAge=0;this.currentStage=null;this.bgmCaption=null;
    this.outerDraw=new DrawList();this.savedRun=false;this.replayDone=false;this.finishedResult=null;
    this.player.lives=storage.settings.startingLives;
    const initialHighScore=playbackSource?.config?.initialHighScore??Math.max(0,...storage.progress.scores.filter(result=>result.character===config.character&&result.difficulty===config.difficulty&&result.mode===config.mode).map(result=>result.score));
    this.player.highScore=initialHighScore;
    this.playback=playbackSource?new ReplayPlayer(playbackSource) as RunPlayback:null;
    this.recorder=this.playback?null:new ReplayRecorder({...config,game:GAME.id,revision:GAME_REVISION,backend:host.backend,
      startingLives:storage.settings.startingLives,initialSpellRecords,initialHighScore,spellTimes:[]}) as RunRecorder;
    if(this.playback)this.player.lives=playbackSource!.config.startingLives??storage.settings.startingLives;
    this.dialogueResources={...resources,createBank:name=>{const bank=resources.createBank(name);
      bank.rng=this.visualRng;bank.environment={...bank.environment,rng:this.visualRng};return bank;}};
    this.context.writeSpellTime=(stage,captureIndex,encoded)=>{
      if(!this.recorder)return;const times=this.recorder.config.spellTimes,previous=times.find(entry=>entry.stage===stage&&entry.captureIndex===captureIndex);
      if(previous)previous.encoded=encoded;else times.push({stage,captureIndex,encoded});
    };
    this.context.readSpellTime=(stage,captureIndex)=>{
      const entry=this.playback?.data.config.spellTimes?.find(time=>time.stage===stage&&time.captureIndex===captureIndex);
      if(!entry)throw new Error(`Replay has no encoded spell time for stage ${stage}, card ${captureIndex}`);return entry.encoded;
    };
    const onEvent=this.onEvent;
    this.onEvent=(name,data)=>{
      if(this.playback&&name==='spellFinish'&&(data as TouhouSpellResult).captured){const record=this.spell.records[(data as TouhouSpellResult).id];
        if(record){const mode=this.spell.mode===2?1:0;record.captures[mode]=Math.min(99999,record.captures[mode]+1);}}
      onEvent?.(name,data);
    };
    this.bossHud!.drawName=(queue,name,style)=>{const label=names.get(this.context.boss?.bossId as string)??name;
      queue.enqueuePriority!(style.drawPriority!,draw=>this.text.draw(draw,label,76,18,{size:16,width:455,height:25,color:0xf8e8caff,alpha:(style.color!>>>24)/255}));};
    this.director=new CampaignDirector({stages,midbosses:MIDBOSSES,character:config.character,difficulty:config.difficulty,mode:config.mode,stageId:config.stageId,spellId:config.spellId,seed:config.seed,
      callbacks:{
        music:(id,{silenceFrames=0}={})=>{
          const showCaption=()=>{if(!this.destroyed)this.bgmCaption={title:musicTrack(id).title,age:0};};
          if(silenceFrames){this.bgmCaption=null;music.play(id,true,{silenceFrames,onStart:showCaption});}
          else{music.play(id,true);showCaption();}
        },stageStart:stage=>this.startStage(stage),
        bossSpawn:(enemy,metadata)=>this.decorateBoss(enemy,metadata),
        spellStart:(spec,metadata)=>this.spellStart(spec,metadata),
        dialogue:(lines,context)=>this.openDialogue(lines,context),
        stageClear:(stage,context)=>this.openStageClear(stage,context),
        complete:result=>this.completeCampaign(result),
      }});
    this.director.attach(this);
  }
  startStage(stage:StageDefinition){this.currentStage=stage;this.background.setStage(stage);this.stageCaptionAge=0;
    if(!this.playback&&!this.options.testing&&this.config.mode==='normal'){this.storage.progress.stageUnlock=Math.max(this.storage.progress.stageUnlock,stage.id);this.storage.saveProgress();}
    if(this.options.skipRoad&&this.director){this.director.midbossDone=true;this.director.stageFrame=stage.roadFrames;}
  }
  decorateBoss(enemy:CampaignBoss,{bossId,midboss}:{bossId:string;midboss:boolean}){
    enemy._spriteDirection=0;
    const renderBody=(draw:AnmDrawList,bodyView:AnmView)=>{
      const x=(bodyView.x??336)+enemy.x*(bodyView.scale??1.5),y=(bodyView.y??24)+enemy.y*(bodyView.scale??1.5);
      this.bossSprites.draw(draw,enemy,bossId,{x,y,scale:bodyView.scale??1.5,height:midboss?55:68,color:enemy.hitThisFrame?0xffccccff:0xffffffff});
    };
    enemy.draw=(queue:AnmDrawList,view)=>{
      if(!enemy.alive)return queue;
      return this.bossPresentation!.drawBody(queue,renderBody,{view,layer:7,order:0});
    };
  }
  spellStart(spec:SpellDefinition,{bossId,code}:{bossId:string;code:number}){
    if(spec&&!this.playback&&!this.options.testing){if(!this.storage.progress.seenSpells.includes(spec.id))this.storage.progress.seenSpells.push(spec.id);this.storage.saveProgress();}
    if(this.playback){const record=this.spell.records[code]??={name:spec.name,captures:[0,0],attempts:[0,0]},mode=this.spell.mode===2?1:0;
      record.name=spec.name;record.attempts[mode]=Math.min(99999,record.attempts[mode]+1);}
    return{portrait:createSpellPortrait({art:this.art,bossId,visualRng:this.visualRng}),keepStageBackground:true};
  }
  openDialogue(lines:DialogueLine[],{bossId,kind,cues=null,cue=null,onComplete}:DialogueContext){
    this.dialogue?.dispose();this.context.dialogue=true;
    const playerId=PLAYERS[this.character??this.config.character].id;
    const steps=lines.map((line,index):TouhouDialogueStep=>{const events:TouhouDialogueEvent[]=[],actorLine=cues?.appear===index;
      if(actorLine)events.push({type:'cue',name:'appear',entranceStage:'portraits'});
      if(cues?.music===index)events.push({type:'cue',name:'music'});
      // The first response belongs to the actor on the road. The following
      // line introduces its portrait independently of the entrance and BGM.
      const portraitReady=!cues||Number.isInteger(cues.portrait)&&index>=cues.portrait!;
      return{speaker:line.speaker==='boss'?'right':'left',text:line.text,coldFrames:actorLine?0:18,autoFrames:600,events,
        ...(actorLine?{boxMode:2,entrance:{portraitFrame:0,speakerFrame:0,textFrame:60,inputFrame:94}}:{}),
        portraits:{left:{present:!cues||index<cues.appear||portraitReady},right:{present:portraitReady}}};});
    this.dialogue=new TouhouDialogue({resources:this.dialogueResources,steps,character:this.config.character,codePage:936,maxLineBytes:32,
      startDelayFrames:kind==='before'?12:0,onEvent:(event,step)=>{
        if(event.type!=='cue')return;cue?.(event.name as string);
        if(event.name==='appear'&&step.boxMode===2&&this.director.boss){
          const boss=this.director.boss,view=this.view;
          // st01m0 MSG28(192,150) points to the actor at screen(224,144).
          // Mode2's source ANM272/296 and arrow262/266 supply the tail shape;
          // retain its (-32,+6) screen offset and MSG's doubled coordinates.
          step.x=2*((view.x+boss.x*view.scale)/DIALOGUE_SCREEN_SCALE-32);
          step.y=2*((view.y+boss.y*view.scale)/DIALOGUE_SCREEN_SCALE+6);
        }
      },entrance:kind==='after'?'afterBoss':null,exit:kind==='after'?'afterBoss':'beforeBoss',
      speakerNames:{left:PLAYERS[this.config.character].name,right:names.get(bossId)},
      drawPortrait:(draw,step,owner)=>{
        const left=owner.portraitState('left'),right=owner.portraitState('right');
        if(left){const asset=this.art.load(`assets/portraits/${playerId}.png`),boxWidth=left.width*1.5,boxHeight=left.height*1.5;
          const height=Math.min(boxHeight,boxWidth*asset.bounds.height/asset.bounds.width);
          this.art.portrait(draw,playerId,left.x*1.5,left.y*1.5+boxHeight-height,height,{alpha:left.alpha/255,tint:rgba(left.color)});}
        if(right){const asset=this.art.load(`assets/portraits/${bossId}.png`),boxWidth=right.width*1.5,boxHeight=right.height*1.5;
          const height=Math.min(boxHeight,boxWidth*asset.bounds.height/asset.bounds.width),width=height*asset.bounds.width/asset.bounds.height;
          this.art.portrait(draw,bossId,right.x*1.5+boxWidth-width,right.y*1.5+boxHeight-height,height,{alpha:right.alpha/255,tint:rgba(right.color)});}
      },
      onComplete:()=>{this.context.dialogue=false;onComplete();}});
  }
  openStageClear(stage:StageDefinition,{onComplete}:{onComplete:()=>void}){
    this.stageClear?.destroy();this.context.dialogue=true;
    const bonus=(stage.id*100000+this.player.lives*50000+this.player.power*1000)|0;
    this.stageClear=new TouhouStageClear({bank:this.banks.front,font:this.font,bonus,initialMask:0,
      rows:[{label:'Stage',value:stage.id},{label:'Clear Bonus',value:bonus}],
      onAward:value=>{this.player.score+=(value/10)|0;},onDismiss:()=>this.music.fadeOut(2),
      drawSummary:(draw)=>{
        this.text.draw(draw,`Bonus　${String(bonus).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`,48,320,{size:26,width:576,height:50,align:'center'});
        this.text.draw(draw,`Score　${formatScore(this.player.score)}`,48,376,{size:23,width:576,height:50,align:'center'});
      },
      onComplete:()=>{
        this.player.finishStageVisibility();
        this.stageTransition=new TouhouStageTransition({onCovered:()=>{this.cleanStageActors();this.player.resetForStage();this.context.dialogue=false;onComplete();this.player.restoreStageVisibility();}});
      }});
  }
  cleanStageActors(){
    for(const bullet of this.bullets.bullets)if(bullet.state)this.bullets.retire(bullet);this.bullets.bullets.length=0;
    for(const laser of this.lasers.lasers)if(laser.alive)this.lasers.retire(laser);this.lasers.lasers.length=0;
    for(const item of this.items.items)if(item.state)this.items.retire(item);this.items.items.length=0;
    // Retire through the facade so registered Boss holds, exits and actor-owned
    // sequences cannot survive the covered stage transition.
    for(const enemy of [...this.enemies])this.removeBoss(enemy);this.enemies.length=0;this.context.enemies=this.enemies;
    this.bossPresentation!.stopCombat();this.bossPresentation!.clearBoss();
  }
  openGameOver(mask=0){this.session.highScore=Math.max(this.session.highScore??0,this.player.highScore,this.player.score);return super.openGameOver(mask);}
  completeCampaign(result:RunResult){this.finishedResult={...result};this.pendingCompletion={...result};}
  dispatchCompletion(){const result=this.pendingCompletion;if(!result)return;this.pendingCompletion=null;
    if(!this.playback&&!this.options.testing){this.storage.recordClear(result);this.storage.saveProgress();}
    this.saveRun(result);
    if(this.playback)return;
    if(this.config.mode==='spell-practice'||this.config.mode==='stage-practice')this.onSpellPracticeEnd?.(result,this);
    else this.onComplete?.(result,this);
  }
  saveRun(summary:RunSummary={},{force=false}={}){if(this.savedRun||this.playback||this.options.testing)return;this.savedRun=true;
    this.storage.saveProgress();if((force||this.storage.settings.autoSaveReplay)&&this.recorder?.frames){this.storage.saveReplay(this.recorder.toJSON(),{character:this.config.character,difficulty:this.config.difficulty,mode:this.config.mode,score:this.player.score,stageId:this.director.stageId,...summary});this.replaySaved=true;}}
  update(mask=0){
    if(this.playback){const value=this.playback.next();if(value===null){if(!this.replayDone){this.replayDone=true;this.onReplayDone?.(this);}return;}mask=value;}
    this.recorder?.record(mask);
    if(this.options.invincible)this.player.invulnerability.set(180);
    const verificationPhase=this.director.state==='midboss-combat'?this.director.midbossPhases?.[this.director.midbossPhaseIndex]:this.director.phase;
    if(this.options.autoCapture&&['combat','midboss-combat'].includes(this.director.state)&&this.director.phaseFrame>=125&&!verificationPhase?.spec?.survival)
      this.context.damageEnemy!(this.director.boss!,10000000,{kind:'verification-shot',x:this.player.x,y:this.player.y});
    const wasPaused=this.paused,previousFrame=this.frame,previousBoss=this.director.boss,previousBossX=previousBoss?.x;super.update(mask);
    if(this.frame!==previousFrame)this.background.update?.(this);
    this.player.highScore=Math.max(this.player.highScore,this.player.score);
    if(!wasPaused&&!this.paused&&previousBoss&&previousBoss===this.director.boss){
      const delta=previousBoss.x-previousBossX!;previousBoss._spriteDirection=Math.abs(delta)>.15?Math.sign(delta):0;
    }
    if(!wasPaused&&!this.paused){
      this.stageCaptionAge++;if(this.bgmCaption&&++this.bgmCaption.age>=BGM_CAPTION_FRAMES)this.bgmCaption=null;
      if(this.dialogue?.active){this.dialogue.update(this.options.autoDialogue?Keys.FOCUS:mask);}
      if(this.dialogue?.complete){this.dialogue.dispose();this.dialogue=null;}
      if(this.stageClear?.alive)this.stageClear.update(this.options.autoStageClear?Keys.SHOOT:mask);
      this.stageTransition?.update();if(this.stageTransition&&!this.stageTransition.alive){this.stageTransition.destroy();this.stageTransition=null;}
    }
    this.postFrame(this.options.testing||this.options.fixedClock?this.frame/60:Date.now()/1000);
    if(this.recorder&&this.recorder.frames%600===0)this.recorder.checkpoint(this.snapshot());
    this.playback?.verify(this.snapshot());
    this.dispatchCompletion();
  }
  render(){const draw=this.outerDraw.reset();for(const command of super.render())draw.push(command);
    if(this.stageCaptionAge<240&&this.director.state==='road'&&!this.dialogue){const alpha=Math.min(1,this.stageCaptionAge/30,(240-this.stageCaptionAge)/45);
      this.text.draw(draw,this.currentStage!.title,58,160,{size:27,width:555,height:60,align:'center',color:0xf8e5b7ff,alpha});
      this.text.draw(draw,this.currentStage!.subtitle,58,213,{size:16,width:555,height:45,align:'center',alpha});}
    if(this.bgmCaption){const {age,title}=this.bgmCaption;const alpha=Math.min(1,age/20,(BGM_CAPTION_FRAMES-age)/45);
      this.text.draw(draw,`♪ ${title}`,324,664,{size:16,width:296,height:28,align:'right',color:0xf8e8caff,alpha});}
    this.stageClear?.draw(draw);this.dialogue?.draw(draw,{x:0,y:0,scale:1,screenScale:DIALOGUE_SCREEN_SCALE});
    return draw.commands;
  }
  snapshot(){return {...super.snapshot(),statistics:{score:this.player.score,highScore:this.player.highScore,graze:this.player.graze,pointValue:this.player.pointValue,pointItems:this.player.pointItems,lifeFragments:this.player.lifeFragments,bombFragments:this.player.bombFragments},director:this.director?.snapshot(),dialogue:this.dialogue?.snapshot()??null,stageClear:this.stageClear?.snapshot()??null,stageTransition:this.stageTransition?.snapshot()??null,stageCaptionAge:this.stageCaptionAge};}
  destroy(){if(this.destroyed)return;this.saveRun();this.dialogue?.dispose();this.stageClear?.destroy();this.stageTransition?.destroy();this.director?.destroy();this.background.destroy?.();super.destroy();}
}
