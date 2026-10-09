/** Original score authoring and offline synthesis for 东方归名录.
 * All motifs/harmonies below were newly composed for this project.
 * Run `node tools/compose-music.mjs`; no external audio or copyrighted score is read.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/music');
const RATE = 32000;
const INTRO_BARS = 4;
const LOOP_BARS = 48;
const TAU = Math.PI * 2;
const MODES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  pentatonic: [0, 2, 5, 7, 9],
};

// Degrees are deliberately authored melodies, not excerpts or transforms of existing songs.
// Every track has its own theme, answering theme, rhythmic setting and harmonic itinerary.
const TRACKS = [
  { id: 'title', title: '东方归名录之名路', bpm: 124, key: 62, mode: 'minor', voice: 'piano', color: 'flute',
    motif: [0, 4, 7, 6, 4, 3, 2, 4, 1, 2, 4, 6, 5, 3, 2, 0], answer: [7, 8, 9, 7, 6, 4, 5, 6, 4, 3, 2, 4, 1, 2, -1, 0], chords: [0, 5, 3, 4, 0, 2, 5, 4], rhythm: [1, .5, .5, 1, .5, .5, .5, .5, 1, .5, .5, 1, .5, .5, 1, 1], description: '一条在晨雾里没有终点的路；钢琴主题由笛声回答。' },
  { id: 'stage01', title: '灯笼亮起以前', bpm: 146, key: 67, mode: 'dorian', voice: 'flute', color: 'bell',
    motif: [0, 2, 4, 5, 4, 2, 1, 3, 4, 6, 7, 5, 4, 3, 1, 0], answer: [4, 5, 7, 8, 6, 5, 3, 4, 2, 4, 5, 7, 6, 4, 2, 1], chords: [0, 3, 5, 4, 0, 2, 3, 4], rhythm: [.5, .5, 1, .5, .5, 1, .5, .5, .5, .5, 1, .5, .5, 1, .5, 1.5], description: '村道灯火的轻快八分音符，隐藏在低音里的异变。' },
  { id: 'boss01', title: '借路的火，借名的影', bpm: 158, key: 64, mode: 'harmonic', voice: 'brass', color: 'piano',
    motif: [0, 0, 4, 3, 2, 4, 5, 4, 1, 1, 5, 4, 3, 6, 5, 2], answer: [7, 6, 4, 5, 8, 7, 6, 4, 5, 3, 4, 2, 1, 4, -1, 0], chords: [0, 5, 2, 4, 0, 3, 5, 4], rhythm: [.5, .5, .5, .5, 1, .5, .5, .5, .5, .5, .5, 1, .5, .5, 1, 1], description: '错拍的火苗与短促铜管，回应一个爱开玩笑的路口。' },
  { id: 'stage02', title: '雨滴写给远方的信', bpm: 140, key: 69, mode: 'minor', voice: 'bell', color: 'flute',
    motif: [7, 5, 4, 2, 3, 4, 1, 2, 6, 5, 3, 4, 2, 1, -1, 0], answer: [2, 4, 6, 7, 9, 8, 6, 5, 7, 6, 4, 5, 3, 2, 1, 0], chords: [0, 2, 5, 3, 0, 5, 1, 4], rhythm: [.5, .5, .5, .5, 1, .5, .5, 1, .5, .5, .5, .5, 1, .5, .5, 1], description: '玻璃般的雨声琶音和长笛，信封沿溪水漂向上游。' },
  { id: 'boss02', title: '无人签收的天晴', bpm: 156, key: 66, mode: 'dorian', voice: 'brass', color: 'bell',
    motif: [4, 5, 4, 2, 1, 3, 4, 6, 5, 4, 2, 0, 1, 2, 4, 3], answer: [9, 7, 8, 6, 5, 7, 4, 6, 8, 7, 5, 4, 3, 5, 2, 0], chords: [0, 3, 1, 4, 5, 3, 2, 4], rhythm: [.5, .5, 1, .5, .5, .5, .5, 1, .5, .5, 1, .5, .5, .5, .5, 1], description: '雨的急流变成行进曲；铜管与钟声轮流署名。' },
  { id: 'stage03', title: '渡口没有写在地图上', bpm: 138, key: 60, mode: 'pentatonic', voice: 'flute', color: 'piano',
    motif: [0, 2, 3, 4, 3, 1, 2, 0, 1, 3, 5, 4, 2, 1, -1, 0], answer: [5, 6, 7, 5, 4, 3, 4, 2, 3, 5, 4, 2, 1, 3, 2, 0], chords: [0, 3, 1, 2, 0, 4, 3, 2], rhythm: [1, .5, .5, 1, .5, .5, 1, 1, .5, .5, 1, .5, .5, 1, .5, .5], description: '船桨的两拍摇摆与五声音阶，薄雾里的河岸不断后退。' },
  { id: 'boss03', title: '一文钱也渡不过的彼岸', bpm: 150, key: 62, mode: 'harmonic', voice: 'piano', color: 'brass',
    motif: [0, 2, 1, 4, 3, 5, 4, 6, 7, 5, 6, 4, 3, 2, -1, 0], answer: [4, 7, 6, 9, 8, 6, 5, 7, 4, 5, 3, 6, 2, 4, 1, 0], chords: [0, 2, 3, 4, 0, 5, 1, 4], rhythm: [.5, .5, .5, 1, .5, .5, .5, 1, .5, .5, .5, 1, .5, .5, .5, 1], description: '逆流的切分钢琴，以及船夫很难掩饰的好奇心。' },
  { id: 'stage04', title: '蛛丝上的旧日记', bpm: 154, key: 65, mode: 'minor', voice: 'bell', color: 'piano',
    motif: [0, 4, 2, 5, 3, 6, 4, 7, 5, 3, 6, 4, 2, 5, 1, 0], answer: [7, 4, 8, 5, 9, 6, 7, 3, 6, 2, 5, 1, 4, 0, 2, -1], chords: [0, 5, 3, 1, 0, 2, 5, 4], rhythm: [.5, .5, .5, .5, .5, .5, 1, 1, .5, .5, .5, .5, .5, .5, 1, 1], description: '交错的钟琴和键盘，记忆像丝线一样分岔又相遇。' },
  { id: 'boss04', title: '八只脚书写的昨日', bpm: 168, key: 63, mode: 'dorian', voice: 'brass', color: 'bell',
    motif: [0, 3, 4, 1, 5, 4, 2, 6, 5, 7, 4, 6, 3, 5, 2, 0], answer: [7, 9, 6, 8, 5, 7, 4, 6, 3, 5, 2, 4, 1, 3, -1, 0], chords: [0, 3, 5, 2, 0, 1, 3, 4], rhythm: [.5, .5, .5, .5, .75, .25, .5, .5, .5, .5, .5, .5, .75, .25, 1, 1], description: '细密十六分音符织网，旋律却执意走一条笔直的路。' },
  { id: 'stage05', title: '翻到无字的那一页', bpm: 148, key: 59, mode: 'harmonic', voice: 'piano', color: 'flute',
    motif: [0, 1, 4, 2, 5, 3, 6, 4, 7, 6, 4, 5, 2, 3, 1, -1], answer: [4, 6, 5, 8, 7, 4, 6, 3, 5, 2, 4, 1, 2, 0, -1, 0], chords: [0, 5, 1, 4, 3, 2, 5, 4], rhythm: [.5, .5, 1, .5, .5, 1, .5, .5, .5, .5, 1, .5, .5, 1, .5, 1.5], description: '纸札书架里的一支隐秘赋格，空白页仍然发出声音。' },
  { id: 'boss05', title: '校勘者与消失的句号', bpm: 164, key: 61, mode: 'harmonic', voice: 'brass', color: 'piano',
    motif: [0, 1, 2, 4, 3, 2, 6, 5, 4, 6, 7, 5, 3, 4, 1, 0], answer: [7, 8, 6, 9, 7, 5, 8, 4, 6, 7, 3, 5, 2, 4, -1, 0], chords: [0, 1, 5, 4, 0, 3, 2, 4], rhythm: [.5, .5, .5, .5, .5, .5, 1, 1, .5, .5, .5, .5, .5, .5, 1, 1], description: '严整的主旋律被不规则的回答打断，像被擦掉的逗号。' },
  { id: 'stage06', title: '万物尚未开口的清晨', bpm: 144, key: 70, mode: 'major', voice: 'flute', color: 'bell',
    motif: [0, 2, 4, 7, 6, 4, 5, 3, 4, 6, 8, 7, 5, 4, 2, 1], answer: [7, 8, 11, 9, 8, 7, 5, 6, 4, 5, 7, 6, 4, 3, 1, 0], chords: [0, 4, 5, 3, 0, 2, 1, 4], rhythm: [1, .5, .5, 1, .5, .5, 1, 1, .5, .5, 1, .5, .5, 1, .5, .5], description: '明亮却不安的黎明；远处的铜管把短小动机放大成仪式。' },
  { id: 'boss06', title: '给世界最后一个名字', bpm: 172, key: 64, mode: 'minor', voice: 'brass', color: 'piano',
    motif: [0, 4, 7, 8, 7, 5, 6, 4, 3, 5, 6, 9, 8, 6, 4, 2], answer: [7, 11, 9, 12, 10, 8, 9, 7, 6, 8, 7, 5, 4, 6, 1, 0], chords: [0, 5, 3, 4, 0, 2, 1, 4], rhythm: [.5, .5, 1, .5, .5, 1, .5, .5, .5, .5, 1, .5, .5, 1, .5, 1.5], description: '铜管长线、钢琴对位与半音转调，一个不愿被遗忘的祈祷。' },
  { id: 'extra', title: '今晚请用旧名字呼唤我', bpm: 162, key: 68, mode: 'dorian', voice: 'bell', color: 'flute',
    motif: [0, 2, 5, 3, 6, 4, 7, 5, 4, 6, 3, 5, 2, 4, 1, 0], answer: [7, 6, 9, 8, 5, 7, 4, 6, 3, 5, 2, 4, 1, 3, -1, 0], chords: [0, 3, 1, 5, 0, 2, 3, 4], rhythm: [.5, .5, .5, .5, .5, .5, 1, 1, .5, .5, .5, .5, .5, .5, 1, 1], description: '夜半旧称在空屋间回响；跳跃钟琴和安静的回声形成反差。' },
  { id: 'bossExtra', title: '言灵在零点之后复活', bpm: 176, key: 66, mode: 'harmonic', voice: 'brass', color: 'bell',
    motif: [0, 1, 4, 6, 5, 3, 7, 6, 4, 8, 7, 5, 9, 6, 4, 2], answer: [7, 10, 9, 12, 11, 8, 10, 7, 9, 6, 8, 5, 7, 4, 1, 0], chords: [0, 1, 5, 4, 0, 3, 2, 4], rhythm: [.5, .5, .5, .5, .75, .25, .5, .5, .5, .5, .5, .5, .75, .25, 1, 1], description: '切分、呼应和上行半音；旧名字终于找到新的听众。' },
  { id: 'ending', title: '名字留在茶杯边', bpm: 120, key: 65, mode: 'major', voice: 'piano', color: 'flute',
    motif: [0, 2, 4, 3, 2, 0, 1, 2, 4, 5, 3, 4, 2, 1, -1, 0], answer: [7, 6, 4, 5, 3, 4, 2, 3, 1, 2, 4, 3, 2, 0, -1, 0], chords: [0, 5, 3, 4, 0, 2, 1, 4], rhythm: [1, .5, .5, 1, .5, .5, 1, 1, .5, .5, 1, .5, .5, 1, .5, .5], description: '回到神社后的钢琴小品，茶水里倒映着一个还记得的名字。' },
  { id: 'staff', title: '归名的旅途还没有结束', bpm: 132, key: 67, mode: 'major', voice: 'brass', color: 'piano',
    motif: [0, 4, 5, 7, 6, 4, 2, 3, 4, 6, 7, 9, 8, 6, 4, 0], answer: [7, 9, 8, 11, 9, 7, 5, 6, 4, 5, 7, 6, 3, 4, 1, 0], chords: [0, 4, 5, 3, 0, 2, 1, 4], rhythm: [.5, .5, 1, .5, .5, 1, .5, .5, .5, .5, 1, .5, .5, 1, .5, 1.5], description: '重逢的进行曲；响亮主题下仍有一条温柔的钢琴小路。' },
  { id: 'playersScore', title: "Player's Score", bpm: 116, key: 60, mode: 'dorian', voice: 'piano', color: 'bell',
    motif: [4, 5, 4, 2, 0, 1, 2, 4, 3, 2, 0, -1, 0, 2, 1, 0], answer: [7, 6, 5, 4, 5, 4, 2, 3, 4, 2, 1, 2, 0, 1, -1, 0], chords: [0, 3, 5, 4, 0, 5, 3, 4], rhythm: [1, .5, .5, 1, 1, .5, .5, 1, 1, .5, .5, 1, .5, .5, 1.5, .5], description: '满身疮痍之后的小憩；钢琴慢慢清点一路的分数，钟琴轻声提醒还可以再出发一次。' },
];

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}
function degreePitch(track, degree, octave = 0, modulation = 0) {
  const scale = MODES[track.mode];
  const n = scale.length;
  const ix = ((degree % n) + n) % n;
  return track.key + scale[ix] + 12 * (Math.floor(degree / n) + octave) + modulation;
}
function makeScore(track, index) {
  const notes = [];
  const random = seeded(0x21f00d + index * 7907);
  const isGentle = track.id === 'title' || track.id === 'ending' || track.id === 'playersScore';
  const add = (beat, length, pitch, voice, velocity, pan = 0) => notes.push({
    beat: +beat.toFixed(5), length: +length.toFixed(5), pitch, voice,
    velocity: +velocity.toFixed(4), pan: +pan.toFixed(4),
  });
  const sections = [
    { name: 'intro', bar: 0, bars: 4, theme: 'motif', shift: 0 },
    { name: 'A', bar: 4, bars: 16, theme: 'motif', shift: 0 },
    { name: 'B', bar: 20, bars: 16, theme: 'answer', shift: track.mode === 'major' ? 5 : 3 },
    { name: 'bridge', bar: 36, bars: 8, theme: 'answer', shift: -2 },
    { name: 'reprise', bar: 44, bars: 8, theme: 'motif', shift: 0 },
  ];
  const phraseBeats = track.rhythm.reduce((a, b) => a + b, 0);
  // A phrase is exactly four bars, regardless of its local syncopation.
  const rhythmScale = 16 / phraseBeats;
  for (const section of sections) {
    const intensity = section.name === 'intro' ? .45 : section.name === 'bridge' ? .66 : section.name === 'reprise' ? 1 : .88;
    for (let b = 0; b < section.bars; b++) {
      const globalBar = section.bar + b;
      const beat = globalBar * 4;
      const root = track.chords[b % track.chords.length];
      const chord = [root, root + 2, root + 4, root + 6];
      const shift = section.shift;
      // Legato strings carry harmonic changes while alternating keyboard arpeggios provide movement.
      chord.slice(0, 3).forEach((d, k) => add(beat, 3.82, degreePitch(track, d, -1, shift), 'strings', .052 * intensity, (k - 1) * .48));
      if (section.name !== 'intro' || b >= 2) {
        for (let s = 0; s < 8; s++) {
          const d = chord[(s + b + index) % chord.length];
          const inverted = ((b + index) % 3 === 0) ? -1 : 0;
          add(beat + s * .5, .30, degreePitch(track, d, inverted, shift), track.color === 'piano' ? 'bell' : 'piano', .070 * intensity, .42 * (s % 2 ? 1 : -1));
        }
      }
      // Syncopated moving bass uses roots, fifths and a pickup to the next chord.
      const bassDegrees = [root, root, root + 4, root + 4, root + 2, root + 4, root, track.chords[(b + 1) % 8] - 1];
      const bassSteps = isGentle ? [0, 2] : [0, .75, 1.5, 2, 2.75, 3.5];
      bassSteps.forEach((offset, j) => add(beat + offset, isGentle ? 1.65 : .36, degreePitch(track, bassDegrees[j % bassDegrees.length], -2, shift), 'bass', .135 * intensity, -.06));
      if (section.name === 'intro' && b < 2) continue;
      const soft = isGentle ? .42 : 1;
      [0, 2, ...(b % 4 === 3 && !isGentle ? [3.5] : [])].forEach(offset => add(beat + offset, .32, 36, 'kick', .35 * intensity * soft));
      [1, 3].forEach(offset => add(beat + offset, .19, 38, 'snare', .17 * intensity * soft, .09));
      const hats = section.name === 'bridge' ? 4 : 8;
      for (let s = 0; s < hats; s++) add(beat + s * (4 / hats), .075, 42, 'hat', (.018 + (s % 2 ? .016 : .026)) * intensity * soft, s % 2 ? .28 : -.24);
      if (b % 8 === 0 && section.name !== 'intro') add(beat, 1.2, 49, 'cymbal', .08 * intensity * soft, -.22);
      if (b % 8 === 7 && !isGentle) {
        [3, 3.25, 3.5, 3.75].forEach((offset, j) => add(beat + offset, .13, 43 - j * 2, 'tom', .12 * intensity, -.32 + .21 * j));
      }
    }
    // Melody and counter-melody, each with rests and deliberate phrase endings.
    const theme = track[section.theme];
    for (let phrase = 0; phrase < section.bars / 4; phrase++) {
      let cursor = (section.bar + phrase * 4) * 4;
      theme.forEach((degree, n) => {
        const length = track.rhythm[n] * rhythmScale;
        const intro = section.name === 'intro';
        const bridge = section.name === 'bridge';
        const variation = phrase % 4 === 3 && n >= 12 ? (n % 2 ? 2 : 1) : 0;
        const voice = bridge ? track.color : track.voice;
        if (!intro || n >= 4) add(cursor, length * (n === 15 ? .79 : .88), degreePitch(track, degree + variation, intro ? 0 : 1, section.shift), voice, (.102 + random() * .012) * intensity, -.15);
        if (!intro && (n % 2 === 1 || section.name === 'reprise') && n < 15) {
          const response = track[section.theme === 'motif' ? 'answer' : 'motif'];
          add(cursor + length * .35, length * .59, degreePitch(track, response[(15 - n + phrase * 3) % 16], 0, section.shift), track.color, .048 * intensity, .34);
        }
        cursor += length;
      });
    }
  }
  return {
    id: track.id, title: track.title, bpm: track.bpm, beatsPerBar: 4,
    keyMidi: track.key, mode: track.mode, seed: 0x21f00d + index * 7907,
    motifDegrees: track.motif, answerDegrees: track.answer,
    rhythm: track.rhythm.map(v => +(v * rhythmScale).toFixed(7)), harmonyDegrees: track.chords,
    sections, notes: notes.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch),
  };
}

const TABLE_SIZE = 4096;
const SIN = Float32Array.from({ length: TABLE_SIZE + 1 }, (_, i) => Math.sin(TAU * i / TABLE_SIZE));
function osc(phase) {
  const p = (phase - Math.floor(phase)) * TABLE_SIZE;
  const i = p | 0;
  return SIN[i] + (SIN[i + 1] - SIN[i]) * (p - i);
}
const PROFILES = {
  piano: { attack: .007, release: .14, decay: 2.0, harmonics: [1, .36, .16, .065, .025], detune: .0006 },
  brass: { attack: .022, release: .065, decay: .37, harmonics: [1, .43, .22, .14, .08, .04], detune: .0011 },
  flute: { attack: .036, release: .11, decay: .17, harmonics: [1, .075, .035], detune: .0004 },
  bell: { attack: .003, release: .24, decay: 3.3, harmonics: [1, .12, .24, .06, .16], detune: .00025 },
  strings: { attack: .16, release: .25, decay: .12, harmonics: [1, .22, .12, .05, .027], detune: .0018 },
  bass: { attack: .004, release: .055, decay: .85, harmonics: [1, .18, .035], detune: 0 },
};
function render(score) {
  const beatFrames = RATE * 60 / score.bpm;
  const frames = Math.round((INTRO_BARS + LOOP_BARS) * 4 * beatFrames);
  const loopStartFrame = Math.round(INTRO_BARS * 4 * beatFrames);
  const loopFrames = frames - loopStartFrame;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const random = seeded(score.seed ^ 0xa11d10);
  const place = (frame, value, lg, rg) => {
    if (frame >= frames) frame = loopStartFrame + ((frame - frames) % loopFrames);
    left[frame] += value * lg;
    right[frame] += value * rg;
  };
  for (const note of score.notes) {
    const start = Math.round(note.beat * beatFrames);
    const requestedHold = Math.round(note.length * beatFrames);
    const lg = Math.sqrt((1 - note.pan) / 2), rg = Math.sqrt((1 + note.pan) / 2);
    const profile = PROFILES[note.voice];
    if (profile) {
      const attack = Math.max(1, Math.round(profile.attack * RATE));
      const release = Math.round(profile.release * RATE);
      // Intro notes must finish their release BEFORE the loop boundary. Otherwise
      // the first loop would contain both the intro tail and the folded reprise tail.
      const hold = start < loopStartFrame
        ? Math.max(0, Math.min(requestedHold, loopStartFrame - start - release))
        : requestedHold;
      const end = Math.min(hold + release, frames);
      const hz = 440 * 2 ** ((note.pitch - 69) / 12);
      const harmonicWeights = profile.harmonics.map((w, h) => hz * (h + 1) > RATE * .42 ? 0 : w * Math.exp(-h * hz / 6600));
      const norm = harmonicWeights.reduce((a, b) => a + b, 0);
      let phase = 0, detunePhase = .11, decay = 1;
      const phaseStep = hz / RATE;
      const decayStep = Math.exp(-profile.decay / RATE);
      for (let i = 0; i < end; i++) {
        const a = i < attack ? .5 - .5 * Math.cos(Math.PI * i / attack) : 1;
        const r = i < hold ? 1 : Math.max(0, 1 - (i - hold) / release) ** 2;
        let wave = 0;
        for (let h = 0; h < harmonicWeights.length; h++) wave += osc(phase * (h + 1)) * harmonicWeights[h];
        wave /= norm;
        if (profile.detune) wave = wave * .87 + osc(detunePhase) * .13;
        place(start + i, wave * a * r * decay * note.velocity, lg, rg);
        phase += phaseStep;
        detunePhase += phaseStep * (1 + profile.detune);
        decay *= decayStep;
      }
    } else {
      const length = Math.round((note.voice === 'cymbal' ? 1.25 : note.voice === 'kick' ? .33 : note.voice === 'tom' ? .20 : note.voice === 'snare' ? .19 : .075) * RATE);
      let noiseLow = 0, phase = 0;
      for (let i = 0; i < length; i++) {
        const t = i / RATE;
        const noise = random() * 2 - 1;
        noiseLow += (noise - noiseLow) * .30;
        const hi = noise - noiseLow;
        let value;
        if (note.voice === 'kick') {
          phase += (49 + 107 * Math.exp(-t * 39)) / RATE;
          value = osc(phase) * Math.exp(-t * 15) + hi * Math.exp(-t * 160) * .075;
        } else if (note.voice === 'snare') {
          phase += 176 / RATE;
          value = (hi * .68 + osc(phase) * .32) * Math.exp(-t * 26);
        } else if (note.voice === 'tom') {
          phase += (82 + (note.pitch - 35) * 8 + 30 * Math.exp(-t * 20)) / RATE;
          value = osc(phase) * Math.exp(-t * 22) + hi * Math.exp(-t * 75) * .12;
        } else value = hi * Math.exp(-t * (note.voice === 'hat' ? 95 : 7));
        const antiClick = Math.min(1, i / 20) * Math.min(1, (length - 1 - i) / 64);
        place(start + i, value * antiClick * note.velocity, lg, rg);
      }
    }
  }
  // A short, low-level stereo ambience: circular in the loop to maintain the exact seam.
  const dryLeft = Float32Array.from(left), dryRight = Float32Array.from(right);
  const taps = [[.073, .08], [.137, .054], [.219, .026]];
  for (let frame = 0; frame < frames; frame++) {
    for (const [delay, gain] of taps) {
      let source = frame - Math.round(RATE * delay);
      if (frame >= loopStartFrame && source < loopStartFrame) source += loopFrames;
      if (source >= 0) {
        left[frame] += dryRight[source] * gain;
        right[frame] += dryLeft[source] * gain;
      }
    }
  }
  let peak = 0, energy = 0;
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, i / (RATE * .04));
    left[i] = Math.tanh(left[i] * 2.1) * fade;
    right[i] = Math.tanh(right[i] * 2.1) * fade;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    energy += left[i] ** 2 + right[i] ** 2;
  }
  const rms = Math.sqrt(energy / (frames * 2));
  const gain = Math.min(.88 / peak, .17 / rms);
  const pcm = Buffer.alloc(frames * 4);
  let quantizedPeak = 0;
  for (let i = 0; i < frames; i++) {
    const l = Math.round(left[i] * gain * 32767), r = Math.round(right[i] * gain * 32767);
    quantizedPeak = Math.max(quantizedPeak, Math.abs(l), Math.abs(r));
    pcm.writeInt16LE(l, i * 4); pcm.writeInt16LE(r, i * 4 + 2);
  }
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22); wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 4, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40); pcm.copy(wav, 44);
  return { wav, frames, loopStartFrame, loopEndFrame: frames, peak: quantizedPeak / 32767, rms: rms * gain };
}

fs.mkdirSync(OUT, { recursive: true });
const metadata = [], scores = [];
const selected = new Set(process.argv.slice(2));
// Tracks rendered by tools/studio (sampled instruments) are listed in studio.json; they are
// merged into the metadata as they are and never re-synthesised here.
const studioFile = path.join(OUT, 'studio.json');
const studio = new Map(fs.existsSync(studioFile)
  ? JSON.parse(fs.readFileSync(studioFile, 'utf8')).tracks.map(entry => [entry.id, entry]) : []);
for (let index = 0; index < TRACKS.length; index++) {
  const track = TRACKS[index];
  const studioTrack = studio.get(track.id);
  if (studioTrack) {
    const file = `${track.id}.wav`;
    const wav = fs.readFileSync(path.join(OUT, file));
    const sha256 = crypto.createHash('sha256').update(wav).digest('hex');
    if (sha256 !== studioTrack.sha256 || (wav.length - 44) / 4 !== studioTrack.frames) {
      throw new Error(`${file} does not match assets/music/studio.json; run tools/studio/export_game.py again`);
    }
    metadata.push({
      id: track.id, title: track.title, file: `assets/music/${file}`,
      sampleRate: RATE, frames: studioTrack.frames,
      loopStartFrame: studioTrack.loopStartFrame, loopEndFrame: studioTrack.loopEndFrame,
      duration: +(studioTrack.frames / RATE).toFixed(6), bpm: studioTrack.bpm,
      description: studioTrack.description, sha256,
    });
    console.log(`${track.id}: studio track, ${(studioTrack.frames / RATE).toFixed(1)} s, loop from ${(studioTrack.loopStartFrame / RATE).toFixed(2)} s`);
    continue;
  }
  const score = makeScore(track, index);
  scores.push(score);
  // The optional id filter is useful for audition work; complete generation remains the default.
  const file = `${track.id}.wav`;
  let audio;
  if (selected.size === 0 || selected.has(track.id)) {
    audio = render(score);
    fs.writeFileSync(path.join(OUT, file), audio.wav);
  } else {
    const wav = fs.readFileSync(path.join(OUT, file));
    const frames = (wav.length - 44) / 4;
    audio = { wav, frames, loopStartFrame: Math.round(16 * RATE * 60 / track.bpm), loopEndFrame: frames };
  }
  metadata.push({
    id: track.id, title: track.title, file: `assets/music/${file}`,
    sampleRate: RATE, frames: audio.frames,
    loopStartFrame: audio.loopStartFrame, loopEndFrame: audio.loopEndFrame,
    duration: +(audio.frames / RATE).toFixed(6), bpm: track.bpm,
    description: track.description, sha256: crypto.createHash('sha256').update(audio.wav).digest('hex'),
  });
  if (audio.peak != null) console.log(`${track.id}: ${(audio.frames / RATE).toFixed(1)} s, ${score.notes.length} notes, peak ${audio.peak.toFixed(3)}, RMS ${audio.rms.toFixed(3)}`);
}
fs.writeFileSync(path.join(OUT, 'scores.json'), JSON.stringify({
  provenance: 'Tracks not listed in studio.json: original motifs, harmonies and score authored for 东方归名录; offline deterministic synthesis; no sampled music or quoted melody.',
  format: 'beat-addressed note event score, MIDI pitches, normalized voice velocity and stereo pan',
  sampleRate: RATE, tracks: scores,
}, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'src/music-data.ts'),
  '/** Original game-specific BGM. Integer frames are the canonical loop positions. */\n' +
  `export const MUSIC_TRACKS = Object.freeze(${JSON.stringify(metadata, null, 2)}.map(track => Object.freeze(track)));\n\n` +
  'export function musicTrack(id:string) {\n  return MUSIC_TRACKS.find(track => track.id === id) ?? MUSIC_TRACKS[0];\n}\n\n' +
  'export function musicLoopSeconds(track:(typeof MUSIC_TRACKS)[number]) {\n  return { start: track.loopStartFrame / track.sampleRate, end: track.loopEndFrame / track.sampleRate };\n}\n');
