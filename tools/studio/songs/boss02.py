"""Stage 2 Boss: Amamaki Shizuri, the rain that weaves. B minor, 156 BPM.

4-bar intro, then a 32-bar loop: A (violins and piano falling in 16ths, tremolo strings, gallop drums) /
B (long lines over F#m, xylophone rain) / chorus (trumpet + violins, horn and tutti) / A' again.
The chorus ends on B minor, back to the first chord of A."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'boss02'
BPM = 156
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 202
HALL = 2.2
LEAD = 'violins'
MELODIC = ('flute', 'oboe')
LEADS = ('violins', 'trumpet')
TARGETS = {'flute': -9.0, 'piano': -9.0, 'horn': -12.0, 'oboe': -10.0, 'xylo': -11.0}
SCALE = {11, 1, 2, 4, 6, 7, 9, 10}   # B minor with the harmonic-minor A#

INTRO = progression('Bm | G | D | F#', bar=0)
A_CH = progression('Bm | Bm | G | A | Bm | Bm | Em | F#', bar=4)
B_CH = progression('G | A | F#m | Bm | G | A | Bm:2 F#:2 | F#', bar=12)
C_CH = progression('G | A | Bm | F#m | G | A | F# | Bm', bar=20)
A2_CH = progression('Bm | Bm | G | A | Bm | Bm | Em | F#', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 D6:4 B5:4 | A5:8 F#5:4 D6:4 | C#6:4 A#5:4 F#5:4 A#5:4 |'
A_MEL = ('B5:2 D6:2 F#6:4 D6:2 C#6:1 B5:1 A5:4 | F#5:4 B5:4 D6:4 F#6:4 | G6:2 F#6:2 E6:4 D6:2 B5:2 G5:4 | A5:2 C#6:2 E6:4 A6:4 G6:2 E6:2 | '
         'F#6:6 D6:2 B5:4 D6:4 | B5:2 C#6:2 D6:2 E6:2 F#6:4 E6:2 D6:2 | G6:4 E6:2 G6:2 B6:4 G6:4 | A#5:4 C#6:4 F#6:4 E6:2 C#6:2 |')
B_MEL = ('B5:8 D6:4 G6:4 | C#6:8 E6:4 A6:4 | A5:6 C#6:2 F#6:4 C#6:4 | D6:6 B5:2 F#5:4 B5:4 | '
         'B5:6 D6:2 G6:4 D6:4 | E6:6 C#6:2 A5:4 C#6:4 | B5:4 D6:4 F#6:4 A#5:4 | C#6:8 A#5:4 C#6:2 F#6:2 |')
C_MEL = ('D6:3 D6:3 G6:2 D6:4 B5:4 | E6:3 E6:3 A6:2 E6:4 C#6:4 | F#6:3 F#6:3 B6:2 F#6:4 D6:4 | C#6:3 C#6:3 F#6:2 A6:4 F#6:4 | '
         'G6:3 F#6:1 E6:4 D6:4 B5:4 | A6:3 G6:1 E6:4 C#6:4 E6:4 | F#6:6 E6:2 C#6:4 A#5:4 | D6:8 B5:8 |')
HORN = 'D5:16 | E5:16 | D5:16 | C#5:16 | D5:16 | E5:16 | C#5:16 | D5:16 |'


def build():
    P = {}
    P['violins'] = lead(A_MEL, 4, 90) + lead(B_MEL, 12, 82) + lead(C_MEL, 20, 90) + lead(A_MEL, 28, 94)
    P['piano'] = (arpeggio(INTRO, 'B3', 'B5', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=58, accent=8)
                  + double(lead(A_MEL, 4, 70), 0)
                  + arpeggio(pick(CHORDS, 12, 20), 'B3', 'B5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=58, accent=8)
                  + arpeggio(pick(CHORDS, 20, 28), 'B3', 'F#5', [0, 2, 1, 2], step=0.5, vel=72, accent=8)
                  + double(lead(A_MEL, 28, 76), -12))
    P['trumpet'] = lead(C_MEL, 20, 90)
    P['flute'] = lead(I_MEL, 0, 70) + double(lead(B_MEL, 12, 60), 12) + double(lead(C_MEL, 20, 64), 12)
    P['oboe'] = double(lead(A_MEL, 28, 60), -12)
    P['horn'] = lead(HORN, 20, 70, gate=1.0)
    P['xylo'] = arpeggio(pick(CHORDS, 12, 20), 'B5', 'B6', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=56, accent=6)
    P['glock'] = lead(I_MEL, 0, 60) + double(lead(B_MEL, 12, 50), 12)
    P['violins#2'] = trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'B3', 'B4', 3, vel=60)) + trem(sustained(pick(CHORDS, 20, 28), 'B3', 'B4', 3, vel=68))
    P['violas'] = sustained(pick(CHORDS, 12, 20), 'B3', 'B4', 3, vel=62) + arpeggio(pick(CHORDS, 20, 28), 'B3', 'B4', [0, 1], step=0.5, vel=74, accent=8)
    P['celli'] = arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36) + pick(CHORDS, 20, 28), 'B2', 'B3', [0, 2], step=0.5, vel=74, accent=8) + roots(pick(CHORDS, 12, 20), 'B1', 'A#2', vel=70)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'B3', 'B4', 3, vel=58)
    P['pluck'] = arpeggio(pick(CHORDS, 20, 28), 'B4', 'B5', [0, 1, 2, 1, 3, 2, 1, 2], step=0.5, vel=60, accent=6)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 92, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 100, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 96, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 82, context=CHORDS))
    dr = drum_part([(4, 12, 'gallop'), (12, 20, 'half'), (20, 28, 'rock'), (28, 36, 'drive2')])
    P['drums'] = dr + fill_at(3, 'stop')
    P['timpani'] = timp_roll(19, 'F#2', 'F#2') + timp_roll(35, 'F#2', 'F#2')[:-1] + tpt_hits(4, 'F#2', 112)
    swell(P['violins'], 12, 20, -4, 6)
    intros.apply(P, 'toccata', INTRO)
    return P, {'celli': {'gain': 2.0}, 'xylo': {'gain': 2.0}}
