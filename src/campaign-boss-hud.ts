import type {TouhouGame,TouhouBossHudState,TouhouBossHudEnemy} from '@ts-stg/thlib/touhou';
import type {CampaignDirector} from './director.js';
import {TouhouBossHud} from '@ts-stg/thlib/touhou';

/** This campaign's phase clock is caller data. The public HUD still owns its
 * timer animation, warning sounds, rings and pointer, with one update per tick. */
export class CampaignBossHud extends TouhouBossHud {
 declare game:TouhouGame&{director?:CampaignDirector};
 private ringOwners:Array<{boss:TouhouBossHudEnemy;groupIndex:number|undefined}|undefined>=[];
  constructor(options:ConstructorParameters<typeof TouhouBossHud>[0],game:TouhouGame&{director?:CampaignDirector}){super(options);this.game=game;}
  update(state:TouhouBossHudState={}){
    const game=this.game,director=game.director;
    for(let i=0;i<this.panels.length;i++){
      const boss=state.bosses?.[i],previous=this.ringOwners[i],groupIndex=state.healthBars?.[i]?.groupIndex;
      if(!boss||boss.alive===false){this.ringOwners[i]=undefined;continue;}
      // This campaign replaces a completed group's HP in one tick. Start the
      // new display ring at zero; its nonspell and spell share one identity,
      // so their handoff preserves the remaining arc.
      if(!previous||previous.boss!==boss||previous.groupIndex!==groupIndex)this.clearPanel(this.panels[i],true);
      this.ringOwners[i]={boss,groupIndex};
    }
    const preparing=director?.state==='phase-wait'||director?.state==='midboss-phase-wait';
    if(preparing&&director.boss===game.context.boss&&director.boss&&game.isBossHeld(director.boss)){
      // Holding suspends the real actor and closes damage/contact gates. Only
      // the HUD sees the upcoming ring during this game's preparation interval.
      state={...state,bosses:state.bosses?.map(boss=>boss&&boss===director.boss?
        {...boss,hp:boss.hp,primaryFlags:(boss.primaryFlags??0)&~0x13}:boss)};
    }
    const combat=director?.state==='combat'||director?.state==='midboss-combat';
    const timerAllowed=combat&&director.boss===game.context.boss&&!!director.boss?.alive&&!state.dialogue&&!game.context.dialogue;
    // The public Game has already advanced the spell clock at this update point.
    // Forward its remaining time, including its original warning thresholds.
    if(game.spell?.active)return super.update({...state,timerHidden:!!state.timerHidden||!timerAllowed});
    const phase=director?.state==='combat'?director.phase:director?.state==='midboss-combat'?director.midbossPhase:null;
    const duration=phase?.spell===false?phase.duration:null;
    const nonspell=timerAllowed&&Number.isSafeInteger(duration)&&duration!>0;
    return super.update({...state,remainingFrames:nonspell?Math.max(0,duration!-director!.phaseFrame):0,
      // -1 frame truncates to negative zero seconds in the public timer. An
      // explicit hide flag prevents an inactive clock appearing as "00".
      timerHidden:!!state.timerHidden||!nonspell});
  }
}
