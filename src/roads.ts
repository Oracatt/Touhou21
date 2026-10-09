/** Authored road scores. Times use the road clock, which stops at the midboss.
 * Each stage opens gently, builds toward its midboss, then climbs through a
 * harder second half to a climax and a short quiet approach to the Boss. */
import {TouhouItemType} from '@ts-stg/thlib/touhou';
import type {TouhouGame,TouhouEnemy,TouhouRNG} from '@ts-stg/thlib/touhou';
import type {AttackGame,AttackKit,AttackState} from './danmaku.js';
import type {CampaignEnemy} from './shared-types.js';

export interface RoadWaveSpec {at:number;formation:string;attack:string;count:number;side:number;role:string;life?:number;gap?:number;}
export interface RoadWave extends RoadWaveSpec {id:string;sectionId:string;fireUntil:number;}
export interface RoadSection {id:string;title:string;start:number;end:number;waves:RoadWaveSpec[];}
export interface RoadScript {stageId:number;theme:string;sections:RoadSection[];}
export interface RoadAttackEvent {attack:string;mechanism:string;enemyId:number;stageId:number;age:number;count:number;lasers:number;}
export type RoadGame = AttackGame & Pick<TouhouGame,'spawnEnemy'|'banks'|'items'>;
interface RoadPathOptions {index:number;count:number;side?:number;life?:number;jitter?:number;rank?:number;}
interface RoadRole {script:number;hp:number;life:number;power:number;points:number;directional?:boolean;}
interface RoadEnemyOptions {game:AttackGame;enemy:TouhouEnemy;frame:number;difficulty?:number;stageId?:number;attack:string;state?:AttackState;index?:number;side?:number;rng?:TouhouRNG|null;onAttack?:(event:RoadAttackEvent)=>void;}
interface RoadFormationOptions {game:RoadGame;wave:RoadWave;stageId:number;difficulty?:number;rng:TouhouRNG;isActive?:()=>boolean;canFire?:()=>boolean;onAttack?:(event:RoadAttackEvent)=>void;}
import {kit,T,C,C8,DOWN,TAU,clamp,lerp} from './danmaku.js';
import {polygon,inGap,burstShape} from './attacks/shapes.js';

const BASE_FRAMES=[3900,4500,4800,5100,5400,3900,5100];
export const ROAD_MIDBOSS_FRAMES=Object.freeze([1680,1980,2160,2280,2400,1680,2280]);
const W=(at:number,formation:string,attack:string,count=4,side=1,role='scout',options:Pick<RoadWaveSpec,'life'|'gap'>={}):RoadWaveSpec=>({at,formation,attack,count,side,role,...options});
const section=(id:string,title:string,start:number,end:number,waves:RoadWaveSpec[]=[]):RoadSection=>({id,title,start,end,waves});
const deepFreeze=<T,>(value:T):T=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};

export const ROAD_SCRIPTS:RoadScript[]=deepFreeze([
  {stageId:1,theme:'lantern-procession',sections:[
    section('first-lights','点灯：两侧依次掠过的提灯妖精',0,560,[W(90,'arch','aim',4,-1),W(200,'arch','aim',4,1),W(320,'swoop','stream',5,-1,'courier'),W(440,'swoop','stream',5,1,'courier')]),
    section('lantern-rows','灯列：悬停扇射与第一只守灯大妖精',560,1080,[W(570,'drop','fan',5,1),W(700,'stair','aim',4,-1),W(780,'stair','aim',4,1),W(880,'anchor','motif',1,1,'guard',{life:420}),W(950,'arch','spray',5,-1)]),
    section('lantern-bridge','灯桥：交替流射，环形灯花',1080,1560,[W(1090,'swoop','stream',6,1,'courier'),W(1200,'swoop','stream',6,-1,'courier'),W(1320,'drop','ring',4,1),W(1430,'arch','aim',6,-1)]),
    section('midboss-clearing','途中：扉灯祈',1560,1800),
    section('returning-flames','后半：回旋灯火与花形大妖精',1800,2500,[W(1810,'arch','aim',6,1),W(1900,'swoop','stream',6,-1,'courier'),W(2000,'anchor','flower',2,1,'guard',{life:380}),W(2140,'stair','fan',5,1),W(2240,'stair','fan',5,-1),W(2360,'drop','ring',5,-1)]),
    section('lit-gates','灯门：门框大妖精与流射妖精互相掩护',2500,3200,[W(2510,'anchor','motif',1,-1,'guard',{life:400}),W(2560,'arch','spray',6,1),W(2680,'swoop','stream',7,1,'courier'),W(2800,'swoop','stream',7,-1,'courier'),W(2920,'drop','fan',6,1),W(3030,'arch','aim',7,-1)]),
    section('last-lanterns','末灯：双大妖精环射收尾',3200,3600,[W(3210,'anchor','rings',2,1,'guard',{life:320}),W(3300,'stair','stream',5,-1),W(3400,'stair','stream',5,1)]),
    section('boss-approach','灯火渐静',3600,3900),
  ]},
  {stageId:2,theme:'rain-mail',sections:[
    section('first-shower','细雨：竖列妖精洒下针雨',0,640,[W(90,'rain-line','spray',5,1),W(230,'rain-line','spray',5,-1),W(380,'swoop','aim',5,-1,'courier'),W(500,'swoop','aim',5,1,'courier')]),
    section('crosswind','横风：投信快递与第一只雨伞大妖精',640,1260,[W(650,'stair','stack',4,1),W(760,'stair','stack',4,-1),W(880,'anchor','motif',1,-1,'guard',{life:420}),W(960,'rain-line','spray',6,1),W(1100,'drop','fan',5,-1)]),
    section('unsent-mail','积信：错开的两行邮队',1260,1860,[W(1270,'swoop','stream',6,1,'courier'),W(1380,'swoop','stream',6,-1,'courier'),W(1500,'rain-line','spray',6,-1),W(1620,'drop','ring',5,1),W(1740,'stair','aim',5,-1)]),
    section('midboss-eaves','途中：雨巻静织',1860,2100),
    section('heavy-shower','后半：纵雨与横风交替',2100,2900,[W(2110,'rain-line','spray',7,1),W(2200,'swoop','aim',6,1,'courier'),W(2320,'anchor','flower',2,1,'guard',{life:380}),W(2460,'rain-line','spray',7,-1),W(2580,'stair','stack',5,1),W(2700,'swoop','stream',6,-1,'courier')]),
    section('signed-letters','署名：雨伞大妖精与投信流射',2900,3700,[W(2910,'anchor','motif',1,1,'guard',{life:420}),W(2980,'drop','fan',6,-1),W(3120,'swoop','stream',7,1,'courier'),W(3240,'swoop','stream',7,-1,'courier'),W(3380,'rain-line','spray',8,1),W(3520,'stair','aim',6,-1)]),
    section('last-delivery','末班投递：双大妖精环信',3700,4200,[W(3710,'anchor','rings',2,-1,'guard',{life:340}),W(3820,'drop','fan',5,1),W(3950,'swoop','stream',6,1,'courier')]),
    section('cloud-break','云隙',4200,4500),
  ]},
  {stageId:3,theme:'ferry-waterways',sections:[
    section('reeds','芦苇：顺流蛇行的水路妖精',0,700,[W(100,'waterway','aim',5,-1),W(260,'waterway','aim',5,1),W(420,'crossing','side',5,-1,'courier'),W(560,'crossing','side',5,1,'courier')]),
    section('crossing-boats','渡船：横渡队与第一只回航大妖精',700,1400,[W(710,'wake','stream',5,-1),W(830,'wake','stream',5,1),W(960,'anchor','motif',1,1,'guard',{life:420}),W(1040,'drop','ring',5,-1),W(1200,'crossing','side',6,1,'courier')]),
    section('two-currents','分流：两股水路互相穿越',1400,2040,[W(1410,'waterway','fan',6,1),W(1540,'waterway','fan',6,-1),W(1680,'wake','stream',6,1),W(1820,'drop','aim',5,-1),W(1920,'crossing','side',6,-1,'courier')]),
    section('midboss-landing','途中：渡守澪舟',2040,2280),
    section('fast-current','后半：船尾追波与花形大妖精',2280,3060,[W(2290,'waterway','aim',7,-1),W(2400,'wake','stream',6,1,'courier'),W(2520,'anchor','flower',2,-1,'guard',{life:380}),W(2660,'crossing','side',7,1,'courier'),W(2800,'drop','ring',6,1),W(2920,'waterway','fan',7,1)]),
    section('fare-gates','水闸：回航大妖精与横渡锚点',3060,3900,[W(3070,'anchor','motif',1,-1,'guard',{life:420}),W(3150,'crossing','side',7,-1,'courier'),W(3300,'wake','stream',7,1),W(3440,'wake','stream',7,-1),W(3580,'drop','fan',6,1),W(3720,'waterway','aim',8,-1)]),
    section('far-bank','彼岸：双大妖精涟漪',3900,4500,[W(3910,'anchor','rings',2,1,'guard',{life:360}),W(4030,'crossing','side',6,1,'courier'),W(4180,'wake','stream',6,-1)]),
    section('quiet-water','静水',4500,4800),
  ]},
  {stageId:4,theme:'woven-memories',sections:[
    section('warp-threads','经线：横穿的小织工',0,760,[W(100,'loom','side',5,-1,'weaver'),W(250,'loom','side',5,1,'weaver'),W(420,'stair','aim',5,-1),W(560,'stair','aim',5,1)]),
    section('loose-knots','结点：丝网大妖精与游针',760,1480,[W(770,'drop','ring',5,1,'weaver'),W(900,'anchor','motif',1,-1,'guard',{life:430}),W(990,'loom','side',6,1,'weaver'),W(1140,'swoop','stream',6,-1,'courier'),W(1300,'drop','fan',5,1)]),
    section('cross-stitch','交织：斜针压住横向经线',1480,2160,[W(1490,'loom','side',6,-1,'weaver'),W(1620,'stair','stack',5,1),W(1760,'loom','side',6,1,'weaver'),W(1900,'drop','ring',6,-1,'weaver'),W(2030,'swoop','stream',6,1,'courier')]),
    section('midboss-knot','途中：糸守紫乃',2160,2400),
    section('dense-weft','后半：双向经纬与花形大妖精',2400,3200,[W(2410,'loom','side',7,1,'weaver'),W(2520,'loom','side',7,-1,'weaver'),W(2640,'anchor','flower',2,1,'guard',{life:400}),W(2800,'stair','aim',6,-1),W(2940,'drop','fan',6,1),W(3060,'swoop','stream',7,-1,'courier')]),
    section('shuttle','梭子：丝网大妖精与流动针列',3200,4100,[W(3210,'anchor','motif',1,1,'guard',{life:430}),W(3290,'loom','side',7,-1,'weaver'),W(3440,'stair','stack',6,1),W(3590,'swoop','stream',7,1,'courier'),W(3740,'drop','ring',7,-1,'weaver'),W(3900,'loom','side',8,1,'weaver')]),
    section('last-stitches','收针：双大妖精环射',4100,4800,[W(4110,'anchor','rings',2,-1,'guard',{life:360}),W(4230,'stair','stream',6,1),W(4380,'stair','stream',6,-1),W(4520,'loom','side',7,1,'weaver')]),
    section('unwoven-space','空白布边',4800,5100),
  ]},
  {stageId:5,theme:'paper-archive',sections:[
    section('entry-index','目录：分栏入场的书库妖精',0,800,[W(100,'archive','fan',5,-1,'scribe'),W(260,'archive','fan',5,1,'scribe'),W(430,'swoop','aim',5,-1,'courier'),W(580,'swoop','aim',5,1,'courier')]),
    section('folded-pages','折页：书页大妖精与朱印守卫',800,1560,[W(810,'stair','stack',5,1),W(940,'anchor','motif',1,1,'guard',{life:430}),W(1020,'archive','fan',6,-1,'scribe'),W(1180,'swoop','stream',6,1,'courier'),W(1340,'drop','ring',5,-1)]),
    section('sealed-shelves','封架：异步书栏与印章',1560,2280,[W(1570,'archive','fan',6,1,'scribe'),W(1720,'stair','aim',6,-1),W(1860,'archive','fan',6,-1,'scribe'),W(2000,'drop','ring',6,1),W(2140,'swoop','stream',6,-1,'courier')]),
    section('midboss-bookmark','途中：御影房枝',2280,2520),
    section('annotations','后半：批注队与花形大妖精',2520,3360,[W(2530,'archive','fan',7,1,'scribe'),W(2650,'swoop','stream',7,-1,'courier'),W(2780,'anchor','flower',2,-1,'guard',{life:400}),W(2940,'stair','stack',6,1),W(3080,'drop','ring',6,-1),W(3220,'archive','fan',7,-1,'scribe')]),
    section('red-seals','朱印：书页大妖精与曲折纸札',3360,4300,[W(3370,'anchor','motif',1,-1,'guard',{life:430}),W(3450,'swoop','stream',7,1,'courier'),W(3600,'archive','fan',7,1,'scribe'),W(3760,'stair','aim',7,-1),W(3920,'drop','fan',7,1),W(4080,'swoop','stream',8,-1,'courier')]),
    section('closing-volume','合卷：双大妖精环射',4300,5100,[W(4310,'anchor','rings',2,1,'guard',{life:380}),W(4440,'archive','fan',7,-1,'scribe'),W(4600,'stair','stream',6,1),W(4760,'stair','stream',6,-1)]),
    section('blank-endpaper','空白扉页',5100,5400),
  ]},
  {stageId:6,theme:'naming-bells',sections:[
    section('first-note','初鸣：合唱妖精的铃环',0,520,[W(90,'choir','ring',4,-1,'chorister'),W(220,'choir','ring',4,1,'chorister'),W(360,'stair','stream',5,-1),W(460,'stair','stream',5,1)]),
    section('antiphon','应答：铃声大妖精与答铃流射',520,1080,[W(530,'drop','aim',5,1,'chorister'),W(650,'anchor','motif',1,-1,'guard',{life:420}),W(720,'choir','ring',5,1,'chorister'),W(860,'swoop','stream',6,-1,'courier'),W(980,'drop','fan',5,1)]),
    section('three-notes','三音：独立音高列',1080,1560,[W(1090,'choir','ring',6,-1,'chorister'),W(1210,'stair','stack',5,1),W(1330,'choir','ring',6,1,'chorister'),W(1450,'swoop','stream',6,-1,'courier')]),
    section('midboss-rest','途中：白识言音',1560,1800),
    section('morning-chorus','后半：合唱与花形大妖精',1800,2500,[W(1810,'choir','ring',6,1,'chorister'),W(1910,'anchor','flower',2,-1,'guard',{life:380}),W(2060,'stair','aim',6,1),W(2180,'drop','fan',6,-1,'chorister'),W(2320,'swoop','stream',7,1,'courier')]),
    section('named-answers','应名：铃声大妖精与新答句',2500,3200,[W(2510,'anchor','motif',1,1,'guard',{life:420}),W(2580,'choir','ring',7,-1,'chorister'),W(2720,'swoop','stream',7,-1,'courier'),W(2860,'drop','ring',6,1,'chorister'),W(3000,'stair','stack',6,-1)]),
    section('last-answer','终答：双大妖精合唱',3200,3600,[W(3210,'anchor','rings',2,-1,'guard',{life:320}),W(3320,'choir','ring',6,1,'chorister'),W(3420,'stair','stream',5,1)]),
    section('before-a-name','命名前的安静',3600,3900),
  ]},
  {stageId:7,theme:'old-name-echoes',sections:[
    section('backward-lanterns','旧灯背面：回声流射',0,720,[W(80,'swoop','stream',6,-1,'courier'),W(200,'swoop','stream',6,1,'courier'),W(330,'arch','echo',6,-1),W(460,'arch','echo',6,1),W(590,'drop','ring',5,1)]),
    section('borrowed-currents','旧渡回声：回声大妖精与反向水路',720,1440,[W(730,'anchor','motif',1,1,'guard',{life:430}),W(800,'waterway','echo',6,-1),W(950,'crossing','side',7,1,'courier'),W(1100,'waterway','echo',6,1),W(1250,'drop','fan',6,-1)]),
    section('correction-lines','更正行：错位页栏与回声狙击',1440,2160,[W(1450,'archive','fan',7,-1,'scribe'),W(1590,'stair','stream',7,1),W(1730,'loom','side',7,-1,'weaver'),W(1880,'drop','ring',7,1),W(2020,'swoop','stream',7,-1,'courier')]),
    section('midboss-silence','途中：御影房枝',2160,2400),
    section('echo-canons','后半：错拍三部回声',2400,3200,[W(2410,'choir','ring',7,-1,'chorister'),W(2520,'anchor','flower',2,1,'guard',{life:400}),W(2680,'swoop','echo',7,1),W(2820,'loom','side',8,-1,'weaver'),W(2960,'drop','fan',7,1),W(3080,'swoop','stream',8,-1,'courier')]),
    section('unwritten-margins','页边：回声大妖精与反向曲列',3200,4100,[W(3210,'anchor','motif',1,-1,'guard',{life:430}),W(3290,'archive','fan',8,1,'scribe'),W(3440,'waterway','echo',7,-1),W(3590,'stair','stream',8,1),W(3740,'drop','ring',8,-1),W(3900,'crossing','side',8,1,'courier')]),
    section('last-old-names','末名：双大妖精与全体回声',4100,4800,[W(4110,'anchor','rings',2,1,'guard',{life:380}),W(4230,'swoop','echo',8,-1),W(4380,'swoop','echo',8,1),W(4530,'choir','ring',7,-1,'chorister')]),
    section('listen','等待有人应答',4800,5100),
  ]},
]);

export const ROAD_ROLES:Record<string,RoadRole>=deepFreeze({
  scout:{script:0,hp:120,life:300,power:1,points:1},courier:{script:5,hp:140,life:280,power:1,points:2},
  weaver:{script:10,hp:150,life:300,power:1,points:2},chorister:{script:15,hp:140,life:300,power:1,points:2},
  scribe:{script:53,directional:false,hp:260,life:320,power:2,points:3},guard:{script:25,hp:1500,life:380,power:4,points:6},
});
export const ROAD_FORMATIONS=Object.freeze(['arch','swoop','stair','anchor','drop','rain-line','waterway','wake','crossing','loom','archive','choir']);
export const ROAD_ATTACKS=Object.freeze(['aim','stack','stream','spray','fan','ring','side','echo','flower','rings','motif']);

export function createRoadPlan(stageId:number,roadFrames=BASE_FRAMES[stageId-1]){
  const score=ROAD_SCRIPTS[stageId-1];if(!score)throw new RangeError(`Undefined road ${stageId}`);
  const scale=roadFrames/BASE_FRAMES[stageId-1],sections=score.sections.map(s=>({...s,start:Math.round(s.start*scale),end:Math.round(s.end*scale)}));
  const waves=sections.flatMap(s=>s.waves.map((w,index)=>({...w,id:`${stageId}:${s.id}:${index}`,sectionId:s.id,fireUntil:s.end,at:Math.round(w.at*scale)}))).sort((a,b)=>a.at-b.at);
  return{stageId,theme:score.theme,sections,waves,roadFrames,midbossAt:Math.round(ROAD_MIDBOSS_FRAMES[stageId-1]*scale)};
}

const ease=(t:number)=>t*t*(3-2*t),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const waypoint=(age:number,points:number[][])=>{
  for(let i=1;i<points.length;i++)if(age<=points[i][0]){const a=points[i-1],b=points[i],t=Math.max(0,(age-a[0])/(b[0]-a[0]));return{x:mix(a[1],b[1],ease(t)),y:mix(a[2],b[2],ease(t))};}
  const p=points.at(-1)!;return{x:p[1],y:p[2]};
};
function pathGeometry(formation:string,{index,count,side=1,life=300,jitter=0,rank=1}:RoadPathOptions,age:number){
  const lane=count===1?0:-145+290*index/(count-1),u=index/Math.max(1,count-1),t=Math.max(0,Math.min(1,age/life));
  if(formation==='swoop')return waypoint(age,[[0,side*(225+index*18),24+index*8],[65,side*(115-index*12),70+index*10],[life*.57,-side*80,155+index*7],[life,-side*242,225+index*9]]);
  if(formation==='crossing'||formation==='loom')return{x:side*(225-470*t),y:(formation==='loom'?48:88)+index*24+Math.sin(t*Math.PI)*(formation==='loom'?65:25)};
  if(formation==='waterway')return{x:side*(120*Math.sin(t*Math.PI*1.6)+index*13-25)+jitter,y:-25+520*t};
  if(formation==='wake')return waypoint(age,[[0,side*(205+index*22),-12],[80,side*(105-index*14),100+index*12],[life*.6,side*40,185+index*14],[life,-side*235,315+index*8]]);
  if(formation==='anchor')return waypoint(age,[[0,lane*.62,-35-index*16],[70,lane*.62,78+index*12],[life*.7,lane*.62,92+index*14],[life,side*242,18+index*17]]);
  if(formation==='drop')return waypoint(age,[[0,lane*.82,-30],[58,lane*.82,64+(index%2)*30],[life-64,lane*.82+side*16,74+(index%2)*30],[life,lane*.82+side*44,-44]]);
  if(formation==='archive')return waypoint(age,[[0,lane,-28-index*10],[65+index*5,lane,65+(index%2)*32],[life*.64,lane+(rank>=2?(index%2?24:-24):0),100+(index%2)*32],[life,side*(240+index*12),185+index*6]]);
  if(formation==='choir')return{x:lane+Math.sin(t*Math.PI)*side*36,y:-25+360*t+Math.max(0,t-.65)*380+28*Math.sin(u*Math.PI)};
  if(formation==='rain-line')return{x:lane+jitter+(rank>=2?Math.sin(t*Math.PI*2+index)*18:0),y:-26-index*12+620*t};
  if(formation==='stair')return waypoint(age,[[0,side*(200+index*22),-16-index*14],[70+index*7,side*(130-index*50),74+index*24],[life*.65,-side*(110-index*45),145+index*18],[life,-side*238,220+index*14]]);
  if(formation==='arch')return{x:lane+jitter+side*42*Math.sin(t*Math.PI),y:-28-index*10+550*t-38*Math.sin(t*Math.PI)};
  throw new RangeError(`Undefined road path ${formation}`);
}
export function roadPath(formation:string,options:RoadPathOptions,age:number){const p=pathGeometry(formation,{...options,jitter:0},age);return{x:p.x+(options.jitter??0),y:p.y};}

/** Stage palettes: [small type, main colour, second colour, accent]. */
const PALETTES=[
  {type:T.BALL,main:C.ORANGE,alt:C.RED,accent:C.YELLOW,needle:T.RICE},
  {type:T.NEEDLE,main:C.SKY,alt:C.AZURE,accent:C.WHITE,needle:T.AMULET},
  {type:T.SCALE,main:C.CYAN,alt:C.GREEN,accent:C.MINT,needle:T.RICE},
  {type:T.BALL,main:C.MAGENTA,alt:C.PINK,accent:C.PALE,needle:T.NEEDLE},
  {type:T.AMULET,main:C.GREEN,alt:C.RED,accent:C.PALE,needle:T.AMULET},
  {type:T.BALL,main:C.YELLOW,alt:C.WHITE,accent:C.MINT,needle:T.STAR},
  {type:T.SCALE,main:C.BLUE,alt:C.ROSE,accent:C.WHITE,needle:T.RICE},
];

/** The guard's signature attack quotes its stage Boss's motif. */
function signature(k:AttackKit,stageId:number,p:typeof PALETTES[number],age:number,state:AttackState){
  const s=stageId,period=k.pick(64,52,44,38);
  if(s===7&&state.echo?.at===age){const e=state.echo;k.ring(e.x,e.y,24,1.9,e.a+Math.PI/24,T.SCALE,C.ROSE);state.echo=null;}
  if(age<56||(age-56)%period)return;
  const wave=(age-56)/period|0;
  if(s===1){const door=k.aim(),half=k.pick(.36,.29,.25,.22);
    burstShape(k,k.ox,k.oy,polygon(4,k.pick(7,9,11,13)),1.5,wave*.37,T.AMULET,wave%2?C.RED:C.ORANGE,null,{skip:(q,a)=>inGap(a,door,half)});}
  else if(s===2){const letters=k.aimed(k.ox,k.oy,3,2.8,.34,T.AMULET,C.WHITE,[k.hold(40),k.wait(18),k.vanish()]);
    k.later(54,letters,b=>k.ring(b.x,b.y,k.pick(6,8,10,12),1.5,k.unit()*TAU,T.BALL,C.AZURE,null,{silent:true}));
    k.fan(k.ox,k.oy,k.pick(5,7,9,11),2.2,DOWN,.2,T.NEEDLE,C.SKY);}
  else if(s===3)k.ring(k.ox,k.oy,k.pick(14,18,24,28),2.9,wave*.21,T.OVAL,wave%2?C8.CYAN:C8.GREEN,[k.stopTurn(48,Math.PI,1.5)]);
  else if(s===4){if(wave%3===0)for(let j=0;j<4;j++)k.beam(k.ox,k.oy,wave*.4+j*Math.PI/2+Math.PI/4,{width:8,delay:60,sustain:50,color:C.MAGENTA,sound:j?-1:18});
    k.ring(k.ox,k.oy,k.pick(14,20,24,28),1.5,k.unit()*TAU,T.BALL,C.PINK);}
  else if(s===5){const n=k.pick(9,11,13,15),blank=(n>>1)+((wave%3)-1);
    for(let i=0;i<n;i++)if(Math.abs(i-blank)>1)k.shot(k.ox+(i-(n-1)/2)*22,k.oy+10,DOWN,1.8,T.AMULET,wave%2?C.PALE:C.GREEN,null,{silent:i>0});
    if(k.rank>=1)k.aimed(k.ox,k.oy,1,1.6,0,T.BIG,C8.RED);}
  else if(s===6)k.ringGap(k.ox,k.oy,k.pick(14,18,22,26),2.2,T.BALL,C.YELLOW,null,{rows:k.pick(2,2,3,3),speedStep:1.5});
  else{const a=k.unit()*TAU,x=k.ox,y=k.oy;k.ring(x,y,24,2.2,a,T.SCALE,C.BLUE);
    state.echo={at:age+14,x:-x,y,a};}
}

/** Fairy attacks are authored by role and age; Hard and Lunatic add layers
 * and density, Easy removes companions. Fire only from the upper field. */
function fairyAttack(k:AttackKit,attack:string,{stageId,side,index,state}:{stageId:number;side:number;index:number;state:AttackState}){
  const p=PALETTES[stageId-1],age=k.t;
  switch(attack){
    case 'aim':{const period=k.pick(72,56,48,42);
      if(age>=28&&(age-28)%period===0)k.aimed(k.ox,k.oy,k.pick(1,1,3,3),2.6,.2,p.type,p.main,null,{rows:k.pick(1,2,2,3),speedStep:1.9,safe:4096});break;}
    case 'stack':if(age===36||age===96||(k.rank>=2&&age===150))k.aimed(k.ox,k.oy,k.pick(1,1,3,3),3.1,.16,p.needle,p.alt,null,{rows:k.pick(3,4,5,6),speedStep:1.8,safe:4096});break;
    case 'stream':if(age>=26&&age<26+k.pick(30,42,48,54)&&(age-26)%k.pick(10,7,6,5)===0)k.aimed(k.ox,k.oy,1,3,0,p.type,p.main,null,{safe:4096});break;
    case 'spray':if(age>=10&&age%k.pick(14,10,8,6)===0)k.shot(k.ox,k.oy,DOWN+(k.unit()-.5)*1.1,lerp(1.8,2.6,k.unit()),p.type,p.main,null,{safe:4096,silent:age%28!==0});break;
    case 'fan':if(age===40||age===100||(k.rank>=2&&age===160))k.fan(k.ox,k.oy,k.pick(5,7,9,11),2.2,DOWN+(index%2?.08:-.08),.22,p.type,p.alt,null,{safe:4096,rows:k.rank===3?2:1,speedStep:1.6});break;
    case 'ring':if(age===48||(k.rank>=1&&age===120)||(k.rank>=3&&age===180))k.ringGap(k.ox,k.oy,k.pick(8,12,16,20),1.8,p.type,p.accent,null,{safe:4096});break;
    case 'side':if(age>=20&&age%k.pick(26,20,17,15)===0)k.fan(k.ox,k.oy,k.pick(1,2,2,3),2.3,DOWN-side*.45,.3,p.needle,p.main,null,{safe:4096});break;
    case 'echo':if(age===34||age===94){const aim=k.aim();k.fan(k.ox,k.oy,3,2.8,aim,.16,p.type,p.main,null,{safe:4096});state.echoAim=aim;}
      if(age===52||age===112)k.fan(k.ox,k.oy,3,2.5,state.echoAim??DOWN,.16,p.type,p.alt,null,{safe:4096});break;
    case 'flower':if(age>=60&&age%k.pick(7,6,5,4)===0){const arms=k.pick(3,4,4,5),a=age*.055*(side||1);
      for(let j=0;j<arms;j++)k.shot(k.ox,k.oy,a+j*TAU/arms,1.9,p.type,j%2?p.main:p.accent,null,{silent:j>0||age%12!==0});}break;
    case 'rings':{const period=k.pick(40,32,28,25);if(age>=56&&(age-56)%period===0){const w=(age-56)/period|0;
      k.ring(k.ox,k.oy,k.pick(12,16,18,22),1.8,w*.31,p.type,w%2?p.main:p.alt);if(k.rank>=1)k.aimed(k.ox,k.oy,3,2.7,.2,p.needle,p.accent,null,{safe:4096});}break;}
    case 'motif':signature(k,stageId,p,age,state);break;
    default:throw new RangeError(`Undefined road attack ${attack}`);
  }
}

/** Advance one enemy's authored attack at its age. Returns the bullets
 * emitted this frame so a caller can trace or test the score. */
export function updateRoadEnemy({game,enemy,frame,difficulty=1,stageId=1,attack,state={},index=0,side=1,rng=null,onAttack}:RoadEnemyOptions){
  if(!ROAD_ATTACKS.includes(attack))throw new RangeError(`Undefined road attack ${attack}`);
  const before=game.bullets.nextId??0,lasers=game.lasers?.nextId??0;
  const k=kit.bind({game,frame,difficulty,state,rng,origin:{x:enemy.x,y:enemy.y}});
  k.runLater();fairyAttack(k,attack,{stageId,side,index,state});
  const emitted=(game.bullets.nextId??0)-before,beams=(game.lasers?.nextId??0)-lasers;
  if((emitted||beams)&&onAttack)onAttack({attack,mechanism:attack,enemyId:enemy.id,stageId,age:frame,count:emitted,lasers:beams});
  return emitted;
}

/** Every body is the public Enemy prefab. Routes author positions, and public
 * Enemy still owns health, contacts, directional ANM, death and offscreen exit. */
export function spawnRoadFormation({game,wave:spec,stageId,difficulty=1,rng,isActive=()=>true,canFire=()=>true,onAttack}:RoadFormationOptions){
  if(!ROAD_ROLES[spec.role]||!ROAD_FORMATIONS.includes(spec.formation)||!ROAD_ATTACKS.includes(spec.attack))throw new TypeError('Road wave requires an authored role, formation and attack');
  const rank=Math.min(3,difficulty),role=ROAD_ROLES[spec.role];
  const count=Math.max(1,spec.count+(rank===0&&spec.count>3?-1:rank>=2&&spec.count>2?1:0)),actors=[];
  const gap=spec.gap??(spec.formation==='anchor'||spec.formation==='drop'?0:7);
  for(let index=0;index<count;index++){
    const state:AttackState & {age:number}={age:0},life=spec.life??role.life,jitter=(rng.unit()-.5)*12,delay=index*gap;
    const pathOptions={index,count,side:spec.side,life,jitter,rank},initial=roadPath(spec.formation,pathOptions,0);
    const enemy=game.spawnEnemy({x:initial.x,y:initial.y,hp:Math.round(role.hp*(.85+rank*.1)),script:role.script,directional:role.directional??true,
      deathBank:game.banks.effect,drop:[],damageInvulnerability:0,
      onUpdate:actor=>{
        if(!isActive())return;const age=state.age++,position=roadPath(spec.formation,pathOptions,Math.max(0,age-delay));
        // Feed the next route point to public Motion, so public Enemy sees
        // the actual displacement and selects its directional animation.
        const dx=position.x-actor.x,dy=position.y-actor.y;
        actor.motion.flags=0;actor.motion.speed=Math.fround(Math.hypot(dx,dy));actor.motion.angle=Math.fround(Math.atan2(dy,dx));
        if(canFire()&&age>=delay&&actor.y>=10&&actor.y<=290&&Math.abs(actor.x)<=184)
          updateRoadEnemy({game,enemy:actor,frame:age-delay,difficulty,stageId,attack:spec.attack,state,index,side:spec.side,rng,onAttack});
        if(age>=life+delay){actor.alive=false;actor.animation.destroy();}
      },
      onDefeat:actor=>game.items.spawnEnemyDrops(actor,{counts:{[TouhouItemType.POWER]:role.power,[TouhouItemType.POINT]:role.points},radius:18}),
    });
    (enemy as CampaignEnemy).kind=spec.role==='guard'?'large-fairy':'fairy';(enemy as CampaignEnemy).stageId=stageId;
    (enemy as CampaignEnemy).roadWaveId=spec.id;(enemy as CampaignEnemy).roadRole=spec.role;(enemy as CampaignEnemy).roadAttack=spec.attack;(enemy as CampaignEnemy).roadFormation=spec.formation;
    actors.push(enemy);
  }return actors;
}
