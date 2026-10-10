"""Stage 5 Boss: Mikage Fusae, the proofreader of shadow. B-flat minor, 164 BPM.

4-bar intro, then a 32-bar loop: A (trumpet riff in 3+3+2 over horns and bassoon, tight kit) /
B (stop-time: the band stamps 3+3+2 over a bass walking down from B-flat while claves tick through the gaps
and xylophone or low reeds cross out a word; then an F pedal winds the strings and snare up) /
chorus (trumpet + violins, trombone answer, timpani and gong) / A'.
F major closes every section so the loop returns to B-flat minor."""
from studio import intros
from studio.layers import (K, bass_part, crash_at, cymbal_swell, double, drum_part, figure_bass, fill_at, fit, lead, pick, swell,
                           timp_roll, tpt_hits, trem, within)
from studio.library import BATTERY
from studio.score import arpeggio, drums, progression, stabs, sustained
from studio.core import Note, midi

TITLE = 'boss05'
BPM = 164
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 205
HALL = 2.0
LEAD = 'trumpet'
MELODIC = ('oboe', 'piccolo')
LEADS = ('trumpet', 'violins')
TARGETS = {'trombone': -8.5, 'horn': -9.5, 'bassoon': -10.0, 'oboe': -9.0, 'piccolo': -11.5, 'xylo': -12.0, 'battery': -12.5,
           'gong': -14.0}
SCALE = {10, 0, 1, 3, 5, 6, 8, 9}   # B-flat natural minor plus A

INTRO = progression('Bbm | Gb | Ab | F', bar=0)
A_CH = progression('Bbm | Bbm | Gb | Ab | Bbm | Bbm | Ebm | F', bar=4)
B_CH = progression('Bbm | Bbm/A | Bbm/Ab | Bbm6/G | Bbm/F | Db/F | Ebm/F | F', bar=12)
C_CH = progression('Gb | Ab | Bbm | F | Gb | Ab | Ebm | F', bar=20)
A2_CH = progression('Bbm | Bbm | Gb | Ab | Bbm | Bbm | Ebm | F', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

A_MEL = ('Bb5:3 Bb5:3 Db6:2 F6:4 Db6:4 | Eb6:3 Db6:3 C6:2 Bb5:8 | Gb5:3 Gb5:3 Bb5:2 Db6:4 Bb5:4 | Ab5:3 Ab5:3 C6:2 Eb6:4 C6:4 | '
         'F6:3 F6:3 Db6:2 Bb5:4 Db6:4 | Bb5:3 C6:3 Db6:2 F6:8 | Gb6:4 Eb6:4 Bb5:4 Gb5:4 | A5:4 C6:4 F6:4 C6:2 A5:2 |')
B_MEL = ('Bb5:3^ Bb5:3^ Db6:2^ r:8 | Bb5:3^ Bb5:3^ Db6:2^ r:8 | Db6:3^ Db6:3^ F6:2^ r:8 | G5:3^ Bb5:3^ Db6:2^ r:8 | '
         'Db6:3^ C6:3 Bb5:2 F5:4 Bb5:4 | Eb6:3^ Db6:3 C6:2 Ab5:4 Db6:4 | F6:3^ Eb6:3 Db6:2 Bb5:4 Eb6:4 | A5:3^ A5:3^ C6:2^ C6:8 |')
B_HIGH = 'r:8 Bb5:1 C6 Db6 Eb6 F6 Eb6 Db6:2 | r:16 | r:8 Db6:1 Eb6 F6 Gb6 Ab6 Gb6 F6:2 | r:16 |'
B_LOW = ('Bb2:3^ Bb2:3^ Bb2:2^ r:8 | A2:3^ A2:3^ A2:2^ F3:1 Eb3 Db3 C3 Bb2 C3 A2:2 | Ab2:3^ Ab2:3^ Ab2:2^ r:8 | '
         'G2:3^ G2:3^ G2:2^ r:8 |')
B_BASS = 'Bb1:3. Bb1:3. Bb1:2. r:8 | A1:3. A1:3. A1:2. r:8 | Ab1:3. Ab1:3. Ab1:2. r:8 | G1:3. G1:3. G1:2. r:8 |'
STAMP = 'X..x..x.........'
B_FILL = {'K': STAMP, 'S': '......x.xx......', 'T1': '..........xx....', 'T3': '............xx..', 'T4': '..............xX'}
C_MEL = ('Db6:3 Db6:3 Gb6:2 Db6:4 Bb5:4 | Eb6:3 Eb6:3 Ab6:2 Eb6:4 C6:4 | F6:3 F6:3 Bb6:2 F6:4 Db6:4 | C6:3 C6:3 F6:2 A6:4 F6:4 | '
         'Bb6:3 Gb6:1 Db6:4 Gb6:4 Bb6:4 | Ab6:3 Eb6:1 C6:4 Eb6:4 Ab6:4 | Gb6:6 Eb6:2 Bb5:4 Eb6:4 | A6:4 F6:4 C6:8 |')
TROMBONE = 'Db4:16 | Eb4:16 | F4:16 | C4:16 | Db4:16 | Eb4:16 | Bb3:16 | C4:16 |'
HORN = 'Db5:16 | Eb5:16 | F5:16 | C5:16 | Db5:16 | Eb5:16 | Bb4:16 | C5:16 |'


def build():
    P = {}
    P['trumpet'] = fit(lead(A_MEL, 4, 94) + lead(B_MEL, 12, 96) + lead(C_MEL, 20, 98) + lead(A_MEL, 28, 100), 'F3', 'G6')
    P['violins'] = double(lead(C_MEL, 20, 78), 0)
    P['oboe'] = double(lead(A_MEL, 28, 56), 0)
    P['piccolo'] = lead(B_HIGH, 12, 56) + double(lead(C_MEL, 20, 60), 12)
    P['xylo'] = lead(B_HIGH, 12, 66) + within(lead(B_MEL, 12, 58), 16, 20)
    P['trombone'] = (fit(double(lead(A_MEL, 4, 76), -12), 'E2', 'B4') + lead(B_LOW, 12, 82)
                     + swell(lead('F2:16 | F2:16 | F2:16 | F2:16 |', 16, 68, gate=1.0), 16, 20, -2, 14)
                     + lead(TROMBONE, 20, 74, gate=1.0) + fit(double(lead(A_MEL, 28, 80), -12), 'E2', 'B4'))
    P['horn'] = (stabs(pick(CHORDS, 4, 12), 'Bb3', 'Bb4', 3, 'x..x..x.x...x...', vel=80, gate=0.7)
                 + stabs(pick(CHORDS, 12, 16), 'Bb3', 'Bb4', 3, STAMP, vel=86, gate=0.7)
                 + swell(sustained(pick(CHORDS, 16, 20), 'F3', 'F4', 3, vel=58), 16, 20, -2, 18)
                 + lead(HORN, 20, 70, gate=1.0) + stabs(pick(CHORDS, 28, 36), 'Bb3', 'Bb4', 3, 'x..x..x.x...x...', vel=84, gate=0.7))
    P['bassoon'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb2', 'Bb3', [0, None, 1, None], step=0.5, vel=76, accent=8)
                    + lead(B_LOW, 12, 72))
    P['piano'] = (stabs(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb2', 'Bb4', 4, '..x...x...x...x.', vel=76, gate=0.6)
                  + stabs(pick(CHORDS, 12, 16), 'Bb2', 'Bb4', 4, STAMP, vel=84, gate=0.6)
                  + swell(stabs(pick(CHORDS, 16, 20), 'Bb2', 'Bb3', 3, 'x..x..x.x..x..x.', vel=70, gate=0.6), 16, 20, 0, 16)
                  + arpeggio(pick(CHORDS, 20, 28), 'Bb3', 'Bb5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=70, accent=8))
    P['violins#2'] = (trem(sustained(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb3', 'Bb4', 3, vel=58))
                      + stabs(pick(CHORDS, 12, 16), 'Bb4', 'Bb5', 3, STAMP, vel=76, gate=0.5)
                      + swell(arpeggio(pick(CHORDS, 16, 20), 'Bb4', 'Bb6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=54, accent=8), 16, 20, 0, 24)
                      + trem(sustained(pick(CHORDS, 20, 28), 'Bb3', 'Bb4', 3, vel=68)))
    P['celli'] = (arpeggio(pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36), 'Bb1', 'Bb2', [0, 0, 1, 0], step=0.25, vel=72, accent=10)
                  + lead(B_LOW, 12, 78) + figure_bass(pick(CHORDS, 16, 20), 'F2', 'E3', 'RO', 0.5, vel=74)
                  + arpeggio(pick(CHORDS, 20, 28), 'Bb1', 'Bb2', [0, 1], step=0.5, vel=78, accent=8))
    P['violas'] = (stabs(pick(CHORDS, 12, 16), 'F3', 'F4', 2, STAMP, vel=72, gate=0.5)
                   + swell(stabs(pick(CHORDS, 16, 20), 'F3', 'F4', 2, 'x.x.x.x.x.x.x.x.', vel=58, gate=0.5), 16, 20, 0, 18)
                   + sustained(pick(CHORDS, 20, 28), 'Bb3', 'Bb4', 3, vel=60))
    P['pad'] = sustained(pick(CHORDS, 20, 36), 'Bb3', 'Bb4', 3, vel=56)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'sync', 94, context=CHORDS) + lead(B_BASS, 12, 104)
                 + bass_part(pick(CHORDS, 16, 18), 'eighth', 94, context=CHORDS) + bass_part(pick(CHORDS, 18, 20), 'steady', 96, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 28), 'drive', 102, context=CHORDS) + bass_part(pick(CHORDS, 28, 36), 'sync', 98, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 82, context=CHORDS))
    P['drums'] = (drum_part([(4, 12, 'drive'), (20, 28, 'rock'), (28, 36, 'drive2')]) + fill_at(3, 'stop')
                  + drums({'K': STAMP, 'S': '......x.........'}, bar=12, bars=3, kit=K) + drums(B_FILL, bar=15, kit=K)
                  + drums({'K': 'x...x...x...x...', 'S': 'o.o.o.o.x.x.x.x.'}, bar=16, bars=3, kit=K) + fill_at(19, 'roll')
                  + crash_at(12) + crash_at(16))
    P['battery'] = drums({'CL': 'x.o.x.o.x.o.x.o.'}, bar=12, bars=4, kit=BATTERY) + [cymbal_swell(20 * 4, BPM, 104)]
    P['timpani'] = (tpt_hits(4, 'Bb1', 112) + [Note(12 * 4, 1, midi('Bb1'), 104, '', {}), Note(14 * 4, 1, midi('Ab1'), 100, '', {})]
                    + swell(lead('F2:4 F2 F2 F2 | F2:4 F2 F2 F2 | F2:4 F2 F2 F2 | F2:4 F2 r:8 |', 16, 70), 16, 20, 0, 30)
                    + timp_roll(19, 'F2', 'Bb1') + timp_roll(35, 'F2', 'Bb1')[:-1])
    P['gong'] = [Note(20 * 4, 4, 60, 100, '', {})]
    intros.apply(P, 'fanfare', INTRO)
    return P, {'trombone': {'gain': 2.0}}
