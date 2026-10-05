import {DrawList,Keys,stateHash} from '@ts-stg/thlib';
import {TouhouGame,TouhouRNG,TouhouWorld,TouhouPhaseSequence,TOUHOU_PLAYER_PROFILES,createTouhouResources} from '@ts-stg/thlib/touhou';
const check=(value,message)=>{if(!value)throw new Error(message);};
check(Keys.SHOOT===16&&Keys.PAUSE===128,'Public/native input ABI differs');
const native=globalThis.tsstg,resources=createTouhouResources(native),draw=new DrawList();
const world=new TouhouWorld(),rng=new TouhouRNG(210721);let outer=0,held=0,disposed=false;
const games=[0,1].map(character=>{
 const banks={};for(const name of ['front','bullet','effect','enemy','ascii_960','text',character?'pl01':'pl00'])banks[name]=resources.createBank(name);
 const game=new TouhouGame({banks,font:resources.font,styles:resources.styles,sht:resources.shots[character],character,
  seed:210721,world,disposeBanks:true,systemOptions:{player:{lives:5,power:400}},
  onBossDefeated:()=>{held++;}});
 check(game.player.profile===TOUHOU_PLAYER_PROFILES[character?'marisa':'reimu'],'Original player preset changed');
 check(game.player.normalRadius===3&&game.player.focusRadius===3,'Original player collision defaults changed');
 const enemy=game.spawnEnemy({x:120,y:120,hp:10,script:0});game.registerBoss(enemy);game.startBossCombat(enemy);
 return {game,enemy,character};
});
const pixels=new Uint8Array(16);pixels.fill(255);const texture=native.createTexture(2,2,pixels);
const patch=new Uint8Array([12,34,56,78]);native.updateTextureRegion(texture,1,0,1,1,patch);
const roundtrip=native.readTexturePixels(texture);
check(roundtrip.width===2&&roundtrip.height===2&&roundtrip.pixels.slice(4,8).every((v,i)=>v===patch[i]),'Native texture-region ABI changed');
const vertices=[[-.5,-.5,0,0,0,0xffffffff],[.5,-.5,0,1,0,0xffffffff],[0,.5,0,.5,1,0xffffffff]];
const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const phase=new TouhouPhaseSequence([{run:function*(){yield 2;}}]);phase.update();
globalThis.__tsstg_game={
 update(mask){
  check(mask===Keys.SHOOT,'Native mask passed incorrectly');outer++;
  for(let i=0;i<15;i++)for(const owner of games){
   const {game,enemy}=owner;
   if(game.frame===20){enemy.damage(10000,{kind:'engine-upgrade-smoke'},game.context);check(game.isBossHeld(enemy),'Boss depletion must hold its body');
    enemy.prepareNormalHealth(1000000);check(game.resumeBoss(enemy),'Next phase must resume a held body');}
   game.update(Keys.SHOOT|(i%2?Keys.FOCUS:0));
  }
  rng.next();phase.update();
 },
 render(){return draw.reset().clear(0x000000ff).sampler(texture,'point','clamp','clamp')
   .blendFactors('srcAlpha','oneMinusSrcAlpha','add','one','zero','add')
   .spriteRegion(texture,0,0,2,2,0,0,2,2).mesh3d(texture,vertices,[0,1,2],matrix).blendEnd().commands;},
 snapshot(){
  check(outer===4&&held===2,'Fixed native frames or public Boss lifecycle differs: '+JSON.stringify({outer,held,frames:games.map(({game})=>game.frame)}));
  const simulation=games.map(({game,character})=>({character,frame:game.frame,player:game.player.snapshot(),
   shots:game.player.shots.length,worldIdentity:game.world===world&&game.player.world===world}));
  check(simulation.every(owner=>owner.frame===60&&owner.shots>0&&owner.worldIdentity),'Original weapons/world did not execute: '+JSON.stringify(simulation.map(({character,frame,shots,worldIdentity,player})=>({character,frame,shots,worldIdentity,state:player.state}))));
  const result={passed:true,backend:native.backend,nativeFrames:outer,gameplayFrames:120,characters:[0,1],
   sourceProfiles:true,heldAndResumed:held,inputABI:true,textureRegion:true,mesh3dABI:true,
   defaultHitboxes:true,hash:stateHash({simulation,rng:rng.state}),simulation};
  if(!disposed){disposed=true;for(const {game}of games)game.destroy();phase.destroy();resources.dispose();native.unloadTexture(texture);}
  return result;
 }
};
