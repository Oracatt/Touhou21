import type {GamePage,PageRow,PageOptions} from './pages.js';
import type {ReplayEntry} from './storage.js';
import type {NativeHost} from '@ts-stg/thlib';
import type {AnmBank,TouhouGameOptions,TouhouResources,TouhouStartSelection} from '@ts-stg/thlib/touhou';
import type {RunConfig,RunOptions,RunResult,RunReplayData,RunPlayback} from './shared-types.js';

import {DrawList,ReplayPlayer,ReplayPlaybackController,Keys} from '@ts-stg/thlib';
import {TouhouApplication,TouhouRNG,TouhouButtons,TouhouPause,createTouhouResources} from '@ts-stg/thlib/touhou';
import {GAME,STAGES,PLAYERS,ALL_SPELLS,MIDBOSS_SPELLS,MUSIC_COMMENTS} from './content.js';
import {MUSIC_TRACKS} from './music-data.js';
import {GameArt} from './art.js';
import {TextPainter} from './text.js';
import {MusicController} from './music.js';
import {GameStorage,GAME_REVISION,DEFAULT_SETTINGS,REPLAY_SLOT_COUNT} from './storage.js';
import {ProjectTitleMenu} from './menu.js';
import {ListPage,ReadingPage,EndingPage,manualPages} from './pages.js';
import {CampaignScene} from './scene.js';

const score=(value:number)=>String(Math.trunc(value*10)).replace(/\B(?=(\d{3})+(?!\d))/g,',');

export interface ProjectGameOptions extends TouhouGameOptions {gameConfig:RunConfig;}
interface OptionRow extends PageRow {id:'musicVolume'|'soundVolume'|'defaults';}
interface ReplayRow extends PageRow {slot:number;entry:ReplayEntry|null;empty:boolean;}
interface RecordRow extends PageRow {entry?:RunResult;spellRecords?:boolean;empty?:boolean;}
export class ProjectApplication {
 declare core:TouhouApplication<CampaignScene>;declare drawList:DrawList;declare playbackSource:RunReplayData|null;declare playbackExternalClose:(()=>void)|null|undefined;declare pausedSounds:number[];declare finishedResult:RunResult|undefined;
  declare host: NativeHost;
  declare options: RunOptions;
  declare storage: GameStorage;
  declare art: GameArt;
  declare text: TextPainter;
  declare music: MusicController;
  declare frame: number;
  declare page: GamePage|null;
  declare extraSelection: Partial<RunConfig>;
  declare destroyed: boolean;
  declare liveButtons: TouhouButtons;
  readonly replayControl = new ReplayPlaybackController();
  declare resources: TouhouResources;
  declare renderTarget: number;
  declare compositeTarget: number;
  declare replayFinished: boolean;

  constructor(host:NativeHost,{...options}:RunOptions={}){
    this.host=host;this.options=options;this.storage=new GameStorage(host);this.art=new GameArt(host);this.text=new TextPainter(host);
    this.music=new MusicController(host,this.storage.settings);this.frame=0;this.page=null;this.playbackSource=null;this.extraSelection={};this.drawList=new DrawList();this.destroyed=false;
    this.liveButtons=new TouhouButtons();this.playbackExternalClose=null;
    this.resources=createTouhouResources(host,{locale:'zh-CN',environment:{rng:new TouhouRNG(0x217e57)},audioVolume:this.storage.settings.soundVolume});
    this.renderTarget=host.createRenderTarget(960,720);this.compositeTarget=host.createRenderTarget(960,720);
    const selection={character:options.character??0,difficulty:options.mode==='extra'?4:options.difficulty??1,mode:options.mode??'normal',stageId:options.stageId??1,spellId:options.spellId??null,seed:options.seed};
    this.core=new TouhouApplication<CampaignScene>({resources:this.resources,pixels:host,initialSelection:selection,autostart:!!options.autostart,
      createGame:settings=>new CampaignScene(settings,{resources:this.resources,host,art:this.art,text:this.text,music:this.music,storage:this.storage,config:(settings as ProjectGameOptions).gameConfig,playbackSource:this.playbackSource,options,
        onComplete:(result:RunResult,game:CampaignScene)=>this.endCampaign(result,game),onReplayDone:(game:CampaignScene)=>this.replayEnd(game),onSpellPracticeEnd:(result:RunResult,game:CampaignScene)=>this.practiceEnd(result,game)}),
      gameOptions:selected=>this.gameOptions(selected),
      menuOptions:()=>({difficulty:Math.min(3,(this.core?.selection?.difficulty as number|undefined)??options.difficulty??1),sound:(id:number)=>this.sound(id),
        onSelect:index=>this.titleAction(index),onStart:selected=>this.core.startTransition({...selected,stageId:selected.mode==='extra'?7:1,spellId:null,seed:this.options.seed,...this.extraSelection}),disposeBanks:false}),
      createMenu:settings=>new ProjectTitleMenu(settings!,{art:this.art,text:this.text,storage:this.storage,unlockAll:!!options.unlockAll,onReturnMain:()=>{this.extraSelection={};}}),
      onSceneChange:({mode})=>{if(mode==='title'){this.playbackSource=null;this.playbackExternalClose=null;this.extraSelection={};this.music.play('title',true);}},
      onPauseChange:paused=>{if(paused)this.pauseAudio();else this.resumeAudio();},
      onAfterUpdate:()=>{this.resources.audio?.flush();this.music.update();},onQuit:()=>host.quit(),
    });
    if(options.page)this.openTestPage(options.page);
  }
  sound(id:number,x=0){this.resources.audio?.request(id,x);}
  pauseAudio(){this.music.pause();this.pausedSounds=[];for(const handle of this.resources.audio?.handles.values()??[])if(this.host.isSoundPlaying(handle)){this.host.pauseSound(handle);this.pausedSounds.push(handle);}}
  resumeAudio(){this.music.resume();for(const handle of this.pausedSounds??[])this.host.resumeSound(handle);this.pausedSounds=[];}
  gameOptions(selected:TouhouStartSelection):ProjectGameOptions{
    const config={...selected,...this.extraSelection} as RunConfig;config.seed=(config.seed??(Date.now()>>>0))||1;
    if(config.mode==='extra')config.difficulty=4;
    const rng=new TouhouRNG(config.seed),visualRng=new TouhouRNG(config.seed^0x6d2b79f5),banks:Record<string,AnmBank>={};
    for(const name of ['front','bullet','effect','enemy','ascii_960','text',config.character?'pl01':'pl00']){const bank=this.resources.createBank(name);bank.environment={...bank.environment,rng:visualRng};bank.rng=visualRng;banks[name]=bank;}
    if(!this.playbackSource&&!this.options.testing){this.storage.progress.plays++;this.storage.saveProgress();}
    return{banks,font:this.resources.font!,styles:this.resources.styles,sht:this.resources.shots[config.character],disposeBanks:true,character:config.character,difficulty:config.difficulty,power:config.mode==='normal'?100:400,rng,visualRng,
      renderTarget:this.renderTarget,compositeTarget:this.compositeTarget,gameConfig:config,
      onSound:(id:number,x?:number)=>this.sound(id,x),onStopSound:(id:number)=>this.resources.audio?.stop(id),
      // Legacy recorded exit/retry is the last input of that recording. Keep its
      // playback scene until ReplayPlayer consumes EOF and verifies it.
      onExit:()=>{if(!this.core.game?.playback)this.requestLeaveGame();},onRestart:()=>{if(this.core.game?.playback)return;this.core.game?.saveRun({aborted:true});this.playbackSource=null;this.core.start({...config,seed:this.options.seed??(Date.now()>>>0)} as RunConfig);},
      onReplay:context=>this.openExternalPage('replays',context),onManual:context=>this.openExternalPage('manual',context),
      pauseOptions:{hiddenChoices:['options']},
      gameOverOptions:{hiddenChoices:['options'],onReplay:context=>this.openExternalPage('replays',context),onManual:context=>this.openExternalPage('manual',context)}};
  }
  leaveGame(){this.core.game?.saveRun({aborted:true});this.page=null;this.core.openMenu();}
  requestLeaveGame(){if(this.core.game?.canSaveReplay)this.openSaveReplay();else this.leaveGame();}
  closePage({inGame=false,close}:{inGame?:boolean;close?:()=>void}={}){this.page=null;if(inGame){close?.();return;}this.core.menu?.returnMain();this.music.play('title',true);}
  pageOptions(title:string,inGame=false,close?:()=>void):PageOptions{return{title,text:this.text,art:this.art,sound:(id:number)=>this.sound(id),onClose:()=>this.closePage({inGame,close})};}
  openExternalPage(kind:string,{close}:{close?:()=>void}={}){
    // External utility pages consume no game frames while recording. Legacy
    // playback preserves the opening frame, then applies its close continuation
    // before consuming the next recorded core frame.
    if(this.playbackSource){this.playbackExternalClose=close;return;}
    if(kind==='replays')this.openSaveReplay(close);else if(kind==='options')this.openOptions(true,close);else this.openManual(true,close);
  }
  replayRows(saving=false):ReplayRow[]{return Array.from({length:REPLAY_SLOT_COUNT},(_,slot)=>{
    const entry=this.storage.replays[slot]??null,prefix=String(slot+1).padStart(2,'0'),summary=entry?{...entry.replay.config,...entry.summary}:null;
    return{slot,entry,empty:!entry,locked:!saving&&!entry,label:summary?`${prefix}　${PLAYERS[summary.character??0]?.name??'未知自机'}　${summary.difficulty===4||summary.mode==='extra'?'Extra':GAME.difficultyNames[summary.difficulty??1]??'未知难度'}　${typeof summary.score==='number'?score(summary.score):'—'}`:`${prefix}　未使用`};
  });}
  replayDetail(row:ReplayRow){
    if(!row.entry)return '这个栏位还没有回放。';
    const entry=row.entry,summary={...entry.replay.config,...entry.summary},date=new Date(entry.date),pad=(value:number)=>String(value).padStart(2,'0'),seconds=Math.round(entry.replay.frames/60);
    const mode=summary.mode==='spell-practice'?'符卡练习':summary.mode==='stage-practice'?'关卡练习':summary.mode==='extra'?'Extra':'本篇';
    const stamp=entry.date>0&&!Number.isNaN(date.getTime())?`${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`:'保存日期未知';
    return`${stamp}　${mode}　关卡 ${summary.stageId??1}\n播放时长 ${Math.floor(seconds/60)}:${pad(seconds%60)}`;
  }
  openSaveReplay(close?:()=>void,{onCancel}:{onCancel?:()=>void}={}){
    const game=this.core.game,cancel=onCancel??(close?()=>this.closePage({inGame:true,close}):()=>this.leaveGame());
    if(!game?.canSaveReplay){this.page=new ListPage({...this.pageOptions('无法保存回放'),rows:[{label:'返回'}],detail:()=>game?.session.continues?'续关后的游戏不能保存回放。':'本局没有可以保存的回放。',onClose:cancel,onSelect:cancel});return;}
    const rows=this.replayRows(true),firstEmpty=rows.findIndex(row=>row.empty);
    const save=(slot:number,page:ListPage<ReplayRow>|ListPage<PageRow&{overwrite?:boolean}>)=>{
      try{game.saveReplay(slot,{aborted:!game.finishedResult});this.leaveGame();}
      catch(error){page.message=`回放未能保存：${(error as Error).message}`;}
    };
    const slotsPage=new ListPage<ReplayRow>({...this.pageOptions('保存回放'),rows,initialSelection:Math.max(0,firstEmpty),
      detail:row=>`${row.empty?'Z 保存至这个栏位。':this.replayDetail(row)}\n${close||onCancel?'X / Esc 返回，不保存。':'X / Esc 不保存并返回标题。'}`,
      onClose:cancel,onSelect:(row,page)=>{
        if(row.empty){save(row.slot,page);return;}
        const back=()=>{this.page=slotsPage;};
        this.page=new ListPage<PageRow&{overwrite?:boolean}>({...this.pageOptions('覆盖回放？'),rows:[{label:'取消'},{label:'覆盖并保存',overwrite:true}],
          detail:()=>`栏位 ${String(row.slot+1).padStart(2,'0')} 的已有回放将被替换。\n${this.replayDetail(row).split('\n')[0]}`,
          onClose:back,onSelect:(choice,confirmation)=>choice.overwrite?save(row.slot,confirmation):back()});
      }});
    this.page=slotsPage;
  }
  titleAction(index:number){if(index===2)this.openStages();else if(index===3)this.openSpells();else if(index===4)this.openReplays();else if(index===5)this.openRecords();else if(index===6)this.openMusicRoom();else if(index===7)this.openOptions();else if(index===8)this.openManual();else if(index===9)this.host.quit();}
  choosePractice(selection:Partial<RunConfig>){this.page=null;this.extraSelection=selection;const menu=this.core.menu!;menu.finished=false;menu.mode=selection.mode!;if(selection.stageId===7){menu.difficulty=4;menu.openCharacter();}else menu.openDifficulty();}
  openStages(){this.page=new ListPage({...this.pageOptions('关卡练习'),rows:STAGES.filter(stage=>stage.id<=6).map(stage=>({label:stage.title,stage,locked:!this.options.unlockAll&&stage.id>this.storage.progress.stageUnlock})),
    detail:row=>row.locked?'到达此关后开放练习。':`${row.stage.subtitle}\n从完整道中开始，包含中 Boss、全部非符与符卡。`,
    onSelect:(row,page)=>{if(row.locked){page.message='尚未到达这一关。';return;}this.choosePractice({mode:'stage-practice',stageId:row.stage.id,spellId:null});}});}
  openSpells(){const rows=ALL_SPELLS.map((spell,index)=>{const stage=STAGES.find(stage=>stage.id===spell.stageId)??STAGES[6];return{label:`${String(index+1).padStart(2,'0')}　${spell.name}`,spell,stage,locked:!this.options.unlockAll&&!this.storage.progress.seenSpells.includes(spell.id)};});
    this.page=new ListPage({...this.pageOptions('符卡练习'),rows,visibleRows:9,
      detail:row=>row.locked?'遇见此符卡后开放。':`${row.stage.title}${row.spell.midboss?'　道中':''}　${row.spell.seconds}s${row.spell.survival?' · 耐久':''}\n${row.spell.description}`,
      onSelect:(row,page)=>{if(row.locked){page.message='尚未遇见这张符卡。';return;}this.choosePractice({mode:'spell-practice',stageId:row.stage.id,spellId:row.spell.id});}});}
  openReplays(inGame=false,close?:()=>void){
    this.page=new ListPage<ReplayRow>({...this.pageOptions('回放鉴赏',inGame,close),rows:this.replayRows(),
      detail:row=>row.empty?'这个栏位还没有回放。游戏结束后可选择栏位保存。':this.replayDetail(row),
      onSelect:(row,page)=>{if(row.empty)return;const entry=row.entry!;
        try{const player=new ReplayPlayer(entry.replay) as RunPlayback;if(entry.revision!==GAME_REVISION||player.config.revision!==GAME_REVISION)throw new Error('这是旧版本的回放，请使用录制时的游戏版本播放。');if(player.config.backend!==this.host.backend)throw new Error(`请通过 ${player.config.backend==='quickjs'?'Play-QuickJS.cmd':'Play.cmd'} 使用录制时的后端。`);
          this.core.game?.saveRun({aborted:true});this.playbackSource=entry.replay;this.extraSelection={};this.page=null;this.core.startTransition(player.config);
        }catch(error){page.message=(error as Error).message;}}});}
  openRecords(){const rows=this.storage.progress.scores.map((entry,index)=>({label:`${String(index+1).padStart(2,'0')}　${PLAYERS[entry.character].name}　${entry.difficulty===4||entry.mode==='extra'?'Extra':GAME.difficultyNames[entry.difficulty]}　${score(entry.score)}`,entry}));
    this.page=new ListPage<RecordRow>({...this.pageOptions('玩家记录'),rows:[{label:'符卡成绩 →',spellRecords:true},...rows.length?rows:[{label:'还没有通关记录。',empty:true}]],detail:row=>row.empty||row.spellRecords?`游戏次数 ${this.storage.progress.plays}\n已见符卡 ${this.storage.progress.seenSpells.length} / ${ALL_SPELLS.length}　按 Z 查看各自机、各难度的收取次数。`:`续关 ${row.entry!.continues} 次　符卡收取 ${row.entry!.captures?.filter(card=>card.captured).length??0}\n${row.entry!.mode==='normal'?'本篇':row.entry!.mode==='extra'?'Extra':'练习'}　${this.storage.extraUnlocked?'Extra 已开放':'Extra 尚未开放'}`,
      onSelect:row=>{if(row.spellRecords)this.openSpellRecords();}});}
  openSpellRecords(difficulty:number|null=null){
    if(difficulty===null){this.page=new ListPage({...this.pageOptions('符卡成绩 · 难度'),rows:[...GAME.difficultyNames,'Extra'].map((label,difficulty)=>({label,difficulty})),detail:()=> '分别统计灵梦与魔理沙在实战、符卡练习中的尝试与收取。',onClose:()=>this.openRecords(),onSelect:row=>this.openSpellRecords(row.difficulty)});return;}
    const rows=ALL_SPELLS.map((spell,index)=>({label:`${String(index+1).padStart(2,'0')}　${spell.name}`,spell,code:spell.code})).filter(row=>difficulty===4?row.spell.stageId===7:row.spell.stageId<=6);
    this.page=new ListPage({...this.pageOptions(`符卡成绩 · ${difficulty===4?'Extra':GAME.difficultyNames[difficulty]}`),rows,
      detail:row=>PLAYERS.map((player,character)=>{const record=this.storage.progress.spellRecords[`${character}:${difficulty}`]?.[row.code];return`${player.name}　实战 ${record?.captures?.[0]??0} / ${record?.attempts?.[0]??0}　练习 ${record?.captures?.[1]??0} / ${record?.attempts?.[1]??0}`;}).join('\n')+'\n收取次数 / 尝试次数',onClose:()=>this.openSpellRecords()});
  }
  openMusicRoom(){this.page=new ListPage({...this.pageOptions('音乐室'),rows:MUSIC_TRACKS.map((track,index)=>({label:`${String(index+1).padStart(2,'0')}　${track.title}`,track})),
    detail:row=>MUSIC_COMMENTS[row.track.id]?.comment??row.track.description,
    onSelect:(row,page)=>{this.music.play(row.track.id,true);page.message=`正在播放：${row.track.title}`;}});}
  openOptions(inGame=false,close?:()=>void){const settings=this.storage.settings,rows:OptionRow[]=[
    {id:'musicVolume',label:()=>`BGM 音量　${settings.musicVolume}%`},{id:'soundVolume',label:()=>`音效音量　${settings.soundVolume}%`},
    {id:'defaults',label:'恢复默认设置'}];
    const adjust=(row:OptionRow,delta:number,page:ListPage<OptionRow>)=>{if(row.id==='musicVolume'||row.id==='soundVolume')settings[row.id]=Math.max(0,Math.min(100,settings[row.id]+delta*5));else return;this.storage.saveSettings();this.music.volume();this.resources.audio!.volume=settings.soundVolume;this.sound(10);page.message='设置已保存。';};
    this.page=new ListPage({...this.pageOptions('选项',inGame,close),rows,detail:()=>`← → 调整　当前脚本后端：${this.host.backend}\n本地设置仅影响本作，不修改 TS-STG 或其他演示。`,onAdjust:adjust,
      onSelect:(row,page)=>{if(row.id==='defaults'){Object.assign(settings,DEFAULT_SETTINGS);this.storage.saveSettings();this.music.volume();this.resources.audio!.volume=settings.soundVolume;page.message='已恢复默认设置。';}else adjust(row,1,page);}});}
  openManual(inGame=false,close?:()=>void){this.page=new ReadingPage({...this.pageOptions('游戏说明',inGame,close),pages:manualPages()});}
  endCampaign(result:RunResult,game:CampaignScene){if(this.options.testing){this.finishedResult=result;return;}this.page=new EndingPage({result,replayAvailable:game.canSaveReplay,text:this.text,art:this.art,music:this.music,sound:(id:number)=>this.sound(id),onClose:()=>this.requestLeaveGame()});}
  practiceEnd(result:RunResult,game:CampaignScene){if(this.options.testing){this.finishedResult=result;return;}const row={label:result.mode==='spell-practice'?(result.captures.at(-1)?.captured?'符卡收取成功':'符卡挑战结束'):'关卡练习完成'};
    const resultPage=new ListPage<PageRow&{retry?:boolean;exit?:boolean;save?:boolean}>({...this.pageOptions('练习结果'),rows:[row,{label:'保存回放',save:true,locked:!game.canSaveReplay},{label:'再次挑战',retry:true},{label:'返回标题',exit:true}],detail:()=>`Score ${score(result.score)}　符卡收取 ${result.captures.filter(card=>card.captured).length} / ${result.captures.length}`,
      onClose:()=>this.requestLeaveGame(),onSelect:choice=>{if(choice.save){this.openSaveReplay(undefined,{onCancel:()=>{this.page=resultPage;}});}else if(choice.retry){this.page=null;this.core.start(game.config);}else this.requestLeaveGame();}});
    this.page=resultPage;}
  replayEnd(game:CampaignScene){if(this.options.testing){this.replayFinished=true;return;}this.page=new ListPage({...this.pageOptions('回放结束'),rows:[{label:'返回标题'}],detail:()=> '回放播放完毕。',onClose:()=>this.leaveGame(),onSelect:()=>this.leaveGame()});}
  openTestPage(page:string){if(page==='music')this.openMusicRoom();else if(page==='manual')this.openManual();else if(page==='options')this.openOptions();else if(page==='spells')this.openSpells();else if(page==='practice')this.openStages();else if(page==='replays')this.openReplays();else if(page==='records')this.openRecords();else if(page==='character')this.core.menu!.openCharacter();else if(page==='difficulty')this.core.menu!.openDifficulty();}
  openPlaybackPause(){
    const addedAudioPause=!this.music.paused;if(addedAudioPause)this.pauseAudio();
    const resume=()=>{this.page=null;if(addedAudioPause)this.resumeAudio();};
    this.page=new ListPage({...this.pageOptions('回放暂停',true),rows:[{label:'继续播放'},{label:'返回标题',exit:true}],detail:()=> 'Esc 暂停 / 返回　按住 Ctrl 快进，松开恢复。',onClose:resume,onSelect:row=>row.exit?this.leaveGame():resume()});
  }
  update(mask=0){
    if(this.destroyed)return;this.frame++;this.liveButtons.update(mask);
    if(!this.page&&this.core.game?.playback&&(this.liveButtons.pressed&Keys.PAUSE)){this.openPlaybackPause();return;}
    if(this.page){this.page.update(mask);this.music.update();this.resources.audio?.flush();return;}
    const game=this.core.game,playing=!!game?.playback;
    const step=()=>{
      // Older recordings include manual pause/menu frames. Consume them with
      // their original checks intact, without making the viewer wait through them.
      do{
        if(this.playbackExternalClose){const close=this.playbackExternalClose;this.playbackExternalClose=null;close();}
        this.core.update(playing?0:mask&~Keys.FAST_FORWARD);
      }while(playing&&this.core.game===game&&!this.page&&!game!.replayDone&&game!.paused&&game!.pauseVisual instanceof TouhouPause);
    };
    try{
      if(playing)this.replayControl.update(mask,step,{shouldContinue:()=>!this.page&&this.core.game===game&&!!game?.playback&&!game.replayDone});
      else step();
    }catch(error){
      if(!playing||!String((error as Error).message).startsWith('Replay desync'))throw error;
      this.music.pause();this.page=new ListPage({...this.pageOptions('回放无法继续',true),rows:[{label:'返回标题'}],detail:()=>`第 ${game!.playback!.frame} 帧的回放校验未通过。\n请使用录制时的版本和后端。`,onClose:()=>this.leaveGame(),onSelect:()=>this.leaveGame()});
    }
  }
  render(){if(this.page){const draw=this.drawList.reset().clear(0x000000ff);this.page.draw(draw);return draw.commands;}return this.core.render();}
  snapshot(){return{game:GAME.id,revision:GAME_REVISION,backend:this.host.backend,frame:this.frame,mode:this.core.mode,page:this.page?.snapshot()??null,scene:this.core.snapshot(),finished:this.finishedResult??null,replayFinished:!!this.replayFinished};}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.core.destroy();this.resources.dispose();this.art.destroy();this.text.destroy();this.music.destroy();this.host.unloadTexture(this.renderTarget);this.host.unloadTexture(this.compositeTarget);}
}
