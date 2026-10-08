"""Stage 2: rain on a paper umbrella. E minor, 140 BPM.

4-bar intro of falling piano and glock notes, then a 32-bar loop: A (clarinet over pizzicato) /
B (oboe, strings) / chorus (violins + flute, full band) / A' (clarinet + flute). B7 closes A'
so the loop falls back onto E minor."""
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, pizz, swell
from studio.score import arpeggio, progression, roots, sustained

TITLE = 'stage02'
BPM = 140
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 102
HALL = 2.3
LEAD = 'clarinet'
MELODIC = ('oboe', 'flute')
LEADS = ('clarinet', 'oboe', 'violins')
TARGETS = {'flute': -9.0, 'horn': -12.0, 'trumpet': -9.0}
SCALE = {4, 6, 7, 9, 11, 0, 2, 3}   # E natural minor plus D#

INTRO = progression('Em | C | Am | B7', bar=0)
A_CH = progression('Em | C | G | D | Em | C | Am | B7', bar=4)
B_CH = progression('Am | D | G | Bm | C | Am | Bm:2 B7:2 | B7', bar=12)
C_CH = progression('C | D | Em | Bm | C | D | B7 | Em', bar=20)
A2_CH = progression('Em | C | G | D | Em | C | Am | B7', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 G5:4 E5:4 | C6:8 A5:4 E5:4 | D#5:4 F#5:4 B5:8 |'
A_MEL = ('B4:4 E5:2 G5:2 E5:4 B4:4 | C5:2 D5:2 E5:4 G5:4 E5:2 D5:2 | B5:6 A5:2 G5:4 D5:4 | F#5:4 A5:2 F#5:2 D5:4 F#5:4 | '
         'G5:6 F#5:2 E5:4 B4:4 | E5:4 G5:4 C6:4 B5:2 A5:2 | A5:6 G5:2 E5:4 C5:4 | D#5:4 F#5:4 B5:4 A5:2 F#5:2 |')
B_MEL = ('E5:6 A5:2 C6:4 B5:4 | A5:6 F#5:2 D5:4 F#5:4 | G5:6 B5:2 D6:4 B5:4 | F#5:6 D5:2 B4:4 D5:4 | '
         'E5:2 G5:2 C6:4 E6:6 D6:2 | C6:6 B5:2 A5:4 E5:4 | D6:4 B5:4 F#5:4 D#5:4 | F#5:8 A5:4 B5:2 D#6:2 |')
C_MEL = ('G5:4 E5:2 G5:2 C6:4 G5:4 | A5:4 F#5:2 A5:2 D6:4 A5:4 | B5:4 G5:2 B5:2 E6:4 B5:4 | D6:4 B5:2 D6:2 F#6:4 D6:4 | '
         'E6:6 D6:2 C6:4 G5:4 | A5:4 D6:4 F#6:4 E6:2 D6:2 | D#6:6 E6:2 F#6:4 B6:4 | E6:12 r:4 |')
HORN = 'G4:16 | F#4:16 | G4:16 | F#4:16 | G4:16 | A4:16 | D#4:16 | E4:16 |'


def build():
    P = {}
    P['clarinet'] = lead(A_MEL, 4, 84) + lead(A_MEL, 28, 90)
    P['oboe'] = lead(B_MEL, 12, 80)
    P['violins'] = lead(C_MEL, 20, 84) + sustained(pick(B_CH, 12, 20), 'E4', 'E5', 3, vel=56)
    P['flute'] = lead(I_MEL, 0, 70) + double(lead(C_MEL, 20, 66), 12) + double(lead(A_MEL, 28, 56), 12)
    P['trumpet'] = lead(C_MEL, 20, 70)
    P['horn'] = lead(HORN, 20, 66, gate=1.0)
    P['marimba'] = (arpeggio(pick(CHORDS, 4, 12), 'E4', 'E5', [0, None, 1, None, 2, None, 1, None], step=0.5, vel=64, accent=6)
                    + arpeggio(pick(CHORDS, 20, 28), 'E4', 'B5', [0, 1, 2, 1], step=0.5, vel=66, accent=6)
                    + arpeggio(pick(CHORDS, 28, 36), 'E4', 'E5', [0, None, 1, None, 2, None, 1, None], step=0.5, vel=66, accent=6))
    P['glock'] = lead(I_MEL, 0, 60) + arpeggio(INTRO, 'E5', 'E7', [3, 2, 1, 0, 2, 1, 0, 1], step=0.25, vel=50, accent=6)
    P['piano'] = (arpeggio(INTRO, 'E3', 'E6', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=56, accent=8)
                  + arpeggio(pick(CHORDS, 12, 20), 'E3', 'E5', [0, 2, 1, 2], step=0.5, vel=62, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'E3', 'E5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=70, accent=8)
                  + arpeggio(pick(CHORDS, 28, 36), 'E3', 'E5', [0, 2, 1, 2], step=0.5, vel=62, accent=6))
    P['violins#2'] = pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E4', 'E5', [0, 2, 1, 2], step=0.5, vel=70, accent=10))
    P['celli'] = pizz(arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E2', 'E3', [0, None, 1, None], step=0.5, vel=76, accent=8)) + sustained(pick(CHORDS, 12, 20), 'E2', 'E3', 2, vel=64)
    P['violas'] = sustained(pick(CHORDS, 12, 36), 'E3', 'E4', 3, vel=58)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'E4', 'E5', 3, vel=56)
    P['harp'] = arpeggio(pick(CHORDS, 12, 20), 'E4', 'E6', [0, 1, 2, 3, 2, 1], step=0.5, vel=54, accent=6)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'sync', 88, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 84, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 98, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'sync', 92, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'light'), (12, 20, 'lighter'), (20, 28, 'rock'), (28, 36, 'drive')]) + fill_at(3, 'stop')
    swell(P['violins'], 12, 20, 0, 10)
    return P, {'harp': {'gain': 8.0}, 'marimba': {'gain': 10.0}}
