/** Title atmosphere shared by the menu and its utility pages: the painted
 * lake drifts slowly, blank name tags rise from the water and golden bell
 * motes shimmer. Everything is a pure function of the frame counter, so
 * screenshots and replays of the menu stay reproducible. */
const TAGS=Array.from({length:16},(_,i)=>({x:(i*211.7+37)%960,speed:.16+((i*37)%11)/42,width:9+((i*53)%7),
  phase:i*1.93,offset:(i*389)%820,alpha:.22+((i*29)%7)/22}));
const MOTES=Array.from({length:38},(_,i)=>({x:(i*127.3+15)%960,y:(i*251.9+40)%720,speed:.08+((i*17)%9)/60,
  radius:1+((i*31)%5)*.35,phase:i*2.37}));

/** Axis-free rectangle via two triangles; draw lists have no rotated rect. */
export function fillQuad(draw,x,y,width,height,rotation,color){
  const c=Math.cos(rotation),s=Math.sin(rotation),hw=width/2,hh=height/2;
  const p=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]);
  draw.triangle(p[0][0],p[0][1],p[1][0],p[1][1],p[2][0],p[2][1],color).triangle(p[0][0],p[0][1],p[2][0],p[2][1],p[3][0],p[3][1],color);
  return draw;
}
const rgba=(rgb,alpha)=>((rgb<<8)|Math.round(Math.max(0,Math.min(1,alpha))*255))>>>0;

export function drawTitleBackdrop(draw,art,clock,{dim=0,shade=1,tags=true}={}){
  const t=clock,scale=1.07+.025*Math.sin(t*.0019);
  art.background(draw,'title',500+14*Math.sin(t*.0011),360+6*Math.sin(t*.0016),960*scale,720*scale);
  if(shade>0){
    for(let i=0;i<22;i++)draw.rect(i*26,0,26,720,rgba(0x050a18,shade*.7*Math.pow(1-i/22,1.7)));
    for(let i=0;i<8;i++)draw.rect(0,640+i*10,960,10,rgba(0x030612,shade*.07*(i+1)));
  }
  if(tags)for(const tag of TAGS){
    const y=760-((t*tag.speed+tag.offset)%840),x=tag.x+Math.sin(t*.011+tag.phase)*22;
    const fade=Math.min(1,(760-y)/120,y/160);if(fade<=0)continue;
    fillQuad(draw,x,y,tag.width,tag.width*1.55,.35*Math.sin(t*.013+tag.phase),rgba(0xf4ecd8,tag.alpha*fade));
    draw.line(x,y-tag.width*.78,x+Math.sin(t*.02+tag.phase)*3,y-tag.width*1.4,1,rgba(0xd2544a,tag.alpha*fade*.9));
  }
  draw.blend('add');
  for(const m of MOTES){
    const y=(m.y-t*m.speed%720+720)%720,x=m.x+Math.sin(t*.008+m.phase)*12,twinkle=.45+.55*Math.sin(t*.05+m.phase);
    draw.circle(x,y,m.radius*3.2,rgba(0xffc860,.07*twinkle)).circle(x,y,m.radius,rgba(0xffe7a8,.55*twinkle));
  }
  draw.blendEnd();
  if(dim>0)draw.rect(0,0,960,720,rgba(0x040814,dim));
  return draw;
}

/** A thin gold rule with diamond terminals, used under headings. */
export function drawOrnament(draw,x,y,width,alpha=1){
  const gold=rgba(0xe6c27c,.8*alpha);draw.line(x+8,y,x+width-8,y,1,gold);
  for(const cx of[x,x+width])fillQuad(draw,cx,y,6,6,Math.PI/4,gold);
  fillQuad(draw,x+width/2,y,5,5,Math.PI/4,rgba(0xffe6b0,alpha));
  return draw;
}
export {rgba};
