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
 * This original game has more unnamed groups in stages 2, 4, 5 and Extra.
 * Those additional groups repeat their stage's final reference budget;
 * they are authored extensions, not claims of additional original ECL phases.
 * Spell HP and phase timing are deliberately configured by the director.
 */
export const BOSS_NONSPELL_HEALTH=Object.freeze([
  Object.freeze([12000,12000]),
  Object.freeze([15000,15000,15000]),
  Object.freeze([20000,20000,19800]),
  Object.freeze([20000,20000,20300,20300]),
  Object.freeze([16000,16000,16000,16000]),
  Object.freeze([18000,18000,16000,16000,13000]),
  Object.freeze([18000,18000,18000,18000,16000,16000,16000,16000,16000,16000]),
]);

/** Normal midbosses have no subsequent spell threshold in this game's route.
 * Direct original references: st01mbs:24=11000, st02mbs:24=15000,
 * st04mbs:21=17000, st05mbs:21=22000. The reference has no corresponding
 * standalone stage-3 or stage-6 midboss; 16000 and 18000 are this game's
 * explicit pacing choices between its adjacent encounters.
 * Extra's three spell phases keep their independent spell HP configuration.
 */
export const MIDBOSS_NORMAL_HEALTH=Object.freeze([11000,15000,16000,17000,22000,18000]);

export function bossNonspellHealth(stageId,spellIndex){
  if(!Number.isInteger(stageId)||stageId<1||stageId>BOSS_NONSPELL_HEALTH.length)
    throw new RangeError('Unknown Boss stage');
  const groups=BOSS_NONSPELL_HEALTH[stageId-1];
  if(!Number.isInteger(spellIndex)||spellIndex<0||spellIndex>=groups.length)
    throw new RangeError('Unknown unnamed attack group');
  return groups[spellIndex];
}

export function midbossNormalHealth(stageId){
  if(!Number.isInteger(stageId)||stageId<1||stageId>MIDBOSS_NORMAL_HEALTH.length)
    throw new RangeError('Normal midboss health requires a main campaign stage');
  return MIDBOSS_NORMAL_HEALTH[stageId-1];
}
