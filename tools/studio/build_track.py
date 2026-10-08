"""Render one game track as a seamless loop and verify it.

    python build_track.py boss02            # -> build/music-studio/boss02.wav + .json
    python build_track.py boss02 --no-check # skip the score checker

A song module (songs/<id>.py) defines TITLE, BPM, INTRO_BARS, LOOP_BARS, CHORDS, SECTIONS,
SCALE (pitch classes), LEAD (name of the lead part), HALL, SEED and build() -> (parts, tweak).
The output is a 16-bit 32 kHz stereo file: `loop_start` frames of intro, then the loop body
which repeats forever (loop_end == frames)."""
import importlib
import json
import pathlib
import sys
import time

import numpy as np
import pyloudnorm

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from studio import analyze, layers, library  # noqa: E402
from studio.core import SR, Clock, note_name  # noqa: E402
from studio.mix import dither16, render  # noqa: E402
from studio.rig import build_song  # noqa: E402
from studio.score import chord_at  # noqa: E402
import soundfile as sf  # noqa: E402

OUT = HERE.parents[1] / 'build' / 'music-studio'


def harmony_report(parts, module):
    """Strong-beat check: every sustained lead note should be a chord tone or at least a scale tone."""
    lead = parts[module.LEAD]
    bad, tones, strong = [], 0, 0
    for n in lead:
        if n.beat % 2 or n.length < 1.0:
            continue
        c = chord_at(module.CHORDS, n.beat)
        if c is None:
            continue
        strong += 1
        pc = int(round(n.pitch)) % 12
        if pc in c.pcs:
            tones += 1
        elif pc not in module.SCALE:
            bad.append(f'bar {int(n.beat // 4) + 1} beat {n.beat % 4 + 1:.0f}: {note_name(n.pitch)} outside the key over {c.symbol}')
    return strong, tones, bad


SPARKLE = ('glock', 'harp', 'marimba', 'xylo', 'pluck', 'triangle', 'piccolo')


def role_target(name, module):
    """Wanted level of a part relative to the whole mix over the frames where it plays (LU)."""
    base = name.split('#')[0]
    table = getattr(module, 'TARGETS', {})
    if name in table:
        return table[name]
    if name in getattr(module, 'LEADS', ()):
        return -3.5
    if base == 'drums':
        return -6.5
    if base == 'bass':
        return -8.5
    if base in ('timpani', 'gong'):
        return -13.0
    if base == 'pad':
        return -13.0
    if base in SPARKLE:
        return -11.5
    return -10.5


def balance(stems, returns, module, region):
    """Per-part gain corrections (dB) that bring every part to its role level inside the mix."""
    meter = pyloudnorm.Meter(SR)
    mix = sum(stems.values()) + sum(returns.values())
    out = {}
    for name, y in stems.items():
        seg = y[:region]
        active = np.abs(seg).max(axis=1) > 1e-4
        if active.sum() < SR:
            continue
        try:
            part = meter.integrated_loudness(seg[active].astype(np.float64))
            whole = meter.integrated_loudness(mix[:region][active].astype(np.float64))
        except Exception:
            continue
        out[name] = (part - whole, role_target(name, module) - (part - whole))
    # only the balance matters (the master normalises loudness): remove the common offset
    if out:
        shift = float(np.median([c for _, c in out.values()]))
        out = {k: (lv, c - shift) for k, (lv, c) in out.items()}
    return out


def section_levels(stems, returns, module, clock):
    meter = pyloudnorm.Meter(SR)
    mix = sum(stems.values()) + sum(returns.values())
    out = {}
    for name, b0, b1 in module.SECTIONS:
        a, b = int(clock.seconds(b0 * 4) * SR), int(clock.seconds(b1 * 4) * SR)
        out[name] = meter.integrated_loudness(mix[a:b].astype(np.float64))
    return out


def make_ride(module, levels):
    """Bar-indexed level ride that evens out the sections (intro a little below the body)."""
    body = [v for (n, b0, b1), v in zip(module.SECTIONS, levels.values()) if b0 >= module.INTRO_BARS]
    target = float(np.median(body))
    shifts = {}
    for (n, b0, b1), v in zip(module.SECTIONS, levels.values()):
        want = target - (getattr(module, 'INTRO_DROP', 2.5) if b0 < module.INTRO_BARS else 0.0)
        shifts[n] = float(np.clip(want - v, -4.0, 9.0))
    table = []
    for n, b0, b1 in module.SECTIONS:
        table += [shifts[n]] * (b1 - b0)
    intro, loop = module.INTRO_BARS, module.LOOP_BARS

    def ride(bar):
        if bar < intro:
            return table[bar]
        return table[intro + (bar - intro) % loop]
    return ride, shifts


def loop_seam_report(audio, start, frames):
    """Click scan across the loop wrap and the intro/loop join."""
    reports = []
    w = int(0.25 * SR)
    wrap = np.concatenate([audio[-w:], audio[start:start + w]]).astype(np.float32) / 32768.0
    join = audio[max(0, start - w):start + w].astype(np.float32) / 32768.0
    for label, x in (('loop wrap', wrap), ('intro->loop join', join)):
        if len(x) < 100:
            continue
        ev = [(t, r, lv) for t, r, lv in analyze.clicks(x, threshold=25.0) if abs(t - len(x) / 2 / SR) < 0.02 or (label == 'loop wrap' and abs(t - w / SR) < 0.02)]
        d = float(np.abs(x[len(x) // 2] - x[len(x) // 2 - 1]).max())
        reports.append(f'{label}: step {d:.4f}, click candidates at the seam: {len(ev)}')
    return reports


def main():
    name = sys.argv[1]
    check = '--no-check' not in sys.argv
    module = importlib.import_module(f'songs.{name}')
    t0 = time.time()
    layers.set_clock(Clock(module.BPM))
    parts, tweak = module.build()
    total = sum(len(v) for v in parts.values())
    print(f'{name}: {module.TITLE} | {module.BPM} BPM, intro {module.INTRO_BARS} + loop {module.LOOP_BARS} bars, {total} notes in {len(parts)} parts')
    if check:
        strong, tones, bad = harmony_report(parts, module)
        print(f'lead strong beats: {tones}/{strong} chord tones, {len(bad)} outside the key')
        for line in bad[:30]:
            print('  ' + line)
        others = {k: v for k, v in parts.items() if k.split('#')[0] in ('piano', 'violins', 'violas', 'celli', 'pad', 'flute', 'oboe', 'harp', 'horn', 'clarinet', 'marimba')}
        others.pop(module.LEAD, None)
        found = analyze.clashes(parts[module.LEAD], others, module.CHORDS, melodic=getattr(module, 'MELODIC', ()))
        print(f'{len(found)} strong-beat semitone clashes against the lead')
        for line in found[:30]:
            print('  ' + line)
    tweak = {k: dict(v) for k, v in tweak.items()}
    for round_no in range(3):
        song = build_song(parts, module.BPM, module.INTRO_BARS, module.LOOP_BARS, seed=module.SEED, hall_rt=getattr(module, 'HALL', 2.1),
                          tweak=tweak, lufs=getattr(module, 'LUFS', -13.0))
        audio, stems, returns, info = render(song, log=(print if round_no == 0 else (lambda *_: None)))
        region = int(round(song.clock.seconds(song.beats) * SR))
        levels = balance(stems, returns, module, region)
        worst = max((abs(c) for _, c in levels.values()), default=0.0)
        print(f'balance pass {round_no + 1}: worst deviation {worst:.1f} LU')
        if worst < 1.6 or round_no == 2 or '--no-balance' in sys.argv:
            break
        for pn, (_, corr) in levels.items():
            tweak.setdefault(pn, {})['gain_add'] = tweak.get(pn, {}).get('gain_add', 0.0) + float(np.clip(corr * 0.9, -9, 9))
    levels_sec = section_levels(stems, returns, module, song.clock)
    ride, shifts = make_ride(module, levels_sec)
    print('section levels (LUFS): ' + ', '.join(f'{k} {v:.1f}' for k, v in levels_sec.items()) + ' -> ride ' + ', '.join(f'{k} {v:+.1f}' for k, v in shifts.items()))
    song = build_song(parts, module.BPM, module.INTRO_BARS, module.LOOP_BARS, seed=module.SEED, hall_rt=getattr(module, 'HALL', 2.1),
                      tweak=tweak, lufs=getattr(module, 'LUFS', -13.0), ride=ride)
    audio, stems, returns, info = render(song, log=lambda *_: None)
    print('part level vs mix (LU, target): ' + ', '.join(f'{pn} {lv:+.1f}/{role_target(pn, module):+.1f}' for pn, (lv, _) in levels.items()))
    print('gain adjustments: ' + ', '.join(f'{pn} {v["gain_add"]:+.1f}' for pn, v in tweak.items() if 'gain_add' in v))
    library.TUNE.save()
    start, frames = info['loop_start'], info['loop_frames']
    print(analyze.report(audio, stems, returns, info, getattr(module, 'SECTIONS', None), song.clock))
    pcm = dither16(audio, seed=module.SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'{name}.wav'
    sf.write(str(path), pcm, SR, subtype='PCM_16')
    total_frames = len(pcm)
    assert total_frames == start + frames, (total_frames, start, frames)
    for line in loop_seam_report(pcm, start, frames):
        print(line)
    peak = float(np.abs(pcm).max()) / 32768.0
    meta = {'id': name, 'title': module.TITLE, 'bpm': module.BPM, 'frames': total_frames, 'sampleRate': SR,
            'loopStartFrame': start, 'loopEndFrame': total_frames, 'intro_bars': module.INTRO_BARS, 'loop_bars': module.LOOP_BARS,
            'peak': round(peak, 4), 'description': getattr(module, 'DESCRIPTION', '')}
    (OUT / f'{name}.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'wrote {path} ({total_frames / SR:.1f} s, loop {start / SR:.2f}s -> {total_frames / SR:.2f}s) in {time.time() - t0:.1f}s')


if __name__ == '__main__':
    main()
