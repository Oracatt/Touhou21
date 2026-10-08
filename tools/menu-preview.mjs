/** Layout preview of the title menu without the native host. The real
 * ProjectTitleMenu, GameArt and TextPainter run against a recording host;
 * tools/render-drawlist.ps1 then paints the commands with System.Drawing.
 * Additive blending and exact glyph metrics are approximations; use native
 * screenshots for final visual acceptance. Output: reports/menu/. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {DrawList,Keys} from '@ts-stg/thlib';
import {createStandInBank} from './danmaku-lab.js';
import {GameArt} from '../src/art.js';
import {TextPainter} from '../src/text.js';
import {ProjectTitleMenu} from '../src/menu.js';
import {ListPage} from '../src/pages.js';
import {ALL_SPELLS,STAGES} from '../src/content.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),OUT=path.join(ROOT,'reports','menu');
const textures={};let nextId=100;
const measure=(text,size)=>[...String(text)].reduce((w,ch)=>w+(ch.charCodeAt(0)>0x2e7f?size*1.02:ch===' '?size*.32:/[A-Z]/.test(ch)?size*.68:size*.6),0);
const host={
  readText:file=>fs.readFileSync(path.join(ROOT,file),'utf8'),
  loadTexture:file=>{const id=nextId++;textures[id]={kind:'image',path:path.join(ROOT,file)};return id;},
  unloadTexture(){},hasSystemFont:name=>['Microsoft YaHei','KaiTi'].includes(name),
  createTextLayout:(text,options)=>({text,...options}),destroyTextLayout(){},
  rasterizeTextLayout:(layout,{width,height,fill,outline,strokeWidth})=>{
    const id=nextId++,w=Math.min(width,Math.ceil(measure(layout.text,layout.fontSize)+strokeWidth*2+4)),h=Math.min(height,Math.ceil(layout.fontSize*1.45+strokeWidth*2));
    const x=layout.horizontalAlign==='center'?(width-w)/2:layout.horizontalAlign==='right'?width-w:0;
    textures[id]={kind:'text',text:layout.text,size:layout.fontSize,font:layout.fontFamily,width:w,height:h,fill,outline,stroke:strokeWidth};
    return{texture:id,x,y:0,width:w,height:h};
  },
};

function createMenu(){
  const bank=Object.assign(createStandInBank(),{update(){},draw(){},dispose(){}});
  const art=new GameArt(host),text=new TextPainter(host);
  return new ProjectTitleMenu({bank,font:null,sound(){},difficulty:1,character:0,onStart(){},onSelect(){}},{art,text,storage:{extraUnlocked:false}});
}
const step=(menu,frames,mask=0)=>{for(let i=0;i<frames;i++)menu.update(i===0?mask:0);};
function capture(menu,name){
  const draw=new DrawList().clear(0x000000ff);menu.draw(draw);
  fs.mkdirSync(OUT,{recursive:true});const json=path.join(OUT,`${name}.json`),png=path.join(OUT,`${name}.png`);
  fs.writeFileSync(json,JSON.stringify({commands:draw.commands,textures}));
  execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(ROOT,'tools','render-drawlist.ps1'),json,png],{stdio:'inherit'});
  return png;
}

const menu=createMenu();
step(menu,60);console.log(capture(menu,'title-opening'));
step(menu,160);console.log(capture(menu,'title-main'));
step(menu,1,Keys.DOWN);step(menu,12);console.log(capture(menu,'title-extra-locked'));
step(menu,1,Keys.UP);step(menu,12);step(menu,1,Keys.SHOOT);step(menu,40);console.log(capture(menu,'title-difficulty'));
step(menu,1,Keys.DOWN);step(menu,1,Keys.DOWN);step(menu,20);console.log(capture(menu,'title-difficulty-hard'));
step(menu,1,Keys.SHOOT);step(menu,40);console.log(capture(menu,'title-character-reimu'));
step(menu,1,Keys.RIGHT);step(menu,30);console.log(capture(menu,'title-character-marisa'));
const art=new GameArt(host),text=new TextPainter(host);
const rows=ALL_SPELLS.map((spell,index)=>({label:`${String(index+1).padStart(2,'0')}　${spell.name}`,spell}));
const page=new ListPage({title:'符卡练习',rows,visibleRows:9,text,art,sound(){},detail:row=>`${STAGES[row.spell.stageId-1].title}${row.spell.midboss?'　道中':''}　${row.spell.seconds}s\n${row.spell.description}`});
for(let i=0;i<40;i++)page.update(i===10||i===20?Keys.DOWN:0);
console.log(capture({draw:draw=>page.draw(draw)},'page-spell-practice'));
