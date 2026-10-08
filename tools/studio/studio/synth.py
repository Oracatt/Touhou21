"""Subtractive synth voices. Each returns an (n, 2) float32 note buffer."""
import math

import numpy as np

from .core import SR, hz
from .dsp import osc_pulse, osc_saw, osc_sine, svf


def _t(n):
    return np.arange(n) / SR


def _amp_env(n, hold, attack, decay, sustain, release):
    t = _t(n)
    env = np.where(t < attack, t / max(attack, 1e-4), sustain + (1 - sustain) * np.exp(-(t - attack) / max(decay, 1e-4)))
    h = min(n, hold)
    if n > h:
        level = env[h - 1] if h > 0 else 0.0
        env[h:] = level * np.exp(-6.91 * (t[h:] - t[h]) / max(release, 1e-3))
    return env


def _vibrato(n, f, depth_cents=12.0, rate=5.6, delay=0.25, rng=None):
    t = _t(n)
    ramp = np.clip((t - delay) / 0.3, 0, 1)
    ph = rng.uniform(0, 2 * math.pi) if rng is not None else 0.0
    return f * 2 ** (depth_cents / 1200 * ramp * np.sin(2 * math.pi * rate * t + ph))


def bass(pitch, vel, dur, rng, bright=1.0):
    """Picked synth bass: saw + square, sub sine, plucky low-pass envelope."""
    f = hz(pitch)
    rel = 0.06
    hold = int(dur * SR)
    n = hold + int(rel * SR * 1.5)
    freq = np.full(n, f)
    v = vel / 127
    x = 0.55 * osc_saw(freq, SR, rng.uniform()) + 0.35 * osc_pulse(freq * 2 ** (-7 / 1200), 0.5, SR, rng.uniform())
    t = _t(n)
    cutoff = (300 + 2.2 * f + (1500 + 1600 * v) * bright * np.exp(-t / 0.11)) * (1 + 0.15 * np.exp(-t / 0.02))
    y = svf(x, cutoff, 0.22, 0, SR)
    y += 0.5 * osc_sine(freq, SR, 0.0)
    y = np.tanh(1.6 * y) / math.tanh(1.6)
    y *= _amp_env(n, hold, 0.003, 0.28, 0.72, rel) * (0.45 + 0.55 * v)
    return np.stack([y, y], axis=1).astype(np.float32)


def pad(pitch, vel, dur, rng, cutoff=2600.0, attack=0.32, release=0.9):
    """Seven-voice supersaw string pad, spread across the stereo field."""
    f = hz(pitch)
    hold = int(dur * SR)
    n = hold + int(release * SR * 1.3)
    detune = [-21, -13, -6, 0, 6, 13, 21]
    pans = [-0.85, -0.55, -0.25, 0.0, 0.25, 0.55, 0.85]
    out = np.zeros((n, 2))
    t = _t(n)
    drift = 1 + 0.0009 * np.sin(2 * math.pi * 0.23 * t)
    for d, p in zip(detune, pans):
        freq = f * 2 ** (d / 1200) * drift
        x = osc_saw(freq, SR, rng.uniform())
        th = (p + 1) * math.pi / 4
        out[:, 0] += x * math.cos(th)
        out[:, 1] += x * math.sin(th)
    cut = cutoff * (0.75 + 0.25 * np.clip(t / attack, 0, 1)) * (0.85 + 0.3 * vel / 127)
    for c in range(2):
        out[:, c] = svf(out[:, c], cut, 0.12, 0, SR)
    out *= (_amp_env(n, hold, attack, 1.0, 1.0, release) * (vel / 127) / 3.2)[:, None]
    return out.astype(np.float32)


def pluck(pitch, vel, dur, rng, decay=0.24, bright=1.0):
    """Short saw/pulse pluck for 16th-note arpeggios."""
    f = hz(pitch)
    rel = 0.09
    hold = int(dur * SR)
    n = hold + int(max(rel, decay) * SR * 2.0)
    t = _t(n)
    freq = np.full(n, f)
    a = osc_saw(freq * 2 ** (-5 / 1200), SR, rng.uniform())
    b = osc_pulse(freq * 2 ** (5 / 1200), 0.32, SR, rng.uniform())
    cut = 500 + 1.5 * f + 5200 * bright * (vel / 127) * np.exp(-t / 0.075)
    ya = svf(a, cut, 0.18, 0, SR)
    yb = svf(b, cut, 0.18, 0, SR)
    env = np.exp(-t / decay)
    if n > hold:
        env[hold:] *= np.exp(-6.91 * (t[hold:] - t[hold]) / rel)
    env *= np.clip(t / 0.002, 0, 1) * (vel / 127)
    out = np.stack([0.7 * ya + 0.3 * yb, 0.3 * ya + 0.7 * yb], axis=1) * env[:, None]
    return out.astype(np.float32)


def lead(pitch, vel, dur, rng, bright=1.0):
    """Synth brass layer: detuned saws with a brassy filter swell and late vibrato."""
    f = hz(pitch)
    rel = 0.11
    hold = int(dur * SR)
    n = hold + int(rel * SR * 1.6)
    t = _t(n)
    freq = _vibrato(n, f, 13, 5.7, 0.28, rng)
    x = osc_saw(freq * 2 ** (-6 / 1200), SR, rng.uniform()) + osc_saw(freq * 2 ** (6 / 1200), SR, rng.uniform())
    x += 0.5 * osc_pulse(freq, 0.42, SR, rng.uniform())
    v = vel / 127
    swell = 1 - np.exp(-t / 0.035)
    cut = (900 + 2.0 * f) + (2600 + 2400 * v) * bright * swell * (0.65 + 0.35 * np.exp(-t / 0.5))
    y = svf(x, cut, 0.16, 0, SR)
    y *= _amp_env(n, hold, 0.012, 0.4, 0.85, rel) * v / 2.4
    return np.stack([y, y], axis=1).astype(np.float32)
