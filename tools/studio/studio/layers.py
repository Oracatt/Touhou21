"""Reusable accompaniment layers: grooves, fills, bass patterns and part helpers."""
from .core import Note, midi
from .score import (Chord, arpeggio, bass_line, drums, progression, ramp_vel, roots, seq, stabs, sustained, transpose)  # noqa: F401
from . import library as lib

K = lib.KIT

# 16-step bar patterns. x normal, X accent, o soft, g ghost.
GROOVES = {
    'drive':   {'K': 'x.......x.x.....', 'S': '....x.......x...', 'H': 'x.o.x.o.x.o.x.o.'},
    'drive2':  {'K': 'x.....x.x.....x.', 'S': '....x..g....x..g', 'H': 'xoxoxoxoxoxoxoxo'},
    'rock':    {'K': 'x..x..x.x...x.x.', 'S': '....x.......x...', 'R': 'x.o.x.o.x.o.x.o.'},
    'half':    {'K': 'x.....x.........', 'S': '........x.......', 'H': 'x.x.x.x.x.x.x.x.'},
    'dance':   {'K': 'x...x...x...x...', 'S': '....x.......x...', 'O': '..x...x...x...x.', 'H': 'o.o.o.o.o.o.o.o.'},
    'light':   {'K': 'x.......x.......', 'SR': '....x.......x...', 'R': 'x.o.x.o.x.o.x.o.'},
    'lighter': {'K': 'x.......x.......', 'SR': '................', 'H': 'o.o.o.o.o.o.o.o.'},
    'gallop':  {'K': 'x.xx..xx..xx..xx', 'S': '....x.......x...', 'H': 'x.o.x.o.x.o.x.o.'},
    'march':   {'K': 'x...x...x...x...', 'S': 'o.o.x.o.o.o.x.o.', 'H': 'x.x.x.x.x.x.x.x.'},
    'double':  {'K': 'x.xxx.xx..xxx.xx', 'S': '....x.......x...', 'H': 'xoxoxoxoxoxoxoxo'},
    'sparse':  {'K': 'x...............', 'T3': '........o.......', 'R': '..o...o...o...o.'},
    'build':   {'K': 'x...x...x...x...', 'S': 'o.o.o.o.x.x.x.x.'},
    'shuffle': {'K': 'x.....x.x.....x.', 'S': '....x.......x...', 'R': 'x..xx..xx..xx..x'},
}
FILLS = {
    'tom':     {'K': 'x.......x.......', 'S': '....x...x.x.....', 'T1': '............x...', 'T2': '.............x..',
                'T3': '..............x.', 'T4': '...............x', 'H': 'x.o.x.o.........'},
    'snare':   {'K': 'x..x..x.x.......', 'S': '....x...xxxxxxxx', 'T2': '............x...', 'T4': '..............x.',
                'H': 'x.o.x.o.........'},
    'roll':    {'K': 'x...x...x...x...', 'S': 'xxxxxxxxxxxxxxxx', 'T1': '........x.......', 'T3': '............x...'},
    'stop':    {'K': 'x...............', 'S': '..............xx'},
}


def drum_part(spans, crash=True, fills=('tom', 'snare'), phrase=4, fill_phrase=None):
    """spans: [(first_bar, last_bar_exclusive, groove), ...].

    A crash lands on the first bar of each span; the last bar of every `phrase`-th
    bar group carries a fill (alternating kinds), except in sparse/build spans."""
    notes = []
    kind = 0
    for a, b, name in spans:
        base = GROOVES[name]
        for bar in range(a, b):
            if name not in ('sparse', 'build', 'lighter') and (bar - a) % phrase == phrase - 1 and b - a >= phrase:
                notes += drums(FILLS[fills[kind % len(fills)]], bar=bar, kit=K)
                kind += 1
            else:
                notes += drums(base, bar=bar, kit=K)
        if crash and name not in ('sparse', 'build', 'lighter'):
            notes += drums({'C': 'X...............'}, bar=a, kit=K)
    return lib.choke_hats(notes, _CLOCK[0]) if _CLOCK else notes


_CLOCK = []


def set_clock(clock):
    _CLOCK[:] = [clock]


def crash_at(bar, name='C'):
    return drums({name: 'X...............'}, bar=bar, kit=K)


def fill_at(bar, kind='tom'):
    return drums(FILLS[kind], bar=bar, kit=K)


BASS = {
    'drive': 'R.R.O.R.R.R.O.R.',
    'turn':  'R.R.O.R.R.O.R.A.',
    'sync':  'R..R..R.R...R...',
    'gallop': 'R.RR..RR..RR..RR',
    'eighth': 'R.R.R.R.R.R.R.R.',
    'steady': 'RRRRRRRRRRRRRRRR',
    'push':  'R...R.R.O...R.R.',
    'half':  'R-------R.R.....',
    'whole': 'R---------------',
    'pedal': 'R.......R.......',
    'octave': 'R.O.R.O.R.O.R.O.',
    'walk':  'R.5.R.5.R.5.R.A.',
}


def bass_part(chords, style, vel=96, turn=True, octave=2, gate=0.82, context=None):
    """One bass pattern over `chords`; every 4th bar uses the turnaround if the style is 'drive'."""
    notes = []
    for c in chords:
        bar = int(c.beat // 4)
        name = 'turn' if (turn and style == 'drive' and bar % 4 == 3) else style
        notes += bass_line([c], BASS[name], octave=octave, vel=vel, gate=gate, context=context)
    return notes


def pick(chords, a, b):
    """Chords whose onset lies in bars a..b-1."""
    return [c for c in chords if a * 4 <= c.beat < b * 4]


def within(notes, a, b):
    return [n for n in notes if a * 4 <= n.beat < b * 4]


def trem(notes):
    """Mark notes as tremolo strokes (picked up by string voices that have a tremolo layer)."""
    for n in notes:
        n.art += 'r'
    return notes


def pizz(notes):
    """Force the plucked articulation on string parts that have one."""
    for n in notes:
        n.extra['articulation'] = 'pizz'
        n.extra['gate'] = 0.5
    return notes


def repeat(notes, start_bar, bars, times, step_bars=None):
    """Copy `notes` (authored at start_bar..start_bar+bars) forward `times` times."""
    out = list(notes)
    step = (step_bars or bars) * 4
    for t in range(1, times):
        out += [Note(n.beat + t * step, n.length, n.pitch, n.vel, n.art, dict(n.extra)) for n in notes]
    return out


def lead(text, bar, vel=92, **kw):
    return seq(text, bar=bar, vel=vel, **kw)


def double(notes, semis, vel=0):
    out = transpose(notes, semis)
    for n in out:
        n.vel = max(1, min(127, n.vel + vel))
    return out


def swell(notes, a, b, v0, v1):
    return ramp_vel(notes, a * 4, b * 4, v0, v1)


def hits(bar, pitches, length=1.0, vel=100, art=''):
    """Chord hit at the start of a bar."""
    return [Note(bar * 4, length, midi(p), vel, art, {'gate': 0.8}) for p in pitches]


def timp_roll(bar, roll='A2', hit='D2', vel=118):
    """Timpani roll over the second half of `bar`, ending on a hit at the next downbeat."""
    out = [Note(bar * 4 + 2 + i * 0.125, 0.125, midi(roll), 40 + i * 4, '', {}) for i in range(16)]
    out.append(Note((bar + 1) * 4, 1, midi(hit), vel, '', {}))
    return out


def tpt_hits(bar, pitch, vel=118):
    return [Note(bar * 4, 4, midi(pitch), vel, '', {})]


def figure_bass(chords, low, high, figure, step, vel=72, gate=0.5):
    """Root-position bass figures, one symbol per step: R root, O octave, 5 the chord's own fifth (diminished
    in a dim chord), 3 its third, - rest. The root is the lowest bass pitch class within [low, high]."""
    out = []
    for c in chords:
        r = next(p for p in range(midi(low), midi(high) + 1) if p % 12 == c.bass)
        tone = {'R': r, 'O': r + 12, '5': r + c.intervals[2], '3': r + c.intervals[1]}
        for k in range(int(round(c.length / step))):
            sym = figure[k % len(figure)]
            if sym != '-':
                out.append(Note(c.beat + k * step, step, tone[sym], vel + (8 if k == 0 else 0), '.', {'gate': gate}))
    return out


def legato(notes):
    """Bow every note into the next (long articulation even for short values)."""
    for n in notes:
        n.art += '_'
        n.extra['gate'] = 1.0
    return notes


def battery_hit(name, beat, vel, seconds=None):
    """One stroke of the orchestral battery; `seconds` cuts a long sound such as the snare roll."""
    extra = {'drum': name}
    if seconds:
        extra['cut'] = seconds
    return Note(beat, 1.0, lib.BATTERY[name], vel, '', extra)


def cymbal_swell(target_beat, bpm, vel=100):
    """The suspended-cymbal crescendo peaks about 1.35 s after it starts; aim the peak at `target_beat`."""
    return battery_hit('SW', target_beat - 1.35 * bpm / 60.0, vel)


def fit(notes, low, high):
    """Move notes by whole octaves into [low, high] (for doubling a line on a narrower instrument)."""
    lo, hi = midi(low), midi(high)
    for n in notes:
        while n.pitch > hi:
            n.pitch -= 12
        while n.pitch < lo:
            n.pitch += 12
    return notes
