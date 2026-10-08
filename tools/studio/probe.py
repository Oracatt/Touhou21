"""Render probe notes on every pitched instrument and verify the sounding pitch.

    python probe.py            # all instruments
    python probe.py horn flute # selected ones
"""
import pathlib
import sys
import time

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from studio import library as lib  # noqa: E402
from studio.core import SR, Note, Rng, midi, note_name  # noqa: E402
from studio.sampler import pitch_of  # noqa: E402

PROBES = {
    'piano': ['A1', 'D3', 'A4', 'D6'], 'trumpet': ['E4', 'A4', 'D5', 'A5'], 'horn': ['C3', 'G3', 'D4', 'A4'],
    'trombone': ['F2', 'C3', 'G3', 'D4'], 'flute': ['D5', 'A5', 'D6'], 'oboe': ['D5', 'A5'], 'clarinet': ['E3', 'A4', 'D5', 'A5'],
    'bassoon': ['C2', 'G2', 'D3', 'A3'], 'piccolo': ['D6', 'A6'], 'violins': ['A3', 'D5', 'A5'], 'violas': ['C3', 'D4', 'A4'],
    'celli': ['D2', 'D3', 'A3'], 'contrabass': ['D1', 'A1', 'E2'], 'glock': ['D6', 'A6'], 'marimba': ['C3', 'G3', 'D4', 'A4'],
    'xylo': ['C5', 'G5', 'D6'], 'harp': ['D3', 'A4', 'D5'], 'timpani': ['D2', 'A1'],
}
want = sys.argv[1:] or list(PROBES)
rng = Rng(5).stream('probe')
worst = 0.0
for name in want:
    voice = getattr(lib, name)()
    for nn in PROBES[name]:
        p = midi(nn)
        for dur in (1.0, 0.12):
            t = time.time()
            y = voice(Note(0, 1, p, 96, '.' if dur < 0.2 else ''), dur, rng, 96)
            y = y[0] if isinstance(y, tuple) else y
            got = pitch_of(y, SR, p, sustained=dur >= 0.5 and name not in ('glock', 'marimba', 'xylo', 'harp', 'timpani', 'piano'))
            dev = None if got is None else (got - p) * 100
            if dev is not None and name != 'timpani':
                worst = max(worst, abs(dev))
            peak = 20 * np.log10(np.abs(y).max() + 1e-9)
            flag = '  <-- CHECK' if dev is None or abs(dev) > 30 else ''
            print(f'{name:<11} {nn:<4} {"long " if dur > .5 else "short"} len {len(y) / SR:5.2f}s peak {peak:6.1f} dBFS  '
                  f'pitch {"?" if dev is None else f"{dev:+6.1f} cents"}  {time.time() - t:.2f}s{flag}')
    for art, inst in getattr(voice, 'arts', {}).items():
        print(f'    {art}: {note_name(inst.lowest)}..{note_name(inst.highest)}  ({len(inst.attack_regions)} regions)')
lib.TUNE.save()
print(f'worst tuning deviation: {worst:.1f} cents')
