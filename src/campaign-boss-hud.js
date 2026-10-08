import {TouhouBossHud} from '@ts-stg/thlib/touhou';

/** This campaign's phase clock is caller data. The public HUD still owns its
 * timer animation, warning sounds, rings and pointer, with one update per tick. */
export class CampaignBossHud extends TouhouBossHud {
  constructor(options,game){super(options);this.game=game;}
  update(state={}){
    const game=this.game,director=game.director;
    const combat=director?.state==='combat'||director?.state==='midboss-combat';
    const timerAllowed=combat&&director.boss===game.context.boss&&!!director.boss?.alive&&!state.dialogue&&!game.context.dialogue;
    // The public Game has already advanced the spell clock at this update point.
    // Forward its remaining time, including its original warning thresholds.
    if(game.spell?.active)return super.update({...state,timerHidden:!!state.timerHidden||!timerAllowed});
    const phase=director?.state==='combat'?director.phase:director?.state==='midboss-combat'?director.midbossPhase:null;
    const duration=phase?.spell===false?phase.duration:null;
    const nonspell=timerAllowed&&Number.isSafeInteger(duration)&&duration>0;
    return super.update({...state,remainingFrames:nonspell?Math.max(0,duration-director.phaseFrame):0,
      // -1 frame truncates to negative zero seconds in the public timer. An
      // explicit hide flag prevents an inactive clock appearing as "00".
      timerHidden:!!state.timerHidden||!nonspell});
  }
}
