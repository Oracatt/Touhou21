"""Intro templates: every song opens in its own way instead of the same flute-and-glock-over-arpeggios figure.

Each template receives the four intro chords (one per bar, bars 0..3) and returns {part: notes}. They only use chord
tones, so they follow whatever key the song is in. `apply(P, name, chords)` clears the song's own intro notes and
mixes the chosen template in; the loop body (bar 4 onwards) is never touched."""
from .core import Note, midi
from .layers import bass_part, fill_at, trem
from .score import arpeggio, drums, ramp_vel, stabs, sustained, tones_in_range, voicing

BAR = 4.0


def _low(c, lowest):
    """First pitch at or above `lowest` that carries the chord's bass pitch class."""
    p = midi(lowest)
    while p % 12 != c.bass:
        p += 1
    return p


def _phrase(c, low, high, items, vel, gate=0.95, rel=None):
    """items: (offset in beats, length, index into the chord tones in [low, high]); returns Notes in the bar of `c`."""
    tones = tones_in_range(c, low, high)
    out = []
    for off, length, idx in items:
        out.append(Note(c.beat + off, length, tones[min(idx, len(tones) - 1)], vel + (rel or {}).get(off, 0), '', {'gate': gate}))
    return out


def _timp_roll(beat, pitch, beats=2.0, v0=34, v1=96, end_hit=None):
    n = int(beats * 8)
    out = [Note(beat + i * 0.125, 0.125, pitch, v0 + (v1 - v0) * i / max(1, n - 1), '', {}) for i in range(n)]
    if end_hit:
        out.append(Note(beat + beats, 1.0, pitch, end_hit, '', {}))
    return out


def _swell(notes, a, b, v0, v1):
    return ramp_vel(notes, a * BAR, b * BAR, v0, v1)


def piano_solo(ch):
    """A solo piano that breathes: rolled chords, a single high line on top, a harp sweep into the first bar of the song."""
    left = []
    for c in ch:
        left += arpeggio([c], 'A1', 'A4', [0, 2, 1, 3, 2, 1, 3, 2], step=0.5, vel=46, accent=6, gate=1.6)
    right = []
    for i, c in enumerate(ch):
        right += _phrase(c, 'C5', 'C6', [(0.0, 1.5, 2 if i % 2 else 0), (1.5, 0.5, 1), (2.0, 2.0, 2 + (i % 2))], 54, gate=1.0)
    sweep = arpeggio([ch[3]], 'C3', 'C7', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], step=0.125, vel=44, accent=0, gate=1.2)
    sweep = [n for n in sweep if n.beat < ch[3].beat + 2.0]
    return {'piano': left + right, 'harp': sweep + arpeggio(ch[:2], 'C4', 'C6', [0, 2], step=2.0, vel=40, accent=0, gate=1.0),
            'violas': _swell(sustained(ch[2:], 'C3', 'C4', 2, vel=40), 2, 4, 36, 58)}


def pizz_walk(ch):
    """Plucked strings and a bouncy marimba, entering one by one."""
    cello = []
    for c in ch:
        cello += arpeggio([c], 'C2', 'C4', [0, None, 2, None], step=1.0, vel=72, accent=8, gate=0.45)
    for n in cello:
        n.extra['articulation'] = 'pizz'
    marimba = arpeggio(ch[1:], 'C3', 'C5', [0, 2, 1, 2], step=0.5, vel=62, accent=6, gate=0.55)
    violin = arpeggio(ch[2:], 'C4', 'C6', [None, 1, None, 2], step=0.5, vel=66, accent=4, gate=0.45)
    for n in violin:
        n.extra['articulation'] = 'pizz'
    kit = drums({'SR': '....x.......x...'}, bar=2, bars=1, kit=_kit()) + drums({'SR': '....x...x.x.x.x.', 'S': '..............xx'}, bar=3, kit=_kit())
    return {'celli': cello, 'marimba': marimba, 'violins#2': violin, 'drums': kit}


def rain(ch):
    """Sparse drops: single high notes at uneven spacing, a soft clarinet breath underneath."""
    pattern = [[(0.0, 0.5, 4), (1.25, 0.5, 2), (2.0, 0.5, 5), (3.25, 0.5, 3)],
               [(0.5, 0.5, 3), (1.0, 0.5, 5), (2.5, 0.5, 2), (3.5, 0.5, 4)],
               [(0.0, 0.5, 5), (0.75, 0.5, 3), (1.75, 0.5, 4), (2.25, 0.5, 2), (3.0, 0.5, 3)],
               [(0.25, 0.5, 1), (0.75, 0.5, 2), (1.25, 0.5, 3), (1.75, 0.5, 4), (2.25, 0.5, 5), (2.75, 0.5, 6)]]
    drops, harp = [], []
    for i, c in enumerate(ch):
        drops += _phrase(c, 'C5', 'C7', pattern[i], 54 + 3 * i, gate=0.9)
        harp += _phrase(c, 'C3', 'C5', [(0.0, 2.0, 0), (2.0, 2.0, 1 + (i % 2))], 50, gate=1.3)
    return {'glock': drops, 'harp': harp, 'clarinet': _swell(sustained(ch, 'C3', 'C5', 1, vel=44), 0, 4, 34, 56),
            'violas': _swell(sustained(ch[1:], 'C3', 'C4', 2, vel=36), 1, 4, 32, 52)}


def horn_call(ch):
    """A horn calling across the water over a drone and soft timpani."""
    horn = []
    for i, c in enumerate(ch):
        tones = tones_in_range(c, 'C4', 'C5')
        horn.append(Note(c.beat, 3.0 if i < 3 else 4.0, tones[i % 3 if i < 3 else 0], 62 + 4 * i, '_', {'gate': 1.0}))
    drone = sustained(ch, 'C2', 'C3', 2, vel=52)
    timp = [Note(c.beat, 2.0, _low(c, 'D2'), 56 + 4 * i, '', {}) for i, c in enumerate(ch)]
    timp += _timp_roll(ch[3].beat + 2, _low(ch[3], 'D2'), 2.0, 34, 90)
    return {'horn': horn, 'celli': drone, 'contrabass': roots_low(ch, 'E1', 50), 'timpani': timp,
            'violas': _swell(sustained(ch[2:], 'C3', 'C4', 2, vel=38), 2, 4, 34, 58),
            'drums': drums({'S': '........o.o.o.xx'}, bar=3, kit=_kit())}


def pizz_ostinato(ch):
    """A fast pizzicato figure under a growing crescendo, xylophone sparks and a timpani roll."""
    vio = []
    for c in ch:
        vio += arpeggio([c], 'C4', 'C6', [0, 1, 2, 1, 0, 1, 2, 3], step=0.25, vel=56, accent=8, gate=0.4)
    for n in vio:
        n.extra['articulation'] = 'pizz'
    _swell(vio, 0, 4, 0, 26)
    cello = []
    for c in ch:
        cello += [Note(c.beat, 0.5, _low(c, 'C2') + 12, 74, '', {'gate': 0.4, 'articulation': 'pizz'}),
                  Note(c.beat + 2, 0.5, _low(c, 'C2') + 12, 66, '', {'gate': 0.4, 'articulation': 'pizz'})]
    xylo = []
    for i, c in enumerate(ch[1:], 1):
        xylo += _phrase(c, 'C6', 'C7', [(3.5, 0.5, 1), (1.5, 0.5, 2)] if i == 1 else [(3.5, 0.5, 2)], 62)
    return {'violins#2': vio, 'celli': cello, 'xylo': xylo, 'timpani': _timp_roll(ch[3].beat + 1, _low(ch[3], 'D2'), 3.0, 34, 100),
            'bassoon': sustained(ch[2:], 'C2', 'C3', 1, vel=56)}


def lyric_solo(ch, lead='clarinet', low='C4', high='C6'):
    """A lone woodwind sings through the chord tones over a barely audible bed."""
    rhythm = [[(0.0, 2.0, 1), (2.0, 1.0, 2), (3.0, 1.0, 3)],
              [(0.0, 1.5, 4), (1.5, 0.5, 3), (2.0, 2.0, 2)],
              [(0.0, 2.0, 3), (2.0, 1.0, 4), (3.0, 1.0, 5)],
              [(0.0, 4.0, 2)]]
    melody = []
    for i, c in enumerate(ch):
        melody += _phrase(c, low, high, rhythm[i], 62 + 3 * i, gate=1.0)
    return {lead: melody, 'violas': _swell(sustained(ch, 'C3', 'C4', 3, vel=34), 0, 4, 30, 48),
            'celli': _swell(sustained(ch[1:], 'C2', 'C3', 2, vel=30), 1, 4, 28, 46)}


def strings_swell(ch):
    """Dawn: the strings rise from nothing, a flute floats on top, the harp sweeps, the timpani roll leads in."""
    strings = {'violins': sustained(ch, 'G4', 'G5', 3, vel=34), 'violas': sustained(ch, 'C3', 'C4', 3, vel=34),
               'celli': sustained(ch, 'C2', 'C3', 2, vel=36)}
    for notes in strings.values():
        _swell(notes, 0, 4, 0, 44)
    flute = []
    for i, c in enumerate(ch[1:], 1):
        tones = tones_in_range(c, 'C5', 'C6')
        flute.append(Note(c.beat, 4.0, tones[(i + 1) % len(tones)], 54 + 4 * i, '_', {'gate': 1.0}))
    harp = arpeggio([ch[0], ch[2]], 'C3', 'C6', list(range(10)), step=0.25, vel=44, accent=0, gate=1.4)
    harp = [n for n in harp if n.beat % 8 < 2.5]
    return {**strings, 'flute': flute, 'harp': harp, 'timpani': _timp_roll(ch[2].beat + 2, _low(ch[2], 'D2'), 6.0, 30, 96)}


def groove(ch):
    """The band is already playing: kit and bass from the first beat, short piano stabs."""
    stab = stabs(ch, 'C3', 'C5', 3, 'x..x..x.x..x....', vel=80, gate=0.5)
    kit = (drums({'K': 'x.......x.x.....', 'S': '....x.......x...', 'H': 'x.o.x.o.x.o.x.o.'}, bar=0, bars=3, kit=_kit())
           + drums({'K': 'x...x...x.x.x.xx', 'S': '....x...xxxxxxxx'}, bar=3, kit=_kit()))
    bass = bass_part(ch, 'push', 90, context=ch)
    return {'piano': stab, 'drums': kit, 'bass': bass}


def toccata(ch):
    """A piano running up the keyboard in sixteenths, doubled by plucked violins, pinned by timpani."""
    run = []
    for i, c in enumerate(ch):
        pat = [0, 1, 2, 3, 4, 5, 4, 3] if i % 2 == 0 else [5, 4, 3, 2, 1, 0, 1, 2]
        run += arpeggio([c], 'C3', 'C6', pat, step=0.25, vel=70 + 3 * i, accent=12, gate=0.8)
    pl = arpeggio(ch[1:], 'C5', 'C7', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=58, accent=6, gate=0.5)
    timp = [Note(ch[0].beat, 1.0, _low(ch[0], 'D2'), 108, '', {}), Note(ch[2].beat, 1.0, _low(ch[2], 'D2'), 98, '', {})]
    kit = drums({'S': '....x.......x...', 'K': 'x.......x.......'}, bar=2, bars=1, kit=_kit()) + drums({'K': 'x...x...x...x...', 'S': 'xxxxxxxxxxxxxxxx'}, bar=3, kit=_kit())
    return {'piano': run, 'glock': pl, 'timpani': timp, 'drums': kit, 'contrabass': roots_low(ch[2:], 'E1', 64)}


def brass_riff(ch):
    """Low brass in unison on a heavy riff, over timpani and a marching snare."""
    tb = stabs(ch, 'C3', 'C4', 2, 'x..x..x.x..x....', vel=92, gate=0.6)
    hn = stabs(ch, 'C4', 'C5', 2, 'x..x..x.x..x....', vel=84, gate=0.6)
    timp = []
    for c in ch:
        timp += [Note(c.beat, 1.0, _low(c, 'D2'), 100, '', {}), Note(c.beat + 2.5, 0.5, _low(c, 'D2'), 78, '', {})]
    kit = drums({'S': 'o.o.x.o.o.o.x.o.', 'K': 'x...x...x...x...'}, bar=2, bars=1, kit=_kit()) + fill_at(3, 'roll')
    return {'trombone': tb, 'horn': hn, 'timpani': timp, 'contrabass': roots_low(ch, 'E1', 70), 'drums': kit}


def trem_strings(ch):
    """Shimmering tremolo strings, a plucked pulse below and a timpani heartbeat."""
    violins = trem(_swell(sustained(ch, 'G4', 'G6', 3, vel=36), 0, 4, 0, 46))
    violas = trem(_swell(sustained(ch, 'C3', 'C5', 3, vel=34), 0, 4, 0, 44))
    pulse = []
    for c in ch:
        pulse += arpeggio([c], 'C2', 'C3', [0], step=0.5, vel=60, accent=10, gate=0.4)
    for n in pulse:
        n.extra['articulation'] = 'pizz'
    return {'violins': violins, 'violas': violas, 'celli': pulse, 'timpani': _timp_roll(ch[3].beat + 2, _low(ch[3], 'D2'), 2.0, 40, 100),
            'harp': arpeggio(ch[2:], 'C4', 'C7', [0, 2, 3, 4], step=0.5, vel=48, accent=4, gate=1.0)}


def fanfare(ch):
    """Bright brass calls, a timpani roll and a crash."""
    tpt = stabs(ch, 'C4', 'C6', 2, 'X..x..x.........', vel=96, gate=0.7)
    hn = stabs(ch, 'C3', 'C5', 3, 'X..x..x.........', vel=84, gate=0.7)
    tb = sustained(ch, 'C2', 'C4', 1, vel=70)
    kit = drums({'C': 'X...............'}, bar=0, bars=1, kit=_kit()) + fill_at(3, 'roll')
    return {'trumpet': tpt, 'horn': hn, 'trombone': tb,
            'timpani': _timp_roll(ch[1].beat + 2, _low(ch[1], 'D2'), 2.0, 40, 100, 108) + _timp_roll(ch[3].beat + 1, _low(ch[3], 'D2'), 3.0, 40, 110),
            'drums': kit}


def snare_build(ch):
    """A long, rising build: a march on the snare, string swells, octave pulses on the piano and the timpani closing in."""
    kit = drums({'K': 'x...x...x...x...', 'S': 'o.o.o.o.x.x.x.x.'}, bar=0, bars=3, kit=_kit()) + fill_at(3, 'roll')
    pulse = []
    for c in ch:
        pulse += arpeggio([c], 'C3', 'C5', [0, 2, 0, 2, 0, 2, 0, 2], step=0.5, vel=56, accent=8, gate=0.7)
    _swell(pulse, 0, 4, 0, 34)
    strings = {'violins': _swell(sustained(ch, 'G4', 'G5', 3, vel=36), 0, 4, 0, 48), 'celli': _swell(sustained(ch, 'C2', 'C3', 2, vel=38), 0, 4, 0, 44)}
    return {'drums': kit, 'piano': pulse, **strings, 'timpani': _timp_roll(ch[1].beat + 2, _low(ch[1], 'D2'), 2.0, 34, 80) + _timp_roll(ch[3].beat + 1, _low(ch[3], 'D2'), 3.0, 40, 110)}


def gong_dark(ch):
    """A gong, low strings trembling in the dark and a slow heartbeat; the harp and violins arrive last."""
    gong = [Note(0.0, 8.0, _low(ch[0], 'C2'), 90, '', {})]
    low = trem(_swell(sustained(ch, 'C2', 'C3', 2, vel=36), 0, 4, 0, 36))
    heart = []
    for c in ch:
        heart += [Note(c.beat + 1.0, 1.0, _low(c, 'D2'), 68, '', {}), Note(c.beat + 2.5, 1.0, _low(c, 'D2'), 56, '', {})]
    hi = trem(_swell(sustained(ch[2:], 'G4', 'G6', 3, vel=32), 2, 4, 0, 46))
    return {'gong': gong, 'celli': low, 'contrabass': roots_low(ch, 'E1', 56), 'timpani': heart, 'violins': hi,
            'piano': arpeggio(ch, 'C2', 'C4', [0, 2], step=2.0, vel=44, accent=0, gate=1.8)}


def roots_low(ch, lowest, vel):
    return [Note(c.beat, c.length, _low(c, lowest), vel, '_', {'gate': 1.0}) for c in ch]


def _kit():
    from . import library
    return library.KIT


TEMPLATES = {n.__name__: n for n in (piano_solo, pizz_walk, rain, horn_call, pizz_ostinato, lyric_solo, strings_swell, groove,
                                     toccata, brass_riff, trem_strings, fanfare, snare_build, gong_dark)}


def apply(P, name, chords, intro_bars=4, **kw):
    """Replace the song's own intro (everything before `intro_bars`) with template `name`."""
    limit = intro_bars * BAR
    for part in list(P):
        P[part] = [n for n in P[part] if n.beat >= limit]
        if not P[part]:
            del P[part]
    for part, notes in TEMPLATES[name](chords[:intro_bars], **kw).items():
        P.setdefault(part, [])
        P[part] = sorted(P[part] + [n for n in notes if n.beat < limit], key=lambda n: (n.beat, n.pitch))
    return P
