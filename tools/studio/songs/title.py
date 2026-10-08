"""Title: the road with the lanterns still lit. A minor, 124 BPM.

4-bar intro of piano and harp, then a 32-bar loop: A (flute over piano and harp) / B (violins, oboe) /
chorus (violins + flute, horn, soft kit) / A' (oboe, clarinet). E major closes the loop into A minor."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, swell
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'title'
BPM = 124
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 100
HALL = 2.6
LEAD = 'flute'
MELODIC = ('oboe', 'clarinet')
LEADS = ('flute', 'violins', 'oboe')
TARGETS = {'clarinet': -9.5, 'horn': -10.5, 'trumpet': -9.0, 'glock': -12.0}
SCALE = {9, 11, 0, 2, 4, 5, 7, 8}   # A natural minor plus G#

INTRO = progression('Am | F | C | G', bar=0)
A_CH = progression('Am | F | C | G | Am | F | Dm | E', bar=4)
B_CH = progression('F | G | Am | Em | F | G | Dm:2 E:2 | E', bar=12)
C_CH = progression('F | G | Am | C | F | G | Dm | E', bar=20)
A2_CH = progression('Am | F | C | G | Am | F | Dm | E', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 C6:4 A5:4 | G5:8 E5:4 C6:4 | B5:4 D6:4 G5:8 |'
A_MEL = ('E5:6 A5:2 C6:4 D6:4 | A5:6 F5:2 C6:4 A5:4 | G5:6 E5:2 C5:4 E5:4 | D5:6 G5:2 B5:4 G5:4 | '
         'E5:6 A5:2 C6:4 E6:4 | C6:6 A5:2 F5:4 A5:4 | D6:6 C6:2 A5:4 F5:4 | G#5:8 B5:4 E6:4 |')
B_MEL = ('C6:8 A5:4 F5:4 | B5:8 D6:4 G6:4 | C6:6 E6:2 A6:4 E6:4 | B5:6 G5:2 E5:4 G5:4 | '
         'A5:6 C6:2 F6:4 C6:4 | G6:6 D6:2 B5:4 D6:4 | F6:4 D6:4 E6:4 B5:4 | G#5:8 B5:4 E6:2 G#6:2 |')
C_MEL = ('A5:4 C6:4 F6:8 | G6:4 D6:4 B5:8 | E6:6 C6:2 A5:4 C6:4 | G6:6 E6:2 C6:4 E6:4 | '
         'F6:6 C6:2 A5:4 C6:4 | D6:4 G6:4 B6:4 G6:4 | A6:6 F6:2 D6:4 F6:4 | B5:4 G#5:4 E5:8 |')
HORN = 'C5:16 | D5:16 | E5:16 | E5:16 | C5:16 | D5:16 | F4:16 | G#4:16 |'


def build():
    P = {}
    P['flute'] = lead(I_MEL, 0, 70) + lead(A_MEL, 4, 78) + double(lead(C_MEL, 20, 66), 0)
    P['oboe'] = lead(B_MEL, 12, 60) + double(lead(A_MEL, 28, 76), 0)
    P['violins'] = lead(B_MEL, 12, 78) + lead(C_MEL, 20, 82) + sustained(pick(A2_CH, 28, 36), 'A3', 'A4', 3, vel=56)
    P['clarinet'] = double(lead(A_MEL, 28, 58), -12) + double(lead(A_MEL, 4, 48), -12)
    P['horn'] = lead(HORN, 20, 66, gate=1.0)
    P['trumpet'] = double(lead(C_MEL, 20, 56), 0)
    P['glock'] = lead(I_MEL, 0, 58) + arpeggio(pick(CHORDS, 20, 28), 'A5', 'A6', [0, 1, 2, 1], step=1.0, vel=48, accent=0)
    P['harp'] = (arpeggio(INTRO, 'A3', 'A6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=56, accent=6)
                 + arpeggio(pick(CHORDS, 4, 20) + pick(CHORDS, 28, 36), 'A3', 'A5', [0, 2, 3, 2], step=0.5, vel=54, accent=6))
    P['piano'] = (arpeggio(INTRO, 'A2', 'A5', [0, 1, 2, 3, 2, 1, 2, 1], step=0.5, vel=60, accent=8)
                  + arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'A2', 'A4', [0, 2, 1, 3, 2, 1, 3, 1], step=0.5, vel=62, accent=6)
                  + arpeggio(pick(CHORDS, 12, 20), 'A2', 'A4', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'A2', 'A5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=70, accent=8))
    P['violas'] = sustained(pick(CHORDS, 4, 36), 'A3', 'A4', 3, vel=54)
    P['celli'] = roots(pick(CHORDS, 4, 20), 'A1', 'G#2', vel=68) + arpeggio(pick(CHORDS, 20, 36), 'A1', 'A2', [0, 2], step=0.5, vel=70, accent=8)
    P['pad'] = sustained(pick(CHORDS, 4, 36), 'A3', 'A4', 4, vel=52)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'half', 80, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'pedal', 82, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'sync', 90, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'half', 84, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'lighter'), (12, 20, 'sparse'), (20, 28, 'light'), (28, 36, 'lighter')]) + fill_at(3, 'stop')
    swell(P['violins'], 12, 20, -2, 8)
    intros.apply(P, 'piano_solo', INTRO)
    return P, {'harp': {'gain': 8.0}}
