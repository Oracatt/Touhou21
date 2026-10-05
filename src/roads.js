/** Finite, authored road score. Times use the road clock, which stops at the
 * midboss; no endless wave interval and no shared three-variant stage loop. */
import {TouhouItemType} from '@ts-stg/thlib/touhou';
import {updateRoadEnemy,ROAD_ATTACKS} from './patterns.js';

const BASE_FRAMES=[3600,4200,4800,5100,5400,3600,4800];
const wave=(at,formation,attack,count=4,side=1,role='scout',options={})=>({at,formation,attack,count,side,role,...options});
const section=(id,title,start,end,waves=[])=>({id,title,start,end,waves});
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};

export const ROAD_SCRIPTS=deepFreeze([
  {stageId:1,theme:'lantern-procession',sections:[
    section('first-lights','点灯：交替掠过的侦察妖精',0,480,[wave(120,'arch','lantern-aim',3,-1),wave(290,'arch','lantern-aim',3,1)]),
    section('paper-wings','灯纸：左右交叉的护灯队',480,970,[wave(500,'swoop','wing-cross',4,-1,'courier'),wave(710,'swoop','wing-cross',4,1,'courier'),wave(875,'anchor','ember-petals',1,1,'guard')]),
    section('wick-pause','换灯芯：收集空隙',970,1120),
    section('lantern-bridge','灯桥：守灯大妖精与小妖精分路',1120,1490,[wave(1120,'stair','lantern-aim',4,-1),wave(1260,'stair','wing-cross',4,1),wave(1370,'anchor','ember-petals',2,-1,'guard',{life:270})]),
    section('midboss-clearing','中场留白',1490,1850),
    section('returning-flames','后半：回旋灯火',1850,2370,[wave(1860,'swoop','wing-cross',5,-1,'courier'),wave(2040,'swoop','wing-cross',5,1,'courier'),wave(2200,'anchor','ember-petals',2,1,'guard')]),
    section('lit-gates','灯门：交叉队与定点狙击互相掩护',2370,2910,[wave(2400,'arch','lantern-aim',5,-1),wave(2530,'anchor','ember-petals',1,1,'guard'),wave(2600,'swoop','wing-cross',5,1),wave(2710,'arch','lantern-aim',3,-1),wave(2780,'stair','lantern-aim',4,1)]),
    section('last-lanterns','末灯：双守卫后退，留出收集时间',2910,3320,[wave(2950,'anchor','ember-petals',2,-1,'guard',{life:280}),wave(3140,'arch','wing-cross',5,1,'scout')]),
    section('boss-approach','灯火渐静',3320,3600),
  ]},
  {stageId:2,theme:'rain-mail',sections:[
    section('first-shower','细雨：竖直邮雨列',0,610,[wave(140,'rain-line','rain-columns',5),wave(350,'rain-line','rain-columns',5,-1)]),
    section('crosswind','横风：快递妖精斜掠投信',610,1180,[wave(640,'swoop','rain-sweep',4,-1,'courier'),wave(825,'swoop','rain-sweep',4,1,'courier'),wave(1020,'anchor','rain-stagger',1,-1,'guard')]),
    section('covered-eaves','屋檐：停顿与道具收集',1180,1350),
    section('unsent-mail','积信：错开落点的两行邮队',1350,1760,[wave(1380,'rain-line','rain-columns',6,-1),wave(1515,'stair','rain-stagger',3,1,'scribe'),wave(1640,'swoop','rain-sweep',4,-1)]),
    section('midboss-eaves','避雨中场',1760,2140),
    section('heavy-shower','后半：纵雨与横风交替',2140,2790,[wave(2160,'rain-line','rain-columns',6),wave(2365,'swoop','rain-sweep',5,1,'courier'),wave(2530,'rain-line','rain-columns',6,-1),wave(2660,'anchor','rain-stagger',2,1,'guard')]),
    section('signed-letters','署名：延迟散射与追踪列分工',2790,3500,[wave(2820,'stair','rain-stagger',3,-1,'scribe'),wave(2980,'swoop','rain-sweep',5,-1),wave(3170,'anchor','rain-stagger',2,-1,'guard'),wave(3360,'rain-line','rain-columns',7,1)]),
    section('last-delivery','末班投递：不对称左右队',3500,3890,[wave(3530,'swoop','rain-sweep',5,1),wave(3710,'stair','rain-stagger',3,-1,'scribe',{life:260})]),
    section('cloud-break','云隙',3890,4200),
  ]},
  {stageId:3,theme:'ferry-waterways',sections:[
    section('reeds','芦苇：顺流曲线队',0,760,[wave(150,'waterway','ferry-current',4,-1),wave(405,'waterway','ferry-current',4,1),wave(615,'wake','wake-chase',3,-1,'courier')]),
    section('crossing-boats','渡船：左右横渡后折向下游',760,1450,[wave(800,'crossing','ferry-cross',4,-1),wave(1010,'crossing','ferry-cross',4,1),wave(1225,'anchor','wake-chase',2,1,'guard')]),
    section('landing','靠岸：收集窗口',1450,1620),
    section('two-currents','分流：两股水路互相穿越',1620,2050,[wave(1650,'waterway','ferry-current',5,1),wave(1800,'wake','wake-chase',4,-1),wave(1940,'crossing','ferry-cross',4,1)]),
    section('midboss-landing','渡口留白',2050,2440),
    section('fast-current','后半：弯流与船尾追波',2440,3190,[wave(2470,'waterway','ferry-current',5,-1),wave(2650,'wake','wake-chase',4,1,'courier'),wave(2840,'waterway','ferry-current',5,1),wave(3015,'anchor','wake-chase',2,-1,'guard')]),
    section('fare-gates','水闸：横渡列与锚点狙击',3190,3970,[wave(3230,'crossing','ferry-cross',5,-1),wave(3410,'crossing','ferry-cross',5,1),wave(3590,'anchor','wake-chase',2,1,'guard'),wave(3780,'waterway','ferry-current',5,-1)]),
    section('far-bank','彼岸：三段船尾波，收束航道',3970,4500,[wave(4020,'wake','wake-chase',4,1),wave(4225,'crossing','ferry-cross',5,-1),wave(4390,'anchor','ferry-current',2,-1,'guard',{life:250})]),
    section('quiet-water','静水',4500,4800),
  ]},
  {stageId:4,theme:'woven-memories',sections:[
    section('warp-threads','经线：横穿的小织工',0,820,[wave(140,'loom','weft-thread',4,-1,'weaver'),wave(370,'loom','weft-thread',4,1,'weaver'),wave(605,'stair','weaver-needle',3,-1,'courier')]),
    section('loose-knots','结点：固定结与游针相间',820,1570,[wave(860,'anchor','memory-knot',2,1,'guard'),wave(1050,'loom','weft-thread',5,-1),wave(1280,'stair','weaver-needle',4,1,'weaver'),wave(1440,'anchor','memory-knot',1,-1,'guard',{life:230})]),
    section('loosened-thread','松线：暂停织网',1570,1750),
    section('cross-stitch','交织：斜针压住横向经线',1750,2170,[wave(1770,'loom','weft-thread',5,1),wave(1920,'stair','weaver-needle',4,-1),wave(2070,'anchor','memory-knot',2,1,'guard',{life:220})]),
    section('midboss-knot','旧结中场',2170,2590),
    section('dense-weft','后半：双向经纬与慢结',2590,3360,[wave(2610,'loom','weft-thread',5,-1),wave(2780,'loom','weft-thread',5,1),wave(2960,'anchor','memory-knot',2,-1,'guard'),wave(3150,'stair','weaver-needle',4,1,'courier')]),
    section('shuttle','梭子：定点预告激光与流动针列',3360,4200,[wave(3400,'anchor','weaver-needle',2,1,'guard'),wave(3590,'loom','weft-thread',5,1),wave(3790,'anchor','memory-knot',2,-1,'guard'),wave(3995,'loom','weft-thread',6,-1)]),
    section('last-stitches','收针：错开的两队，不同时封路',4200,4780,[wave(4250,'stair','weaver-needle',5,1),wave(4460,'loom','weft-thread',5,-1),wave(4650,'anchor','memory-knot',2,1,'guard',{life:220})]),
    section('unwoven-space','空白布边',4780,5100),
  ]},
  {stageId:5,theme:'paper-archive',sections:[
    section('entry-index','目录：分列入场的书库妖精',0,870,[wave(160,'archive','paper-columns',4,-1,'scribe'),wave(400,'archive','paper-columns',4,1,'scribe'),wave(645,'swoop','paper-fold',4,-1,'courier')]),
    section('folded-pages','折页：页角拐弯，朱印守住中心',870,1660,[wave(900,'swoop','paper-fold',5,1),wave(1115,'anchor','seal-corners',2,-1,'guard'),wave(1330,'archive','paper-columns',4,1,'scribe'),wave(1520,'swoop','paper-fold',4,-1)]),
    section('page-turn','翻页：道具整理',1660,1840),
    section('sealed-shelves','封架：异步栏与印章',1840,2310,[wave(1880,'archive','paper-columns',5,-1,'scribe'),wave(2045,'anchor','seal-corners',2,1,'guard'),wave(2190,'swoop','paper-fold',5,1)]),
    section('midboss-bookmark','书签中场',2310,2740),
    section('annotations','后半：纸栏与批注队相互错开',2740,3580,[wave(2770,'archive','paper-columns',5,1,'scribe'),wave(2960,'swoop','paper-fold',5,-1),wave(3150,'anchor','seal-corners',2,-1,'guard'),wave(3360,'archive','paper-columns',5,-1,'scribe')]),
    section('red-seals','朱印：方角封页与曲折纸札',3580,4490,[wave(3620,'anchor','seal-corners',2,1,'guard'),wave(3820,'swoop','paper-fold',6,1),wave(4050,'archive','paper-columns',5,1,'scribe'),wave(4260,'anchor','seal-corners',2,-1,'guard')]),
    section('closing-volume','合卷：交替飞走的巡书队',4490,5080,[wave(4530,'swoop','paper-fold',6,-1),wave(4760,'archive','paper-columns',5,-1,'scribe'),wave(4960,'anchor','seal-corners',2,1,'guard',{life:220})]),
    section('blank-endpaper','空白扉页',5080,5400),
  ]},
  {stageId:6,theme:'naming-bells',sections:[
    section('first-note','初鸣：单音与答铃',0,490,[wave(120,'choir','bell-strike',3,-1,'chorister'),wave(295,'stair','bell-reply',3,1)]),
    section('antiphon','应答：一边奏音，一边延迟复唱',490,990,[wave(520,'choir','bell-strike',4,1,'chorister'),wave(620,'stair','bell-reply',3,1),wave(710,'stair','bell-reply',4,-1),wave(875,'anchor','bell-chorus',1,1,'guard',{life:240})]),
    section('held-breath','换气：明确留白',990,1170),
    section('three-notes','三音：独立音高列',1170,1490,[wave(1180,'choir','bell-strike',4,-1,'chorister'),wave(1320,'stair','bell-reply',4,1),wave(1410,'anchor','bell-chorus',1,-1,'guard',{life:220})]),
    section('midboss-rest','晨钟中场',1490,1850),
    section('morning-chorus','后半：合唱与回声分层',1850,2350,[wave(1880,'choir','bell-strike',5,1,'chorister'),wave(2050,'anchor','bell-chorus',2,-1,'guard'),wave(2200,'stair','bell-reply',5,-1)]),
    section('named-answers','应名：延迟狙击穿过固定音阶',2350,2910,[wave(2390,'choir','bell-strike',5,-1,'chorister'),wave(2540,'stair','bell-reply',5,1),wave(2750,'anchor','bell-chorus',2,1,'guard')]),
    section('last-answer','终答：一次合唱后让出中心',2910,3300,[wave(2950,'stair','bell-reply',4,-1),wave(3050,'anchor','bell-chorus',1,-1,'guard',{life:220}),wave(3140,'choir','bell-strike',5,1,'chorister',{life:220})]),
    section('before-a-name','命名前的安静',3300,3600),
  ]},
  {stageId:7,theme:'old-name-echoes',sections:[
    section('backward-lanterns','旧灯背面：斜回旋而非本篇灯环',0,720,[wave(100,'swoop','echo-reverse',5,-1,'courier'),wave(280,'swoop','echo-reverse',5,1,'courier'),wave(485,'anchor','echo-stencil',2,1,'guard')]),
    section('borrowed-currents','旧渡回声：停顿后反向水路',720,1450,[wave(760,'waterway','echo-reverse',5,1),wave(940,'wake','echo-chase',5,-1),wave(1140,'waterway','echo-reverse',5,-1),wave(1320,'anchor','echo-stencil',2,-1,'guard')]),
    section('return-desk','归还处：收集与整顿',1450,1640),
    section('correction-lines','更正行：错位页栏与回声狙击',1640,2020,[wave(1670,'archive','echo-stencil',5,-1,'scribe'),wave(1805,'stair','echo-chase',5,1),wave(1930,'swoop','echo-reverse',5,1,'scout',{life:220})]),
    section('midboss-silence','封页中场',2020,2440),
    section('echo-canons','后半：错拍三部回声',2440,3170,[wave(2470,'choir','echo-chase',5,-1,'chorister'),wave(2635,'anchor','echo-stencil',2,1,'guard'),wave(2810,'swoop','echo-reverse',6,1),wave(2980,'loom','echo-chase',5,-1)]),
    section('unwritten-margins','页边：静止模板与反向曲列',3170,3930,[wave(3210,'archive','echo-stencil',5,1,'scribe'),wave(3380,'waterway','echo-reverse',6,-1),wave(3580,'anchor','echo-stencil',2,-1,'guard'),wave(3770,'stair','echo-chase',6,1)]),
    section('last-old-names','末名：两轮回声后全体离场',3930,4490,[wave(3980,'loom','echo-chase',6,1),wave(4170,'swoop','echo-reverse',6,-1),wave(4360,'anchor','echo-stencil',2,1,'guard',{life:220})]),
    section('listen','等待有人应答',4490,4800),
  ]},
]);

export const ROAD_ROLES=deepFreeze({
  scout:{script:0,hp:160,life:285,power:1,points:1},courier:{script:5,hp:210,life:260,power:1,points:2},
  weaver:{script:10,hp:220,life:290,power:1,points:2},chorister:{script:15,hp:190,life:285,power:1,points:2},
  scribe:{script:53,directional:false,hp:330,life:300,power:2,points:3},guard:{script:25,hp:780,life:340,power:3,points:5},
});
export const ROAD_FORMATIONS=Object.freeze(['arch','swoop','stair','anchor','rain-line','waterway','wake','crossing','loom','archive','choir']);

export function createRoadPlan(stageId,roadFrames=BASE_FRAMES[stageId-1]){
  const score=ROAD_SCRIPTS[stageId-1];if(!score)throw new RangeError(`Undefined road ${stageId}`);
  const scale=roadFrames/BASE_FRAMES[stageId-1],sections=score.sections.map(s=>({...s,start:Math.round(s.start*scale),end:Math.round(s.end*scale)}));
  const waves=sections.flatMap(s=>s.waves.map((w,index)=>({...w,id:`${stageId}:${s.id}:${index}`,sectionId:s.id,fireUntil:s.end,at:Math.round(w.at*scale)}))).sort((a,b)=>a.at-b.at);
  return{stageId,theme:score.theme,sections,waves,roadFrames};
}

const ease=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
const waypoint=(age,points)=>{
  for(let i=1;i<points.length;i++)if(age<=points[i][0]){const a=points[i-1],b=points[i],t=Math.max(0,(age-a[0])/(b[0]-a[0]));return{x:mix(a[1],b[1],ease(t)),y:mix(a[2],b[2],ease(t))};}
  const p=points.at(-1);return{x:p[1],y:p[2]};
};
function pathGeometry(formation,{index,count,side=1,life=300,jitter=0,rank=1},age){
  const lane=count===1?0:-145+290*index/(count-1),u=index/Math.max(1,count-1),t=Math.max(0,Math.min(1,age/life));
  if(formation==='swoop')return waypoint(age,[[0,side*(225+index*18),24+index*8],[65,side*(115-index*12),70+index*10],[life*.57,-side*80,155+index*7],[life,-side*242,225+index*9]]);
  if(formation==='crossing'||formation==='loom')return{x:side*(225-470*t),y:(formation==='loom'?48:88)+index*24+Math.sin(t*Math.PI)* (formation==='loom'?65:25)};
  if(formation==='waterway')return{x:side*(120*Math.sin(t*Math.PI*1.6)+index*13-25)+jitter,y:-25+520*t};
  if(formation==='wake')return waypoint(age,[[0,side*(205+index*22),-12],[80,side*(105-index*14),100+index*12],[life*.6,side*40,185+index*14],[life,-side*235,315+index*8]]);
  if(formation==='anchor')return waypoint(age,[[0,lane*.62,-35-index*16],[70,lane*.62,78+index*12],[life*.7,lane*.62,92+index*14],[life,side*242,18+index*17]]);
  if(formation==='archive')return waypoint(age,[[0,lane,-28-index*10],[65+index*5,lane,65+(index%2)*32],[life*.64,lane+(rank>=2?(index%2?24:-24):0),100+(index%2)*32],[life,side*(240+index*12),185+index*6]]);
  if(formation==='choir')return{x:lane+Math.sin(t*Math.PI)*side*36,y:-25+360*t+Math.max(0,t-.65)*380+28*Math.sin(u*Math.PI)};
  if(formation==='rain-line')return{x:lane+jitter+(rank>=2?Math.sin(t*Math.PI*2+index)*18:0),y:-26-index*12+620*t};
  if(formation==='stair')return waypoint(age,[[0,side*(200+index*22),-16-index*14],[70+index*7,side*(130-index*50),74+index*24],[life*.65,-side*(110-index*45),145+index*18],[life,-side*238,220+index*14]]);
  if(formation==='arch')return{x:lane+jitter+side*42*Math.sin(t*Math.PI),y:-28-index*10+550*t-38*Math.sin(t*Math.PI)};
  throw new RangeError(`Undefined road path ${formation}`);
}
export function roadPath(formation,options,age){const p=pathGeometry(formation,{...options,jitter:0},age);return{x:p.x+(options.jitter??0),y:p.y};}

/** Every body is the public Enemy prefab. Routes author positions, and public
 * Enemy still owns health, contacts, directional ANM, death and offscreen exit. */
export function spawnRoadFormation({game,wave:spec,stageId,difficulty=1,rng,isActive=()=>true,canFire=()=>true,onAttack}){
  if(!ROAD_ROLES[spec.role]||!ROAD_FORMATIONS.includes(spec.formation)||!ROAD_ATTACKS.includes(spec.attack))throw new TypeError('Road wave requires an authored role, formation and attack');
  const rank=Math.min(3,difficulty),role=ROAD_ROLES[spec.role];
  const count=Math.max(1,spec.count+(rank===0&&spec.count>3?-1:rank>=2&&spec.count>2?1:0)),actors=[];
  for(let index=0;index<count;index++){
    const state={age:0,aim:null},life=spec.life??role.life,jitter=(rng.unit()-.5)*12,delay=index*(spec.formation==='anchor'?0:7);
    const pathOptions={index,count,side:spec.side,life,jitter,rank},initial=roadPath(spec.formation,pathOptions,0);
    const enemy=game.spawnEnemy({x:initial.x,y:initial.y,hp:Math.round(role.hp*(.82+rank*.12)),script:role.script,directional:role.directional??true,
      deathBank:game.banks.effect,drop:[],damageInvulnerability:0,
      onUpdate:actor=>{
        if(!isActive())return;const age=state.age++,position=roadPath(spec.formation,pathOptions,Math.max(0,age-delay));
        // Feed the next route point to public Motion, so public Enemy sees
        // the actual displacement and selects its directional animation.
        const dx=position.x-actor.x,dy=position.y-actor.y;
        actor.motion.flags=0;actor.motion.speed=Math.fround(Math.hypot(dx,dy));actor.motion.angle=Math.fround(Math.atan2(dy,dx));
        if(canFire()&&age>=delay&&actor.y>=12&&actor.y<=248&&Math.abs(actor.x)<=184)
          updateRoadEnemy({game,enemy:actor,frame:age-delay,difficulty,stageId,attack:spec.attack,state,index,count,side:spec.side,onAttack});
        if(age>=life+delay){actor.alive=false;actor.animation.destroy();}
      },
      onDefeat:actor=>game.items.spawnEnemyDrops(actor,{counts:{[TouhouItemType.POWER]:role.power,[TouhouItemType.POINT]:role.points},radius:18}),
    });
    enemy.kind=spec.role==='guard'?'large-fairy':'fairy';enemy.stageId=stageId;
    enemy.roadWaveId=spec.id;enemy.roadRole=spec.role;enemy.roadAttack=spec.attack;enemy.roadFormation=spec.formation;
    actors.push(enemy);
  }return actors;
}
