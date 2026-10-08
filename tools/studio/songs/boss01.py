"""Stage 1 Boss: Tobira Akari's theme.

D minor, 156 BPM. 8-bar intro (lantern arpeggio, then the 3+3+2 riff), then a 40-bar loop:
A 9-24 (the "call" motif answered from left and right), B 25-32 (rising strings),
chorus 33-48. The chorus ends on Dm so the loop returns straight into A.
"""
from studio import library as lib
from studio.core import Clock, Note, midi
from studio.score import (arpeggio, bass_line, drums, progression, ramp_vel, roots, seq, stabs, sustained,
                          transpose)

TITLE = 'boss01'
BPM = 156
INTRO_BARS, LOOP_BARS = 8, 40
SEED = 21
HALL = 2.1
LEAD = 'trumpet'
MELODIC = ('flute', 'oboe')
LEADS = ('trumpet',)
TARGETS = {'violins': -8.0, 'piano': -9.0, 'flute': -10.5, 'oboe': -11.0, 'synlead': -10.0, 'timpani': -12.0}
SCALE = {2, 4, 5, 7, 9, 10, 0, 1}   # D natural minor plus the harmonic-minor C#

# --------------------------------------------------------------- harmony
INTRO = progression('Dm | Bb | C | Asus4:2 A:2 | Dm | Bb | C | A7', bar=0)
SOFT, FULL = INTRO[:5], INTRO[5:]                 # bars 1-4 / 5-8
SEC_A = progression('Dm | Dm | Bb | C | Dm | Dm | Gm | A | Dm | Dm | Bb | C | F | Bb | Gm:2 A:2 | Dm', bar=8)
A1, A2 = SEC_A[:8], SEC_A[8:]                     # bars 9-16 / 17-24
SEC_B = progression('Gm | Am | Bb | C | Gm | Am | Bb:2 C:2 | Asus4:2 A:2', bar=24)
CHORUS = progression('Bb | C | Am | Dm | Bb | C | Dm | A | Gm | C | F | Bb | Gm | A | Dm | Dm', bar=32)
ALL = CHORDS = INTRO + SEC_A + SEC_B + CHORUS
SECTIONS = [('intro soft', 0, 4), ('intro riff', 4, 8), ('A', 8, 24), ('B', 24, 32), ('chorus', 32, 48)]

# ---------------------------------------------------------------- melody
RIFF = ('D5:3! D5:3! F5:2 E5:2 D5:2 C5:2 A4:2 | Bb4:3! Bb4:3! D5:2 F5:4 D5:2 C5:2 | '
        'C5:3! C5:3! E5:2 G5:2 F5:2 E5:2 G5:2 | A5:6! G5:1 F5:1 E5:2 D5:2 C#5:4 |')
A_MEL = ('A4:1 C5 D5:2 F5:4 E5:2 D5 C5 D5 | A4:8 r:8 | Bb4:1 D5 F5:2 Bb5:4 A5:2 G5 F5 G5 | A5:8 G5:4 E5:4 | '
         'F5:1 E5 D5:2 A5:4 G5:2 F5 E5 F5 | D5:8 r:8 | G4:1 Bb4 D5:2 G5:4 F5:2 E5 D5 E5 | C#5:8 A4:4 E5:4 | '
         'A4:1 C5 D5:2 F5:4 E5:2 D5 C5 D5 | A5:8 G5:2 F5 E5 F5 | D5:1 F5 Bb5:2 D6:4 C6:2 Bb5 A5 Bb5 | C6:8 Bb5:4 G5:4 | '
         'A5:6 G5:2 F5:4 C5:4 | D5:6 E5:2 F5:4 Bb5:4 | Bb5:4 G5:4 E5:4 C#5:4 | D5:12 r:4 |')
B_MEL = ('D5:6 Bb4:2 D5:4 G5:4 | E5:6 C5:2 E5:4 A5:4 | F5:6 D5:2 F5:4 Bb5:4 | G5:12 A5:2 Bb5:2 | '
         'Bb5:6 A5:2 G5:4 D5:4 | C6:6 A5:2 E5:4 A5:4 | F5:2 G5 A5 Bb5 C6:2 Bb5 A5 G5 | A5:16 |')
PICKUP = 'r:12 A4:1 C#5 D5 E5 |'
CHORUS_MEL = ('F5:6 E5:2 D5:2 E5:2 F5:2 G5:2 | A5:6 G5:2 E5:4 C5:4 | E5:3 F5:3 G5:2 A5:2 G5:2 E5:2 C5:2 | '
              'D5:8 r:4 A4:1 C5 D5 E5 | F5:6 E5:2 D5:2 E5:2 F5:2 Bb5:2 | A5:3 G5:3 E5:2 G5:4 C6:4 | '
              'A5:6 G5:2 F5:2 E5:2 D5:2 E5:2 | E5:6 C#5:2 A4:2 C#5:2 E5:4 | G5:6 F5:2 G5:2 A5:2 Bb5:2 D6:2 | '
              'C6:6 Bb5:2 A5:2 G5:2 E5:4 | A5:3 G5:3 F5:2 C6:4 A5:4 | Bb5:6 A5:2 G5:2 F5:2 D5:4 | '
              'G5:3 A5:3 Bb5:2 D6:4 C6:2 Bb5:2 | A5:6 G5:2 E5:2 F5:2 E5:2 C#5:2 | D5:4 F5:4 A5:4 D6:4 | D6:12 r:4 |')
GLISS = 'r:8 ' + ' '.join(f'{p}:1/2' for p in 'A3 D4 E4 F4 G4 A4 C#5 D5 E5 F5 G5 A5 C#6 D6 E6 F6'.split()) + ' |'

LANTERN = [2, 1, 0, 1, 3, 2, 1, 2, 4, 3, 2, 3, 5, 4, 3, 4]   # climbing broken chords: the circling lanterns
EIGHTHS_OCT = 'R.R.O.R.R.R.O.R.'
EIGHTHS_TURN = 'R.R.O.R.R.O.R.A.'


def bars(notes, first, last):
    """Notes whose onset lies in bars first..last (0-based, inclusive)."""
    return [n for n in notes if first * 4 <= n.beat < (last + 1) * 4]


def octave_pair(notes):
    return notes + transpose(notes, -12)


def lead_line(vel_a=90, vel_c=106):
    notes = seq(RIFF, bar=4, vel=96)
    notes += seq(A_MEL, bar=8, vel=vel_a)
    notes += seq(PICKUP, bar=31, vel=96)
    notes += seq(CHORUS_MEL, bar=32, vel=vel_c)
    ramp_vel(notes, 8 * 4, 16 * 4, -4, 2)
    ramp_vel(notes, 16 * 4, 24 * 4, 0, 6)
    ramp_vel(notes, 40 * 4, 48 * 4, 2, 8)
    return notes


def build():
    parts = {}
    parts['trumpet'] = lead_line()

    # ---------------------------------------------------------- piano
    piano = bars(arpeggio(SOFT, 'F4', 'F6', LANTERN, vel=58, accent=8), 0, 3)
    ramp_vel(piano, 0, 16, 0, 14)
    piano += octave_pair(roots(SOFT, 'A1', 'G#2', vel=70))
    piano += octave_pair(seq(RIFF, bar=4, vel=84))
    piano += stabs(FULL, 'D3', 'D4', 3, 'x..x..x.x...x...', vel=78, gate=0.7)
    piano += seq(A_MEL, bar=8, vel=78)
    piano += arpeggio(SEC_A, 'D3', 'D4', [0, 2, 1, 2], step=0.5, vel=66, accent=6)
    piano += arpeggio(SEC_B, 'A3', 'A5', LANTERN, vel=58, accent=8)
    piano += roots(SEC_B, 'A1', 'G#2', vel=72)
    piano += octave_pair(seq(CHORUS_MEL, bar=32, vel=92))
    piano += arpeggio(CHORUS, 'D3', 'D4', [0, 2, 1, 2], step=0.5, vel=70, accent=6)
    parts['piano'] = piano

    # -------------------------------------------------------- strings
    vln = sustained(INTRO[2:5], 'E4', 'E5', 3, vel=58)
    ramp_vel(vln, 8, 16, 0, 26)
    vln += seq(RIFF, bar=4, vel=88)
    vln += sustained(A1, 'D4', 'D5', 2, vel=52)
    vln += sustained(A2, 'D4', 'D5', 3, vel=60)
    b = seq(B_MEL, bar=24, vel=82)
    ramp_vel(b, 24 * 4, 32 * 4, 0, 18)
    vln += b
    vln += transpose(seq(CHORUS_MEL, bar=32, vel=88), -12)
    parts['violins'] = vln

    vla = arpeggio(FULL, 'A3', 'A4', [0, 1], step=0.5, vel=74, accent=8)
    vla += arpeggio(A2, 'A3', 'A4', [0, 1], step=0.5, vel=66, accent=8)
    vla += sustained(SEC_B, 'F3', 'F4', 2, vel=68)
    vla += arpeggio(CHORUS, 'A3', 'A4', [0, 1], step=0.5, vel=78, accent=8)
    parts['violas'] = vla

    vc = roots(SOFT, 'D2', 'C#3', vel=60)
    vc += arpeggio(FULL, 'D2', 'D3', [0, 2], step=0.5, vel=76, accent=8)
    vc += arpeggio(SEC_A, 'D2', 'D3', [0, 2], step=0.5, vel=68, accent=8)
    vc += roots(SEC_B, 'D2', 'C#3', vel=74)
    vc += arpeggio(CHORUS, 'D2', 'D3', [0, 2], step=0.5, vel=80, accent=8)
    parts['celli'] = vc

    # ------------------------------------------- woodwinds: calls from both sides
    fl = seq('r:8 A5:1 C6 D6:2 F6:4 |', bar=1, vel=70)
    fl += seq('r:8 A5:1 C6 D6:2 F6:4 |', bar=9, vel=78)
    fl += bars(seq(A_MEL, bar=8, vel=58), 16, 23)
    b = seq(B_MEL, bar=24, vel=70)
    fl += transpose(bars(b, 24, 27), 12) + bars(b, 28, 31)
    fl += bars(seq(CHORUS_MEL, bar=32, vel=74), 40, 47)
    parts['flute'] = fl

    ob = seq('r:8 A4:1 C#5 D5:2 E5:4 |', bar=3, vel=76)
    ob += seq('r:8 F5:1 E5 D5:2 A5:4 |', bar=13, vel=82)
    parts['oboe'] = ob

    # ------------------------------------------------- glock and harp sparkle
    gl = seq('D6:8 A6:8 | D6:8 Bb6:8 | E6:8 C7:8 | E6:8 C#7:8 |', bar=0, vel=66)
    gl += bars(transpose(seq(CHORUS_MEL, bar=32, vel=60), 12), 40, 47)
    parts['glock'] = gl

    parts['harp'] = seq(GLISS, bar=3, vel=70) + seq(GLISS, bar=31, vel=74)

    # --------------------------------------------- timpani rolls into downbeats
    tp = []
    for bar, roll, hit in ((3, 'A2', 'D2'), (31, 'A2', 'F2')):
        tp += [Note(bar * 4 + 2 + i * 0.125, 0.125, midi(roll), 40 + i * 4, '', {}) for i in range(16)]
        tp += [Note((bar + 1) * 4, 1, midi(hit), 118, '', {})]
    tp += [Note(40 * 4, 1, midi('G2'), 104, '', {})]
    parts['timpani'] = tp

    # ------------------------------------------------------------- drum kit
    K = lib.KIT
    dr = drums({'S': '............xxxX', 'T3': '........o.o.....'}, bar=3, kit=K)
    dr += drums({'C': 'X...............'}, bar=4, kit=K)
    dr += drums({'K': 'x..x..x.x...x...', 'S': '....x.......x...', 'H': 'x.o.x.o.x.o.x.o.'}, bar=4, bars=3, kit=K)
    dr += drums({'K': 'x..x..x.x.......', 'S': '....x.......xxxx', 'T1': '........x.......', 'T2': '..........x.....'}, bar=7, kit=K)
    groove_a = {'K': 'x.......x.x.....', 'S': '....x..g....x...', 'H': 'x.o.x.o.x.o.x.o.'}
    groove_a2 = {'K': 'x.....x.x.....x.', 'S': '....x..g....x..g', 'H': 'xoxoxoxoxoxoxoxo'}
    fill_a = {'K': 'x.......x.......', 'S': '....x...x.x.....', 'T1': '............x...', 'T2': '.............x..',
              'T3': '..............x.', 'T4': '...............x', 'H': 'x.o.x.o.........'}
    for bar in range(8, 24):
        dr += drums(fill_a if bar in (15, 23) else groove_a if bar < 16 else groove_a2, bar=bar, kit=K)
    dr += drums({'C': 'X...............'}, bar=8, kit=K) + drums({'D': 'X...............'}, bar=16, kit=K)
    dr += drums({'K': 'x.........x.....', 'S': '........x.......', 'H': 'o.o.o.o.o.o.o.o.'}, bar=24, bars=6, kit=K)
    dr += drums({'C': 'x...............'}, bar=24, kit=K)
    dr += drums({'K': 'x...x...x...x...', 'S': 'o.o.o.o.x.x.x.x.'}, bar=30, kit=K)
    roll = drums({'K': 'x...x...x...x...', 'S': 'xxxxxxxxxxxxxxxx', 'T1': '........x.......', 'T3': '............x...'}, bar=31, kit=K)
    dr += ramp_vel(roll, 31 * 4, 32 * 4, -45, 10)
    groove_c = {'K': 'x..x..x.x...x.x.', 'S': '....x.......x...', 'R': 'x.o.x.o.x.o.x.o.'}
    fill_c = {'K': 'x..x..x.x.......', 'S': '....x...xxxxxxxx', 'T2': '............x...', 'T4': '..............x.',
              'R': 'x.o.x.o.........'}
    for bar in range(32, 48):
        dr += drums(fill_c if bar in (39, 47) else groove_c, bar=bar, kit=K)
    for bar, cym in ((32, 'C'), (36, 'D'), (40, 'C'), (44, 'D')):
        dr += drums({cym: 'X...............'}, bar=bar, kit=K)
    parts['drums'] = lib.choke_hats(dr, Clock(BPM))

    # -------------------------------------------------------------- synths
    bl = lambda chords, rhythm, vel, **kw: bass_line(chords, rhythm, vel=vel, context=ALL, **kw)  # noqa: E731
    bass = bl(FULL[:3], EIGHTHS_OCT, 96) + bl(FULL[3:], EIGHTHS_TURN, 96)
    bass += bl(A1, 'R...R.R.O...R.R.', 92)
    bass += bl(A2[:7], EIGHTHS_OCT, 94) + bl(A2[7:], EIGHTHS_TURN, 94)
    bass += bl(SEC_B[:6], 'R-------R-------', 90, gate=0.95)
    bass += bl(SEC_B[6:8], 'R.R.R.R.R.R.R.R.', 94) + bl(SEC_B[8:], 'R.R.R.R.RRRRRRRR', 96)
    for i in range(0, 16, 4):
        bass += bl(CHORUS[i:i + 3], EIGHTHS_OCT, 100) + bl(CHORUS[i + 3:i + 4], EIGHTHS_TURN, 100)
    parts['bass'] = bass

    pad = sustained(FULL, 'A3', 'C5', 4, vel=58)
    pad += sustained(A2, 'A3', 'C5', 4, vel=54)
    pad += sustained(SEC_B, 'A3', 'C5', 4, vel=68)
    pad += sustained(CHORUS, 'A3', 'C5', 4, vel=84)
    parts['pad'] = pad

    figure = [0, 1, 2, 1, 3, 2, 1, 2]
    parts['pluck'] = arpeggio(A2, 'A4', 'A5', figure, vel=62, accent=6) + arpeggio(CHORUS, 'A4', 'A5', figure, vel=72, accent=6)
    parts['synlead'] = seq(CHORUS_MEL, bar=32, vel=96)

    return parts, {}
