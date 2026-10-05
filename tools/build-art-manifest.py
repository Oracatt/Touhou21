"""Read PNG geometry/alpha for asset loading; never rewrites image pixels."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = {}
for file in sorted((root / 'assets').glob('**/*.png')):
    with Image.open(file) as source:
        width, height = source.size
        if 'A' in source.getbands():
            alpha = source.getchannel('A')
            bbox = alpha.point(lambda value: 255 if value > 16 else 0).getbbox()
        else:
            bbox = (0, 0, width, height)
        if bbox is None:
            raise ValueError(f'Empty artwork: {file}')
        left, top, right, bottom = bbox
        assets[file.relative_to(root).as_posix()] = {
            'width': width, 'height': height,
            'bounds': {'x': left, 'y': top, 'width': right-left, 'height': bottom-top},
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
        }
target = root / 'assets/art-manifest.json'
target.write_text(json.dumps({'format': 'guiming-art-v1', 'alphaThreshold': 16, 'assets': assets}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(f'Indexed {len(assets)} original PNG assets without pixel modifications.')
