import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DrawList,Keys} from '@ts-stg/thlib';
import {createStandInBank} from '../tools/danmaku-lab.js';
import {GameArt} from '../src/art.js';
import {TextPainter} from '../src/text.js';
import {ProjectTitleMenu,TITLE_LABELS} from '../src/menu.js';
import {ListPage} from '../src/pages.js';
import {drawTitleBackdrop} from '../src/title-backdrop.js';

function recordingHost(){
  let next=1;const texts=[];
  return{texts,readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>next++,unloadTexture(){},hasSystemFont:()=>true,
    createTextLayout:(text,options)=>({text,...options}),destroyTextLayout(){},
    rasterizeTextLayout:(layout,{width,height})=>{texts.push(layout.text);return{texture:next++,x:0,y:0,width:Math.min(width,layout.text.length*layout.fontSize),height:Math.min(height,layout.fontSize*1.4)};}};
}
function menuFixture({unlocked=false}={}){
  const host=recordingHost(),started=[];
  const bank=Object.assign(createStandInBank(),{update(){},draw(){},dispose(){}});
  const menu=new ProjectTitleMenu({bank,font:null,sound(){},difficulty:1,character:0,onStart:selection=>started.push(selection),onSelect(){}},
    {art:new GameArt(host),text:new TextPainter(host),storage:{extraUnlocked:unlocked}});
  return{menu,host,started};
}
const tap=(menu,mask,after=0)=>{menu.update(mask);for(let i=0;i<after;i++)menu.update(0);};

test('the title menu animates deterministically from a frame counter and draws the full bilingual list',()=>{
  const a=menuFixture(),b=menuFixture();
  for(let i=0;i<220;i++){a.menu.update(0);b.menu.update(0);}
  const da=a.menu.draw(new DrawList()).commands,db=b.menu.draw(new DrawList()).commands;
  assert.deepEqual(da,db,'no wall clock or Math.random in the title atmosphere');
  for(const label of TITLE_LABELS)assert.ok(a.host.texts.includes(label),`${label} is drawn`);
  assert.ok(a.host.texts.includes('Game Start')&&a.host.texts.includes('归名录'),'English labels and the calligraphic logo');
  assert.ok(da.some(c=>c[0]==='blend'&&c[1]==='add'),'glow and bell motes use additive blending');
  assert.ok(da.some(c=>c[0]==='triangle'),'floating name tags are drawn');
});

test('locked Extra is skipped by the cursor and explains its requirement; the start flow reaches onStart',()=>{
  const f=menuFixture();for(let i=0;i<140;i++)f.menu.update(0);
  tap(f.menu,Keys.DOWN,10);assert.equal(f.menu.selection,2,'locked Extra is skipped');
  tap(f.menu,Keys.UP,10);assert.equal(f.menu.selection,0);
  tap(f.menu,Keys.SHOOT,30);assert.equal(f.menu.state,'difficulty');
  tap(f.menu,Keys.DOWN,4);tap(f.menu,Keys.DOWN,4);f.menu.draw(new DrawList());
  tap(f.menu,Keys.SHOOT,30);assert.equal(f.menu.state,'character');f.menu.draw(new DrawList());
  tap(f.menu,Keys.RIGHT,10);tap(f.menu,Keys.SHOOT,30);
  assert.deepEqual(f.started.at(-1),{character:1,difficulty:3,mode:'normal'});
  const unlocked=menuFixture({unlocked:true});for(let i=0;i<140;i++)unlocked.menu.update(0);
  tap(unlocked.menu,Keys.DOWN,10);assert.equal(unlocked.menu.selection,1,'cleared players can choose Extra');
});

test('utility pages share the animated title scene and keep their list cursor',()=>{
  const host=recordingHost(),page=new ListPage({title:'符卡练习',rows:[{label:'01　灯符「无主门灯」'},{label:'02　迎火「百户无字灯笼坂」'}],
    text:new TextPainter(host),art:new GameArt(host),sound(){},detail:()=>'说明'});
  for(let i=0;i<12;i++)page.update(i===10?Keys.DOWN:0);
  const commands=page.draw(new DrawList()).commands;assert.equal(page.selection,1);
  assert.ok(commands.some(c=>c[0]==='blend'));assert.ok(host.texts.includes('符卡练习'));
  const draw=new DrawList();drawTitleBackdrop(draw,new GameArt(host),1234,{dim:.4});
  assert.ok(draw.commands.length>40,'backdrop draws painting, shade, tags and motes');
});
