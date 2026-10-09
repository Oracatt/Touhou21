import type {AnmDrawList as DrawList} from '@ts-stg/thlib/touhou';
import type {GameArt} from './art.js';

/** Game-specific artwork for the public HUD skin callbacks. State labels,
 * numbers, stock icons and mode indicators remain owned by thlib. */
export class GameFrameSkin {
 declare art:GameArt;
  constructor({art}:{art:GameArt}){this.art=art;}
  drawFrame(draw:DrawList){
    draw.blendFactors('srcAlpha','oneMinusSrcAlpha','add','one','zero','add');
    // One continuous painting covers the whole application frame. Every strip
    // samples the same projection, so the sidebar has no separate panel seam.
    const panel=this.art.load('assets/art/hud-panel.png'),sourceWidth=panel.width*.76,sourceHeight=sourceWidth*.75;
    for(const [x,y,width,height] of [[0,0,960,24],[0,24,48,672],[624,24,336,672],[0,696,960,24]]){
      draw.scissor(x,y,width,height);
      draw.sampler(panel.id,'bilinear','clamp','clamp').spriteRegion(panel.id,(panel.width-sourceWidth)/2,(panel.height-sourceHeight)/2,sourceWidth,sourceHeight,480,360,960,720);
      draw.scissorEnd();
    }
    draw.blendEnd();
  }
  drawBranding(draw:DrawList){
    const logo=this.art.load('assets/art/hud-logo.png'),bounds=logo.bounds;
    const scale=Math.min(296/bounds.width,190/bounds.height);
    draw.blendFactors('srcAlpha','oneMinusSrcAlpha','add','one','zero','add');
    draw.sampler(logo.id,'bilinear','clamp','clamp').spriteRegion(logo.id,bounds.x,bounds.y,bounds.width,bounds.height,792,595,bounds.width*scale,bounds.height*scale);
    draw.blendEnd();
  }
}
