"""Instrument library: sample sets, articulation switching and synth patches.

Sample libraries are downloaded by tools/studio/fetch_samples.py into
build/samples (never committed)."""
import pathlib
import re
from functools import lru_cache

import numpy as np

from . import synth
from .core import SR
from .sampler import Instrument, Region, TuneCache, from_files, load_sfz, with_onsets

ROOT = pathlib.Path(__file__).resolve().parents[3] / 'build' / 'samples'
VSCO = ROOT / 'VSCO-2-CE'
PIANO_SFZ = ROOT / 'Salamander' / 'SalamanderGrandPiano-SFZ+FLAC-V3+20200602' / 'SalamanderGrandPiano-V3+20200602.sfz'
DRUM_SFZ = ROOT / 'Muldjord' / 'MuldjordKit SFZ+FLAC-20201018' / 'MuldjordKit 20201018.sfz'
TUNE = TuneCache(ROOT / 'tuning-cache.json')

KIT = {'K': 48, 'K2': 49, 'S': 50, 'S2': 51, 'H': 52, 'O': 53, 'R': 54, 'B': 55, 'R2': 56, 'B2': 57,
       'C': 58, 'D': 59, 'N': 60, 'T1': 61, 'T2': 62, 'T3': 63, 'T4': 64, 'SR': 65}


class Voice:
    """Pick an articulation for each note, then render it with its attack pre-roll."""

    def __init__(self, arts, choose, attack=None, release=None):
        self.arts, self.choose = arts, choose
        self.attack, self.release = attack or {}, release or {}

    def __call__(self, note, seconds, rng, vel):
        art = note.extra.get('articulation') or self.choose(note, seconds)
        return self.arts[art].render(note.pitch, vel, seconds, rng, attack=self.attack.get(art),
                                     release=self.release.get(art), with_pre=True)


def short_long(short, long, vib=None, short_max=0.26, vib_min=0.9, trem=None):
    def choose(note, seconds):
        if trem and 'r' in note.art:
            return trem
        if '.' in note.art or '^' in note.art or seconds < short_max:
            return short
        if vib and seconds >= vib_min:
            return vib
        return long
    return choose


def _vsco(name, folder, sustained=True, **policy):
    return from_files(name, VSCO / folder, tune_cache=TUNE, sustained=sustained, **policy)


def _short_long_voice(prefix, stac, sus, vib=None, *, short_max=0.22, attack=0.02, stac_kw=None, sus_kw=None):
    arts = {'stac': _vsco(f'{prefix}-stac', stac, False, **({'release': 0.15, 'veltrack': 50, 'pre_cap': 0.05, 'pre_extra': 0.015} | (stac_kw or {}))),
            'sus': _vsco(f'{prefix}-sus', sus, True, **({'release': 0.15, 'veltrack': 50, 'pre_cap': 0.06, 'pre_extra': 0.02} | (sus_kw or {})))}
    TUNE.save()
    return Voice(arts, short_long('stac', 'sus', None, short_max), attack={'sus': attack})


@lru_cache(None)
def piano():
    regions = with_onsets(load_sfz(PIANO_SFZ), TUNE)
    TUNE.save()
    return Voice({'n': Instrument('piano', regions, release=0.42, pre_cap=0.012)}, lambda n, s: 'n')


@lru_cache(None)
def trumpet():
    arts = {'stac': _vsco('tpt-stac', 'Brass/Trumpet/stac', False, release=0.2, veltrack=55, pre_cap=0.05, pre_extra=0.012),
            'sus': _vsco('tpt-sus', 'Brass/Trumpet/sus', release=0.12, veltrack=55, pre_cap=0.055, pre_extra=0.014),
            'vib': _vsco('tpt-vib', 'Brass/Trumpet/susvib', release=0.14, veltrack=55, pre_cap=0.055, pre_extra=0.014)}
    TUNE.save()
    return Voice(arts, short_long('stac', 'sus', 'vib', 0.24, 0.8), attack={'sus': 0.008, 'vib': 0.01})


@lru_cache(None)
def horn():
    return _short_long_voice('horn', 'Brass/F Horn/stac', 'Brass/F Horn/sus', short_max=0.24, attack=0.025,
                             stac_kw={'release': 0.2, 'pre_cap': 0.06, 'pre_extra': 0.02},
                             sus_kw={'release': 0.2, 'pre_cap': 0.08, 'pre_extra': 0.03})


@lru_cache(None)
def trombone():
    return _short_long_voice('tbn', 'Brass/Tenor Trombone/stac', 'Brass/Tenor Trombone/sus', short_max=0.24, attack=0.02,
                             stac_kw={'release': 0.2, 'pre_cap': 0.06, 'pre_extra': 0.02},
                             sus_kw={'release': 0.2, 'pre_cap': 0.08, 'pre_extra': 0.03})


@lru_cache(None)
def flute():
    arts = {'stac': _vsco('fl-stac', 'Woodwinds/Flute/stac', False, release=0.15, veltrack=50, pre_cap=0.05, pre_extra=0.015),
            'vib': _vsco('fl-vib', 'Woodwinds/Flute/susvib', release=0.16, veltrack=50, pre_cap=0.07, pre_extra=0.02)}
    TUNE.save()
    return Voice(arts, short_long('stac', 'vib', None, 0.2), attack={'vib': 0.025})


@lru_cache(None)
def oboe():
    arts = {'stac': _vsco('ob-stac', 'Woodwinds/Oboe/Stacc', False, release=0.12, veltrack=50, pre_cap=0.04, pre_extra=0.01),
            'vib': _vsco('ob-vib', 'Woodwinds/Oboe/Vib', release=0.14, veltrack=50, pre_cap=0.05, pre_extra=0.015)}
    TUNE.save()
    return Voice(arts, short_long('stac', 'vib', None, 0.2), attack={'vib': 0.02})


@lru_cache(None)
def clarinet():
    return _short_long_voice('clar', 'Woodwinds/Clarinet/stac', 'Woodwinds/Clarinet/susLong', short_max=0.2, attack=0.02,
                             stac_kw={'release': 0.12, 'pre_cap': 0.04, 'pre_extra': 0.01},
                             sus_kw={'release': 0.15, 'pre_cap': 0.05, 'pre_extra': 0.015})


@lru_cache(None)
def bassoon():
    return _short_long_voice('bsn', 'Woodwinds/Bassoon/stac', 'Woodwinds/Bassoon/sus', short_max=0.22, attack=0.02,
                             stac_kw={'release': 0.12, 'pre_cap': 0.04, 'pre_extra': 0.01},
                             sus_kw={'release': 0.15, 'pre_cap': 0.05, 'pre_extra': 0.015})


@lru_cache(None)
def piccolo():
    arts = {'stac': _vsco('pic-stac', 'Woodwinds/Piccolo/Stac', False, release=0.12, veltrack=50, pre_cap=0.03, pre_extra=0.01, extend=9),
            'sus': _vsco('pic-sus', 'Woodwinds/Piccolo/Sus', True, release=0.14, veltrack=50, pre_cap=0.05, pre_extra=0.015, extend=9)}
    TUNE.save()
    return Voice(arts, short_long('stac', 'sus', None, 0.2), attack={'sus': 0.02})


def _strings(prefix, spic, sus, pizz=None, trem=None, sus_attack=0.025):
    arts = {'spic': _vsco(f'{prefix}-spic', spic, False, release=0.12, veltrack=50, pre_cap=0.08, pre_extra=0.04),
            'sus': _vsco(f'{prefix}-sus', sus, release=0.3, veltrack=45, pre_cap=0.06, pre_extra=0.03, trim_db=-24)}
    if pizz:
        arts['pizz'] = _vsco(f'{prefix}-pizz', pizz, False, release=0.3, veltrack=50, pre_cap=0.02)
    if trem:
        arts['trem'] = _vsco(f'{prefix}-trem', trem, release=0.3, veltrack=45, pre_cap=0.06, pre_extra=0.03, trim_db=-24)
    TUNE.save()
    return Voice(arts, short_long('spic', 'sus', None, 0.22, trem='trem' if trem else None), attack={'sus': sus_attack, 'trem': sus_attack})


@lru_cache(None)
def violins():
    return _strings('vln', 'Strings/Violin Section/Spic', 'Strings/Violin Section/susVib', 'Strings/Violin Section/Pizz',
                    'Strings/Violin Section/Trem')


@lru_cache(None)
def violas():
    return _strings('vla', 'Strings/Viola Section/spic', 'Strings/Viola Section/susvib')


@lru_cache(None)
def celli():
    return _strings('vc', 'Strings/Cello Section/spic', 'Strings/Cello Section/susvib', 'Strings/Cello Section/pizzT')


@lru_cache(None)
def contrabass():
    arts = {'pizz': _vsco('cb-pizz', 'Strings/Solo Contrabass/Pizz', False, release=0.25, veltrack=50, pre_cap=0.02),
            'sus': _vsco('cb-sus', 'Strings/Solo Contrabass/SusVib', release=0.3, veltrack=45, pre_cap=0.06)}
    TUNE.save()
    return Voice(arts, short_long('pizz', 'sus', None, 0.35), attack={'sus': 0.08})


def _mallet(name, folder, release, extend=9):
    inst = _vsco(name, folder, False, release=release, veltrack=60, extend=extend, pre_cap=0.005)
    TUNE.save()
    return Voice({'n': inst}, lambda n, s: 'n')


@lru_cache(None)
def glock():
    return _mallet('glock', 'Percussion/Glock', 1.6)


@lru_cache(None)
def marimba():
    return _mallet('marimba', 'Percussion/Marimba', 1.0)


@lru_cache(None)
def xylo():
    return _mallet('xylo', 'Percussion/Xylo', 0.5)


@lru_cache(None)
def harp():
    inst = from_files('harp', VSCO / 'Strings/Harp', tune_cache=TUNE, sustained=False, release=1.8, veltrack=60, pre_cap=0.02)
    TUNE.save()
    return Voice({'n': inst}, lambda n, s: 'n')


@lru_cache(None)
def timpani():
    files = sorted((VSCO / 'Percussion/Timpani').glob('Timpani1_Hit_*.wav'))
    import soundfile as sf
    from .sampler import wide_pitch
    data, rate = sf.read(str(files[0]), dtype='float32', always_2d=True)
    center = wide_pitch(data, rate, sustained=False, low=30, high=120)
    ranges = {1: (1, 69), 3: (70, 104), 4: (105, 127)}
    regions = []
    for f in files:
        layer = int(f.stem.split('_v')[1][0])
        rr = int(f.stem.split('_rr')[1][0])
        lo, hi = ranges.get(layer, (1, 127))
        regions.append(Region(path=str(f.resolve()), lokey=28, hikey=55, center=center, lovel=lo, hivel=hi, seq=rr, seq_len=2))
    return Voice({'n': Instrument('timpani', with_onsets(regions, TUNE), one_shot=True, veltrack=40, pre_cap=0.008)},
                 lambda n, s: 'n')


def _hits(name, pattern, dynamics, max_len=None, veltrack=40):
    """Unpitched one-shots chosen by velocity from files ending in a dynamic mark."""
    order = ['pp', 'p', 'mp', 'mf', 'f', 'ff']
    found = {}
    for path in sorted(VSCO.glob(pattern)):
        m = re.search(r'_(pp|p|mp|mf|f|ff)(?:_|$)', path.stem)
        if m and m.group(1) in dynamics:
            found.setdefault(m.group(1), path)
    marks = [d for d in order if d in found]
    cuts = np.linspace(0, 128, len(marks) + 1).astype(int)
    regions = [Region(path=str(found[d].resolve()), lokey=0, hikey=127, center=60.0, keytrack=0.0, lovel=max(1, cuts[i]), hivel=cuts[i + 1] - 1 if i < len(marks) - 1 else 127)
               for i, d in enumerate(marks)]
    return Voice({'n': Instrument(name, with_onsets(regions, TUNE), one_shot=True, veltrack=veltrack, max_len=max_len, pre_cap=0.01)},
                 lambda n, s: 'n')


@lru_cache(None)
def gong():
    return _hits('gong', 'VSCO 1 Percussion/varMetal/Gong/gong_hit_*.wav', ('p', 'mf', 'f', 'ff'), max_len=9.0)


@lru_cache(None)
def triangle():
    return _hits('triangle', 'VSCO 1 Percussion/varMetal/triangle/1/triangle1_hit_*.wav', ('pp', 'mp', 'mf'), max_len=4.0)


class DrumVoice:
    def __init__(self, inst):
        self.inst = inst

    def __call__(self, note, seconds, rng, vel):
        y = self.inst.render(note.pitch, vel, seconds, rng)
        cut = note.extra.get('cut')
        if cut is not None:
            n = int(cut * SR)
            if n < len(y):
                fade = min(n, int(0.03 * SR))
                y = y[:n].copy()
                y[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
        return y


@lru_cache(None)
def kit():
    return DrumVoice(Instrument('kit', load_sfz(DRUM_SFZ), one_shot=True))


def synth_voice(fn, **kw):
    return lambda note, seconds, rng, vel: fn(note.pitch, vel, seconds, rng, **kw)


def choke_hats(notes, clock, ride_ring=1.4):
    """Open hats stop when the next hat is struck; ride hits are damped so a
    run of eighths does not pile up an 11-second wash."""
    hats = sorted([n for n in notes if n.extra.get('drum') in ('H', 'O')], key=lambda n: n.beat)
    for a, b in zip(hats, hats[1:]):
        if a.extra.get('drum') == 'O':
            a.extra['cut'] = clock.seconds(b.beat) - clock.seconds(a.beat) + 0.01
    for n in notes:
        if n.extra.get('drum') in ('R', 'R2'):
            n.extra['cut'] = ride_ring
    return notes
