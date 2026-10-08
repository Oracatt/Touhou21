"""Score notation.

Melody strings use 16th-note units:  "A4:1 C5 D5:2 F5:4! r:4 | [D5,F5]:8 ..."
  PITCH[:DUR][MODS]  DUR = 16ths (int or fraction such as 4/3); omitted -> previous
  MODS  ! accent   ? soft   . staccato   _ legato   ~ tie into next   ^ marcato
  @NN / @+N / @-N  set or shift the running velocity;  |  asserts a bar boundary.
"""
import re
from dataclasses import dataclass, field
from fractions import Fraction

from .core import Note, midi

TOKEN = re.compile(r'^(\[[^\]]+\]|r|[A-Ga-g][#b]{0,2}-?\d)(?::(\d+(?:/\d+)?))?([!?._~^]*)$')


def seq(text, bar=0, vel=90, beats_per_bar=4, gate=0.92, transpose=0, meta=None):
    notes, pos, dur = [], Fraction(0), Fraction(4)
    bar_units = beats_per_bar * 4
    bars_done = 0
    v = vel
    for tok in text.split():
        if tok == '|':
            bars_done += 1
            if pos != bars_done * bar_units:
                raise ValueError(f'bar {bar + bars_done}: content is {float(pos - (bars_done - 1) * bar_units)} 16ths, '
                                 f'expected {bar_units} (near {notes[-1].extra.get("src") if notes else "start"})')
            continue
        if tok.startswith('@'):
            arg = tok[1:]
            v = v + int(arg) if arg[0] in '+-' else int(arg)
            continue
        m = TOKEN.match(tok)
        if not m:
            raise ValueError(f'Bad token {tok!r}')
        pitch, d, mods = m.groups()
        if d:
            dur = Fraction(d)
        start = Fraction(bar * bar_units) + pos
        pos += dur
        if pitch == 'r':
            continue
        pitches = [midi(p) + transpose for p in pitch.strip('[]').split(',')] if pitch.startswith('[') else [midi(pitch) + transpose]
        nv = v + (14 if '!' in mods else 0) + (10 if '^' in mods else 0) - (14 if '?' in mods else 0)
        g = 0.5 if '.' in mods else 0.62 if '^' in mods else 1.0 if '_' in mods else gate
        for p in pitches:
            if notes and '~' in notes[-1].art and notes[-1].pitch == p and abs(notes[-1].beat + notes[-1].length - float(start) / 4) < 1e-9:
                prev = notes[-1]
                prev.length += float(dur) / 4
                prev.art = prev.art.replace('~', '') + mods
                prev.extra['gate'] = g
                continue
            n = Note(float(start) / 4, float(dur) / 4, p, max(1, min(127, nv)), mods,
                     {'gate': g, 'src': tok, **(meta or {})})
            notes.append(n)
    if pos % bar_units:
        raise ValueError(f'Phrase ends mid-bar ({float(pos % bar_units)} 16ths into bar {bar + int(pos // bar_units)})')
    return notes


# ------------------------------------------------------------------ chords
QUALITIES = {
    '': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10), 'm7': (0, 3, 7, 10), 'maj7': (0, 4, 7, 11),
    'sus4': (0, 5, 7), 'sus2': (0, 2, 7), '7sus4': (0, 5, 7, 10), 'dim': (0, 3, 6), 'aug': (0, 4, 8),
    'add9': (0, 4, 7, 14), 'madd9': (0, 3, 7, 14), 'm9': (0, 3, 7, 10, 14), '6': (0, 4, 7, 9), 'm6': (0, 3, 7, 9),
    '5': (0, 7), '7b9': (0, 4, 7, 10, 13), 'dim7': (0, 3, 6, 9),
}
_CHORD = re.compile(r'^([A-G][#b]?)([a-z0-9#]*)(?:/([A-G][#b]?))?$')
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def _pc(name):
    return (PC[name[0]] + (1 if name[1:] == '#' else -1 if name[1:] == 'b' else 0)) % 12


@dataclass
class Chord:
    symbol: str
    root: int
    intervals: tuple
    bass: int
    beat: float = 0.0
    length: float = 4.0

    @property
    def pcs(self):
        return sorted({(self.root + i) % 12 for i in self.intervals})


def chord(symbol):
    m = _CHORD.match(symbol)
    if not m:
        raise ValueError(f'Bad chord {symbol!r}')
    root, quality, bass = m.groups()
    if quality not in QUALITIES:
        raise ValueError(f'Unknown chord quality {quality!r} in {symbol}')
    r = _pc(root)
    return Chord(symbol, r, QUALITIES[quality], _pc(bass) if bass else r)


def progression(text, bar=0, beats_per_bar=4):
    """'Dm | Bb | Gm:2 A:2 | ...' -> chords with absolute beats."""
    out = []
    for i, chunk in enumerate(text.split('|')):
        items = chunk.split()
        if not items:
            raise ValueError(f'Empty bar in progression at {bar + i}')
        explicit = [it for it in items if ':' in it]
        lengths = []
        for it in items:
            lengths.append(float(it.split(':')[1]) if ':' in it else None)
        free = beats_per_bar - sum(l for l in lengths if l is not None)
        nfree = sum(1 for l in lengths if l is None)
        pos = (bar + i) * beats_per_bar
        for it, l in zip(items, lengths):
            length = l if l is not None else free / nfree
            c = chord(it.split(':')[0])
            c.beat, c.length = float(pos), float(length)
            out.append(c)
            pos += length
        if abs(pos - (bar + i + 1) * beats_per_bar) > 1e-9:
            raise ValueError(f'Bar {bar + i} of progression has wrong total length')
    return out


def chord_at(chords, beat):
    for c in chords:
        if c.beat <= beat + 1e-9 < c.beat + c.length:
            return c
    return None


def tones_in_range(c, low, high, include_bass=False):
    pcs = set(c.pcs)
    if include_bass:
        pcs.add(c.bass)
    return [p for p in range(midi(low), midi(high) + 1) if p % 12 in pcs]


def voicing(c, low, high, count, prev=None, top=None):
    """Pick `count` distinct chord tones within range, close to `prev`."""
    import itertools
    pool = tones_in_range(c, low, high)
    count = min(count, len(pool))
    best, best_cost = None, None
    for combo in itertools.combinations(pool, count):
        if len({p % 12 for p in combo}) < min(count, len(c.pcs)):
            continue
        if prev:
            cost = sum(min(abs(p - q) for q in prev) for p in combo)
        else:
            mid = (midi(low) + midi(high)) / 2
            cost = sum(abs(p - mid) for p in combo)
        if top is not None:
            cost += 0.5 * abs(max(combo) - midi(top))
        spread = max(combo) - min(combo)
        cost += 0.15 * spread
        if best_cost is None or cost < best_cost:
            best, best_cost = combo, cost
    if best is None:
        raise ValueError(f'No voicing for {c.symbol} in {low}-{high}')
    return list(best)


# ------------------------------------------------------- pattern generators
def sustained(chords, low, high, count, vel=70, gate=1.0, meta=None):
    notes, prev = [], None
    for c in chords:
        v = voicing(c, low, high, count, prev)
        prev = v
        for p in v:
            notes.append(Note(c.beat, c.length, p, vel, '_', {'gate': gate, **(meta or {})}))
    return notes


def arpeggio(chords, low, high, pattern, step=0.25, vel=72, accent=8, gate=0.9, span=None, meta=None):
    """pattern: indices into the ascending list of chord tones in [low, high]."""
    notes = []
    for c in chords:
        tones = tones_in_range(c, low, high)
        n = int(round(c.length / step))
        for i in range(n):
            idx = pattern[i % len(pattern)]
            if idx is None:
                continue
            p = tones[min(idx, len(tones) - 1)]
            beat = c.beat + i * step
            v = vel + (accent if abs(beat - round(beat)) < 1e-9 else 0)
            notes.append(Note(beat, step, p, v, '', {'gate': gate, **(meta or {})}))
    return notes


def roots(chords, low, high, vel=70, gate=1.0, meta=None):
    """One sustained note per chord on its bass pitch class, lowest within range."""
    notes = []
    for c in chords:
        p = next(p for p in range(midi(low), midi(high) + 1) if p % 12 == c.bass)
        notes.append(Note(c.beat, c.length, p, vel, '_', {'gate': gate, **(meta or {})}))
    return notes


def following(context, c):
    later = [d for d in context if d.beat > c.beat + 1e-9]
    return min(later, key=lambda d: d.beat) if later else c


def bass_line(chords, rhythm, octave=2, vel=96, gate=0.82, accent=10, meta=None, context=None):
    """rhythm: per-bar string of 16 steps: 'R' root, 'O' octave up, '5' fifth, 'A' approach (chromatic to next root), '.' rest."""
    notes = []
    steps = len(rhythm)
    for idx, c in enumerate(chords):
        n = int(round(c.length * 4))
        nxt = following(context, c) if context else (chords[idx + 1] if idx + 1 < len(chords) else c)
        root = 12 * (octave + 1) + c.bass
        if root > midi('G2') + 12 * (octave - 2):
            root -= 12
        for i in range(n):
            ch = rhythm[int((c.beat * 4 + i) % steps)]
            if ch in '.-':
                continue
            if ch == 'R':
                p = root
            elif ch == 'O':
                p = root + 12
            elif ch == '5':
                p = root + 7
            elif ch == 'A':
                target = 12 * (octave + 1) + nxt.bass
                if target > midi('G2') + 12 * (octave - 2):
                    target -= 12
                p = target - 1 if target - 1 >= root - 2 else target + 1
            else:
                raise ValueError(ch)
            beat = c.beat + i * 0.25
            length = 0.25
            j = i + 1
            while j < n and rhythm[int((c.beat * 4 + j) % steps)] == '-':
                length += 0.25
                j += 1
            v = vel + (accent if (c.beat * 4 + i) % 4 == 0 else 0)
            notes.append(Note(beat, length, p, v, '', {'gate': gate, **(meta or {})}))
    return notes


def stabs(chords, low, high, count, rhythm, vel=88, gate=0.6, meta=None):
    """Chord stabs on a per-bar 16-step rhythm ('x' hit, 'X' accent, '.' rest, '-' hold)."""
    notes, prev = [], None
    steps = len(rhythm)
    for c in chords:
        v = voicing(c, low, high, count, prev)
        prev = v
        n = int(round(c.length * 4))
        for i in range(n):
            ch = rhythm[int((c.beat * 4 + i) % steps)]
            if ch not in 'xX':
                continue
            length = 0.25
            j = i + 1
            while j < n and rhythm[int((c.beat * 4 + j) % steps)] == '-':
                length += 0.25
                j += 1
            for p in v:
                notes.append(Note(c.beat + i * 0.25, length, p, vel + (14 if ch == 'X' else 0), '', {'gate': gate, **(meta or {})}))
    return notes


DRUM_VEL = {'x': 100, 'X': 122, 'o': 74, 'g': 48, 'f': 112}


def drums(lines, bar=0, bars=1, kit=None):
    """lines: {'K': 'x...x...', ...}; each line covers one bar (16 or 32 steps), repeated for `bars`."""
    notes = []
    for name, grid in lines.items():
        grid = grid.replace(' ', '')
        steps = len(grid)
        for b in range(bars):
            for i, ch in enumerate(grid):
                if ch in '.-':
                    continue
                if ch not in DRUM_VEL:
                    raise ValueError(f'Bad drum step {ch!r} in {name}')
                beat = (bar + b) * 4 + i * 4 / steps
                notes.append(Note(beat, 4 / steps, kit[name] if kit else name, DRUM_VEL[ch], '', {'drum': name}))
    return notes


def transpose(notes, semis):
    return [Note(n.beat, n.length, n.pitch + semis, n.vel, n.art, dict(n.extra)) for n in notes]


def shift(notes, beats):
    return [Note(n.beat + beats, n.length, n.pitch, n.vel, n.art, dict(n.extra)) for n in notes]


def scale_vel(notes, factor=1.0, add=0):
    for n in notes:
        n.vel = max(1, min(127, n.vel * factor + add))
    return notes


def ramp_vel(notes, beat0, beat1, v0, v1):
    """Add a linear crescendo offset between two beats."""
    for n in notes:
        if beat0 <= n.beat < beat1:
            n.vel = max(1, min(127, n.vel + v0 + (v1 - v0) * (n.beat - beat0) / (beat1 - beat0)))
    return notes
