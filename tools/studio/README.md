# Studio: sampled-instrument BGM renderer

Offline renderer for the game's BGM. Melodies, harmonies and arrangements are original scores written in
`songs/*.py`; the sound comes from licensed instrument samples that are **not** part of the repository
(they are downloaded into the git-ignored `build/samples`).

## Setup

```powershell
python -m venv build/studio-venv
build/studio-venv/Scripts/pip install -r tools/studio/requirements.txt
```

Sample libraries (extract into `build/samples`):

| Library | License | Folder |
| --- | --- | --- |
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) (sparse checkout: `Brass`, `Woodwinds`, `Strings`, `Percussion`) | CC0 1.0 | `build/samples/VSCO-2-CE` |
| [Salamander Grand Piano V3](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html), Alexander Holm | CC BY 3.0 | `build/samples/Salamander` |
| [MuldjordKit](https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html), Lars Muldjord | CC BY 4.0 | `build/samples/Muldjord` |

The CC BY libraries require attribution; the credits page and `docs/MUSIC.md` carry it.

## Workflow

```powershell
build/studio-venv/Scripts/python tools/studio/probe.py            # pitch/level check of every instrument
build/studio-venv/Scripts/python tools/studio/build_track.py boss02 # render + verify one track -> build/music-studio
build/studio-venv/Scripts/python tools/studio/export_game.py        # copy WAVs + studio.json into assets/music
node tools/compose-music.mjs                                         # merge studio.json into src/music-data.js
```

`build_track.py` renders `intro + loop body` as a seamless loop: the loop body is rendered twice (plus a look-ahead into
a third pass) with per-note deterministic humanisation, the middle pass is cut out so ring-outs and attack pre-rolls
from the neighbouring passes are already inside it, and the last 24 ms of the body (and of the intro) are cross-faded
toward the audio that precedes the loop start on a straight play-through. `loop_start` and `frames` are integer sample
positions; the file ends exactly where the loop body ends.

A song module defines `BPM`, `INTRO_BARS`, `LOOP_BARS`, `CHORDS`, `SECTIONS`, `SCALE`, `LEAD`/`LEADS` and `build()`.
The builder checks that strong-beat lead notes are chord or scale tones, flags semitone clashes against other parts,
balances every part to a role level inside the mix, evens out section loudness with a periodic per-bar ride,
normalises to -13 LUFS with a -1 dBTP ceiling, and scans both seams for clicks.
