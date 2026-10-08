import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {createTouhouResources,TouhouGame} from '@ts-stg/thlib/touhou';
import {bossNonspellHealth,midbossNormalHealth,midbossSpellHealth,BOSS_NONSPELL_HEALTH,MIDBOSS_NORMAL_HEALTH} from '../src/boss-health.js';
import {updateNonspellPattern} from '../src/patterns.js';
import {STAGES,MIDBOSSES} from '../src/content.js';

const assets=fs.existsSync('packages/thlib/assets/touhou-common/manifest.json');
const needsAssets=assets?{}:{skip:'requires the private touhou-common resource pack (tools/setup-local.ps1)'};
const resources=()=>createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
const settle=r=>{for(const bank of Object.values(r.banks))bank.collect?.();};
const setupPlayer=p=>{p.setPosition(0,392);p.state=1;p.invulnerability.set(0);p.focusTimer.set(8);};
const gameFor=(r,character,power)=>new TouhouGame({banks:r.banks,font:r.font,sht:r.shots[character],styles:r.styles,character,power,seed:73});

test('unnamed damage budgets subtract the original shared-ring spell threshold, with explicit authored extensions',()=>{
  const original=[
    [[14200,2200],[14000,2000]],
    [[17600,2600],[17600,2600]],
    [[23000,3000],[23200,3200],[23200,3400]],
    [[22800,2800],[22800,2800],[22800,2500]],
    [[19500,3500],[19200,3200],[19200,3200]],
    [[21900,3900],[21900,3900],[20000,4000],[20000,4000],[17000,4000]],
    [[22000,4000],[22000,4000],[22000,4000],[22000,4000],[21000,5000],[21000,5000],[19500,3500],[22000,6000]],
  ];
  assert.deepEqual(BOSS_NONSPELL_HEALTH.map(row=>row.length),STAGES.map(stage=>stage.spells.length));
  for(let stage=1;stage<=7;stage++)for(let group=0;group<STAGES[stage-1].spells.length;group++){
    const [total,threshold]=original[stage-1][Math.min(group,original[stage-1].length-1)];
    assert.equal(bossNonspellHealth(stage,group),total-threshold);
  }
  for(const invalid of[0,8,1.5,'1'])assert.throws(()=>bossNonspellHealth(invalid,0),RangeError);
  for(const invalid of[-1,2,0.5,'0'])assert.throws(()=>bossNonspellHealth(1,invalid),RangeError);
});

test('midbosses budget an ordinary attack before their card; stage 1 keeps the original standalone budget',()=>{
  assert.deepEqual(MIDBOSS_NORMAL_HEALTH,[11000,9000,10000,10500,12000,11000]);
  for(let stage=1;stage<=6;stage++)assert.equal(midbossNormalHealth(stage),MIDBOSS_NORMAL_HEALTH[stage-1]);
  assert.throws(()=>midbossNormalHealth(7),RangeError,'Extra opens directly with cards');
  for(const midboss of MIDBOSSES)midboss.spells.forEach((card,i)=>assert.ok(midbossSpellHealth(midboss.stageId,i)>=1800));
  assert.deepEqual([0,1,2].map(i=>midbossSpellHealth(7,i)),[2300,2480,2660]);
  assert.throws(()=>midbossSpellHealth(1,0),RangeError,'the stage 1 midboss has no card');
});

/** A real player keeps shooting from under the Boss as it changes position;
 * collisions are suspended so only weapon damage decides the duration. */
test('imported Reimu and Marisa shots consume real normal HP while the first group keeps attacking',needsAssets,t=>{
  const r=resources();try{
    for(const character of[0,1])for(const power of[200,400]){
      const g=gameFor(r,character,power);setupPlayer(g.player);
      const hp=bossNonspellHealth(1,0),boss=g.spawnEnemy({x:0,y:105,hp,radius:16,script:30,directional:false,damageInvulnerability:0});
      let frames=0,firstHit=-1,hostile=0;const state={},emit=g.bullets.emit.bind(g.bullets);g.bullets.emit=(p,o)=>{const out=emit(p,o);hostile+=out.length;return out;};
      g.stage=()=>updateNonspellPattern({game:g,boss,frame:frames,difficulty:1,stageId:1,phaseIndex:0,state});
      while(boss.alive&&frames<2400){
        const before=boss.hp,dx=boss.x-g.player.x;g.player.invulnerability.set(60);
        g.update(Keys.SHOOT|Keys.FOCUS|(dx<-2?Keys.LEFT:dx>2?Keys.RIGHT:0));
        if(firstHit<0&&boss.hp<before)firstHit=frames;frames++;
      }
      assert.equal(boss.alive,false,'only common weapon hits exhaust the normal HP');
      assert.ok(firstHit>=20,'projectiles must actually travel to the target');
      assert.ok(frames>240&&frames<1200,`the first group lasts several volleys yet stays killable (${frames})`);
      assert.ok(hostile>60,'the ordinary attack keeps firing while it is damaged');assert.equal(boss.health.flags&1,0,'normal health has no sevenfold scaling');
      t.diagnostic(JSON.stringify({character,power,hp,frames,seconds:frames/60,firstHit,hostile}));
      g.destroy();settle(r);
    }
  }finally{r.dispose();}
});
