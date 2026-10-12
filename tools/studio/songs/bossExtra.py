"""Extra Boss: Tamatsugi Mio, the ending that will not stop. E minor, 176 BPM.

4-bar intro, then a 32-bar loop that keeps one drive from start to finish: A (relentless eighths, violins and trumpet
over gallop and piano) / B (over a walking bass and the ride, the trumpet calls and the violins answer by repeating
its last half bar an octave higher before going their own way; the second answer breaks off before the fourth beat) /
chorus (the bass climbs from E to D# in a gallop that leaps octaves, every violin phrase goes up and turns back, and
the bells strike twelve over the first three bars) / A'.
B major closes every section so the loop never settles."""
from studio import intros
from studio.layers import K, bass_part, crash_at, cymbal_swell, double, drum_part, fill_at, fit, lead, pick, swell, timp_roll, tpt_hits, trem, within
from studio.library import BATTERY, choke_hats
from studio.score import arpeggio, bass_line, drums, progression, roots, stabs, sustained
from studio.core import Clock, Note

TITLE = 'bossExtra'
BPM = 176
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 207
HALL = 2.0
LEAD = 'violins'
MELODIC = ('flute', 'oboe', 'synlead')
LEADS = ('violins', 'trumpet')
TARGETS = {'horn': -10.0, 'flute': -11.0, 'oboe': -9.5, 'synlead': -9.0, 'gong': -14.0, 'solo_violin': -9.0, 'bells': -13.0,
           'battery': -12.0}
SCALE = {4, 6, 7, 9, 11, 0, 2, 3}   # E natural minor plus D#

INTRO = progression('Em | C | D | B', bar=0)
A_CH = progression('Em | Em | C | D | Em | Em | Am | B', bar=4)
B_CH = progression('Em | A | Em | A | C | D | Bm | B7', bar=12)
C_CH = progression('Em | D/F# | G | A | Em/B | C | D | B/D#', bar=20)
A2_CH = progression('Em | Em | C | D | Em | Em | Am | B', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

A_MEL = ('E6:2 B5:2 G5:2 B5:2 E6:4 G6:4 | F#6:2 E6:2 D6:2 B5:2 G5:8 | C6:2 E6:2 G6:2 E6:2 C6:4 G5:4 | D6:2 F#6:2 A6:2 F#6:2 D6:4 A5:4 | '
         'E6:2 G6:2 B6:4 G6:2 E6:2 B5:4 | E6:3 D6:1 B5:4 G5:4 B5:4 | A5:2 C6:2 E6:4 A6:4 E6:4 | D#6:4 F#6:4 B6:4 F#6:2 D#6:2 |')
B_CALL = ('B4:2 E5:2 G5:2 E5:2 B5:4 G5:4 | A5:2 E5:2 C#5:2 E5:2 A4:2 B4:2 E5:4 | r:16 | r:16 | '
          'C5:2 E5:2 G5:2 E5:2 C6:4 G5:4 | A5:2 F#5:2 D5:2 F#5:2 D5:2 E5:2 F#5:4 | r:16 | r:16 |')
B_ANSWER = ('r:16 | r:16 | A5:2 B5:2 E6:4 G6:2 F#6:2 E6:2 B5:2 | C#6:2 E6:2 A6:2 E6:2 C#6:4 E6:4 | '
            'r:16 | r:16 | D6:2 E6:2 F#6:4 B6:2 A6:2 F#6:2 D6:2 | D#6:4 F#6:2 A6:2 B6:4 r:4 |')
C_MEL = ('E6:2 G6:4 B6:4 A6:2 G6:2 E6:2 | D6:2 F#6:4 A6:4 G6:2 F#6:2 D6:2 | B5:2 D6:4 G6:4 F#6:2 G6:2 A6:2 | C#7:8 B6:2 A6:2 E6:4 | '
         'B6:10 A6:2 G6:4 | E6:2 G6:2 C7:12 | A6:4 F#6:4 D6:2 E6:2 F#6:4 | D#6:2 F#6:2 A6:2 B6:2 C7:2 B6:2 A6:2 F#6:2 |')
# One bell pitch, like a clock striking twelve: E is the root of Em, the ninth of D/F# and the sixth of G.
BELLS = 'E5:4 E5:4 E5:4 E5:4 | E5:4 E5:4 E5:4 E5:4 | E5:4 E5:4 E5:4 E5:4 |'

WALK = {'K': 'x.x.x.x.x.x.x.x.', 'S': '....x.......x...', 'R': 'x.o.x.o.x.o.x.o.'}
CLIMB = {'K': 'x.xxx.xx..xxx.xx', 'S': '....x.......x...', 'R': 'x.o.x.o.x.o.x.o.'}
CLIMB_BASS = 'R.RR..OO..RR..OO'


def build():
    P = {}
    P['violins'] = lead(A_MEL, 4, 94) + swell(lead(B_ANSWER, 12, 90), 18, 20, 0, 8) + lead(C_MEL, 20, 98) + lead(A_MEL, 28, 100)
    P['solo_violin'] = lead(B_ANSWER, 12, 80)
    P['trumpet'] = (fit(lead(A_MEL, 4, 70), 'E4', 'G6') + lead(B_CALL, 12, 94) + double(lead(C_MEL, 20, 80), -12)
                    + fit(lead(A_MEL, 28, 72), 'E4', 'G6'))
    P['synlead'] = lead(A_MEL, 28, 60)
    P['flute'] = within(lead(C_MEL, 20, 62), 24, 28)
    P['oboe'] = double(lead(A_MEL, 4, 50), -12)
    P['horn'] = (stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E4', 3, 'x.x.x.x.x...x...', vel=80, gate=0.7)
                 + stabs(pick(CHORDS, 12, 20), 'E3', 'E4', 3, 'x.x...x...x.x...', vel=74, gate=0.6)
                 + stabs(pick(CHORDS, 20, 28), 'G3', 'G4', 3, 'x-------x-------', vel=76, gate=0.9))
    P['trombone'] = roots(pick(CHORDS, 20, 28), 'E2', 'D#3', vel=92)
    P['bells'] = lead(BELLS, 20, 90)
    P['piano'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=64, accent=8)
                  + arpeggio(pick(CHORDS, 12, 20), 'E4', 'E6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=58, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'E3', 'E5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=70, accent=8))
    P['violins#2'] = (trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E4', 3, vel=60))
                      + trem(swell(sustained(pick(CHORDS, 12, 20), 'E4', 'E5', 3, vel=54), 18, 20, 0, 14))
                      + trem(sustained(pick(CHORDS, 20, 28), 'E4', 'E5', 3, vel=64)))
    P['violas'] = arpeggio(pick(CHORDS, 20, 28), 'E4', 'E5', [0, 1, 2, 1], step=0.5, vel=62, accent=6)
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E2', 'E3', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + arpeggio(pick(CHORDS, 12, 20), 'E2', 'E3', [0, 1, 0, 2], step=0.5, vel=72, accent=8)
                  + arpeggio(pick(CHORDS, 20, 28), 'E2', 'E3', [0, 0, 1, 0], step=0.25, vel=76, accent=10))
    P['contrabass'] = roots(pick(CHORDS, 20, 28), 'E1', 'D#2', vel=70)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'E3', 'E4', 3, vel=56)
    # Octave 1 for E-F#-G and octave 2 from A keeps the climb from folding back down an octave.
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 96, context=CHORDS) + bass_part(pick(CHORDS, 12, 16), 'walk', 92, context=CHORDS)
                 + bass_part(pick(CHORDS, 16, 20), 'eighth', 92, context=CHORDS)
                 + bass_line(pick(CHORDS, 20, 23), CLIMB_BASS, octave=1, vel=100) + bass_line(pick(CHORDS, 23, 28), CLIMB_BASS, octave=2, vel=100)
                 + bass_part(pick(CHORDS, 28, 36), 'gallop', 100, context=CHORDS))
    middle = (crash_at(12) + drums(WALK, bar=12, bars=3, kit=K) + fill_at(15, 'tom') + fill_at(19, 'snare')
              + crash_at(20) + drums(CLIMB, bar=20, bars=3, kit=K) + crash_at(22) + fill_at(23, 'snare')
              + crash_at(24) + drums(CLIMB, bar=24, bars=3, kit=K) + crash_at(26) + fill_at(27, 'tom'))
    P['drums'] = drum_part([(4, 12, 'double'), (16, 19, 'double'), (28, 36, 'double')]) + choke_hats(middle, Clock(BPM))
    P['battery'] = [cymbal_swell(20 * 4, BPM, 96)] + drums({'BD': 'X...............'}, bar=20, kit=BATTERY)
    P['timpani'] = (timp_roll(19, 'B1', 'E2') + [Note(24 * 4, 1.0, 35, 100, '', {})] + timp_roll(35, 'B1', 'E2')[:-1]
                    + tpt_hits(4, 'E2', 114))
    P['gong'] = [Note(20 * 4, 4, 60, 104, '', {})]
    intros.apply(P, 'gong_dark', INTRO)
    return P, {'trombone': {'gain': 2.0}}
