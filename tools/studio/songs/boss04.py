"""Stage 4 Boss: Itomori Shino, the spider who weaves a way home. F# minor, 168 BPM.

4-bar intro (flute over tremolo), then a 32-bar loop: A (violins over a cello ostinato, harp, gallop) /
B (oboe, flute and strings, sweeter) / chorus (violins + trumpet, piccolo octave, horn, timpani, gong) / A'.
Every section ends on C# major so the loop pulls into F# minor."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, fit, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.score import arpeggio, bass_line, progression, roots, sustained
from studio.core import Note

TITLE = 'boss04'
BPM = 168
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 204
HALL = 2.2
LEAD = 'violins'
MELODIC = ('flute', 'oboe', 'piccolo')
LEADS = ('violins', 'trumpet')
TARGETS = {'oboe': -8.5, 'flute': -9.5, 'piccolo': -11.0, 'horn': -12.0, 'harp': -10.0, 'gong': -14.0}
SCALE = {6, 8, 9, 11, 1, 2, 4, 5}   # F# natural minor plus E#

INTRO = progression('F#m | D | E | C#', bar=0)
A_CH = progression('F#m | F#m | D | E | F#m | F#m | Bm | C#', bar=4)
B_CH = progression('A | E | F#m | D | A | E | D:2 C#:2 | C#', bar=12)
C_CH = progression('D | E | F#m | C# | D | E | Bm | C#', bar=20)
A2_CH = progression('F#m | F#m | D | E | F#m | F#m | Bm | C#', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 A5:4 F#5:4 | G#5:8 B5:4 E6:4 | E#6:4 G#6:4 C#7:8 |'
A_MEL = ('F#5:1 A5:1 C#6:2 F#6:4 C#6:2 A5:2 F#5:4 | A5:2 C#6:2 E6:4 C#6:2 A5:2 C#6:4 | D6:2 F#6:2 A6:4 F#6:2 D6:2 A5:4 | G#5:2 B5:2 E6:4 B5:2 G#5:2 E6:4 | '
         'F#6:6 E6:2 C#6:4 A5:4 | A5:2 B5:2 C#6:2 D6:2 C#6:4 A5:4 | B5:4 D6:4 F#6:4 E6:2 D6:2 | C#6:4 E#6:4 G#6:4 E#6:2 C#6:2 |')
B_MEL = ('E6:8 C#6:4 A5:4 | B5:6 G#5:2 E5:4 G#5:4 | A5:6 C#6:2 F#6:4 C#6:4 | A5:6 F#5:2 D5:4 F#5:4 | '
         'C#6:6 E6:2 A6:4 E6:4 | G#6:6 E6:2 B5:4 E6:4 | F#6:4 D6:4 E#6:4 G#6:4 | G#6:8 E#6:4 C#6:2 G#5:2 |')
C_MEL = ('A6:3 A6:3 F#6:2 D6:4 A5:4 | B6:3 B6:3 G#6:2 E6:4 B5:4 | C#6:3 C#6:3 F#6:2 A6:4 F#6:4 | G#6:3 E#6:1 C#6:4 G#5:4 C#6:4 | '
         'F#6:3 A6:3 D6:2 F#6:4 A6:4 | G#6:3 B6:3 E6:2 G#6:4 B6:4 | D6:6 F#6:2 B6:4 F#6:4 | G#6:4 E#6:4 C#6:8 |')
HORN = 'A4:16 | B4:16 | C#5:16 | G#4:16 | A4:16 | B4:16 | F#4:16 | G#4:16 |'


def build():
    P = {}
    P['violins'] = lead(A_MEL, 4, 92) + lead(C_MEL, 20, 94) + lead(A_MEL, 28, 96) + sustained(pick(B_CH, 12, 20), 'A4', 'A5', 3, vel=60)
    P['flute'] = lead(I_MEL, 0, 72) + double(lead(B_MEL, 12, 78), 0)
    P['oboe'] = lead(B_MEL, 12, 68) + double(lead(A_MEL, 28, 56), -12)
    P['trumpet'] = fit(lead(C_MEL, 20, 90), 'F#4', 'G6')
    P['piccolo'] = double(lead(C_MEL, 20, 58), 12)
    P['horn'] = lead(HORN, 20, 72, gate=1.0)
    P['harp'] = (arpeggio(INTRO, 'F#3', 'F#6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=56, accent=6)
                 + arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F#3', 'F#6', [0, 2, 1, 3, 2, 4, 3, 2], step=0.25, vel=52, accent=8))
    P['glock'] = lead(I_MEL, 0, 58)
    P['piano'] = (arpeggio(pick(CHORDS, 12, 20), 'F#3', 'F#5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'F#3', 'F#5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=70, accent=8))
    P['violins#2'] = (trem(sustained(INTRO, 'F#3', 'F#4', 3, vel=54)) + trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F#3', 'F#4', 3, vel=60))
                      + trem(sustained(pick(CHORDS, 20, 28), 'F#3', 'F#4', 3, vel=70)))
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F#2', 'F#3', [0, 0, 1, 0, 0, 1, 0, 1], step=0.25, vel=70, accent=10)
                  + roots(pick(CHORDS, 12, 20), 'F#1', 'F2', vel=70) + arpeggio(pick(CHORDS, 20, 28), 'F#2', 'F#3', [0, 1], step=0.5, vel=78, accent=8))
    P['violas'] = sustained(pick(CHORDS, 12, 20), 'F#3', 'F#4', 3, vel=62)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'F#3', 'F#4', 3, vel=56)
    P['pluck'] = arpeggio(pick(CHORDS, 20, 28), 'F#4', 'F#5', [0, 1, 2, 1, 3, 2, 1, 2], step=0.5, vel=58, accent=6)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 94, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 102, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 98, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 82, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'double'), (12, 20, 'half'), (20, 28, 'rock'), (28, 36, 'double')]) + fill_at(3, 'stop')
    P['timpani'] = timp_roll(19, 'C#2', 'F#2') + timp_roll(35, 'C#2', 'F#2')[:-1] + tpt_hits(4, 'F#2', 112)
    P['gong'] = [Note(20 * 4, 4, 60, 100, '', {})]
    swell(P['violins'], 12, 20, -4, 6)
    intros.apply(P, 'trem_strings', INTRO)
    return P, {'harp': {'gain': 8.0}}
