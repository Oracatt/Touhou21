import {DrawList} from '@ts-stg/thlib';
import {GameArt} from '../dist/src/art.js';
import {StageBackground} from '../dist/src/background.js';
import {spellBackgroundStyle} from '../dist/src/background-art.js';
import {SPELL_BACKGROUND_TIMING,spellLayerOpacity} from '../dist/src/spell-background.js';

/** Native-only observation of the production renderer. No replacement layers,
 * authored image edits, shader changes or gameplay clock are introduced here. */
export function createBackgroundFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath));
  const assert=(condition,message)=>{if(!condition)throw new Error(`stage${scenario.stage}/${scenario.mode}: ${message}`);};
  const texturePaths=new Map(),host=Object.create(native);
  Object.defineProperty(host,'loadTexture',{value:(file,...args)=>{const id=native.loadTexture(file,...args);texturePaths.set(id,String(file).replaceAll('\\','/'));return id;}});
  const art=new GameArt(host),background=new StageBackground({art,seed:2107});background.setStage(scenario.stage);
  const profile=spellBackgroundStyle(null,scenario.stage),spell=scenario.mode==='spell';
  let frame=0,lastProof=null,firstGeometry=null,firstClock=null,movingFrames=0,lastGeometry=null,lastRenderFrame=-1;
  const game=()=>({frame:scenario.clockStart+frame,spell:{active:spell,id:scenario.stage,age:{current:scenario.clockStart+frame}}});
  const snapshot=()=>JSON.stringify(background.spellBackground.snapshot());
  function inspect(commands){
    const expectedPaths=new Set(Object.values(profile.textures)),samplers=new Map(),meshes=[],allMeshes=[],ambientMeshes=[];
    let blend=null,blendStart=-1,scope=0;
    commands.forEach((command,index)=>{
      if(command[0]==='sampler')samplers.set(command[1],command.slice(2));
      else if(command[0]==='blendFactors'){assert(!blend,'Each custom blend scope is closed before another begins');blend=command.slice(1);blendStart=index;scope++;}
      else if(command[0]==='blendEnd'){blend=null;blendStart=-1;}
      else if(command[0]==='mesh'||command[0]==='mesh3d'){
        const file=texturePaths.get(command[1]);allMeshes.push({type:command[0],path:file??null});
        if(!expectedPaths.has(file)){
          if(command[0]==='mesh'){
            const vertices=command[2],indices=command[3];
            assert(samplers.get(command[1])?.join(',')==='bilinear,clamp,clamp','Ambient atlas samples clamp inside each cell');
            assert(vertices.every(v=>v.length===5&&v.every(Number.isFinite)&&v[2]>=0&&v[2]<=1&&v[3]>=0&&v[3]<=1),'Ambient vertices and UVs are finite');
            assert(indices.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length),'Ambient batch indices are valid');
            ambientMeshes.push({path:file,vertices,indices});
          }
          return;
        }
        assert(command[0]==='mesh','Spell artwork is submitted by the production 2D mesh path');
        assert(blend&&blendStart>=0,'Every spell image has its own explicit blend scope');
        assert(commands[index+1]?.[0]==='blendEnd','Each image closes its blend scope immediately after submission');
        assert(samplers.get(command[1])?.join(',')==='bilinear,clamp,clamp','Each complete source image uses its independent clamp sampler');
        const vertices=command[2],indices=command[3];
        assert(vertices.length>=4&&indices.length>=6&&vertices.every(vertex=>vertex.length===5&&vertex.every(Number.isFinite)),'Native spell geometry is finite and textured');
        assert(vertices.every(vertex=>vertex[2]>=0&&vertex[2]<=1&&vertex[3]>=0&&vertex[3]<=1),'Whole-image UVs never sample another image or atlas cell');
        assert(Math.min(...vertices.map(v=>v[2]))===0&&Math.max(...vertices.map(v=>v[2]))===1&&Math.min(...vertices.map(v=>v[3]))===0&&Math.max(...vertices.map(v=>v[3]))===1,'Every layer addresses the entire authored image');
        meshes.push({path:file,textureId:command[1],commandIndex:index,blendStart,scope,blend,sampler:samplers.get(command[1]),vertices,indices});
      }
    });
    assert(!blend,'No custom spell blend leaks into the following scene commands');
    if(spell){
      assert(SPELL_BACKGROUND_TIMING.fadeIn===60,'The original spell background entry lasts sixty simulation frames');
      assert(profile.textures.base!==profile.textures.pattern,'Base and pattern are independently authored resource paths');
      assert(profile.textures.base===`assets/spells/${profile.bossId}-base.png`&&profile.textures.pattern===`assets/spells/${profile.bossId}.png`,'The Boss owns the expected two spell images');
      assert(profile.layers.length===3&&profile.layers.map(layer=>layer.texture).join(',')==='base,pattern,pattern','The settled spell draws base then two pattern layers');
      assert(meshes.length===profile.layers.length,'All authored layers really reach the native DrawList');
      assert(new Set(meshes.map(mesh=>mesh.textureId)).size===2&&new Set(meshes.map(mesh=>mesh.path)).size===2,'Two different native textures are actually submitted, not one image transformed twice');
      const card=background.spellBackground.visibleCards()[0];assert(card,'A requested spell has a visible card');
      meshes.forEach((mesh,index)=>{
        const layer=profile.layers[index],expectedBlend=['srcAlpha',layer.blend==='alpha'?'oneMinusSrcAlpha':'one',layer.blend==='subtract'?'reverseSubtract':'add','zero','one','add'];
        assert(mesh.path===profile.textures[layer.texture],'Submitted image order agrees with the authored layer descriptor');
        assert(mesh.blend.join(',')===expectedBlend.join(','),'Each layer independently selects its authored color blend and preserves target alpha');
        assert(mesh.scope!==meshes[index-1]?.scope,'Separate images do not inherit an earlier blend scope');
        const alpha=Math.round(card.opacity*spellLayerOpacity(layer,card)*(layer.tint&255)),rgb=layer.tint&0xffffff00;
        assert(mesh.vertices.every(vertex=>(vertex[4]&255)===alpha&&(vertex[4]&0xffffff00)===rgb),'Actual vertex alpha and tint match this layer, not a hard-coded index rule');
      });
      if(card.opacity===1&&profile.layers[0].blend==='alpha'&&profile.layers[0].opacity===1){
        assert(!background.stats.roadVisible&&!allMeshes.some(mesh=>mesh.type==='mesh3d'),'A fully opaque spell base hides road meshes');
      }
    }else{
      assert(meshes.length===0&&allMeshes.some(mesh=>mesh.type==='mesh3d'),'Ordinary road rendering is retained without spell image submissions');
      assert(ambientMeshes.length>0&&ambientMeshes.length<=4&&background.stats.atmosphere.particles>0,'Each road draws bounded ambient batches');
    }
    return{bossId:profile.bossId,clock:scenario.clockStart+frame,fadeIn:SPELL_BACKGROUND_TIMING.fadeIn,declaredTextures:{...profile.textures},
      distinctTextureIds:[...new Set(meshes.map(mesh=>mesh.textureId))],meshes,ambientMeshes,
      layers:profile.layers.map(layer=>({texture:layer.texture,path:profile.textures[layer.texture],blend:layer.blend,opacity:layer.opacity,tint:layer.tint})),
      sourceTexturePaths:[...new Set(meshes.map(mesh=>mesh.path))],roadMeshCount:allMeshes.filter(mesh=>mesh.type==='mesh3d').length};
  }
  function drawScene(){
    const draw=new DrawList();draw.clear(0x07101cff).scissor(48,24,576,672);background.draw(draw,game(),{stage:scenario.stage});
    draw.scissorEnd().rect(630,24,300,672,0x0e1927ff).text(spell?'SPELL PATTERNS':'REALTIME 3D',653,64,23,0xe4dcbbff)
      .text(`STAGE ${scenario.stage} / ${scenario.mode.toUpperCase()}`,653,104,17,0x809dadff);
    return draw.commands;
  }
  return{
    update(){frame++;background.update(game());},
    render(){
      const before=snapshot(),commands=drawScene();assert(snapshot()===before,'Rendering does not advance the spell animation clock');
      const proof=inspect(commands),geometry=JSON.stringify((spell?proof.meshes:proof.ambientMeshes).map(mesh=>mesh.vertices));
      if(firstGeometry===null){firstGeometry=geometry;firstClock=proof.clock;}
      if(frame!==lastRenderFrame&&lastGeometry!==null&&geometry!==lastGeometry)movingFrames++;
      lastGeometry=geometry;lastRenderFrame=frame;
      if(frame===scenario.frames){
        const repeated=drawScene();assert(JSON.stringify(repeated)===JSON.stringify(commands)&&snapshot()===before,'Repeated rendering at the capture frame is identical and does not tick animation');
        proof.motion={firstClock,lastClock:proof.clock,movingFrames,changedSinceFirst:firstGeometry!==geometry};
        if(scenario.frames>1)assert(proof.motion.changedSinceFirst&&movingFrames>0,'Independent background layers continue moving between native frames');
        proof.repeatedRenderIdentical=true;
      }
      lastProof=proof;return commands;
    },
    snapshot(){assert(lastProof&&frame===scenario.frames,'Native execution reached and painted the requested capture');return{frame,stats:background.stats,textureProof:lastProof};},
    destroy(){background.destroy();art.destroy();},
  };
}
