import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TouhouGame,TouhouRNG,createTouhouResources} from '@ts-stg/thlib/touhou';
import {BOSS_ATTACKS,ATTACK_START} from '../dist/src/patterns.js';
import {driveAttack} from '../dist/src/danmaku.js';

const assets=fs.existsSync('packages/thlib/assets/touhou-common/manifest.json');
const needsAssets=assets?{}:{skip:'requires the private touhou-common resource pack (tools/setup-local.ps1)'};

// Every Boss and midboss attack is driven on the real thlib bullet and laser fields; the spies only observe whether
// the authored emission asks for a sound. Rain-like single-bullet textures may stay silent, but a stream may never
// be silent for long, and a burst of eight or more bullets must never appear in silence.
// Attacks whose pause phase is meant to leave only a silent light rain; they still may not fire a silent burst.
const QUIET_PAUSE=new Set(['washedGreeting']);
const MAX_SILENT_STRETCH=120,MAX_SILENT_BURST_AGE=40,FRAMES=1300;

function attacks(){
  const list=[];
  BOSS_ATTACKS.forEach((boss,stage)=>{
    const add=(label,attack,start)=>list.push({name:`stage ${stage+1} ${label} ${attack.name}`,attack,start});
    boss.nonspells.forEach(a=>add('nonspell',a,ATTACK_START.nonspell));
    boss.spells.forEach(a=>add('spell',a,ATTACK_START.spell));
    if(boss.midboss?.nonspell)add('midboss nonspell',boss.midboss.nonspell,ATTACK_START.nonspell);
    (boss.midboss?.spells??[]).forEach(a=>add('midboss spell',a,ATTACK_START.midbossSpell));
    (boss.extraMidboss??[]).forEach(a=>add('extra midboss spell',a,ATTACK_START.midbossSpell));
  });
  return list;
}

test('every Boss and midboss attack is audible: no long silent stretch and no silent burst',needsAssets,()=>{
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:91});
  let sounded=false,fired=false,count=0,capturing=false;
  const emit=game.bullets.emit.bind(game.bullets);
  game.bullets.emit=p=>{fired=true;count+=(p.count??1)*(p.rows??1);if((p.shotSound??-1)>=0)sounded=true;return emit(p);};
  for(const method of['spawnInfinite','spawnStraight']){
    const original=game.lasers[method].bind(game.lasers);
    game.lasers[method]=p=>{fired=true;if((p.sound??-1)>=0)sounded=true;return original(p);};
  }
  const sound=game.context.sound?.bind(game.context);
  game.context.sound=(id,x)=>{if(capturing&&id>=0&&![6,27,54].includes(id))sounded=true;return sound?.(id,x);};
  const problems=[];
  try{
    const list=attacks();assert.ok(list.length>=70,'the audit covers every authored attack');
    for(const {name,attack,start} of list)for(const difficulty of[0,3]){
      const boss={x:0,y:112,motion:{position:{x:0,y:112}},animation:{x:0,y:112}},state={},rng=new TouhouRNG(7);
      let last=start,stretch=0,silentBursts=0;
      for(let frame=0;frame<start+FRAMES;frame++){
        sounded=false;fired=false;count=0;game.player.invulnerability.set(9999999);
        capturing=true;driveAttack(attack,{game,boss,frame,difficulty,state,rng,start});capturing=false;game.update(0);
        if(sounded)last=frame;
        if(fired)stretch=Math.max(stretch,frame-last);
        if(count>=8&&!sounded&&frame-last>MAX_SILENT_BURST_AGE)silentBursts++;
      }
      if((stretch>MAX_SILENT_STRETCH&&!QUIET_PAUSE.has(attack.name))||silentBursts)problems.push(`${name} (difficulty ${difficulty}): silent stretch ${stretch} frames, ${silentBursts} silent bursts`);
      for(const bullet of game.bullets.bullets)game.bullets.retire(bullet);
      for(const laser of game.lasers.lasers)game.lasers.erase(laser,{check:false});
    }
  }finally{game.destroy();resources.dispose();}
  assert.deepEqual(problems,[]);
});
