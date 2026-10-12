import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TouhouGame,createTouhouResources} from '@ts-stg/thlib/touhou';
import {AttackKit,C} from '../dist/src/danmaku.js';
import {SHINO} from '../dist/src/attacks/shino.js';
import {KOTONE} from '../dist/src/attacks/kotone.js';
import {updateRoadEnemy} from '../dist/src/roads.js';

function fixture(){
  const resources=createTouhouResources({readText:file=>fs.readFileSync(file,'utf8'),loadTexture:()=>11});
  const game=new TouhouGame({banks:resources.banks,font:resources.font,sht:resources.shots[0],styles:resources.styles,seed:73});
  const bind=frame=>new AttackKit().bind({game,boss:{x:0,y:112},frame,state:{},difficulty:1});
  return{game,bind,dispose(){game.destroy();resources.dispose();}};
}

// Expected RGB comes from the colored fragment scripts in the real bullet ANM,
// independent of the laser owner's choice of cancellation script.
const authored=[
  {name:'Shino second nonspell',attack:SHINO.nonspells[1],frame:0,count:2,color:C.MAGENTA,rgb:0x800880},
  {name:'Shino first spell',attack:SHINO.spells[0],frame:0,count:4,color:C.MAGENTA,rgb:0x800880},
  {name:'Shino third spell',attack:SHINO.spells[2],frame:0,count:8,color:C.PALE,rgb:0xffff08},
  {name:'Kotone fourth spell',attack:KOTONE.spells[3],frame:0,count:2,color:C.YELLOW,rgb:0xc0c008},
  {name:'stage-four road guard',frame:56,count:4,color:C.MAGENTA,rgb:0x800880,
    attack:k=>updateRoadEnemy({game:k.game,enemy:{id:1,x:0,y:112},frame:k.frame,state:k.state,difficulty:1,stageId:4,attack:'motif'})},
];
const fragments=vm=>[...(vm.visible&&vm.spriteIndex>=540&&vm.spriteIndex<=547?[vm]:[]),...vm.children.flatMap(fragments)];

for(const scenario of authored)for(const method of ['erase','circle','rectangle'])
  test(`${scenario.name} keeps its laser color in ${method} cancellation fragments`,()=>{
    const f=fixture();try{
      scenario.attack(f.bind(scenario.frame));
      const beams=f.game.lasers.lasers.slice();assert.equal(beams.length,scenario.count);
      assert.ok(beams.every(l=>l.p.color===scenario.color));
      for(let frame=0;frame<80;frame++)f.game.lasers.update(null,f.game.context);
      assert.ok(beams.every(l=>l.alive&&l.animation.spriteIndex===scenario.color),'The real laser body uses its authored palette color');
      if(method==='erase')for(const laser of beams)f.game.lasers.erase(laser,{check:false});
      else if(method==='circle')f.game.lasers.cancelCircle(0,224,2048,{check:false});
      else f.game.lasers.cancelRectangle(0,224,4096,4096,0,{check:false});
      const effects=f.game.lasers.effects.slice();assert.ok(effects.length>0,'Cancellation creates real ANM effects');
      for(const effect of effects){
        // Parent scripts wait a random few frames before creating their fragments.
        for(let frame=0;frame<16;frame++)effect.update();
        const visible=fragments(effect);assert.ok(visible.length>0,'Cancellation reaches visible fragment sprites');
        assert.ok(visible.every(vm=>vm.color>>>8===scenario.rgb),
          `Expected ${scenario.rgb.toString(16)} fragments, got ${visible.map(vm=>(vm.color>>>8).toString(16)).join(',')}`);
      }
    }finally{f.dispose();}
  });
