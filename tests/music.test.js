import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MUSIC_TRACKS, musicTrack, musicLoopSeconds } from '../src/music-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = ['title', ...Array.from({ length: 6 }, (_, i) => `stage0${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `boss0${i + 1}`), 'extra', 'bossExtra', 'ending', 'staff'];

test('all seventeen original BGM tracks have distinct files and stable loop metadata', () => {
  assert.deepEqual(new Set(MUSIC_TRACKS.map(track => track.id)), new Set(expected));
  assert.equal(new Set(MUSIC_TRACKS.map(track => track.sha256)).size, 17);
  for (const track of MUSIC_TRACKS) {
    assert.equal(musicTrack(track.id), track);
    assert.equal(track.sampleRate, 32000);
    assert.ok(Number.isInteger(track.frames));
    assert.ok(Number.isInteger(track.loopStartFrame));
    assert.ok(track.loopStartFrame > 0 && track.loopStartFrame < track.loopEndFrame);
    assert.equal(track.loopEndFrame, track.frames);
    assert.ok(track.duration >= 70 && track.duration < 110);
    const seconds = musicLoopSeconds(track);
    assert.equal(seconds.start, track.loopStartFrame / track.sampleRate);
    assert.equal(seconds.end, track.loopEndFrame / track.sampleRate);
  }
});

for (const track of MUSIC_TRACKS) {
  test(`${track.id}: complete stereo PCM, usable level, no clipped samples, clean loop seam`, () => {
    const wav = fs.readFileSync(path.join(root, track.file));
    assert.equal(crypto.createHash('sha256').update(wav).digest('hex'), track.sha256);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt32LE(4), wav.length - 8);
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 2);
    assert.equal(wav.readUInt32LE(24), track.sampleRate);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.readUInt32LE(40), track.frames * 4);
    let energy = 0, peak = 0, silent = 0, stereoDifference = 0;
    for (let frame = 0; frame < track.frames; frame++) {
      const l = wav.readInt16LE(44 + frame * 4) / 32767;
      const r = wav.readInt16LE(46 + frame * 4) / 32767;
      energy += l * l + r * r;
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
      if (Math.max(Math.abs(l), Math.abs(r)) < .0005) silent++;
      stereoDifference += (l - r) ** 2;
    }
    const rms = Math.sqrt(energy / (track.frames * 2));
    assert.ok(peak > .40 && peak <= .89, `peak ${peak}`);
    assert.ok(rms > .075 && rms < .24, `RMS ${rms}`);
    assert.ok(silent / track.frames < .018, `silence ${(silent / track.frames * 100).toFixed(3)}%`);
    assert.ok(Math.sqrt(stereoDifference / track.frames) > .012, 'stereo image must carry actual different parts');
    // PCM neighbor deltas, not only silence at an artificially faded loop point.
    for (let channel = 0; channel < 2; channel++) {
      const at = frame => wav.readInt16LE(44 + frame * 4 + channel * 2) / 32767;
      const seam = Math.abs(at(track.loopStartFrame) - at(track.loopEndFrame - 1));
      let neighborhood = 0;
      for (let i = 1; i < 128; i++) {
        neighborhood = Math.max(neighborhood,
          Math.abs(at(track.loopStartFrame + i) - at(track.loopStartFrame + i - 1)),
          Math.abs(at(track.loopEndFrame - i) - at(track.loopEndFrame - i - 1)));
      }
      assert.ok(seam < .04, `loop impulse ${seam}`);
      assert.ok(seam <= Math.max(.009, neighborhood * 1.8), `seam ${seam} exceeds local musical derivative ${neighborhood}`);
    }
  });
}

test('scores contain full themes, contrasting sections and reproducible multi-instrument arrangements', () => {
  const scoreFile = JSON.parse(fs.readFileSync(path.join(root, 'assets/music/scores.json'), 'utf8'));
  assert.equal(scoreFile.tracks.length, 17);
  assert.equal(new Set(scoreFile.tracks.map(track => JSON.stringify(track.motifDegrees))).size, 17);
  for (const score of scoreFile.tracks) {
    assert.equal(score.motifDegrees.length, 16);
    assert.equal(score.answerDegrees.length, 16);
    assert.notDeepEqual(score.motifDegrees, score.answerDegrees);
    assert.ok(score.notes.length >= 1400);
    assert.deepEqual(score.sections.map(section => section.name), ['intro', 'A', 'B', 'bridge', 'reprise']);
    assert.equal(score.sections.reduce((sum, section) => sum + section.bars, 0), 52);
    assert.ok(new Set(score.notes.map(note => note.voice)).size >= 8);
    assert.ok(score.notes.some(note => note.voice === 'bass'));
    assert.ok(score.notes.some(note => note.voice === 'strings'));
    assert.equal(score.rhythm.reduce((sum, length) => sum + length, 0).toFixed(5), '16.00000');
  }
});
