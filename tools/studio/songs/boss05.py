"""Stage 5 Boss: Mikage Fusae, the proofreader of the archive. F minor, 144 BPM.

A neo-baroque concerto grosso instead of a band: no piano, no drum kit and no synth bass. A solo violin
leads, the harp and xylophone stand in for a harpsichord, and an orchestral battery keeps time.
4-bar intro (a stamp, ticking claves, the soloist trying out the subject), then a 36-bar loop:
A (the subject in running sixteenths over a circle of fifths) /
B (a canon on an A-flat major ground: every desk copies the line the soloist played four bars earlier) /
C (the brass chants the subject in long notes while the soloist races over the same harmony) /
D (the strings in unison, a brass seal on every chord, a Neapolitan G-flat and a cadenza on C7).
The loop never cadences on F minor inside itself: its full stop is the stamp on its own first beat."""
from studio.core import Note, midi
from studio.layers import battery_hit, cymbal_swell, double, figure_bass, lead, legato, pick, pizz, swell, timp_roll, tpt_hits, trem
from studio.library import BATTERY
from studio.score import arpeggio, drums, progression, roots, stabs, sustained, voicing

TITLE = 'boss05'
BPM = 144
INTRO_BARS, LOOP_BARS = 4, 36
SEED = 517
HALL = 1.8
LEAD = 'solo_violin'
MELODIC = ('oboe', 'clarinet', 'flute')
LEADS = ('solo_violin', 'trumpet')
TARGETS = {'violins': -7.5, 'oboe': -8.5, 'clarinet': -10.0, 'horn': -9.0, 'trombone': -9.5, 'battery': -9.5, 'harp': -12.0,
           'xylo': -13.5, 'celli': -9.0, 'violas': -11.0, 'contrabass': -9.0, 'flute': -10.0, 'glock': -15.0, 'bassoon': -12.0,
           'trumpet#2': -12.0, 'horn#2': -12.5, 'trombone#2': -13.5, 'timpani': -12.0}
SCALE = {5, 7, 8, 10, 0, 1, 3, 4}   # F natural minor plus the leading tone E

INTRO = progression('Fm | Bbm | Db:2 Gdim:2 | C7', bar=0)
A1 = progression('Fm:2 Bbm:2 | Eb:2 Ab:2 | Db:2 Gdim:2 | C7', bar=4)
A2 = progression('Fm:2 Bbm:2 | Eb:2 Ab:2 | Db:2 Bbm:2 | Eb7', bar=8)
GROUND = 'Ab:2 Db:2 | Bbm:2 Eb:2 | Cm:2 Fm:2 | Db:2 Eb:2'
B_CH = progression(' | '.join([GROUND] * 3), bar=12)
C_CH = progression('Fm | Db | Bbm | C7 | Fm | Gb | C7 | C7', bar=24)
D_CH = progression('Fm:2 C7:2 | Fm:2 C7:2 | Bbm:2 Fm:2 | Gdim:2 C7:2 | Fm:2 Bbm:2 | Eb:2 Ab:2 | Db:2 Gb:2 | C7', bar=32)
CHORDS = INTRO + A1 + A2 + B_CH + C_CH + D_CH
SECTIONS = [('intro', 0, 4), ('A', 4, 12), ('B', 12, 24), ('C', 24, 32), ('D', 32, 40)]

I_SOLO = ('r:8 C5:2^ F5:2^ Ab5:2^ C6:2^ | Bb5:2^ F6:2^ Db6:1 C6 Bb5 F5 Bb5:2^ Db6:2^ F6:1 Eb6 Db6 C6 | '
          'Db6:2^ Ab5:2^ F5:1 G5 Ab5 F5 G5:2^ Bb5:2^ Db6:1 C6 Bb5 G5 | E5:1 G5 Bb5 C6 E6 G6 Bb6 C7 Bb6 G6 E6 C6 Bb5 G5 E5 G5 |')
SUBJECT = ('F5:2^ C6:2^ Ab5:1 G5 F5 C5 Db6:2^ Bb5:2^ F5:1 G5 Ab5 Bb5 | Eb6:2^ Bb5:2^ G5:1 F5 Eb5 G5 C6:2^ Ab5:2^ Eb5:1 F5 G5 Ab5 | '
           'F6:2^ Db6:2^ Ab5:1 Bb5 C6 Db6 Bb5 Db6 G5 Bb5 E5 G5 Bb5 Db6 | C6 Bb5 Ab5 G5 F5 E5 F5 G5 Ab5:2^ G5:2^ E5:2^ C5:2^ | '
           'F5:2^ C6:2^ F6:1 E6 F6 C6 Db6:2^ F6:2^ Bb6:1 Ab6 G6 F6 | G6:2^ Eb6:2^ Bb5:1 C6 Db6 Bb5 C6:2^ Eb6:2^ Ab6:1 G6 F6 Eb6 | '
           'F6:2^ Db6:2^ Ab5:1 Db6 F6 Ab6 Bb6:2^ F6:2^ Db6:1 Bb5 F5 Db5 | Eb5:1 G5 Bb5 Db6 Eb6 G6 Bb6 Db7 C7:2^ Bb6:2^ G6:2^ Eb6:2^ |')
# The canon: C1 is the soloist's first line, C2 the second, C3 the third; each desk takes over the previous line.
C1 = 'Eb6:8 F6:8 | Db6:8 Bb5:4 G5:4 | G5:8 Ab5:4 C6:4 | F6:4 Db6:4 Eb6:4 G5:4 |'
C2 = ('C5:2 Eb5:2 Ab5:2 G5:2 F5:2 Ab5:2 Db5:2 F5:2 | Db5:2 F5:2 Bb5:2 Ab5:2 G5:2 Bb5:2 Eb5:2 G5:2 | '
      'Eb5:2 G5:2 C6:2 Bb5:2 Ab5:2 C6:2 F5:2 Ab5:2 | F5:2 Ab5:2 Db6:2 Ab5:2 Bb5:2 G5:2 Eb5:2 Db5:2 |')
C3 = ('Ab5:1 C6 Eb6 Ab6 Eb6 C6 Eb6 C6 Db6 F6 Ab6 Db7 Ab6 F6 Ab6 F6 | Bb5 Db6 F6 Bb6 F6 Db6 F6 Db6 Bb5 Eb6 G6 Bb6 G6 Eb6 G6 Eb6 | '
      'C6 Eb6 G6 C7 G6 Eb6 G6 Eb6 C6 F6 Ab6 C7 Ab6 F6 Ab6 F6 | Db6 F6 Ab6 Db7 Ab6 F6 Ab6 F6 Eb6 G6 Bb6 G6 Eb6 Bb5 G5 Eb5 |')
CHORALE = 'F4:8 C5:8 | Ab4:8 F4:8 | Db5:8 Bb4:8 | C5:12 Bb4:4 | Ab4:8 C5:8 | Bb4:8 Gb4:4 Bb4:4 | C5:8 E4:8 | G4:16 |'
C_RUN = ('F6:1 C6 Ab5 C6 F6 C6 Ab5 C6 F6 G6 Ab6 G6 F6 E6 F6 C6 | F6 Db6 Ab5 Db6 F6 Db6 Ab5 Db6 F6 G6 Ab6 Bb6 Ab6 G6 F6 Db6 | '
         'F6 Db6 Bb5 Db6 F6 Db6 Bb5 Db6 F6 G6 Ab6 Bb6 Db7 Bb6 F6 Db6 | G6 E6 C6 E6 G6 E6 C6 E6 G6 Ab6 Bb6 C7 Bb6 G6 E6 C6 | '
         'Ab6 F6 C6 F6 Ab6 F6 C6 F6 Ab6 G6 F6 E6 F6 C6 Ab5 C6 | Bb6 Gb6 Db6 Gb6 Bb6 Gb6 Db6 Gb6 Bb6 Ab6 Gb6 Eb6 Gb6 Db6 Bb5 Db6 | '
         'C7 G6 E6 G6 C7 G6 E6 G6 Bb6 G6 E6 C6 Bb5 G5 E5 C5 | C5 E5 G5 Bb5 C6 E6 G6 Bb6 C7 Bb6 G6 E6 C6 Bb5 G5 E5 |')
UNISON = ('F5:1 G5 Ab5 F5 C6 Ab5 F5 C5 E5 G5 C6 Bb5 Ab5 G5 F5 E5 | F5 Ab5 C6 F6 E6 F6 C6 Ab5 G5 Bb5 E6 G6 F6 E6 D6 C6 | '
          'Bb5 Db6 F6 Bb6 Ab6 G6 F6 E6 F6 C6 Ab5 C6 F6 G6 Ab6 F6 | G6 Bb6 Db7 Bb6 G6 E6 Db6 Bb5 C6 E6 G6 Bb6 Ab6 G6 F6 E6 | '
          'F6 C6 Ab5 F5 C5 F5 Ab5 C6 Db6 Bb5 F5 Db5 Bb4 Db5 F5 Bb5 | Eb6 Bb5 G5 Eb5 Bb4 Eb5 G5 Bb5 C6 Ab5 Eb5 C5 Ab4 C5 Eb5 Ab5 | '
          'Db6:2^ Ab5:2^ F5:2^ Ab5:2^ Bb5:2^ Gb5:2^ Db5:2^ Bb4:2^ |')
CADENZA = 'C5:1 E5 G5 Bb5 C6 E6 G6 Bb6 C7 Bb6 G6 E6 Db6 Bb5 G5 E5 |'


def seal(P, c, length=0.5, vel=104):
    """A brass stamp on one chord: two trumpets, three horns and two trombones. The stamps live in their own
    parts because the staccato samples peak far above the sustained ones the chorale uses. The trombone plays
    its second velocity layer: in the upper layers the B-flat 2 samples are 10-17 dB hotter than their neighbours."""
    for part, low, high, count, v in (('trumpet#2', 'G4', 'G5', 2, vel), ('horn#2', 'C4', 'C5', 3, vel - 6),
                                      ('trombone#2', 'F2', 'F3', 2, 58)):
        P.setdefault(part, []).extend(Note(c.beat, length, p, v, '^', {'gate': 0.62}) for p in voicing(c, low, high, count))


def roll(bar, vel):
    """A snare roll through the whole bar."""
    return battery_hit('ROLL', bar * 4, vel, seconds=4 * 60.0 / BPM)


def build():
    P = {}
    P['solo_violin'] = (lead(I_SOLO, 0, 84) + lead(SUBJECT, 4, 92) + lead(C1, 12, 90, gate=1.0) + legato(lead(C2, 16, 84))
                        + lead(C3, 20, 90) + lead(C_RUN, 24, 92) + lead(UNISON, 32, 96) + lead(CADENZA, 39, 100))
    swell(P['solo_violin'], 3, 4, -6, 8)

    P['oboe'] = lead(C1, 16, 82, gate=1.0) + legato(lead(C2, 20, 78))
    P['clarinet'] = double(lead(C1, 16, 76, gate=1.0), -12) + double(legato(lead(C2, 20, 72)), -12)
    P['flute'] = double(lead(CHORALE, 24, 72), 12)[8:]
    P['glock'] = double(lead(C1, 20, 58, gate=1.0), 12)

    P['violins'] = lead(C1, 20, 84, gate=1.0) + double(lead(UNISON, 32, 100), -12)
    P['violins#2'] = (stabs(A1 + A2, 'F4', 'F5', 3, '..x...x...x...x.', vel=72, gate=0.5)
                      + swell(trem(sustained(pick(CHORDS, 2, 4), 'F4', 'F5', 3, vel=58)), 2, 4, -8, 16)
                      + trem(sustained(C_CH, 'F4', 'Ab5', 4, vel=70))
                      + swell(trem(sustained(pick(CHORDS, 39, 40), 'E4', 'C6', 4, vel=76)), 39, 40, -6, 12))
    P['violas'] = (arpeggio(A1 + A2, 'C4', 'C5', [0, 1, 2, 1], step=0.5, vel=56, accent=6)
                   + sustained(pick(CHORDS, 16, 24), 'C4', 'C5', 2, vel=54)
                   + trem(sustained(C_CH, 'C4', 'C5', 2, vel=64))
                   + double(lead(UNISON, 32, 92), -12)
                   + trem(sustained(pick(CHORDS, 39, 40), 'C4', 'C5', 2, vel=78)))
    P['celli'] = ([Note(0, 1, midi('F2'), 112, '^', {'gate': 0.6})]
                  + pizz(figure_bass(pick(CHORDS, 1, 4), 'E2', 'D#3', 'R5', 1.0, vel=72))
                  + figure_bass(A1 + A2, 'E2', 'D#3', 'RO5O', 0.5, vel=74)
                  + pizz(figure_bass(B_CH, 'E2', 'D#3', 'R5', 1.0, vel=76))
                  + trem(roots(C_CH, 'E2', 'D#3', vel=78))
                  + double(lead(UNISON, 32, 98), -24)
                  + trem(roots(pick(CHORDS, 39, 40), 'C3', 'B3', vel=82)))
    P['contrabass'] = ([Note(0, 1, midi('F1'), 112, '^', {'gate': 0.6})]
                       + pizz(figure_bass(pick(CHORDS, 1, 4), 'E1', 'D#2', 'R-', 1.0, vel=84))
                       + figure_bass(A1 + A2, 'E1', 'D#2', 'R', 1.0, vel=86, gate=0.7)
                       + pizz(figure_bass(B_CH, 'E1', 'D#2', 'R-', 1.0, vel=82))
                       + roots(C_CH, 'E1', 'D#2', vel=80)
                       + figure_bass(D_CH[:-1], 'E1', 'D#2', 'RRRR', 0.5, vel=90)
                       + roots(D_CH[-1:], 'E1', 'D#2', vel=86))
    P['bassoon'] = figure_bass(A2, 'E2', 'D#3', 'RO5O', 0.5, vel=70) + roots(pick(CHORDS, 16, 24), 'A#1', 'A2', vel=66)

    P['harp'] = (arpeggio(pick(CHORDS, 1, 3), 'F3', 'F5', [0, 1, 2, 3, 4, 3, 2, 1], step=0.5, vel=56)
                 + arpeggio(A1 + A2, 'F3', 'Ab4', [0, 1, 2, 3, 2, 1, 2, 1], step=0.25, vel=50, accent=8)
                 + arpeggio(B_CH, 'Ab3', 'Ab5', [0, 2, 1, 3, 2, 4, 3, 1], step=0.5, vel=56))
    P['xylo'] = ([Note(n.beat, n.length, n.pitch, 62, '', {'gate': 0.5}) for n in lead(SUBJECT, 4, 62) if abs(n.length - 0.5) < 1e-9]
                 + [Note(c.beat, 0.5, p, 66, '', {'gate': 0.5}) for c in D_CH[:-1] for p in voicing(c, 'F5', 'F6', 2)])

    seal(P, INTRO[0], length=1.0, vel=104)
    for c in (A1[0], A2[0]):
        seal(P, c, vel=104)
    for c in D_CH[:-3]:
        seal(P, c, vel=102 if c.beat % 4 == 0 else 90)
    for c in D_CH[-3:-1]:
        for k in range(2):
            seal(P, type(c)(c.symbol, c.root, c.intervals, c.bass, c.beat + k, 1.0), length=1.0, vel=104)
    last = D_CH[-1:]
    P['trumpet'] = lead(CHORALE, 24, 96, gate=1.0) + swell(sustained(last, 'G4', 'E5', 2, vel=70), 39, 40, 0, 30)
    P['horn'] = (swell(sustained(pick(CHORDS, 3, 4), 'E3', 'E4', 3, vel=58), 3, 4, 0, 30)
                 + sustained(pick(CHORDS, 9, 12), 'F3', 'F4', 3, vel=56)
                 + double(lead(C1, 20, 78, gate=1.0), -12)
                 + lead(CHORALE, 24, 88, gate=1.0)
                 + swell(sustained(last, 'C4', 'C5', 3, vel=70), 39, 40, 0, 30))
    P['trombone'] = double(lead(CHORALE, 24, 84, gate=1.0), -12) + swell(roots(last, 'C3', 'B3', vel=74), 39, 40, 0, 30)

    P['timpani'] = (tpt_hits(0, 'F2', 116)[:1] + timp_roll(3, 'C2', 'F2') + [Note(7 * 4, 1, midi('C2'), 100, '', {})]
                    + tpt_hits(8, 'F2', 104) + timp_roll(23, 'C2', 'F2') + [Note(27 * 4, 1, midi('C2'), 102, '', {})]
                    + tpt_hits(28, 'F2', 106) + timp_roll(31, 'C2', 'F2')
                    + [Note(c.beat, 0.5, midi('F2' if c.bass == 5 else 'C2'), 96 if c.beat % 4 == 0 else 86, '', {}) for c in D_CH[1:-1] if c.bass in (0, 5)]
                    + timp_roll(39, 'C2', 'F2')[:-1])

    tick = {'CL': '..o...o...o...o.'}
    P['battery'] = (drums({'BD': 'X...............', 'SC': 'x...............'}, bar=0, kit=BATTERY)
                    + drums(tick, bar=0, bars=4, kit=BATTERY) + drums({'TAP': 'o.o.o.o.o.o.o.o.'}, bar=2, bars=2, kit=BATTERY)
                    + [roll(3, 96), cymbal_swell(16, BPM)]
                    # A: claves on the off-beats, a stamp every four bars, a snare turn at the end of each phrase
                    + drums({'BD': 'X...............', 'CR': 'X...............'}, bar=4, kit=BATTERY)
                    + drums({'BD': 'x...............', 'SC': 'o...............'}, bar=8, kit=BATTERY)
                    + drums(tick, bar=4, bars=8, kit=BATTERY) + drums({'TR': 'x.......x.......'}, bar=6, kit=BATTERY)
                    + drums({'SD': '............xxxX'}, bar=7, kit=BATTERY) + drums({'SD': '........xxxXxxxX'}, bar=11, kit=BATTERY)
                    # B: triangle, then taps, then taps and tambourine as the canon fills up
                    + drums({'TR': 'x...............'}, bar=12, bars=4, kit=BATTERY)
                    + drums({'TAP': 'o.o.o.o.o.o.o.o.', 'TR': 'x...............'}, bar=16, bars=4, kit=BATTERY)
                    + drums({'TAP': 'o.o.o.o.o.o.o.o.', 'TB': '..x...x...x...x.', 'BD': 'o.......o.......'}, bar=20, bars=4, kit=BATTERY)
                    + drums({'SD': '........xxxXxXxX'}, bar=23, kit=BATTERY)
                    # C: the chorale gets the gong and a bass drum on every bar
                    + drums({'BD': 'X...............', 'CR': 'X...............', 'GO': 'x...............'}, bar=24, kit=BATTERY)
                    + drums({'BD': 'x.......o.......'}, bar=25, bars=7, kit=BATTERY) + drums({'SC': 'x...............'}, bar=28, kit=BATTERY)
                    + [roll(31, 100), cymbal_swell(32 * 4, BPM)]
                    # D: snare eighths, bass drum on every chord, crash on the phrase heads
                    + drums({'SD': 'x.o.o.o.x.o.o.o.', 'BD': 'x.......o.......', 'CL': '..o...o...o...o.'}, bar=32, bars=6, kit=BATTERY)
                    + drums({'CR': 'X...............'}, bar=32, kit=BATTERY) + drums({'CR': 'X...............'}, bar=36, kit=BATTERY)
                    + drums({'SD': 'X...X...X...X...', 'BD': 'X...X...X...X...'}, bar=38, kit=BATTERY)
                    + [roll(39, 104), cymbal_swell(40 * 4, BPM, 110)])
    return P, {'trumpet#2': {'gain_add': -7.0}, 'horn#2': {'gain_add': -12.0}, 'trombone#2': {'gain_add': -2.0}}
