#!/usr/bin/env python3
"""prep_asset.py IMAGE [--max 900] [--out asset.txt]  ->  prints a data: URI line ready for ASSET_SRC.
Transparent PNG/WebP (logos, stickers) stay PNG; photos become JPEG q82. Aim: each asset <300 KB, all assets <4 MB."""
import sys, io, base64
from PIL import Image
a = sys.argv[1:]; opt = lambda k, d=None: a[a.index('--' + k) + 1] if '--' + k in a else d
im = Image.open(a[0]); m = int(opt('max', 900)); im.thumbnail((m, m))
alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
b = io.BytesIO()
if alpha: im.convert('RGBA').save(b, 'PNG', optimize=True); mime = 'image/png'
else: im.convert('RGB').save(b, 'JPEG', quality=82, optimize=True); mime = 'image/jpeg'
uri = f"data:{mime};base64," + base64.b64encode(b.getvalue()).decode()
print(f"{len(b.getvalue())//1024} KB, {im.size[0]}x{im.size[1]}", file=sys.stderr)
open(opt('out', 'asset.txt'), 'w').write(uri); print(uri[:60] + '...')
