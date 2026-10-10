import type {AnmDrawList as DrawList} from '@ts-stg/thlib/touhou';
import type {GameArt,ArtTexture} from './art.js';

/** Original Boss actor atlases. Their ownership stays in GameArt; all effects remain in thlib. */
import {withAlpha} from '@ts-stg/thlib';

export interface BossSpriteLayout{file:string;width:number;height:number;bodyHeight:number;pivotX:number;pivotY:number;}
export interface BossSpriteActor{age?:number;vx?:number;_spriteDirection?:number;}
export const BOSS_SPRITE_LAYOUTS:Readonly<Record<string,BossSpriteLayout>> = Object.freeze({
  "akari": {
    "file": "assets/sprites/akari.png",
    "width": 1774,
    "height": 887,
    "bodyHeight": 400,
    "pivotX": 224.125,
    "pivotY": 236.5
  },
  "shizuri": {
    "file": "assets/sprites/shizuri.png",
    "width": 1774,
    "height": 887,
    "bodyHeight": 403,
    "pivotX": 231.25,
    "pivotY": 236.5
  },
  "watari": {
    "file": "assets/sprites/watari.png",
    "width": 1774,
    "height": 887,
    "bodyHeight": 376,
    "pivotX": 247,
    "pivotY": 235.625
  },
  "shino": {
    "file": "assets/sprites/shino.png",
    "width": 1774,
    "height": 887,
    "bodyHeight": 366,
    "pivotX": 235.875,
    "pivotY": 245
  },
  "fusae": {
    "file": "assets/sprites/fusae.png",
    "width": 1774,
    "height": 887,
    "bodyHeight": 336,
    "pivotX": 223.125,
    "pivotY": 245.125
  },
  "kotone": {
    "file": "assets/sprites/kotone.png",
    "width": 1774,
    "height": 887,
    "bodyHeight": 358,
    "pivotX": 237.625,
    "pivotY": 247.75
  },
  "mio": {
    "file": "assets/sprites/mio.png",
    "width": 1774,
    "height": 887,
    "bodyHeight": 381,
    "pivotX": 223,
    "pivotY": 236.25
  }
});

export function bossSpriteFrame(enemy:BossSpriteActor={}) {
  const age = Number.isFinite(enemy.age) ? Math.max(0, Math.floor(enemy.age!)) : 0;
  const direction = Number.isFinite(enemy._spriteDirection)
    ? Math.sign(enemy._spriteDirection!)
    : Math.sign(Number.isFinite(enemy.vx) ? enemy.vx! : 0);
  const cadence = Math.floor(age / 8);
  return direction < 0 ? 4 + cadence % 2 : direction > 0 ? 6 + cadence % 2 : cadence % 4;
}

export function bossSpriteRegion(layout:BossSpriteLayout, frame:number) {
  if (!layout || !Number.isInteger(frame) || frame < 0 || frame >= 8)
    throw new RangeError('Boss sprite frame must be an integer from 0 through 7');
  const column = frame % 4, row = Math.floor(frame / 4);
  const x = Math.floor(column * layout.width / 4), y = Math.floor(row * layout.height / 2);
  return {
    x, y,
    width: Math.floor((column + 1) * layout.width / 4) - x,
    height: Math.floor((row + 1) * layout.height / 2) - y,
  };
}

/** draw() takes screen pixel center x/y and logical visible body height before view scale.
 * Direction is presentation-only: callers may assign -1/0/1 to enemy._spriteDirection.
 * Registered actors use a separate presentation clock so a held attack clock
 * cannot freeze their clothes and movement poses. Drawing never advances it.
 */
export class BossSpriteCatalog {
 declare art:GameArt;declare cache:Map<string,{layout:BossSpriteLayout;asset:ArtTexture}>;
 private clocks=new WeakMap<BossSpriteActor,number>();
  constructor({art}:{art:GameArt}) {
    if (!art || typeof art.load !== 'function') throw new TypeError('BossSpriteCatalog needs GameArt');
    this.art = art;
    this.cache = new Map();
  }
  attach(enemy:BossSpriteActor){this.clocks.set(enemy,0);return this;}
  update(enemy:BossSpriteActor){
    const age=this.clocks.get(enemy);if(age!==undefined)this.clocks.set(enemy,age+1);
    return this;
  }
  frame(enemy:BossSpriteActor){
    return bossSpriteFrame({age:this.clocks.get(enemy)??enemy.age,vx:enemy.vx,_spriteDirection:enemy._spriteDirection});
  }
  load(bossId:string) {
    const layout = BOSS_SPRITE_LAYOUTS[bossId];
    if (!layout) throw new RangeError('Unknown Boss sprite: ' + bossId);
    if (!this.cache.has(bossId)) {
      const asset = this.art.load(layout.file);
      if (asset.width !== layout.width || asset.height !== layout.height)
        throw new Error('Boss atlas size differs from the recorded layout: ' + bossId);
      this.cache.set(bossId, {layout, asset});
    }
    return this.cache.get(bossId)!;
  }
  draw(draw:DrawList, enemy:BossSpriteActor, bossId:string, {x, y, scale=1.5, height=68, color=0xffffffff, alpha=1}:{x:number;y:number;scale?:number;height?:number;color?:number;alpha?:number}={} as {x:number;y:number}) {
    if (![x,y,scale,height,alpha].every(Number.isFinite) || scale<=0 || height<=0)
      throw new TypeError('Boss sprite drawing needs finite coordinates and positive dimensions');
    const {layout,asset} = this.load(bossId);
    const frame = this.frame(enemy), region = bossSpriteRegion(layout,frame);
    const factor = height * scale / layout.bodyHeight;
    // Stable shared actor pivot; animation does not shift the collision point or crop shoes.
    const dx = x + (region.width/2 - layout.pivotX) * factor;
    const dy = y + (region.height/2 - layout.pivotY) * factor;
    draw.sampler(asset.id,'point','clamp','clamp');
    // Generated cutouts may retain harmless RGB in alpha 1–3 pixels. Discard only that tail.
    draw.alphaTest(4/255);
    draw.spriteRegion(asset.id,region.x,region.y,region.width,region.height,dx,dy,
      region.width*factor,region.height*factor,0,withAlpha(color,alpha));
    draw.alphaTest(0);
    return frame;
  }
  clear(){this.cache.clear();this.clocks=new WeakMap();}
}
