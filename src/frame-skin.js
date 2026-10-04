/** This game's border artwork and labels. Common thlib keeps stock icons,
 * scores, difficulty, Boss pointer and all notification animation owners. */
export class GameFrameSkin {
  constructor({art,text}){Object.assign(this,{art,text});}
  draw(queue,game){
    queue.enqueuePriority(74,draw=>{
      for(const [x,y,width,height] of [[0,0,960,24],[0,24,48,672],[624,24,336,672],[0,696,960,24]]){
        draw.scissor(x,y,width,height);this.art.background(draw,'title',480,360,960,720);draw.scissorEnd();
      }
      draw.rect(632,24,320,672,0xf2ecd8eb);
      draw.line(636,24,636,696,2,0xbe946dff).line(948,24,948,696,1,0xbe946d99);
      const labels=[['最高得分',64,0x70685aff],['得分',97,0x273960ff],['生命',146,0x963b84ff],['Bomb',205,0x388747ff],['火力',275,0xad4134ff]];
      for(const [label,y,color] of labels)this.text.draw(draw,label,646,y,{size:20,width:140,height:37,color});
      draw.line(649,333,932,333,1,0xab967466);
      for(const [label,value,y] of [['Graze',game.player.graze,350],['点道具',game.player.pointItems,395],['点价值',game.player.pointValue,440]]){
        this.text.draw(draw,label,649,y,{size:18,width:125,height:40,color:0x596562ff});
        this.text.draw(draw,String(value).replace(/\B(?=(\d{3})+(?!\d))/g,','),773,y,{size:20,width:156,height:40,align:'right',color:0x283c50ff});
      }
      this.text.draw(draw,game.config.character?'雾雨魔理沙':'博丽灵梦',651,508,{size:23,width:285,height:46,align:'center',color:0x755d48ff});
    });
  }
}
