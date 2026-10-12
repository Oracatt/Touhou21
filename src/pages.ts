import type {AnmDrawList as DrawList} from '@ts-stg/thlib/touhou';
import type {GameArt} from './art.js';
import type {TextPainter} from './text.js';

import type {MusicController} from './music.js';
import type {RunResult} from './shared-types.js';

import {Keys} from '@ts-stg/thlib';
import {TouhouButtons} from '@ts-stg/thlib/touhou';
import {GAME,CHARACTERS,ENDINGS,PLAYERS} from './content.js';
import {drawTitleBackdrop,drawOrnament,fillQuad,rgba} from './title-backdrop.js';

export interface PageRow {label?:string|(()=>string);title?:string;name?:string;locked?:boolean;}
export interface GamePage {update(mask:number):void;draw(draw:DrawList):unknown;snapshot():object;}
export interface PageOptions {title:string;text:TextPainter;art:GameArt;sound?:(id:number)=>void;onClose?:()=>void;}
export interface ListPageOptions<Row extends PageRow|string> extends PageOptions {rows?:Row[];detail?:(row:Row,page:ListPage<Row>)=>string;onSelect?:(row:Row,page:ListPage<Row>)=>void;onAdjust?:(row:Row,delta:number,page:ListPage<Row>)=>void;visibleRows?:number;initialSelection?:number;}
export type ReadingLine=string|{text?:string};
export interface ReadingEntry {title?:string;lines:ReadingLine[];}
export interface ReadingPageOptions extends PageOptions {pages:ReadingEntry[];}
export interface EndingPageOptions {result:RunResult;replayAvailable?:boolean;onClose?:()=>void;text:TextPainter;art:GameArt;music:MusicController;sound?:(id:number)=>void;}

/** Shared reading panel for utility pages over the animated title scene. */
function drawPanel(draw:DrawList,{art,text,title,age}:Pick<PageOptions,'art'|'text'|'title'>&{age:number}){
  drawTitleBackdrop(draw,art,age,{shade:.5,dim:.3});
  draw.rect(30,24,900,672,0x060d1ee0);
  for(const [x1,y1,x2,y2] of [[30,24,930,24],[30,696,930,696],[30,24,30,696],[930,24,930,696]])draw.line(x1,y1,x2,y2,1,0xe5bd8255);
  text.draw(draw,title,56,38,{size:36,width:820,height:60,font:text.titleFont,stroke:3,color:0xffe4a6ff});
  drawOrnament(draw,56,104,846,1);
}
function drawCursor(draw:DrawList,y:number,age:number,height=38){
  draw.blend('add');for(let s=0;s<12;s++)draw.rect(49+s*72,y-1,72,height,rgba(0xe0b060,.15*Math.pow(1-s/12,1.3)));draw.blendEnd();
  fillQuad(draw,62,y+height/2-1,9,9,age*.05,0xffe2a2ff);
}

export class ListPage<Row extends PageRow|string=PageRow> implements GamePage {
 declare title:string;declare rows:Row[];declare detail:(row:Row,page:ListPage<Row>)=>string;declare onSelect:ListPageOptions<Row>['onSelect'];declare onAdjust:ListPageOptions<Row>['onAdjust'];declare onClose:(()=>void)|undefined;declare text:TextPainter;declare art:GameArt;declare sound:((id:number)=>void)|undefined;
  declare visibleRows: number;
  declare buttons: TouhouButtons;
  declare selection: number;
  declare age: number;
  declare message: string;

  constructor({title,rows=[],detail=()=>'',onSelect,onClose,onAdjust,text,art,sound,visibleRows=9,initialSelection=0}:ListPageOptions<Row>={} as ListPageOptions<Row>){Object.assign(this,{title,rows,detail,onSelect,onClose,onAdjust,text,art,sound,visibleRows});this.buttons=new TouhouButtons();this.selection=initialSelection;this.age=0;this.message='';}
  get row(){return this.rows[this.selection];}
  update(mask:number){
    this.buttons.update(mask);this.age++;
    const b=this.buttons;if(this.age<8)return;
    if(b.pressed&(Keys.CANCEL|Keys.BOMB|Keys.PAUSE)){this.sound?.(9);this.onClose?.();return;}
    let delta=0;if(b.repeat(Keys.UP))delta--;if(b.repeat(Keys.DOWN))delta++;
    if(delta&&this.rows.length){this.selection=(this.selection+delta+this.rows.length)%this.rows.length;this.sound?.(10);this.message='';}
    if(b.repeat(Keys.LEFT))this.onAdjust?.(this.row,-1,this);if(b.repeat(Keys.RIGHT))this.onAdjust?.(this.row,1,this);
    if(b.pressed&(Keys.SHOOT|Keys.CONFIRM)){this.sound?.(7);this.onSelect?.(this.row,this);}
  }
  draw(draw:DrawList){
    drawPanel(draw,{art:this.art,text:this.text,title:this.title,age:this.age});
    const start=Math.max(0,Math.min(this.rows.length-this.visibleRows,this.selection-Math.floor(this.visibleRows/2)));
    for(let i=start;i<Math.min(this.rows.length,start+this.visibleRows);i++){
      const row=this.rows[i],active=i===this.selection,y=133+(i-start)*42,label=typeof row==='string'?row:typeof row.label==='function'?row.label():row.label??row.title??row.name??'';
      if(active)drawCursor(draw,y,this.age);
      this.text.draw(draw,label,active?84:78,y,{size:active?24:22,width:820,height:40,color:(row as PageRow).locked?0x718394ff:active?0xffe5afff:0xcbd6dcff});
    }
    if(this.rows.length>this.visibleRows)this.text.draw(draw,`${this.selection+1} / ${this.rows.length}`,788,62,{size:16,width:115,height:30,align:'right',color:0x8fabbfff});
    this.text.draw(draw,this.message||this.detail(this.row,this),56,542,{size:20,width:845,height:100,color:0xc0d0dcff});
    this.text.draw(draw,'↑↓ 选择　Z 确定　X / Esc 返回',55,650,{size:17,width:750,height:34,color:0xb4c3d1ff});return draw;
  }
  snapshot(){return {page:this.title,selection:this.selection,rows:this.rows.length,message:this.message};}
}

export class ReadingPage implements GamePage {
 declare title:string;declare pages:ReadingEntry[];declare onClose:(()=>void)|undefined;declare text:TextPainter;declare art:GameArt;declare sound:((id:number)=>void)|undefined;
  declare buttons: TouhouButtons;
  declare index: number;
  declare age: number;

  constructor({title,pages,onClose,text,art,sound}:ReadingPageOptions={} as ReadingPageOptions){Object.assign(this,{title,pages,onClose,text,art,sound});this.buttons=new TouhouButtons();this.index=0;this.age=0;}
  update(mask:number){this.buttons.update(mask);this.age++;if(this.age<10)return;const b=this.buttons;
    if(b.pressed&(Keys.CANCEL|Keys.BOMB|Keys.PAUSE)){this.sound?.(9);this.onClose?.();return;}
    if(b.pressed&(Keys.SHOOT|Keys.CONFIRM|Keys.RIGHT)){this.sound?.(7);if(this.index<this.pages.length-1)this.index++;else this.onClose?.();}
    if(b.pressed&Keys.LEFT){this.sound?.(10);this.index=Math.max(0,this.index-1);}}
  draw(draw:DrawList){drawPanel(draw,{art:this.art,text:this.text,title:this.title,age:this.age});
    const page=this.pages[this.index],heading=page.title??'',lines=page.lines??page;
    if(heading)this.text.draw(draw,heading,67,122,{size:27,width:820,height:62,color:0xd8cba7ff});
    const values=Array.isArray(lines)?lines:[String(lines)];
    for(let i=0;i<values.length;i++){const y=190+i*68;this.text.draw(draw,typeof values[i]==='string'?values[i] as string:(values[i] as {text?:string}).text??'',70,y,{size:21,width:815,height:i===values.length-1?Math.max(65,600-y):65,color:0xd1dce4ff});}
    this.text.draw(draw,`${this.index+1} / ${this.pages.length}　　Z / → 下一页　← 上一页　X 返回`,70,632,{size:18,width:820,height:45,color:0x9fb5c9ff});return draw;}
  snapshot(){return{page:this.title,index:this.index,pages:this.pages.length};}
}

export class EndingPage implements GamePage {
 declare result:RunResult;declare replayAvailable:boolean;declare onClose:(()=>void)|undefined;declare text:TextPainter;declare art:GameArt;declare music:MusicController;declare sound:((id:number)=>void)|undefined;declare ending:ReadingLine[];
  declare buttons: TouhouButtons;
  declare age: number;
  declare line: number;
  declare phase: string;

  constructor({result,replayAvailable=false,onClose,text,art,music,sound}:EndingPageOptions={} as EndingPageOptions){Object.assign(this,{result,replayAvailable,onClose,text,art,music,sound});this.buttons=new TouhouButtons();this.age=0;this.line=0;this.phase='ending';this.ending=ENDINGS[PLAYERS[result.character].id][result.ending];this.music.play('ending',true);}
  update(mask:number){this.age++;this.buttons.update(mask);const next=!!(this.buttons.pressed&(Keys.SHOOT|Keys.CONFIRM));
    if(this.phase==='ending'&&this.age>=60&&(next||this.age>=420)){this.age=0;this.line++;if(this.line>=this.ending.length){this.phase='staff';this.music.play('staff',true);}}
    else if(this.phase==='staff'&&((this.age>90&&next)||this.age>=1800)){this.phase='result';this.age=0;}
    else if(this.phase==='result'&&this.age>40&&(next||this.buttons.pressed&(Keys.BOMB|Keys.CANCEL|Keys.PAUSE))){this.sound?.(7);this.onClose?.();}}
  draw(draw:DrawList){drawTitleBackdrop(draw,this.art,this.age+this.line*420,{shade:.3,dim:.55});
    if(this.phase==='ending'){
      this.art.portrait(draw,PLAYERS[this.result.character].id,595,105,570,{alpha:.7});
      this.text.draw(draw,this.result.ending==='extra'?'旧名的新一天':this.result.ending==='good'?'名字仍在归途中':'来日再沿名字寻路',54,74,{size:37,width:845,height:80,color:0xffe4a6ff});
      draw.rect(35,362,890,215,0x071327e8);
      const value=this.ending[this.line]??'',alpha=Math.min(1,this.age/25);
      this.text.draw(draw,typeof value==='string'?value:value.text??'',65,390,{size:26,width:824,height:160,color:0xe7e5dbff,alpha});
      this.text.draw(draw,'Z 继续',785,600,{size:18,width:140,height:40,color:0xb4c8daff});
    }else if(this.phase==='staff'){
      this.text.draw(draw,GAME.title,0,54,{size:54,width:960,height:90,align:'center',font:this.text.titleFont,color:0xffe4a6ff});
      const lines=['Names Beyond the Boundary.','东方 Project 原作：上海爱丽丝幻乐团 / ZUN','原创同人企划、剧情、角色与弹幕：Touhou21 项目','引擎：TS-STG　　游戏框架与公共预置体：thlib','原创图像：imagegen 辅助制作','原创音乐：独立记谱，以真实乐器采样离线渲染','采样：Salamander Grand Piano（Alexander Holm，CC BY 3.0）','MuldjordKit（Lars Muldjord，CC BY 4.0）／VSCO 2 CE（CC0）','愿每一个旧名字，都有人轻轻应答。'];
      for(let i=0;i<lines.length;i++)this.text.draw(draw,lines[i],0,196+i*48,{size:i?22:25,width:960,height:48,align:'center',color:i===lines.length-1?0xffe4a6ff:0xc8d5e0ff});
    }else{
      this.text.draw(draw,'归名之旅　完成',0,100,{size:48,width:960,height:85,align:'center',color:0xffe4a6ff});
      const saved=this.replayAvailable?'记录已保存；回放可选择栏位保存。':this.result.continues?'记录已保存；续关后的游戏不能保存回放。':'记录已保存。';
      const stats=[`${PLAYERS[this.result.character].name}　${this.result.mode==='extra'?'Extra':GAME.difficultyNames[this.result.difficulty]}`,`Score　${String(Math.trunc(this.result.score*10)).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`,`符卡收取　${this.result.captures.filter(card=>card.captured).length} / ${this.result.captures.length}`,`续关　${this.result.continues}`,`${this.result.ending==='good'?'Extra 已开放；':''}${saved}`];
      for(let i=0;i<stats.length;i++)this.text.draw(draw,stats[i],0,252+i*57,{size:25,width:960,height:55,align:'center'});
      this.text.draw(draw,this.replayAvailable?'Z 选择回放栏位':'Z 返回标题',0,621,{size:23,width:960,height:50,align:'center',color:0xe0bc80ff});
    }return draw;}
  snapshot(){return{page:'ending',phase:this.phase,line:this.line,ending:this.result.ending};}
}

export function manualPages(){return [
  {title:'名字从生活中悄悄消失',lines:['初秋的细雨之后，牌匾、书脊、信封纷纷变成空白。','人们仍然知道彼此是谁，却越来越难叫出名字。','神社的巫女与普通的魔法使，沿着会发光的空白门牌出发。','这是一部原创东方同人作品，新增设定不属于官方剧情。']},
  {title:'基本操作',lines:['方向键：移动　　Shift：低速移动与判定点','Z：射击 / 确定　　X：Bomb / 返回　　Esc：暂停','Enter 也可以确定。对话时按 Z 继续，长按 Shift 跳过。','游戏保持固定 60 帧模拟；回放须使用录制时的脚本后端。']},
  {title:'射击、判定与道具',lines:['灵梦：追踪火力、细致的低速移动、梦想封印。','魔理沙：直线集中火力、较快移动、魔炮。','击破敌人会掉落 Power 与点道具；上方可自动收集。','生命与 Bomb 碎片集齐后增加库存，公共效果与音效由 thlib 提供。']},
  {title:'符卡与血环',lines:['非符与后续符卡共用分段血环。到达标记处即进入符卡。','不 Miss、不使用 Bomb，并在时限内击破可取得符卡奖励。','耐久符卡不能被射击提前结束，须存活到倒计时归零。','符卡名、失败与收取提示、聚能和慢速消弹均使用公共预置体。']},
  {title:'六面本篇与 Extra',lines:['本篇从灯笼坂通往归名天台，包含六个完整关卡。','不续关通关获得自机好结局并解锁 Extra；续关则为坏结局。','Extra 是独立的固定难度：3 张中 Boss 符卡与 10 张主 Boss 符卡。','关卡练习只开放已经到达的关卡；符卡练习开放已经见过的符卡。']},
  {title:'练习、回放与存档',lines:['关卡练习从该关道中开始；符卡练习直接进入选中的符卡。','回放有 20 个固定栏位，保存时选择编号，覆盖已有回放前需确认。','不保存或取消不会改动已有回放；续关后的游戏不能保存回放。','所有设置、成绩、符卡记录与回放均保存在本目录 userdata。']},
  {title:'制作与资源',lines:['底层引擎与公共玩法：TS-STG / thlib。','新作剧情、对白、Boss、符卡与菜单皮肤独立设计。','立绘和场景由 imagegen 辅助制作；18 首 BGM 为原创编曲（采样来源见制作名单与 docs/MUSIC.md）。','本地公共原作资源保持既有来源标记，不作为原创素材重新授权。']},
  ...CHARACTERS.map(character=>({title:`${character.name}　${character.title}`,lines:[`种族：${character.species}`,`能力：${character.ability}`,character.personality,character.backstory]}))
];}
