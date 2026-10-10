import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTouhouResources,TouhouRNG,TouhouPlayer} from '@ts-stg/thlib/touhou';
import {CampaignScene} from '../dist/src/scene.js';
import {STAGES} from '../dist/src/content.js';
import {musicTrack} from '../dist/src/music-data.js';

function fixture(){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  resources.encodeText=text=>new Uint8Array(Array.from(text).flatMap(char=>char.charCodeAt(0)>127?[65,65]:[65]));
  resources.writeAnimationText=vm=>vm;
  const storage={settings:{startingLives:2,autoSaveReplay:false},progress:{spellRecords:{},seenSpells:[],stageUnlock:1,scores:[]},saveProgress(){},saveReplay(){},recordClear(){}};
  const art={host:{readText:file=>fs.readFileSync(file,'utf8'),createTexture:()=>89,unloadTexture(){}},load:()=>({id:81,width:512,height:512,bounds:{x:0,y:0,width:265,height:512}}),portrait(){},background(){}};
  const rng=new TouhouRNG(73),visualRng=new TouhouRNG(73^0x6d2b79f5),played=[],drawn=[];
  for(const bank of Object.values(resources.banks)){bank.rng=visualRng;bank.environment={...bank.environment,rng:visualRng};}
  const game=new CampaignScene({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,rng,visualRng,power:400,
    onSound(){},factories:{player:options=>new TouhouPlayer(options)}},
    {resources,host:{backend:'v8'},art,text:{draw:(_draw,str,x,y,style)=>drawn.push({str,x,y,style})},music:{play:id=>played.push(id),pause(){},resume(){},fadeOut(){}},storage,
      config:{character:0,difficulty:1,mode:'normal',spellId:null,stageId:1,seed:73},options:{testing:true,fixedClock:true}});
  game.director.callbacks.dialogue=(_lines,{onComplete})=>onComplete();
  return{game,played,drawn,dispose(){game.destroy();resources.dispose();}};
}
const caption=f=>{f.drawn.length=0;f.game.render();return f.drawn.find(item=>item.str.startsWith('\u266a'));};

test('the stage theme name appears at the bottom right when the music starts and then fades away',()=>{
  const f=fixture();
  for(let i=0;i<30;i++)f.game.update(0);
  assert.equal(f.played[0],STAGES[0].bgmStage);
  const shown=caption(f);
  assert.ok(shown,'caption is drawn');
  assert.equal(shown.str,`\u266a ${musicTrack(STAGES[0].bgmStage).title}`);
  assert.equal(shown.style.align,'right');
  assert.ok(shown.x+shown.style.width<=624&&shown.y>600,'inside the playfield, near its bottom edge');
  assert.ok(shown.style.alpha>0.5);
  for(let i=0;i<400;i++)f.game.update(0);
  assert.equal(caption(f),undefined,'caption is gone after a few seconds');
  f.dispose();
});

test('a theme change shows the new name and the caption stays out of replay snapshots',()=>{
  const f=fixture();
  for(let i=0;i<5;i++)f.game.update(0);
  const before=JSON.stringify(f.game.snapshot());
  f.game.director.callbacks.music(STAGES[0].bgmBoss);
  assert.equal(caption(f).str,`\u266a ${musicTrack(STAGES[0].bgmBoss).title}`);
  assert.equal(JSON.stringify(f.game.snapshot()),before);
  f.dispose();
});