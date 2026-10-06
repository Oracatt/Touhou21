/** Unnamed attacks belong to the individual Boss. Public thlib still owns
 * bullet birth, motion commands, hitboxes, lasers, bounds and cancellation. */
import {touhouBulletCommand,TouhouRNG} from '@ts-stg/thlib/touhou';

const TAU=Math.PI*2,DOWN=Math.PI/2,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const birth=touhouBulletCommand(1,{ints:[0]});
const bend=(angle,frames)=>touhouBulletCommand(3,{floats:[0,angle],ints:[frames]});
const release=(angle,speed,frames)=>touhouBulletCommand(4,{floats:[angle,speed,0],ints:[frames,1,4]});
const easing=t=>t*t*(3-2*t);

export const NONSPELL_STYLES=Object.freeze([
  Object.freeze({bossId:'akari',id:'lantern-doorways',cycle:330,moveFrames:64,lastVolley:204,positions:[[-64,104],[62,92],[0,112]]}),
  Object.freeze({bossId:'shizuri',id:'rain-postmarks',cycle:360,moveFrames:68,lastVolley:212,positions:[[86,86],[-82,102],[0,90]]}),
  Object.freeze({bossId:'watari',id:'paired-ferry-currents',cycle:360,moveFrames:64,lastVolley:212,positions:[[-94,104],[94,104],[0,116]]}),
  Object.freeze({bossId:'shino',id:'loose-edge-weaving',cycle:390,moveFrames:72,lastVolley:222,positions:[[-62,88],[68,104],[0,92]]}),
  Object.freeze({bossId:'fusae',id:'indexed-paper-aisles',cycle:380,moveFrames:68,lastVolley:216,positions:[[0,86],[-46,102],[46,86]]}),
  Object.freeze({bossId:'kotone',id:'call-and-answer-tones',cycle:400,moveFrames:72,lastVolley:222,positions:[[-36,92],[36,92],[0,106]]}),
  Object.freeze({bossId:'mio',id:'remembered-mirror-echoes',cycle:420,moveFrames:72,lastVolley:230,positions:[[-84,96],[82,96],[0,110]]}),
]);
const SPEED=[.84,1,1.1,1.2,1.12];

function moveBody(boss,state,local,style){
  const fraction=easing(Math.min(1,local/style.moveFrames));
  const x=state.start.x+(state.destination.x-state.start.x)*fraction,y=state.start.y+(state.destination.y-state.start.y)*fraction;
  if(boss.motion){const dx=x-boss.x,dy=y-boss.y;boss.motion.flags=0;
    boss.motion.angle=Math.fround(Math.atan2(dy,dx));boss.motion.speed=Math.fround(Math.hypot(dx,dy));}
}
function context(options,style){
  const{game,boss,frame,difficulty=1,phaseIndex=0,state={},onAttack}=options;
  const rank=Math.min(3,difficulty),chapter=Math.max(0,Math.floor(phaseIndex/2)),growth=Math.min(2,chapter);
  const cycle=Math.floor(frame/style.cycle),t=frame%style.cycle;
  if(state.cycle!==cycle){
    const position=style.positions[(cycle+chapter)%style.positions.length];
    // The author's stream must not be the player/field stream: source graze
    // consumes game.rng. A director supplies its own RNG; standalone encounters
    // get one private, seeded public stream retained in their behavior state.
    if(!options.rng&&!state.authorRng)state.authorRng=new TouhouRNG(game.rng?.state??1);
    const rng=options.rng??state.authorRng;
    state.cycle=cycle;state.start={x:boss.x,y:boss.y};state.jitter=(rng.unit()-.5)*8;
    state.destination={x:position[0]+state.jitter,y:position[1]};state.locks={};
    state.gap=clamp((cycle%2?-1:1)*(34+growth*6)+state.jitter,-72,72);
  }
  moveBody(boss,state,t,style);
  let sounded=false;
  const report=(kind,data)=>onAttack?.({bossId:style.bossId,style:style.id,phaseIndex,chapter,cycle,frame,localFrame:t,kind,...data});
  const lock=(key)=>{
    if(!state.locks[key]){state.locks[key]={x:game.player.x,y:game.player.y};report('lock',{key,target:{...state.locks[key]}});}
    return state.locks[key];
  };
  const shot=(x,y,angle,speed,{count=1,spread=0,type=0,color=1,commands=[],kind='shot'}={})=>{
    const data={x,y,angle,speed:speed*SPEED[difficulty],count,angleStep:spread,type,color,pattern:1,
      commands:[birth,...commands],commandSound:-1,shotSound:sounded?-1:21,minimumPlayerDistanceSquared:4096};
    sounded=true;report(kind,data);return game.bullets.emit(data);
  };
  const aim=(x,y,key='main')=>{const p=lock(key);return Math.atan2(p.y-y,p.x-x);};
  const snipe=(when,key='main',count=rank===0?1:3,speed=2.6)=>{
    if(!when)return;shot(boss.x,boss.y,aim(boss.x,boss.y,key),speed,{count,spread:rank===0?0:.065,type:3,color:15,kind:'locked-snipe'});
  };
  const beam=(angle,color=6)=>{
    const data={x:boss.x,y:boss.y,angle,width:5,length:530,color,type:0,delay:96,grow:18,sustain:42,shrink:24,sound:26};
    report('warned-laser',data);return game.lasers.spawnInfinite(data);
  };
  const at=(...frames)=>frames.includes(t);
  return{game,boss,frame,style,rank,chapter,growth,cycle,t,state,shot,aim,lock,snipe,beam,at,report};
}

// Two lit doorposts bracket an open passage. The small address shot is locked
// once, so a player can bait it before the second lamp answers.
function lantern(c){const{boss:b,state:s,rank,growth,t,shot,snipe,at}=c;
  if(at(76))c.lock('main');
  if(at(88,132,176)){
    const sweep=t===132?.08:-.08,posts=rank===0?5:7+growth;
    for(const side of[-1,1])for(let i=0;i<posts;i++){
      const targetX=s.gap+side*(56+i*(rank===0?24:20));
      shot(b.x+side*38,b.y+8,Math.atan2(300,targetX-(b.x+side*38))+sweep*side,1.72+i*.028,
        {type:0,color:side<0?2:12,kind:'doorpost'});
    }
  }
  snipe(at(112,154),'main',rank===0?1:3,2.45);
  if(rank>=2&&at(198))for(const side of[-1,1])shot(b.x+side*38,b.y,DOWN+side*.64,1.75,
    {count:3,spread:.11,type:2,color:14,commands:[bend(-side*.0035,70)],kind:'outer-lamplight'});
  if(rank===3&&at(204))snipe(true,'last',2,2.75);
}

// Each rain row is separated in time, with a broad unprinted address stripe.
// The remembered letter travels to where the player stood, never tracks them.
function rain(c){const{boss:b,state:s,rank,growth,shot,at,t}=c;
  if(at(76))c.lock('main');
  if(at(92,126,160,194)){
    const stride=rank===0?28:24,width=rank===0?48:38;
    for(let x=-168;x<=168;x+=stride){const origin=x+s.jitter+(t===126||t===194?8:0);
      if(Math.abs(origin-s.gap)<width)continue;
      shot(origin,b.y-10,DOWN,1.78+growth*.035,{type:3,color:6,kind:'postal-rain'});
      if(rank>=2&&t===160)shot(origin,b.y-20,DOWN+(x<s.gap?-.12:.12),1.72,{type:0,color:7,kind:'outer-crosswind'});
    }
  }
  if(at(116,148))for(const side of[-1,1])shot(b.x+side*25,b.y,c.aim(b.x+side*25,b.y),2.42,
    {count:rank===0?1:3,spread:.055,type:2,color:7,kind:'address-letter'});
  if(rank===3&&at(212))c.snipe(true,'last',3,2.7);
}

// Two banks feed distinct slow currents, then one remembered boat wake runs
// through the middle. Curves always bend toward their own bank, away from the
// navigable central waterway; no unannounced late player-relative turn.
function ferry(c){const{boss:b,state:s,rank,growth,shot,at,t}=c;
  if(at(76))c.lock('main');
  if(at(88,132,178))for(const side of[-1,1]){
    const source=clamp(b.x+side*72,-158,158),base=DOWN+side*(.22+(t===132?.06:0));
    for(let row=0;row<(rank===0?3:4+growth);row++)shot(source,b.y+12,base+side*row*.065,1.58+row*.08,
      {type:0,color:side<0?6:12,commands:[bend(side*.0025,82)],kind:'bank-current'});
  }
  if(at(108,126,144))shot(b.x,b.y,c.aim(b.x,b.y),2.5,{count:rank===0?1:3,spread:.055,type:3,color:14,kind:'remembered-boat-wake'});
  if(rank>=2&&at(196))for(const side of[-1,1])shot(clamp(b.x+side*72,-158,158),b.y+12,DOWN+side*.5,1.85,
    {count:3,spread:.08,type:2,color:7,commands:[bend(-side*.003,75)],kind:'bank-return'});
  if(rank===3&&at(212))c.snipe(true,'last',3,2.7);
}

// Loose parallel threads keep a broad missing seam. Needle strokes repeat one
// saved aim, leaving time to cross the seam before a new stitch is attempted.
function weave(c){const{boss:b,state:s,rank,growth,shot,at}=c;
  if(at(80))c.lock('main');
  if(at(100,140,184))for(let x=-166;x<=166;x+=rank===0?36:30){
    if(Math.abs(x-s.gap)<(rank===0?52:42))continue;
    shot(x+s.jitter,b.y-6,DOWN,1.68+growth*.045,{count:rank>=2?2:1,spread:.035,type:3,color:4,kind:'loose-warp'});
  }
  if(at(122,160,198))for(const side of[-1,1])shot(clamp(b.x+side*42,-156,156),b.y+4,c.aim(b.x+side*42,b.y+4),2.45,
    {count:rank===0?1:3,spread:.065,type:0,color:6,kind:'remembered-needle'});
  if(rank>=2&&at(104))c.beam(c.aim(b.x,b.y,'laser')+.25*(s.cycle%2?1:-1),4);
  if(rank===3&&at(222))c.snipe(true,'last',3,2.7);
}

// Orthogonal paper columns are written in three rows, followed by folded page
// corners. Their missing aisle stays in the same place for the entire block.
function archive(c){const{boss:b,state:s,rank,growth,shot,at,t}=c;
  if(at(80))c.lock('main');
  if(at(100,140,180)){
    const shift=t===140?10:0,step=rank===0?32:27;
    for(let x=-166;x<=166;x+=step){const position=x+shift+s.jitter;
      if(Math.abs(position-s.gap)<(rank===0?52:40))continue;
      shot(position,b.y-14,DOWN,1.7+growth*.04,{type:2,color:15,kind:'index-column'});
    }
  }
  if(at(124,164))for(const side of[-1,1]){
    const x=clamp(b.x+side*65,-158,158),angle=DOWN+side*.45;
    shot(x,b.y+8,angle,1.75,{count:rank===0?3:4+growth,spread:.08,type:3,color:1,
      commands:[bend(side*.0016,70)],kind:'folded-page-corner'});
  }
  c.snipe(at(152,196),'main',rank===0?1:3,2.5);
  if(rank>=2&&at(216))for(const side of[-1,1])shot(side*156,b.y+5,DOWN+side*.22,1.92,
    {count:3,spread:.07,type:2,color:12,kind:'margin-stamp'});
}

// Bell waves keep one readable missing angular sector. The answer uses the
// saved first call, while each new cycle gives the player time to change sides.
function bells(c){const{boss:b,state:s,rank,growth,shot,at,t}=c;
  if(at(80))c.lock('main');
  if(at(96,148,200)){
    const voice=t===148?1:0,n=(rank===0?22:28)+growth*2,gate=Math.atan2(292,s.gap-b.x);
    const width=rank===0?.31:.245,phase=voice*Math.PI/n;
    for(let i=0;i<n;i++){
      const angle=i*TAU/n+phase,difference=Math.atan2(Math.sin(angle-gate),Math.cos(angle-gate));
      if(Math.abs(difference)<width)continue;
      shot(b.x,b.y,angle,1.62+voice*.18+growth*.025,{type:0,color:voice?7:14,kind:'open-sound-wave'});
    }
  }
  c.snipe(at(122,172),'main',rank===0?1:3,2.4);
  if(rank>=2&&at(104))c.beam(c.aim(b.x,b.y,'laser')+.32*(s.cycle%2?1:-1),12);
  if(rank===3&&at(222))c.snipe(true,'last',3,2.7);
}

// The two bells repeat the same recorded address from mirrored origins.
// The delayed copy never retargets; only the distinctly later final syllable
// samples a new address. Parallel outer refrains make the mirror readable.
function echoes(c){const{boss:b,state:s,rank,growth,chapter,shot,at,t}=c;
  const echoAt=156+Math.min(9,chapter)*2;
  if(at(80))c.lock('main');
  if(at(100,echoAt,204))for(const side of[-1,1]){
    const source=clamp(b.x+side*62,-156,156);
    const angle=c.aim(source,b.y,'main')+(t===echoAt?side*.075:0);
    shot(source,b.y,angle,t===echoAt?2.15:2.35,{count:rank===0?2:3+growth,spread:.075,type:0,
      color:t===echoAt?4:6,kind:t===echoAt?'saved-mirror-echo':'mirror-call'});
  }
  if(at(122,178))for(const side of[-1,1])shot(clamp(b.x+side*62,-156,156),b.y+8,DOWN+side*.55,1.65,
    {count:rank===0?3:4+growth,spread:.09,type:3,color:7,commands:[bend(side*.0018,90)],kind:'outer-refrain'});
  if(rank>=2&&at(214))for(const side of[-1,1])shot(clamp(b.x+side*62,-156,156),b.y,DOWN+side*.32,1.82,
    {count:3,spread:.08,type:2,color:15,commands:[bend(side*.002,75)],kind:'skewed-answer'});
  if(rank===3&&at(230))c.snipe(true,'last',3,2.65);
}
const PATTERNS=[lantern,rain,ferry,weave,archive,bells,echoes];

/** phaseIndex is the public director's nonspell/spell index: 0,2,4,... .
 * The resulting chapter only strengthens this Boss's own motif. */
export function updateThemedNonspell(options){
  const stageId=options.stageId??1,style=NONSPELL_STYLES[stageId-1];
  if(!style)throw new RangeError(`Undefined nonspell Boss ${stageId}`);
  if(!Number.isInteger(options.frame)||options.frame<0)throw new RangeError('Nonspell time must be a nonnegative integer frame');
  const c=context(options,style);if(c.t>style.lastVolley||c.t<=style.moveFrames)return style.id;
  PATTERNS[stageId-1](c);return style.id;
}
