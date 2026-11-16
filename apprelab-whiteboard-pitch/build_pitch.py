#!/usr/bin/env python3
"""Build a self-contained, scrubbable Apprelab mentor pitch from the Bein kit."""
from __future__ import annotations
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
KIT = Path('/home/deploy/Bein/kits/whiteboard/template.html')
AUDIO = ROOT / 'audio-20s' / 'narration.mp3'
TIMINGS = ROOT / 'audio-20s' / 'timings.json'
OUT = ROOT / 'apprelab-mentor-pitch.html'

source = KIT.read_text()
timings = json.loads(TIMINGS.read_text())
assert len(timings) == 5, f'expected 5 beats, got {len(timings)}'
assert abs(timings[-1]['end'] - 20.0) < 0.02, f"audio is {timings[-1]['end']}s, not 20s"
mp3 = 'data:audio/mpeg;base64,' + base64.b64encode(AUDIO.read_bytes()).decode('ascii')
source = re.sub(r'<title>.*?</title>', '<title>Apprelab — Mentor Pitch</title>', source, count=1)
source, n = re.subn(r'const AUDIO_SRC=null;', 'const AUDIO_SRC=' + json.dumps(mp3) + ';', source, count=1)
assert n == 1, 'template audio hook changed'
source, n = re.subn(r'const TIMINGS=null;', 'const TIMINGS=' + json.dumps(timings, ensure_ascii=False) + ';', source, count=1)
assert n == 1, 'template timing hook changed'
old_duration = 'cur.end=Math.max(cur.end||0,cur.start+cur.speech,at)+1;DURATION=cur.end;'
new_duration = 'cur.end=Math.max(cur.end||0,cur.start+cur.speech,at);DURATION=cur.end;'
source, n = source.replace(old_duration, new_duration), source.count(old_duration)
assert n == 1, 'template duration hook changed'
start = source.index('/* demo:')
end = source.index('endBeats();', start) + len('endBeats();')
scenes = r'''/* Apprelab mentor pitch — learner-first, proof-over-content arc */
 beat("Meet Ayo. Learning isn't the goal; doing the work is.",{wipe:true});
 at=cur.start-.45;
 const ayo=figure(W*.24,H*.8,330,{color:C.b,expr:'sad',dur:.82});
 icon('film',W*.63,385,2.25,{c:C.r});
 Wr("WATCH ≠ DO",W*.68,700,65,C.r,{maxW:760});

 beat("Your know-how can become one real task Ayo can practise.",{wipe:true});
 at=cur.start+.15;
 const mentor=figure(W*.24,H*.81,320,{color:C.a,expr:'smile',dur:.82});
 A(W*.37,535,W*.59,535,C.k,.1);
 Wr("ONE REAL TASK",W*.75,725,68,C.g,{maxW:620});

 beat("Apprelab wraps it in a three-to-seven-minute lesson.",{wipe:true});
 at=cur.start+.15;
 Wr("APPRELAB",W*.5,230,82,C.b,{maxW:700});
 icon('clock',W*.28,390,2.05,{c:C.a});
 Wr("3–7 MIN",W*.69,545,108,C.g,{maxW:650});

 beat("Ayo gets instant AI feedback—and a verified badge for his portfolio.",{wipe:true});
 at=cur.start+.15;
 const ayoWins=figure(W*.2,H*.81,305,{color:C.b,expr:'smile',dur:.55});ayoWins.pose('cheer',{expr:'open'});
 icon('chat',W*.4,390,1.9,{c:C.a});
 Wr("AI FEEDBACK",W*.48,690,68,C.a,{maxW:750});
 icon('note',W*.69,390,1.9,{c:C.g});
 Wr("VERIFIED",W*.77,690,66,C.g,{maxW:640});

 beat("Help Ayo turn learning into proof. Mentor with us at Apprelab.com.",{wipe:true});
 at=cur.start+.15;
 const mentorCta=figure(W*.24,H*.8,340,{color:C.a,expr:'smile',dur:.85});
 Wr("BE A MENTOR",W*.67,365,92,C.b,{maxW:900});
 const url=Wr("apprelab.com",W*.67,690,108,C.g,{maxW:900});Rg(url);
 mark('sparkle',W*.92,H*.82,.45,C.a);
 endBeats();'''
source = source[:start] + scenes + source[end:]
cta = '''<aside id="mentor-cta"><span>Bring your know-how to a learner.</span><a href="https://apprelab.com" target="_blank" rel="noopener">Mentor with Apprelab <b>↗</b><small>apprelab.com</small></a></aside>'''
source = source.replace('</body>', cta + '</body>', 1)
css = '''<style>#mentor-cta{box-sizing:border-box;max-width:1100px;margin:10px auto 26px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1.5px solid #d9e5e6;border-radius:14px;background:#fff;color:#243b49;font:600 17px/1.35 system-ui,sans-serif}#mentor-cta a{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;background:#126b70;color:#fff;text-decoration:none;font-weight:750}#mentor-cta small{font-size:13px;opacity:.82}@media(max-width:560px){#mentor-cta{margin:8px 12px 22px;align-items:flex-start;flex-direction:column;font-size:15px}#mentor-cta a{align-self:stretch;justify-content:center}}</style>'''
source = source.replace('</head>', css + '</head>', 1)
OUT.write_text(source)
print(f'ok: wrote {OUT.name}, 5 beats, {AUDIO.stat().st_size:,} embedded audio bytes')
