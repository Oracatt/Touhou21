"""Stage 6 Boss: Shirashiki Kotone, the solemn opening line. F minor, 172 BPM.

4-bar intro, then a 32-bar loop: A (a ceremonial call, trumpet and horns over strings and timpani) /
B (a procession: tubular bells toll two by two up the F minor chord over a rising bass, celli hammer an
eighth-note ostinato, the trumpet marches in dotted rhythms over toms, violin runs land on every other bar) /
chorus (trumpet + violins, trombone and horn answer, gong, tutti) / A'.
C major closes every section and pulls the loop back into F minor."""
from studio import intros
from studio.layers import K, bass_part, crash_at, cymbal_swell, double, drum_part, fill_at, fit, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.library import BATTERY
from studio.score import arpeggio, drums, progression, roots, stabs, sustained
from studio.core import Note

TITLE = 'boss06'
BPM = 172
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 206
HALL = 2.6
LEAD = 'trumpet'
MELODIC = ('oboe', 'piccolo')
LEADS = ('trumpet', 'violins')
TARGETS = {'trombone': -9.0, 'horn': -9.5, 'oboe': -10.0, 'piccolo': -11.5, 'bells': -9.0, 'battery': -12.5, 'gong': -14.0,
           'timpani': -12.0}
SCALE = {5, 7, 8, 10, 0, 1, 3, 4}   # F natural minor plus E

INTRO = progression('Fm | Db | Eb | C', bar=0)
A_CH = progression('Fm | Fm | Db | Eb | Fm | Bbm | Db:2 C:2 | C', bar=4)
B_CH = progression('Fm | Eb/G | Ab | Bbm | Fm | Eb/G | Bbm:2 C:2 | C', bar=12)
C_CH = progression('Db | Eb | Fm | C | Db | Eb | Bbm | C', bar=20)
A2_CH = progression('Fm | Fm | Db | Eb | Fm | Bbm | Db:2 C:2 | C', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

A_MEL = ('F5:4 F5:2 Ab5:2 C6:8 | Db6:4 C6:4 Ab5:4 F5:4 | Db6:4 Db6:2 F6:2 Ab6:8 | G6:4 Eb6:4 Bb5:4 G5:4 | '
         'F6:4 F6:2 Ab6:2 F6:8 | Bb5:4 Db6:4 F6:4 Db6:2 Bb5:2 | Ab5:4 Db6:4 E6:4 G6:4 | G6:8 E6:4 C6:2 E6:2 |')
B_MEL = ('C5:3^ C5:1 F5:4 Ab5:3^ G5:1 F5:4 | G4:3^ Bb4:1 Eb5:4 G5:8 | Eb5:3^ Eb5:1 Ab5:4 C6:3^ Bb5:1 Ab5:4 | Db6:3^ C6:1 Bb5:4 F5:8 | '
         'C5:3^ C5:1 F5:4 Ab5:3^ G5:1 Ab5:2 C6:2 | Eb6:3^ Db6:1 Bb5:4 G5:4 Bb5:4 | Db6:3^ C6:1 Bb5:4 C6:4 E6:4 | G6:12 E6:2 C6:2 |')
# One-shot bells ring for seconds: every toll is a tone of the chords that follow it.
B_BELLS = 'F4:8! C4:8? | r:16 | Ab4:8! Eb4:8? | r:16 | C5:8! F4:8? | r:16 | Db5:16! | r:16 |'
B_RUNS = ('r:16 | r:8 G4:1 Ab4 Bb4 C5 Db5 Eb5 F5 G5 | Ab5:2^ r:14 | r:8 Bb4:1 C5 Db5 Eb5 F5 G5 Ab5 Bb5 | '
          'C6:2^ r:14 | r:8 Bb4:1 C5 Db5 Eb5 F5 G5 Ab5 Bb5 | Db6:2^ r:14 | r:8 G4:1 Ab4 Bb4 C5 Db5 E5 F5 G5 |')
B_CELLI = ('F2:2! F2 F3 F2 C3 F2 F3 C3 | G2:2! G2 G3 G2 Bb2 G2 G3 Bb2 | Ab2:2! Ab2 Ab3 Ab2 Eb3 Ab2 Ab3 Eb3 | Bb2:2! Bb2 Bb3 Bb2 F3 Bb2 Bb3 F3 | '
           'F2:2! F2 F3 F2 C3 F2 F3 C3 | G2:2! G2 G3 G2 Bb2 G2 G3 Bb2 | Bb2:2! Bb2 Bb3 Bb2 C3! C3 C4 C3 | C3:2! C3 C4 C3 G3 C3 C4 G3 |')
B_TROMBONE = 'F3:8^ F3:8^ | G3:8^ G3:8^ | Ab3:8^ Ab3:8^ | Bb3:8^ Bb3:8^ | F3:8^ F3:8^ | G3:8^ G3:8^ | Bb3:8^ C4:8^ | C4:16^ |'
B_TIMPANI = ('F2:4 r:4 F2:4 r:4 | G2:4 r:4 G2:4 r:4 | Ab2:4 r:4 Ab2:4 r:4 | Bb2:4 r:4 Bb2:4 r:4 | F2:4 r:4 F2:4 r:4 | '
             'G2:4 r:4 G2:4 r:4 | Bb2:4 r:4 C3:4 r:4 | C2:4 r:12 |')
MARCH = {'K': 'x.......x.......', 'S': '....x.......x...', 'T4': 'x.....x.x.....x.', 'R': 'x...x...x...x...'}
MARCH_PICKUP = {'K': 'x.......x.......', 'S': '....x.......xxxx', 'T4': 'x.....x.x.......', 'R': 'x...x...x.......'}
MARCH2 = {'K': 'x...x...x...x...', 'S': 'o.o.x.o.o.o.x.oo', 'T4': 'x.....x.x.....x.', 'R': 'x.x.x.x.x.x.x.x.'}
C_MEL = ('Ab5:3 Ab5:3 Db6:2 F6:4 Ab6:4 | Bb5:3 Bb5:3 Eb6:2 G6:4 Bb6:4 | C6:3 C6:3 F6:2 Ab6:4 F6:4 | G6:3 E6:1 C6:4 G5:4 C6:4 | '
         'F6:3 Ab6:3 Db6:2 F6:4 Ab6:4 | G6:3 Bb6:3 Eb6:2 G6:4 Bb6:4 | F6:6 Db6:2 Bb5:4 Db6:4 | E6:4 G6:4 C6:8 |')
TROMBONE = 'Ab3:16 | Bb3:16 | C4:16 | G3:16 | Ab3:16 | Bb3:16 | F3:16 | G3:16 |'
HORN = 'F4:16 | G4:16 | Ab4:16 | E4:16 | F4:16 | G4:16 | Db4:16 | E4:16 |'


def build():
    P = {}
    P['trumpet'] = fit(lead(A_MEL, 4, 96) + lead(B_MEL, 12, 98) + lead(C_MEL, 20, 100) + lead(A_MEL, 28, 102), 'F3', 'G6')
    P['violins'] = swell(lead(B_RUNS, 12, 78), 12, 20, -6, 8) + double(lead(C_MEL, 20, 80), 0)
    P['oboe'] = fit(double(lead(A_MEL, 28, 56), 12), 'C4', 'C7')
    P['piccolo'] = double(lead(C_MEL, 20, 58), 12)
    P['bells'] = lead(B_BELLS, 12, 92)
    P['horn'] = (stabs(pick(CHORDS, 4, 12), 'F3', 'F4', 3, 'x.x.x.x.x...x...', vel=82, gate=0.7)
                 + fit(double(lead(B_MEL, 12, 78), -12), 'F3', 'F5')
                 + lead(HORN, 20, 72, gate=1.0) + stabs(pick(CHORDS, 28, 36), 'F3', 'F4', 3, 'x.x.x.x.x...x...', vel=86, gate=0.7))
    P['trombone'] = (fit(double(lead(A_MEL, 4, 76), -12), 'E2', 'B4') + lead(B_TROMBONE, 12, 78)
                     + lead(TROMBONE, 20, 76, gate=1.0) + fit(double(lead(A_MEL, 28, 80), -12), 'E2', 'B4'))
    P['piano'] = (stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F2', 'F4', 4, 'x...x...x...x...', vel=78, gate=0.6)
                  + stabs(pick(CHORDS, 12, 20), 'F4', 'F5', 3, '..x...x...x...x.', vel=70, gate=0.6)
                  + arpeggio(pick(CHORDS, 20, 28), 'F3', 'F5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=70, accent=8))
    P['violins#2'] = (trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F3', 'F4', 3, vel=60))
                      + swell(trem(sustained(pick(CHORDS, 12, 20), 'C5', 'C6', 3, vel=54)), 12, 20, 0, 20)
                      + trem(sustained(pick(CHORDS, 20, 28), 'F3', 'F4', 3, vel=70)))
    P['violas'] = (swell(trem(sustained(pick(CHORDS, 12, 20), 'F3', 'F4', 3, vel=56)), 12, 20, 0, 18)
                   + arpeggio(pick(CHORDS, 20, 28), 'F3', 'F4', [0, 1], step=0.5, vel=74, accent=8))
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F2', 'F3', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + lead(B_CELLI, 12, 72, gate=0.5) + arpeggio(pick(CHORDS, 20, 28), 'F2', 'F3', [0, 1], step=0.5, vel=78, accent=8))
    P['contrabass'] = roots(pick(CHORDS, 4, 36), 'F1', 'E2', vel=70)
    P['pad'] = sustained(pick(CHORDS, 20, 36), 'F3', 'F4', 3, vel=58)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 94, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'eighth', 96, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 104, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 98, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 84, context=CHORDS))
    P['drums'] = (drum_part([(4, 12, 'rock'), (20, 28, 'drive'), (28, 36, 'rock')]) + fill_at(3, 'stop')
                  + drums(MARCH, bar=12, bars=3, kit=K) + drums(MARCH_PICKUP, bar=15, kit=K) + drums(MARCH2, bar=16, bars=3, kit=K)
                  + fill_at(19, 'tom') + crash_at(12) + crash_at(16))
    P['battery'] = drums({'BD': 'X...............'}, bar=12, kit=BATTERY) + drums({'BD': 'X...............'}, bar=16, kit=BATTERY) + [cymbal_swell(20 * 4, BPM, 100)]
    P['timpani'] = (swell(lead(B_TIMPANI, 12, 90), 12, 20, 0, 16) + timp_roll(19, 'C2', 'F2') + timp_roll(35, 'C2', 'F2')[:-1]
                    + tpt_hits(4, 'F2', 114))
    P['gong'] = [Note(4 * 4, 4, 60, 96, '', {}), Note(20 * 4, 4, 60, 104, '', {})]
    intros.apply(P, 'snare_build', INTRO)
    return P, {'trombone': {'gain': 2.0}, 'contrabass': {'gain': 2.0}}
