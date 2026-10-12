"""Extra Boss: Tamatsugi Mio, the ending that will not stop. E minor, 176 BPM.

4-bar intro, then a 32-bar loop: A (relentless eighths, violins and trumpet over gallop and piano) /
B (half a sentence: the trumpet asks on the off-beats while the xylophone hides on the beats, and the solo violin
repeats the last half bar an octave higher before finishing it her own way, over claves and log drums ticking like a
clock, a staccato bassoon and pizzicato celli; the last answer breaks off before the fourth beat) /
chorus (midnight: twelve strokes of brass, organ, timpani and bells climb E, F#, G, then the band returns over a bass
that keeps rising to D#; every phrase goes up and turns back on itself) / A'.
B major closes every section so the loop never settles."""
from studio import intros
from studio.layers import K, bass_part, crash_at, cymbal_swell, double, drum_part, figure_bass, fill_at, fit, lead, pick, pizz, swell, timp_roll, tpt_hits, trem, within
from studio.library import BATTERY
from studio.score import arpeggio, bass_line, drums, progression, roots, stabs, sustained
from studio.core import Note

TITLE = 'bossExtra'
BPM = 176
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 207
HALL = 2.0
LEAD = 'violins'
MELODIC = ('flute', 'oboe', 'synlead')
LEADS = ('violins', 'trumpet')
TARGETS = {'horn': -10.0, 'flute': -11.0, 'oboe': -9.5, 'synlead': -9.0, 'gong': -14.0, 'solo_violin': -2.5,
           'solo_violin#2': -10.0, 'bassoon': -10.0, 'battery': -12.5, 'battery#2': -12.0, 'xylo': -11.0, 'organ': -13.0, 'bells': -11.5}
SCALE = {4, 6, 7, 9, 11, 0, 2, 3}   # E natural minor plus D#

INTRO = progression('Em | C | D | B', bar=0)
A_CH = progression('Em | Em | C | D | Em | Em | Am | B', bar=4)
B_CH = progression('Em | A | Em | A | C | D | Bm | B7', bar=12)
C_CH = progression('Em | D/F# | G | A | Em/B | C | D | B/D#', bar=20)
A2_CH = progression('Em | Em | C | D | Em | Em | Am | B', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 16), ('B2', 16, 18), ('rise', 18, 20), ('strokes', 20, 23), ('chorus', 23, 28),
            ("A'", 28, 36)]

A_MEL = ('E6:2 B5:2 G5:2 B5:2 E6:4 G6:4 | F#6:2 E6:2 D6:2 B5:2 G5:8 | C6:2 E6:2 G6:2 E6:2 C6:4 G5:4 | D6:2 F#6:2 A6:2 F#6:2 D6:4 A5:4 | '
         'E6:2 G6:2 B6:4 G6:2 E6:2 B5:4 | E6:3 D6:1 B5:4 G5:4 B5:4 | A5:2 C6:2 E6:4 A6:4 E6:4 | D#6:4 F#6:4 B6:4 F#6:2 D#6:2 |')
B_ASK = ('r:2 B4:2. r:2 E5:2. r:2 G5:2. B5:2. G5:2. | C#5:4 E5:2. C#5:2. A4:2 B4:2 E5:4 | r:16 | r:16 | '
         'r:2 C5:2. r:2 E5:2. r:2 G5:2. C6:2. G5:2. | F#5:4 A5:2. F#5:2. D5:2 E5:2 F#5:4 | r:16 | r:16 |')
B_ANSWER = ('r:16 | r:16 | A5:2 B5:2 E6:4 G6:2. F#6:2. E6:2. B5:2. | C#6:2 E6:2 A6:2 C#7:2 r:2 A6:2 E6:4 | '
            'r:16 | r:16 | D6:2 E6:2 F#6:4 B6:2. A6:2. F#6:2. D6:2. | D#6:4 F#6:2 A6:2 B6:4 r:4 |')
B_XYLO = 'E6:2. r:2 G6:2. r:2 B6:2. r:6 | r:16 | r:16 | r:16 | C6:2. r:2 E6:2. r:2 G6:2. r:6 |'
C_MEL = ('E6:2 G6:4 B6:4 A6:2 G6:2 E6:2 | D6:2 F#6:4 A6:4 G6:2 F#6:2 D6:2 | B5:2 D6:4 G6:4 F#6:2 G6:2 A6:2 | C#7:8 B6:2 A6:2 E6:4 | '
         'B6:10 A6:2 G6:4 | E6:2 G6:2 C7:12 | A6:6 F#6:6 D6:4 | D#6:2 F#6:2 A6:2 B6:2 C7:2 B6:2 A6:2 F#6:2 |')
STROKE_TBN = ('[E2,E3]:4^ [E2,E3]:4^ [E2,E3]:4^ [E2,E3]:4^ | [F#2,F#3]:4^ [F#2,F#3]:4^ [F#2,F#3]:4^ [F#2,F#3]:4^ | '
              '[G2,G3]:4^ [G2,G3]:4^ [G2,G3]:4^ [G2,G3]:4^ |')
STROKE_HN = ('[B3,E4]:4^ [B3,E4]:4^ [B3,E4]:4^ [B3,E4]:4^ | [A3,D4]:4^ [A3,D4]:4^ [A3,D4]:4^ [A3,D4]:4^ | '
             '[B3,D4]:4^ [B3,D4]:4^ [B3,D4]:4^ [B3,D4]:4^ |')
STROKE_PNO = ('[E1,E2]:4 [E1,E2]:4 [E1,E2]:4 [E1,E2]:4 | [F#1,F#2]:4 [F#1,F#2]:4 [F#1,F#2]:4 [F#1,F#2]:4 | '
              '[G1,G2]:4 [G1,G2]:4 [G1,G2]:4 [G1,G2]:4 |')
STROKE_TIMP = 'E2:4 E2:4 E2:4 E2:4 | F#2:4 F#2:4 F#2:4 F#2:4 | G2:4 G2:4 G2:4 G2:4 |'
# One bell pitch, like a clock: E is the root of Em, the ninth of D/F# and the sixth of G.
BELL = 'E5:8 E5:8 | E5:8 E5:8 | E5:8 E5:8 |'

CLOCK = {'CL': 'x.......x.......', 'LH': '....x.......x...'}
CLOCK_FAST = {'CL': 'x...x...x...x...', 'LH': '..x...x...x...x.'}
CLOCK_STOP = {'CL': 'x...x...x.......', 'LH': '..x...x...x.....'}
TIPTOE = {'K': 'x.......x.......', 'H': '..o...o...o...o.'}
TIPTOE2 = {'K': 'x.....x.x.......', 'SR': '....x.......x...', 'H': 'o.o.o.o.o.o.o.o.'}
BREAK = {'K': 'x...x...x...x...', 'S': '....x.......x...', 'H': 'xoxoxoxoxoxoxoxo'}
HOLD = {'K': 'x...x...x.......', 'S': 'x.x.x.x.xxxx....'}
STRIKE = {'K': 'x...x...x...x...', 'T4': 'x...x...x...x...'}
STRIKE_LAST = {'K': 'x...x...x...x...', 'T4': 'x...x...x...x...', 'S': '........oooooooo'}
REVIVE = {'K': 'x...x...x...x...', 'S': '....x.......x..o', 'H': 'xoxoxoxoxoxoxoxo'}


def build():
    P = {}
    P['violins'] = (lead(A_MEL, 4, 94) + swell(within(lead(B_ANSWER, 12, 76), 18, 20), 18, 20, -4, 10) + lead(C_MEL, 20, 96)
                    + lead(A_MEL, 28, 100))
    P['solo_violin'] = lead(B_ANSWER, 12, 88)
    P['solo_violin#2'] = lead(C_MEL, 20, 80)
    P['trumpet'] = (fit(lead(A_MEL, 4, 70), 'E4', 'G6') + lead(B_ASK, 12, 92) + double(lead(C_MEL, 20, 76), -12)
                    + fit(lead(A_MEL, 28, 72), 'E4', 'G6'))
    P['synlead'] = lead(A_MEL, 28, 60)
    P['flute'] = within(lead(B_ANSWER, 12, 60), 18, 20) + within(lead(C_MEL, 20, 62), 23, 28)
    P['oboe'] = double(lead(A_MEL, 4, 50), -12)
    P['xylo'] = lead(B_XYLO, 12, 66)
    P['bassoon'] = figure_bass(pick(CHORDS, 12, 20), 'E2', 'E3', 'R5O5', 0.5, vel=78, gate=0.45)
    P['horn'] = (stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E4', 3, 'x.x.x.x.x...x...', vel=80, gate=0.7)
                 + double(within(lead(B_ASK, 12, 72), 16, 18), -12) + lead(STROKE_HN, 20, 78)
                 + sustained(pick(CHORDS, 23, 28), 'E4', 'E5', 2, vel=70))
    P['trombone'] = lead(STROKE_TBN, 20, 82) + roots(pick(CHORDS, 23, 28), 'E2', 'D#3', vel=80)
    P['organ'] = sustained(pick(CHORDS, 20, 23), 'E3', 'E5', 4, vel=92)
    P['bells'] = lead(BELL, 20, 100)
    P['piano'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=64, accent=8)
                  + lead(STROKE_PNO, 20, 76) + bass_line(pick(CHORDS, 23, 28), 'R-......R-......', octave=2, vel=82, gate=0.8)
                  + stabs(pick(CHORDS, 23, 28), 'E4', 'E5', 3, '..x...x...x...x.', vel=72, gate=0.5))
    P['violins#2'] = trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E4', 3, vel=60))
    P['violas'] = (trem(swell(sustained(pick(CHORDS, 16, 20), 'E4', 'E5', 3, vel=48), 16, 20, 0, 20))
                   + arpeggio(pick(CHORDS, 23, 28), 'E4', 'E5', [0, 1, 2, 1], step=0.5, vel=62, accent=6))
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E2', 'E3', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + pizz(bass_line(pick(CHORDS, 12, 20), 'R.......R.......', octave=3, vel=76))
                  + bass_line(pick(CHORDS, 23, 28), 'R.R.R.R.R.R.R.R.', octave=3, vel=78, gate=0.6))
    P['contrabass'] = roots(pick(CHORDS, 20, 28), 'E1', 'D#2', vel=70)
    P['pad'] = sustained(pick(CHORDS, 23, 36), 'E3', 'E4', 3, vel=58)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 96, context=CHORDS) + bass_part(pick(CHORDS, 12, 16), 'half', 84, context=CHORDS)
                 + bass_part(pick(CHORDS, 16, 20), 'eighth', 84, context=CHORDS) + bass_part(pick(CHORDS, 23, 28), 'push', 104, context=CHORDS)
                 + bass_part(pick(CHORDS, 28, 36), 'gallop', 100, context=CHORDS))
    P['drums'] = (drum_part([(4, 12, 'double'), (28, 36, 'double')])
                  + crash_at(12) + drums(TIPTOE, bar=12, bars=4, kit=K) + drums(TIPTOE2, bar=16, bars=2, kit=K) + drums(BREAK, bar=18, kit=K)
                  + drums(HOLD, bar=19, kit=K) + crash_at(20) + drums(STRIKE, bar=20, bars=2, kit=K) + drums(STRIKE_LAST, bar=22, kit=K)
                  + crash_at(23) + drums(REVIVE, bar=23, bars=4, kit=K) + crash_at(25) + fill_at(27, 'tom'))
    P['battery'] = drums(CLOCK, bar=12, bars=6, kit=BATTERY) + drums(CLOCK_FAST, bar=18, kit=BATTERY) + drums(CLOCK_STOP, bar=19, kit=BATTERY)
    P['battery#2'] = (drums({'BD': 'X.......x.......'}, bar=20, bars=3, kit=BATTERY) + [cymbal_swell(23 * 4, BPM, 100)]
                      + drums({'CR': 'X...............'}, bar=23, kit=BATTERY))
    P['timpani'] = swell(lead(STROKE_TIMP, 20, 96), 20, 23, 0, 16) + timp_roll(35, 'B1', 'E2')[:-1] + tpt_hits(4, 'E2', 114)
    P['gong'] = [Note(23 * 4, 4, 60, 100, '', {})]
    intros.apply(P, 'gong_dark', INTRO)
    return P, {'trombone': {'gain': 2.0}}
