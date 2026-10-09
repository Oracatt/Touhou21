import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DrawList} from '@ts-stg/thlib';
import {CHARACTERS} from '../dist/src/content.js';
import {BOSS_SPRITE_LAYOUTS,BossSpriteCatalog,bossSpriteFrame,bossSpriteRegion} from '../dist/src/boss-sprites.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/SPRITE-PROMPTS.json'),'utf8'));

// Read-only PNG inspection. The generated atlas bytes are never cropped, resized or recolored.
function decodeRgba(wav){
  assert.deepEqual(wav.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  const data=[];let width,height;
  for(let cursor=8;cursor<wav.length;){
    const size=wav.readUInt32BE(cursor),tag=wav.toString('ascii',cursor+4,cursor+8),chunk=wav.subarray(cursor+8,cursor+8+size);
    if(tag==='IHDR'){
      width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);
      assert.equal(chunk[8],8);assert.equal(chunk[9],6);assert.equal(chunk[12],0);
    }else if(tag==='IDAT')data.push(chunk);
    cursor+=size+12;
  }
  const bytes=zlib.inflateSync(Buffer.concat(data)),stride=width*4,pixels=Buffer.alloc(stride*height);
  let cursor=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=bytes[cursor++];assert.ok(filter>=0&&filter<=4);
    for(let x=0;x<stride;x++){
      const at=y*stride+x,left=x>=4?pixels[at-4]:0,up=y?pixels[at-stride]:0,diagonal=y&&x>=4?pixels[at-stride-4]:0;
      const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,diagonal);
      pixels[at]=(bytes[cursor++]+predictor)&255;
    }
  }
  assert.equal(cursor,bytes.length);
  return {width,height,pixels};
}

test('every original Boss has a separate eight-frame actor atlas and recorded imagegen reference',()=>{
  assert.deepEqual(new Set(Object.keys(BOSS_SPRITE_LAYOUTS)),new Set(CHARACTERS.map(value=>value.id)));
  assert.equal(manifest.assets.length,7);
  assert.equal(new Set(manifest.assets.map(value=>value.sha256)).size,7);
  for(const item of manifest.assets){
    assert.equal(item.columns,4);assert.equal(item.rows,2);assert.equal(item.transparent,true);
    assert.equal(item.mode,'RGBA');assert.equal(item.reviewed,true);
    assert.ok(fs.existsSync(path.join(root,item.reference)));
    assert.match(item.mode==='RGBA'?item.prompt:'',/transparent/i);
    assert.equal(item.file,BOSS_SPRITE_LAYOUTS[item.id].file);
  }
});

for(const item of manifest.assets){
  test(`${item.id}: eight complete distinct figures, transparent gutters, stable atlas geometry`,()=>{
    const file=fs.readFileSync(path.join(root,item.file));
    assert.equal(crypto.createHash('sha256').update(file).digest('hex'),item.sha256);
    const image=decodeRgba(file),hashes=[];
    assert.equal(image.width,item.width);assert.equal(image.height,item.height);
    assert.equal(image.width,image.height*2);
    for(let frame=0;frame<8;frame++){
      const region=bossSpriteRegion(BOSS_SPRITE_LAYOUTS[item.id],frame),record=item.cells[frame];
      assert.deepEqual(region,{x:record.x,y:record.y,width:record.width,height:record.height});
      const normalized=Buffer.alloc(region.width*region.height*4);
      let opaque=0,left=region.width,top=region.height,right=-1,bottom=-1;
      let solidLeft=region.width,solidTop=region.height,solidRight=-1,solidBottom=-1;
      for(let y=0;y<region.height;y++)for(let x=0;x<region.width;x++){
        const at=((region.y+y)*image.width+region.x+x)*4,a=image.pixels[at+3];
        if(a>=4){
          left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
          assert.ok(x>0&&x<region.width-1&&y>0&&y<region.height-1,'visible pixel must not touch a neighboring cell');
        }
        if(a>=128){opaque++;solidLeft=Math.min(solidLeft,x);solidTop=Math.min(solidTop,y);solidRight=Math.max(solidRight,x);solidBottom=Math.max(solidBottom,y);}
        if(a>=16){const out=(y*region.width+x)*4;normalized[out]=image.pixels[at];normalized[out+1]=image.pixels[at+1];normalized[out+2]=image.pixels[at+2];normalized[out+3]=255;}
      }
      assert.deepEqual([left,top,right+1,bottom+1],record.visibleBounds);
      assert.deepEqual([solidLeft,solidTop,solidRight+1,solidBottom+1],record.solidBounds);
      assert.ok(opaque/(region.width*region.height)>.12&&opaque/(region.width*region.height)<.55);
      assert.ok(solidBottom-solidTop>region.height*.65,'head-to-foot silhouette must remain a full actor');
      hashes.push(crypto.createHash('sha256').update(normalized).digest('hex'));
    }
    assert.equal(new Set(hashes).size,8,'animation frames must have actual pose or flutter changes');
  });
}

test('idle, left movement and right movement use stable eight-frame cadence',()=>{
  assert.deepEqual([0,7,8,16,24,31,32].map(age=>bossSpriteFrame({age})),[0,0,1,2,3,3,0]);
  assert.deepEqual([0,8,16,24].map(age=>bossSpriteFrame({age,_spriteDirection:-1})),[4,5,4,5]);
  assert.deepEqual([0,8,16,24].map(age=>bossSpriteFrame({age,_spriteDirection:1})),[6,7,6,7]);
  assert.equal(bossSpriteFrame({age:8,vx:-.3}),5);
  assert.equal(bossSpriteFrame({age:8,vx:.3,_spriteDirection:0}),1);
  assert.equal(bossSpriteFrame({age:-10}),0);
  assert.throws(()=>bossSpriteRegion(BOSS_SPRITE_LAYOUTS.akari,8),RangeError);
});

test('BossSpriteCatalog renders only the chosen cell with public point sampling and restores alpha test',()=>{
  let reads=0;
  const catalog=new BossSpriteCatalog({art:{load(file){reads++;assert.equal(file,'assets/sprites/akari.png');return {id:42,width:1774,height:887};}}});
  const enemy={age:8,_spriteDirection:-1},draw=new DrawList(),copy={...enemy};
  assert.equal(catalog.draw(draw,enemy,'akari',{x:336,y:180,scale:1.5,height:68,color:0xffccccff,alpha:.5}),5);
  assert.deepEqual(enemy,copy,'drawing must not alter gameplay or replay state');
  assert.deepEqual(draw.commands[0],['sampler',42,'point','clamp','clamp']);
  assert.deepEqual(draw.commands[1],['alphaTest',4/255]);
  assert.deepEqual(draw.commands[3],['alphaTest',0]);
  const sprite=draw.commands[2];
  assert.equal(sprite[0],'spriteRegion');assert.deepEqual(sprite.slice(1,6),[42,443,443,444,444]);
  assert.equal(sprite[11],0xffcccc80);
  assert.ok(sprite.slice(6,11).every(Number.isFinite));
  catalog.draw(new DrawList(),{age:0},'akari',{x:336,y:180});
  assert.equal(reads,1,'the catalog shares GameArt texture ownership and caches lookup');
  assert.throws(()=>catalog.draw(new DrawList(),{},'missing',{x:0,y:0}),RangeError);
  assert.throws(()=>catalog.draw(new DrawList(),{},'akari',{x:NaN,y:0}),TypeError);
});
