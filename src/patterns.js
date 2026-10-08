/** Boss attack catalogue and director entry points. Each Boss module owns its
 * nonspells, spell cards and midboss attacks; the shared kit in danmaku.js
 * authors emissions while public thlib owns everything that moves or hits. */
import {driveAttack} from './danmaku.js';
import {AKARI} from './attacks/akari.js';
import {SHIZURI} from './attacks/shizuri.js';
import {WATARI} from './attacks/watari.js';
import {SHINO} from './attacks/shino.js';
import {FUSAE} from './attacks/fusae.js';
import {KOTONE} from './attacks/kotone.js';
import {MIO} from './attacks/mio.js';

/** Frames between a phase start and its first volley: the public charge
 * releases at 60; a spell card also leaves room for its declaration. */
export const ATTACK_START=Object.freeze({nonspell:60,spell:80,midbossSpell:80});
export const BOSS_ATTACKS=Object.freeze([AKARI,SHIZURI,WATARI,SHINO,FUSAE,KOTONE,MIO]);
const kebab=name=>name.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`);

export const STAGE_PATTERN_OFFSETS=Object.freeze(BOSS_ATTACKS.reduce((offsets,boss,i)=>{
  offsets.push(i?offsets[i-1]+BOSS_ATTACKS[i-1].spells.length:0);return offsets;},[]));
export const SPELL_PATTERNS=Object.freeze(BOSS_ATTACKS.flatMap((boss,stage)=>boss.spells.map((update,spellIndex)=>Object.freeze({
  id:kebab(update.name),index:STAGE_PATTERN_OFFSETS[stage]+spellIndex,stageId:stage+1,spellIndex,update}))));
export const MIDBOSS_SPELL_PATTERNS=Object.freeze(BOSS_ATTACKS.flatMap((boss,stage)=>(boss.midboss?.spells??[]).map((update,spellIndex)=>
  Object.freeze({id:kebab(update.name),stageId:stage+1,spellIndex,update}))));
export const NONSPELL_PATTERNS=Object.freeze(BOSS_ATTACKS.map((boss,stage)=>Object.freeze(boss.nonspells.map((update,group)=>
  Object.freeze({id:kebab(update.name),stageId:stage+1,group,update})))));
export const MIDBOSS_NONSPELL_PATTERNS=Object.freeze(BOSS_ATTACKS.map((boss,stage)=>boss.midboss?.nonspell?
  Object.freeze({id:kebab(boss.midboss.nonspell.name),stageId:stage+1,update:boss.midboss.nonspell}):null));

const requireFrame=frame=>{if(!Number.isInteger(frame)||frame<0)throw new RangeError('Attack time must be a nonnegative integer frame');};

export function updateSpellPattern({game,boss,frame,difficulty=1,stageId=1,spellIndex=0,state={},rng=null}){
  requireFrame(frame);const pattern=SPELL_PATTERNS[(STAGE_PATTERN_OFFSETS[stageId-1]??-99)+spellIndex];
  if(!pattern||pattern.stageId!==stageId)throw new RangeError(`Undefined spell geometry ${stageId}/${spellIndex}`);
  driveAttack(pattern.update,{game,boss,frame,difficulty,state,rng,start:ATTACK_START.spell});return pattern.id;
}
export function updateMidbossSpellPattern({game,boss,frame,difficulty=4,stageId=7,spellIndex=0,state={},rng=null}){
  requireFrame(frame);const pattern=MIDBOSS_SPELL_PATTERNS.find(p=>p.stageId===stageId&&p.spellIndex===spellIndex);
  if(!pattern)throw new RangeError(`Undefined midboss card ${stageId}/${spellIndex}`);
  driveAttack(pattern.update,{game,boss,frame,difficulty,state,rng,start:ATTACK_START.midbossSpell});return pattern.id;
}
/** `group` is the stage's unnamed-attack index (see `phaseLayout`). For callers that
 * still pass the old card-interleaved `phaseIndex`, groups are 0,2,4... */
export function updateNonspellPattern({game,boss,frame,difficulty=1,stageId=1,group=null,phaseIndex=0,state={},rng=null}){
  requireFrame(frame);group??=Math.floor(phaseIndex/2);const pattern=NONSPELL_PATTERNS[stageId-1]?.[group];
  if(!pattern)throw new RangeError(`Undefined nonspell ${stageId}/${group}`);
  driveAttack(pattern.update,{game,boss,frame,difficulty,state,rng,start:ATTACK_START.nonspell});return pattern.id;
}
export function updateMidbossNonspellPattern({game,boss,frame,difficulty=1,stageId=1,state={},rng=null}){
  requireFrame(frame);const pattern=MIDBOSS_NONSPELL_PATTERNS[stageId-1];
  if(!pattern)throw new RangeError(`Undefined midboss nonspell ${stageId}`);
  driveAttack(pattern.update,{game,boss,frame,difficulty,state,rng,start:ATTACK_START.nonspell});return pattern.id;
}
