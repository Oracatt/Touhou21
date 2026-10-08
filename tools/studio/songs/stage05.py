"""Stage 5: the last page of the book. D major, 148 BPM.

4-bar intro of glock and harp, then a 32-bar loop: A (flute over marimba, plucked strings) / B (oboe, violins) /
chorus (trumpet + violins, piccolo, xylophone) / A' (piccolo and oboe). The A chord closes the loop into D."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, pizz, swell
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'stage05'
BPM = 148
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 105
HALL = 2.0
LEAD = 'flute'
MELODIC = ('oboe', 'piccolo')
LEADS = ('flute', 'oboe', 'violins', 'trumpet')
TARGETS = {'piccolo': -10.0, 'marimba': -11.0, 'xylo': -11.5, 'clarinet': -11.0}
SCALE = {2, 4, 6, 7, 9, 11, 1}   # D major

INTRO = progression('D | Bm | G | A', bar=0)
A_CH = progression('D | A | Bm | F#m | G | D | Em | A', bar=4)
B_CH = progression('G | A | F#m | Bm | G | A | Bm:2 A:2 | A', bar=12)
C_CH = progression('D | A | Bm | G | D | A | G | A', bar=20)
A2_CH = progression('D | A | Bm | F#m | G | D | Em | A', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 F#5:4 D6:4 | B5:8 D6:4 G6:4 | E6:4 C#6:4 A5:4 E5:4 |'
A_MEL = ('F#5:2 A5:2 D6:4 D6:2 E6:2 F#6:4 | E6:3 E6:1 C#6:4 A5:4 E5:4 | D6:4 F#6:2 D6:2 B5:4 F#5:4 | A5:4 C#6:2 A5:2 F#6:4 C#6:4 | '
         'D6:3 D6:1 B5:4 G5:4 B5:4 | A5:4 F#5:2 A5:2 D6:6 A5:2 | G5:4 B5:4 E6:4 B5:2 G5:2 | E6:4 C#6:4 A5:4 E5:2 A5:2 |')
B_MEL = ('B5:6 D6:2 G6:4 D6:4 | E6:6 C#6:2 A5:4 C#6:4 | C#6:6 A5:2 F#5:4 A5:4 | D6:6 F#6:2 B6:4 F#6:4 | '
         'G5:2 B5:2 D6:4 G6:6 D6:2 | A5:2 C#6:2 E6:4 A6:6 E6:2 | F#6:4 D6:4 C#6:4 E6:4 | A5:8 C#6:4 E6:2 A6:2 |')
C_MEL = ('A5:3 A5:3 D6:2 F#6:4 A6:4 | E6:3 E6:3 A5:2 C#6:4 E6:4 | F#6:3 F#6:3 B5:2 D6:4 F#6:4 | G6:3 G6:3 B5:2 D6:4 G6:4 | '
         'A6:3 F#6:1 D6:4 F#6:4 A6:4 | E6:3 C#6:1 A5:4 C#6:4 E6:4 | D6:6 B5:2 G5:4 B5:4 | E6:8 C#6:4 E6:2 A6:2 |')


def build():
    P = {}
    P['flute'] = lead(I_MEL, 0, 70) + lead(A_MEL, 4, 86) + double(lead(C_MEL, 20, 66), 0)
    P['oboe'] = lead(B_MEL, 12, 80) + double(lead(A_MEL, 28, 76), 0)
    P['piccolo'] = double(lead(A_MEL, 28, 56), 12) + double(lead(C_MEL, 20, 60), 12)
    P['violins'] = lead(B_MEL, 12, 66) + lead(C_MEL, 20, 82)
    P['trumpet'] = lead(C_MEL, 20, 86)
    P['clarinet'] = double(lead(A_MEL, 4, 54), -12)
    P['marimba'] = (arpeggio(pick(CHORDS, 4, 12), 'D4', 'D6', [0, 1, 2, 1, 3, 1, 2, 1], step=0.5, vel=64, accent=8)
                    + arpeggio(pick(CHORDS, 28, 36), 'D4', 'D6', [0, 1, 2, 1, 3, 1, 2, 1], step=0.5, vel=66, accent=8))
    P['xylo'] = arpeggio(pick(CHORDS, 20, 28), 'D5', 'D6', [0, 2, 1, 2], step=0.25, vel=58, accent=6)
    P['glock'] = lead(I_MEL, 0, 60)
    P['harp'] = (arpeggio(INTRO, 'D4', 'D6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=56, accent=6)
                 + arpeggio(pick(CHORDS, 12, 20), 'D4', 'D6', [0, 2, 3, 2], step=0.5, vel=54, accent=6))
    P['piano'] = (arpeggio(pick(CHORDS, 12, 20), 'D3', 'D5', [0, 2, 1, 2], step=0.5, vel=62, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'D3', 'D5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=72, accent=8))
    P['violins#2'] = pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'D4', 'D5', [0, 2, 1, 2], step=0.5, vel=70, accent=10))
    P['celli'] = (pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'D2', 'D3', [0, None, 1, None], step=0.5, vel=78, accent=8))
                  + sustained(pick(CHORDS, 12, 28), 'D2', 'D3', 2, vel=66))
    P['violas'] = sustained(pick(CHORDS, 12, 28), 'D3', 'D4', 3, vel=58)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'D3', 'D4', 4, vel=56)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'sync', 90, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 98, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'drive', 94, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'light'), (12, 20, 'half'), (20, 28, 'dance'), (28, 36, 'drive2')]) + fill_at(3, 'stop')
    swell(P['violins'], 12, 20, -2, 8)
    intros.apply(P, 'lyric_solo', INTRO, lead='oboe')
    return P, {'harp': {'gain': 8.0}, 'marimba': {'gain': 10.0}}
