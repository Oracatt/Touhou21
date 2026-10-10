"""Stage 5 Boss: Mikage Fusae, the proofreader of shadow. B-flat minor, 164 BPM.

4-bar intro (a lone clarinet reading the first line aloud), then a 32-bar loop:
A (a dotted, march-like theme sung by horn and clarinet over a marimba "typewriter" and a four-on-the-floor kit) /
B (stop-time: the band stamps 3+3+2 over a bass walking down from B-flat while claves tick through the gaps
and xylophone or low reeds cross out a word; then an F pedal winds the strings and snare up) /
chorus (a wide, slow hymn for violins and oboe in half-time, horn counter-line, trumpet doubling an octave below, timpani and gong) /
A' (the theme again, now on trumpet over horn and clarinet).
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
MELODIC = ('oboe', 'piccolo', 'clarinet')
LEADS = ('trumpet', 'violins', 'horn')
TARGETS = {'trombone': -8.5, 'horn#2': -9.5, 'bassoon': -10.0, 'oboe': -9.0, 'clarinet': -8.5, 'piccolo': -11.5, 'xylo': -12.0,
           'battery': -12.5, 'gong': -14.0}
SCALE = {10, 0, 1, 3, 5, 6, 8, 9}   # B-flat natural minor plus A

INTRO = progression('Bbm | Gb | Ab | F', bar=0)
A_CH = progression('Bbm | Bbm | Gb | Ab | Bbm | Bbm | Ebm | F', bar=4)
B_CH = progression('Bbm | Bbm/A | Bbm/Ab | Bbm6/G | Bbm/F | Db/F | Ebm/F | F', bar=12)
C_CH = progression('Gb | Ab | Bbm | F | Gb | Ab | Ebm | F', bar=20)
A2_CH = progression('Bbm | Bbm | Gb | Ab | Bbm | Bbm | Ebm | F', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + A2_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('chorus', 20, 28), ("A'", 28, 36)]

# Dotted "long-short" theme in the middle register (horn / clarinet written pitch, trombone an octave down).
A_MEL = ('Bb4:6 Ab4:2 F4:4 Bb4:4 | Db5:6 C5:2 Bb4:8 | Gb4:6 F4:2 Db4:4 Gb4:4 | Ab4:6 Gb4:2 F4:4 C5:4 | '
         'Bb4:6 Db5:2 F5:4 Db5:4 | Eb5:6 Db5:2 F4:4 Bb4:4 | Gb4:6 F4:2 Eb4:4 Gb4:4 | A4:4 C5:4 F5:8 |')
B_MEL = ('Bb5:3^ Bb5:3^ Db6:2^ r:8 | Bb5:3^ Bb5:3^ Db6:2^ r:8 | Db6:3^ Db6:3^ F6:2^ r:8 | G5:3^ Bb5:3^ Db6:2^ r:8 | '
         'Db6:3^ C6:3 Bb5:2 F5:4 Bb5:4 | Eb6:3^ Db6:3 C6:2 Ab5:4 Db6:4 | F6:3^ Eb6:3 Db6:2 Bb5:4 Eb6:4 | A5:3^ A5:3^ C6:2^ C6:8 |')
B_HIGH = 'r:8 Bb5:1 C6 Db6 Eb6 F6 Eb6 Db6:2 | r:16 | r:8 Db6:1 Eb6 F6 Gb6 Ab6 Gb6 F6:2 | r:16 |'
B_LOW = ('Bb2:3^ Bb2:3^ Bb2:2^ r:8 | A2:3^ A2:3^ A2:2^ F3:1 Eb3 Db3 C3 Bb2 C3 A2:2 | Ab2:3^ Ab2:3^ Ab2:2^ r:8 | '
         'G2:3^ G2:3^ G2:2^ r:8 |')
B_BASS = 'Bb1:3. Bb1:3. Bb1:2. r:8 | A1:3. A1:3. A1:2. r:8 | Ab1:3. Ab1:3. Ab1:2. r:8 | G1:3. G1:3. G1:2. r:8 |'
STAMP = 'X..x..x.........'
B_FILL = {'K': STAMP, 'S': '......x.xx......', 'T1': '..........xx....', 'T3': '............xx..', 'T4': '..............xX'}
# Wide, slow hymn: held notes and sixth/octave leaps instead of repeated-note riffs.
C_MEL = ('Db6:8 Eb6:2 Db6:2 Bb5:4 | C6:6 Eb6:2 Ab6:8 | F6:6 Eb6:2 Db6:4 Bb5:4 | C6:4 A5:4 C6:4 F6:4 | '
         'Gb6:6 F6:2 Eb6:4 Db6:4 | Eb6:4 C6:4 Eb6:8 | Gb6:6 Bb6:2 Gb6:4 Eb6:4 | A6:6 F6:2 C6:8 |')
COUNTER = 'Bb4:8 Db5:8 | C5:8 Eb5:8 | Db5:8 F5:8 | C5:8 A4:8 | Bb4:8 Db5:8 | C5:8 Eb5:8 | Gb4:8 Bb4:8 | A4:8 C5:8 |'
TROMBONE = 'Gb2:8 Db3:8 | Ab2:8 Eb3:8 | Bb2:8 F3:8 | F2:8 C3:8 | Gb2:8 Db3:8 | Ab2:8 Eb3:8 | Eb2:8 Bb2:8 | F2:8 C3:8 |'


def build():
    P = {}
    A_SPANS = pick(CHORDS, 4, 12) + pick(CHORDS, 28, 36)
    P['trumpet'] = (fit(lead(B_MEL, 12, 96), 'F3', 'G6')
                    + fit(within(double(lead(C_MEL, 20, 84), -12), 24, 28), 'F3', 'G6')
                    + fit(lead(A_MEL, 28, 100), 'F3', 'G6'))
    P['horn'] = fit(lead(A_MEL, 4, 92, gate=0.98) + lead(A_MEL, 28, 82, gate=0.98), 'F3', 'F5')
    P['clarinet'] = fit(lead(A_MEL, 4, 66) + lead(A_MEL, 28, 60), 'E3', 'C6')
    P['violins'] = double(lead(C_MEL, 20, 80), 0)
    P['oboe'] = double(lead(C_MEL, 20, 56), 0)
    P['piccolo'] = lead(B_HIGH, 12, 56) + double(lead(C_MEL, 20, 56), 12)
    P['xylo'] = lead(B_HIGH, 12, 66) + within(lead(B_MEL, 12, 58), 16, 20)
    P['marimba'] = arpeggio(A_SPANS, 'Bb3', 'Bb5', [0, 2, 1, 2], step=0.25, vel=58, accent=8)
    P['trombone'] = (fit(double(lead(A_MEL, 4, 76), -12), 'E2', 'B4') + lead(B_LOW, 12, 82)
                     + swell(lead('F2:16 | F2:16 | F2:16 | F2:16 |', 16, 68, gate=1.0), 16, 20, -2, 14)
                     + lead(TROMBONE, 20, 74, gate=1.0) + fit(double(lead(A_MEL, 28, 80), -12), 'E2', 'B4'))
    P['horn#2'] = (stabs(pick(CHORDS, 12, 16), 'Bb3', 'Bb4', 3, STAMP, vel=86, gate=0.7)
                   + swell(sustained(pick(CHORDS, 16, 20), 'F3', 'F4', 3, vel=58), 16, 20, -2, 18)
                   + lead(COUNTER, 20, 72, gate=1.0))
    P['bassoon'] = (arpeggio(A_SPANS, 'Bb2', 'Bb3', [0, None, 1, None], step=0.5, vel=74, accent=8)
                    + lead(B_LOW, 12, 72))
    P['piano'] = (stabs(A_SPANS, 'Bb2', 'Bb4', 4, '.x..x..x.x..x...', vel=74, gate=0.6)
                  + stabs(pick(CHORDS, 12, 16), 'Bb2', 'Bb4', 4, STAMP, vel=84, gate=0.6)
                  + swell(stabs(pick(CHORDS, 16, 20), 'Bb2', 'Bb3', 3, 'x..x..x.x..x..x.', vel=70, gate=0.6), 16, 20, 0, 16)
                  + arpeggio(pick(CHORDS, 20, 28), 'Bb3', 'Bb5', [0, 2, 1, 2, 3, 2, 1, 2], step=0.25, vel=66, accent=8))
    P['violins#2'] = (trem(sustained(A_SPANS, 'Bb3', 'Bb4', 3, vel=58))
                      + stabs(pick(CHORDS, 12, 16), 'Bb4', 'Bb5', 3, STAMP, vel=76, gate=0.5)
                      + swell(arpeggio(pick(CHORDS, 16, 20), 'Bb4', 'Bb6', [0, 1, 2, 3, 4, 3, 2, 1], step=0.25, vel=54, accent=8), 16, 20, 0, 24)
                      + trem(sustained(pick(CHORDS, 20, 28), 'Bb3', 'Bb4', 3, vel=64)))
    P['celli'] = (arpeggio(A_SPANS, 'Bb1', 'Bb2', [0, 1, 0, 2], step=0.25, vel=70, accent=10)
                  + lead(B_LOW, 12, 78) + figure_bass(pick(CHORDS, 16, 20), 'F2', 'E3', 'RO', 0.5, vel=74)
                  + arpeggio(pick(CHORDS, 20, 28), 'Bb1', 'Bb2', [0, 1], step=0.5, vel=76, accent=8))
    P['violas'] = (stabs(pick(CHORDS, 12, 16), 'F3', 'F4', 2, STAMP, vel=72, gate=0.5)
                   + swell(stabs(pick(CHORDS, 16, 20), 'F3', 'F4', 2, 'x.x.x.x.x.x.x.x.', vel=58, gate=0.5), 16, 20, 0, 18)
                   + sustained(pick(CHORDS, 20, 28), 'Bb3', 'Bb4', 3, vel=60))
    P['pad'] = sustained(pick(CHORDS, 20, 36), 'Bb3', 'Bb4', 3, vel=56)
    P['bass'] = (bass_part(pick(CHORDS, 4, 12), 'push', 96, context=CHORDS) + lead(B_BASS, 12, 104)
                 + bass_part(pick(CHORDS, 16, 18), 'eighth', 94, context=CHORDS) + bass_part(pick(CHORDS, 18, 20), 'steady', 96, context=CHORDS)
                 + bass_part(pick(CHORDS, 20, 24), 'half', 98, context=CHORDS) + bass_part(pick(CHORDS, 24, 28), 'octave', 100, context=CHORDS)
                 + bass_part(pick(CHORDS, 28, 36), 'push', 100, context=CHORDS)
                 + bass_part(pick(CHORDS, 2, 4), 'whole', 82, context=CHORDS))
    P['drums'] = (drum_part([(4, 12, 'march'), (20, 24, 'half'), (24, 28, 'dance'), (28, 36, 'march')]) + fill_at(3, 'stop')
                  + drums({'K': STAMP, 'S': '......x.........'}, bar=12, bars=3, kit=K) + drums(B_FILL, bar=15, kit=K)
                  + drums({'K': 'x...x...x...x...', 'S': 'o.o.o.o.x.x.x.x.'}, bar=16, bars=3, kit=K) + fill_at(19, 'roll')
                  + crash_at(12) + crash_at(16))
    P['battery'] = drums({'CL': 'x.o.x.o.x.o.x.o.'}, bar=12, bars=4, kit=BATTERY) + [cymbal_swell(20 * 4, BPM, 104)]
    P['timpani'] = (tpt_hits(4, 'Bb1', 112) + [Note(12 * 4, 1, midi('Bb1'), 104, '', {}), Note(14 * 4, 1, midi('Ab1'), 100, '', {})]
                    + swell(lead('F2:4 F2 F2 F2 | F2:4 F2 F2 F2 | F2:4 F2 F2 F2 | F2:4 F2 r:8 |', 16, 70), 16, 20, 0, 30)
                    + timp_roll(19, 'F2', 'Bb1') + timp_roll(35, 'F2', 'Bb1')[:-1])
    P['gong'] = [Note(20 * 4, 4, 60, 100, '', {})]
    intros.apply(P, 'lyric_solo', INTRO, lead='clarinet')
    return P, {'trombone': {'gain': 2.0}}
