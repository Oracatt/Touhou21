"""Multisample playback: an SFZ subset plus file-name mapped libraries."""
import json
import math
import pathlib
import re
from collections import OrderedDict
from dataclasses import dataclass, replace

import numpy as np
import soundfile as sf
import soxr

from .core import SR, SEMI, db, hz


@dataclass
class Region:
    path: str
    lokey: int = 0
    hikey: int = 127
    center: float = 60.0
    lovel: int = 1
    hivel: int = 127
    lorand: float = 0.0
    hirand: float = 1.0
    trigger: str = 'attack'
    volume: float = 0.0
    tune: float = 0.0
    veltrack: float = 100.0
    rt_decay: float = 0.0
    release: float = 0.05
    keytrack: float = 100.0
    seq: int = 1
    seq_len: int = 1
    trim: int = 0          # leading frames skipped (native rate)
    pre: float = 0.0       # seconds from trimmed start to the audible onset


class SampleCache:
    """Decoded samples and pitch-shifted renders, bounded by memory."""

    def __init__(self, limit_bytes=3_000_000_000):
        self.raw_data = {}
        self.pitched = OrderedDict()
        self.limit = limit_bytes
        self.bytes = 0

    def raw(self, path):
        if path not in self.raw_data:
            data, rate = sf.read(path, dtype='float32', always_2d=True)
            if data.shape[1] == 1:
                data = np.repeat(data, 2, axis=1)
            self.raw_data[path] = (np.ascontiguousarray(data[:, :2]), rate)
        return self.raw_data[path]

    def shifted(self, path, ratio, need=None, trim=0):
        """Pitch-shifted copy at SR. For long samples only the first `need`
        output frames (rounded up to a 0.5 s bucket) are rendered."""
        data, rate = self.raw(path)
        data = data[trim:]
        full = int(len(data) * SR / (rate * ratio))
        bucket = None
        if need is not None and full > need + SR:
            bucket = min(full, int(math.ceil(need / (SR / 2)) * (SR / 2)))
        key = (path, round(ratio, 7), bucket, trim)
        hit = self.pitched.get(key)
        if hit is not None:
            self.pitched.move_to_end(key)
            return hit
        src = data if bucket is None else data[:int(bucket * rate * ratio / SR) + 4096]
        out = soxr.resample(src, rate * ratio, SR, quality='HQ').astype(np.float32)
        if bucket is not None:
            out = out[:bucket]
        self.pitched[key] = out
        self.bytes += out.nbytes
        while self.bytes > self.limit and len(self.pitched) > 1:
            _, old = self.pitched.popitem(last=False)
            self.bytes -= old.nbytes
        return out


CACHE = SampleCache()


def _opcodes(line):
    parts = re.split(r'\s+(?=[A-Za-z_0-9]+=)', line.strip())
    out = {}
    for part in parts:
        if '=' in part:
            k, v = part.split('=', 1)
            out[k.strip()] = v.strip()
    return out


def _sfz_note(value):
    try:
        return int(value)
    except ValueError:
        m = re.match(r'^([A-Ga-g])(#|b)?(-?\d)$', value)
        letter, acc, octave = m.groups()
        return 12 * (int(octave) + 1) + SEMI[letter.upper()] + (1 if acc == '#' else -1 if acc == 'b' else 0)


def load_sfz(path):
    """Parse the SFZ subset used by Salamander Grand Piano and MuldjordKit:
    <control>/<global>/<master>/<group>/<region> inheritance in file order."""
    path = pathlib.Path(path)
    base, default_path = path.parent, ''
    text = re.sub(r'//[^\n]*', '', path.read_text(encoding='utf-8', errors='replace'))
    levels = {'global': {}, 'master': {}, 'group': {}}
    order = ('global', 'master', 'group')
    header, out, pending = None, [], None
    tokens = re.split(r'(<[a-z]+>)', text)

    def flush(ops):
        merged = {**levels['global'], **levels['master'], **levels['group'], **ops}
        if 'sample' not in merged:
            return
        if 'key' in merged:
            k = _sfz_note(merged['key'])
            merged.setdefault('lokey', k)
            merged.setdefault('hikey', k)
            merged.setdefault('pitch_keycenter', k)
        lokey = _sfz_note(merged.get('lokey', '0'))
        hikey = _sfz_note(merged.get('hikey', '127'))
        if hikey < 0:
            return
        sample = (default_path + merged['sample']).replace('\\', '/')
        out.append(Region(
            path=str((base / sample).resolve()),
            lokey=lokey, hikey=hikey,
            center=float(_sfz_note(merged.get('pitch_keycenter', str(lokey)))),
            lovel=int(merged.get('lovel', 1)), hivel=int(merged.get('hivel', 127)),
            lorand=float(merged.get('lorand', 0)), hirand=float(merged.get('hirand', 1)),
            trigger=merged.get('trigger', 'attack'),
            volume=float(merged.get('volume', 0)), tune=float(merged.get('tune', 0)),
            veltrack=float(merged.get('amp_veltrack', 100)), rt_decay=float(merged.get('rt_decay', 0)),
            release=float(merged.get('ampeg_release', 0.05)), keytrack=float(merged.get('pitch_keytrack', 100)),
        ))

    for token in tokens:
        token = token.strip()
        if not token:
            continue
        if token.startswith('<'):
            if header == 'region' and pending is not None:
                flush(pending)
            header = token[1:-1]
            pending = {} if header == 'region' else None
            if header in levels:
                for lower in order[order.index(header):]:
                    levels[lower] = {}
            continue
        ops = {}
        for line in token.splitlines():
            ops.update(_opcodes(line))
        if header in levels:
            levels[header].update(ops)
        elif header == 'region':
            pending.update(ops)
        elif header == 'control':
            default_path = ops.get('default_path', default_path).replace('\\', '/')
    if header == 'region' and pending is not None:
        flush(pending)
    return out


_FILE_NOTE = re.compile(r'(?<![A-Za-z])([A-G])(#|b)?(-?\d)(?![0-9])')


def _layer_ranges(count):
    table = {1: [(1, 127)], 2: [(1, 79), (80, 127)], 3: [(1, 59), (60, 94), (95, 127)],
             4: [(1, 44), (45, 74), (75, 99), (100, 127)]}
    return table[count]


def measure_pitch(path, expected_midi, sustained=True):
    """Return the sample's actual pitch in MIDI units, searching only near the
    expected note so harmonics can never be mistaken for the fundamental."""
    data, rate = sf.read(path, dtype='float32', always_2d=True)
    return pitch_of(data, rate, expected_midi, sustained)


def pitch_of(data, rate, expected_midi, sustained=True):
    x = data.mean(axis=1) if data.ndim == 2 else data
    peak = np.abs(x).max() or 1.0
    onset = int(np.argmax(np.abs(x) > 0.08 * peak))
    a = onset + int((0.30 if sustained else 0.04) * rate)
    seg = x[a:a + int((1.2 if sustained else 0.30) * rate)]
    if len(seg) < 2048:
        return None
    seg = seg * np.hanning(len(seg))
    n = 1 << 19
    spec = np.abs(np.fft.rfft(seg, n))
    f_exp = hz(expected_midi)
    estimates, weights = [], []
    for h in range(1, 9):
        lo = int(h * f_exp * 2 ** (-0.6 / 12) * n / rate)
        hi = int(h * f_exp * 2 ** (0.6 / 12) * n / rate) + 1
        if hi + 1 >= len(spec) or h * f_exp > 0.4 * rate:
            break
        i = lo + int(np.argmax(spec[lo:hi]))
        if i <= 0 or i + 1 >= len(spec):
            continue
        y0, y1, y2 = np.log(spec[i - 1:i + 2] + 1e-12)
        d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) if (y0 - 2 * y1 + y2) != 0 else 0.0
        f = (i + d) * rate / n
        estimates.append(f / h)
        weights.append(spec[i])
    if not estimates:
        return None
    f0 = float(np.average(estimates, weights=weights))
    return 69 + 12 * math.log2(f0 / 440.0)


def wide_pitch(data, rate, sustained=True, low=24.0, high=4500.0):
    """Fundamental of a recorded note as a fractional MIDI number, searched over
    the whole audible range with a weighted harmonic comb."""
    from scipy import ndimage
    x = data.mean(axis=1) if data.ndim == 2 else data
    peak = np.abs(x).max() or 1.0
    onset = int(np.argmax(np.abs(x) > 0.08 * peak))
    a = onset + int((0.30 if sustained else 0.03) * rate)
    seg = x[a:a + int((1.0 if sustained else 0.25) * rate)]
    if len(seg) < 2048:
        seg = x[onset:onset + 4096]
    seg = seg * np.hanning(len(seg))
    n = 1 << 18
    spec = np.abs(np.fft.rfft(seg, n))
    near = ndimage.maximum_filter1d(spec, size=7)
    freqs = np.arange(low, high, 0.25)
    score = np.zeros(len(freqs))
    for h in range(1, 9):
        idx = np.round(freqs * h * n / rate).astype(int)
        ok = idx < len(near)
        score[ok] += near[idx[ok]] / math.sqrt(h)
    f = freqs[int(np.argmax(score))]
    i = int(round(f * n / rate))
    lo, hi = max(1, i - 30), i + 30
    j = lo + int(np.argmax(spec[lo:hi]))
    y0, y1, y2 = np.log(spec[j - 1:j + 2] + 1e-12)
    d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2) if (y0 - 2 * y1 + y2) != 0 else 0.0
    f0 = (j + d) * rate / n
    return 69 + 12 * math.log2(f0 / 440.0)


class Instrument:
    """A set of regions plus playback policy."""

    def __init__(self, name, regions, *, one_shot=False, release=None, veltrack=None, volume=0.0,
                 attack=0.0, max_len=None, rr_mode='cycle', pre_cap=0.0, pre_extra=0.0):
        self.name = name
        self.pre_cap = pre_cap
        self.pre_extra = pre_extra
        self.attack_regions = [r for r in regions if r.trigger == 'attack']
        self.release_regions = [r for r in regions if r.trigger == 'release']
        self.one_shot = one_shot
        self.release = release
        self.veltrack = veltrack
        self.volume = volume
        self.attack = attack
        self.max_len = max_len
        self.rr_mode = rr_mode
        self.counters = {}
        if not self.attack_regions:
            raise ValueError(f'{name}: no attack regions')
        self.lowest = min(r.lokey for r in self.attack_regions)
        self.highest = max(r.hikey for r in self.attack_regions)

    def _pick(self, regions, key, vel, rng):
        cands = [r for r in regions if r.lokey <= key <= r.hikey and r.lovel <= vel <= r.hivel]
        if not cands:
            cands = [r for r in regions if r.lokey <= key <= r.hikey]
            if not cands:
                return None
            best = min(cands, key=lambda r: abs((r.lovel + r.hivel) / 2 - vel))
            cands = [r for r in cands if r.lovel == best.lovel]
        if len(cands) == 1:
            return cands[0]
        if any(r.seq_len > 1 for r in cands):
            k = (key, cands[0].lovel)
            c = self.counters.get(k, 0)
            self.counters[k] = c + 1
            ordered = sorted(cands, key=lambda r: r.seq)
            return ordered[c % len(ordered)]
        u = rng.random()
        for r in cands:
            if r.lorand <= u < r.hirand:
                return r
        return cands[int(u * len(cands)) % len(cands)]

    def _gain(self, region, vel):
        track = self.veltrack if self.veltrack is not None else region.veltrack
        return db(region.volume + self.volume + track / 100.0 * 40.0 * math.log10(max(vel, 1) / 127.0))

    def render(self, pitch, vel, dur, rng, *, release=None, attack=None, with_pre=False):
        """Render one note to an (n, 2) float32 buffer. With `with_pre`, also
        return the seconds of attack that should precede the written onset."""
        key = int(round(pitch))
        if key < self.lowest - 7 or key > self.highest + 7:
            raise ValueError(f'{self.name}: note {pitch} outside {self.lowest}-{self.highest}')
        key = min(max(key, self.lowest), self.highest)
        region = self._pick(self.attack_regions, key, vel, rng)
        if region is None:
            raise ValueError(f'{self.name}: no region for {pitch}')
        ratio = 2.0 ** (((pitch - region.center) * region.keytrack / 100.0 + region.tune / 100.0) / 12.0)
        rel = release if release is not None else (self.release if self.release is not None else region.release)
        gain = self._gain(region, vel)
        pre = min(region.pre / ratio + self.pre_extra, self.pre_cap)
        need = None if self.one_shot else int((dur + pre) * SR) + int(rel * SR * 1.6) + 1
        data = CACHE.shifted(region.path, ratio, need, region.trim)
        if self.one_shot:
            n = len(data) if self.max_len is None else min(len(data), int(self.max_len * SR))
            out = data[:n] * gain
            if n < len(data):
                fade = min(n, int(0.02 * SR))
                out[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
            out = np.ascontiguousarray(out, dtype=np.float32)
            return (out, pre) if with_pre else out
        dur = dur + pre
        hold = max(1, int(dur * SR))
        tail = int(rel * SR * 1.6) + 1
        total = min(len(data), hold + tail)
        out = data[:total].copy()
        env = np.ones(total, dtype=np.float32)
        att = attack if attack is not None else self.attack
        if att > 0:
            k = min(total, int(att * SR))
            env[:k] = np.linspace(0, 1, k, dtype=np.float32) ** 1.5
        if total > hold:
            t = np.arange(total - hold, dtype=np.float32) / SR
            env[hold:] *= np.exp(-6.91 * t / max(rel, 1e-3))
        else:
            fade = min(total, int(0.012 * SR))
            env[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        out *= (env * gain)[:, None]
        if self.release_regions:
            rr = self._pick(self.release_regions, key, vel, rng)
            if rr is not None:
                rratio = 2.0 ** (((pitch - rr.center) * rr.keytrack / 100.0 + rr.tune / 100.0) / 12.0)
                rdata = CACHE.shifted(rr.path, rratio, int(1.5 * SR))
                rgain = self._gain(rr, vel) * db(-rr.rt_decay * dur)
                end = hold + len(rdata)
                if end > len(out):
                    out = np.concatenate([out, np.zeros((end - len(out), 2), np.float32)])
                out[hold:end] += rdata * rgain
        return (out, pre) if with_pre else out


def from_files(name, folder, *, octave_shift=12, tune_cache=None, sustained=True, extend=7, trim_db=-36,
               glob='*.wav', **policy):
    """Map a VSCO-style folder (note names, _vN layers, _rrN round robins).

    With a TuneCache every sample's real pitch is measured: the file-name octave
    is corrected, samples whose name disagrees with their sound by more than
    0.6 semitone (mislabeled files) are dropped, and the measured fractional
    pitch becomes the root so playback is in tune."""
    folder = pathlib.Path(folder)
    entries, dropped = [], 0
    for path in sorted(folder.glob(glob)):
        stem = path.stem
        matches = _FILE_NOTE.findall(stem)
        if not matches:
            continue
        letter, acc, octave = matches[-1]
        named = 12 * (int(octave) + 1) + SEMI[letter] + (1 if acc == '#' else -1 if acc == 'b' else 0)
        root = named + octave_shift
        if tune_cache is not None:
            got = tune_cache.measured(str(path.resolve()), sustained)
            k = round((got - named) / 12)
            if abs(got - named - 12 * k) > 0.6:
                dropped += 1
                continue
            root = got
        layer = re.search(r'_v(\d+)', stem)
        rr = re.search(r'_(?:rr|RR)(\d+)', stem) or re.search(r'_(\d+)(?:_[A-Za-z]+)?$', stem)
        entries.append((str(path.resolve()), root, int(layer.group(1)) if layer else 1, int(rr.group(1)) if rr else 1))
    if not entries:
        raise ValueError(f'{name}: no samples in {folder}')
    if dropped:
        print(f'  [{name}] dropped {dropped} mislabeled samples')
    layers = sorted({e[2] for e in entries})
    ranges = dict(zip(layers, _layer_ranges(len(layers))))
    regions = []
    for layer in layers:
        members = [e for e in entries if e[2] == layer]
        keys = sorted({int(round(e[1])) for e in members})
        for i, c in enumerate(keys):
            lo = c - extend if i == 0 else (keys[i - 1] + c) // 2 + 1
            hi = c + extend if i == len(keys) - 1 else (c + keys[i + 1]) // 2
            same = [e for e in members if int(round(e[1])) == c]
            for seq, e in enumerate(sorted(same, key=lambda e: e[3]), 1):
                trim, pre = (0, 0.0) if tune_cache is None else tune_cache.onset(e[0], trim_db)
                regions.append(Region(path=e[0], lokey=lo, hikey=hi, center=float(e[1]), lovel=ranges[layer][0],
                                      hivel=ranges[layer][1], seq=seq, seq_len=len(same), trim=trim, pre=pre))
    return Instrument(name, regions, **policy)

class TuneCache:
    """Measured per-sample tuning corrections, persisted between runs."""

    def __init__(self, path):
        self.path = pathlib.Path(path)
        self.data = json.loads(self.path.read_text()) if self.path.exists() else {}
        self.dirty = False

    def measured(self, sample, sustained):
        """Cached wide-range pitch of one sample (fractional MIDI)."""
        key = f'{sample}|f0'
        if key not in self.data:
            data, rate = sf.read(sample, dtype='float32', always_2d=True)
            self.data[key] = round(wide_pitch(data, rate, sustained), 3)
            self.dirty = True
        return self.data[key]

    def correction(self, sample, expected, sustained):
        key = f'{sample}|{expected}'
        if key not in self.data:
            measured = measure_pitch(sample, expected, sustained)
            self.data[key] = None if measured is None else round(measured - expected, 4)
            self.dirty = True
        dev = self.data[key]
        if dev is None or abs(dev) > 0.45:
            return 0.0
        return -dev * 100.0

    LEVELS = (-36, -30, -24, -20, -12, -6)

    def onset(self, sample, trim_db=-36):
        """(trim frames, attack seconds): skip everything before the trim_db
        crossing (minus 2 ms); the time from there to -20 dB of the peak is
        the attack that gets pre-rolled ahead of the written onset."""
        key = f'{sample}|onsets'
        if key not in self.data:
            data, rate = sf.read(sample, dtype='float32', always_2d=True)
            env = np.abs(data).max(axis=1)
            peak = env.max() or 1.0
            self.data[key] = {'rate': rate, **{str(lv): int(np.argmax(env > peak * 10 ** (lv / 20))) for lv in self.LEVELS}}
            self.dirty = True
        info = self.data[key]
        rate = info['rate']
        trim = max(0, info[str(trim_db)] - int(0.002 * rate))
        return int(trim), max(0, info['-20'] - trim) / rate

    def save(self):
        if self.dirty:
            self.path.write_text(json.dumps(self.data, indent=0))
            self.dirty = False


def with_onsets(regions, cache):
    out = []
    for r in regions:
        trim, pre = cache.onset(r.path)
        out.append(replace(r, trim=trim, pre=pre))
    return out


def retuned(instrument, cents):
    """Shift every region of an instrument (e.g. a pitched timpani)."""
    return Instrument(instrument.name, [replace(r, tune=r.tune + cents) for r in instrument.attack_regions + instrument.release_regions],
                      one_shot=instrument.one_shot, release=instrument.release, veltrack=instrument.veltrack,
                      volume=instrument.volume, attack=instrument.attack, max_len=instrument.max_len,
                      pre_cap=instrument.pre_cap)
