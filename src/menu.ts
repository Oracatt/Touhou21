import type {AnmDrawList as DrawList,TouhouTitleMenuOptions} from '@ts-stg/thlib/touhou';
import type {GameArt} from './art.js';
import type {TextPainter} from './text.js';
import type {GameStorage} from './storage.js';

import {TouhouTitleMenu,TOUHOU_MAIN_LABELS} from '@ts-stg/thlib/touhou';
import {GAME,PLAYERS} from './content.js';
import {drawTitleBackdrop,drawOrnament,fillQuad,rgba} from './title-backdrop.js';

export const TITLE_LABELS=['开始游戏','Extra Start','关卡练习','符卡练习','回放鉴赏','玩家记录','音乐室','选项','游戏说明','退出游戏'];
const TITLE_HINTS=[
  '从第一面出发，沿着空白的门牌寻找名字的去处。','旧名的回声仍在倒铃回廊中回响。','从已经到达的关卡开始，完整练习道中、中 Boss 与 Boss。',
  '反复挑战已经遇见的符卡。','按栏位选择并观看已保存的回放。','查看通关成绩，以及每张符卡的收取记录。','聆听本作的原创乐曲与作曲评语。',
  '调整音量与初始残机。','操作、系统与登场人物介绍。','合上归名册，回到有名字的世界。'];
const DIFFICULTY_COLORS=[0x86d97e,0x7fb6ff,0xffad5c,0xe07dff];
const PLAYER_STYLES=[
  {color:0xff7468,glow:0xd6373c,shot:'追踪符札 / 梦想封印',stats:[3,2,5],note:'乐园的巫女。追踪火力覆盖全场，低速移动细致。'},
  {color:0xffd65e,glow:0xb89a28,shot:'直线魔弹 / 魔炮',stats:[4,5,2],note:'普通的魔法使。火力集中在正面，移动较快。'}];
const STAT_LABELS=['移动速度','火力集中','攻击范围'];
const ease=(t:number)=>t<=0?0:t>=1?1:t*t*(3-2*t);

export class ProjectTitleMenu extends TouhouTitleMenu {
  declare clock: number;
  declare normalDifficulty: number;
  declare difficulty: number;
  declare mode: string;

 declare art:GameArt;declare text:TextPainter;declare storage:GameStorage;declare onReturnMain:(()=>void)|undefined;
  constructor(options:TouhouTitleMenuOptions,{art,text,storage,unlockAll=false,onReturnMain}:{art:GameArt;text:TextPainter;storage:GameStorage;unlockAll?:boolean;onReturnMain?:()=>void}={} as {art:GameArt;text:TextPainter;storage:GameStorage}){
    super({...options,labels:TITLE_LABELS,startModes:{0:'normal',1:'extra'},excluded:storage.extraUnlocked||unlockAll?[]:[1]});
    Object.assign(this,{art,text,storage,onReturnMain});this.clock=0;
    this.normalDifficulty=this.difficulty>=0&&this.difficulty<=3?this.difficulty:1;
  }
  update(mask:number){super.update(mask);this.clock++;}
  openDifficulty(){
    const fixedExtra=this.mode==='extra'||this.mode==='spell-practice'&&this.difficulty===4;
    if(fixedExtra&&this.state==='character'&&this.phase===4){this.returnMain();return;}
    if(fixedExtra){if(this.difficulty<=3)this.normalDifficulty=this.difficulty;this.difficulty=4;this.openCharacter();}
    else{if(this.difficulty===4)this.difficulty=this.normalDifficulty;super.openDifficulty();}
  }
  openCharacter(){if(this.difficulty>=0&&this.difficulty<=3)this.normalDifficulty=this.difficulty;super.openCharacter();}
  returnMain(){this.difficulty=this.normalDifficulty;this.mode='normal';super.returnMain();this.onReturnMain?.();}

  /** Calligraphic logo: 东方 over 归名录, a vermilion seal and the subtitle. */
  drawLogo(draw:DrawList,alpha:number,slide:number){
    const text=this.text,font=text.titleFont,x=58-slide;
    text.draw(draw,'东方',x+10,30,{size:40,width:200,height:60,font,stroke:2,color:0xe9c47eff,alpha});
    draw.blend('add');
    text.draw(draw,'归名录',x,62,{size:98,width:420,height:130,font,stroke:12,color:0xffe1a060,outline:0xffb86a28,alpha:alpha*.55});
    draw.blendEnd();
    text.draw(draw,'归名录',x,62,{size:98,width:420,height:130,font,stroke:3,color:0xfaf1dcff,outline:0x0a1122ff,alpha});
    const sx=x+340,sy=86,pulse=.88+.12*Math.sin(this.clock*.04);
    draw.rect(sx,sy,46,46,rgba(0xc23a32,.92*alpha)).rect(sx+3,sy+3,40,40,rgba(0x8f2620,.5*alpha));
    text.draw(draw,'归',sx+7,sy-1,{size:22,width:40,height:28,font,stroke:0,color:0xfff2e0ff,alpha:alpha*pulse});
    text.draw(draw,'名',sx+7,sy+20,{size:22,width:40,height:28,font,stroke:0,color:0xfff2e0ff,alpha:alpha*pulse});
    text.draw(draw,'～ Names Beyond the Boundary.',x+14,184,{size:21,width:520,height:40,color:0xc6d8eaff,alpha});
    drawOrnament(draw,x+14,226,330,alpha);
  }
  drawMain(draw:DrawList){
    const age=this.phase===1?this.age:Math.max(130,this.age+130),leaving=this.phase===4?Math.max(0,1-this.age/20):1;
    const logo=ease(age/45);this.drawLogo(draw,logo,(1-logo)*36);
    const text=this.text,top=258,step=36;
    for(let i=0;i<this.labels.length;i++){
      const appear=ease((age-30-i*5)/22)*leaving,selected=this.selection===i,locked=this.excluded.has(i),y=top+i*step;
      if(appear<=0)continue;
      const shift=(1-appear)*-40+(selected?14:0);
      if(selected){
        const flash=this.flashAge>0&&this.flashAge%6<3?1.6:1;
        draw.blend('add');
        for(let s=0;s<10;s++)draw.rect(70+s*44,y+2,44,30,rgba(0xe8b45a,.16*flash*appear*Math.pow(1-s/10,1.4)));
        draw.blendEnd();
        draw.line(70,y+32,470,y+32,1,rgba(0xf5d391,.55*appear));
        const spin=this.clock*.05;fillQuad(draw,86,y+17,10,10,spin,rgba(0xffe2a2,appear)).circle(86,y+17,9,rgba(0xffe2a2,.18*appear));
      }
      const color=locked?0x6f7c8cff:selected?0xfff0c8ff:0xb7c7d6ff,size=25;
      text.draw(draw,this.labels[i],106+shift,y+1,{size,width:260,height:40,color,alpha:appear*(selected?1:.82),scale:selected?1.08:1});
      const label=TOUHOU_MAIN_LABELS[i],width=text.texture(this.labels[i],{size,width:260,height:40,color}).width*(selected?1.08:1);
      text.draw(draw,label,106+shift+width+14,y+11,{size:13,width:200,height:24,color:selected?0xe9c57fff:0x8193a5ff,alpha:appear*(selected?1:.6)});
    }
    const hint=this.selection===1&&this.excluded.has(1)?`未开放：${GAME.extraRequirement}`:TITLE_HINTS[this.selection]??'';
    const hintAlpha=ease((age-80)/30)*leaving;
    text.draw(draw,hint,64,634,{size:18,width:620,height:34,color:0xe2d6b8ff,alpha:hintAlpha});
    text.draw(draw,'↑↓ 选择　Z 确定　X 返回',700,674,{size:15,width:240,height:28,align:'right',color:0x9fb1c3ff,alpha:hintAlpha});
  }
  drawDifficulty(draw:DrawList){
    const text=this.text,enter=ease(this.age/14),leave=this.phase===4?Math.max(0,1-this.age/6):1,alpha=(this.phase===1?enter:1)*leave;
    text.draw(draw,'选择难度',62,190,{size:34,width:300,height:54,font:text.titleFont,color:0xffe7b0ff,alpha});
    text.draw(draw,'Select Difficulty',234,204,{size:15,width:240,height:28,color:0xa9bccdff,alpha});
    drawOrnament(draw,62,240,420,alpha);
    for(let i=0;i<4;i++){
      const selected=i===this.selection,color=DIFFICULTY_COLORS[i],y=262+i*92,x=62+(selected?26:0)-(1-alpha)*30;
      const confirm=this.phase===3&&selected&&this.age%4<2?1.5:1;
      draw.rect(x,y,440,78,rgba(0x0a1224,selected?.82:.6));
      if(selected){draw.blend('add');for(let s=0;s<8;s++)draw.rect(x+s*55,y,55,78,rgba(color,.12*confirm*Math.pow(1-s/8,1.3)));draw.blendEnd();}
      draw.rect(x,y,7,78,rgba(color,selected?1:.55)).line(x,y+78,x+440,y+78,1,rgba(color,selected?.8:.25));
      text.draw(draw,GAME.difficultyNames[i],x+24,y+6,{size:selected?36:30,width:300,height:50,color:((color<<8)|0xff)>>>0,alpha:alpha*(selected?1:.7)});
      text.draw(draw,GAME.difficultyDescriptions[i],x+26,y+48,{size:16,width:400,height:28,color:0xd9e1e8ff,alpha:alpha*(selected?1:.55)});
      for(let s=0;s<=i;s++)fillQuad(draw,x+410-s*16,y+22,9,9,Math.PI/4,rgba(color,(selected?.95:.4)*alpha));
    }
    text.draw(draw,'难度越高，弹幕的层次、密度与应答方式也会变化。',62,646,{size:17,width:620,height:30,color:0xc4d0dbff,alpha});
  }
  drawCharacter(draw:DrawList){
    const text=this.text,player=PLAYERS[this.selection],style=PLAYER_STYLES[this.selection];
    const enter=ease(this.age/16),leave=this.phase===4?Math.max(0,1-this.age/6):1,alpha=(this.phase===1?enter:1)*leave;
    draw.blend('add');draw.circle(700,380,250,rgba(style.glow,.13*alpha)).circle(700,380,170,rgba(style.glow,.1*alpha));draw.blendEnd();
    const bob=Math.sin(this.clock*.03)*5,slide=(1-alpha)*60;
    this.art.portrait(draw,player.id,520+slide,118+bob,560,{alpha:Math.min(1,alpha*1.1)});
    text.draw(draw,'选择自机',62,190,{size:34,width:300,height:54,font:text.titleFont,color:0xffe7b0ff,alpha});
    text.draw(draw,'Select Player',234,204,{size:15,width:240,height:28,color:0xa9bccdff,alpha});
    drawOrnament(draw,62,240,400,alpha);
    text.draw(draw,player.name,66-slide*.4,262,{size:44,width:420,height:64,font:text.titleFont,color:((style.color<<8)|0xff)>>>0,alpha});
    text.draw(draw,player.title,70,326,{size:20,width:420,height:34,color:0xe8dcc0ff,alpha});
    text.draw(draw,style.shot,70,366,{size:20,width:420,height:34,color:0xbfd2e2ff,alpha});
    text.draw(draw,style.note,70,404,{size:18,width:400,height:56,color:0xd7dee6ff,alpha});
    for(let s=0;s<3;s++){
      const y=476+s*34;text.draw(draw,STAT_LABELS[s],70,y,{size:16,width:120,height:26,color:0xaebfcfff,alpha});
      for(let j=0;j<5;j++)draw.rect(170+j*34,y+7,28,10,j<style.stats[s]?rgba(style.color,.9*alpha):rgba(0x33405a,.7*alpha));
    }
    for(let i=0;i<PLAYERS.length;i++){
      const active=i===this.selection,x=92+i*150;
      text.draw(draw,PLAYERS[i].name,x,600,{size:19,width:140,height:30,color:active?((PLAYER_STYLES[i].color<<8)|0xff)>>>0:0x7f93a6ff,alpha});
      if(active)draw.line(x,630,x+(i?100:80),630,2,rgba(PLAYER_STYLES[i].color,.8*alpha));
    }
    fillQuad(draw,72,614,8,8,Math.PI/4,rgba(0xc8d6e2,this.selection?alpha:.3*alpha));
    fillQuad(draw,358,614,8,8,Math.PI/4,rgba(0xc8d6e2,this.selection?.3*alpha:alpha));
    text.draw(draw,'← → 切换　Z 确定　X 返回',62,646,{size:17,width:420,height:30,color:0xc4d0dbff,alpha});
  }
  draw(draw:DrawList){
    drawTitleBackdrop(draw,this.art,this.clock,{shade:1,dim:this.state==='main'?0:.18});
    if(this.state==='main')this.drawMain(draw);
    else{
      this.text.draw(draw,GAME.title,62,48,{size:34,width:360,height:52,font:this.text.titleFont,stroke:3,color:0xf3e6c8ff,alpha:.85});
      this.text.draw(draw,GAME.subtitle,66,98,{size:15,width:360,height:26,color:0xa9bccdff,alpha:.85});
      if(this.state==='difficulty')this.drawDifficulty(draw);else this.drawCharacter(draw);
    }
    this.text.draw(draw,`ver ${GAME.version}　原创东方 Project 同人作品　Touhou21 · TS-STG`,40,690,{size:13,width:600,height:24,color:0x8ea2b6ff});
    return draw;
  }
}
