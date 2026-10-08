"""Objective checks for a rendered mix and its score."""
import math

import numpy as np
import pyloudnorm
from scipy import signal

from .core import SR, note_name

BANDS = [(20, 60, 'sub'), (60, 150, 'bass'), (150, 400, 'low-mid'), (400, 1000, 'mid'), (1000, 2500, 'upper-mid'),
         (2500, 6000, 'presence'), (6000, 12000, 'brilliance'), (12000, 20000, 'air')]


def true_peak_db(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return 20 * math.log10(np.abs(up).max() + 1e-12)


def band_profile(x):
    mono = x.mean(axis=1)
    f, p = signal.welch(mono, SR, nperseg=8192)
    total = p.sum()
    return {name: 10 * math.log10(p[(f >= lo) & (f < hi)].sum() / total + 1e-12) for lo, hi, name in BANDS}


def report(mix, stems, returns, info, sections=None, clock=None):
    meter = pyloudnorm.Meter(SR)
    lines = []
    if sections and clock:
        parts = []
        for name, b0, b1 in sections:
            a, b = int(clock.seconds(b0 * 4) * SR), int(clock.seconds(b1 * 4) * SR)
            seg = mix[a:b].astype(np.float64)
            parts.append(f'{name} {meter.integrated_loudness(seg):.1f}')
        lines.append('section loudness (LUFS): ' + ', '.join(parts))
    lufs = meter.integrated_loudness(mix.astype(np.float64))
    lines.append(f'integrated {lufs:.1f} LUFS, true peak {true_peak_db(mix):.2f} dBTP, '
                 f'limiter max GR {info["limiter_max_gr_db"]:.1f} dB, pre-master {info["pre_lufs"]:.1f} LUFS')
    try:
        lra = meter.loudness_range(mix.astype(np.float64)) if hasattr(meter, 'loudness_range') else None
    except Exception:
        lra = None
    if lra is not None:
        lines.append(f'loudness range {lra:.1f} LU')
    l, r = mix[:, 0].astype(np.float64), mix[:, 1].astype(np.float64)
    corr = float(np.corrcoef(l, r)[0, 1])
    side = 20 * math.log10(np.sqrt(np.mean((l - r) ** 2)) / (np.sqrt(np.mean((l + r) ** 2)) + 1e-12) + 1e-12)
    lines.append(f'stereo correlation {corr:.2f}, side/mid {side:.1f} dB, clipped samples {(np.abs(mix) >= 0.999).sum()}')
    lines.append('spectrum (share of energy): ' + ', '.join(f'{k} {v:.1f}' for k, v in band_profile(mix).items()))
    lines.append('stem loudness (LUFS, pre-master) / peak:')
    for name, y in {**stems, **{f'[{k}]': v for k, v in returns.items()}}.items():
        active = np.abs(y).max(axis=1) > 1e-5
        if active.sum() < SR // 2:
            continue
        try:
            sl = meter.integrated_loudness(y[active].astype(np.float64))
        except Exception:
            sl = float('nan')
        lines.append(f'  {name:<14} {sl:6.1f} LUFS  peak {20 * math.log10(np.abs(y).max() + 1e-12):6.1f} dBFS')
    return '\n'.join(lines)


def clicks(x, threshold=25.0):
    """Sample-level discontinuities: |second difference| far above its own
    2 ms neighbourhood median (a mallet or stick transient spans several ms)."""
    from scipy import ndimage
    worst = None
    for c in range(x.shape[1]):
        d2 = np.abs(np.diff(x[:, c].astype(np.float64), 2))
        local = ndimage.median_filter(d2, size=int(0.002 * SR) | 1, mode='nearest') + 1e-6
        r = d2 / local
        worst = r if worst is None else np.maximum(worst, r)
    ratio, hp = worst, np.abs(np.diff(x.mean(axis=1).astype(np.float64), 2))
    hits = np.nonzero(ratio > threshold)[0]
    events, last = [], -SR
    for i in hits:
        if i - last > int(0.05 * SR):
            events.append((i / SR, float(ratio[i]), float(20 * np.log10(hp[i] + 1e-12))))
        last = i
    return events


def alignment(stem, notes, clock, gap=0.15):
    """Median/IQR of (-6 dB onset - grid time) in ms over isolated notes."""
    env = np.abs(stem).max(axis=1)
    env = np.maximum.accumulate(env[::-1])[::-1] * 0 + env  # keep shape; plain envelope
    starts = sorted({round(clock.seconds(n.beat), 5) for n in notes})
    errs = []
    for prev, t in zip([-1.0] + starts, starts):
        if t - prev < gap:
            continue
        a, b = int((t - 0.08) * SR), int((t + 0.2) * SR)
        if a < 0 or b > len(env):
            continue
        win = env[a:b]
        base = win[:int(0.03 * SR)].max()
        peak = win.max()
        if peak < 4 * base + 1e-6:
            continue
        idx = int(np.argmax(win > base + 0.5 * (peak - base)))
        errs.append((a + idx) / SR - t)
    if not errs:
        return None
    e = np.array(errs) * 1000
    return float(np.median(e)), float(np.percentile(e, 25)), float(np.percentile(e, 75)), len(e)


def clashes(lead, others, chords, beats_per_bar=4, melodic=()):
    """Semitone clashes against the lead: sustained lead notes (>= dotted 8th)
    on the 8th grid against any part, and any lead note against melodic parts."""
    out = []
    for n in lead:
        on_beat = abs(n.beat * 2 - round(n.beat * 2)) < 1e-6  # quarter or eighth grid
        for name, notes in others.items():
            if name not in melodic and (not on_beat or n.length < 0.75):
                continue
            for m in notes:
                if not isinstance(m.pitch, (int, float)):
                    continue
                if m.beat <= n.beat + 1e-6 < m.beat + m.length * m.extra.get('gate', 0.92):
                    iv = abs(int(round(n.pitch)) - int(round(m.pitch))) % 12
                    if iv in (1, 11) and abs(n.pitch - m.pitch) < 24:
                        bar, beat = divmod(n.beat, beats_per_bar)
                        out.append(f'bar {int(bar) + 1} beat {beat + 1:.2f}: lead {note_name(n.pitch)} vs {name} {note_name(m.pitch)}')
    return sorted(set(out))
