"""Stage 6: the morning that has not been written yet. E-flat major, 144 BPM.

4-bar intro of piano and glock, then a 32-bar loop: A (flute and oboe over piano, harp) / B (violins, horns) /
chorus (trumpet + violins, horn answer, full band) / A' (flute, violins). B-flat major closes the loop into E-flat."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, swell
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'stage06'
BPM = 144
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 106
HALL = 2.5
LEAD = 'flute'
MELODIC = ('oboe', 'clarinet')
LEADS = ('flute', 'violins', 'trumpet')
TARGETS = {'oboe': -8.5, 'horn': -9.5, 'clarinet': -11.0, 'piccolo': -11.5}
SCALE = {3, 5, 7, 8, 10, 0, 2}   # E-flat major

INTRO = progression('Eb | Cm | Ab | Bb', bar=0)
A_CH = progression('Eb | Bb | Cm | Gm | Ab | Eb | Fm | Bb', bar=4)
B_CH = progression('Ab | Bb | Gm | Cm | Ab | Bb | Cm:2 Bb:2 | Bb', bar=12)
C_CH = progression('Eb | Bb | Cm | Ab | Eb | Bb | Ab | Bb', bar=20)
A2_CH = progression('Eb | Bb | Cm | Gm | Ab | Eb | Fm | Bb', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 G5:4 Eb6:4 | C6:8 Eb6:4 Ab5:4 | D6:4 F6:4 Bb5:8 |'
A_MEL = ('G5:6 Bb5:2 Eb6:4 Bb5:4 | D6:6 F6:2 Bb5:4 D6:4 | Eb6:6 C6:2 G5:4 C6:4 | Bb5:6 D6:2 G6:4 D6:4 | '
         'C6:6 Eb6:2 Ab6:4 Eb6:4 | Bb5:4 G5:4 Eb6:8 | F6:6 Ab5:2 C6:4 F6:4 | D6:8 F6:4 D6:2 C6:2 |')
B_MEL = ('Eb6:8 C6:4 Ab5:4 | D6:8 F6:4 Bb5:4 | D6:6 Bb5:2 G5:4 Bb5:4 | C6:6 Eb6:2 G6:4 Eb6:4 | '
         'Ab5:6 C6:2 Eb6:4 C6:4 | D6:6 F6:2 Bb6:4 F6:4 | G6:4 Eb6:4 D6:4 F6:4 | Bb5:8 D6:4 F6:2 Bb6:2 |')
C_MEL = ('Bb5:3 Bb5:3 Eb6:2 G6:4 Bb6:4 | F6:3 F6:3 Bb5:2 D6:4 F6:4 | G6:3 G6:3 C6:2 Eb6:4 G6:4 | Eb6:3 Eb6:3 Ab5:2 C6:4 Eb6:4 | '
         'G6:3 Eb6:1 Bb5:4 Eb6:4 G6:4 | F6:3 D6:1 Bb5:4 D6:4 F6:4 | Ab6:6 Eb6:2 C6:4 Eb6:4 | D6:8 Bb5:4 F5:2 Bb5:2 |')
HORN = 'Bb4:16 | F4:16 | G4:16 | Eb4:16 | Bb4:16 | F4:16 | Eb4:16 | F4:16 |'


def build():
    P = {}
    P['flute'] = lead(I_MEL, 0, 68) + lead(A_MEL, 4, 80) + lead(A_MEL, 28, 88)
    P['oboe'] = double(lead(A_MEL, 4, 62), 0) + lead(B_MEL, 12, 58)
    P['violins'] = lead(B_MEL, 12, 78) + double(lead(C_MEL, 20, 78), 0) + double(lead(A_MEL, 28, 70), 0)
    P['trumpet'] = lead(C_MEL, 20, 86)
    P['horn'] = sustained(pick(B_CH, 12, 20), 'G3', 'G4', 3, vel=64) + lead(HORN, 20, 70, gate=1.0)
    P['piccolo'] = double(lead(C_MEL, 20, 56), 12)
    P['clarinet'] = double(lead(A_MEL, 28, 52), -12)
    P['glock'] = lead(I_MEL, 0, 60) + arpeggio(pick(CHORDS, 20, 28), 'Eb6', 'Eb7', [0, 1, 2, 1], step=1.0, vel=50, accent=0)
    P['harp'] = (arpeggio(INTRO, 'Eb4', 'Eb6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=56, accent=6)
                 + arpeggio(pick(CHORDS, 4, 20) + pick(CHORDS, 28, 36), 'Eb4', 'Eb6', [0, 2, 3, 2], step=0.5, vel=54, accent=6))
    P['piano'] = (arpeggio(INTRO, 'Eb3', 'Eb5', [0, 1, 2, 3, 2, 1, 2, 1], step=0.5, vel=60, accent=8)
                  + arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Eb3', 'Eb5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=64, accent=6)
                  + arpeggio(pick(CHORDS, 12, 20), 'Eb3', 'Eb5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'Eb3', 'Eb5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=72, accent=8))
    P['violas'] = sustained(pick(CHORDS, 4, 36), 'Eb3', 'Eb4', 3, vel=56)
    P['celli'] = roots(pick(CHORDS, 4, 20), 'Eb2', 'D3', vel=68) + arpeggio(pick(CHORDS, 20, 36), 'Eb2', 'Eb3', [0, 2], step=0.5, vel=72, accent=8)
    P['pad'] = sustained(pick(CHORDS, 4, 36), 'Eb3', 'Eb4', 4, vel=54)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'half', 84, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 96, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'sync', 90, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'lighter'), (12, 20, 'light'), (20, 28, 'half'), (28, 36, 'light')]) + fill_at(3, 'stop')
    swell(P['violins'], 12, 20, -2, 8)
    intros.apply(P, 'strings_swell', INTRO)
    return P, {'harp': {'gain': 8.0}}
