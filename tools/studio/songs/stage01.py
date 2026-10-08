"""Stage 1: a warm lantern walk down the night road. G major, 146 BPM.

4-bar intro, then a 32-bar loop: A (flute) / B (strings) / chorus (trumpet + full band) / A' (strings + oboe),
the last bar of A' leans on the dominant so the loop returns to the first G chord."""
from studio.layers import (bass_part, crash_at, double, drum_part, fill_at, lead, pick, swell, within)
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'stage01'
BPM = 146
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 101
HALL = 1.9
LEAD = 'flute'
MELODIC = ('oboe', 'clarinet')
LEADS = ('flute', 'trumpet', 'violins')
TARGETS = {'oboe': -8.0, 'clarinet': -14.0, 'horn': -11.0}
SCALE = {7, 9, 11, 0, 2, 4, 6}   # G major

INTRO = progression('G | Em | C | D', bar=0)
A_CH = progression('G | D | Em | Bm | C | G | Am | D', bar=4)
B_CH = progression('Em | C | G | D | Em | C | Am | D', bar=12)
C_CH = progression('G | D | Em | C | G | D | C | D', bar=20)
A2_CH = progression('G | D | Em | Bm | C | G | Am | D', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = ('r:16 | r:8 B4:2 E5:2 G5:4 | E5:6 G5:2 C6:8 | A5:4 F#5:4 D5:4 A4:2 B4:2 |')
A_MEL = ('G5:3 F#5:1 D5:4 B4:4 D5:4 | A5:3 G5:1 F#5:4 D5:4 F#5:4 | E5:4 G5:4 B5:4 A5:2 G5:2 | F#5:6 D5:2 B4:4 D5:2 F#5:2 | '
         'E5:3 G5:1 C6:4 A5:4 G5:4 | B5:4 A5:2 G5:2 D5:4 G5:4 | A5:3 G5:1 E5:4 C5:4 E5:4 | F#5:2 G5:2 A5:4 D6:4 C6:2 A5:2 |')
B_MEL = ('B5:6 G5:2 E5:4 G5:4 | G5:6 E5:2 C5:4 E5:4 | D5:2 G5:2 B5:4 D6:6 B5:2 | A5:6 F#5:2 D5:4 F#5:4 | '
         'E5:2 F#5:2 G5:2 A5:2 B5:4 E6:4 | D6:2 C6:2 B5:2 A5:2 G5:4 E5:4 | C6:6 A5:2 E5:4 A5:4 | A5:4 F#5:4 D5:4 F#5:2 A5:2 |')
C_MEL = ('B5:3 B5:3 D6:2 B5:4 G5:4 | A5:3 A5:3 D6:2 A5:4 F#5:4 | G5:3 G5:3 B5:2 E6:4 B5:4 | G5:3 G5:3 C6:2 G5:4 E5:4 | '
         'B5:3 B5:3 D6:2 G6:6 D6:2 | F#6:3 E6:1 D6:4 A5:4 D6:4 | E6:6 D6:2 C6:4 E6:4 | D6:8 A5:4 F#5:2 A5:2 |')
COUNTER = 'D5:16 | A4:16 | B4:16 | G4:16 | D5:16 | A4:16 | E5:16 | A4:16 |'   # horn / viola sustained answer under the chorus


def build():
    P = {}
    P['flute'] = lead(I_MEL, 0, 72) + lead(A_MEL, 4, 86) + lead(B_MEL, 12, 66)
    P['oboe'] = double(lead(A_MEL, 28, 80), 0) + lead(B_MEL, 12, 56)
    P['trumpet'] = lead(C_MEL, 20, 92)
    P['violins'] = lead(B_MEL, 12, 78) + double(lead(C_MEL, 20, 78), -12) + lead(A_MEL, 28, 84)
    P['clarinet'] = double(lead(A_MEL, 4, 50), -12)
    P['marimba'] = double(lead(A_MEL, 4, 62), 0) + arpeggio(pick(B_CH, 12, 20), 'D4', 'D5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
    P['glock'] = lead(I_MEL, 0, 60) + double(lead(C_MEL, 20, 58), 12)
    P['horn'] = lead(COUNTER, 20, 70, gate=1.0)

    P['piano'] = (arpeggio(INTRO, 'G3', 'G5', [0, 1, 2, 1, 3, 2, 1, 2], step=0.25, vel=58, accent=8)
                  + arpeggio(pick(CHORDS, 4, 12), 'G3', 'D5', [0, 2, 1, 2], step=0.5, vel=62, accent=6)
                  + arpeggio(pick(CHORDS, 12, 20), 'G3', 'G5', [0, 1, 2, 1], step=0.5, vel=56, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'G3', 'D5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=70, accent=8)
                  + arpeggio(pick(CHORDS, 28, 36), 'G3', 'D5', [0, 2, 1, 2], step=0.5, vel=64, accent=6))
    P['violas'] = sustained(pick(CHORDS, 0, 12), 'G3', 'G4', 3, vel=56) + sustained(pick(CHORDS, 20, 28), 'G3', 'G4', 3, vel=64)
    P['celli'] = roots(pick(CHORDS, 12, 20), 'G2', 'F#3', vel=66) + arpeggio(pick(CHORDS, 20, 36), 'G2', 'G3', [0, 2], step=0.5, vel=70, accent=8)
    P['harp'] = arpeggio(INTRO, 'G4', 'G6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=56, accent=6) + arpeggio(pick(CHORDS, 12, 20), 'G4', 'G6', [0, 2, 3, 2], step=0.5, vel=52, accent=6)
    P['pad'] = sustained(pick(CHORDS, 12, 20), 'D4', 'D5', 4, vel=54) + sustained(pick(CHORDS, 20, 36), 'D4', 'D5', 4, vel=62)

    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'eighth', 88, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 98, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'drive', 94, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 80, context=CHORDS))
    dr = drum_part([(4, 12, 'light'), (12, 20, 'half'), (20, 28, 'drive'), (28, 36, 'drive2')])
    dr += fill_at(3, 'stop')
    P['drums'] = dr
    swell(P['violins'], 28, 36, 0, 8)
    return P, {'harp': {'gain': 8.0}, 'marimba': {'gain': 10.0}, 'horn': {'gain': 3.0}}

