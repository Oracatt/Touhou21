"""Standard mixing rig: every instrument has a channel strip; a song only supplies notes."""
from functools import lru_cache

from . import dsp, library as lib, synth
from .mix import Song, Track
from .core import Clock


def _eq(*bands):
    return lambda x: dsp.eq(x, *bands)


def _comp(*args, **kw):
    return lambda x: dsp.compress(x, *args, **kw)


def strips(beat):
    """name -> keyword arguments of Track (without notes). `beat` is the quarter-note length in seconds."""
    return {
        'trumpet': dict(voice=lib.trumpet, gain=2.0, pan=0.04,
                        fx=[_eq(('highpass', 160), ('peak', 2600, 1.0, 1.5), ('highshelf', 9000, 0.7, -2)),
                            _comp(-20, 2.5, 0.006, 0.12, 6, rms=0.01, makeup=3)],
                        sends={'hall': -9, 'delay': -17}, timing=0.006),
        'piano': dict(voice=lib.piano, gain=-3.0, width=0.85,
                      fx=[_eq(('highpass', 45), ('peak', 300, 1.0, -2.5), ('peak', 3200, 1.0, 1.5))],
                      sends={'hall': -13}, timing=0.004),
        'violins': dict(voice=lib.violins, gain=6.0, pan=-0.28, width=0.8,
                        fx=[_eq(('highpass', 180), ('peak', 2500, 1.0, 1.0))], sends={'hall': -6}, timing=0.008),
        'solo_violin': dict(voice=lib.solo_violin, gain=4.0, pan=-0.12, width=0.45,
                            fx=[_eq(('highpass', 190), ('peak', 2800, 1.0, 1.5), ('highshelf', 9000, 0.7, -1.5))],
                            sends={'hall': -7, 'delay': -20}, timing=0.005),
        'violas': dict(voice=lib.violas, gain=2.0, pan=0.22, width=0.7,
                       fx=[_eq(('highpass', 150), ('peak', 400, 1.0, -2))], sends={'hall': -8}, timing=0.007),
        'celli': dict(voice=lib.celli, gain=-1.0, pan=0.35, width=0.7,
                      fx=[_eq(('highpass', 55), ('peak', 250, 1.0, -2))], sends={'hall': -10}, timing=0.007),
        'contrabass': dict(voice=lib.contrabass, gain=3.0, pan=0.0, width=0.5,
                           fx=[_eq(('highpass', 35), ('peak', 250, 1.0, -2))], sends={'hall': -14}, timing=0.007),
        'flute': dict(voice=lib.flute, gain=0.0, pan=-0.5, width=0.6, fx=[_eq(('highpass', 300))],
                      sends={'hall': -6}, timing=0.007),
        'oboe': dict(voice=lib.oboe, gain=1.0, pan=0.5, width=0.6, fx=[_eq(('highpass', 250))],
                     sends={'hall': -6}, timing=0.007),
        'clarinet': dict(voice=lib.clarinet, gain=0.0, pan=0.4, width=0.6, fx=[_eq(('highpass', 150))],
                         sends={'hall': -8}, timing=0.007),
        'bassoon': dict(voice=lib.bassoon, gain=-6.0, pan=-0.35, width=0.6, fx=[_eq(('highpass', 55))],
                        sends={'hall': -10}, timing=0.007),
        'piccolo': dict(voice=lib.piccolo, gain=4.0, pan=-0.2, width=0.6, fx=[_eq(('highpass', 600))],
                        sends={'hall': -6}, timing=0.006),
        'horn': dict(voice=lib.horn, gain=2.0, pan=-0.3, width=0.7, fx=[_eq(('highpass', 90))],
                     sends={'hall': -8}, timing=0.008),
        'trombone': dict(voice=lib.trombone, gain=20.0, pan=0.3, width=0.7,
                         fx=[_eq(('highpass', 70)), _comp(-22, 2.5, 0.008, 0.15, 6, makeup=2)],
                         sends={'hall': -9}, timing=0.008),
        'glock': dict(voice=lib.glock, gain=17.0, pan=0.3, width=0.7, sends={'hall': -4}, timing=0.003),
        'marimba': dict(voice=lib.marimba, gain=9.0, pan=-0.25, width=0.7, fx=[_eq(('highpass', 120))],
                        sends={'hall': -9}, timing=0.004),
        'xylo': dict(voice=lib.xylo, gain=-2.0, pan=0.25, width=0.7, fx=[_eq(('highpass', 300))],
                     sends={'hall': -10}, timing=0.003),
        'harp': dict(voice=lib.harp, gain=7.0, pan=-0.3, width=0.8, sends={'hall': -5}, timing=0.003),
        'timpani': dict(voice=lib.timpani, gain=9.0, sends={'hall': -8}, timing=0.002, vel_sd=2),
        'gong': dict(voice=lib.gong, gain=0.0, width=0.8, sends={'hall': -6}, timing=0.002, vel_sd=2),
        'triangle': dict(voice=lib.triangle, gain=12.0, pan=0.35, sends={'hall': -8}, timing=0.002, vel_sd=3),
        'organ': dict(voice=lib.organ, gain=10.0, width=1.0,
                      fx=[_eq(('highpass', 30), ('peak', 320, 0.9, -2.5), ('peak', 2500, 1.0, 1.0), ('highshelf', 5000, 0.7, 3.0))],
                      sends={'hall': -5}, timing=0.0, vel_sd=0),
        'bells': dict(voice=lib.bells, gain=4.0, pan=0.18, width=0.8, fx=[_eq(('highpass', 180))], sends={'hall': -4}, timing=0.002, vel_sd=2),
        'battery': dict(voice=lib.battery, gain=0.0, width=0.85,
                        fx=[_eq(('highpass', 30), ('peak', 420, 1.0, -2), ('peak', 4200, 0.8, 1.5)), _comp(-18, 2.5, 0.005, 0.12, 6, makeup=2)],
                        sends={'room': -11, 'hall': -12}, timing=0.002, vel_sd=4),
        'drums': dict(voice=lib.kit, gain=-1.0,
                      fx=[_eq(('highpass', 35), ('peak', 380, 1.0, -3), ('peak', 4500, 0.8, 2), ('highshelf', 10000, 0.7, 1.5)),
                          _comp(-16, 3.0, 0.004, 0.09, 6, makeup=2)],
                      sends={'room': -10, 'hall': -22}, timing=0.003, vel_sd=5),
        'bass': dict(voice=lambda: lib.synth_voice(synth.bass), gain=-4.0,
                     fx=[_eq(('highpass', 38), ('peak', 110, 1.0, 1.5), ('peak', 350, 1.2, -3), ('lowpass', 5000)),
                         _comp(-18, 4.0, 0.003, 0.08, 6, makeup=3)], timing=0.004),
        'pad': dict(voice=lambda: lib.synth_voice(synth.pad), gain=-15.0,
                    fx=[_eq(('highpass', 220), ('lowpass', 7000)), lambda x: dsp.chorus(x, mix=0.3)],
                    sends={'hall': -6}, timing=0.0, vel_sd=0),
        'pluck': dict(voice=lambda: lib.synth_voice(synth.pluck), gain=-17.0,
                      fx=[_eq(('highpass', 280)), lambda x: x + dsp.pingpong(x, beat * 0.75, 0.32) * 0.5],
                      sends={'hall': -12}, timing=0.0, vel_sd=3),
        'synlead': dict(voice=lambda: lib.synth_voice(synth.lead), gain=-16.0,
                        fx=[_eq(('highpass', 250), ('lowpass', 8000))], sends={'hall': -10}, timing=0.006),
    }


def build_song(parts, bpm, intro_bars, loop_bars, seed=21, hall_rt=2.1, tweak=None, lufs=-13.0, delay=0.75, ride=None):
    """parts: {name or 'name#2': notes}; tweak: {name: {gain:..., pan:...}} per-song channel changes."""
    beat = 60.0 / bpm
    spec = strips(beat)
    hall = dsp.make_ir(rt60=hall_rt, predelay=0.022, seed=11)
    room = dsp.make_ir(rt60=0.75, predelay=0.006, size=0.5, seed=5, bright=1.1)
    tracks = []
    for name, notes in parts.items():
        if not notes:
            continue
        cfg = dict(spec[name.split('#')[0]])
        over = dict((tweak or {}).get(name, {}))
        add = over.pop('gain_add', 0.0)
        cfg.update(over)
        cfg['gain'] = cfg.get('gain', 0.0) + add
        voice = cfg.pop('voice')
        tracks.append(Track(name, voice(), notes, **cfg))
    buses = {
        'hall': lambda x: dsp.eq(dsp.convolve(x, hall), ('highpass', 200), ('lowpass', 9000), ('peak', 500, 0.8, -2)),
        'room': lambda x: dsp.eq(dsp.convolve(x, room), ('highpass', 250), ('lowpass', 10000)),
        'delay': lambda x: dsp.eq(dsp.pingpong(x, beat * delay, 0.3, 0.3), ('highpass', 400), ('lowpass', 6000)),
    }
    master = [
        lambda x: dsp.eq(x, ('highpass', 28), ('peak', 250, 0.9, -1.0), ('peak', 800, 0.7, -1.5), ('peak', 5000, 0.8, 1.0),
                         ('highshelf', 11000, 0.7, 1.5)),
        lambda x: dsp.compress(x, -14, 2.0, 0.025, 0.25, 8, rms=0.03, makeup=0),
    ]
    return Song(Clock(bpm), (intro_bars + loop_bars) * 4.0, tracks, buses, master, tail=3.5, lufs=lufs,
                ceiling=-1.0, seed=seed, intro_beats=intro_bars * 4.0, ride=ride)
