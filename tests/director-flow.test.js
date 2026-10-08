import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,MIDBOSSES,ALL_SPELLS} from '../src/content.js';
import {CampaignDirector} from '../src/director.js';
import {runDirectorRoute} from '../tools/director-lab.js';

/** Asset-free director contract: the real CampaignDirector drives the real
 * thlib bullet/laser fields through a minimal Boss lifecycle stand-in. */
const route=options=>runDirectorRoute(CampaignDirector,{stages:STAGES,midbosses:MIDBOSSES,...options});
const count=(events,name)=>events.filter(e=>e.event===name).length;

test('each stage runs its whole road, a midboss of the right shape, the Boss and its clear',()=>{
  for(const stage of STAGES){
    const r=route({mode:stage.extra?'extra':'stage-practice',stageId:stage.id,difficulty:stage.extra?4:1});
    const midboss=MIDBOSSES.find(m=>m.stageId===stage.id),phases=(midboss.nonspell?1:0)+midboss.spells.length;
    assert.equal(r.director.completed,true,`stage ${stage.id} completes`);
    assert.equal(count(r.events,'road-section'),8,'eight authored road sections');
    assert.ok(count(r.events,'road-wave')>=24,'a full road score');
    assert.equal(count(r.events,'midboss-phase-start'),phases,`stage ${stage.id} midboss phases`);
    assert.equal(count(r.events,'midboss-escaped'),stage.extra?0:1,'recurring Bosses fly away; the Extra midboss is defeated');
    assert.equal(count(r.events,'phase-start'),stage.phaseLayout.length,'every ordinary attack and card');
    assert.equal(r.director.captures.length,stage.spells.length+midboss.spells.length,'every card settles once');
    assert.deepEqual(r.director.captures.map(c=>c.id),[...midboss.spells,...stage.spells].map(c=>c.code));
    assert.ok(r.log.includes(`clear:${stage.id}`));
  }
});

test('stage midbosses hand an ordinary attack over to their card; stage 1 has no card',()=>{
  for(let stageId=1;stageId<=6;stageId++){
    const r=route({mode:'stage-practice',stageId}),starts=r.events.filter(e=>e.event==='midboss-phase-start');
    assert.deepEqual(starts.map(e=>e.spell),stageId===1?[false]:[false,true]);
  }
  const extra=route({mode:'extra',stageId:7,difficulty:4});
  assert.deepEqual(extra.events.filter(e=>e.event==='midboss-phase-start').map(e=>e.spell),[true,true,true]);
});

test('an unbroken midboss ordinary attack times out into its card, and the card times out into the retreat',()=>{
  const midbosses=MIDBOSSES.map(m=>({...m,seconds:3,spells:m.spells.map(card=>({...card,seconds:4}))}));
  const r=route({mode:'stage-practice',stageId:3,midbosses,strike:d=>{if(d.state==='combat'&&d.phaseFrame>=150)d.boss.damage(1e9,{type:'lab'});}});
  const ends=r.events.filter(e=>e.event==='midboss-phase-end');
  assert.deepEqual(ends.map(e=>e.timeout),[true,true]);
  assert.equal(r.director.captures[0].id,STAGES[2].midbossSpells[0].code);assert.equal(r.director.captures[0].captured,false);
  assert.equal(count(r.events,'midboss-retreat'),1);assert.equal(r.director.completed,true);
});

test('the main story settles all 26 cards in order and Extra all 13, with persistent record codes',()=>{
  const main=route({mode:'normal',difficulty:1,limit:200000});
  assert.equal(main.finished.ending,'good');
  assert.deepEqual(main.director.captures.map(c=>c.id),ALL_SPELLS.filter(c=>c.stageId<=6).map(c=>c.code));
  const extra=route({mode:'extra',stageId:7,difficulty:4});
  assert.equal(extra.finished.ending,'extra');assert.deepEqual(extra.director.captures.map(c=>c.id),[32,33,34,22,23,24,25,26,27,28,29,30,31]);
});

test('spell practice opens every card alone and settles its timeout or survival by the public rule',()=>{
  for(const card of ALL_SPELLS){
    const r=route({mode:'spell-practice',stageId:card.stageId,spellId:card.id,difficulty:card.stageId===7?4:1,strikeAfter:1e9});
    assert.equal(r.director.completed,true,card.id);assert.equal(r.director.captures.length,1);
    assert.equal(r.director.captures[0].id,card.code,`${card.id} record code`);
    assert.equal(r.director.captures[0].captured,card.survival,`${card.id} capture policy`);
    assert.equal(r.director.boss,null);
  }
});

test('the same seed and inputs reproduce the director route exactly',()=>{
  const a=route({mode:'stage-practice',stageId:4}),b=route({mode:'stage-practice',stageId:4});
  assert.deepEqual(a.director.snapshot(),b.director.snapshot());assert.equal(a.frames,b.frames);assert.equal(a.peak,b.peak);
});
