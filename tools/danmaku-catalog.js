/** Enumerates every authored attack as a lab entry using the production
 * director entry points, so previews and tests exercise the shipped code. */
import {TouhouRNG} from '@ts-stg/thlib/touhou';
import {STAGES,MIDBOSSES} from '../src/content.js';
import {SPELL_PATTERNS,MIDBOSS_SPELL_PATTERNS,NONSPELL_PATTERNS,MIDBOSS_NONSPELL_PATTERNS,
  updateSpellPattern,updateMidbossSpellPattern,updateNonspellPattern,updateMidbossNonspellPattern} from '../src/patterns.js';
const roads=await import('../src/roads.js').catch(()=>null);
const createRoadPlan=roads?.createRoadPlan??(()=>{throw new Error('roads unavailable');}),spawnRoadFormation=roads?.spawnRoadFormation;

const pad=n=>String(n).padStart(2,'0');
const cardOf=(stageId,index)=>STAGES[stageId-1]?.spells[index];
const midCardOf=(stageId,index)=>MIDBOSSES.find(m=>m.stageId===stageId)?.spells?.[index];
export const NONSPELL_PREVIEW_FRAMES=2400;

export function attackCatalog(){
  const entries=[];
  const scripted=(key,kind,stageId,index,name,frames,call)=>entries.push({key,kind,stageId,index,name,frames,
    create:({difficulty,seed,boss})=>{const state={},rng=new TouhouRNG(seed^0x2545f491);return(lab,frame)=>call({game:lab.game,boss,frame,difficulty,state,rng});}});
  for(const pattern of SPELL_PATTERNS){
    const card=cardOf(pattern.stageId,pattern.spellIndex);
    scripted(`s${pattern.stageId}-spell${pad(pattern.spellIndex+1)}-${pattern.id}`,'spell',pattern.stageId,pattern.spellIndex,card?.name??pattern.id,
      Math.round((card?.seconds??45)*60),o=>updateSpellPattern({...o,stageId:pattern.stageId,spellIndex:pattern.spellIndex}));
  }
  for(const pattern of MIDBOSS_SPELL_PATTERNS){
    const card=midCardOf(pattern.stageId,pattern.spellIndex);
    scripted(`s${pattern.stageId}-midspell${pad(pattern.spellIndex+1)}-${pattern.id}`,'midboss',pattern.stageId,pattern.spellIndex,card?.name??pattern.id,
      Math.round((card?.seconds??40)*60),o=>updateMidbossSpellPattern({...o,stageId:pattern.stageId,spellIndex:pattern.spellIndex}));
  }
  for(const group of NONSPELL_PATTERNS)for(const pattern of group)
    scripted(`s${pattern.stageId}-non${pad(pattern.group+1)}-${pattern.id}`,'nonspell',pattern.stageId,pattern.group,
      STAGES[pattern.stageId-1]?.nonspellNames?.[pattern.group]??pattern.id,NONSPELL_PREVIEW_FRAMES,
      o=>updateNonspellPattern({...o,stageId:pattern.stageId,group:pattern.group}));
  for(const pattern of MIDBOSS_NONSPELL_PATTERNS)if(pattern)
    scripted(`s${pattern.stageId}-midnon-${pattern.id}`,'midboss',pattern.stageId,-1,pattern.id,NONSPELL_PREVIEW_FRAMES,
      o=>updateMidbossNonspellPattern({...o,stageId:pattern.stageId}));
  for(const stage of STAGES){
    let plan;try{plan=createRoadPlan(stage.id);}catch{continue;}
    entries.push({key:`s${stage.id}-road`,kind:'road',stageId:stage.id,index:0,name:stage.title,frames:plan.roadFrames,
      preview:Array.from({length:8},(_,i)=>Math.round(plan.roadFrames*(i+.5)/8)),
      create:({difficulty,seed})=>{const rng=new TouhouRNG(seed);let cursor=0,clock=0;
        return(lab,frame)=>{clock=frame;while(cursor<plan.waves.length&&plan.waves[cursor].at===frame){const wave=plan.waves[cursor++];
          spawnRoadFormation({game:lab.game,wave,stageId:stage.id,difficulty,rng,isActive:()=>true,canFire:()=>clock<wave.fireUntil});}
          while(cursor<plan.waves.length&&plan.waves[cursor].at<frame)cursor++;};}});
  }
  return entries;
}
