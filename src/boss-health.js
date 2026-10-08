/** Business encounter HP, in the unchanged public damage unit.
 *
 * Recovered Touhou20 ECL uses a shared ring: ins_511(total) followed by
 * ins_514(slot, nextSpellHP, timeout, handler). The unnamed attack's damage
 * budget is total - nextSpellHP. It is NOT seven times that difference:
 * source_reconstruction/gameplay/enemy_damage_helpers.cpp:4-10 multiplies
 * stored health only while the spell flag is set.
 *
 * Exact ECL references, total/threshold:
 * st01bs:20/58 = 14200/2200; :220/252 = 14000/2000.
 * st02bs:20/59 = 17600/2600; :201/233 = 17600/2600.
 * st03bs:20/63 = 23000/3000; :193/225 = 23200/3200;
 *         :345/377 = 23200/3400.
 * st04bs:20/63 = 22800/2800; :165/197 = 22800/2800;
 *         :304/336 = 22800/2500.
 * st05bs:20/63 = 19500/3500; :186/218 and :384/416 = 19200/3200.
 * st06bs:20/82 and :157/189 = 21900/3900;
 *         :267/306 and :449/481 = 20000/4000; :565/605 = 17000/4000.
 * st07bs:20/99, :204/238, :299/333, :394/428 = 22000/4000;
 *         :489/521 and :584/618 = 21000/5000;
 *         :679/713 = 19500/3500; :774/808 = 22000/6000.
 * Paths above are scripts/recovered/ecl/*.ecl.txt in the read-only reference.
 *
 * Not every card is preceded by an unnamed group: a stage's `phaseLayout`
 * (content.js) lists its phases in order, and a card that directly follows
 * another card has no group of its own. Rows below are indexed by unnamed
 * group, not by card. Groups beyond the reference counts (stage 6's fourth
 * and Extra's later ones) repeat the stage's final reference budget; they are
 * authored extensions, not claims of additional original ECL phases.
 * Spell HP and phase timing are deliberately configured by the director.
 */
export const BOSS_NONSPELL_HEALTH=Object.freeze([
  Object.freeze([12000,12000]),
  Object.freeze([15000,15000]),
  Object.freeze([20000,20000,19800]),
  Object.freeze([20000,20000,20300]),
  Object.freeze([16000,16000,16000]),
  Object.freeze([18000,18000,16000,16000]),
  Object.freeze([18000,18000,18000,18000,16000,16000,16000,16000]),
]);

/** Midboss ordinary attacks. Stage 1 keeps the direct st01mbs:24 budget of
 * 11000 because its midboss has no card. From stage 2 the ordinary attack
 * hands over to one midboss card, so its budget is this game's pacing choice:
 * roughly two thirds of the earlier standalone values, before the card.
 */
export const MIDBOSS_NORMAL_HEALTH=Object.freeze([11000,9000,10000,10500,12000,11000]);
/** Visible spell HP of midboss cards (public spell health stores seven times
 * this value). Extra keeps its earlier 2300 / 2480 / 2660 sequence. */
export function midbossSpellHealth(stageId,spellIndex=0){
  if(!Number.isInteger(stageId)||stageId<2||stageId>7)throw new RangeError('Midboss cards start at stage 2');
  if(!Number.isInteger(spellIndex)||spellIndex<0)throw new RangeError('Unknown midboss card');
  return stageId===7?2300+spellIndex*180:1500+stageId*150;
}

export function bossNonspellHealth(stageId,group){
  if(!Number.isInteger(stageId)||stageId<1||stageId>BOSS_NONSPELL_HEALTH.length)
    throw new RangeError('Unknown Boss stage');
  const groups=BOSS_NONSPELL_HEALTH[stageId-1];
  if(!Number.isInteger(group)||group<0||group>=groups.length)
    throw new RangeError('Unknown unnamed attack group');
  return groups[group];
}

export function midbossNormalHealth(stageId){
  if(!Number.isInteger(stageId)||stageId<1||stageId>MIDBOSS_NORMAL_HEALTH.length)
    throw new RangeError('Normal midboss health requires a main campaign stage');
  return MIDBOSS_NORMAL_HEALTH[stageId-1];
}
