import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Keys} from '@ts-stg/thlib';
import {createTouhouResources,TouhouGame,TOUHOU_BULLET_STYLES} from '@ts-stg/thlib/touhou';
import {NONSPELL_PATTERNS,MIDBOSS_NONSPELL_PATTERNS,updateNonspellPattern,updateMidbossNonspellPattern} from '../src/patterns.js';
import {STAGES} from '../src/content.js';

const assets=fs.existsSync('packages/thlib/assets/touhou-common/manifest.json');
const needsAssets=assets?{}:{skip:'requires the private touhou-common resource pack (tools/setup-local.ps1)'};
const makeResources=()=>createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});

test('ordinary attacks are authored per Boss: one function per unnamed group of the phase layout',()=>{
  for(const stage of STAGES){
    const groups=NONSPELL_PATTERNS[stage.id-1];
    assert.equal(groups.length,stage.nonspellNames.length,'every group has a name');
    assert.equal(new Set(groups.map(g=>g.update)).size,groups.length,'groups are distinct attacks, not one escalating loop');
  }
  assert.deepEqual(MIDBOSS_NONSPELL_PATTERNS.map(p=>!!p),[true,true,true,true,true,true,false]);
});

/** Real public ANM banks, field birth/collision and the common player body. */
test('every Boss and midboss ordinary attack runs on the real public game without Miss under invulnerability',needsAssets,t=>{
  const resources=makeResources();
  try{
    const cases=[...NONSPELL_PATTERNS.flat().map(p=>({...p,run:o=>updateNonspellPattern({...o,group:p.group})})),
      ...MIDBOSS_NONSPELL_PATTERNS.filter(Boolean).map(p=>({...p,run:o=>updateMidbossNonspellPattern(o)}))];
    for(const c of cases)for(const difficulty of c.stageId===7?[4]:[1,3]){
      const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:73,difficulty});
      const boss=game.spawnEnemy({x:0,y:105,hp:999999,script:30,directional:false});boss.invulnerable=true;
      let frame=0,peak=0;const state={};game.stage=()=>c.run({game,boss,frame:frame++,difficulty,stageId:c.stageId,state});
      for(let i=0;i<900;i++){game.player.invulnerability.set(999);game.update(i%40<20?Keys.LEFT:Keys.RIGHT);peak=Math.max(peak,game.bullets.count);
        if(i%60===0)for(const b of game.bullets.bullets)if(b.state){assert.equal(b.radius,TOUHOU_BULLET_STYLES[b.type].radius);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));}}
      assert.ok(game.bullets.nextId>40,`${c.id}/${difficulty} attacks`);assert.ok(peak<1400);
      t.diagnostic(JSON.stringify({id:c.id,difficulty,peak}));game.destroy();
    }
  }finally{resources.dispose();}
});
