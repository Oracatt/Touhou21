import {TouhouTitleMenu} from '@ts-stg/thlib/touhou';
import {GAME,PLAYERS} from './content.js';

export const TITLE_LABELS=['开始游戏','Extra Start','关卡练习','符卡练习','回放鉴赏','玩家记录','音乐室','选项','游戏说明','退出游戏'];
export class ProjectTitleMenu extends TouhouTitleMenu {
  constructor(options,{art,text,storage,unlockAll=false,onReturnMain}={}){super({...options,labels:TITLE_LABELS,startModes:{0:'normal',1:'extra'},excluded:storage.extraUnlocked||unlockAll?[]:[1]});Object.assign(this,{art,text,storage,onReturnMain});this.normalDifficulty=this.difficulty>=0&&this.difficulty<=3?this.difficulty:1;}
  openDifficulty(){
    const fixedExtra=this.mode==='extra'||this.mode==='spell-practice'&&this.difficulty===4;
    if(fixedExtra&&this.state==='character'&&this.phase===4){this.returnMain();return;}
    if(fixedExtra){if(this.difficulty<=3)this.normalDifficulty=this.difficulty;this.difficulty=4;this.openCharacter();}
    else{if(this.difficulty===4)this.difficulty=this.normalDifficulty;super.openDifficulty();}
  }
  openCharacter(){if(this.difficulty>=0&&this.difficulty<=3)this.normalDifficulty=this.difficulty;super.openCharacter();}
  returnMain(){this.difficulty=this.normalDifficulty;this.mode='normal';super.returnMain();this.onReturnMain?.();}
  draw(draw){
    const t=this.age,alpha=Math.min(1,(t+10)/35),slide=Math.max(0,24-t*.6);
    this.art.background(draw,'title',480,360,960,720);
    draw.rect(0,0,520,720,0x06132770);
    for(let i=0;i<12;i++){const x=35+(i*79)%910,y=(t*.28+i*71)%760-20;draw.rect(x,y,8,18,0xe9d3a022);}
    const text=this.text;
    text.draw(draw,GAME.title,42,46,{size:68,width:600,height:100,font:text.titleFont,stroke:3,color:0xf7ead1ff,alpha});
    text.draw(draw,GAME.subtitle,48,136,{size:20,width:600,height:50,color:0xc8d6e0ff,alpha});
    text.draw(draw,'原创东方同人作品',50,174,{size:15,width:450,height:40,color:0xe7bc77ff,alpha});
    if(this.state==='main'){
      for(let i=0;i<this.labels.length;i++){
        const selected=this.selection===i,excluded=this.excluded.has(i),x=74+(selected?10:0)-slide;
        if(selected)draw.line(52,258+i*33,310,258+i*33,1,0xe5c18288);
        text.draw(draw,this.labels[i],x,231+i*33,{size:selected?28:25,width:450,height:45,color:excluded?0x788596ff:selected?0xffe4a6ff:0xb9c9d8ff,alpha:this.phase===4?Math.max(.15,1-this.age/28):alpha});
        if(selected)text.draw(draw,'◆',43,233+i*33,{size:18,width:40,height:32,color:0xeccb8bff});
      }
      if(this.selection===1&&this.excluded.has(1))text.draw(draw,'本篇不续关通关后开放',56,600,{size:18,width:520,height:40});
      text.draw(draw,'Z / Enter 确定　X / Esc 返回　↑↓ 选择',46,639,{size:17,width:650,height:40,color:0xbdccdcff});
    }else if(this.state==='difficulty'){
      text.draw(draw,'选择难度',55,222,{size:32,width:600,height:60,color:0xffe4a6ff});
      for(let i=0;i<4;i++){
        const active=i===this.selection;
        text.draw(draw,GAME.difficultyNames[i],80,294+i*63,{size:active?38:30,width:480,height:60,color:active?0xffe4a6ff:0xaabbccff});
        if(active)text.draw(draw,GAME.difficultyDescriptions[i],425,373,{size:22,width:460,height:100,color:0xe4dfcfff});
      }
      text.draw(draw,'难度越高，弹幕的层次与应答方式也会变化。',56,619,{size:17,width:800,height:40});
    }else{
      const player=PLAYERS[this.selection];
      text.draw(draw,'选择自机',54,222,{size:32,width:550,height:55,color:0xffe4a6ff});
      this.art.portrait(draw,player.id,510,155,530,{alpha:Math.min(1,(this.age+2)/15)});
      text.draw(draw,player.name,65,311,{size:38,width:480,height:60,color:0xffe4a6ff});
      text.draw(draw,player.title,69,366,{size:22,width:450,height:50});
      text.draw(draw,this.selection?'直线火力 / 魔炮':'追踪火力 / 梦想封印',69,420,{size:22,width:445,height:60,color:0xbecfdaff});
      text.draw(draw,this.selection?'普通的魔法使。火力集中，移动较快。':'乐园的巫女。追踪便利，低速移动细致。',69,488,{size:22,width:390,height:130});
      text.draw(draw,'← 博丽灵梦　　雾雨魔理沙 →',65,623,{size:21,width:700,height:50,color:0xe4c892ff});
    }
    text.draw(draw,'Touhou21 fan project  ·  TS-STG',44,685,{size:14,width:750,height:30,color:0x91a6b8ff});
    return draw;
  }
}
