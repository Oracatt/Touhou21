"""Extra Boss: Tamatsugi Mio, the ending that will not stop. E minor, 176 BPM.

4-bar intro, then a 32-bar loop: A (relentless eighths, violins and trumpet over gallop and piano) /
B (oboe, flute, strings) / chorus (trumpet + violins + synth lead, trombone and horn answer, gong) / A'.
B major closes every section so the loop never settles."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, fit, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.score import arpeggio, progression, roots, stabs, sustained
from studio.core import Note

TITLE = 'bossExtra'
BPM = 176
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 207
HALL = 2.0
LEAD = 'violins'
MELODIC = ('flute', 'oboe', 'synlead', 'piccolo')
LEADS = ('violins', 'trumpet')
TARGETS = {'trombone': -9.0, 'horn': -10.0, 'flute': -10.5, 'oboe': -9.5, 'piccolo': -11.5, 'synlead': -9.0, 'gong': -14.0}
SCALE = {4, 6, 7, 9, 11, 0, 2, 3}   # E natural minor plus D#

INTRO = progression('Em | C | D | B', bar=0)
A_CH = progression('Em | Em | C | D | Em | Em | Am | B', bar=4)
B_CH = progression('G | D | Am | Em | C | G | C:2 B:2 | B', bar=12)
C_CH = progression('C | D | Em | B | C | D | Am | B', bar=20)
A2_CH = progression('Em | Em | C | D | Em | Em | Am | B', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 G5:4 E6:4 | A5:8 F#5:4 D6:4 | F#6:4 D#6:4 B5:8 |'
A_MEL = ('E6:2 B5:2 G5:2 B5:2 E6:4 G6:4 | F#6:2 E6:2 D6:2 B5:2 G5:8 | C6:2 E6:2 G6:2 E6:2 C6:4 G5:4 | D6:2 F#6:2 A6:2 F#6:2 D6:4 A5:4 | '
         'E6:2 G6:2 B6:4 G6:2 E6:2 B5:4 | E6:3 D6:1 B5:4 G5:4 B5:4 | A5:2 C6:2 E6:4 A6:4 E6:4 | D#6:4 F#6:4 B6:4 F#6:2 D#6:2 |')
B_MEL = ('B5:8 D6:4 G6:4 | A5:8 F#5:4 D5:4 | C6:6 E6:2 A6:4 E6:4 | G6:6 E6:2 B5:4 E6:4 | '
         'G6:6 E6:2 C6:4 E6:4 | D6:6 B5:2 G5:4 B5:4 | G6:4 E6:4 F#6:4 D#6:4 | B5:8 D#6:4 F#6:2 B6:2 |')
C_MEL = ('G6:3 G6:3 C6:2 E6:4 G6:4 | A6:3 A6:3 D6:2 F#6:4 A6:4 | B6:3 B6:3 E6:2 G6:4 B6:4 | F#6:3 D#6:1 B5:4 D#6:4 F#6:4 | '
         'E6:3 G6:3 C6:2 E6:4 G6:4 | F#6:3 A6:3 D6:2 F#6:4 A6:4 | C6:6 E6:2 A6:4 E6:4 | B6:4 F#6:4 D#6:8 |')
TROMBONE = 'G3:16 | A3:16 | B3:16 | F#3:16 | G3:16 | A3:16 | E3:16 | F#3:16 |'
HORN = 'E4:16 | F#4:16 | G4:16 | D#4:16 | E4:16 | F#4:16 | C4:16 | D#4:16 |'


def build():
    P = {}
    P['violins'] = lead(A_MEL, 4, 94) + lead(C_MEL, 20, 96) + lead(A_MEL, 28, 100) + sustained(pick(B_CH, 12, 20), 'E4', 'E5', 3, vel=60)
    P['trumpet'] = fit(lead(A_MEL, 4, 70), 'E4', 'G6') + fit(lead(C_MEL, 20, 94), 'E4', 'G6') + fit(lead(A_MEL, 28, 72), 'E4', 'G6')
    P['synlead'] = lead(C_MEL, 20, 84) + lead(A_MEL, 28, 60)
    P['flute'] = lead(I_MEL, 0, 72) + lead(B_MEL, 12, 78)
    P['oboe'] = lead(B_MEL, 12, 66) + double(lead(A_MEL, 4, 50), -12)
    P['piccolo'] = double(lead(C_MEL, 20, 58), 12)
    P['trombone'] = fit(double(lead(C_MEL, 20, 70), -24), 'E2', 'B4')[:0] + lead(TROMBONE, 20, 76, gate=1.0)
    P['horn'] = lead(HORN, 20, 72, gate=1.0) + stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E4', 3, 'x.x.x.x.x...x...', vel=80, gate=0.7)
    P['piano'] = (arpeggio(INTRO, 'E3', 'E6', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=58, accent=8)
                  + arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=64, accent=8)
                  + arpeggio(pick(CHORDS, 12, 20), 'E3', 'E5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'E3', 'E5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=72, accent=8))
    P['glock'] = lead(I_MEL, 0, 60)
    P['xylo'] = arpeggio(pick(CHORDS, 12, 20), 'E5', 'E6', [0, 2, 1, 2], step=0.25, vel=56, accent=6)
    P['violins#2'] = trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E3', 'E4', 3, vel=60)) + trem(sustained(pick(CHORDS, 20, 28), 'E3', 'E4', 3, vel=70))
    P['violas'] = sustained(pick(CHORDS, 12, 20), 'E3', 'E4', 3, vel=62) + arpeggio(pick(CHORDS, 20, 28), 'E3', 'E4', [0, 1], step=0.5, vel=74, accent=8)
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'E2', 'E3', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + roots(pick(CHORDS, 12, 20), 'E2', 'D#3', vel=70) + arpeggio(pick(CHORDS, 20, 28), 'E2', 'E3', [0, 1], step=0.5, vel=78, accent=8))
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'E3', 'E4', 3, vel=58)
    P['pluck'] = arpeggio(pick(CHORDS, 20, 28), 'E4', 'E5', [0, 1, 2, 1, 3, 2, 1, 2], step=0.25, vel=58, accent=6)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 96, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 88, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 104, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 100, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 84, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'double'), (12, 20, 'half'), (20, 28, 'rock'), (28, 36, 'double')]) + fill_at(3, 'stop')
    P['timpani'] = timp_roll(19, 'B1', 'E2') + timp_roll(35, 'B1', 'E2')[:-1] + tpt_hits(4, 'E2', 114)
    P['gong'] = [Note(20 * 4, 4, 60, 104, '', {})]
    swell(P['violins'], 12, 20, -4, 6)
    intros.apply(P, 'gong_dark', INTRO)
    return P, {'trombone': {'gain': 2.0}}
