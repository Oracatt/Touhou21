"""Copy the rendered studio tracks into the game: assets/music/<id>.wav + assets/music/studio.json.

    python export_game.py            # all tracks found in build/music-studio
    python export_game.py boss02     # selected ones (existing manifest entries are kept)

The WAVs are written with a plain 44-byte header (PCM, 16 bit, stereo, 32 kHz) like every other game
track. studio.json lists the frame-exact loop points; tools/compose-music.mjs merges it into
src/music-data.ts and no longer re-synthesises these ids."""
import hashlib
import json
import pathlib
import sys
import wave

import soundfile as sf

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SRC = ROOT / 'build' / 'music-studio'
DST = ROOT / 'assets' / 'music'

DESCRIPTIONS = {
    'title': '停在路口的那盏灯还亮着。钢琴、长笛与弦乐在小调与暖色之间走了一圈，再慢慢绕回开头。',
    'stage01': '暖黄色的提灯照着夜路，长笛领着轻快的旋律走在前面，小号在副歌里把整条路都点亮。',
    'boss01': '提灯在小调里摇晃：小号先用三三二的短句把话说出口，钢琴与弦乐在副歌里接过去。',
    'stage02': '雨落在纸伞上，单簧管、马林巴和拨弦把雨点一颗颗数开；副歌里小提琴终于把伞撑高了一点。',
    'boss02': '雨线织成一张网，钢琴与小提琴在十六分音符里追逐，颤弓弦乐把天色压得很低。',
    'stage03': '黄昏的渡口，双簧管和马林巴一起摇着船。副歌里小号与小提琴把对岸的灯火拉近。',
    'boss03': '渡船的主人只认船钱。铜管在摇摆的节奏里报价，长号和圆号在副歌里把价码压到最后一文。',
    'stage04': '暗处有看不见的丝线。竖琴与拨弦走得很轻，双簧管在线上走钢丝，副歌里终于见到了光。',
    'boss04': '蛛丝一圈圈收紧。大提琴不停重复十六分音符，小提琴在上面织出主旋律，定音鼓与铜锣压在副歌之前。',
    'stage05': '书的最后一页还留着空白。长笛、短笛与木琴像翻页一样轻快，副歌里整个乐队一起翻过去。',
    'boss05': '校对者在影子里划掉一行又一行。小号用三三二的重音写下句子，中段乐队一次次停在半句，空白里只剩响棒数拍，长号与圆号在副歌里回应。',
    'stage06': '还没有被写下的清晨。长笛与双簧管在钢琴与竖琴上缓缓升起，小号只在副歌里放亮。',
    'boss06': '庄重的开场白，需要足够坦然的人来说。小号与圆号立起仪式的架子，中段管钟两声一组往上敲，大提琴与通鼓踏着行进的步子走进副歌。',
    'extra': '把写完的东西再写一遍。小号的短句咬着合成器的拨奏，副歌里小提琴与合成主音一起把句子改成新的。',
    'bossExtra': '一个不肯停下的结尾。八分音符一路往前冲，B 大调的属和弦把每一段都推回开头，没有落脚的地方。',
}
ORDER = list(DESCRIPTIONS)


def main():
    ids = sys.argv[1:] or ORDER
    manifest_path = DST / 'studio.json'
    old = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'tracks': []}
    tracks = {t['id']: t for t in old['tracks']}
    for track_id in ids:
        meta = json.loads((SRC / f'{track_id}.json').read_text(encoding='utf-8'))
        audio, rate = sf.read(str(SRC / f'{track_id}.wav'), dtype='int16', always_2d=True)
        assert rate == 32000 and audio.shape[1] == 2, (track_id, rate, audio.shape)
        frames = len(audio)
        assert frames == meta['frames'] and meta['loopEndFrame'] == frames
        path = DST / f'{track_id}.wav'
        with wave.open(str(path), 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(32000)
            w.writeframes(audio.tobytes())
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        tracks[track_id] = {
            'id': track_id, 'frames': frames, 'loopStartFrame': meta['loopStartFrame'], 'loopEndFrame': frames,
            'bpm': meta['bpm'], 'introBars': meta['intro_bars'], 'loopBars': meta['loop_bars'],
            'description': DESCRIPTIONS[track_id], 'sha256': digest,
        }
        print(f'{track_id}: {frames / 32000:.1f} s, loop {meta["loopStartFrame"]} -> {frames}, {digest[:12]}')
    ordered = [tracks[i] for i in ORDER if i in tracks]
    manifest = {
        'provenance': ('Original melodies, harmonies and arrangements written for this project and rendered offline from '
                       'sampled instruments by tools/studio. Every track is an intro followed by a loop body whose seam is frame exact.'),
        'samples': [
            {'name': 'VSCO 2 Community Edition', 'license': 'CC0 1.0', 'used': 'orchestral instruments, mallets, gong, triangle'},
            {'name': 'Salamander Grand Piano V3', 'author': 'Alexander Holm', 'license': 'CC BY 3.0', 'used': 'piano'},
            {'name': 'MuldjordKit', 'author': 'Lars Muldjord', 'license': 'CC BY 4.0', 'used': 'drum kit'},
        ],
        'sampleRate': 32000,
        'tracks': ordered,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
