import test from 'node:test';
import assert from 'node:assert/strict';
import {DrawList,withAlpha} from '@ts-stg/thlib';
import {BossNameCard} from '../dist/src/boss-name.js';

const asset={id:77,width:1536,height:1024,bounds:{x:123,y:240,width:1200,height:500}};
const sprites=card=>{const draw=new DrawList();card.draw(draw);return draw.commands.filter(command=>command[0]==='spriteRegion');};
const tick=(card,count)=>{for(let frame=0;frame<count;frame++)card.update();};

test('Boss names use the source 60/260/60 presentation clock and retire at frame380',()=>{
  const loaded=[],card=new BossNameCard({load:path=>{loaded.push(path);return asset;}},'akari');
  assert.deepEqual(loaded,['assets/boss-names/akari.png']);assert.deepEqual(sprites(card),[]);
  tick(card,30);const entry=sprites(card);
  assert.equal(entry.length,72);assert.ok(entry.every(command=>command[11]===withAlpha(0xffffffff,.5)));
  assert.equal(new Set(entry.map(command=>command[8])).size,2,'the two complementary fragment groups have independent scale curves');
  tick(card,30);const clear=sprites(card);
  assert.equal(clear.length,1);assert.deepEqual(clear[0].slice(1,10),[77,123,240,1200,500,480,555,192,80]);
  tick(card,259);assert.equal(sprites(card).length,1,'frame319 is still the complete, readable card');
  card.update();assert.equal(sprites(card).length,72,'frame320 starts the source dispersal');
  tick(card,30);const exit=sprites(card);
  assert.equal(exit.length,72);assert.ok(exit.every(command=>command[11]===withAlpha(0xffffffff,.5)));
  tick(card,30);assert.equal(card.alive,false);assert.deepEqual(sprites(card),[]);
});

test('early dialogue exit fades the current card over20 frames and repeated drawing never ticks it',()=>{
  const card=new BossNameCard({load:()=>asset},'mio');tick(card,100);
  const before=card.snapshot();for(let draw=0;draw<5;draw++)sprites(card);assert.deepEqual(card.snapshot(),before);
  card.finish();tick(card,10);card.finish();assert.equal(card.exitAge,10,'a repeated finish must not restart the fade');
  const visible=sprites(card);assert.equal(visible.length,1);assert.equal(visible[0][11],withAlpha(0xffffffff,.5));
  tick(card,10);assert.equal(card.alive,false);assert.deepEqual(sprites(card),[]);
});

test('tall generated bounds fit without stretching and destroy borrows rather than unloads GameArt assets',()=>{
  const card=new BossNameCard({load:()=>({...asset,bounds:{x:50,y:100,width:600,height:500}})},'shino');tick(card,60);
  const sprite=sprites(card)[0];assert.equal(sprite[8],115.2);assert.equal(sprite[9],96);
  assert.equal(sprite[8]/sprite[9],600/500);card.destroy();assert.deepEqual(sprites(card),[]);
});
