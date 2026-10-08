"""Extra stage: rewriting what was already written. C# minor, 162 BPM.

4-bar intro, then a 32-bar loop: A (trumpet in 3+3+2 over plucked synth and piano) / B (violins, flute, dark pad) /
chorus (violins + synth lead, trumpet, tutti) / A' (oboe, trumpet). G# major closes the loop into C# minor."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.score import arpeggio, progression, roots, stabs, sustained
from studio.core import Note

TITLE = 'extra'
BPM = 162
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 107
HALL = 2.2
LEAD = 'trumpet'
MELODIC = ('flute', 'oboe', 'synlead')
LEADS = ('trumpet', 'violins')
TARGETS = {'synlead': -8.5, 'flute': -10.5, 'oboe': -9.5, 'pluck': -10.0, 'horn': -11.0, 'timpani': -13.0}
SCALE = {1, 3, 4, 6, 8, 9, 11, 0}   # C# natural minor plus B#

INTRO = progression('C#m | A | B | G#', bar=0)
A_CH = progression('C#m | C#m | A | B | C#m | E | F#m | G#', bar=4)
B_CH = progression('E | B | C#m | A | E | B | A:2 G#:2 | G#', bar=12)
C_CH = progression('A | B | C#m | G# | A | B | F#m | G#', bar=20)
A2_CH = progression('C#m | C#m | A | B | C#m | E | F#m | G#', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 E6:4 C#6:4 | D#6:4 B5:4 F#5:4 B5:4 | D#6:4 B#5:4 G#5:8 |'
A_MEL = ('G#5:3 G#5:3 C#6:2 E6:4 C#6:4 | B5:3 A5:3 G#5:2 E5:8 | A5:3 A5:3 C#6:2 E6:4 C#6:4 | B5:3 B5:3 D#6:2 F#6:4 D#6:4 | '
         'E6:3 E6:3 G#6:2 E6:4 C#6:4 | B5:3 B5:3 E6:2 G#6:4 E6:4 | A5:4 C#6:4 F#6:4 C#6:2 A5:2 | B#5:4 D#6:4 G#6:4 D#6:2 B#5:2 |')
B_MEL = ('G#5:6 B5:2 E6:4 B5:4 | F#6:6 D#6:2 B5:4 D#6:4 | E6:6 C#6:2 G#5:4 C#6:4 | A5:6 C#6:2 E6:4 A6:4 | '
         'B5:6 E6:2 G#6:4 E6:4 | D#6:6 F#6:2 B6:4 F#6:4 | E6:4 C#6:4 D#6:4 B#5:4 | G#5:8 B#5:4 D#6:2 G#6:2 |')
C_MEL = ('E6:3 E6:3 A5:2 C#6:4 E6:4 | F#6:3 F#6:3 B5:2 D#6:4 F#6:4 | G#6:3 G#6:3 C#6:2 E6:4 G#6:4 | D#6:3 D#6:3 G#5:2 B#5:4 D#6:4 | '
         'A6:3 E6:1 C#6:4 E6:4 A6:4 | B6:3 F#6:1 D#6:4 F#6:4 B6:4 | A6:6 F#6:2 C#6:4 F#6:4 | G#6:4 D#6:4 B#5:8 |')
HORN = 'E5:16 | F#5:16 | G#5:16 | D#5:16 | E5:16 | F#5:16 | C#5:16 | D#5:16 |'


def build():
    P = {}
    P['trumpet'] = lead(A_MEL, 4, 94) + double(lead(C_MEL, 20, 80), -12)[:0] + lead(A_MEL, 28, 98)
    P['violins'] = lead(B_MEL, 12, 84) + lead(C_MEL, 20, 90)
    P['synlead'] = lead(C_MEL, 20, 84) + double(lead(A_MEL, 4, 50), 12)[:0]
    P['flute'] = lead(I_MEL, 0, 70) + double(lead(B_MEL, 12, 56), 12)
    P['oboe'] = double(lead(A_MEL, 28, 56), -12) + lead(B_MEL, 12, 54)
    P['horn'] = lead(HORN, 20, 70, gate=1.0) + stabs(pick(CHORDS, 4, 12), 'C#4', 'C#5', 3, 'x..x..x.x...x...', vel=76, gate=0.7)
    P['pluck'] = arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'C#4', 'C#6', [0, 1, 2, 1, 3, 2, 1, 2], step=0.25, vel=64, accent=8) + arpeggio(pick(CHORDS, 20, 28), 'C#4', 'C#6', [0, 2, 1, 3], step=0.25, vel=64, accent=8)
    P['glock'] = lead(I_MEL, 0, 60)
    P['piano'] = (arpeggio(INTRO, 'C#3', 'C#6', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=58, accent=8)
                  + stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'C#3', 'C#5', 4, '..x...x...x...x.', vel=74, gate=0.6)
                  + arpeggio(pick(CHORDS, 12, 20), 'C#3', 'C#5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'C#3', 'C#5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=70, accent=8))
    P['violins#2'] = trem(sustained(pick(CHORDS, 12, 20), 'C#4', 'C#5', 3, vel=60)) + trem(sustained(pick(CHORDS, 20, 28), 'C#4', 'C#5', 3, vel=68))
    P['violas'] = sustained(pick(CHORDS, 12, 28), 'C#3', 'C#4', 3, vel=60)
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'C#2', 'C#3', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + roots(pick(CHORDS, 12, 20), 'C#2', 'C3', vel=70) + arpeggio(pick(CHORDS, 20, 28), 'C#2', 'C#3', [0, 1], step=0.5, vel=76, accent=8))
    P['pad'] = sustained(pick(CHORDS, 4, 36), 'C#3', 'C#4', 4, vel=58)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 94, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 102, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 98, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 82, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'double'), (12, 20, 'half'), (20, 28, 'dance'), (28, 36, 'double')]) + fill_at(3, 'stop')
    P['timpani'] = timp_roll(19, 'G#1', 'C#2') + timp_roll(35, 'G#1', 'C#2')[:-1] + tpt_hits(4, 'C#2', 110)
    swell(P['violins'], 12, 20, -4, 6)
    intros.apply(P, 'groove', INTRO)
    return P, {'pluck': {'gain': -12.0}}
