#!/usr/bin/env python3
"""Build apprelab-pitch.html: template head + our 6-beat scene + engine tail.
Sets AUDIO_SRC and TIMINGS from audio/timings.json so the page plays the real narration."""
import json, re, sys

T = json.load(open('audio/timings.json'))
assert len(T) == 6, len(T)

timings_js = 'const TIMINGS=[' + ','.join(
    "{start:%.2f,end:%.2f,text:%s}" % (b['start'], b['end'], json.dumps(b['text'])) for b in T) + '];'

SCENE = '''
/* ============ 10. SCENES (Apprelab first-principles pitch) ============ */
async function main(){try{await document.fonts.load('700 60px Caveat')}catch(e){}await loadAssets();buildHand();tool('marker');window.__probe=[];

/* --- 1. hook: learning a skill? --- */
beat(%s);
Wr('Learning a skill?',960,420,100,C.k,{speed:.045});
icon('film',520,700,2.0,{c:C.r});
figure(1650,880,320,{pose:'think',expr:'flat',dur:.8});
window.__probe.push([1,at]);

/* --- 2. the video ends, nothing gets built --- */
beat(%s,{keep:true});
S('M520 680 L740 900',.4,C.r,8);
S('M1000 460 L1480 460 L1480 700 L1000 700 Z',.7,C.k,6);
Wr('nothing gets built',1240,830,74,C.r,{speed:.045,maxW:520});
window.__probe.push([2,at]);

/* --- 3. first principle: skill comes from doing --- */
beat(%s,{wipe:true});
Wr('skill comes from doing',960,520,92,C.k,{speed:.04,maxW:1480});
window.__probe.push([3,at]);

/* --- 4. what the product does about it --- */
beat(%s,{keep:true});go(cur.start-.6);
icon('clock',400,560,1.9);
Wr('3-7 min',830,660,64,C.k,{speed:.04,maxW:340});
icon('pencil',1080,560,1.9);
Wr('real task',1470,660,64,C.a,{speed:.04,maxW:300});
window.__probe.push([4,at]);

/* --- 5. proof: AI feedback and verified badge --- */
beat(%s,{wipe:true});
icon('chat',400,540,2.0);
icon('badge',1080,520,2.2,{c:C.a});
Wr('verified badge',1480,850,64,C.a,{speed:.04,maxW:520});
window.__probe.push([5,at]);

/* --- 6. the name and the ask --- */
beat(%s,{wipe:true});
pic('apprelab',420,520,300,{frame:'sticker',rotA:-3,dur:.9});
Wr('apprelab.com',1220,450,100,C.a,{speed:.045});
Wr('be our mentor?',1220,650,80,C.k,{speed:.045,maxW:820});
window.__probe.push([6,at]);

'''
scene = SCENE % tuple(json.dumps(b['text']) for b in T)

import os, subprocess
URI='brand/apprelab.uri'
if not os.path.exists(URI):
    subprocess.run(['python3','prep_asset.py','brand/apprelab-512.png','--out',URI],check=True)
uri=open(URI).read().strip()

src = open('template.html').read()
i = src.index('/* ============ 10. SCENES')
j = src.index('endBeats();track=buildTrack();')
head, tail = src[:i], src[j:]
# let ?t=SECONDS open the page on a chosen frame (the render uses __seek directly)
assert 'render(t);requestAnimationFrame(tick)}' in tail
tail = tail.replace('render(t);requestAnimationFrame(tick)}',
                    "if(Q.get('t')!==null)t=Math.max(0,Math.min(+Q.get('t'),DURATION));render(t);requestAnimationFrame(tick)}")
head = head.replace('const AUDIO_SRC=null;', "const AUDIO_SRC='audio/narration.mp3';")
head = head.replace('const TIMINGS=null;', timings_js)
head = head.replace('const ASSET_SRC={};', "const ASSET_SRC={apprelab:'" + uri + "'};")
assert "const AUDIO_SRC='audio/narration.mp3';" in head and 'const TIMINGS=[' in head and 'apprelab:' in head
open('apprelab-pitch.html', 'w').write(head + scene.lstrip('\n') + tail)
subprocess.run(['python3','embed_font.py','apprelab-pitch.html'],check=True)
print('ok: page', os.path.getsize('apprelab-pitch.html'),'bytes, audio',T[-1]['end'])
