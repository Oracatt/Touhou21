"""Track rendering, buses and mastering."""
import math
import time
from dataclasses import dataclass, field

import numpy as np
import pyloudnorm
import soundfile as sf

from .core import SR, Clock, Rng, db
from .dsp import limit, place


@dataclass
class Track:
    name: str
    voice: object                    # callable(note, seconds, rng) -> (n, 2)
    notes: list
    gain: float = 0.0                # dB
    pan: float = 0.0
    width: float = 1.0
    fx: list = field(default_factory=list)
    sends: dict = field(default_factory=dict)
    timing: float = 0.006            # humanize: timing standard deviation (s)
    vel_sd: float = 4.0
    push: float = 0.0                # systematic early/late offset (s)
    overlap: float = 0.0             # extra seconds for legato notes


@dataclass
class Song:
    clock: Clock
    beats: float                                   # total authored beats: intro + one loop body
    tracks: list
    buses: dict = field(default_factory=dict)      # name -> callable(buffer) -> buffer
    master: list = field(default_factory=list)     # callables applied before loudness/limiter
    tail: float = 3.0
    lufs: float = -13.0
    ceiling: float = -1.0
    seed: int = 21
    intro_beats: float = 0.0                       # music before the loop point
    loop: bool = True                              # render as intro + seamless loop body
    xfade: float = 0.024                           # seconds, join repair at the two seams
    ride: object = None                            # callable(bar_index) -> dB, slow level rides per bar


def _note_rng(seed, track, key):
    h = 2166136261
    for ch in f'{seed}:{track}:{key}':
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return np.random.default_rng(h)


def expand(track, song):
    """Authored notes -> (note, key, beat offset) with the loop body repeated.

    The body is rendered twice plus a look-ahead into a third pass so the middle
    pass receives the ring-out of the previous pass and the attack pre-roll of the
    next one. Copies share a key, hence identical humanization."""
    notes = sorted(track.notes, key=lambda n: (n.beat, n.pitch if isinstance(n.pitch, (int, float)) else 0))
    if not song.loop:
        return [(n, i, 0.0) for i, n in enumerate(notes)]
    loop_beats = song.beats - song.intro_beats
    out = []
    for i, n in enumerate(notes):
        if n.beat >= song.beats - 1e-9:
            raise ValueError(f'{track.name}: note at beat {n.beat} lies after the end of the loop ({song.beats})')
        if n.beat < song.intro_beats - 1e-9:
            out.append((n, i, 0.0))
            continue
        out.append((n, i, 0.0))
        out.append((n, i, loop_beats))
        if n.beat - song.intro_beats < 8.0:
            out.append((n, i, 2 * loop_beats))
    return out


def render_track(track, song, n_total, rng_root):
    buf = np.zeros((n_total + SR * 30, 2), np.float32)
    clock = song.clock
    for note, key, off in expand(track, song):
        rng = _note_rng(song.seed, track.name, key)
        dt = float(np.clip(rng.normal(0, track.timing), -2.5 * track.timing, 2.5 * track.timing)) if track.timing else 0.0
        beat = note.beat + off
        t0 = clock.seconds(beat) + track.push + dt
        gate = note.extra.get('gate', 0.92)
        t1 = clock.seconds(beat + note.length * gate)
        seconds = max(0.03, t1 - t0 + (track.overlap if gate >= 1.0 else 0.0))
        vel = float(np.clip(note.vel + rng.normal(0, track.vel_sd), 1, 127)) if track.vel_sd else note.vel
        y = track.voice(note, seconds, rng, vel)
        pre = 0.0
        if isinstance(y, tuple):
            y, pre = y
        i = max(0, int(round((t0 - pre) * SR)))
        if i >= n_total:
            continue
        j = min(len(buf), i + len(y))
        buf[i:j] += y[:j - i]
    used = np.nonzero(np.abs(buf).max(axis=1) > 1e-7)[0]
    end = max(n_total, (used[-1] + 1) if len(used) else 0)
    buf = buf[:end]
    for fx in track.fx:
        buf = fx(buf)
    buf = place(buf, track.pan, track.width) * db(track.gain)
    return buf.astype(np.float32)


def _fit(x, n):
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros((n - len(x), 2), np.float32)])


def _ramp(n):
    return (np.sin(np.linspace(0, np.pi / 2, n, dtype=np.float32)) ** 2)[:, None]


def seamless(song, lin):
    """Cut intro + loop body out of the linear render.

    lin = intro | pass 0 | pass 1 | start of pass 2. Pass 1 is the loop body; the last
    samples of pass 0 are exactly what precedes pass 1 on a straight play-through, so
    both the body's end and the intro's end are cross-faded toward them."""
    clock = song.clock
    loop_beats = song.beats - song.intro_beats
    a = int(round(clock.seconds(song.intro_beats) * SR))
    b = int(round(clock.seconds(song.intro_beats + loop_beats) * SR))
    c = int(round(clock.seconds(song.intro_beats + 2 * loop_beats) * SR))
    x = int(song.xfade * SR)
    body = lin[b:c].copy()
    before = lin[b - x:b]
    w = _ramp(x)
    body[-x:] = body[-x:] * (1 - w) + before * w
    intro = lin[:a].copy()
    if a >= x:
        intro[-x:] = intro[-x:] * (1 - w) + before * w
    return np.concatenate([intro, body]), a, c - b


def render(song, log=print, only=None):
    clock = song.clock
    if song.loop:
        loop_beats = song.beats - song.intro_beats
        end_beats = song.intro_beats + 2 * loop_beats + 8.0
        n_total = int((clock.seconds(end_beats) + 1.0) * SR)
    else:
        n_total = int((clock.seconds(song.beats) + song.tail) * SR)
    stems, sends = {}, {name: np.zeros((n_total, 2), np.float32) for name in song.buses}
    for track in song.tracks:
        if only and track.name not in only:
            continue
        t = time.time()
        y = _fit(render_track(track, song, n_total, None), n_total)
        stems[track.name] = y
        for bus, level in track.sends.items():
            sends[bus] += y * db(level)
        log(f'  {track.name:<14} {len(track.notes):>5} notes  peak {20 * math.log10(np.abs(y).max() + 1e-9):6.1f} dBFS  {time.time() - t:5.1f}s')
    mix = np.zeros((n_total, 2), np.float32)
    for y in stems.values():
        mix += y
    returns = {}
    for name, fx in song.buses.items():
        returns[name] = _fit(fx(sends[name]), n_total)
        mix += returns[name]
    for fx in song.master:
        mix = fx(mix)
    if song.ride is not None:
        bar_s = clock.seconds(4.0)
        centers = np.arange(0, int(n_total / SR / bar_s) + 2) * bar_s + bar_s / 2
        knots = np.array([song.ride(i) for i in range(len(centers))], np.float64)
        curve = 10.0 ** (np.interp(np.arange(n_total) / SR, centers, knots) / 20.0).astype(np.float32)
        mix = mix * curve[:, None]
    meter = pyloudnorm.Meter(SR)
    if song.loop:
        measured = int(round(clock.seconds(song.intro_beats + 2 * (song.beats - song.intro_beats)) * SR))
    else:
        measured = n_total
    pre = meter.integrated_loudness(mix[:measured].astype(np.float64))
    gain = song.lufs - pre
    out, gr = limit(mix * db(gain), song.ceiling)
    for _ in range(3):
        now = meter.integrated_loudness(out[:measured].astype(np.float64))
        if abs(now - song.lufs) < 0.15:
            break
        gain += song.lufs - now
        out, gr = limit(mix * db(gain), song.ceiling)
    info = {'pre_lufs': pre, 'gain_db': gain, 'limiter_max_gr_db': gr}
    if song.loop:
        out, start, frames = seamless(song, out)
        info.update(loop_start=start, loop_frames=frames)
    else:
        fade = int(0.5 * SR)
        out[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None] ** 2
    return out, stems, returns, info


def dither16(audio, seed=1):
    """TPDF dither to int16 (the game plays 16-bit PCM)."""
    rng = np.random.default_rng(seed)
    noise = (rng.random(audio.shape) - rng.random(audio.shape)).astype(np.float32)
    return np.clip(np.round(audio * 32767.0 + noise), -32768, 32767).astype(np.int16)


def write(path, audio, subtype='PCM_24'):
    sf.write(str(path), audio, SR, subtype=subtype)