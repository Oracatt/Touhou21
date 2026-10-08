"""Shared constants, pitch names and the beat clock."""
import re
from dataclasses import dataclass, field

import numpy as np

SR = 32000
SEMI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
_NOTE = re.compile(r'^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d)$')


def midi(name):
    """Scientific pitch name (C4 = 60) to MIDI number."""
    if isinstance(name, (int, float)):
        return name
    m = _NOTE.match(name.strip())
    if not m:
        raise ValueError(f'Bad note name {name!r}')
    letter, acc, octave = m.groups()
    shift = 0 if not acc else (len(acc) if acc[0] == '#' else -len(acc))
    return 12 * (int(octave) + 1) + SEMI[letter.upper()] + shift


def note_name(value):
    n = int(round(value))
    return f'{NAMES[n % 12]}{n // 12 - 1}'


def hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def db(value):
    return 10.0 ** (value / 20.0)


@dataclass
class Clock:
    """Beat <-> seconds with piecewise-constant tempo changes."""
    bpm: float
    changes: list = field(default_factory=list)  # [(beat, bpm), ...] sorted

    def seconds(self, beat):
        t, last_beat, tempo = 0.0, 0.0, self.bpm
        for at, new in self.changes:
            if beat <= at:
                break
            t += (at - last_beat) * 60.0 / tempo
            last_beat, tempo = at, new
        return t + (beat - last_beat) * 60.0 / tempo

    def tempo_at(self, beat):
        tempo = self.bpm
        for at, new in self.changes:
            if beat >= at:
                tempo = new
        return tempo


@dataclass
class Note:
    beat: float          # start, in quarter-note beats
    length: float        # nominal written length, in beats
    pitch: float         # MIDI number (fractional allowed)
    vel: float = 90      # 1..127
    art: str = ''        # articulation flags: '.', '!', '_', 'g' (ghost), 'r' (roll)
    extra: dict = field(default_factory=dict)


class Rng:
    """Deterministic per-purpose random streams."""

    def __init__(self, seed):
        self.seed = seed

    def stream(self, name):
        h = 2166136261
        for ch in f'{self.seed}:{name}':
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
        return np.random.default_rng(h)
