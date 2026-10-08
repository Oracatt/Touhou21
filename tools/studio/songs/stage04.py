"""Stage 4: threads in the dark. G minor, 154 BPM.

4-bar intro of harp and tremolo, then a 32-bar loop: A (oboe over harp runs, pizzicato) / B (violins and clarinet) /
chorus (trumpet + violins, bassoon answer) / A' (oboe and flute). D major closes the loop back into G minor."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, pizz, swell, trem
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'stage04'
BPM = 154
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 104
HALL = 2.1
LEAD = 'oboe'
MELODIC = ('flute', 'clarinet')
LEADS = ('oboe', 'violins', 'trumpet')
TARGETS = {'flute': -9.0, 'clarinet': -9.0, 'bassoon': -10.0, 'harp': -10.0, 'xylo': -12.0}
SCALE = {7, 9, 10, 0, 2, 3, 5, 6}   # G natural minor plus the harmonic F#

INTRO = progression('Gm | Eb | F | D', bar=0)
A_CH = progression('Gm | Gm | Eb | F | Gm | Cm | Eb:2 D:2 | D', bar=4)
B_CH = progression('Bb | F | Cm | Gm | Eb | Bb | Cm:2 D:2 | D', bar=12)
C_CH = progression('Eb | F | Gm | D | Eb | F | Cm | D', bar=20)
A2_CH = progression('Gm | Gm | Eb | F | Gm | Cm | Eb:2 D:2 | D', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 Bb5:4 G5:4 | C6:8 A5:4 F5:4 | D5:4 F#5:4 A5:8 |'
A_MEL = ('G5:2 A5:2 Bb5:4 D6:4 Bb5:2 A5:2 | G5:4 Bb5:4 D6:4 G6:4 | G6:2 F6:2 Eb6:4 Bb5:4 G5:4 | A5:2 C6:2 F6:4 C6:4 A5:4 | '
         'D6:6 Bb5:2 G5:4 Bb5:4 | C6:2 D6:2 Eb6:4 G6:4 Eb6:2 D6:2 | Eb6:4 G5:4 F#5:4 A5:4 | D6:6 C6:2 A5:4 F#5:4 |')
B_MEL = ('D6:8 F6:4 Bb6:4 | C6:8 A5:4 F5:4 | G5:6 C6:2 Eb6:4 C6:4 | D6:6 Bb5:2 G5:4 Bb5:4 | '
         'Bb5:6 Eb6:2 G6:4 Eb6:4 | F6:6 D6:2 Bb5:4 D6:4 | Eb6:4 C6:4 A5:4 F#5:4 | A5:8 D6:4 F#6:2 A6:2 |')
C_MEL = ('G6:3 G6:3 Bb6:2 G6:4 Eb6:4 | F6:3 F6:3 A6:2 F6:4 C6:4 | D6:3 D6:3 G6:2 Bb6:4 G6:4 | A6:3 F#6:1 D6:4 A5:4 D6:4 | '
         'Bb6:3 G6:1 Eb6:4 G6:4 Bb6:4 | A6:3 F6:1 C6:4 F6:4 A6:4 | Eb6:6 D6:2 C6:4 G5:4 | D6:6 F#6:2 A6:4 D6:4 |')
BSN = 'Bb2:16 | C3:16 | D3:16 | A2:16 | Bb2:16 | C3:16 | G2:16 | A2:16 |'


def build():
    P = {}
    P['oboe'] = lead(A_MEL, 4, 86) + lead(A_MEL, 28, 92)
    P['flute'] = lead(I_MEL, 0, 70) + double(lead(A_MEL, 28, 60), 12) + double(lead(C_MEL, 20, 62), 0)
    P['violins'] = lead(B_MEL, 12, 84) + double(lead(C_MEL, 20, 76), 0)
    P['clarinet'] = lead(B_MEL, 12, 60) + double(lead(A_MEL, 4, 50), -12)
    P['trumpet'] = lead(C_MEL, 20, 90)
    P['bassoon'] = lead(BSN, 20, 76, gate=1.0)
    P['harp'] = (arpeggio(INTRO, 'G3', 'G6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=58, accent=6)
                 + arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'G3', 'G6', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=54, accent=8)
                 + arpeggio(pick(CHORDS, 12, 20), 'G3', 'G5', [0, 2, 1, 2], step=0.5, vel=54, accent=6))
    P['xylo'] = arpeggio(pick(CHORDS, 20, 28), 'G5', 'G6', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
    P['glock'] = lead(I_MEL, 0, 58)
    P['piano'] = (arpeggio(pick(CHORDS, 12, 20), 'G3', 'G5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'G3', 'G5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=72, accent=8))
    P['violins#2'] = (trem(sustained(INTRO, 'G3', 'G4', 3, vel=56)) + pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'G4', 'G5', [0, 2, 1, 2], step=0.5, vel=70, accent=10))
                      + trem(sustained(pick(CHORDS, 20, 28), 'G3', 'G4', 3, vel=68)))
    P['celli'] = (pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'G2', 'G3', [0, None, 1, None], step=0.5, vel=78, accent=8))
                  + sustained(pick(CHORDS, 12, 28), 'G2', 'G3', 2, vel=66))
    P['violas'] = sustained(pick(CHORDS, 12, 28), 'G3', 'G4', 3, vel=60)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'G3', 'G4', 3, vel=56)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 90, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 98, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 94, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 80, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'gallop'), (12, 20, 'half'), (20, 28, 'rock'), (28, 36, 'drive')]) + fill_at(3, 'stop')
    swell(P['violins'], 12, 20, -4, 6)
    intros.apply(P, 'pizz_ostinato', INTRO)
    return P, {'harp': {'gain': 8.0}}
