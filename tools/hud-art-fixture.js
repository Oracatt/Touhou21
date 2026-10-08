import {Keys,ReplayPlayer} from '@ts-stg/thlib';
import {TouhouHud,TouhouPause,TouhouGameOver} from '@ts-stg/thlib/touhou';
import {ProjectApplication} from '../src/application.js';
import {GAME,STAGES} from '../src/content.js';
import {GAME_REVISION} from '../src/storage.js';

/** Actual App/public HUD display checks. User data stays in memory. The last
 * scenario first records and plays real input, then explicitly presets values
 * only for a static layout sample; it is not a difficulty/collision test. */
export function createHudArtFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath)),memory=new Map();
  const assert=(value,message)=>{if(!value)throw new Error(`${scenario.id}: ${message}`);};
  const normalPath=value=>String(value).replaceAll('\\','/'),host=Object.create(native),texturePaths=new Map();let memoryWrites=0;
  Object.defineProperties(host,{
    readText:{value:file=>normalPath(file).startsWith('userdata/')?memory.get(normalPath(file))??'':native.readText(file)},
    writeText:{value:(file,text)=>{const name=normalPath(file);assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA writes remain relative memory userdata');memory.set(`userdata/${name}`,text);memoryWrites++;}},
    loadTexture:{value:(file,...args)=>{const id=native.loadTexture(file,...args);texturePaths.set(id,normalPath(file));return id;}},
  });
  const app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210909,autostart:true,invincible:true,autoDialogue:true,
    character:scenario.character,mode:scenario.mode,stageId:scenario.stageId,difficulty:scenario.stageId===7?4:1,
    skipRoad:scenario.kind==='combat',spellId:scenario.kind==='spell'?scenario.spellId??STAGES[scenario.stageId-1].spells[0].id:null});
  assert(app.resources.locale==='zh-CN','The production App selects Chinese through the public resource API');
  const resourceRoot=app.resources.basePath,manifest=app.resources.manifest,localeDescriptor=manifest.locales?.['zh-CN']?.archives?.front;
  assert(localeDescriptor?.file,'Chinese front resources are explicitly declared by the public manifest');
  const readArchive=file=>JSON.parse(host.readText(`${resourceRoot}/${file}`)),localizedFront=readArchive(localeDescriptor.file),baseFront=readArchive(manifest.archives.front.file);
  const localizedTexturePaths=localizedFront.entries.map(entry=>entry.texture.path?`${resourceRoot}/${entry.texture.path}`:null);
  assert(app.resources.data.front.entries.length===localizedFront.entries.length&&app.resources.data.front.entries.every((entry,index)=>(entry.texture.path??null)===localizedTexturePaths[index]),'Actual public front data uses the selected locale descriptor');
  const changedTexturePaths=localizedTexturePaths.filter((file,index)=>file&&file!==`${resourceRoot}/${baseFront.entries[index]?.texture.path}`);
  assert(changedTexturePaths.length>=1,'Chinese HUD and pause/title image regions have an explicit locale texture atlas');
  let game=app.core.game,applicationUpdates=0,nativeFrames=0,ready=false,preview=false,observing=false,result=null;
  const inputs=[],assetLoads=[],textCalls=[],numberCalls=[],replayCalls=[],statusCalls=[],skinCalls=[],menuCalls=[];let activePriority=null,menuOwner=null;
  const initialProgress=JSON.stringify(app.storage.progress);
  const advance=(mask=0)=>{if(mask)inputs.push({frame:app.frame,mask});app.update(mask);applicationUpdates++;game=app.core.game;};
  const load=app.art.load.bind(app.art);
  app.art.load=file=>{const asset=load(file);if(observing)assetLoads.push({file,id:asset.id,width:asset.width,height:asset.height,bounds:{...asset.bounds}});return asset;};
  const text=app.text.draw.bind(app.text);
  app.text.draw=(target,value,x,y,options={})=>{if(observing)textCalls.push({text:String(value),x,y,options:{...options}});return text(target,value,x,y,options);};
  const font=app.resources.font,drawFont=font.draw.bind(font);
  font.draw=(target,value,options={})=>{
    const actual=observing&&!target.enqueuePriority,number=actual&&options.drawPriority===75&&(options.font??10)===10,
      replay=actual&&options.drawPriority===74&&options.font===6&&String(value)==='Replay',start=number||replay?target.commands.length:0;
    const answer=drawFont(target,value,options);
    if(number||replay)(number?numberCalls:replayCalls).push({text:String(value),options:{...options},priority:activePriority,commands:target.commands.slice(start)});return answer;
  };
  const spriteSource=vm=>{
    const sprite=vm.bank.data.sprites[vm.spriteIndex],entry=sprite?vm.bank.data.entries[sprite.entry]:null;
    return sprite&&entry?{sprite:vm.spriteIndex,texturePath:entry.texture.path??null,sourceRect:{x:sprite.x,y:sprite.y,width:sprite.width,height:sprite.height}}:null;
  };
  const observeHud=()=>{
    assert(game.hud instanceof TouhouHud,'The Scene uses the actual public HUD owner');
    assert(!Object.hasOwn(game.hud.roots[0],'draw'),'The Scene does not replace a public HUD animation draw method');
    const enqueue=game.renderQueue.enqueuePriority.bind(game.renderQueue);
    game.renderQueue.enqueuePriority=(priority,callback,options)=>enqueue(priority,(...args)=>{
      const previous=activePriority;activePriority=priority;try{return callback(...args);}finally{activePriority=previous;}
    },options);
    for(const key of ['drawFrame','drawBranding']){
      const callback=game.hud.skin?.[key];assert(typeof callback==='function',`Game artwork uses the public ${key} skin callback`);
      game.hud.skin[key]=(target,context)=>{
        const start=target.commands.length,answer=callback.call(game.hud.skin,target,context);
        if(observing){assert(context.hud===game.hud,'The public owner supplies its actual skin context');
          skinCalls.push({key,priority:activePriority,commands:target.commands.slice(start)});}return answer;
      };
    }
    const labelScripts=new Map([[6,'highScore'],[7,'score'],[8,'lives'],[10,'bombs'],[12,'power']]),seen=new Set();
    const groups=[['status',game.hud.roots],['life',game.hud.lifeIcons],['bomb',game.hud.bombIcons],
      ...Object.entries(game.hud.labels??{}).map(([key,vm])=>[`label-${key}`,[vm]])];
    for(const [group,entries] of groups)for(const root of entries){
      const visit=vm=>{if(seen.has(vm))return;seen.add(vm);const drawSelf=vm.drawSelf.bind(vm);vm.drawSelf=(target,view)=>{
        const actual=observing&&!target.enqueueAnm,start=actual?target.commands.length:0,answer=drawSelf(target,view);
        if(actual&&target.commands.length>start)statusCalls.push({kind:labelScripts.has(vm.scriptId)?`label-${labelScripts.get(vm.scriptId)}`:group,
          scriptId:vm.scriptId,priority:vm.drawPriority,source:spriteSource(vm),commands:target.commands.slice(start)});return answer;
      };for(const child of vm.children??[])visit(child);};visit(root);
    }
    if(menuOwner){
      const visit=vm=>{const drawSelf=vm.drawSelf.bind(vm);vm.drawSelf=(target,view)=>{
        const actual=observing&&!target.enqueueAnm,start=actual?target.commands.length:0,answer=drawSelf(target,view);
        if(actual&&target.commands.length>start)menuCalls.push({scriptId:vm.scriptId,priority:vm.drawPriority,source:spriteSource(vm),commands:target.commands.slice(start)});return answer;
      };for(const child of vm.children??[])visit(child);};visit(menuOwner.panel);
    }
  };
  let replayProof=null,layoutPreset=null,renderWarmup=null,pointProof=null;
  function* prepare(){
    if(scenario.kind==='point-growth'){
      for(let i=0;i<90;i++){advance();if(applicationUpdates%32===0)yield;}
      const player=game.player;
      assert(player.pointValue===10000&&player.graze===0,'A new game starts with the initial point value');
      game.bullets.emit({count:11,x:player.x+30,y:player.y,speed:0});advance();
      assert(player.graze===11&&player.pointValue===10010,'Real public bullet collisions award eleven grazes and one ten-point increase');
      game.bullets.cancelCircle(player.x,player.y,640,{dropMode:0});
      const score=player.score,item=game.items.spawn({type:2,x:player.x,y:player.y,state:3,speed:0});advance();
      assert(item.state===0&&player.pointItems===1&&player.score-score===1001,'Real full-value blue point pays the displayed 10,010 points');
      pointProof={graze:player.graze,pointValue:player.pointValue,pointItems:player.pointItems,displayedAward:(player.score-score)*10};
    }else if(scenario.kind==='replay'){
      const recording=game;
      for(let i=0;i<240;i++){advance(i%60<20?Keys.FOCUS:0);if(i===89)recording.recorder.checkpoint(recording.snapshot());if(applicationUpdates%32===0)yield;}
      const replay=recording.recorder.toJSON();assert(replay.frames===240&&replay.checkpoints.length===1,'Real Scene recorder includes a frame90 checkpoint');
      app.storage.replays=[{revision:GAME_REVISION,summary:{character:scenario.character,difficulty:1,mode:'normal',score:recording.player.score},replay}];
      app.openReplays();assert(app.page?.rows.length===1,'Actual replay list contains the recorded run');
      for(let i=0;i<8;i++)advance();
      advance(Keys.SHOOT);advance();
      for(let i=0;!game?.playback;i++){assert(i<180,'Actual replay selection reaches a new playback Scene');advance();if(applicationUpdates%32===0)yield;}
      assert(game!==recording&&game.playback instanceof ReplayPlayer,'App creates a genuine public ReplayPlayer from the recorded run');
      while(game.playback.frame<90){advance();if(applicationUpdates%32===0)yield;}
      assert(game.playback.frame===90&&game.playback.desync===null&&!app.page,'Playback verifies the real frame90 checkpoint before layout presets');
      replayProof={recordedFrames:replay.frames,playedFrames:game.playback.frame,checkpoint:replay.checkpoints[0],desync:game.playback.desync,
        entry:'Real App replay list, Shoot selection, transition and ReplayPlayer; no fabricated playback object'};
      layoutPreset={score:999999999,highScore:999999999,lives:game.hud.maximumLives,bombs:game.hud.maximumBombs,
        lifeFragments:game.hud.lifeFragmentThreshold-1,bombFragments:game.hud.bombFragmentThreshold-1,
        power:game.hud.maxPower,graze:99999999,pointValue:game.player.rules.pointValueMaximum,pointItems:99999999};
      Object.assign(game.player,layoutPreset);game.hud.update(game.player);
    }else if(scenario.kind==='combat'||scenario.kind==='spell'){
      for(let i=0;game.director.state!=='combat';i++){assert(i<2500,'Real App reaches the requested Boss combat');advance();if(applicationUpdates%32===0)yield;}
      if(scenario.kind==='spell'){
        assert(game.spell.active,'Spell sample uses a real active spell');
        assert(game.spell.viewIndex===0&&game.spell.info[1]?.scriptId===22,'Both player characters use the single-field animated spell-name template');
      }
      else assert(!game.director.phase.spell,'Requested real ordinary attack');
      for(let i=0;i<scenario.age;i++){advance();if(applicationUpdates%32===0)yield;}
    }else{
      for(let i=0;i<90;i++){advance();if(applicationUpdates%32===0)yield;}
      assert(game.director.state==='road'&&game.bgmCaption,'Road90 includes the actual BGM caption');
      if(['pause','pause-confirm','gameover'].includes(scenario.kind)){
        preview=true;yield;preview=false;
        const frame=game.frame;
        if(scenario.kind==='gameover'){game.openGameOver(0);assert(game.pauseVisual instanceof TouhouGameOver,'Public openGameOver creates the real result owner');}
        else{advance(Keys.PAUSE);advance();assert(game.pauseVisual instanceof TouhouPause,'Actual Esc opens the public pause owner');}
        assert(game.paused,'The public menu pauses actual gameplay');
        for(let i=0;game.pauseVisual.phase!==6;i++){assert(i<60,'Pause reaches its public menu');advance();if(applicationUpdates%32===0)yield;}
        for(let i=0;i<35;i++)advance();menuOwner=game.pauseVisual;
        if(scenario.kind==='pause-confirm'){
          advance(Keys.DOWN);advance();assert(menuOwner.selection===1&&!menuOwner.excluded.has(1),'Actual direction input selects Exit');
          advance(Keys.SHOOT);advance();assert(menuOwner.phase===7,'Actual Shoot opens the public exit confirmation');
          for(let i=0;menuOwner.age<42;i++){assert(i<50,'Public confirmation settles');advance();}
          assert(menuOwner.count===2&&menuOwner.selection===1,'Public Yes/No confirmation defaults to No without accepting');
        }
        assert(app.page===null&&menuOwner.active&&menuOwner.panelVisible&&menuOwner.panel,'The real public ANM menu is visible without an external business page');
        assert(game.frame===frame,'Pause/result menus freeze actual gameplay');
      }
    }
    // The public bullet owner mirrors its world pose into the embedded ANM
    // during draw. Let one genuine native frame establish that display pose;
    // the captured render below must then leave the full snapshot unchanged.
    const warmupBefore=JSON.stringify(app.snapshot());preview=true;yield;preview=false;
    const warmupAfter=JSON.stringify(app.snapshot()),warmupDifferences=[];
    if(warmupAfter!==warmupBefore){const visit=(left,right,path)=>{
      if(JSON.stringify(left)===JSON.stringify(right))return;
      if(left&&right&&typeof left==='object'&&typeof right==='object')for(const key of new Set([...Object.keys(left),...Object.keys(right)]))visit(left[key],right[key],`${path}.${key}`);
      else warmupDifferences.push({path,before:left,after:right});
    };visit(JSON.parse(warmupBefore),JSON.parse(warmupAfter),'app');}
    assert(warmupDifferences.every(value=>/^app\.scene\.bullets\.bullets\.\d+\.animation(?:\.children\.\d+)*\.position\.[xyz]$/.test(value.path)),`Warm-up changes only source bullet ANM pose mirrors: ${JSON.stringify(warmupDifferences.slice(0,12))}`);
    renderWarmup={nativeFrames:1,changedLeaves:warmupDifferences.length,changedPathSample:warmupDifferences.slice(0,12),
      reason:'Public bullets.draw syncs world position into embedded ANM presentation; no clock, physical bullet, player or RNG state change is accepted.'};
    assert(memoryWrites===0&&JSON.stringify(app.storage.progress)===initialProgress,'Preparation leaves persistent progress and userdata untouched');
    observeHud();
    result={passed:true,id:scenario.id,backend:native.backend,applicationUpdates,inputs,memoryWrites,memoryUserdataKeys:[...memory.keys()].sort(),
      actualState:app.snapshot(),layoutPreset,replayProof,renderWarmup,pointProof,hudLayout:game.hud.layout,hudReplay:game.hud.replay,
      spellTitle:game.spell.active?{name:game.spell.name,age:game.spell.age.current,animations:game.spell.info.map(vm=>vm?.snapshot()??null)}:null,
      locale:{name:app.resources.locale,frontDescriptor:localeDescriptor,changedTexturePaths},menu:menuOwner?.snapshot()??null,
      menuEntry:scenario.kind==='gameover'?'Explicit public openGameOver API; no death/input reproduction':menuOwner?'Actual Esc and navigation input':null,
      commands:0,assetLoads,textCalls,numberCalls:[],replayCalls:[],statusCalls:[],skinCalls:[],menuCalls:[],
      scope:'Eight focused actual App/public zh-CN HUD and menu samples. Invincibility isolates presentation; GameOver enters via the public API. The layout preset follows a genuine verified replay. No campaign, collision, difficulty or audio-quality claim.'};ready=true;
  }
  const runner=prepare(),paintCommand=command=>['sprite','spriteRegion','quad','statefulQuad','mesh','mesh3d'].includes(command[0]);
  const close=(a,b)=>Math.abs(a-b)<1e-6;
  const contains=(outer,inner)=>inner.x>=outer.x-1e-6&&inner.y>=outer.y-1e-6&&inner.x+inner.width<=outer.x+outer.width+1e-6&&inner.y+inner.height<=outer.y+outer.height+1e-6;
  const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const paintedBounds=commands=>{
    const points=[];for(const command of commands){
      if(command[0]==='sprite'||command[0]==='spriteRegion'){
        const offset=command[0]==='sprite'?2:6,[x,y,width,height,rotation]=command.slice(offset,offset+5),c=Math.cos(rotation),s=Math.sin(rotation);
        for(const dx of [-width/2,width/2])for(const dy of [-height/2,height/2])points.push([x+dx*c-dy*s,y+dx*s+dy*c]);
      }else if(command[0]==='quad'||command[0]==='statefulQuad'){
        for(let i=0;i<8;i+=2)points.push([command[6]+(command[3]+command[2][i])*command[5],command[7]+(command[4]+command[2][i+1])*command[5]]);
      }else if(command[0]==='mesh')points.push(...command[2].map(vertex=>vertex.slice(0,2)));
    }
    if(!points.length)return null;const xs=points.map(value=>value[0]),ys=points.map(value=>value[1]);
    return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  };
  // Use the actual submitted source pixels, including numeric shadow glyphs.
  // Transparent ANM sprite padding must not stand in for visible letter bounds.
  const pixelSurfaces=new Map(),visibleBounds=(commands,source=null)=>{
    const rectangles=[];
    for(const command of commands){
      const region=command[0]==='spriteRegion'?{x:command[2],y:command[3],width:command[4],height:command[5]}:
        ['quad','statefulQuad'].includes(command[0])?source?.sourceRect:null;
      if(!region||!texturePaths.has(command[1]))continue;
      let surface=pixelSurfaces.get(command[1]);if(!surface){surface=host.readTexturePixels(command[1]);pixelSurfaces.set(command[1],surface);}
      let left=surface.width,top=surface.height,right=-1,bottom=-1;
      for(let y=Math.max(0,Math.floor(region.y));y<Math.min(surface.height,Math.ceil(region.y+region.height));y++)
        for(let x=Math.max(0,Math.floor(region.x));x<Math.min(surface.width,Math.ceil(region.x+region.width));x++)
          if(surface.pixels[(y*surface.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      if(right<left||bottom<top)continue;
      const box=paintedBounds([command]);assert(box,'HUD source glyph has actual painted geometry');
      const x0=box.x+(Math.max(left,region.x)-region.x)*box.width/region.width,
        y0=box.y+(Math.max(top,region.y)-region.y)*box.height/region.height,
        x1=box.x+(Math.min(right+1,region.x+region.width)-region.x)*box.width/region.width,
        y1=box.y+(Math.min(bottom+1,region.y+region.height)-region.y)*box.height/region.height;
      rectangles.push({x:x0,y:y0,width:x1-x0,height:y1-y0});
    }
    if(!rectangles.length)return null;
    const x=Math.min(...rectangles.map(box=>box.x)),y=Math.min(...rectangles.map(box=>box.y));
    return{x,y,width:Math.max(...rectangles.map(box=>box.x+box.width))-x,height:Math.max(...rectangles.map(box=>box.y+box.height))-y};
  };
  return{
    update(){nativeFrames++;if(!ready)runner.next();},
    render(){
      if(preview)return app.render();if(!ready||nativeFrames!==scenario.captureFrame)return[];
      const before=JSON.stringify(app.snapshot());observing=true;const commands=app.render();observing=false;
      const after=JSON.stringify(app.snapshot()),differences=[];
      if(after!==before){const visit=(left,right,path)=>{
        if(differences.length>=12||JSON.stringify(left)===JSON.stringify(right))return;
        if(left&&right&&typeof left==='object'&&typeof right==='object')for(const key of new Set([...Object.keys(left),...Object.keys(right)]))visit(left[key],right[key],`${path}.${key}`);
        else differences.push({path,before:left,after:right});
      };visit(JSON.parse(before),JSON.parse(after),'app');}
      assert(after===before,`Rendering does not change the actual App/Scene snapshot: ${JSON.stringify(differences)}`);
      const panelLoads=assetLoads.filter(value=>value.file==='assets/art/hud-panel.png'),logoLoads=assetLoads.filter(value=>value.file==='assets/art/hud-logo.png');
      assert(panelLoads.length===1&&logoLoads.length===1,'Actual GameArt loads panel and logo once for this render');
      const panel=panelLoads[0],logo=logoLoads[0],panelIndices=commands.flatMap((command,index)=>paintCommand(command)&&command[1]===panel.id?[index]:[]),
        logoIndices=commands.flatMap((command,index)=>paintCommand(command)&&command[1]===logo.id?[index]:[]);
      assert(panelIndices.length===4&&logoIndices.length===1,'One continuous frame texture is painted in four strips; branding is painted once');
      assert(!assetLoads.some(value=>value.file==='assets/art/title.png'),'The game frame does not load a separate title background');
      const panelIndex=Math.max(...panelIndices),logoIndex=logoIndices[0],frameCommand=commands[panelIndices[0]],
        command=commands[logoIndex],b=logo.bounds,frameClips=[];
      assert(frameCommand[0]==='spriteRegion'&&panelIndices.every(index=>JSON.stringify(commands[index])===JSON.stringify(frameCommand)),'Every frame strip samples the identical source rectangle and canvas projection');
      const sourceWidth=panel.width*.76,sourceHeight=sourceWidth*.75;
      assert(close(frameCommand[2],(panel.width-sourceWidth)/2)&&close(frameCommand[3],(panel.height-sourceHeight)/2)&&close(frameCommand[4],sourceWidth)&&close(frameCommand[5],sourceHeight),'The frame samples one centered artwork region');
      assert(frameCommand[6]===480&&frameCommand[7]===360&&frameCommand[8]===960&&frameCommand[9]===720&&frameCommand[10]===0,'The frame uses one unrotated full-canvas960x720 projection');
      let frameClip=null;for(let index=0;index<=panelIndex;index++){
        if(commands[index][0]==='scissor')frameClip={x:commands[index][1],y:commands[index][2],width:commands[index][3],height:commands[index][4]};
        else if(commands[index][0]==='scissorEnd')frameClip=null;
        if(panelIndices.includes(index)){assert(frameClip,'Every frame paint has an actual native clip');frameClips.push({...frameClip});}
      }
      const expectedClips=[{x:0,y:0,width:960,height:24},{x:0,y:24,width:48,height:672},{x:624,y:24,width:336,height:672},{x:0,y:696,width:960,height:24}],field={x:48,y:24,width:576,height:672};
      assert(JSON.stringify(frameClips)===JSON.stringify(expectedClips),'Four native clips cover precisely the exterior frame and sidebar');
      for(let i=0;i<frameClips.length;i++){
        assert(!overlap(frameClips[i],field),'Continuous frame paint never covers the playfield');
        for(let j=i+1;j<frameClips.length;j++)assert(!overlap(frameClips[i],frameClips[j]),'Exterior frame strips do not overlap');
      }
      assert(frameClips.reduce((area,box)=>area+box.width*box.height,0)===960*720-576*672,'Clips cover the complete outer frame without holes');
      assert(logoIndex>panelIndex,'Branding follows all four frame strips');
      assert(command[0]==='spriteRegion'&&command[2]===b.x&&command[3]===b.y&&command[4]===b.width&&command[5]===b.height,'Logo samples the entire manifest alpha bounds');
      const logoRect={x:command[6]-command[8]/2,y:command[7]-command[9]/2,width:command[8],height:command[9]};
      const logoBox={x:644,y:500,width:296,height:190};
      assert(contains(logoBox,logoRect)&&close(command[8]/b.width,command[9]/b.height)&&command[10]===0,'Whole unrotated logo fits its lower-right box without stretching or clipping');
      let clip=null;for(let index=0;index<logoIndex;index++){
        if(commands[index][0]==='scissor')clip={x:commands[index][1],y:commands[index][2],width:commands[index][3],height:commands[index][4]};
        else if(commands[index][0]==='scissorEnd')clip=null;
      }
      assert(!clip||contains(clip,logoRect),'The active native clip contains the entire logo');
      const rightText=textCalls.filter(value=>value.x>=624);
      assert(!rightText.some(value=>value.text===GAME.title||STAGES.some(stage=>value.text===stage.location)),'No system-font game title or stage-location name remains in the sidebar');
      assert(rightText.length===0,'Status labels, values, character and Replay never use the system-font TextPainter');
      const submitted=entry=>{const painted=entry.commands.filter(paintCommand),indices=painted.map(value=>commands.indexOf(value));
        assert(indices.length>0&&indices.every(index=>index>panelIndex),'Actual public HUD painted commands appear above the panel');
        const paths=[...new Set(painted.map(command=>texturePaths.get(command[1])??null))];
        if(entry.source?.texturePath)assert(paths.includes(entry.source.texturePath),'The emitted ANM command uses its real source bitmap texture');
        const {commands:ignored,...data}=entry;return{...data,texturePaths:paths,commandStart:Math.min(...indices),commandEnd:Math.max(...indices)+1,paintedCommands:indices.length,bounds:paintedBounds(painted),visibleBounds:visibleBounds(painted,entry.source)};};
      result.numberCalls=numberCalls.map(submitted);result.statusCalls=statusCalls.map(submitted);result.replayCalls=replayCalls.map(submitted);result.menuCalls=menuCalls.map(submitted);
      // Spell practice starts on frame one; the original HUD stock scripts
      // remain transparent for 60 frames, then fade in over another 40.
      const earlySpell=scenario.kind==='spell'&&game.frame<=100;
      if(!earlySpell)assert(result.statusCalls.some(value=>value.kind==='life')&&result.statusCalls.some(value=>value.kind==='bomb'),'Actual public life and Bomb stock sprites remain drawn');
      result.hudEntering=earlySpell;
      for(const key of ['highScore','score','lives','bombs','power','pointValue','graze']){
        const label=result.statusCalls.find(value=>value.kind===`label-${key}`);
        if(!label&&earlySpell)continue;
        assert(label,`Actual public ${key} image label remains drawn above the panel`);
        assert(label.priority===74,`The public ${key} label retains priority74`);
        assert(localizedTexturePaths.includes(label.source?.texturePath),`The public ${key} label comes from the selected front archive`);
      }
      assert(result.statusCalls.filter(value=>['label-highScore','label-score','label-lives','label-bombs','label-power'].includes(value.kind))
        .every(value=>changedTexturePaths.includes(value.source?.texturePath)),'Core status labels use real Chinese locale imagery');
      const powerLabel=result.statusCalls.find(value=>value.kind==='label-power'),pointLabel=result.statusCalls.find(value=>value.kind==='label-pointValue'),grazeLabel=result.statusCalls.find(value=>value.kind==='label-graze');
      if(!earlySpell){
        assert(pointLabel.source.sourceRect.width===168&&pointLabel.source.sourceRect.height===36,'The complete original blue point icon and Chinese label cell are submitted');
        assert(close(pointLabel.bounds.height,powerLabel.bounds.height)&&close(grazeLabel.bounds.height,powerLabel.bounds.height),'Point and Graze labels use the same native display height as Power');
      }
      assert(!game.hud.roots.some(vm=>[101,102].includes(vm.scriptId)),'Default character-name artwork is disabled');
      for(const [key,y] of [['pointValue',204],['graze',226],['replay',274]])assert(game.hud.layout[key].y===y,`Public ${key} row retains its default source-screen origin`);
      assert(!Object.hasOwn(game.hud.labels,'replay'),'Replay has no replacement ANM label or generated image owner');
      assert(replayCalls.length===(scenario.kind==='replay'?1:0),'Original Replay glyphs are submitted only for genuine playback');
      for(const call of replayCalls){
        assert(call.priority===74&&call.options.x===440&&call.options.y===274&&call.options.font===6,'Replay uses the public priority74/default row/font6');
        assert(font.data===app.resources.data.ascii_960,'Replay font data is the original public ASCII animation archive');
        const painted=call.commands.filter(paintCommand),expected=[...font.layout('Replay',{...call.options,font:8}),...font.layout('Replay',call.options)];
        assert(painted.length===12&&expected.length===12,'Six original Replay glyphs and six original shadow glyphs are painted');
        for(let i=0;i<expected.length;i++){
          const glyph=expected[i],sprite=glyph.sprite,entry=font.data.entries[sprite.entry],command=painted[i];
          assert(command[0]==='spriteRegion'&&texturePaths.get(command[1])===entry.texture.path&&command[2]===sprite.x&&command[3]===sprite.y&&command[4]===sprite.width&&command[5]===sprite.height,'Each Replay command samples the actual original ASCII glyph rectangle');
          assert(close(command[6],Math.fround(glyph.x+glyph.width/2))&&close(command[7],Math.fround(glyph.y+glyph.height/2)),'Replay glyphs use the actual public bitmap-font layout');
        }
        const rendered=result.replayCalls[0];assert(rendered.bounds&&!overlap(logoRect,rendered.bounds)&&contains({x:624,y:24,width:336,height:672},rendered.bounds),'Actual Replay glyphs stay inside the sidebar and above the logo');
      }
      if(menuOwner){
        assert(!result.menuCalls.some(value=>[123,129].includes(value.scriptId)),'The untranslated Options row emits no pixels in the actual application');
        const decorations=result.menuCalls.filter(value=>value.priority===77),labels=result.menuCalls.filter(value=>value.priority===99);
        assert(decorations.length>0&&labels.length>0,'Actual public menu decoration77 and labels99 both emit');
        assert(Math.max(...decorations.map(value=>value.commandEnd))<=Math.min(...labels.map(value=>value.commandStart)),'Public menu text is submitted after all green decorations');
        assert(labels.every(value=>changedTexturePaths.includes(value.source?.texturePath)),'Visible pause/GameOver words sample actual Chinese locale textures');
        if(scenario.kind==='pause-confirm')for(const script of [0x8e,0x8f])assert(labels.some(value=>value.scriptId===script),'Both original Yes and No ANM choices are drawn');
        result.menuOrderCorrect=true;
      }else assert(result.menuCalls.length===0,'Unpaused samples do not render a pause/result panel');
      if(!game.paused&&!earlySpell){
        for(const [key,y] of [['pointValue',204],['graze',226]])assert(result.numberCalls.some(value=>value.options.y===y&&value.text===String(game.player[key]).replace(/\B(?=(\d{3})+(?!\d))/g,',')),`Actual public ${key} value uses its own row`);
        assert(!result.numberCalls.some(value=>value.options.y>226),'No extra status-value rows remain below graze');
        result.valueLabelClearance=[];
        for(const [key,y] of [['highScore',42],['score',64],['pointValue',204],['graze',226]]){
          const label=result.statusCalls.find(value=>value.kind===`label-${key}`),value=result.numberCalls.find(value=>value.options.y===y),
            labelBounds=label?.visibleBounds,valueBounds=value?.visibleBounds;
          assert(labelBounds&&valueBounds,`Actual ${key} label and original number glyphs have visible source pixels`);
          assert(!overlap(labelBounds,valueBounds),`Actual visible ${key} label and complete number/shadow glyphs do not overlap`);
          assert(contains({x:624,y:24,width:336,height:672},valueBounds),`Complete ${key} number glyphs stay inside the sidebar`);
          if(layoutPreset&&(key==='score'||key==='highScore'))assert(value.text==='9,999,999,990','The real stored score cap is rendered in full, including its final displayed zero');
          result.valueLabelClearance.push({key,labelBounds,valueBounds,horizontalGap:valueBounds.x-labelBounds.x-labelBounds.width});
        }
      }
      assert(skinCalls.length===2&&skinCalls.every(value=>value.priority===73),'The public owner submits exactly its two skin callbacks at priority73');
      assert(!skinCalls.find(value=>value.key==='drawFrame').commands.some(command=>command[0]==='line'&&[636,948].includes(command[1])&&command[1]===command[3]),'User-requested sidebar border lines are absent');
      result.skinCalls=skinCalls.map(value=>({key:value.key,priority:value.priority,paintedCommands:value.commands.filter(paintCommand).length}));
      result.commands=commands.length;result.panelCommandIndex=panelIndex;result.panelCommandIndices=panelIndices;
      result.frameProjection={continuous:true,sourceRect:{x:frameCommand[2],y:frameCommand[3],width:frameCommand[4],height:frameCommand[5]},screenRect:{x:0,y:0,width:960,height:720},clips:frameClips};
      result.logoCommandIndex=logoIndex;result.logoRect=logoRect;result.logoBox=logoBox;result.logoClip=clip;
      result.renderDidNotUpdate=true;assert(commands.length>0,'Actual App returns rendering commands');return commands;
    },
    snapshot(){assert(ready&&result.commands>0,'Native budget prepares and paints the actual HUD sample');return result;},
    destroy(){app.destroy();},
  };
}
