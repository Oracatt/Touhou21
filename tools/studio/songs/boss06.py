"""Stage 6 Boss: Shirashiki Kotone, the solemn opening line. B-flat minor turning to B-flat major, 12/8.

A rite instead of a battle march: pipe organ, tubular bells and a processional 12/8 (BPM counts dotted
quarters, so every beat splits into three eighths of 4/3 sixteenth-units); no piano, drum kit or synth.
4-bar intro (two bell tolls over a quiet organ), then a 32-bar loop:
A (the procession: the horns sing the B-flat minor theme over organ, muffled drum and pizzicato bass) /
B (the major key opens: violins and flute climb over harp arpeggios) /
C (the hymn: trumpets and the full organ, horns an octave below, gong and cymbals) /
D (the bells answer the two opening tolls with a whole descending scale over a B-flat pedal,
then the procession gathers again in B-flat minor and F7 hands the loop back to its first beat)."""
from studio.core import Note, midi
from studio.layers import battery_hit, cymbal_swell, double, figure_bass, lead, pick, pizz, swell, timp_roll, trem
from studio.library import BATTERY
from studio.score import arpeggio, drums, progression, roots, sustained

TITLE = 'boss06'
BPM = 112
INTRO_BARS, LOOP_BARS = 4, 32
SEED = 619
HALL = 2.6
LEAD = 'violins'
MELODIC = ('flute', 'clarinet')
LEADS = ('violins', 'trumpet')
TARGETS = {'horn': -4.5, 'bells': -7.0, 'organ': -11.0, 'organ#2': -11.0, 'horn#2': -10.5, 'trumpet#2': -9.5, 'trombone': -10.5,
           'flute': -9.0, 'clarinet': -10.5, 'harp': -11.0, 'glock': -13.5, 'violins#2': -10.5, 'violas': -11.5, 'celli': -10.0,
           'contrabass': -10.0, 'battery': -10.5, 'timpani': -12.0}
SCALE = {10, 0, 1, 2, 3, 5, 6, 7, 8, 9}   # B-flat minor and B-flat major: the loop turns from one into the other

INTRO = progression('Bbm | Gb | Ebm | F', bar=0)
A_CH = progression('Bbm | Gb | Ab | Bbm | Ebm | Gb | Fsus4 | F', bar=4)
B_CH = progression('Bb | F | Gm | Eb | Bb | F | Eb | F7', bar=12)
C_CH = progression('Bb | Eb | Bb | F | Gm | Eb | Cm7 | F', bar=20)
D_CH = progression('Bb | Eb/Bb | Bb | Ebm/Bb | Ebm | Gb | Ab | F7', bar=28)
CHORDS = INTRO + A_CH + B_CH + C_CH + D_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 20), ('C', 20, 28), ('D', 28, 36)]

# 12/8 values in sixteenth-units: eighth 4/3, quarter 8/3, dotted quarter 4, dotted half 8.
THEME_A = ('Bb4:4 F4:8/3 Gb4:4/3 F4:4 Db4:4 | Eb4:8/3 Db4:4/3 Bb3:4 Db4:8/3 Eb4:4/3 Gb4:4 | '
           'F4:8/3 Eb4:4/3 C4:4 Eb4:8/3 F4:4/3 Ab4:4 | Bb4:8 Ab4:8/3 Gb4:4/3 F4:4 | '
           'Gb4:4 Eb4:8/3 F4:4/3 Gb4:4 Bb4:4 | Db5:8 Bb4:8/3 Ab4:4/3 Gb4:4 | '
           'F4:4 Bb4:8/3 Ab4:4/3 C5:4 Bb4:4 | A4:8 C5:8/3 Bb4:4/3 A4:4 |')
THEME_B = ('F4:4/3 Bb4 C5 D5:8 F5:4 | Eb5:8/3 D5:4/3 C5:4 A4:4 C5:4 | D5:4 G5:8/3 F5:4/3 D5:4 Bb4:4 | '
           'C5:8/3 Bb4:4/3 G4:4 Bb4:4 Eb5:4 | F5:8 D5:8/3 Eb5:4/3 F5:4 | C6:8 A5:8/3 Bb5:4/3 C6:4 | '
           'Bb5:4 G5:8/3 Eb5:4/3 G5:4 Bb5:4 | A5:8 F5:4 Eb5:4 |')
HYMN = ('D5:8 C5:4/3 D5 Eb5 F5:4 | G5:8 F5:8/3 Eb5:4/3 Bb4:4 | D5:8/3 Eb5:4/3 F5:4 Bb5:8 | A5:8 G5:8/3 F5:4/3 C5:4 | '
        'D5:8 Eb5:4/3 D5 C5 Bb4:4 | Eb5:8 F5:8/3 G5:4/3 Bb5:4 | C6:8 Bb5:8/3 G5:4/3 Eb5:4 | F5:12 C5:4 |')
ANSWER = 'Bb4:8 A4:8 | G4:8 F4:8 | Eb4:8 D4:8 | C4:8 Bb3:8 |'
GATHER = 'Gb5:8 F5:8/3 Eb5:4/3 Bb4:4 | Db5:8 Eb5:8/3 Db5:4/3 Bb4:4 | C5:8 Eb5:8/3 F5:4/3 Ab5:4 | A5:8 C6:8/3 Bb5:4/3 A5:4 |'


def toll(bar, first, second, vel=100):
    """The two-stroke bell call: a strike on the bar and a lower one half a bar later."""
    return [Note(bar * 4, 4, midi(first), vel, '', {}), Note(bar * 4 + 2, 4, midi(second), vel - 10, '', {})]


def timp(chords, vel):
    """Timpani on the chords whose bass is one of the two drums (B-flat and F)."""
    return [Note(c.beat, 1, midi('Bb1' if c.bass == 10 else 'F2'), vel, '', {}) for c in chords if c.bass in (10, 5)]


def build():
    P = {}
    P['horn'] = lead(THEME_A, 4, 92, gate=1.0)
    P['clarinet'] = [n for n in double(lead(THEME_A, 4, 70, gate=1.0), 12) if n.beat >= 8 * 4]
    P['violins'] = lead(THEME_B, 12, 90, gate=1.0) + lead(GATHER, 32, 92, gate=1.0)
    P['flute'] = ([n for n in double(lead(THEME_B, 12, 74, gate=1.0), 12) if n.beat < 16 * 4]
                  + [n for n in lead(THEME_B, 12, 76, gate=1.0) if n.beat >= 16 * 4] + lead(GATHER, 32, 72, gate=1.0))
    P['glock'] = ([n for n in double(lead(THEME_B, 12, 54), 12) if n.beat >= 16 * 4 and n.length >= 1]
                  + [n for n in double(lead(HYMN, 20, 50), 12) if n.length >= 1])
    P['trumpet'] = lead(HYMN, 20, 96, gate=1.0)
    P['bells'] = (toll(0, 'Bb4', 'F4') + toll(2, 'Bb4', 'Gb4', 92) + toll(4, 'Bb4', 'F4') + toll(8, 'Bb4', 'Gb4', 94)
                  + toll(20, 'D5', 'Bb4', 104) + toll(24, 'D5', 'Bb4', 98) + lead(ANSWER, 28, 104) + toll(32, 'Bb4', 'Gb4', 90))

    P['horn#2'] = (swell(sustained(pick(CHORDS, 3, 4), 'C4', 'C5', 3, vel=56), 3, 4, 0, 24)
                   + sustained(B_CH, 'D4', 'D5', 3, vel=56)
                   + double(lead(HYMN, 20, 86, gate=1.0), -12)
                   + swell(sustained(pick(CHORDS, 32, 36), 'Db4', 'Db5', 3, vel=60), 32, 36, 0, 26))
    P['trumpet#2'] = (swell(sustained(pick(CHORDS, 19, 20), 'F4', 'Eb5', 2, vel=64), 19, 20, 0, 30)
                      + swell(sustained(pick(CHORDS, 35, 36), 'F4', 'Eb5', 2, vel=64), 35, 36, 0, 30))
    P['trombone'] = roots(A_CH, 'E2', 'D#3', vel=64) + sustained(C_CH, 'F2', 'F3', 2, vel=82) + roots(pick(CHORDS, 32, 36), 'E2', 'D#3', vel=70)

    P['organ'] = (sustained(INTRO, 'F3', 'F4', 3, vel=60) + sustained(A_CH, 'F3', 'Ab4', 4, vel=64) + sustained(B_CH, 'F3', 'F4', 3, vel=58)
                  + sustained(C_CH, 'Bb3', 'Bb5', 5, vel=100) + sustained(pick(D_CH, 28, 34), 'F3', 'Ab4', 4, vel=62)
                  + sustained(pick(D_CH, 34, 36), 'Bb3', 'Bb5', 5, vel=96))
    P['organ#2'] = (roots(INTRO + A_CH + B_CH, 'A#1', 'A2', vel=60) + roots(C_CH, 'A#1', 'A2', vel=96)
                    + roots(pick(D_CH, 28, 34), 'A#1', 'A2', vel=60) + roots(pick(D_CH, 34, 36), 'A#1', 'A2', vel=92))

    P['violins#2'] = trem(sustained(C_CH, 'Bb5', 'Bb6', 3, vel=68)) + sustained(pick(D_CH, 28, 32), 'F5', 'F6', 2, vel=50)
    P['violas'] = sustained(B_CH, 'D4', 'D5', 2, vel=56) + trem(sustained(C_CH, 'D4', 'D5', 2, vel=66)) + sustained(D_CH, 'Db4', 'Db5', 2, vel=56)
    P['celli'] = (roots(INTRO, 'C2', 'B2', vel=58) + pizz(figure_bass(A_CH, 'C2', 'B2', 'R-5-', 1.0, vel=78))
                  + roots(B_CH + C_CH, 'C2', 'B2', vel=72) + roots(pick(D_CH, 28, 32), 'C2', 'B2', vel=60)
                  + pizz(figure_bass(pick(D_CH, 32, 36), 'C2', 'B2', 'R-5-', 1.0, vel=80)))
    P['contrabass'] = (roots(INTRO, 'E1', 'D#2', vel=60) + pizz(figure_bass(A_CH, 'E1', 'D#2', 'R-5-', 1.0, vel=86))
                       + roots(B_CH + C_CH, 'E1', 'D#2', vel=74) + roots(pick(D_CH, 28, 32), 'E1', 'D#2', vel=64)
                       + pizz(figure_bass(pick(D_CH, 32, 36), 'E1', 'D#2', 'R-5-', 1.0, vel=88)))
    P['harp'] = (arpeggio(B_CH, 'Bb2', 'D5', [0, 2, 4, 5, 4, 2], step=1 / 3, vel=56, accent=8)
                 + arpeggio(pick(D_CH, 28, 32), 'Bb3', 'Bb5', [0, 1, 2, 3, 2, 1], step=1 / 3, vel=48, accent=6))

    P['timpani'] = ([Note(0, 1, midi('Bb1'), 90, '', {})] + timp_roll(3, 'F2', 'Bb1') + timp(A_CH[1:], 92)
                    + timp_roll(19, 'F2', 'Bb1') + timp(C_CH[1:], 104) + timp(D_CH[:1], 96) + timp_roll(35, 'F2', 'Bb1')[:-1])

    # 12 steps per bar: one per eighth note.
    procession = {'BD': 'x.....o.....', 'SN': '...o.....o.o'}
    P['battery'] = (drums({'BD': 'o...........'}, bar=0, bars=4, kit=BATTERY) + [cymbal_swell(4 * 4, BPM, 96)]
                    + drums({'GO': 'x...........'}, bar=4, kit=BATTERY) + drums(procession, bar=4, bars=8, kit=BATTERY)
                    + drums({'TR': 'x...........'}, bar=12, bars=8, kit=BATTERY)
                    + drums({'SC': 'o...........'}, bar=16, kit=BATTERY) + [cymbal_swell(20 * 4, BPM, 104)]
                    + drums({'BD': 'X.....o.....', 'CR': 'X...........', 'GO': 'x...........', 'SD': '.........o.o'}, bar=20, kit=BATTERY)
                    + drums({'BD': 'x.....o.....', 'SD': '.........o.o'}, bar=21, bars=7, kit=BATTERY)
                    + drums({'CR': 'x...........'}, bar=24, kit=BATTERY)
                    + drums({'SC': 'x...........', 'BD': 'x...........'}, bar=28, kit=BATTERY)
                    + drums(procession, bar=32, bars=4, kit=BATTERY)
                    + [battery_hit('ROLL', 35 * 4, 96, seconds=4 * 60.0 / BPM), cymbal_swell(36 * 4, BPM, 108)])
    return P, {}
