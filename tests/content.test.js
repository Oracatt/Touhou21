import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME, PLAYERS, CHARACTERS, STAGES, ENDINGS, MIDBOSSES,
  MIDBOSS_SPELLS, ALL_SPELLS, SPELL_BY_ID, CHARACTER_BY_ID, MUSIC_COMMENTS,
} from '../src/content.js';
import { MUSIC_TRACKS } from '../src/music-data.js';

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
    assert.ok(stage.nonspellNames.length >= stage.spells.length);
    assert.equal(stage.colors.length, 3);
    assert.ok(stage.title && stage.location && stage.background);
  }
});

test('all 34 spell cards have distinct IDs, names and visual pattern definitions', () => {
  assert.deepEqual(STAGES.map((stage) => stage.spells.length), [2, 3, 3, 4, 4, 5, 10]);
  assert.equal(MIDBOSS_SPELLS.length, 3);
  assert.equal(ALL_SPELLS.length, 34);
  assert.equal(SPELL_BY_ID.size, 34);
  assert.equal(new Set(ALL_SPELLS.map((card) => card.name)).size, 34);
  assert.equal(new Set(ALL_SPELLS.map((card) => card.pattern)).size, 34);
  const motifs = new Set(['lantern', 'rain', 'ferry', 'weave', 'archive', 'name', 'echo']);
  for (const card of ALL_SPELLS) {
    assert.ok(/^.+「.+」$|^「.+」$/.test(card.name), card.name);
    assert.ok(motifs.has(card.motif), card.id);
    assert.ok(card.description.length > 15, card.id);
    assert.ok(Number.isInteger(card.seconds) && card.seconds >= 35 && card.seconds <= 65, card.id);
    assert.equal(typeof card.survival, 'boolean');
    assert.equal(SPELL_BY_ID.get(card.id), card);
  }
  const survival = ALL_SPELLS.filter((card) => card.survival);
  assert.equal(survival.length, 1);
  assert.equal(survival[0].id, 'ex-08');
  assert.equal(survival[0].seconds, 65);
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

test('mid-Boss schedule remains inside each road section and includes the Extra three-card encounter', () => {
  assert.equal(MIDBOSSES.length, 7);
  for (const midboss of MIDBOSSES) {
    const stage = STAGES.find((entry) => entry.id === midboss.stageId);
    assert.ok(midboss.atFrame > 0 && midboss.atFrame < stage.roadFrames);
    assert.ok(CHARACTER_BY_ID.has(midboss.bossId));
    assert.equal(midboss.entrance, 'flyIn');
    if (!stage.extra) assert.equal(midboss.spells.length, 0);
  }
  assert.equal(MIDBOSSES[6].bossId, 'fusae');
  assert.deepEqual(MIDBOSSES[6].spells, MIDBOSS_SPELLS);
  assert.ok(MIDBOSSES[6].dialogues.reimu.length >= 3);
  assert.ok(MIDBOSSES[6].dialogues.marisa.length >= 3);
});

test('all stage music references and music-room comments match the actual soundtrack', () => {
  const trackById = new Map(MUSIC_TRACKS.map((track) => [track.id, track]));
  assert.equal(Object.keys(MUSIC_COMMENTS).length, 17);
  assert.equal(trackById.size, 17);
  for (const stage of STAGES) {
    assert.ok(trackById.has(stage.bgmStage), `missing road BGM for ${stage.id}`);
    assert.ok(trackById.has(stage.bgmBoss), `missing Boss BGM for ${stage.id}`);
  }
  for (const [id, note] of Object.entries(MUSIC_COMMENTS)) {
    assert.equal(note.title, trackById.get(id).title, id);
    assert.ok(note.comment.length >= 50, id);
  }
});
