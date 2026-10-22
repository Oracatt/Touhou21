/** Authored road scores. Times use the road clock, which stops at the midboss.
 * Each stage opens gently, builds toward its midboss, then climbs through a
 * harder second half to a climax and a short quiet approach to the Boss.
 * Every stage owns its entry routes and fairy shot styles; only the hovering
 * line and the large fairies are shared, and they take on stage accents. */
import {TouhouItemType} from '@ts-stg/thlib/touhou';
import type {TouhouGame,TouhouEnemy,TouhouRNG} from '@ts-stg/thlib/touhou';
import type {AttackGame,AttackKit,AttackState} from './danmaku.js';
import type {CampaignEnemy} from './shared-types.js';

export interface RoadWaveSpec {at:number;formation:string;attack:string;count:number;side:number;role:string;life?:number;gap?:number;}
/** `beat` numbers the small-fairy entrances in order; a mirrored pair shares one. */
export interface RoadWave extends RoadWaveSpec {id:string;sectionId:string;fireUntil:number;beat?:number;}
export interface RoadSection {id:string;title:string;start:number;end:number;waves:RoadWaveSpec[];}
export interface RoadScript {stageId:number;theme:string;sections:RoadSection[];}
export interface RoadAttackEvent {attack:string;mechanism:string;enemyId:number;stageId:number;age:number;count:number;lasers:number;source?:'bullet';}
export type RoadGame = AttackGame & Pick<TouhouGame,'spawnEnemy'|'banks'|'items'>;
type RoadState = AttackState & {echoAt?:number;mirror?:{at:number;x:number;y:number}|null;soundAt?:number;zone?:number};
type Point = {x:number;y:number};
interface RoadPathOptions {index:number;count:number;side?:number;life?:number;jitter?:number;rank?:number;}
interface RoadRole {script:number;hp:number;life:number;power:number;points:number;directional?:boolean;}
interface RoadEnemyOptions {game:AttackGame;enemy:TouhouEnemy;frame:number;difficulty?:number;stageId?:number;attack:string;state?:RoadState;index?:number;count?:number;gap?:number;side?:number;lead?:number|null;
  formation?:string;heading?:number;center?:Point|null;rng?:TouhouRNG|null;onAttack?:(event:RoadAttackEvent)=>void;}
interface RoadFormationOptions {game:RoadGame;wave:RoadWave;stageId:number;difficulty?:number;rng:TouhouRNG;isActive?:()=>boolean;canFire?:()=>boolean;onAttack?:(event:RoadAttackEvent)=>void;}
interface FairyContext {stageId:number;side:number;index:number;count:number;gap:number;formation:string;heading:number;center:Point|null;state:RoadState;split:RoadSplit;}
import {kit,T,C,C8,DOWN,TAU,clamp,lerp,wrap} from './danmaku.js';
import {polygon,inGap,burstShape} from './attacks/shapes.js';
import {scheduleRoadSplit} from './road-bullet-splits.js';
type RoadSplit=(delay:number,parents:Parameters<typeof scheduleRoadSplit>[2],spawn:Parameters<typeof scheduleRoadSplit>[3])=>void;

const BASE_FRAMES=[3900,4500,4800,5100,5400,3900,5100];
export const ROAD_MIDBOSS_FRAMES=Object.freeze([1680,1980,2160,2280,2400,1680,2280]);
const W=(at:number,formation:string,attack:string,count=4,side=1,role='scout',options:Pick<RoadWaveSpec,'life'|'gap'>={}):RoadWaveSpec=>({at,formation,attack,count,side,role,...options});
const section=(id:string,title:string,start:number,end:number,waves:RoadWaveSpec[]=[]):RoadSection=>({id,title,start,end,waves});
const deepFreeze=<T,>(value:T):T=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};

export const ROAD_SCRIPTS:RoadScript[]=deepFreeze([
  {stageId:1,theme:'lantern-procession',sections:[
    section('first-lights','点灯：提灯行列从两角依次走过',0,560,[W(90,'procession','lantern',5,-1),W(230,'procession','lantern',5,1),W(380,'arch','aim',4,-1),W(470,'arch','aim',4,1)]),
    section('lantern-rows','灯列：门柱提灯与第一只守灯大妖精',560,1080,[W(570,'gate','fan',6,1),W(720,'drop','ring',4,-1),W(860,'anchor','motif',1,1,'guard',{life:420}),W(950,'procession','stream',6,-1,'courier')]),
    section('lantern-bridge','灯桥：接力流射与灯花',1080,1560,[W(1090,'arch','aim',6,1),W(1200,'procession','lantern',6,1),W(1320,'drop','ring',5,-1),W(1430,'procession','stream',6,1,'courier')]),
    section('midboss-clearing','途中：扉灯祈',1560,1800),
    section('returning-flames','后半：回旋灯火与花形大妖精',1800,2500,[W(1810,'gate','fan',6,-1),W(1920,'procession','lantern',7,1),W(2000,'anchor','flower',2,1,'guard',{life:380}),W(2150,'arch','aim',6,-1),W(2260,'procession','stream',7,-1,'courier'),W(2370,'drop','ring',5,1)]),
    section('lit-gates','灯门：门框大妖精与提灯门柱',2500,3200,[W(2510,'anchor','motif',1,-1,'guard',{life:400}),W(2580,'gate','fan',8,1),W(2700,'procession','lantern',7,-1),W(2820,'arch','aim',7,1),W(2940,'procession','stream',7,1,'courier'),W(3050,'drop','fan',6,-1)]),
    section('last-lanterns','末灯：双大妖精环射收尾',3200,3600,[W(3210,'anchor','rings',2,1,'guard',{life:320}),W(3300,'procession','lantern',6,-1),W(3400,'arch','aim',6,1)]),
    section('boss-approach','灯火渐静',3600,3900),
  ]},
  {stageId:2,theme:'rain-mail',sections:[
    section('first-shower','细雨：云层妖精洒下竖雨',0,640,[W(90,'cloud','drizzle',4,1),W(210,'rain-line','spray',5,-1),W(350,'post','letter',4,-1,'courier'),W(490,'post','letter',4,1,'courier')]),
    section('crosswind','横风：投信快递与第一只雨伞大妖精',640,1260,[W(650,'rain-line','spray',6,1),W(780,'cloud','drizzle',4,-1),W(880,'anchor','motif',1,-1,'guard',{life:420}),W(980,'post','letter',5,1,'courier'),W(1110,'drop','fan',5,-1)]),
    section('unsent-mail','积信：两侧交错的投递队',1260,1860,[W(1270,'post','letter',5,-1,'courier'),W(1360,'post','letter',5,1,'courier'),W(1480,'cloud','drizzle',4,1),W(1610,'rain-line','spray',6,-1),W(1740,'drop','ring',5,1)]),
    section('midboss-eaves','途中：雨巻静织',1860,2100),
    section('heavy-shower','后半：云层、纵雨与花形大妖精',2100,2900,[W(2110,'cloud','drizzle',5,-1),W(2220,'rain-line','spray',7,1),W(2320,'anchor','flower',2,1,'guard',{life:380}),W(2460,'post','letter',6,-1,'courier'),W(2580,'cloud','drizzle',5,1),W(2720,'rain-line','spray',7,-1)]),
    section('signed-letters','署名：雨伞大妖精与投信',2900,3700,[W(2910,'anchor','motif',1,1,'guard',{life:420}),W(2990,'post','letter',6,1,'courier'),W(3110,'cloud','drizzle',5,-1),W(3240,'post','letter',6,-1,'courier'),W(3380,'rain-line','spray',8,1),W(3520,'drop','fan',6,-1)]),
    section('last-delivery','末班投递：双大妖精环信',3700,4200,[W(3710,'anchor','rings',2,-1,'guard',{life:340}),W(3830,'cloud','drizzle',5,1),W(3960,'post','letter',6,1,'courier')]),
    section('cloud-break','云隙',4200,4500),
  ]},
  {stageId:3,theme:'ferry-waterways',sections:[
    section('reeds','芦苇：顺流蛇行与逆流上溯',0,700,[W(100,'waterway','ripple',5,-1),W(250,'waterway','ripple',5,1),W(410,'upstream','current',5,-1,'courier'),W(560,'upstream','current',5,1,'courier')]),
    section('crossing-boats','渡船：横渡队与第一只回航大妖精',700,1400,[W(710,'crossing','side',5,-1,'courier'),W(840,'waterway','aim',5,1),W(960,'anchor','motif',1,1,'guard',{life:420}),W(1050,'drop','ripple',5,-1),W(1200,'crossing','side',6,1,'courier')]),
    section('two-currents','分流：逆流与顺流互相穿越',1400,2040,[W(1410,'upstream','current',6,1,'courier'),W(1520,'waterway','ripple',6,-1),W(1660,'upstream','current',6,-1,'courier'),W(1790,'waterway','aim',5,1),W(1920,'crossing','side',6,-1,'courier')]),
    section('midboss-landing','途中：渡守澪舟',2040,2280),
    section('fast-current','后半：急流与花形大妖精',2280,3060,[W(2290,'waterway','aim',7,-1),W(2400,'upstream','current',6,1,'courier'),W(2520,'anchor','flower',2,-1,'guard',{life:380}),W(2660,'crossing','side',7,1,'courier'),W(2800,'drop','ripple',6,1),W(2920,'upstream','current',7,-1,'courier')]),
    section('fare-gates','水闸：回航大妖精与横渡锚点',3060,3900,[W(3070,'anchor','motif',1,-1,'guard',{life:420}),W(3150,'crossing','side',7,-1,'courier'),W(3290,'waterway','ripple',7,1),W(3430,'upstream','current',7,1,'courier'),W(3580,'drop','ripple',6,-1),W(3720,'waterway','aim',8,-1)]),
    section('far-bank','彼岸：双大妖精涟漪',3900,4500,[W(3910,'anchor','rings',2,1,'guard',{life:360}),W(4030,'crossing','side',6,1,'courier'),W(4180,'upstream','current',6,-1,'courier')]),
    section('quiet-water','静水',4500,4800),
  ]},
  {stageId:4,theme:'woven-memories',sections:[
    section('warp-threads','经线：垂落的经线与横穿的纬线',0,760,[W(100,'warp','stitch',5,-1,'weaver'),W(250,'loom','side',5,1,'weaver'),W(420,'warp','stitch',5,1,'weaver'),W(570,'loom','side',5,-1,'weaver')]),
    section('loose-knots','结点：丝网大妖精与游针',760,1480,[W(770,'drop','ring',5,1,'weaver'),W(900,'anchor','motif',1,-1,'guard',{life:430}),W(990,'loom','stitch',6,1,'weaver'),W(1140,'warp','aim',6,-1),W(1300,'loom','side',6,-1,'weaver')]),
    section('cross-stitch','交织：经纬同时穿过',1480,2160,[W(1490,'loom','stitch',6,-1,'weaver'),W(1580,'warp','stitch',6,1,'weaver'),W(1760,'loom','side',6,1,'weaver'),W(1900,'drop','ring',6,-1,'weaver'),W(2030,'warp','aim',6,1)]),
    section('midboss-knot','途中：糸守紫乃',2160,2400),
    section('dense-weft','后半：双向纬线与花形大妖精',2400,3200,[W(2410,'loom','stitch',7,1,'weaver'),W(2500,'loom','stitch',7,-1,'weaver'),W(2640,'anchor','flower',2,1,'guard',{life:400}),W(2800,'warp','stitch',7,-1,'weaver'),W(2940,'loom','side',7,1,'weaver'),W(3060,'drop','ring',6,-1,'weaver')]),
    section('shuttle','梭子：丝网大妖精与经纬网格',3200,4100,[W(3210,'anchor','motif',1,1,'guard',{life:430}),W(3290,'loom','side',7,-1,'weaver'),W(3440,'warp','stitch',7,1,'weaver'),W(3590,'loom','stitch',7,1,'weaver'),W(3740,'warp','aim',7,-1),W(3900,'loom','side',8,1,'weaver')]),
    section('last-stitches','收针：双大妖精环射',4100,4800,[W(4110,'anchor','rings',2,-1,'guard',{life:360}),W(4230,'warp','stitch',6,1,'weaver'),W(4380,'loom','stitch',6,-1,'weaver'),W(4520,'warp','aim',7,1)]),
    section('unwoven-space','空白布边',4800,5100),
  ]},
  {stageId:5,theme:'paper-archive',sections:[
    section('entry-index','目录：分栏入场的书库妖精',0,800,[W(100,'archive','line',5,-1,'scribe'),W(260,'archive','line',5,1,'scribe'),W(430,'page','seal',5,-1,'courier'),W(590,'page','seal',5,1,'courier')]),
    section('folded-pages','折页：书页大妖精与翻页队',800,1560,[W(810,'page','fan',6,1,'courier'),W(940,'anchor','motif',1,1,'guard',{life:430}),W(1020,'archive','line',6,-1,'scribe'),W(1180,'page','seal',6,-1,'courier'),W(1340,'drop','fan',5,1)]),
    section('sealed-shelves','封架：异步书栏与印章',1560,2280,[W(1570,'archive','line',6,1,'scribe'),W(1720,'page','seal',6,1,'courier'),W(1860,'archive','line',6,-1,'scribe'),W(2000,'drop','fan',6,-1),W(2140,'page','seal',6,-1,'courier')]),
    section('midboss-bookmark','途中：御影房枝',2280,2520),
    section('annotations','后半：批注队与花形大妖精',2520,3360,[W(2530,'archive','line',7,1,'scribe'),W(2650,'page','seal',7,-1,'courier'),W(2780,'anchor','flower',2,-1,'guard',{life:400}),W(2940,'page','fan',7,1,'courier'),W(3080,'drop','ring',6,-1),W(3220,'archive','line',7,-1,'scribe')]),
    section('red-seals','朱印：书页大妖精与朱印列',3360,4300,[W(3370,'anchor','motif',1,-1,'guard',{life:430}),W(3450,'page','seal',7,1,'courier'),W(3600,'archive','line',7,1,'scribe'),W(3760,'page','seal',7,-1,'courier'),W(3920,'drop','fan',7,1),W(4080,'archive','line',8,-1,'scribe')]),
    section('closing-volume','合卷：双大妖精环射',4300,5100,[W(4310,'anchor','rings',2,1,'guard',{life:380}),W(4440,'archive','line',7,-1,'scribe'),W(4600,'page','seal',6,1,'courier'),W(4760,'page','fan',6,-1,'courier')]),
    section('blank-endpaper','空白扉页',5100,5400),
  ]},
  {stageId:6,theme:'naming-bells',sections:[
    section('first-note','初鸣：从钟口散开的合唱妖精',0,520,[W(90,'peal','chime',5,-1,'chorister'),W(220,'choir','ring',4,1,'chorister'),W(350,'peal','chime',5,1,'chorister'),W(450,'choir','ring',4,-1,'chorister')]),
    section('antiphon','应答：铃声大妖精与回旋铃环',520,1080,[W(530,'round','toll',6,1,'chorister'),W(650,'anchor','motif',1,-1,'guard',{life:420}),W(720,'choir','chime',5,1,'chorister'),W(860,'peal','aim',6,-1,'chorister'),W(980,'drop','ring',5,1)]),
    section('three-notes','三音：轮流鸣响的音列',1080,1560,[W(1090,'choir','chime',6,-1,'chorister'),W(1210,'round','toll',6,1,'chorister'),W(1330,'peal','aim',6,1,'chorister'),W(1450,'choir','ring',6,-1,'chorister')]),
    section('midboss-rest','途中：白识言音',1560,1800),
    section('morning-chorus','后半：合唱与花形大妖精',1800,2500,[W(1810,'round','toll',7,-1,'chorister'),W(1910,'anchor','flower',2,-1,'guard',{life:380}),W(2060,'peal','chime',6,1,'chorister'),W(2180,'choir','ring',6,-1,'chorister'),W(2320,'peal','aim',7,1,'chorister')]),
    section('named-answers','应名：铃声大妖精与新答句',2500,3200,[W(2510,'anchor','motif',1,1,'guard',{life:420}),W(2580,'round','toll',7,-1,'chorister'),W(2720,'choir','chime',7,1,'chorister'),W(2860,'peal','aim',7,-1,'chorister'),W(3000,'round','toll',7,1,'chorister')]),
    section('last-answer','终答：双大妖精合唱',3200,3600,[W(3210,'anchor','rings',2,-1,'guard',{life:320}),W(3320,'choir','chime',6,1,'chorister'),W(3420,'peal','ring',6,-1,'chorister')]),
    section('before-a-name','命名前的安静',3600,3900),
  ]},
  {stageId:7,theme:'old-name-echoes',sections:[
    section('backward-lanterns','旧灯背面：回声提灯',0,720,[W(80,'procession','echo',7,-1,'courier'),W(200,'procession','echo',7,1,'courier'),W(330,'arch','lantern',7,-1),W(460,'gate','fan',6,1),W(590,'drop','ring',5,1)]),
    section('borrowed-currents','旧渡回声：回声大妖精与逆流',720,1440,[W(730,'anchor','motif',1,1,'guard',{life:430}),W(800,'upstream','echo',7,-1,'courier'),W(950,'crossing','side',7,1,'courier'),W(1100,'waterway','ripple',7,1),W(1250,'post','letter',7,-1,'courier')]),
    section('correction-lines','更正行：错位页栏与经纬',1440,2160,[W(1450,'archive','line',7,-1,'scribe'),W(1590,'page','seal',7,1,'courier'),W(1730,'loom','stitch',7,-1,'weaver'),W(1880,'cloud','drizzle',7,1),W(2020,'warp','echo',8,-1)]),
    section('midboss-silence','途中：御影房枝',2160,2400),
    section('echo-canons','后半：错拍三部回声',2400,3200,[W(2410,'round','toll',8,-1,'chorister'),W(2520,'anchor','flower',2,1,'guard',{life:400}),W(2680,'peal','echo',8,1,'chorister'),W(2820,'loom','side',8,-1,'weaver'),W(2960,'rain-line','spray',8,1),W(3080,'procession','echo',8,-1,'courier')]),
    section('unwritten-margins','页边：回声大妖精与反向曲列',3200,4100,[W(3210,'anchor','motif',1,-1,'guard',{life:430}),W(3290,'archive','line',8,1,'scribe'),W(3440,'upstream','current',7,-1,'courier'),W(3590,'page','seal',8,1,'courier'),W(3740,'drop','ring',6,-1),W(3900,'crossing','side',8,1,'courier')]),
    section('last-old-names','末名：双大妖精与全体回声',4100,4800,[W(4110,'anchor','rings',2,1,'guard',{life:380}),W(4230,'procession','echo',8,-1,'courier'),W(4380,'procession','echo',8,1,'courier'),W(4530,'choir','chime',8,-1,'chorister')]),
    section('listen','等待有人应答',4800,5100),
  ]},
]);

export const ROAD_ROLES:Record<string,RoadRole>=deepFreeze({
  scout:{script:0,hp:120,life:300,power:1,points:1},courier:{script:5,hp:140,life:280,power:1,points:2},
  weaver:{script:10,hp:150,life:300,power:1,points:2},chorister:{script:15,hp:140,life:300,power:1,points:2},
  scribe:{script:53,directional:false,hp:260,life:320,power:2,points:3},guard:{script:25,hp:1500,life:380,power:4,points:6},
});
export const ROAD_FORMATIONS=Object.freeze(['arch','procession','gate','drop','anchor','rain-line','cloud','post','waterway','upstream','crossing','loom','warp','archive','page','choir','peal','round']);
export const ROAD_ATTACKS=Object.freeze(['aim','stream','lantern','fan','ring','spray','drizzle','letter','side','ripple','current','stitch','line','seal','chime','toll','echo','flower','rings','motif']);
/** Frames between members. Single files keep visible spacing instead of
 * stacking on one path; hovering lines and rings arrive together. */
const GAPS:Readonly<Record<string,number>>=Object.freeze({arch:12,procession:20,gate:14,'rain-line':10,cloud:28,post:16,waterway:18,upstream:18,crossing:18,loom:16,warp:12,archive:10,page:18,choir:12});
/** Climbers from the lower walls hold fire until they are above the player's lane. */
const FIRE_FLOOR:Readonly<Record<string,number>>=Object.freeze({upstream:280});
/** Stages 3 to 6 time small-fairy attacks from the moment each fairy enters
 * the firing area: the attack clock starts at the lead for its attack, so the
 * opening volley comes within a few frames of entry instead of at a fixed
 * route age that a fully powered player often never lets it reach. These
 * fairies also take no damage until they first reach the firing area. */
const LEAD_STAGES=new Set([3,4,5,6]);
const ENTRY_LEAD:Readonly<Record<string,number>>=Object.freeze({aim:24,ripple:32,current:24,side:20,stitch:16,ring:44,fan:36,line:36,seal:52,chime:36,toll:46});
/** Small-fairy HP multiplier per stage; the middle stages carry sturdier fairies. */
/** Relayed aim from the bell mouth keeps route timing: its members fan out and
 * reach the firing area at different times, which would break the baton order. */
const ROUTE_TIMED=new Set(['peal:aim']);
const SMALL_HP=[1,1,1.3,1.4,1.4,1.6,1];
/** Share of the route a formation fires through. Large fairies hold fire once
 * they turn to leave, so a falling curtain is never dragged across the field. */
const FIRE_ROUTE:Readonly<Record<string,number>>=Object.freeze({anchor:.7});
/** Share of small-fairy waves that fire, per stage, on Easy. A wave fires or
 * holds as a whole; Easy leaves most waves silent and arms more as the game
 * goes on. Every wave fires on Normal and above. */
const ARMED=[[1/3,1/3,1/2,1/2,2/3,2/3,1]];
/** Each entrance gets a fixed golden-ratio score, which spreads the armed waves
 * evenly through the stage. */
const armed=(rank:number,stageId:number,beat:number|undefined)=>
  beat===undefined||(.6+beat*(Math.sqrt(5)-1)/2)%1<(ARMED[rank]?.[stageId-1]??1);
/** Sections whose small fairies never fire on Easy: the first walk of the game. */
const EASY_QUIET=new Set(['1:first-lights']);

export function createRoadPlan(stageId:number,roadFrames=BASE_FRAMES[stageId-1]){
  const score=ROAD_SCRIPTS[stageId-1];if(!score)throw new RangeError(`Undefined road ${stageId}`);
  const scale=roadFrames/BASE_FRAMES[stageId-1],sections=score.sections.map(s=>({...s,start:Math.round(s.start*scale),end:Math.round(s.end*scale)}));
  const waves:RoadWave[]=sections.flatMap(s=>s.waves.map((w,index)=>({...w,id:`${stageId}:${s.id}:${index}`,sectionId:s.id,fireUntil:s.end,at:Math.round(w.at*scale)}))).sort((a,b)=>a.at-b.at);
  let beat=-1,prev:RoadWave|undefined;
  for(const w of waves)if(w.role!=='guard'){
    // A wave answering the one before it from the other side is its mirror and shares its beat.
    const mirror=prev&&prev.sectionId===w.sectionId&&prev.formation===w.formation&&prev.attack===w.attack&&prev.side===-w.side;
    if(!EASY_QUIET.has(`${stageId}:${w.sectionId}`))w.beat=mirror?prev!.beat:++beat;
    prev=w;
  }
  return{stageId,theme:score.theme,sections,waves,roadFrames,midbossAt:Math.round(ROAD_MIDBOSS_FRAMES[stageId-1]*scale)};
}

const ease=(t:number)=>t*t*(3-2*t),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const waypoint=(age:number,points:number[][])=>{
  for(let i=1;i<points.length;i++)if(age<=points[i][0]){const a=points[i-1],b=points[i],t=Math.max(0,(age-a[0])/(b[0]-a[0]));return{x:mix(a[1],b[1],ease(t)),y:mix(a[2],b[2],ease(t))};}
  const p=points.at(-1)!;return{x:p[1],y:p[2]};
};
const roundCenter=(side:number,life:number,age:number)=>waypoint(age,[[0,side*30,-70],[80,side*30,104],[life*.75,side*30,118],[life,side*30,-90]]);
function pathGeometry(formation:string,{index,count,side=1,life=300,jitter=0,rank=1}:RoadPathOptions,age:number){
  const lane=count===1?0:-145+290*index/(count-1),u=index/Math.max(1,count-1),t=Math.max(0,Math.min(1,age/life));
  if(formation==='procession')return{x:side*(212-424*t),y:36+70*t+44*Math.sin(Math.PI*t)+5*Math.sin(age*.09+index)};
  if(formation==='gate'){const s=index%2?-side:side,row=index>>1,y=64+row*34;return waypoint(age,[[0,s*150,-30-row*12],[60,s*150,y],[life*.72,s*142,y+12],[life,s*215,y-70]]);}
  if(formation==='cloud')return{x:side*(214-428*t),y:30+(index%2)*24+8*Math.sin(t*Math.PI*3+index)};
  if(formation==='post'){const y=84+(index%4)*30+(index>>2)*12,x=60+(index%3)*24;return waypoint(age,[[0,side*215,y-24],[70,side*x,y],[life*.62,side*(x+8),y+10],[life,side*232,y-40]]);}
  if(formation==='upstream'){const p=waypoint(age,[[0,side*208,322],[life*.34,side*126,198],[life*.68,side*40,96],[life,-side*72,-42]]);return{x:p.x+12*Math.sin(age*.07+index),y:p.y};}
  if(formation==='warp'){const x=lane+side*10,y=58+(index%3)*28;return waypoint(age,[[0,x,-30],[66,x,y],[life*.74,x,y+8],[life,x,-44]]);}
  if(formation==='page'){const a=Math.PI*t;return{x:side*215*Math.cos(a),y:176-136*Math.sin(a)};}
  if(formation==='peal'){const a=DOWN+(u-.5)*2.4+side*.22*Math.sin(Math.PI*t),r=t<.3?150*ease(t/.3):t<.7?150+20*(t-.3)/.4:170*(1-ease((t-.7)/.3));return{x:side*20+Math.cos(a)*r,y:-24+Math.sin(a)*r};}
  if(formation==='round'){const c=roundCenter(side,life,age),r=20+38*ease(Math.min(1,age/70)),a=index*TAU/Math.max(1,count)+side*age*.022;return{x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r};}
  if(formation==='crossing'||formation==='loom')return{x:side*(225-470*t),y:(formation==='loom'?48:88)+index*24+Math.sin(t*Math.PI)*(formation==='loom'?65:25)};
  if(formation==='waterway')return{x:side*(120*Math.sin(t*Math.PI*1.6)+index*13-25)+jitter,y:-25+520*t};
  if(formation==='anchor')return waypoint(age,[[0,lane*.62,-35-index*16],[70,lane*.62,78+index*12],[life*.7,lane*.62,92+index*14],[life,side*242,18+index*17]]);
  if(formation==='drop')return waypoint(age,[[0,lane*.82,-30],[58,lane*.82,64+(index%2)*30],[life-64,lane*.82+side*16,74+(index%2)*30],[life,lane*.82+side*44,-44]]);
  if(formation==='archive')return waypoint(age,[[0,lane,-28-index*10],[65+index*5,lane,65+(index%2)*32],[life*.64,lane+(rank>=2?(index%2?24:-24):0),100+(index%2)*32],[life,side*(240+index*12),185+index*6]]);
  if(formation==='choir')return{x:lane+Math.sin(t*Math.PI)*side*36,y:-25+360*t+Math.max(0,t-.65)*380+28*Math.sin(u*Math.PI)};
  if(formation==='rain-line')return{x:lane+jitter+(rank>=2?Math.sin(t*Math.PI*2+index)*18:0),y:-26-index*12+620*t};
  if(formation==='arch')return{x:lane+jitter+side*42*Math.sin(t*Math.PI),y:-28-index*10+550*t-38*Math.sin(t*Math.PI)};
  throw new RangeError(`Undefined road path ${formation}`);
}
export function roadPath(formation:string,options:RoadPathOptions,age:number){const p=pathGeometry(formation,{...options,jitter:0},age);return{x:p.x+(options.jitter??0),y:p.y};}

/** Stage palettes: small type, three colours, the needle type and a C8 orb colour. */
const PALETTES=[
  {type:T.BALL,main:C.ORANGE,alt:C.RED,accent:C.YELLOW,needle:T.RICE,orb:C8.RED},
  {type:T.NEEDLE,main:C.SKY,alt:C.AZURE,accent:C.WHITE,needle:T.AMULET,orb:C8.BLUE},
  {type:T.SCALE,main:C.CYAN,alt:C.GREEN,accent:C.MINT,needle:T.RICE,orb:C8.CYAN},
  {type:T.BALL,main:C.MAGENTA,alt:C.PINK,accent:C.PALE,needle:T.NEEDLE,orb:C8.PINK},
  {type:T.AMULET,main:C.GREEN,alt:C.RED,accent:C.PALE,needle:T.AMULET,orb:C8.RED},
  {type:T.BALL,main:C.YELLOW,alt:C.WHITE,accent:C.MINT,needle:T.STAR,orb:C8.YELLOW},
  {type:T.SCALE,main:C.BLUE,alt:C.ROSE,accent:C.WHITE,needle:T.RICE,orb:C8.BLUE},
];

/** The guard's signature attack quotes its stage Boss's motif. */
function signature(k:AttackKit,stageId:number,p:typeof PALETTES[number],age:number,state:AttackState,split:RoadSplit){
  const s=stageId,period=k.pick(84,52,44,38);
  if(s===7&&state.echo?.at===age){const e=state.echo;k.ring(e.x,e.y,24,1.9,e.a+Math.PI/24,T.SCALE,C.ROSE);state.echo=null;}
  if(age<56||(age-56)%period)return;
  const wave=(age-56)/period|0;
  if(s===1){const door=k.aim(),half=k.pick(.36,.29,.25,.22);
    burstShape(k,k.ox,k.oy,polygon(4,k.pick(7,9,11,13)),1.5,wave*.37,T.AMULET,wave%2?C.RED:C.ORANGE,null,{skip:(q,a)=>inGap(a,door,half)});}
  else if(s===2){const letters=k.aimed(k.ox,k.oy,3,2.8,.34,T.AMULET,C.WHITE,[k.hold(40),k.wait(18),k.vanish()]);
    split(54,letters,(b,k)=>k.ring(b.x,b.y,k.pick(6,8,10,12),1.5,k.unit()*TAU,T.BALL,C.AZURE,null,{silent:true}));
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

/** Aimed fire passes along a formation like a baton: every member owns a slot
 * of at least RELAY frames and the cycle restarts only after the whole line
 * has fired, so a line never converges several aimed volleys at once. */
const RELAY=12;
function relay(age:number,start:number,{index,count,gap}:FairyContext){
  const step=Math.max(gap,RELAY),t=age-start-index*(step-gap),cycle=Math.max(1,count)*step;
  return t<0?{phase:-1,round:-1,step}:{phase:t%cycle,round:t/cycle|0,step};
}
/** Shared shapes take on stage accents: rain halts and falls, eddies turn. */
function accent(k:AttackKit,stageId:number,side:number,hold:number){
  return stageId===2?[k.stopTo(hold,DOWN,2)]:stageId===3?[k.stopTurn(hold+6,side*.6,1.5)]:null;
}
/** Hovering-line volleys. Fans lean inward from the walls; rings keep their
 * gap toward the player and square off on stage 5 or double on 4 and 6. */
function fanVolley(k:AttackKit,p:typeof PALETTES[number],stageId:number,x:number,y:number,color:number){
  k.fan(x,y,k.pick(5,7,9,11),2.2,DOWN-clamp(x/160,-1,1)*.4,.22,p.type,color,stageId===2?[k.stopTo(26,DOWN,2)]:null,{safe:4096,rows:k.rank===3||stageId===5?2:1,speedStep:1.6});
}
function ringVolley(k:AttackKit,p:typeof PALETTES[number],stageId:number,side:number,x:number,y:number,color:number){
  const n=k.pick(8,12,16,20);
  if(stageId===5){const door=k.aim(x,y);burstShape(k,x,y,polygon(4,Math.max(2,n>>2)),1.8,k.unit()*TAU,p.type,color,null,{skip:(q,a)=>inGap(a,door,.3),extra:{safe:4096}});}
  // Stage 4 knots and stage 6 bells close on the player: the double ring puts a bead on the player's line instead of a gap.
  else if(stageId===4)k.emit({x,y,angle:0,speed:1.8,speedStep:1.35,type:p.type,color,pattern:2,count:k.pick(4,6,7,8),rows:2,safe:4096});
  // Stage 6 bells echo: the slower row of the double ring stops, then gathers back toward the player.
  else if(stageId===6){const n=k.pick(4,6,7,8);k.emit({x,y,angle:0,speed:1.8,type:p.type,color,pattern:2,count:n,safe:4096});
    k.ring(x,y,n,1.35,k.unit()*TAU,p.type,color,[k.stopAim(40,k.pick(1.5,1.7,1.9,2.1))],{safe:4096,silent:true});}
  else k.ringGap(x,y,n,1.8,p.type,color,accent(k,stageId,side,30),{safe:4096});
}

/** A repeating shot is silent when its enemy sounded fewer than gap frames ago, so the first shot is always heard. */
function hush(state:RoadState,age:number,gap:number){
  if(state.soundAt!==undefined&&age-state.soundAt<gap)return true;
  state.soundAt=age;return false;
}

/** Fairy attacks are authored by role and age; Hard and Lunatic add layers
 * and density, Easy removes companions. Fire only from the upper field. */
function fairyAttack(k:AttackKit,attack:string,o:FairyContext){
  const p=PALETTES[o.stageId-1],age=k.t,{stageId,side,state}=o;
  switch(attack){
    // Aimed volleys keep a stage accent: the current pauses and surges (3), a
    // thread is pulled taut (4), a bell clangs a small arc of stars (6).
    case 'aim':if(relay(age,28,o).phase===0){
      if(stageId===3)k.aimed(k.ox,k.oy,k.pick(1,3,3,3),2.4,.24,p.type,p.main,[k.stopAim(28,2.8)],{safe:4096,rows:k.pick(1,2,2,3),speedStep:2});
      else if(stageId===4)k.aimed(k.ox,k.oy,k.pick(1,1,1,3),2.8,.3,p.needle,p.main,null,{safe:4096,rows:k.pick(2,4,5,6),speedStep:2.1});
      else if(stageId===6)k.aimed(k.ox,k.oy,k.pick(1,3,5,5),2.4,.26,p.needle,p.main,null,{safe:4096,rows:k.pick(1,1,1,2),speedStep:2});
      else k.aimed(k.ox,k.oy,k.pick(1,1,3,3),2.6,.2,p.type,p.main,null,{rows:k.pick(1,2,3,3),speedStep:1.8,safe:4096});}break;
    case 'stream':{const r=relay(age,26,o);if(r.phase>=0&&r.phase<r.step&&r.phase%k.pick(10,7,6,5)===0)k.aimed(k.ox,k.oy,1,3,0,p.type,p.main,null,{safe:4096});break;}
    case 'echo':if(relay(age,34,o).phase===0){const aim=k.aim();k.fan(k.ox,k.oy,k.pick(3,3,3,3,5),2.8,aim,.16,p.type,p.main,null,{safe:4096});state.echoAim=aim;state.echoAt=age+18;}
      if(age===state.echoAt)k.fan(k.ox,k.oy,k.pick(3,3,3,3,5),2.5,state.echoAim??DOWN,.16,p.type,p.alt,null,{safe:4096});break;
    case 'lantern':if(age===36||(k.rank>=1&&age===110)||(k.rank>=2&&age===184)){
      const orb=k.shot(k.ox,k.oy,DOWN+(k.unit()-.5)*.6,1.3,T.ORB,p.orb,[k.speedTo(.35,36),k.wait(16),k.vanish()],{safe:4096});
      o.split(48,orb,(b,k)=>k.ring(b.x,b.y,k.pick(4,5,6,8),1.5,k.unit()*TAU,p.type,p.main,null,{silent:true}));}break;
    case 'fan':case 'ring':{const fan=attack==='fan';
      if(fan?age===40||age===100||(k.rank>=2&&age===160):age===48||(k.rank>=1&&age===120)||(k.rank>=3&&age===180)){
        if(fan)fanVolley(k,p,stageId,k.ox,k.oy,p.alt);else ringVolley(k,p,stageId,side,k.ox,k.oy,p.accent);
        // Extra echoes the opening volley from the mirrored position.
        if(stageId===7&&age<100)state.mirror={at:age+14,x:-k.ox,y:k.oy};}
      if(state.mirror?.at===age){const m=state.mirror;state.mirror=null;
        if(fan)fanVolley(k,p,stageId,m.x,m.y,p.accent);else ringVolley(k,p,stageId,side,m.x,m.y,p.alt);}
      break;}
    case 'spray':if(age>=10&&age%k.pick(14,10,8,6)===0)k.shot(k.ox,k.oy,DOWN+(k.unit()-.5)*1.1,lerp(1.8,2.6,k.unit()),p.type,p.main,null,{safe:4096,silent:hush(state,age,28)});break;
    case 'drizzle':if(age>=12&&age%k.pick(32,22,18,15)===0)k.shot(k.ox+(k.unit()-.5)*16,k.oy+6,DOWN,lerp(2.4,3,k.unit()),p.type,p.accent,null,{safe:4096,rows:k.pick(1,1,2,2),speedStep:2.1,silent:hush(state,age,44)});break;
    case 'letter':{const r=relay(age,40,o);if(r.phase===0&&r.round<k.pick(1,2,2,3,9)){const letter=k.aimed(k.ox,k.oy,1,3,0,p.needle,C.WHITE,[k.wait(28),k.hold(24),k.wait(12),k.vanish()],{safe:4096});
      o.split(58,letter,(b,k)=>k.ring(b.x,b.y,k.pick(4,5,6,7),1.5,k.unit()*TAU,p.type,p.alt,null,{silent:true}));}break;}
    case 'side':{const period=k.pick(26,20,17,15);if(age>=20&&age%period===0){
      // Stage 4 wefts hang vertical warp threads; boats elsewhere fire broadside,
      // slanting down and inward, ahead of the boat. Stage 3 stays two-way on
      // Lunatic: a staircase of eight three-way boats closes the whole lower field.
      if(stageId===4)k.fan(k.ox,k.oy,1,2.2,DOWN,0,p.needle,p.main,null,{safe:4096,rows:k.pick(1,2,3,4),speedStep:1.5});
      else k.fan(k.ox,k.oy,stageId===3?k.pick(1,2,2,2):k.pick(1,2,2,3),2.3,DOWN+side*.2,.3,p.needle,p.main,null,{safe:4096});
      // From Normal, stage 3 boats also throw an aimed oar stroke every few volleys.
      const stroke=k.pick(0,3,2,2);if(stageId===3&&stroke&&((age-20)/period|0)%stroke===o.index%stroke)k.aimed(k.ox,k.oy,1,2.6,0,p.type,p.alt,null,{safe:4096,silent:true});}break;}
    case 'ripple':if(age===36||(k.rank>=1&&age===104)||(k.rank>=2&&age===172))k.ring(k.ox,k.oy,k.pick(6,8,10,14),2,k.unit()*TAU,p.type,p.accent,
      // Stage 3 eddies regather toward the player, drifting with the current; Extra still turns downstream.
      [stageId===3?k.stopAim(40,k.pick(1.1,1.3,1.4,1.5),side*.12):k.stopTo(40,DOWN+side*.25,k.pick(1.1,1.3,1.4,1.5))],{safe:4096});break;
    // Stage 3 climbers open the current on entry; Extra keeps its route-age beat.
    case 'current':if(age>=24&&(age-(stageId===3?24:0))%k.pick(34,20,14,11)===0)for(const s of[-1,1]){const a=o.heading+s*Math.PI/2,turn=wrap(DOWN-a);
      k.shot(k.ox,k.oy,a,2,p.needle,s<0?p.main:p.alt,[k.curve(Math.sign(turn)*.02,Math.round(Math.abs(turn)/.02))],{safe:4096,silent:s>0||hush(state,age,44)});}break;
    // Warp stitches fall on alternating slants; stage 4 weft stitches are pulled taut toward the player.
    case 'stitch':{const step=k.pick(34,16,13,10);if(age>=16&&age%step===0){const warp=o.formation==='warp',a=warp?DOWN+((age/step|0)%2?.55:-.55):DOWN,speed=k.pick(1.6,1.9,2.1,2.3);
      k.shot(k.ox,k.oy,DOWN,.01,p.needle,warp?p.accent:p.alt,[k.wait(k.pick(70,62,56,50)),!warp&&stageId===4?k.aimNow(speed+.3):k.set(a,speed)],{safe:4096,silent:hush(state,age,32)});}break;}
    case 'line':if(age===40||age===100||(k.rank>=2&&age===160)||(k.rank>=3&&age===220)){const n=k.pick(4,5,6,8),blank=(k.unit()*(n-1))|0;
      for(let i=0;i<n;i++)if(i!==blank&&i!==blank+1)k.shot(k.ox+(i-(n-1)/2)*18,k.oy+8,DOWN,1.7,p.needle,i%2?p.main:p.accent,null,{safe:4096,rows:k.pick(1,1,1,2),speedStep:1.35,silent:i!==(blank===0?2:0)});
      // From Hard, stage 5 writes a word into the blank: an aimed needle from the gap.
      if(stageId===5&&k.rank>=2){const gx=k.ox+(blank+.5-(n-1)/2)*18;k.aimed(gx,k.oy+8,k.pick(1,1,1,3),2.2,.16,p.needle,p.alt,null,{safe:4096,silent:true});}}break;
    case 'seal':if(relay(age,56,o).phase===0){k.aimed(k.ox,k.oy,1,1.7,0,T.BIG,p.orb,null,{safe:4096});
      if(k.rank>=1)k.aimed(k.ox,k.oy,k.pick(0,2,2,4),2.3,.34,p.needle,p.alt,null,{safe:4096,silent:true});}break;
    case 'chime':{const r=relay(age,40,o);if(r.phase===0&&r.round<k.pick(1,1,2,3,4)){const n=k.pick(6,7,8,9),a=k.unit()*TAU;
      // Stage 6 bells ring true: the outer ring keeps one bullet on the player's line.
      k.emit({x:k.ox,y:k.oy,angle:stageId===6?0:a,speed:1.9,type:p.type,color:p.main,pattern:stageId===6?2:3,count:n,safe:4096});// The inner ring of a stage 6 bell echoes: it stops, then gathers back toward the player.
      if(k.rank>=1)k.ring(k.ox,k.oy,n,1.45,a+Math.PI/n,p.type,p.accent,stageId===6?[k.stopAim(36,k.pick(1.6,1.8,2,2.2))]:null,{safe:4096,silent:true});}break;}
    case 'toll':if(age>=50&&(age-50)%k.pick(32,26,22,16)===0){const c=o.center,a=c?Math.atan2(k.oy-c.y,k.ox-c.x):o.heading;
      // Stage 6 spokes that ring upward stop and fall back toward the player.
      k.fan(k.ox,k.oy,1,2.1,a,0,p.type,p.main,stageId===6&&Math.sin(a)<0?[k.stopAim(32,k.pick(1.6,1.9,2.1,2.3))]:null,{safe:4096,rows:k.pick(1,2,2,3),speedStep:1.6,silent:o.index>0&&hush(state,age,90)});
      if(k.rank>=3)k.fan(k.ox,k.oy,1,1.4,a+Math.PI,0,p.needle,p.accent,null,{safe:4096,silent:true});
      // From Normal, one stage 6 ring member in turn tolls straight at the player.
      if(stageId===6&&k.rank>=1&&((age-50)/k.pick(32,26,22,16)|0)%Math.max(1,o.count)===o.index)k.aimed(k.ox,k.oy,1,2.4,0,p.needle,p.accent,null,{safe:4096,silent:true});}break;
    case 'flower':{const step=k.pick(10,6,5,4);if(age<60||age%step)break;const arms=k.pick(3,4,4,5),a=age*.055*(side||1);
      if(stageId===6&&(age/step|0)%4===3)break;
      const cmds=stageId===2?[k.stopTo(28,DOWN,2.1)]:stageId===3?[k.curve((side||1)*.012,80)]:null;
      for(let j=0;j<arms;j++){const base=j*TAU/arms,spin=a+base,angle=j%2&&stageId===4?base-a:j%2&&stageId===7?Math.PI-spin:spin;
        // Stage 5 folds the spiral into a square page: diagonals fly fastest.
        const speed=stageId===5?2.2*Math.SQRT1_2/Math.max(Math.abs(Math.cos(angle)),Math.abs(Math.sin(angle))):1.9;
        k.shot(k.ox,k.oy,angle,speed,p.type,j%2?p.main:p.accent,cmds,{silent:j>0||hush(state,age,12)});}break;}
    case 'rings':{const period=k.pick(56,32,28,25);if(age>=56&&(age-56)%period===0){const w=(age-56)/period|0,n=k.pick(10,16,18,22),c=w%2?p.main:p.alt;
      if(stageId===5){const door=k.aim();burstShape(k,k.ox,k.oy,polygon(4,Math.max(3,n>>2)),1.8,w*.31,p.type,c,null,{skip:(q,a)=>inGap(a,door,.26)});}
      else if(stageId===6)k.ringGap(k.ox,k.oy,k.pick(6,8,10,12),1.8,p.type,c,null,{rows:2,speedStep:1.4});
      else if(stageId===4)k.ring(k.ox,k.oy,n>>1,1.8,w*.31,p.needle,c,null,{rows:2,speedStep:1.3});
      else k.ring(k.ox,k.oy,n,1.8,w*.31,p.type,c,accent(k,stageId,side,30));
      if(k.rank>=1)k.aimed(k.ox,k.oy,3,2.7,.2,p.needle,p.accent,null,{safe:4096});}break;}
    case 'motif':signature(k,stageId,p,age,state,o.split);break;
    default:throw new RangeError(`Undefined road attack ${attack}`);
  }
}

/** Advance one enemy's authored attack at its age. Returns the bullets
 * emitted this frame so a caller can trace or test the score. */
export function updateRoadEnemy({game,enemy,frame:age,difficulty=1,stageId=1,attack,state={},index=0,count=1,gap=0,side=1,lead=null,formation='',heading=-DOWN,center=null,rng=null,onAttack}:RoadEnemyOptions){
  if(!ROAD_ATTACKS.includes(attack))throw new RangeError(`Undefined road attack ${attack}`);
  // With a lead, the attack clock starts when this enemy first fires from the firing area.
  const frame=lead===null?age:age-(state.zone??=age)+lead;
  const before=game.bullets.nextId??0,lasers=game.lasers?.nextId??0;
  const k=kit.bind({game,frame,difficulty,state,rng,origin:{x:enemy.x,y:enemy.y}});
  const split:RoadSplit=(delay,parents,spawn)=>scheduleRoadSplit(k,delay,parents,spawn,onAttack?
    count=>onAttack({attack,mechanism:attack,enemyId:enemy.id,stageId,age:frame+delay,count,lasers:0,source:'bullet'}):undefined);
  fairyAttack(k,attack,{stageId,side,index,count,gap,formation,heading,center,state,split});
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
  const guard=spec.role==='guard',lead=guard||!LEAD_STAGES.has(stageId)||ROUTE_TIMED.has(`${spec.formation}:${spec.attack}`)?null:ENTRY_LEAD[spec.attack]??20;
  const gap=spec.gap??GAPS[spec.formation]??0,floor=FIRE_FLOOR[spec.formation]??290,silent=!guard&&(!armed(rank,stageId,spec.beat)||rank===0&&EASY_QUIET.has(`${stageId}:${spec.sectionId}`));
  for(let index=0;index<count;index++){
    const state:RoadState & {age:number;heading:number;entered?:boolean}={age:0,heading:-DOWN},life=spec.life??role.life,jitter=(rng.unit()-.5)*12,delay=index*gap;
    const fireUntil=life*(FIRE_ROUTE[spec.formation]??1);
    const pathOptions={index,count,side:spec.side,life,jitter,rank},initial=roadPath(spec.formation,pathOptions,0);
    const enemy=game.spawnEnemy({x:initial.x,y:initial.y,hp:Math.round(role.hp*(.85+rank*.1)*(guard?1:SMALL_HP[stageId-1]??1)),script:role.script,directional:role.directional??true,
      deathBank:game.banks.effect,drop:[],damageInvulnerability:0,
      onUpdate:actor=>{
        if(!isActive())return;const age=state.age++,route=Math.max(0,age-delay),position=roadPath(spec.formation,pathOptions,route);
        // Feed the next route point to public Motion, so public Enemy sees
        // the actual displacement and selects its directional animation.
        const dx=position.x-actor.x,dy=position.y-actor.y;
        actor.motion.flags=0;actor.motion.speed=Math.fround(Math.hypot(dx,dy));actor.motion.angle=Math.fround(Math.atan2(dy,dx));
        if(dx||dy)state.heading=Math.atan2(dy,dx);
        const zone=actor.y>=10&&actor.y<=floor&&Math.abs(actor.x)<=184;
        // Homing shots would otherwise finish these fairies at the screen edge before they reach the firing area.
        if(lead!==null){if(zone)state.entered=true;actor.invulnerable=!state.entered;}
        if(!silent&&canFire()&&age>=delay&&route<fireUntil&&zone)
          updateRoadEnemy({game,enemy:actor,frame:age-delay,difficulty,stageId,attack:spec.attack,state,index,count,gap,side:spec.side,lead,formation:spec.formation,
            heading:state.heading,center:spec.formation==='round'?roundCenter(spec.side,life,route):null,rng,onAttack});
        if(age>=life+delay){actor.alive=false;actor.animation.destroy();}
      },
      onDefeat:actor=>game.items.spawnEnemyDrops(actor,{counts:{[TouhouItemType.POWER]:role.power,[TouhouItemType.POINT]:role.points},radius:18}),
    });
    (enemy as CampaignEnemy).kind=spec.role==='guard'?'large-fairy':'fairy';(enemy as CampaignEnemy).stageId=stageId;
    (enemy as CampaignEnemy).roadWaveId=spec.id;(enemy as CampaignEnemy).roadRole=spec.role;(enemy as CampaignEnemy).roadAttack=spec.attack;(enemy as CampaignEnemy).roadFormation=spec.formation;
    actors.push(enemy);
  }return actors;
}
