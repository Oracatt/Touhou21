import {DrawList,ReplayPlayer,Keys} from '@ts-stg/thlib';
import {TouhouApplication,TouhouRNG,TouhouButtons,createTouhouResources} from '@ts-stg/thlib/touhou';
import {GAME,STAGES,PLAYERS,ALL_SPELLS,MIDBOSS_SPELLS,MUSIC_COMMENTS} from './content.js';
import {MUSIC_TRACKS} from './music-data.js';
import {GameArt} from './art.js';
import {TextPainter} from './text.js';
import {MusicController} from './music.js';
import {GameStorage,GAME_REVISION} from './storage.js';
import {ProjectTitleMenu} from './menu.js';
import {ListPage,ReadingPage,EndingPage,manualPages} from './pages.js';
import {CampaignScene} from './scene.js';

const score=value=>String(Math.trunc(value*10)).replace(/\B(?=(\d{3})+(?!\d))/g,',');

export class ProjectApplication {
  constructor(host,{...options}={}){
    this.host=host;this.options=options;this.storage=new GameStorage(host);this.art=new GameArt(host);this.text=new TextPainter(host);
    this.music=new MusicController(host,this.storage.settings);this.frame=0;this.page=null;this.playbackSource=null;this.extraSelection={};this.drawList=new DrawList();this.destroyed=false;
    this.liveButtons=new TouhouButtons();this.playbackExternalClose=null;
    this.resources=createTouhouResources(host,{environment:{rng:new TouhouRNG(0x217e57)},audioVolume:this.storage.settings.soundVolume});
    this.renderTarget=host.createRenderTarget(960,720);this.compositeTarget=host.createRenderTarget(960,720);
    const selection={character:options.character??0,difficulty:options.mode==='extra'?4:options.difficulty??1,mode:options.mode??'normal',stageId:options.stageId??1,spellId:options.spellId??null,seed:options.seed};
    this.core=new TouhouApplication({resources:this.resources,pixels:host,initialSelection:selection,autostart:!!options.autostart,
      createGame:(settings)=>new CampaignScene(settings,{resources:this.resources,host,art:this.art,text:this.text,music:this.music,storage:this.storage,config:settings.gameConfig,playbackSource:this.playbackSource,options,
        onComplete:(result,game)=>this.endCampaign(result,game),onReplayDone:game=>this.replayEnd(game),onSpellPracticeEnd:(result,game)=>this.practiceEnd(result,game)}),
      gameOptions:selected=>this.gameOptions(selected),
      menuOptions:()=>({difficulty:Math.min(3,this.core?.selection?.difficulty??options.difficulty??1),sound:id=>this.sound(id),
        onSelect:index=>this.titleAction(index),onStart:selected=>this.core.startTransition({...selected,stageId:selected.mode==='extra'?7:1,spellId:null,seed:this.options.seed,...this.extraSelection}),disposeBanks:false}),
      createMenu:settings=>new ProjectTitleMenu(settings,{art:this.art,text:this.text,storage:this.storage,unlockAll:!!options.unlockAll,onReturnMain:()=>{this.extraSelection={};}}),
      onSceneChange:({mode})=>{if(mode==='title'){this.playbackSource=null;this.playbackExternalClose=null;this.extraSelection={};this.music.play('title',true);}},
      onPauseChange:paused=>{if(paused)this.pauseAudio();else this.resumeAudio();},
      onAfterUpdate:()=>{this.resources.audio?.flush();this.music.update();},onQuit:()=>host.quit(),
    });
    if(options.page)this.openTestPage(options.page);
  }
  sound(id,x=0){this.resources.audio?.request(id,x);}
  pauseAudio(){this.music.pause();this.pausedSounds=[];for(const handle of this.resources.audio?.handles.values()??[])if(this.host.isSoundPlaying(handle)){this.host.pauseSound(handle);this.pausedSounds.push(handle);}}
  resumeAudio(){this.music.resume();for(const handle of this.pausedSounds??[])this.host.resumeSound(handle);this.pausedSounds=[];}
  gameOptions(selected){
    const config={...selected,...this.extraSelection};config.seed=(config.seed??(Date.now()>>>0))||1;
    if(config.mode==='extra')config.difficulty=4;
    const rng=new TouhouRNG(config.seed),visualRng=new TouhouRNG(config.seed^0x6d2b79f5),banks={};
    for(const name of ['front','bullet','effect','enemy','ascii_960','text',config.character?'pl01':'pl00']){const bank=this.resources.createBank(name);bank.environment={...bank.environment,rng:visualRng};bank.rng=visualRng;banks[name]=bank;}
    if(!this.playbackSource&&!this.options.testing){this.storage.progress.plays++;this.storage.saveProgress();}
    return{banks,font:this.resources.font,styles:this.resources.styles,sht:this.resources.shots[config.character],disposeBanks:true,character:config.character,difficulty:config.difficulty,power:config.mode==='normal'?100:400,rng,visualRng,
      renderTarget:this.renderTarget,compositeTarget:this.compositeTarget,gameConfig:config,
      onSound:(id,x)=>this.sound(id,x),onStopSound:id=>this.resources.audio?.stop(id),
      // Recorded exit/retry is the last input of this recording. Keep its
      // playback scene until ReplayPlayer consumes EOF and verifies it.
      onExit:()=>{if(!this.core.game?.playback)this.leaveGame();},onRestart:()=>{if(this.core.game?.playback)return;this.core.game?.saveRun({aborted:true});this.playbackSource=null;this.core.start({...config,seed:this.options.seed??(Date.now()>>>0)});},
      onReplay:context=>this.openExternalPage('replays',context),onOptions:context=>this.openExternalPage('options',context),onManual:context=>this.openExternalPage('manual',context),
      gameOverOptions:{onReplay:context=>this.openExternalPage('replays',context),onOptions:context=>this.openExternalPage('options',context),onManual:context=>this.openExternalPage('manual',context)}};
  }
  leaveGame(){this.core.game?.saveRun({aborted:true});this.page=null;this.core.openMenu();}
  closePage({inGame=false,close}={}){this.page=null;if(inGame){close?.();return;}this.core.menu?.returnMain();this.music.play('title',true);}
  pageOptions(title,inGame=false,close){return{title,text:this.text,art:this.art,sound:id=>this.sound(id),onClose:()=>this.closePage({inGame,close})};}
  openExternalPage(kind,{close}={}){
    // External utility pages consume no game frames while recording. Playback
    // preserves the opening frame, then applies that page's close continuation
    // before consuming the next recorded core frame.
    if(this.playbackSource){this.playbackExternalClose=close;return;}
    if(kind==='replays')this.openSaveReplay(close);else if(kind==='options')this.openOptions(true,close);else this.openManual(true,close);
  }
  openSaveReplay(close){this.page=new ListPage({...this.pageOptions('保存回放',true,close),rows:[{label:'保存并返回标题',save:true},{label:'返回暂停菜单'}],
    detail:()=>`录制 ${this.core.game.recorder?.frames??0} 帧　最多保留最近 20 次回放。\n手动保存也可用于关闭了自动保存的游戏。`,
    onSelect:row=>{if(row.save){this.core.game.saveRun({aborted:true},{force:true});this.leaveGame();}else this.closePage({inGame:true,close});}});}
  titleAction(index){if(index===2)this.openStages();else if(index===3)this.openSpells();else if(index===4)this.openReplays();else if(index===5)this.openRecords();else if(index===6)this.openMusicRoom();else if(index===7)this.openOptions();else if(index===8)this.openManual();else if(index===9)this.host.quit();}
  choosePractice(selection){this.page=null;this.extraSelection=selection;const menu=this.core.menu;menu.finished=false;menu.mode=selection.mode;if(selection.stageId===7){menu.difficulty=4;menu.openCharacter();}else menu.openDifficulty();}
  openStages(){this.page=new ListPage({...this.pageOptions('关卡练习'),rows:STAGES.filter(stage=>stage.id<=6).map(stage=>({label:stage.title,stage,locked:!this.options.unlockAll&&stage.id>this.storage.progress.stageUnlock})),
    detail:row=>row.locked?'到达此关后开放练习。':`${row.stage.subtitle}\n从完整道中开始，包含中 Boss、全部非符与符卡。`,
    onSelect:(row,page)=>{if(row.locked){page.message='尚未到达这一关。';return;}this.choosePractice({mode:'stage-practice',stageId:row.stage.id,spellId:null});}});}
  openSpells(){const rows=ALL_SPELLS.map((spell,index)=>{const stage=STAGES.find(stage=>stage.id===spell.stageId)??STAGES[6];return{label:`${String(index+1).padStart(2,'0')}　${spell.name}`,spell,stage,locked:!this.options.unlockAll&&!this.storage.progress.seenSpells.includes(spell.id)};});
    this.page=new ListPage({...this.pageOptions('符卡练习'),rows,visibleRows:9,
      detail:row=>row.locked?'遇见此符卡后开放。':`${row.stage.title}${row.spell.midboss?'　道中':''}　${row.spell.seconds}s${row.spell.survival?' · 耐久':''}\n${row.spell.description}`,
      onSelect:(row,page)=>{if(row.locked){page.message='尚未遇见这张符卡。';return;}this.choosePractice({mode:'spell-practice',stageId:row.stage.id,spellId:row.spell.id});}});}
  openReplays(inGame=false,close){const rows=this.storage.replays.map((entry,index)=>({label:`${String(index+1).padStart(2,'0')}　${PLAYERS[entry.summary.character??0].name}　${entry.summary.difficulty===4||entry.summary.mode==='extra'?'Extra':GAME.difficultyNames[entry.summary.difficulty??1]}　${score(entry.summary.score??0)}`,entry}));
    this.page=new ListPage({...this.pageOptions('回放鉴赏',inGame,close),rows:rows.length?rows:[{label:'还没有回放记录。',empty:true}],
      detail:row=>row.empty?'游戏结束或返回标题时，自动保存最近 20 次回放。':`${row.entry.replay.frames} 帧　${Math.round(row.entry.replay.frames/60)} 秒　${row.entry.replay.config.backend}\n使用录制时的后端播放；输入、种子与定期校验点均包含在回放中。`,
      onSelect:(row,page)=>{if(row.empty)return;const entry=row.entry;
        try{const player=new ReplayPlayer(entry.replay);if(entry.revision!==GAME_REVISION||player.config.revision!==GAME_REVISION)throw new Error('这是旧版本的回放。');if(player.config.backend!==this.host.backend)throw new Error(`请通过 ${player.config.backend==='quickjs'?'Play-QuickJS.cmd':'Play.cmd'} 使用录制时的后端。`);
          this.core.game?.saveRun({aborted:true});this.playbackSource=entry.replay;this.extraSelection={};this.page=null;this.core.startTransition(player.config);
        }catch(error){page.message=error.message;}}});}
  openRecords(){const rows=this.storage.progress.scores.map((entry,index)=>({label:`${String(index+1).padStart(2,'0')}　${PLAYERS[entry.character].name}　${entry.difficulty===4||entry.mode==='extra'?'Extra':GAME.difficultyNames[entry.difficulty]}　${score(entry.score)}`,entry}));
    this.page=new ListPage({...this.pageOptions('玩家记录'),rows:[{label:'符卡成绩 →',spellRecords:true},...rows.length?rows:[{label:'还没有通关记录。',empty:true}]],detail:row=>row.empty||row.spellRecords?`游戏次数 ${this.storage.progress.plays}\n已见符卡 ${this.storage.progress.seenSpells.length} / ${ALL_SPELLS.length}　按 Z 查看各自机、各难度的收取次数。`:`续关 ${row.entry.continues} 次　符卡收取 ${row.entry.captures?.filter(card=>card.captured).length??0}\n${row.entry.mode==='normal'?'本篇':row.entry.mode==='extra'?'Extra':'练习'}　${this.storage.extraUnlocked?'Extra 已开放':'Extra 尚未开放'}`,
      onSelect:row=>{if(row.spellRecords)this.openSpellRecords();}});}
  openSpellRecords(difficulty=null){
    if(difficulty===null){this.page=new ListPage({...this.pageOptions('符卡成绩 · 难度'),rows:[...GAME.difficultyNames,'Extra'].map((label,difficulty)=>({label,difficulty})),detail:()=> '分别统计灵梦与魔理沙在实战、符卡练习中的尝试与收取。',onClose:()=>this.openRecords(),onSelect:row=>this.openSpellRecords(row.difficulty)});return;}
    const rows=ALL_SPELLS.map((spell,index)=>({label:`${String(index+1).padStart(2,'0')}　${spell.name}`,spell,code:spell.code})).filter(row=>difficulty===4?row.spell.stageId===7:row.spell.stageId<=6);
    this.page=new ListPage({...this.pageOptions(`符卡成绩 · ${difficulty===4?'Extra':GAME.difficultyNames[difficulty]}`),rows,
      detail:row=>PLAYERS.map((player,character)=>{const record=this.storage.progress.spellRecords[`${character}:${difficulty}`]?.[row.code];return`${player.name}　实战 ${record?.captures?.[0]??0} / ${record?.attempts?.[0]??0}　练习 ${record?.captures?.[1]??0} / ${record?.attempts?.[1]??0}`;}).join('\n')+'\n收取次数 / 尝试次数',onClose:()=>this.openSpellRecords()});
  }
  openMusicRoom(){this.page=new ListPage({...this.pageOptions('音乐室'),rows:MUSIC_TRACKS.map((track,index)=>({label:`${String(index+1).padStart(2,'0')}　${track.title}`,track})),
    detail:row=>MUSIC_COMMENTS[row.track.id]?.comment??row.track.description,
    onSelect:(row,page)=>{this.music.play(row.track.id,true);page.message=`正在播放：${row.track.title}\n${row.track.description}`;}});}
  openOptions(inGame=false,close){const settings=this.storage.settings,rows=[
    {id:'musicVolume',label:()=>`BGM 音量　${settings.musicVolume}%`},{id:'soundVolume',label:()=>`音效音量　${settings.soundVolume}%`},
    {id:'startingLives',label:()=>`初始生命　${settings.startingLives+1}`},{id:'autoSaveReplay',label:()=>`自动保存回放　${settings.autoSaveReplay?'开启':'关闭'}`},{id:'defaults',label:'恢复默认设置'}];
    const adjust=(row,delta,page)=>{if(row.id==='musicVolume'||row.id==='soundVolume')settings[row.id]=Math.max(0,Math.min(100,settings[row.id]+delta*5));else if(row.id==='startingLives')settings.startingLives=Math.max(1,Math.min(5,settings.startingLives+delta));else if(row.id==='autoSaveReplay')settings.autoSaveReplay=!settings.autoSaveReplay;else return;this.storage.saveSettings();this.music.volume();this.resources.audio.volume=settings.soundVolume;this.sound(10);page.message='设置已保存；初始生命在下一局生效。';};
    this.page=new ListPage({...this.pageOptions('选项',inGame,close),rows,detail:()=>`← → 调整　当前脚本后端：${this.host.backend}\n本地设置仅影响本作，不修改 TS-STG 或其他演示。`,onAdjust:adjust,
      onSelect:(row,page)=>{if(row.id==='defaults'){Object.assign(settings,{musicVolume:72,soundVolume:70,startingLives:2,autoSaveReplay:true});this.storage.saveSettings();this.music.volume();this.resources.audio.volume=settings.soundVolume;page.message='已恢复默认设置。';}else adjust(row,1,page);}});}
  openManual(inGame=false,close){this.page=new ReadingPage({...this.pageOptions('游戏说明',inGame,close),pages:manualPages()});}
  endCampaign(result,game){if(this.options.testing){this.finishedResult=result;return;}this.page=new EndingPage({result:{...result,replaySaved:!!game.replaySaved},text:this.text,art:this.art,music:this.music,sound:id=>this.sound(id),onClose:()=>{this.page=null;this.core.openMenu();}});}
  practiceEnd(result,game){if(this.options.testing){this.finishedResult=result;return;}const row={label:result.mode==='spell-practice'?(result.captures.at(-1)?.captured?'符卡收取成功':'符卡挑战结束'):'关卡练习完成'};
    this.page=new ListPage({...this.pageOptions('练习结果'),rows:[row,{label:'再次挑战',retry:true},{label:'返回标题',exit:true}],detail:()=>`Score ${score(result.score)}　符卡收取 ${result.captures.filter(card=>card.captured).length} / ${result.captures.length}`,
      onClose:()=>this.leaveGame(),onSelect:choice=>{if(choice.retry){this.page=null;this.core.start(game.config);}else this.leaveGame();}});}
  replayEnd(game){if(this.options.testing){this.replayFinished=true;return;}this.page=new ListPage({...this.pageOptions('回放结束'),rows:[{label:'回放播放完毕，校验通过。'}],detail:()=>`${game.playback.data.frames} 帧已播放。`,onClose:()=>this.leaveGame(),onSelect:()=>this.leaveGame()});}
  openTestPage(page){if(page==='music')this.openMusicRoom();else if(page==='manual')this.openManual();else if(page==='options')this.openOptions();else if(page==='spells')this.openSpells();else if(page==='practice')this.openStages();else if(page==='replays')this.openReplays();else if(page==='records')this.openRecords();else if(page==='character')this.core.menu.openCharacter();else if(page==='difficulty')this.core.menu.openDifficulty();}
  openPlaybackPause(){
    const addedAudioPause=!this.music.paused;if(addedAudioPause)this.pauseAudio();
    const resume=()=>{this.page=null;if(addedAudioPause)this.resumeAudio();};
    this.page=new ListPage({...this.pageOptions('回放暂停',true),rows:[{label:'继续播放'},{label:'返回标题',exit:true}],detail:()=> 'Esc 暂停 / 返回　Shift 按住以 2 倍速播放。',onClose:resume,onSelect:row=>row.exit?this.leaveGame():resume()});
  }
  update(mask=0){
    if(this.destroyed)return;this.frame++;this.liveButtons.update(mask);
    if(!this.page&&this.core.game?.playback&&(this.liveButtons.pressed&Keys.PAUSE)){this.openPlaybackPause();return;}
    if(this.page){this.page.update(mask);this.music.update();this.resources.audio?.flush();return;}
    const game=this.core.game,playing=!!game?.playback,updates=playing&&(mask&Keys.FOCUS)?2:1;
    try{for(let i=0;i<updates;i++){
      if(i&&(this.page||this.core.game!==game||!this.core.game?.playback))break;
      if(this.playbackExternalClose){const close=this.playbackExternalClose;this.playbackExternalClose=null;close();}
      this.core.update(playing?0:mask);
    }}catch(error){
      if(!playing||!String(error.message).startsWith('Replay desync'))throw error;
      this.music.pause();this.page=new ListPage({...this.pageOptions('回放无法继续',true),rows:[{label:'返回标题'}],detail:()=>`第 ${game.playback.frame} 帧的回放校验未通过。\n请使用录制时的版本和后端。`,onClose:()=>this.leaveGame(),onSelect:()=>this.leaveGame()});
    }
  }
  render(){if(this.page){const draw=this.drawList.reset().clear(0x000000ff);this.page.draw(draw);return draw.commands;}return this.core.render();}
  snapshot(){return{game:GAME.id,revision:GAME_REVISION,backend:this.host.backend,frame:this.frame,mode:this.core.mode,page:this.page?.snapshot()??null,scene:this.core.snapshot(),finished:this.finishedResult??null,replayFinished:!!this.replayFinished};}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.core.destroy();this.resources.dispose();this.art.destroy();this.text.destroy();this.music.destroy();this.host.unloadTexture(this.renderTarget);this.host.unloadTexture(this.compositeTarget);}
}
