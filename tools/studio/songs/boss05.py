"""Stage 5 Boss: Mikage Fusae, the proofreader of shadow. B-flat minor, 164 BPM.

4-bar intro, then a 32-bar loop: A (trumpet riff in 3+3+2 over horns and bassoon, tight kit) /
B (violins and oboe, long lines) / chorus (trumpet + violins, trombone answer, timpani and gong) / A'.
F major closes every section so the loop returns to B-flat minor."""
from studio import intros
from studio.layers import bass_part, double, drum_part, fill_at, fit, lead, pick, swell, timp_roll, tpt_hits, trem
from studio.score import arpeggio, progression, roots, stabs, sustained
from studio.core import Note

TITLE = 'boss05'
BPM = 164
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 205
HALL = 2.0
LEAD = 'trumpet'
MELODIC = ('flute', 'oboe', 'piccolo')
LEADS = ('trumpet', 'violins')
TARGETS = {'trombone': -8.5, 'horn': -9.5, 'bassoon': -10.0, 'oboe': -9.0, 'flute': -10.5, 'piccolo': -11.5, 'gong': -14.0}
SCALE = {10, 0, 1, 3, 5, 6, 8, 9}   # B-flat natural minor plus A

INTRO = progression('Bbm | Gb | Ab | F', bar=0)
A_CH = progression('Bbm | Bbm | Gb | Ab | Bbm | Bbm | Ebm | F', bar=4)
B_CH = progression('Db | Ab | Bbm | Gb | Db | Ab | Gb:2 F:2 | F', bar=12)
C_CH = progression('Gb | Ab | Bbm | F | Gb | Ab | Ebm | F', bar=20)
A2_CH = progression('Bbm | Bbm | Gb | Ab | Bbm | Bbm | Ebm | F', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 Db6:4 Bb5:4 | Eb6:8 C6:4 Ab5:4 | A5:4 C6:4 F6:8 |'
A_MEL = ('Bb5:3 Bb5:3 Db6:2 F6:4 Db6:4 | Eb6:3 Db6:3 C6:2 Bb5:8 | Gb5:3 Gb5:3 Bb5:2 Db6:4 Bb5:4 | Ab5:3 Ab5:3 C6:2 Eb6:4 C6:4 | '
         'F6:3 F6:3 Db6:2 Bb5:4 Db6:4 | Bb5:3 C6:3 Db6:2 F6:8 | Gb6:4 Eb6:4 Bb5:4 Gb5:4 | A5:4 C6:4 F6:4 C6:2 A5:2 |')
B_MEL = ('F6:8 Db6:4 Ab5:4 | Eb6:6 C6:2 Ab5:4 C6:4 | F6:6 Db6:2 Bb5:4 Db6:4 | Bb5:6 Db6:2 Gb6:4 Db6:4 | '
         'Ab5:6 Db6:2 F6:4 Db6:4 | C6:6 Eb6:2 Ab6:4 Eb6:4 | Db6:4 Bb5:4 C6:4 A5:4 | A5:8 C6:4 F6:2 A6:2 |')
C_MEL = ('Db6:3 Db6:3 Gb6:2 Db6:4 Bb5:4 | Eb6:3 Eb6:3 Ab6:2 Eb6:4 C6:4 | F6:3 F6:3 Bb6:2 F6:4 Db6:4 | C6:3 C6:3 F6:2 A6:4 F6:4 | '
         'Bb6:3 Gb6:1 Db6:4 Gb6:4 Bb6:4 | Ab6:3 Eb6:1 C6:4 Eb6:4 Ab6:4 | Gb6:6 Eb6:2 Bb5:4 Eb6:4 | A6:4 F6:4 C6:8 |')
TROMBONE = 'Db4:16 | Eb4:16 | F4:16 | C4:16 | Db4:16 | Eb4:16 | Bb3:16 | C4:16 |'
HORN = 'Db5:16 | Eb5:16 | F5:16 | C5:16 | Db5:16 | Eb5:16 | Bb4:16 | C5:16 |'


def build():
    P = {}
    P['trumpet'] = fit(lead(A_MEL, 4, 94) + lead(C_MEL, 20, 98) + lead(A_MEL, 28, 100), 'F3', 'G6')
    P['violins'] = lead(B_MEL, 12, 84) + double(lead(C_MEL, 20, 78), 0)
    P['oboe'] = lead(B_MEL, 12, 62) + double(lead(A_MEL, 28, 56), 0)
    P['flute'] = lead(I_MEL, 0, 70) + double(lead(B_MEL, 12, 56), 12)
    P['piccolo'] = double(lead(C_MEL, 20, 60), 12)
    P['trombone'] = fit(double(lead(A_MEL, 4, 76), -12), 'E2', 'B4') + lead(TROMBONE, 20, 74, gate=1.0) + fit(double(lead(A_MEL, 28, 80), -12), 'E2', 'B4')
    P['horn'] = (stabs(pick(CHORDS, 4, 12), 'Bb3', 'Bb4', 3, 'x..x..x.x...x...', vel=80, gate=0.7) + lead(HORN, 20, 70, gate=1.0)
                 + stabs(pick(CHORDS, 28, 36), 'Bb3', 'Bb4', 3, 'x..x..x.x...x...', vel=84, gate=0.7))
    P['bassoon'] = arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb2', 'Bb3', [0, None, 1, None], step=0.5, vel=76, accent=8)
    P['piano'] = (arpeggio(INTRO, 'Bb3', 'Bb5', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=58, accent=8)
                  + stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb2', 'Bb4', 4, '..x...x...x...x.', vel=76, gate=0.6)
                  + arpeggio(pick(CHORDS, 12, 20), 'Bb3', 'Bb5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'Bb3', 'Bb5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=70, accent=8))
    P['glock'] = lead(I_MEL, 0, 58)
    P['harp'] = arpeggio(pick(CHORDS, 12, 20), 'Bb3', 'Bb6', [0, 2, 3, 4, 3, 2], step=0.25, vel=52, accent=6)
    P['violins#2'] = trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb3', 'Bb4', 3, vel=58)) + trem(sustained(pick(CHORDS, 20, 28), 'Bb3', 'Bb4', 3, vel=68))
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb1', 'Bb2', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + roots(pick(CHORDS, 12, 20), 'Bb1', 'A2', vel=70) + arpeggio(pick(CHORDS, 20, 28), 'Bb1', 'Bb2', [0, 1], step=0.5, vel=78, accent=8))
    P['violas'] = sustained(pick(CHORDS, 12, 28), 'Bb3', 'Bb4', 3, vel=60)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'Bb3', 'Bb4', 3, vel=56)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'sync', 94, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 102, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'sync', 98, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 82, context=CHORDS))
    P['drums'] = drum_part([(4, 12, 'drive'), (12, 20, 'half'), (20, 28, 'rock'), (28, 36, 'drive2')]) + fill_at(3, 'stop')
    P['timpani'] = timp_roll(19, 'F2', 'Bb1') + timp_roll(35, 'F2', 'Bb1')[:-1] + tpt_hits(4, 'Bb1', 112)
    P['gong'] = [Note(20 * 4, 4, 60, 100, '', {})]
    swell(P['violins'], 12, 20, -4, 6)
    intros.apply(P, 'fanfare', INTRO)
    return P, {'trombone': {'gain': 2.0}}
