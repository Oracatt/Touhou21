"""Stage 6 Boss: Shirashiki Kotone, the solemn opening line. F minor, 172 BPM.

4-bar intro, then a 32-bar loop: A (a ceremonial call, trumpet and horns over strings and timpani) /
B (violins and flute, long arc) / chorus (trumpet + violins, trombone and horn answer, gong, tutti) / A'.
C major closes every section and pulls the loop back into F minor."""
from studio.layers import bass_part, double, drum_part, fill_at, fit, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.score import arpeggio, progression, roots, stabs, sustained
from studio.core import Note

TITLE = 'boss06'
BPM = 172
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 206
HALL = 2.6
LEAD = 'trumpet'
MELODIC = ('flute', 'oboe', 'piccolo')
LEADS = ('trumpet', 'violins')
TARGETS = {'trombone': -9.0, 'horn': -9.5, 'flute': -10.5, 'oboe': -10.0, 'piccolo': -11.5, 'gong': -14.0, 'timpani': -12.0}
SCALE = {5, 7, 8, 10, 0, 1, 3, 4}   # F natural minor plus E

INTRO = progression('Fm | Db | Eb | C', bar=0)
A_CH = progression('Fm | Fm | Db | Eb | Fm | Bbm | Db:2 C:2 | C', bar=4)
B_CH = progression('Ab | Eb | Bbm | Fm | Db | Ab | Db:2 C:2 | C', bar=12)
C_CH = progression('Db | Eb | Fm | C | Db | Eb | Bbm | C', bar=20)
A2_CH = progression('Fm | Fm | Db | Eb | Fm | Bbm | Db:2 C:2 | C', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 Ab5:4 F5:4 | G5:8 Bb5:4 Eb6:4 | E6:4 G6:4 C6:8 |'
A_MEL = ('F5:4 F5:2 Ab5:2 C6:8 | Db6:4 C6:4 Ab5:4 F5:4 | Db6:4 Db6:2 F6:2 Ab6:8 | G6:4 Eb6:4 Bb5:4 G5:4 | '
         'F6:4 F6:2 Ab6:2 F6:8 | Bb5:4 Db6:4 F6:4 Db6:2 Bb5:2 | Ab5:4 Db6:4 E6:4 G6:4 | G6:8 E6:4 C6:2 E6:2 |')
B_MEL = ('Eb6:8 C6:4 Ab5:4 | Bb5:8 G5:4 Eb5:4 | F6:6 Db6:2 Bb5:4 Db6:4 | C6:6 Ab5:2 F5:4 Ab5:4 | '
         'Ab5:6 Db6:2 F6:4 Db6:4 | Eb6:6 C6:2 Ab5:4 C6:4 | F6:4 Db6:4 G6:4 E6:4 | E6:8 G5:4 C6:2 E6:2 |')
C_MEL = ('Ab5:3 Ab5:3 Db6:2 F6:4 Ab6:4 | Bb5:3 Bb5:3 Eb6:2 G6:4 Bb6:4 | C6:3 C6:3 F6:2 Ab6:4 F6:4 | G6:3 E6:1 C6:4 G5:4 C6:4 | '
         'F6:3 Ab6:3 Db6:2 F6:4 Ab6:4 | G6:3 Bb6:3 Eb6:2 G6:4 Bb6:4 | F6:6 Db6:2 Bb5:4 Db6:4 | E6:4 G6:4 C6:8 |')
TROMBONE = 'Ab3:16 | Bb3:16 | C4:16 | G3:16 | Ab3:16 | Bb3:16 | F3:16 | G3:16 |'
HORN = 'F4:16 | G4:16 | Ab4:16 | E4:16 | F4:16 | G4:16 | Db4:16 | E4:16 |'


def build():
    P = {}
    P['trumpet'] = fit(lead(A_MEL, 4, 96) + lead(C_MEL, 20, 100) + lead(A_MEL, 28, 102), 'F3', 'G6')
    P['violins'] = lead(B_MEL, 12, 86) + double(lead(C_MEL, 20, 80), 0)
    P['flute'] = lead(I_MEL, 0, 72) + double(lead(B_MEL, 12, 60), 12)
    P['oboe'] = double(lead(B_MEL, 12, 56), 0) + fit(fit(double(lead(A_MEL, 28, 56), 12), 'C4', 'C7'), 'C4', 'C7')
    P['piccolo'] = double(lead(C_MEL, 20, 58), 12)
    P['horn'] = (stabs(pick(CHORDS, 4, 12), 'F3', 'F4', 3, 'x.x.x.x.x...x...', vel=82, gate=0.7) + sustained(pick(CHORDS, 12, 20), 'F3', 'F4', 3, vel=66)
                 + lead(HORN, 20, 72, gate=1.0) + stabs(pick(CHORDS, 28, 36), 'F3', 'F4', 3, 'x.x.x.x.x...x...', vel=86, gate=0.7))
    P['trombone'] = fit(double(lead(A_MEL, 4, 76), -12), 'E2', 'B4') + lead(TROMBONE, 20, 76, gate=1.0) + fit(double(lead(A_MEL, 28, 80), -12), 'E2', 'B4')
    P['piano'] = (arpeggio(INTRO, 'F3', 'F5', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=58, accent=8)
                  + stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F2', 'F4', 4, 'x...x...x...x...', vel=78, gate=0.6)
                  + arpeggio(pick(CHORDS, 12, 20), 'F3', 'F5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'F3', 'F5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=70, accent=8))
    P['glock'] = lead(I_MEL, 0, 60)
    P['harp'] = arpeggio(pick(CHORDS, 12, 20), 'F3', 'F6', [0, 2, 3, 4, 3, 2], step=0.25, vel=52, accent=6)
    P['violins#2'] = trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F3', 'F4', 3, vel=60)) + trem(sustained(pick(CHORDS, 20, 28), 'F3', 'F4', 3, vel=70))
    P['violas'] = sustained(pick(CHORDS, 12, 20), 'F3', 'F4', 3, vel=62) + arpeggio(pick(CHORDS, 20, 28), 'F3', 'F4', [0, 1], step=0.5, vel=74, accent=8)
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'F2', 'F3', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + roots(pick(CHORDS, 12, 20), 'F1', 'E2', vel=70) + arpeggio(pick(CHORDS, 20, 28), 'F2', 'F3', [0, 1], step=0.5, vel=78, accent=8))
    P['contrabass'] = roots(pick(CHORDS, 4, 36), 'F1', 'E2', vel=70)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'F3', 'F4', 3, vel=58)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'gallop', 94, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 88, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 104, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'gallop', 98, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 84, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'rock'), (12, 20, 'half'), (20, 28, 'drive'), (28, 36, 'rock')]) + fill_at(3, 'stop')
    P['timpani'] = timp_roll(19, 'C2', 'F2') + timp_roll(35, 'C2', 'F2')[:-1] + tpt_hits(4, 'F2', 114)
    P['gong'] = [Note(4 * 4, 4, 60, 96, '', {}), Note(20 * 4, 4, 60, 104, '', {})]
    swell(P['violins'], 12, 20, -4, 6)
    return P, {'trombone': {'gain': 2.0}, 'contrabass': {'gain': 2.0}}
