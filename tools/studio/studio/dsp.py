"""Signal-processing kernels. Buffers are float32/float64 arrays shaped (n,) or (n, 2)."""
import math

import numpy as np
from numba import njit
from scipy import ndimage, signal

from .core import SR, db


# ---------------------------------------------------------------- oscillators
@njit(cache=True, fastmath=True)
def _blep(t, dt):
    if t < dt:
        t = t / dt
        return t + t - t * t - 1.0
    if t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0


@njit(cache=True, fastmath=True)
def osc_saw(freq, sr, phase):
    n = freq.shape[0]
    out = np.empty(n)
    p = phase
    for i in range(n):
        dt = freq[i] / sr
        out[i] = 2.0 * p - 1.0 - _blep(p, dt)
        p += dt
        if p >= 1.0:
            p -= 1.0
    return out


@njit(cache=True, fastmath=True)
def osc_pulse(freq, width, sr, phase):
    n = freq.shape[0]
    out = np.empty(n)
    p = phase
    for i in range(n):
        dt = freq[i] / sr
        v = 1.0 if p < width else -1.0
        v += _blep(p, dt)
        q = p - width
        if q < 0.0:
            q += 1.0
        v -= _blep(q, dt)
        out[i] = v
        p += dt
        if p >= 1.0:
            p -= 1.0
    return out


@njit(cache=True, fastmath=True)
def osc_sine(freq, sr, phase):
    n = freq.shape[0]
    out = np.empty(n)
    p = phase
    for i in range(n):
        out[i] = math.sin(2.0 * math.pi * p)
        p += freq[i] / sr
        if p >= 1.0:
            p -= 1.0
    return out


# ------------------------------------------------------------------- filters
@njit(cache=True, fastmath=True)
def svf(x, cutoff, res, mode, sr):
    """Zavalishin TPT state-variable filter; mode 0 LP, 1 BP, 2 HP."""
    n = x.shape[0]
    out = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    k = 2.0 - 2.0 * res
    for i in range(n):
        fc = cutoff[i]
        if fc > 0.45 * sr:
            fc = 0.45 * sr
        if fc < 12.0:
            fc = 12.0
        g = math.tan(math.pi * fc / sr)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            out[i] = v2
        elif mode == 1:
            out[i] = v1
        else:
            out[i] = x[i] - k * v1 - v2
    return out


def _biquad(kind, f0, q=0.707, gain_db=0.0):
    a = 10 ** (gain_db / 40)
    w = 2 * math.pi * f0 / SR
    cw, sw = math.cos(w), math.sin(w)
    alpha = sw / (2 * q)
    if kind == 'peak':
        b = [1 + alpha * a, -2 * cw, 1 - alpha * a]
        aa = [1 + alpha / a, -2 * cw, 1 - alpha / a]
    elif kind == 'lowshelf':
        s = 2 * math.sqrt(a) * alpha
        b = [a * ((a + 1) - (a - 1) * cw + s), 2 * a * ((a - 1) - (a + 1) * cw), a * ((a + 1) - (a - 1) * cw - s)]
        aa = [(a + 1) + (a - 1) * cw + s, -2 * ((a - 1) + (a + 1) * cw), (a + 1) + (a - 1) * cw - s]
    elif kind == 'highshelf':
        s = 2 * math.sqrt(a) * alpha
        b = [a * ((a + 1) + (a - 1) * cw + s), -2 * a * ((a - 1) + (a + 1) * cw), a * ((a + 1) + (a - 1) * cw - s)]
        aa = [(a + 1) - (a - 1) * cw + s, 2 * ((a - 1) - (a + 1) * cw), (a + 1) - (a - 1) * cw - s]
    elif kind == 'lowpass':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        aa = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == 'highpass':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        aa = [1 + alpha, -2 * cw, 1 - alpha]
    else:
        raise ValueError(kind)
    return np.array([[b[0] / aa[0], b[1] / aa[0], b[2] / aa[0], 1.0, aa[1] / aa[0], aa[2] / aa[0]]])


def eq(x, *bands):
    """bands: ('peak', f, q, gain) / ('lowshelf', f, q, gain) / ('highpass', f, q) ..."""
    sos = []
    for band in bands:
        kind, f = band[0], band[1]
        q = band[2] if len(band) > 2 else 0.707
        g = band[3] if len(band) > 3 else 0.0
        sos.append(_biquad(kind, f, q, g))
    if not sos:
        return x
    return signal.sosfilt(np.vstack(sos), x, axis=0).astype(np.float32)


def highpass(x, f, order=2):
    sos = signal.butter(order, f, btype='highpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def lowpass(x, f, order=2):
    sos = signal.butter(order, f, btype='lowpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


# ----------------------------------------------------------------- dynamics
@njit(cache=True, fastmath=True)
def _compress(x, thresh, ratio, att, rel, knee, rms_tc, sr):
    n = x.shape[0]
    out = np.empty_like(x)
    a_att = math.exp(-1.0 / (att * sr))
    a_rel = math.exp(-1.0 / (rel * sr))
    a_rms = math.exp(-1.0 / (rms_tc * sr)) if rms_tc > 0 else 0.0
    ms = 0.0
    gr = 0.0
    slope = 1.0 / ratio - 1.0
    for i in range(n):
        lvl = max(abs(x[i, 0]), abs(x[i, 1]))
        if rms_tc > 0:
            ms = a_rms * ms + (1.0 - a_rms) * lvl * lvl
            lvl = math.sqrt(ms) * 1.414
        ldb = 20.0 * math.log10(lvl + 1e-9)
        over = ldb - thresh
        if 2.0 * over < -knee:
            target = 0.0
        elif knee > 0 and 2.0 * abs(over) <= knee:
            target = slope * (over + knee / 2.0) ** 2 / (2.0 * knee)
        else:
            target = slope * over
        if target < gr:
            gr = a_att * gr + (1.0 - a_att) * target
        else:
            gr = a_rel * gr + (1.0 - a_rel) * target
        g = 10.0 ** (gr / 20.0)
        out[i, 0] = x[i, 0] * g
        out[i, 1] = x[i, 1] * g
    return out


def compress(x, thresh=-18.0, ratio=3.0, attack=0.01, release=0.12, knee=6.0, rms=0.0, makeup=0.0):
    y = _compress(np.ascontiguousarray(x, dtype=np.float64), thresh, ratio, attack, release, knee, rms, SR)
    return (y * db(makeup)).astype(np.float32)


@njit(cache=True, fastmath=True)
def _release_smooth(m, a_rel):
    g = np.empty_like(m)
    cur = 1.0
    for i in range(m.shape[0]):
        if m[i] < cur:
            cur = m[i]
        else:
            cur = cur + (1.0 - a_rel) * (m[i] - cur)
        g[i] = cur
    return g


def limit(x, ceiling=-1.0, lookahead=0.0015, release=0.06, oversample=4):
    """Brickwall limiter on oversampled (true) peaks; returns (y, min_gain_db)."""
    x = np.asarray(x, dtype=np.float64)
    up = signal.resample_poly(x, oversample, 1, axis=0)
    peak = np.abs(up[:len(x) * oversample]).reshape(len(x), oversample, 2).max(axis=(1, 2))
    need = np.minimum(1.0, db(ceiling) / np.maximum(peak, 1e-9))
    la = max(1, int(lookahead * SR))
    m = ndimage.minimum_filter1d(need, size=2 * la + 1, mode='nearest')
    g = _release_smooth(m, math.exp(-1.0 / (release * SR)))
    g = ndimage.uniform_filter1d(g, size=la, mode='nearest')
    g = np.minimum(g, m)
    y = x * g[:, None]
    lim = db(ceiling)
    return np.clip(y, -lim, lim).astype(np.float32), float(20 * np.log10(g.min()))


def saturate(x, drive=1.5, mix=1.0):
    y = np.tanh(x * drive) / math.tanh(drive)
    return (x * (1 - mix) + y * mix).astype(np.float32)


# ----------------------------------------------------------- modulation/time
@njit(cache=True, fastmath=True)
def _chorus(x, sr, base, depth, rate, mix, spread):
    n = x.shape[0]
    out = np.empty_like(x)
    for i in range(n):
        for c in range(2):
            ph = 2.0 * math.pi * rate * i / sr + (spread if c == 1 else 0.0)
            d = (base + depth * math.sin(ph)) * sr
            j = i - d
            if j < 0:
                v = 0.0
            else:
                j0 = int(j)
                fr = j - j0
                v = x[j0, c] * (1.0 - fr) + x[min(j0 + 1, n - 1), c] * fr
            out[i, c] = x[i, c] * (1.0 - mix) + v * mix
    return out


def chorus(x, base=0.014, depth=0.0025, rate=0.4, mix=0.35, spread=math.pi / 2):
    return _chorus(np.ascontiguousarray(x, dtype=np.float64), SR, base, depth, rate, mix, spread).astype(np.float32)


@njit(cache=True, fastmath=True)
def _pingpong(x, d, fb, damp):
    n = x.shape[0]
    out = np.zeros_like(x)
    bl = np.zeros(d)
    br = np.zeros(d)
    lpl = 0.0
    lpr = 0.0
    k = 0
    for i in range(n):
        yl = bl[k]
        yr = br[k]
        out[i, 0] = yl
        out[i, 1] = yr
        lpl = lpl + damp * (yl - lpl)
        lpr = lpr + damp * (yr - lpr)
        mono = 0.5 * (x[i, 0] + x[i, 1])
        bl[k] = mono + fb * lpr
        br[k] = fb * lpl
        k += 1
        if k >= d:
            k = 0
    return out


def pingpong(x, seconds, feedback=0.35, damp=0.35):
    return _pingpong(np.ascontiguousarray(x, dtype=np.float64), max(1, int(seconds * SR)), feedback, damp).astype(np.float32)


# --------------------------------------------------------------------- reverb
def make_ir(rt60=1.9, predelay=0.018, size=1.0, seed=7, bright=1.0, early=True):
    """Stereo hall-like impulse response with frequency-dependent decay."""
    rng = np.random.default_rng(seed)
    n = int((rt60 * 1.4 + predelay) * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    bands = [(30, 200, 1.18), (200, 800, 1.05), (800, 2500, 0.92), (2500, 6000, 0.72 * bright), (6000, 16000, 0.48 * bright)]
    for lo, hi, scale in bands:
        noise = rng.standard_normal((n, 2))
        sos = signal.butter(3, [lo, min(hi, 0.45 * SR)], btype='band', fs=SR, output='sos')
        band = signal.sosfilt(sos, noise, axis=0)
        band *= np.exp(-6.91 * t / (rt60 * scale))[:, None]
        ir += band
    build = np.clip(t / (0.045 * size), 0, 1) ** 1.2
    ir *= build[:, None]
    if early:
        for tap in range(14):
            when = predelay + rng.uniform(0.004, 0.075) * size
            gain = 0.55 * math.exp(-tap / 6) * rng.uniform(0.6, 1.0)
            idx = int(when * SR)
            ir[idx, tap % 2] += gain * 6
            ir[idx + int(rng.uniform(0.0003, 0.0012) * SR), 1 - tap % 2] += gain * 4
    shift = int(predelay * SR)
    ir = np.concatenate([np.zeros((shift, 2)), ir[:n - shift]])
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    return ir.astype(np.float32)


def convolve(x, ir):
    left = signal.oaconvolve(x[:, 0], ir[:, 0])[:len(x)]
    right = signal.oaconvolve(x[:, 1], ir[:, 1])[:len(x)]
    return np.stack([left, right], axis=1).astype(np.float32)


# ---------------------------------------------------------------- stereo/util
def pan_mono(mono, pan):
    th = (pan + 1) * math.pi / 4
    return np.stack([mono * math.cos(th), mono * math.sin(th)], axis=1).astype(np.float32)


def place(stereo, pan=0.0, width=1.0):
    """Width (mid/side) then constant-power balance for a stereo source."""
    mid = 0.5 * (stereo[:, 0] + stereo[:, 1])
    side = 0.5 * (stereo[:, 0] - stereo[:, 1]) * width
    left, right = mid + side, mid - side
    th = (pan + 1) * math.pi / 4
    return np.stack([left * math.cos(th) * 1.4142, right * math.sin(th) * 1.4142], axis=1).astype(np.float32)
