"""Stage 3 Boss: Watarimori Miofune, the ferry that wants its fare. C minor, 150 BPM.

4-bar intro, then a 32-bar loop: A (a brass riff, trumpet over horns and trombone, shuffling kit) /
B (violins and flute, horn pedal) / chorus (trumpet + violins, trombone answer, timpani and gong) / A'.
G major closes both A' and the chorus so the loop slams back into C minor."""
from studio import intros
from studio.layers import bass_part, crash_at, double, drum_part, fill_at, fit, lead, pick, swell, timp_roll, tpt_hits
from studio.score import arpeggio, progression, roots, stabs, sustained
from studio.core import Note, midi

TITLE = 'boss03'
BPM = 150
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 203
HALL = 1.9
LEAD = 'trumpet'
MELODIC = ('flute', 'oboe')
LEADS = ('trumpet', 'violins')
TARGETS = {'trombone': -8.5, 'horn': -9.5, 'flute': -9.5, 'piano': -9.5, 'xylo': -12.0, 'gong': -14.0}
SCALE = {0, 2, 3, 5, 7, 8, 10, 11}   # C natural minor plus the leading tone B

INTRO = progression('Cm | Ab | Bb | G', bar=0)
A_CH = progression('Cm | Cm | Ab | Bb | Cm | Fm | Ab:2 G:2 | G', bar=4)
B_CH = progression('Eb | Bb | Ab | Fm | Eb | Bb | Ab | G', bar=12)
C_CH = progression('Ab | Bb | Cm | G | Ab | Bb | Fm | G', bar=20)
A2_CH = progression('Cm | Cm | Ab | Bb | Cm | Fm | Ab:2 G:2 | G', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

I_MEL = 'r:16 | r:8 Eb6:4 C6:4 | D6:8 F6:4 D6:4 | B5:4 D6:4 G6:8 |'
A_MEL = ('C6:3 C6:3 Eb6:2 D6:2 C6:2 G5:4 | G5:3 G5:3 Bb5:2 C6:8 | Ab5:3 Ab5:3 C6:2 Eb6:4 C6:4 | D6:3 D6:3 F6:2 D6:4 Bb5:4 | '
         'C6:3 C6:3 Eb6:2 G6:4 Eb6:4 | F6:3 F6:3 Ab6:2 F6:4 C6:4 | Eb6:4 C6:4 D6:4 B5:4 | G5:8 B5:4 D6:2 G6:2 |')
B_MEL = ('G5:6 Bb5:2 Eb6:4 D6:4 | D6:6 C6:2 Bb5:4 F5:4 | C6:6 Eb6:2 C6:4 Ab5:4 | Ab5:6 C6:2 F6:4 C6:4 | '
         'Bb5:4 Eb6:4 G6:4 Eb6:4 | F6:6 D6:2 Bb5:4 D6:4 | Eb6:2 F6:2 Eb6:4 C6:4 Ab5:4 | D6:8 B5:4 D6:2 F6:2 |')
C_MEL = ('Eb6:3 Eb6:3 Ab5:2 C6:4 Eb6:4 | F6:3 F6:3 Bb5:2 D6:4 F6:4 | G6:3 G6:3 C6:2 Eb6:4 G6:4 | D6:3 D6:3 G5:2 B5:4 D6:4 | '
         'C6:3 Eb6:3 Ab6:2 Eb6:4 C6:4 | D6:3 F6:3 Bb6:2 F6:4 D6:4 | Ab6:6 F6:2 C6:4 F6:4 | G6:4 D6:4 B5:4 D6:2 G6:2 |')
TROMBONE = 'Eb4:16 | F4:16 | G4:16 | D4:16 | Eb4:16 | F4:16 | C4:16 | D4:16 |'


def build():
    P = {}
    P['trumpet'] = lead(A_MEL, 4, 94) + lead(C_MEL, 20, 96) + lead(A_MEL, 28, 100)
    P['trombone'] = (fit(double(lead(A_MEL, 4, 76), -12), 'E2', 'B4') + lead(TROMBONE, 20, 74, gate=1.0) + fit(double(lead(A_MEL, 28, 80), -12), 'E2', 'B4'))
    P['violins'] = lead(B_MEL, 12, 84) + double(lead(C_MEL, 20, 78), 0)
    P['flute'] = lead(I_MEL, 0, 70) + double(lead(B_MEL, 12, 58), 12) + double(lead(C_MEL, 20, 66), 12)
    P['horn'] = (stabs(pick(CHORDS, 4, 12), 'C4', 'C5', 3, 'x..x..x.x...x...', vel=80, gate=0.7)
                 + sustained(pick(CHORDS, 12, 20), 'C4', 'C5', 3, vel=64)
                 + stabs(pick(CHORDS, 28, 36), 'C4', 'C5', 3, 'x..x..x.x...x...', vel=84, gate=0.7))
    P['piano'] = (stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'C3', 'C5', 4, '..x...x...x...x.', vel=74, gate=0.6)
                  + arpeggio(INTRO, 'C3', 'C6', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=58, accent=8)
                  + arpeggio(pick(CHORDS, 12, 20), 'C3', 'C5', [0, 2, 1, 2], step=0.5, vel=60, accent=6)
                  + arpeggio(pick(CHORDS, 20, 28), 'C3', 'C5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.5, vel=72, accent=8))
    P['xylo'] = double(lead(A_MEL, 4, 62), 12)[:0] + arpeggio(pick(CHORDS, 4, 12), 'C5', 'C6', [None, 1, None, 2, None, 1, None, 0], step=0.5, vel=58, accent=0)
    P['glock'] = lead(I_MEL, 0, 58)
    P['contrabass'] = [Note(n.beat, n.length, n.pitch - 12 if n.pitch > 40 else n.pitch, n.vel, n.art, {**n.extra, 'articulation': 'pizz', 'gate': 0.6})
                       for n in bass_part(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'sync', 90, context=CHORDS)]
    P['celli'] = roots(pick(CHORDS, 12, 20), 'C2', 'B2', vel=68) + arpeggio(pick(CHORDS, 20, 28), 'C2', 'C3', [0, 2], step=0.5, vel=76, accent=8)
    P['violas'] = sustained(pick(CHORDS, 12, 28), 'C3', 'C4', 3, vel=60)
    P['pad'] = sustained(pick(CHORDS, 12, 36), 'C4', 'C5', 3, vel=56)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'sync', 92, context=CHORDS) + bass_part(pick(CHORDS, 12, 20), 'half', 86, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 100, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'sync', 96, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 82, context=CHORDS))
    dr = drum_part([(4, 12, 'shuffle'), (12, 20, 'half'), (20, 28, 'rock'), (28, 36, 'shuffle')])
    P['drums'] = dr + fill_at(3, 'stop')
    P['timpani'] = timp_roll(19, 'G2', 'C2') + timp_roll(35, 'G2', 'C2')[:-1] + tpt_hits(4, 'C2', 112)
    P['gong'] = [Note(20 * 4, 4, 60, 96, '', {})]
    swell(P['violins'], 12, 20, -4, 6)
    intros.apply(P, 'brass_riff', INTRO)
    return P, {'trombone': {'gain': 2.0}, 'contrabass': {'gain': 2.0}}
