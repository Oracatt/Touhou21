/** Business attack scores. A cycle has a visible reposition/windup, a finite
 * phrase, then recovery while the existing public bullets continue moving.
 * No hitboxes, bullet lifetime or player rules are changed here. */
const scores=[
  [420,24,228],[480,36,250],
  [480,36,264],[480,36,230],[540,48,280],
  [480,36,252],[540,48,270],[540,48,270],
  [600,60,270],[540,48,272],[540,48,260],[600,60,290],
  [540,48,280],[600,60,290],[540,48,270],[540,48,272],
  [540,48,270],[600,60,290],[600,60,280],[540,48,272],[600,60,300],
  [540,48,280],[600,60,300],[540,48,270],[600,60,290],[600,60,300],
  [600,60,290],[600,60,300],[600,60,280],[600,60,300],[600,60,320],
  [540,48,270],[600,60,280],[600,60,290],
];
export const SPELL_CADENCES=Object.freeze(scores.map(([cycle,windup,active],index)=>Object.freeze({index,cycle,windup,active,recovery:cycle-windup-active})));
export function spellAttackClock(index,frame){
  const score=SPELL_CADENCES[index];if(!score)throw new RangeError('Missing spell attack score');
  const elapsed=Math.max(0,frame-60),cycle=Math.floor(elapsed/score.cycle),age=elapsed%score.cycle;
  const active=frame>=60&&age>=score.windup&&age<score.windup+score.active;
  return{score,cycle,age,active,frame:age-score.windup,phase:frame<60?'opening':age<score.windup?'windup':active?'attack':'recovery'};
}
export function prepareSpellPhrase(boss,clock,state,{stageId=1,index=0}={}){
  state.cardFrame=(state.cardFrame??-1)+1;
  state.attackClock={cycle:clock.cycle,age:clock.age,phase:clock.phase};
  if(clock.phase==='opening')return;
  if(state.phraseCycle!==clock.cycle){
    state.phraseCycle=clock.cycle;state.phraseOrigin={x:boss.x,y:boss.y};state.aims=[];
    const side=((clock.cycle+index)&1)?1:-1;
    state.phraseTarget={x:stageId===1?side*28:side*(38+stageId*5),y:94+(index%3)*9};
  }
  if(clock.phase==='windup'){
    const fraction=Math.min(1,(clock.age+1)/Math.max(1,clock.score.windup-8)),ease=fraction*fraction*(3-2*fraction);
    const x=Math.fround(state.phraseOrigin.x+(state.phraseTarget.x-state.phraseOrigin.x)*ease);
    const y=Math.fround(state.phraseOrigin.y+(state.phraseTarget.y-state.phraseOrigin.y)*ease);
    boss.x=x;boss.y=y;
    if(boss.motion?.position)Object.assign(boss.motion.position,{x,y});
    if(boss.animation)Object.assign(boss.animation,{x,y});
  }
}
