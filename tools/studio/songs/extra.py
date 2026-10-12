"""Extra stage: rewriting what was already written. C# minor, 162 BPM.

4-bar intro, then a 32-bar loop: A (trumpet in 3+3+2 over plucked synth and piano) /
B (a corridor: the bass walks down by semitones under a quiet organ, a solo violin sings, and the flute returns the
last two notes of every phrase an octave higher, twice, the second time fainter; triplets climb into the chorus) /
chorus (the circle of fifths: violins and trumpet call in 2+3+3, the A riff turned around and doubled in length,
and step down one degree every two bars while the synth lead and glockenspiel answer in the held notes) /
A' (oboe, trumpet). G# major closes the loop into C# minor."""
from studio import intros
from studio.layers import K, bass_part, crash_at, double, drum_part, fill_at, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.score import arpeggio, bass_line, drums, progression, roots, stabs, sustained
from studio.core import Note, midi

TITLE = 'extra'
BPM = 162
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 107
HALL = 2.2
LEAD = 'trumpet'
MELODIC = ('flute', 'oboe', 'synlead')
LEADS = ('trumpet', 'violins')
TARGETS = {'solo_violin': -4.5, 'synlead': -10.0, 'flute': -11.0, 'oboe': -9.5, 'pluck': -10.0, 'horn': -11.0, 'timpani': -13.0,
           'organ': -12.0, 'glock': -12.5, 'contrabass': -12.0}
SCALE = {1, 3, 4, 6, 8, 9, 11, 0}   # C# natural minor plus B#

INTRO = progression('C#m | A | B | G#', bar=0)
A_CH = progression('C#m | C#m | A | B | C#m | E | F#m | G#', bar=4)
B_CH = progression('C#m | G#/B# | C#m/B | F#/A# | Amaj7 | E/G# | F#m7 | G#sus4:2 G#:2', bar=12)
C_CH = progression('C#m | F#m | B | E | A | D#dim | G#7 | G#', bar=20)
A2_CH = progression('C#m | C#m | A | B | C#m | E | F#m | G#', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 16), ('B2', 16, 18), ('rise', 18, 20), ('chorus', 20, 28), ("A'", 28, 36)]

A_MEL = ('G#5:3 G#5:3 C#6:2 E6:4 C#6:4 | B5:3 A5:3 G#5:2 E5:8 | A5:3 A5:3 C#6:2 E6:4 C#6:4 | B5:3 B5:3 D#6:2 F#6:4 D#6:4 | '
         'E6:3 E6:3 G#6:2 E6:4 C#6:4 | B5:3 B5:3 E6:2 G#6:4 E6:4 | A5:4 C#6:4 F#6:4 C#6:2 A5:2 | B#5:4 D#6:4 G#6:4 D#6:2 B#5:2 |')
B_MEL = 'E5:4 G#5:8 F#5:4 | D#5:8 r:8 | B4:4 G#5:8 E5:4 | C#5:8 r:8 | A5:12 G#5:4 | E5:4 B4:4 r:8 |'
B_ECHO = ('r:16 | r:8 F#6:2 D#6:2 @-14 F#6:2 D#6:2 | @+14 r:16 | r:8 E6:2 C#6:2 @-14 E6:2 C#6:2 | '
          '@+14 r:16 | r:8 E6:2 B5:2 @-14 E6:2 B5:2 |')
B_RISE = 'A4:4/3 C#5:4/3 E5:4/3 F#5:4 A5:4/3 C#6:4/3 E6:4/3 F#6:4 | G#6:8 F#6:4/3 E6:4/3 D#6:4/3 B#5:4 |'
C_MEL = ('G#5:4 C#6:6 E6:6 | F#6:12 E6:2 C#6:2 | F#5:4 B5:6 D#6:6 | E6:12 D#6:2 B5:2 | '
         'E5:4 A5:6 C#6:6 | D#6:12 C#6:2 A5:2 | B#5:4 D#6:6 F#6:6 | G#6:8 F#6:2 D#6:2 B#5:2 A5:2 |')
C_ECHO = 'r:16 | r:4 C#6:2 F#6:3 A6:3 r:4 | r:16 | r:4 B5:2 E6:3 G#6:3 r:4 | r:16 | r:4 A5:2 D#6:3 F#6:3 r:4 | r:16 | r:16 |'

CORRIDOR = {'K': 'x.........x.....', 'SR': '....x.......x...', 'H': '..o...o...o...o.'}
CORRIDOR2 = {'K': 'x.....x...x.....', 'SR': '....x.......x...', 'H': 'o.o.o.o.o.o.o.o.'}
RISE = {'K': 'x...x...x...x...', 'S': '....x.......x...', 'H': 'x.o.x.o.x.o.x.o.'}
CALL = {'K': 'x...x.....x.....', 'S': '....x.......x...', 'B': 'x...o...x...o...', 'H': '..o...o...o...o.'}
DRIP = [None, None, 3, None, None, None, None, None, None, None, 4, None, None, None, None, None]


def build():
    P = {}
    P['trumpet'] = lead(A_MEL, 4, 94) + double(lead(C_MEL, 20, 84), -12) + lead(A_MEL, 28, 98)
    P['solo_violin'] = lead(B_MEL, 12, 84) + lead(B_RISE, 18, 86)
    P['violins'] = swell(lead(B_RISE, 18, 74), 18, 20, -4, 12) + lead(C_MEL, 20, 90)
    P['flute'] = lead(B_ECHO, 12, 68)
    P['synlead'] = lead(C_ECHO, 20, 80)
    P['glock'] = lead(C_ECHO, 20, 54)
    P['oboe'] = double(lead(A_MEL, 28, 56), -12)
    P['horn'] = (stabs(pick(CHORDS, 4, 12), 'C#4', 'C#5', 3, 'x..x..x.x...x...', vel=76, gate=0.7)
                 + stabs(pick(CHORDS, 20, 28), 'C#4', 'C#5', 3, 'x...x.....x.....', vel=80, gate=0.7))
    P['pluck'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'C#4', 'C#6', [0, 1, 2, 1, 3, 2, 1, 2], step=0.25, vel=64, accent=8)
                  + arpeggio(pick(CHORDS, 12, 18), 'C#5', 'C#7', DRIP, step=0.25, vel=56, accent=0))
    P['organ'] = sustained(pick(CHORDS, 12, 20), 'G#3', 'G#4', 3, vel=68)
    P['piano'] = (stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'C#3', 'C#5', 4, '..x...x...x...x.', vel=74, gate=0.6)
                  + swell(arpeggio(pick(CHORDS, 18, 20), 'C#3', 'C#5', [0, 1, 2, 3], step=0.5, vel=54, accent=6), 18, 20, 0, 14)
                  + stabs(pick(CHORDS, 20, 28), 'C#4', 'C#5', 4, 'X.x.X.x.x.X.x.x.', vel=58, gate=0.55))
    P['violins#2'] = trem(swell(sustained(pick(CHORDS, 18, 20), 'C#5', 'C#6', 3, vel=48), 18, 20, 0, 24))
    P['violas'] = sustained(pick(CHORDS, 20, 28), 'C#4', 'C#5', 2, vel=62)
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'C#2', 'C#3', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + roots(pick(CHORDS, 12, 20), 'F#2', 'F3', vel=66)
                  + bass_line(pick(CHORDS, 20, 28), 'R-..R-....R-....', octave=3, vel=80, gate=0.6))
    P['contrabass'] = roots(pick(CHORDS, 12, 20), 'F#1', 'F2', vel=60) + roots(pick(CHORDS, 20, 28), 'E1', 'D#2', vel=64)
    P['pad'] = sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 20, 36), 'C#3', 'C#4', 4, vel=58)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 94, context=CHORDS) + bass_part(pick(CHORDS, 12, 16), 'whole', 78, context=CHORDS)
                 + bass_part(pick(CHORDS, 16, 20), 'eighth', 80, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'octave', 94, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 98, context=CHORDS))
    P['drums'] = (drum_part([(4, 12, 'double'), (28, 36, 'double')])
                  + crash_at(12) + drums(CORRIDOR, bar=12, bars=4, kit=K) + drums(CORRIDOR2, bar=16, bars=2, kit=K) + drums(RISE, bar=18, kit=K)
                  + fill_at(19, 'roll') + crash_at(20) + drums(CALL, bar=20, bars=3, kit=K) + fill_at(23, 'snare')
                  + crash_at(24) + drums(CALL, bar=24, bars=3, kit=K) + fill_at(27, 'tom'))
    P['timpani'] = (timp_roll(19, 'G#1', 'C#2') + [Note(b * 4, 1.0, midi(p), 100, '', {}) for b, p in ((22, 'B1'), (24, 'A1'), (26, 'G#1'))]
                    + timp_roll(35, 'G#1', 'C#2')[:-1] + tpt_hits(4, 'C#2', 110))
    intros.apply(P, 'groove', INTRO)
    return P, {'pluck': {'gain': -12.0}}
