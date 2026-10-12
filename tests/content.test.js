import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME, PLAYERS, CHARACTERS, STAGES, ENDINGS, MIDBOSSES,
  MIDBOSS_SPELLS, EXTRA_MIDBOSS_SPELLS, ALL_SPELLS, SPELL_BY_ID, CHARACTER_BY_ID, MUSIC_COMMENTS,
} from '../dist/src/content.js';
import { MUSIC_TRACKS } from '../dist/src/music-data.js';
import { GAME_REVISION } from '../dist/src/storage.js';

test('armed Normal roads and the stage 3, 4 and 6 attack fixes advance content and replay revisions together',()=>{
  assert.equal(GAME.contentRevision,20);assert.equal(GAME_REVISION,GAME.contentRevision);
});

test('campaign covers six connected stages and a separately identified Extra', () => {
  assert.equal(GAME.fanWork, true);
  assert.deepEqual(PLAYERS.map((player) => player.id), ['reimu', 'marisa']);
  assert.deepEqual(STAGES.map((stage) => stage.id), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(STAGES.map((stage) => stage.bossId), ['akari', 'shizuri', 'watari', 'shino', 'fusae', 'kotone', 'mio']);
  assert.equal(STAGES.filter((stage) => stage.extra).length, 1);
  assert.equal(STAGES[6].extra, true);
  for (const stage of STAGES) {
    assert.ok(CHARACTER_BY_ID.has(stage.bossId), `missing Boss ${stage.bossId}`);
    assert.ok(stage.roadFrames >= 3000);
    assert.match(stage.phaseLayout, /^(?:NS)+S*$/, `${stage.id} every unnamed attack leads into a card; card-only phases come last`);
    assert.equal([...stage.phaseLayout].filter((kind) => kind === 'S').length, stage.spells.length, `${stage.id} one phase per card`);
    assert.equal([...stage.phaseLayout].filter((kind) => kind === 'N').length, stage.nonspellNames.length, `${stage.id} one name per unnamed attack`);
    assert.equal(stage.colors.length, 3);
    assert.ok(stage.title && stage.location && stage.background);
  }
});

test('all 39 spell cards have distinct IDs, names, patterns and persistent record codes', () => {
  assert.deepEqual(STAGES.map((stage) => stage.spells.length), [2, 3, 3, 4, 4, 5, 10]);
  assert.deepEqual(STAGES.map((stage) => stage.midbossSpells.length), [0, 1, 1, 1, 1, 1, 3]);
  assert.equal(MIDBOSS_SPELLS.length, 8);
  assert.equal(ALL_SPELLS.length, 39);
  assert.equal(SPELL_BY_ID.size, 39);
  assert.equal(new Set(ALL_SPELLS.map((card) => card.name)).size, 39);
  assert.equal(new Set(ALL_SPELLS.map((card) => card.pattern)).size, 39);
  assert.deepEqual([...ALL_SPELLS.map((card) => card.code)].sort((a, b) => a - b), Array.from({ length: 39 }, (_, i) => i + 1));
  const legacy = [...STAGES.flatMap((stage) => stage.spells), ...STAGES[6].midbossSpells];
  legacy.forEach((card, index) => assert.equal(card.code, index + 1, `${card.id} keeps its v1 record code`));
  for (const stage of STAGES) for (const card of [...stage.midbossSpells, ...stage.spells]) assert.equal(card.stageId, stage.id);
  assert.deepEqual(ALL_SPELLS.slice(0, 3).map((card) => card.id), ['s01-01', 's01-02', 's02-mid'], 'practice lists cards in order of appearance');
  const motifs = new Set(['lantern', 'rain', 'ferry', 'weave', 'archive', 'name', 'echo']);
  for (const card of ALL_SPELLS) {
    assert.ok(/^.+「.+」$|^「.+」$/.test(card.name), card.name);
    assert.ok(motifs.has(card.motif), card.id);
    assert.ok(card.description.length > 15, card.id);
    assert.ok(Number.isInteger(card.seconds) && card.seconds >= (card.survival ? 30 : 35) && card.seconds <= 65, card.id);
    assert.equal(typeof card.survival, 'boolean');
    assert.equal(SPELL_BY_ID.get(card.id), card);
  }
  const survival = ALL_SPELLS.filter((card) => card.survival);
  assert.deepEqual(survival.map((card) => [card.id, card.seconds]), [['s06-04', 30], ['ex-08', 65]]);
});

test('every stage has a complete, distinct conversation for each playable character', () => {
  for (const stage of STAGES) {
    for (const player of PLAYERS) {
      const route = stage.dialogues[player.id];
      assert.ok(route.before.length >= 8, `${stage.id}/${player.id}/before`);
      assert.ok(route.after.length >= 4, `${stage.id}/${player.id}/after`);
      for (const part of [route.before, route.after]) {
        const speakers = new Set(part.map((line) => line.speaker));
        assert.ok(speakers.has(player.id));
        assert.ok(speakers.has('boss'));
        for (const line of part) {
          assert.ok([player.id, 'boss'].includes(line.speaker));
          assert.ok(line.text.length > 0 && line.text.length < 60, `${stage.id}: ${line.text}`);
          assert.doesNotMatch(line.text, /TODO|TBD|待定|占位/);
        }
      }
    }
    assert.notEqual(
      stage.dialogues.reimu.before.map((line) => line.text).join(''),
      stage.dialogues.marisa.before.map((line) => line.text).join(''),
    );
  }
});

test('both characters have good, continued-run and Extra endings', () => {
  for (const player of PLAYERS) {
    assert.deepEqual(Object.keys(ENDINGS[player.id]), ['good', 'bad', 'extra']);
    for (const ending of Object.values(ENDINGS[player.id])) {
      assert.ok(ending.length >= 6 && ending.length <= 12);
      for (const paragraph of ending) {
        assert.ok(paragraph.length > 8);
        assert.doesNotMatch(paragraph, /TODO|TBD|待定|占位/);
      }
    }
  }
});

test('new Bosses have complete independent art briefs and relationships to the story', () => {
  assert.equal(CHARACTERS.length, 7);
  assert.equal(CHARACTER_BY_ID.size, 7);
  for (const character of CHARACTERS) {
    assert.ok(character.name && character.reading && character.title && character.species);
    assert.ok(character.ability.includes('程度'));
    assert.ok(character.backstory.length >= 60);
    assert.ok(character.personality.length >= 20);
    assert.equal(character.portrait, character.id);
    assert.ok(/^#[\dA-F]{6}$/i.test(character.colors[0]));
    for (const key of ['ageAppearance', 'hair', 'costume', 'prop', 'silhouette', 'expression', 'backgroundMotif']) {
      assert.ok(character.design[key], `${character.id}/${key}`);
    }
  }
});

test('midbosses open with an ordinary attack, add a card from stage 2, and Extra keeps its three-card encounter', () => {
  assert.equal(MIDBOSSES.length, 7);
  for (const midboss of MIDBOSSES) {
    const stage = STAGES.find((entry) => entry.id === midboss.stageId);
    assert.ok(midboss.atFrame > stage.roadFrames * .35 && midboss.atFrame < stage.roadFrames * .55);
    assert.equal(midboss.atFrame, stage.midbossAt);
    assert.ok(CHARACTER_BY_ID.has(midboss.bossId));
    assert.equal(midboss.entrance, 'halfFog');
    assert.equal(midboss.spells, stage.midbossSpells);
    if (!stage.extra) { assert.equal(midboss.nonspell, true); assert.ok(midboss.seconds >= 20); assert.equal(midboss.bossId, stage.bossId); }
  }
  assert.equal(MIDBOSSES[0].spells.length, 0, 'the first midboss is a short ordinary greeting');
  assert.equal(MIDBOSSES[6].bossId, 'fusae');assert.equal(MIDBOSSES[6].nonspell, false);
  assert.deepEqual(MIDBOSSES[6].spells, EXTRA_MIDBOSS_SPELLS);
  assert.ok(MIDBOSSES[6].dialogues.reimu.length >= 3);
  assert.ok(MIDBOSSES[6].dialogues.marisa.length >= 3);
});

test('all stage music references and music-room comments match the actual soundtrack', () => {
  const trackById = new Map(MUSIC_TRACKS.map((track) => [track.id, track]));
  assert.equal(Object.keys(MUSIC_COMMENTS).length, 18);
  assert.equal(trackById.size, 18);
  for (const stage of STAGES) {
    assert.ok(trackById.has(stage.bgmStage), `missing road BGM for ${stage.id}`);
    assert.ok(trackById.has(stage.bgmBoss), `missing Boss BGM for ${stage.id}`);
  }
  for (const [id, note] of Object.entries(MUSIC_COMMENTS)) {
    assert.equal(note.title, trackById.get(id).title, id);
    assert.ok(note.comment.length >= 50, id);
  }
});
