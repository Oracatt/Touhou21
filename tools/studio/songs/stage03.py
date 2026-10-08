"""Stage 3: the river ferry at dusk. F major, 138 BPM.

4-bar intro of harp and glock, then a 32-bar loop: A (oboe over marimba and plucked strings) /
B (flute, clarinet thirds) / chorus (trumpet + violins, horn answer) / A' (oboe + flute).
The chorus closes on D minor and A' on C, both pulling back to the opening F."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, pizz, swell
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'stage03'
BPM = 138
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 103
HALL = 2.0
LEAD = 'oboe'
MELODIC = ('flute', 'clarinet')
LEADS = ('oboe', 'flute', 'trumpet', 'violins')
TARGETS = {'clarinet': -9.0, 'horn': -12.0, 'xylo': -12.0}
SCALE = {5, 7, 9, 10, 0, 2, 4}   # F major

INTRO = progression('F | Bb | Gm | C', bar=0)
A_CH = progression('F | Dm | Bb | C | F | Am | Bb | C', bar=4)
B_CH = progression('Dm | Bb | F | C | Dm | Gm | Bb:2 C:2 | C', bar=12)
C_CH = progression('Bb | C | F | Dm | Bb | C | Am | Dm', bar=20)
A2_CH = progression('F | Dm | Bb | C | F | Am | Bb | C', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 D6:4 Bb5:4 | G5:8 Bb5:4 D6:4 | E6:4 C6:4 G5:4 E5:4 |'
A_MEL = ('A5:4 C6:2 A5:2 F5:4 A5:4 | D6:6 C6:2 A5:4 F5:4 | Bb5:4 D6:2 Bb5:2 F5:4 D5:4 | E5:4 G5:2 C6:2 G5:4 E5:4 | '
         'A5:4 C6:2 A5:2 F6:4 C6:4 | E6:6 C6:2 A5:4 C6:4 | D6:4 F6:4 D6:4 Bb5:2 A5:2 | G5:6 A5:2 G5:4 E5:4 |')
B_MEL = ('F5:6 A5:2 D6:4 C6:4 | Bb5:6 A5:2 F5:4 D5:4 | A5:2 C6:2 F6:4 C6:6 A5:2 | G5:6 E5:2 C5:4 E5:4 | '
         'D5:2 E5:2 F5:2 G5:2 A5:4 D6:4 | G5:6 Bb5:2 D6:4 Bb5:4 | D6:4 Bb5:4 E6:4 G6:4 | C6:8 G5:4 E5:2 G5:2 |')
C_MEL = ('D6:3 D6:3 F6:2 D6:4 Bb5:4 | E6:3 E6:3 G6:2 E6:4 C6:4 | C6:3 C6:3 F6:2 A6:4 F6:4 | D6:3 D6:3 A6:2 F6:4 D6:4 | '
         'F6:3 F6:3 D6:2 Bb6:6 F6:2 | G6:3 E6:1 C6:4 G5:4 C6:4 | E6:6 C6:2 A5:4 C6:4 | D6:8 A5:4 F5:4 |')
HORN = 'F4:16 | G4:16 | A4:16 | A4:16 | D4:16 | E4:16 | E4:16 | F4:16 |'


def build():
    P = {}
    P['oboe'] = lead(A_MEL, 4, 86) + lead(A_MEL, 28, 90)
    P['flute'] = lead(B_MEL, 12, 80) + double(lead(A_MEL, 28, 60), 12) + double(lead(C_MEL, 20, 66), 12)
    P['clarinet'] = lead(B_MEL, 12, 56)
    P['trumpet'] = lead(C_MEL, 20, 88)
    P['violins'] = double(lead(C_MEL, 20, 76), 0) + sustained(pick(B_CH, 12, 20), 'F4', 'F5', 3, vel=56)
    P['horn'] = lead(HORN, 20, 68, gate=1.0)
    P['glock'] = lead(I_MEL, 0, 58)
    P['harp'] = (arpeggio(INTRO, 'F4', 'F6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=56, accent=6)
                 + arpeggio(pick(CHORDS, 12, 20), 'F4', 'F6', [0, 2, 3, 2], step=0.5, vel=52, accent=6))
    P['marimba'] = (arpeggio(pick(CHORDS, 4, 12), 'F3', 'F5', [0, 1, 2, 1, 3, 1, 2, 1], step=0.5, vel=64, accent=8)
                    + arpeggio(pick(CHORDS, 28, 36), 'F3', 'F5', [0, 1, 2, 1, 3, 1, 2, 1], step=0.5, vel=66, accent=8))
    P['xylo'] = arpeggio(pick(CHORDS, 20, 28), 'F5', 'F6', [0, 2, 1, 2], step=0.5, vel=62, accent=6)
    P['piano'] = (arpeggio(pick(CHORDS, 12, 20), 'F3', 'F5', [0, 2, 1, 2], step=0.5, vel=62, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'F3', 'F5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=70, accent=8)
                  + arpeggio(INTRO, 'F3', 'F5', [0, 1, 2, 1], step=0.5, vel=56, accent=6))
    P['violins#2'] = pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F4', 'F5', [0, 2, 1, 2], step=0.5, vel=70, accent=10))
    P['celli'] = pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F2', 'F3', [0, None, 1, None], step=0.5, vel=78, accent=8)) + sustained(pick(CHORDS, 12, 28), 'F2', 'F3', 2, vel=66)
    P['violas'] = sustained(pick(CHORDS, 12, 28), 'F3', 'F4', 3, vel=58)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'F3', 'F4', 4, vel=56)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'sync', 88, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 98, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'sync', 94, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'light'), (12, 20, 'shuffle'), (20, 28, 'rock'), (28, 36, 'drive2')]) + fill_at(3, 'stop')
    intros.apply(P, 'horn_call', INTRO)
    return P, {'harp': {'gain': 8.0}, 'marimba': {'gain': 10.0}}
