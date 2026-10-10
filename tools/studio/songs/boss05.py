"""Stage 5 Boss: Mikage Fusae, the upright proofreader of the blank library. A minor, 160 BPM.

She is a paper shikigami: courteous, orderly, and happy to accept an exception once it is proved. The music is
upright and symmetrical in the same way: a solo violin states a four-bar question and answers it a step higher,
a piano keeps a steady Baroque motor of sixteenths underneath, and everything is plucked or bowed crisply like a
page being folded. Nothing swings and nothing shouts.

4-bar intro (the violin reads the first line alone over harp), then a 32-bar loop:
A (solo violin, piano motor, plucked cellos, tight kit) /
B (the exception is granted: oboe over harp in the relative major, the violin joins in unison and the strings rise) /
chorus (the whole string section sings an arching tune, flute and oboe on top, harp sweeps, horns and timpani) /
A' (the violin again, flute doubling an octave up, oboe in unison).
E major closes every section, so the loop returns to A minor."""
from studio.layers import (K, bass_part, crash_at, double, drum_part, fill_at, lead, pick, pizz, swell, timp_roll, tpt_hits, trem, within)
from studio.score import arpeggio, progression, sustained
from studio.core import Note, midi

TITLE = 'boss05'
BPM = 160
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 205
HALL = 2.0
LEAD = 'violins'
MELODIC = ('oboe', 'oboe#2', 'flute', 'clarinet')
LEADS = ('violins', 'oboe')
TARGETS = {'clarinet': -9.5, 'flute': -9.5, 'oboe#2': -9.5, 'horn': -10.5, 'harp': -10.0, 'glock': -12.0, 'gong': -14.0}
SCALE = {9, 11, 0, 2, 4, 5, 7, 8}   # A natural minor plus the leading tone G#

INTRO = progression('Am | F | Dm | E', bar=0)
A_CH = progression('Am | F | Dm | E | Am | F | Dm | E', bar=4)
B_CH = progression('C | G | Am | Em | F | C/E | Dm | E', bar=12)
C_CH = progression('Am | F | C | G | Am | F | Dm | E', bar=20)
A2_CH = progression('Am | F | Dm | E | Am | F | Dm | E', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

# The violin reads the first line alone.
I_MEL = 'r:8 E5:4 A5:4 | C6:6 B5:2 A5:4 F5:4 | D6:6 C6:2 B5:4 A5:4 | G#5:4 B5:4 E6:8 |'
# A: a question (bars 1-4) and its answer a step higher (bars 5-8), both closing on the dominant.
A_MEL = ('E5:4 A5:2 B5:2 C6:4 B5:2 A5:2 | A5:4 F5:2 G5:2 A5:6 C6:2 | D6:4 C6:2 A5:2 B5:4 A5:2 F5:2 | E5:6 G#5:2 B5:4 E6:4 | '
         'A5:4 C6:2 E6:2 A6:4 G6:2 E6:2 | F6:4 E6:2 C6:2 A5:6 C6:2 | D6:4 F6:2 E6:2 D6:4 C6:2 B5:2 | B5:4 G#5:4 E5:8 |')
# B: the exception granted, a calm singing line in C major.
B_MEL = ('E5:6 G5:2 C6:8 | B5:6 A5:2 G5:8 | A5:4 C6:4 E6:8 | G5:6 B5:2 E6:4 D6:4 | '
         'C6:6 A5:2 F5:8 | G5:6 E5:2 G5:4 C6:4 | D6:6 C6:2 D6:4 F6:4 | E6:8 B5:4 G#5:2 B5:2 |')
# Chorus: one long arch, up to A6 and back down to the dominant.
C_MEL = ('A5:6 C6:2 E6:8 | F6:6 E6:2 C6:8 | E6:6 D6:2 C6:4 G5:4 | B5:4 D6:4 G6:8 | '
         'A6:6 G6:2 E6:4 C6:4 | F6:4 A6:4 G6:4 F6:4 | A5:4 D6:4 F6:4 D6:4 | D6:4 B5:4 G#5:8 |')


def build():
    P = {}
    A_SPANS = pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36)
    B_SPANS = pick(CHORDS, 12, 20)
    C_SPANS = pick(CHORDS, 20, 28)
    P['violins'] = (lead(I_MEL, 0, 66) + lead(A_MEL, 4, 90) + within(lead(B_MEL, 12, 70), 16, 20)
                    + lead(C_MEL, 20, 84) + lead(A_MEL, 28, 94))
    P['violins#2'] = swell(sustained(pick(CHORDS, 16, 20), 'A3', 'A4', 3, vel=50), 16, 20, 0, 18)
    P['clarinet'] = lead(A_MEL, 4, 50) + lead(A_MEL, 28, 52)
    P['oboe'] = lead(B_MEL, 12, 82)
    P['oboe#2'] = lead(C_MEL, 20, 56) + lead(A_MEL, 28, 56)
    P['flute'] = double(lead(C_MEL, 20, 62), 12) + double(lead(A_MEL, 28, 64), 12)
    P['piano'] = (arpeggio(A_SPANS, 'A3', 'A5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=54, accent=10, gate=0.8)
                  + arpeggio(B_SPANS, 'A2', 'A4', [0, 2, 1, 2], step=0.5, vel=46, accent=6, gate=0.9)
                  + arpeggio(C_SPANS, 'A3', 'A5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=60, accent=10, gate=0.8))
    P['harp'] = (arpeggio(pick(CHORDS, 0, 4), 'A2', 'A5', [0, 1, 2, 3, 2, 1], step=0.5, vel=52, accent=0, gate=1.4)
                 + arpeggio(B_SPANS, 'C3', 'C6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.5, vel=56, accent=0, gate=1.4)
                 + arpeggio(C_SPANS, 'A3', 'A6', [0, 1, 2, 3, 4, 5, 4, 3], step=0.5, vel=50, accent=0, gate=1.4))
    P['celli'] = (pizz(arpeggio(A_SPANS, 'A1', 'A2', [0, None, 1, None], step=1.0, vel=72, accent=8))
                  + swell(sustained(pick(CHORDS, 0, 4), 'A1', 'A2', 2, vel=40), 0, 4, 0, 14)
                  + sustained(B_SPANS, 'A1', 'A2', 2, vel=58)
                  + arpeggio(C_SPANS, 'A1', 'A2', [0, 1], step=0.5, vel=74, accent=8))
    P['violas'] = (swell(sustained(pick(CHORDS, 0, 4), 'A3', 'A4', 3, vel=34), 0, 4, 0, 14)
                   + trem(sustained(A_SPANS, 'A3', 'A4', 3, vel=50))
                   + sustained(B_SPANS, 'A3', 'A4', 3, vel=48)
                   + trem(sustained(C_SPANS, 'A3', 'A4', 3, vel=58)))
    P['horn'] = sustained(C_SPANS, 'E3', 'E4', 3, vel=58)
    P['pad'] = sustained(pick(CHORDS, 20, 36), 'A3', 'A4', 3, vel=52)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'drive', 96, context=CHORDS)
                 + bass_part(pick(CHORDS, 12, 20), 'half', 90, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'octave', 100, context=CHORDS)
                 + bass_part(pick(CHORDS, 28, 36), 'drive', 100, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 74, context=CHORDS))
    P['drums'] = (drum_part([(4, 12, 'drive'), (12, 16, 'light'), (16, 20, 'build'), (20, 28, 'drive2'), (28, 36, 'rock')])
                  + fill_at(3, 'roll') + crash_at(12))
    P['timpani'] = (tpt_hits(4, 'A1', 108) + timp_roll(3, 'E2', 'A1', 96)[:-1] + tpt_hits(12, 'A1', 96)
                    + timp_roll(19, 'E2', 'A1') + tpt_hits(28, 'A1', 108) + timp_roll(35, 'E2', 'A1')[:-1])
    P['gong'] = [Note(20 * 4, 4, 60, 100, '', {})]
    return P, {}
