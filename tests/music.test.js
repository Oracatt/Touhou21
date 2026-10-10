import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MUSIC_TRACKS, musicTrack, musicLoopSeconds } from '../dist/src/music-data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Tracks rendered from sampled instruments by tools/studio: intro + a seamless loop body, ~45-80 s.
const studioManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/music/studio.json'), 'utf8'));
const studioIds = new Set(studioManifest.tracks.map(entry => entry.id));
const expected = ['title', ...Array.from({ length: 6 }, (_, i) => `stage0${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `boss0${i + 1}`), 'extra', 'bossExtra', 'ending', 'staff', 'playersScore'];

test('all eighteen original BGM tracks have distinct files and stable loop metadata', () => {
  assert.deepEqual(new Set(MUSIC_TRACKS.map(track => track.id)), new Set(expected));
  assert.equal(new Set(MUSIC_TRACKS.map(track => track.sha256)).size, 18);
  for (const track of MUSIC_TRACKS) {
    assert.equal(musicTrack(track.id), track);
    assert.equal(track.sampleRate, 32000);
    assert.ok(Number.isInteger(track.frames));
    assert.ok(Number.isInteger(track.loopStartFrame));
    assert.ok(track.loopStartFrame > 0 && track.loopStartFrame < track.loopEndFrame);
    assert.equal(track.loopEndFrame, track.frames);
    if (studioIds.has(track.id)) assert.ok(track.duration >= 45 && track.duration < 80, `duration ${track.duration}`);
    else assert.ok(track.duration >= 70 && track.duration < 110);
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
    assert.ok(peak > .40 && peak <= (studioIds.has(track.id) ? .9 : .89), `peak ${peak}`);
    assert.ok(rms > .075 && rms < .24, `RMS ${rms}`);
    assert.ok(silent / track.frames < .018, `silence ${(silent / track.frames * 100).toFixed(3)}%`);
    assert.ok(Math.sqrt(stereoDifference / track.frames) > .012, 'stereo image must carry actual different parts');
    // PCM neighbor deltas, not only silence at an artificially faded loop point.
    for (let channel = 0; channel < 2; channel++) {
      const at = frame => wav.readInt16LE(44 + frame * 4 + channel * 2) / 32767;
      const seam = Math.abs(at(track.loopStartFrame) - at(track.loopEndFrame - 1));
      if (studioIds.has(track.id)) {
        // Dense, loud music: the wrap must look like any other pair of neighbouring samples of this track.
        const deltas = [];
        for (let frame = 1; frame < track.frames; frame += 3) deltas.push(Math.abs(at(frame) - at(frame - 1)));
        deltas.sort((a, b) => a - b);
        const p999 = deltas[Math.floor(deltas.length * .999)];
        assert.ok(seam <= p999, `loop step ${seam} exceeds the track's own 99.9th percentile ${p999}`);
        // No dip or dropout across the wrap: 30 ms RMS on both sides stay within 12 dB of each other.
        const windowRms = (from) => {
          let sum = 0;
          for (let i = 0; i < 960; i++) sum += at(from + i) ** 2;
          return Math.sqrt(sum / 960) + 1e-6;
        };
        const ratio = windowRms(track.loopStartFrame) / windowRms(track.loopEndFrame - 960);
        assert.ok(ratio > .25 && ratio < 4, `level across the loop wrap changes by ${ratio.toFixed(2)}x`);
        continue;
      }
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

test('studio manifest: frame-exact intro and loop lengths, credited sample libraries', () => {
  assert.equal(studioIds.size, 15);
  for (const entry of studioManifest.tracks) {
    const track = musicTrack(entry.id);
    assert.equal(track.id, entry.id);
    assert.equal(track.frames, entry.frames);
    assert.equal(track.loopStartFrame, entry.loopStartFrame);
    assert.equal(track.sha256, entry.sha256);
    const beat = 32000 * 60 / entry.bpm;
    assert.ok(Math.abs(entry.loopStartFrame - entry.introBars * 4 * beat) <= 1, `${entry.id} intro length`);
    assert.ok(Math.abs((entry.frames - entry.loopStartFrame) - entry.loopBars * 4 * beat) <= 2, `${entry.id} loop length`);
    assert.ok(entry.loopBars >= 32 && entry.loopBars <= 40);
  }
  const names = studioManifest.samples.map(sample => sample.name).join('|');
  assert.match(names, /Salamander/);
  assert.match(names, /MuldjordKit/);
  assert.match(names, /VSCO/);
});

test('scores contain full themes, contrasting sections and reproducible multi-instrument arrangements', () => {
  const scoreFile = JSON.parse(fs.readFileSync(path.join(root, 'assets/music/scores.json'), 'utf8'));
  // Studio tracks carry their score in tools/studio/songs; scores.json covers the synthesised remainder.
  const synthesised = 18 - studioIds.size;
  assert.equal(scoreFile.tracks.length, synthesised);
  assert.deepEqual(new Set(scoreFile.tracks.map(track => track.id)), new Set(expected.filter(id => !studioIds.has(id))));
  assert.equal(new Set(scoreFile.tracks.map(track => JSON.stringify(track.motifDegrees))).size, synthesised);
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
