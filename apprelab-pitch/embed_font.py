#!/usr/bin/env python3
"""embed_font.py page.html  -> inlines Caveat 700 (Latin) as a data: URI @font-face. Re-run safe.
Needs network once (Google Fonts). Without network: ask the user for a Caveat .woff2/.ttf, or export with the fallback font and say so."""
import sys, re, base64, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
p = open(sys.argv[1]).read()
if "font/woff2;base64" in p: sys.exit(print("font already embedded"))
css = get("https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap").decode()
blk = re.search(r"/\* latin \*/(.*?)\}", css, re.S).group(1)
url, rng = re.search(r"url\((.*?)\)", blk).group(1), re.search(r"unicode-range:(.*?);", blk).group(1)
b64 = base64.b64encode(get(url)).decode()
ff = f"@font-face{{font-family:'Caveat';font-style:normal;font-weight:700;font-display:block;src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{rng}}}\n"
open(sys.argv[1], "w").write(p.replace("<style>\n", "<style>\n" + ff, 1)); print("embedded Caveat,", len(b64) // 1024, "KB")
