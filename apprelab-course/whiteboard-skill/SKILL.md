---
name: whiteboard-animation
description: Build whiteboard / doodle / hand-drawn explainer animations delivered as a narrated MP4 video by default (plus the self-contained, scrubbable HTML+SVG page it is rendered from; the HTML alone is the fallback when video export cannot run) with a believable hand and pen, handwritten text, stickman characters, a big sticker library, real images (logo, photos, screenshots) revealed stroke by stroke, loose "talking and sketching" layouts, camera moves, and narration-synced captions. Story and narration come first; voice from the user's Supabein TTS service (token + text) when a token is supplied, else Edge TTS or another engine, otherwise a timed subtitle script to paste into any external TTS. Audio is generated per beat BEFORE drawing, so the drawing is timed to the real voice, and the narrated MP4 can be exported. Use whenever the user asks for a whiteboard animation, doodle video, hand-drawn or sketch explainer, drawing-on effect, animated storyboard, marketing or pitch explainer, lesson or course module drawn on screen, kids' explainer, vertical 9:16 short, or an MP4 of any of these, even if they never say "whiteboard".
---

# Whiteboard Animation (v4: video first, Supabein TTS)

A viewer watches an idea being built while someone talks. Attention follows the pen; the voice carries the story; the drawing makes it stick. Everything below follows from that.

## 0. Why the rules are what they are

| Truth | So |
|---|---|
| People remember stories, not feature lists | **Write the narration first**, as a story with an ending in mind. Pictures serve the words. |
| The voice already says the sentence | The picture must add what words can't: relationships, scale, a face, an example. Never caption yourself. |
| A real person at a whiteboard doesn't use a grid | Layouts are **loose where the idea is a story, organized where the idea is a structure** (spine and scatter, section 3). |
| Viewers must still read it | Looseness never breaks legibility: no overlaps, margins kept, one focal thing at a time. QA enforces it. |
| The pen is the pointer | Pen tip sits exactly on the ink; the hand has weight, lean, lift and idle motion. |
| Real things build trust | Real logos, photos and screenshots are allowed, revealed like everything else. |
| Sync is cheapest when audio is the clock | **Generate per-beat audio first**, then draw inside each clip's real window. No audio engine? Give the user a timed script to paste elsewhere. |
| A token is a password | The Supabein token is used only at build time, from an environment variable. It never goes into a file, the HTML, a log, a QA report or the reply. |
| A video must be replayable and exportable | The whole piece is a pure function `render(t)`; no CSS keyframes, no timers. |
| People share videos, not web pages | **The default deliverable is an MP4** rendered frame by frame from the page, with the real narration muxed in. The HTML ships alongside it, and is the only deliverable when export cannot run (section 8.1). |
| A video bakes in whatever the renderer saw | The sandbox usually cannot reach Google Fonts, so **embed the handwriting font** as a data URI before QA and export (section 6.1); otherwise the MP4 shows a fallback serif. |

## 1. Workflow (in order)

1. **Brief.** Subject, audience (kids? buyers? learners?), length (30 s, 60 s, 90 s, 3 min), 16:9 or 9:16, brand colors/logo, assets the user has, call to action. Topic only? State assumptions in one line and proceed. **Voice inputs:** if the user supplies a Supabein `token`, use the Supabein voice (section 7). The narration script is the `text`. No token: use another engine or Mode A.
2. **End state.** One sentence: "After this the viewer will know / feel / do ____." Everything must serve it.
3. **Narration** (section 2). Write and read it aloud before any drawing. If the user supplies an approved script, use it as is.
4. **Beat sheet.** One table: beat, narration, what is drawn, mode (organized / loose), assets, camera. 3 to 7 drawn things per beat.
5. **Assets** (section 4): logo, photos, screenshots, brand colors, character name.
6. **Voice first** (section 7): write the beat strings to `beats.json`, generate one clip per beat (Supabein if a token exists), measure real durations, produce `narration.mp3` + `timings.json`. Do this BEFORE drawing.
7. **Build** from the template (section 6): set `TIMINGS` and `AUDIO_SRC`, then `beat(text)` and draw. The `beat()` strings must be identical to the strings in `beats.json`, in the same order and count. Never hand-type times.
8. **Embed the font** (section 6.1), then **QA**: `node qa.js page.html qa`, open `contact_sheet.png`, confirm the handwriting font rendered, fix every issue (including audio overruns), then the checklist (section 9).
9. **Export the video** (section 8.1): run the capability check, then `node export.js page.html out.mp4 --fps 24 --audio audio/narration.mp3`. Run it in the background for anything over 30 s; check one extracted frame before calling it done. No real audio: export a silent MP4 with burned-in captions (`--captions srt`) and say it is silent.
10. **Deliver.** The MP4 first (send it as a file), plus the `.html` in `/mnt/user-data/outputs/` (publish the HTML as an artifact if the Artifact tool exists, else `present_files`). **Fallback:** if the capability check fails or the export errors, deliver the HTML only and say in one line exactly what blocked the video (for example "no ffmpeg" or "Chromium cannot launch") and how the user can export it on their own machine with the same `export.js` command.

## 2. Narration first: story, not script

Write it for the ear. Aim: the viewer leans in, understands, remembers, acts. Never say "first principles" or "let's break it down"; just *build* the idea from the ground up.

**Arc** (scale beats to length: 30 s = about 70 words, 60 s = 140, 90 s = 200, 3 min = 430; pace 2.4 words/s):

| Part | Share | Job |
|---|---|---|
| Hook | 8–10% | A person in a moment, or a question the viewer already has. Curiosity gap, never "Today we'll talk about". |
| Tension | 15–20% | What is broken, with one concrete number or example the viewer can picture. |
| Turn | 15% | The single insight, in a sentence a child could repeat. |
| Build | 40–45% | 2–4 steps of how it works. One running character or example throughout. |
| Proof | 10% | A result, a before/after, or a small scene of it working. |
| Action | 8–10% | One concrete first step, with the name or address spoken. Callback to the hook. |

**Rules**
- Sentences of 14 words or fewer; vary short, short, longer. Contractions. "You" and "we".
- Concrete nouns and numbers; zero jargon; one idea per beat; 22–35 words per beat.
- Name a character (a person, a mascot, a stickman) and keep them through the piece.
- Use contrast (before/after), a direct question, a small surprise or light joke, one callback.
- Every sentence must move the viewer toward the end state; cut the rest.
- Kids: shorter sentences, sound words ("Boom!"), repetition, a question they can answer aloud, a funny or lovable character. Same craft, never childish.
- Spell for TTS: write "Apprelab.com", numbers as spoken ("forty hours"), no symbols or abbreviations.
- Board text is 1–4 words; the voice carries sentences.

**Tests before drawing:** read aloud at pace (does it breathe?); close your eyes (does it still make sense?); could each beat be a single drawn scene?

## 3. Visual language: spine and scatter

Structure where the idea is a structure; spontaneity where it is a story. Mix both inside the video, and inside a beat.

| Content shape | Mode | How |
|---|---|---|
| Sequence, process, loop | **Organized** | Row, column or snake; arrows; equal spacing; one icon + 1–3 word label per step |
| Comparison | **Organized** | Two zones split by a drawn line; same-size objects |
| Story, metaphor, example, emotion | **Loose** | Hero object large, placed by meaning; satellites via `put()`/`spot()`; doodle marks in gaps; tilt ±3° |
| Key point | **Contrast** | One object 2–3x bigger, ringed or highlighted, everything else quiet |

**Every beat:** one deliberate anchor (headline, hero object, or character) + up to 3 spontaneous marks (`mark()`, loops, underlines, tiny icons) + whitespace. Vary the headline position and tilt between beats; do not center everything. Big-board talking: `beat(text,{keep:true})` leaves the board, `cam()` pans to fresh space; `{wipe:true}` erases with an eraser at chapter breaks. Once per video, do something human (a scribble-out, a quick re-draw).

**Colors:** whiteboard default or brand colors from the user. Up to 4 accents, each with a fixed meaning (red problem, green solution, blue the thing/brand, amber emphasis). Never pure black or white.

**Kid appeal without childishness:** more assets (40 stickers, stickman, marks, speech bubbles), round friendly shapes, bigger text (64 px or more), sound words drawn large, slightly slower pen. Keep the palette and typography disciplined.

**Stickman:** `figure(x,y,height,{color,expr})` draws a rig that stays alive after it is drawn. Poses: stand, wave, point, think, cheer, shrug, walk. Expressions: smile, sad, open, flat. `f.pose('cheer',{expr:'open'})` keys a pose at the current cursor; `f.go(x,y,seconds)` walks it. Use 1 or 2 characters, named in the narration; match the face to the sentence. `bubble(text,cx,cy,{tail:[x,y]})` for speech.

**Layout guard rails (QA enforces):** text 60 px from edges; nothing in the caption zone (bottom 140 px of the current view); no text/text, text/picture or stroke/text collisions; 2 text blocks per vertical band; ring clearance 30 px.

## 4. Assets: real images, stickers, logos

- **Where from.** User uploads in `/mnt/user-data/uploads`. The sandbox usually has no network, and published pages cannot load remote images, so every image must be embedded as a `data:` URI. Web or image-search results can be looked at but not embedded; ask for the logo, product screenshots and photos instead of hotlinking or guessing. No logo yet: write the name as a handwritten wordmark with `Wr()`.
- **Prepare.** `python3 prep_asset.py logo.png --out logo.txt` shrinks to 900 px and prints a `data:` URI (PNG for transparency, JPEG q82 for photos). Paste into `ASSET_SRC={logo:'data:...'}`. Budget: under 300 KB each, under 4 MB total.
- **Draw.** `pic(name,cx,cy,width,{frame,style,rotA,dur})` reveals the image with a scribbled hatch, like the hand coloring it in.
  - `frame:'polaroid'` white print with shadow (photos, screenshots); `'tape'` taped on with hand-drawn border; `'none'`; `'sticker'` white cut-out outline for transparent PNGs and logos.
  - `style:'poster'` ink-wash look so photos match the doodles. Use it when the photo clashes with the line art.
- Real images are punctuation, not wallpaper: 1–2 per beat, with a handwritten label and an arrow or ring.
- **Built-in stickers** (`icon(name,x,y,scale)`, scale 2 = 200 px): book film speaker note phone coin bulb person check star clock heart house cloud sun gear mic camera chat search rocket trophy lock key flag pencil laptop badge megaphone calendar pin tree mountain smile bolt graph target coffee. Add more in the same 100x100 format. **Marks:** burst sparkle squig spiral.

## 5. The hand and the pen

- **Tip is the origin.** The hand group is `translate(tip)`; strokes and reveals are authored in world coordinates so `getPointAtLength` is the true pen position.
- **Text is written along its baseline** (small wiggle, left to right) while an invisible mask sweeps the glyphs, so the hand looks like it writes instead of scribbling up and down. Rotated text and pictures rotate the pen path with them.
- **Weight and life:** the hand leans with its motion (tip stays exact), lifts and scales 1.06 when traveling, has a contact shadow that grows when lifted, sways gently while the voice finishes, and parks bottom-right.
- **Tools:** `tool('marker'|'pen'|'pencil'|'chalk'|'eraser')`; each item remembers the tool it was created with. Marker for headlines, pen for detail, chalk on chalkboards, eraser is used automatically by `{wipe:true}`. `?hand=0` shows a pen dot only.
- **Size:** about 8–12% of board height (`KIT.handScale`, default .8).
- **Pacing:** quick, quick, slow. Hand travel 0.2–0.5 s with an arc; text about 55 ms per character; icons 0.35 s per stroke. No camera moves during strokes.

## 6. Reference implementation (copy, then replace the demo scene)

Everything is in one file: engine, toolkit, stickman, pictures, hand, camera, captions, narration (browser voice or recorded audio), controls, layout check. The demo scene at the bottom is a four-beat story; replace it.

`render(t)` is pure: build-time randomness is seeded (`KIT.seed`), time enters only through `render(t)`, nothing animates itself. Narration: voice never starts before Play, one sentence per utterance, a 3 s watchdog frees the pen if the voice is silent, a status line and Test voice button explain why. Reduced motion starts on the final frame.

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Whiteboard animation</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet">
<style>
:root{--board:#FBFAF6;--ink:#1E2A3A;--pg:#ECEAE4;--tx:#1E2A3A;--bt:#fff;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--pg:#14181F;--tx:#E8E6E0;--bt:#232A35}}
:root[data-theme="dark"]{--pg:#14181F;--tx:#E8E6E0;--bt:#232A35}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
body{margin:0;background:var(--pg);color:var(--tx);font:16px system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:12px}
#stage{width:100%;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px #0003}
svg{width:100%;height:100%;display:block}
#cap{min-height:3.2em;text-align:center;font-size:clamp(16px,2.4vw,24px);padding:10px 4px;line-height:1.35}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button,select{background:var(--bt);color:var(--tx);border:1px solid #8886;border-radius:8px;padding:8px 12px;font:inherit}
button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #2F6FDE;outline-offset:2px}
#scrub{flex:1;min-width:140px}#vstat{font-size:14px;opacity:.85;margin-top:8px;min-height:1.3em}details{margin-top:10px}
</style></head><body><div class="wrap">
<div id="stage"><svg id="svg" viewBox="0 0 1920 1080" role="img" aria-label="Whiteboard animation">
<defs id="defs"><filter id="soft"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="boil" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence id="bn" type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/></filter>
<filter id="lift"><feDropShadow dx="3" dy="6" stdDeviation="5" flood-opacity=".25"/></filter>
<filter id="poster"><feColorMatrix type="saturate" values=".35"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 .3 .65 1"/><feFuncG type="discrete" tableValues="0 .3 .65 1"/><feFuncB type="discrete" tableValues="0 .3 .65 1"/></feComponentTransfer></filter>
<filter id="sticker"><feMorphology in="SourceAlpha" operator="dilate" radius="7" result="d"/><feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/><feMerge result="m"><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge><feDropShadow in="m" dx="3" dy="5" stdDeviation="4" flood-opacity=".25"/></filter></defs>
<rect id="bg" x="-6000" y="-6000" width="14000" height="14000" fill="var(--board)"/><g id="art"></g><g id="world" filter="url(#boil)"></g><g id="hand"></g></svg></div>
<div id="cap" aria-live="off"></div>
<div class="bar"><button id="play">Play</button><button id="replay">Replay</button><input id="scrub" type="range" min="0" max="90" step="0.01" value="0" aria-label="Timeline"><select id="spd" aria-label="Speed"><option value=".5">0.5x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option></select><button id="ccb" aria-pressed="true">Captions on</button><button id="mute" aria-pressed="false">Voice on</button><button id="vtest">Test voice</button><select id="voice" aria-label="Voice" hidden></select></div>
<div id="vstat" role="status"></div><details><summary>Transcript</summary><div id="tr"></div></details></div>
<script>
/* ============ 0. CONFIG (edit) ============ */
const AUDIO_SRC=null;   // Mode B: 'narration.mp3' or data: URI. null = Mode A (browser voice)
const TIMINGS=null;     // Mode B: [{start,end},...] from timings.json, one per beat()
const ASSET_SRC={};     // name -> data: URI (logo, photos, stickers). Prepare with prep_asset.py
const KIT={theme:'whiteboard',tool:'marker',handScale:.8,seed:7};
/* ============ 1. BASICS ============ */
const Q=new URLSearchParams(location.search),VERT=Q.get('fmt')==='vertical',W=VERT?1080:1920,H=VERT?1920:1080,NS='http://www.w3.org/2000/svg',$=i=>document.getElementById(i);
const THEMES={whiteboard:{board:'#FBFAF6',ink:'#1E2A3A',acc:['#2F6FDE','#1F9D6B','#D64545','#E8A317']},chalk:{board:'#22302B',ink:'#F2EFE6',acc:['#7FB5FF','#6FD6A3','#FF8F8F','#FFD36B']},kraft:{board:'#E9D8B8',ink:'#3B2A1A',acc:['#2B5C9E','#2F7D4F','#B23A3A','#B97A12']},blueprint:{board:'#12356B',ink:'#EAF2FF',acc:['#8FD0FF','#9DF0C1','#FFB4B4','#FFE08A']}};
const THN=Q.get('theme')||KIT.theme,TH=THEMES[THN]||THEMES.whiteboard,svg=$('svg'),world=$('world'),art=$('art'),defs=$('defs'),handG=$('hand');
document.documentElement.style.setProperty('--board',TH.board);document.documentElement.style.setProperty('--ink',TH.ink);
$('stage').style.aspectRatio=W+'/'+H;svg.setAttribute('viewBox',`0 0 ${W} ${H}`);if(VERT)document.querySelector('.wrap').style.maxWidth='460px';
const FONT="'Caveat','Segoe Print','Bradley Hand',cursive",C={b:TH.acc[0],g:TH.acc[1],r:TH.acc[2],a:TH.acc[3],k:'var(--ink)'},cl=[C.b,C.g,C.r,C.a,C.k];
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),lerp=(a,b,t)=>a+(b-a)*t,rad=d=>d*Math.PI/180;
const E={inOut:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,pen:t=>t*.55+(t*t*(3-2*t))*.45};
let _s=KIT.seed*977+13;const rnd=()=>{_s=(_s*16807)%2147483647;return(_s-1)/2147483646},jit=a=>(rnd()-.5)*2*a,pick=a=>a[Math.floor(rnd()*a.length)];   // seeded: build-time only, so render(t) stays pure
const rot=(q,a,cx,cy)=>{const r=rad(a),c=Math.cos(r),s=Math.sin(r),dx=q.x-cx,dy=q.y-cy;return{x:cx+dx*c-dy*s,y:cy+dx*s+dy*c}};
const rotBox=(b,a,cx,cy)=>{if(!a)return b;const P=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(p=>rot({x:p[0],y:p[1]},a,cx,cy)),xs=P.map(p=>p.x),ys=P.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}};
/* ============ 2. ENGINE: items are data, render(t) is a pure function ============ */
const items=[],BOXED=[],CAM=[{t:0,x:0,y:0,w:W}];let TOOL=KIT.tool;const tool=n=>{TOOL=n};
const mk=it=>{it.tool=it.tool||TOOL;items.push(it);return it};
function stroke(d,{start,dur,w=5,color='var(--ink)',ease=E.pen}){const el=document.createElementNS(NS,'path');el.setAttribute('d',d);Object.assign(el.style,{fill:'none',stroke:color,strokeWidth:w,strokeLinecap:'round',strokeLinejoin:'round'});world.appendChild(el);const len=el.getTotalLength()||1;el.style.strokeDasharray=len;
 return mk({el,start,dur,ease,len,kind:'stroke',pos:p=>el.getPointAtLength(len*p),tick:t=>{const p=ease(clamp((t-start)/dur));el.style.strokeDashoffset=len*(1-p);el.style.visibility=p<=0?'hidden':'visible'}})}
function reveal(node,d,{start,dur,brush=46,ease=E.pen,xf=null,pen=null,host=world}){const id='m'+items.length,m=document.createElementNS(NS,'mask');m.id=id;m.setAttribute('maskUnits','userSpaceOnUse');
 const mp=document.createElementNS(NS,'path');mp.setAttribute('d',d);Object.assign(mp.style,{fill:'none',stroke:'#fff',strokeWidth:brush,strokeLinecap:'round',strokeLinejoin:'round'});m.appendChild(mp);defs.appendChild(m);node.setAttribute('mask',`url(#${id})`);host.appendChild(node);
 const len=mp.getTotalLength()||1;mp.style.strokeDasharray=len;
 {const bb=mp.getBBox(),pd=brush/2+12;let x=bb.x-pd,y=bb.y-pd,w=bb.width+2*pd,h=bb.height+2*pd;if(xf){const r=Math.hypot(w,h)/2,mx=x+w/2,my=y+h/2;x=mx-r;y=my-r;w=h=2*r}m.setAttribute('x',x);m.setAttribute('y',y);m.setAttribute('width',w);m.setAttribute('height',h)}   // mask only the item's own area: a page-sized mask per item made every frame 3x slower
 return mk({node,el:mp,start,dur,ease,len,kind:'reveal',pos:p=>{const q=pen?pen(p):mp.getPointAtLength(len*p);return xf?rot(q,xf.a,xf.cx,xf.cy):q},tick:t=>{const p=ease(clamp((t-start)/dur));mp.style.strokeDashoffset=len*(1-p);mp.style.visibility=p<=0?'hidden':'visible'}})}
function hatch({x,y,w,h},gap=30){let d=`M${x} ${y}`,dir=1,cy=y;while(cy<y+h){cy+=gap;d+=` L${dir>0?x+w:x} ${cy-gap/2} L${dir>0?x+w:x} ${cy}`;dir*=-1}return d}
function rough(pts,j=2.5,close=false){const P=close?[...pts,pts[0]]:pts;let d='';P.forEach((p,i)=>{if(!i){d+=`M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;return}const q=P[i-1],n=Math.max(1,Math.round(Math.hypot(p[0]-q[0],p[1]-q[1])/70));for(let k=1;k<=n;k++){const u=k/n,e=k<n?j:0;d+=` L${(q[0]+(p[0]-q[0])*u+jit(e)).toFixed(1)} ${(q[1]+(p[1]-q[1])*u+jit(e)).toFixed(1)}`}});return d}
/* ---- measure + write (handwritten text; the pen travels along the baseline, the mask sweeps invisibly) ---- */
function measure(str,size,weight=700){const t=document.createElementNS(NS,'text');t.style.font=`${weight} ${size}px ${FONT}`;t.setAttribute('x',0);t.setAttribute('y',0);t.textContent=str;world.appendChild(t);const b=t.getBBox();world.removeChild(t);return b}
function write(str,x,y,{size=64,start,color='var(--ink)',speed=.055,anchor='middle',weight=700,maxW=W-240,rotA=0}){
 const t=document.createElementNS(NS,'text'),fit=z=>{t.style.font=`${weight} ${z}px ${FONT}`};fit(size);t.style.fill=color;t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('text-anchor',anchor);t.textContent=str;world.appendChild(t);
 let b=t.getBBox();if(b.width>maxW){size=Math.floor(size*maxW/b.width);fit(size);b=t.getBBox()}world.removeChild(t);
 const pad=size*.18,top=b.y-pad,bot=b.y+b.height+pad,brush=size*.75,step=brush*.5,n=Math.ceil((b.width+2*pad)/step),x0=b.x-pad,cx=b.x+b.width/2,cy=b.y+b.height/2;
 let d=`M${x0} ${top}`;for(let i=0;i<=n;i++){const px=x0+i*step;d+=` L${px} ${i%2?top:bot} L${px+step} ${i%2?top:bot}`}
 if(rotA)t.setAttribute('transform',`rotate(${rotA} ${cx} ${cy})`);
 const pen=p=>({x:x0+p*(n+1)*step,y:y-size*.3+Math.sin(p*b.width/(size*.4))*size*.12});
 const it=reveal(t,d,{start,dur:Math.max(.6,str.length*speed),brush,xf:rotA?{a:rotA,cx,cy}:null,pen});it.box=rotBox({x:b.x,y:b.y,width:b.width,height:b.height},rotA,cx,cy);it.str=str;it.size=size;BOXED.push(it);return it}
/* ---- hand-drawn annotation primitives ---- */
const loop=(cx,cy,rx,ry,{start,dur=.9,color='#D64545',w=6,seed=3})=>{let d='';for(let i=0;i<=56;i++){const a=-2.6+i/56*Math.PI*2.25,k=1+.035*(i/56)+.012*Math.sin(seed+i*.9);d+=(i?' L':'M')+(cx+Math.cos(a)*rx*k).toFixed(1)+' '+(cy+Math.sin(a)*ry*k).toFixed(1)}return stroke(d,{start,dur,w,color})};
const underline=(b,{start,color='#E8A317'})=>{const y=b.y+b.height+6,x0=b.x-6,x1=b.x+b.width+6;return stroke(`M${x0} ${y} Q${(x0+x1)/2} ${y+10} ${x1} ${y-3}`,{start,dur:.5,w:8,color})};
function arrow(x1,y1,x2,y2,c,s,d,b){const mx=(x1+x2)/2-(y2-y1)*b,my=(y1+y2)/2+(x2-x1)*b;stroke(`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`,{start:s,dur:d,color:c});const a=Math.atan2(y2-my,x2-mx);[2.64,3.64].forEach((k,i)=>stroke(`M${x2} ${y2} L${x2+Math.cos(a+k)*32} ${y2+Math.sin(a+k)*32}`,{start:s+d+i*.15,dur:.15,color:c}))}
/* ============ 3. TOOLKIT: `at` is the drawing cursor; every helper draws at `at` and advances it ============ */
let at=0,USED=[];const go=t=>{at=t};
const claim=b=>{USED.push(b);return b},near=(a,b,m=30)=>a.x<b.x+b.width+m&&b.x<a.x+a.width+m&&a.y<b.y+b.height+m&&b.y<a.y+a.height+m;
const REG={x:120,y:270,width:W-240,height:H-270-190};          // default free region: below headline, above captions
function spot(w,h,R=REG,tries=80){let best=null;for(let k=0;k<tries;k++){const b={x:R.x+rnd()*Math.max(0,R.width-w),y:R.y+rnd()*Math.max(0,R.height-h),width:w,height:h};if(!USED.some(u=>near(b,u)))return claim(b);best=best||b}console.warn('crowded: no free spot',w,h);return claim(best)}
const D=i=>{i.decor=true;return i};
const S=(d,dur=.5,c=C.k,w=5)=>{const i=stroke(d,{start:at,dur,w,color:c});at+=dur+.12;return i};
const Wr=(s,x,y,size=56,c=C.k,o={})=>{const i=write(s,x,y,{size,start:at,color:c,...o});claim(i.box);at+=i.dur+.15;return i};
const Rc=(x,y,w,h,c=C.k)=>{claim({x,y,width:w,height:h});return S(rough([[x-4,y+2],[x+w,y-2],[x+w+3,y+h],[x+2,y+h+3],[x-3,y-6]],2.5),.7,c)};
const A=(x1,y1,x2,y2,c=C.k,b=0)=>{arrow(x1,y1,x2,y2,c,at,.35,b);at+=.75};
const U=i=>{D(underline(i.box,{start:at}));at+=.65;return i},Rg=i=>{const b=i.box;D(loop(b.x+b.width/2,b.y+b.height/2,b.width/2+34,b.height/2+26,{start:at}));at+=1.1;return i};
const Ck=(x,y,c=C.g)=>S(`M${x} ${y} L${x+30} ${y+40} L${x+90} ${y-50}`,.4,c,9);
const head=(s,o={})=>U(Wr(s,W/2,170,96,C.k,o));
function HL(i,c=C.a){const b=i.box,r=document.createElementNS(NS,'rect');r.setAttribute('x',b.x-8);r.setAttribute('y',b.y+b.height*.22);r.setAttribute('width',b.width+16);r.setAttribute('height',b.height*.6);r.setAttribute('rx',10);r.setAttribute('fill',c);r.setAttribute('fill-opacity','.35');
 const cy=b.y+b.height*.52,h=reveal(r,`M${b.x-30} ${cy} L${b.x+b.width+30} ${cy}`,{start:at,dur:.5,brush:b.height*.9});world.insertBefore(r,i.node);D(h);at+=.6;return i}
const circle=(x,y,r)=>`M${x-r} ${y} A${r} ${r} 0 1 1 ${x+r} ${y} A${r} ${r} 0 1 1 ${x-r} ${y}`;
/* ---- doodle marks: cheap spontaneity (burst, sparkle, squiggle, spiral) ---- */
function mark(kind,x,y,s=1,c=C.a){let d='';if(kind==='burst')for(let i=0;i<8;i++){const a=i/8*6.283+jit(.15);d+=`M${x+Math.cos(a)*30*s} ${y+Math.sin(a)*30*s} L${x+Math.cos(a)*56*s} ${y+Math.sin(a)*56*s} `}
 else if(kind==='sparkle')d=`M${x-30*s} ${y} L${x+30*s} ${y} M${x} ${y-30*s} L${x} ${y+30*s} M${x-14*s} ${y-14*s} L${x+14*s} ${y+14*s} M${x+14*s} ${y-14*s} L${x-14*s} ${y+14*s}`;
 else if(kind==='squig'){d=`M${x} ${y}`;for(let i=0;i<6;i++)d+=` q${12*s} ${-14*s} ${24*s} 0 t${24*s} 0`}
 else if(kind==='spiral'){for(let i=0;i<=60;i++){const a=i*.28,r=(2+i*.7)*s;d+=(i?' L':'M')+(x+Math.cos(a)*r).toFixed(1)+' '+(y+Math.sin(a)*r).toFixed(1)}}
 claim({x:x-60*s,y:y-60*s,width:120*s,height:120*s});return D(S(d,.45,c,4))}
/* ---- icons / stickers: 100x100 local space, absolute M L Q C Z, or [cx,cy,r] circles ---- */
const ICON={book:["M10 25 L50 32 L90 25 L90 78 L50 85 L10 78 Z","M50 32 L50 85"],film:["M8 22 L92 22 L92 78 L8 78 Z","M42 38 L42 62 L64 50 Z"],speaker:["M12 38 L32 38 L52 20 L52 80 L32 62 L12 62 Z","M64 38 Q74 50 64 62","M72 28 Q92 50 72 72"],note:["M38 76 L38 24 L82 14 L82 66",[28,76,10],[72,66,10]],phone:["M30 8 L70 8 L70 92 L30 92 Z","M42 82 L58 82"],coin:[[50,50,40],"M50 26 L50 74","M38 38 Q50 28 62 38 Q38 50 62 62 Q50 72 38 62"],bulb:["M50 8 C20 8 14 44 34 58 L34 72 L66 72 L66 58 C86 44 80 8 50 8 Z","M38 82 L62 82","M42 92 L58 92"],person:[[50,24,14],"M50 38 L50 66","M26 50 L50 44 L74 50","M50 66 L32 92","M50 66 L68 92"],check:["M18 52 L40 76 L84 24"],star:["M50 8 L61 38 L93 40 L68 60 L77 92 L50 74 L23 92 L32 60 L7 40 L39 38 Z"],clock:[[50,50,40],"M50 24 L50 50 L68 62"],heart:["M50 86 C10 56 6 24 28 16 C42 11 50 24 50 30 C50 24 58 11 72 16 C94 24 90 56 50 86 Z"],house:["M10 48 L50 14 L90 48","M20 44 L20 88 L80 88 L80 44","M42 88 L42 62 L58 62 L58 88"],cloud:["M26 74 C6 74 6 46 28 46 C30 24 66 20 72 44 C94 42 98 74 76 74 Z"],sun:[[50,50,18],"M50 8 L50 22","M50 78 L50 92","M8 50 L22 50","M78 50 L92 50","M20 20 L30 30","M70 70 L80 80","M80 20 L70 30","M30 70 L20 80"],gear:[[50,50,16],[50,50,30],"M50 8 L50 20","M50 80 L50 92","M8 50 L20 50","M80 50 L92 50","M20 20 L28 28","M72 72 L80 80","M80 20 L72 28","M28 72 L20 80"],mic:["M38 12 L62 12 L62 52 Q62 66 50 66 Q38 66 38 52 Z","M26 44 Q26 78 50 78 Q74 78 74 44","M50 78 L50 92","M36 92 L64 92"],camera:["M8 30 L30 30 L38 18 L62 18 L70 30 L92 30 L92 82 L8 82 Z",[50,56,16]],chat:["M10 14 L90 14 L90 64 L48 64 L26 86 L28 64 L10 64 Z"],search:[[42,42,28],"M62 62 L90 90"],
 rocket:["M50 6 C68 22 72 48 66 70 L34 70 C28 48 32 22 50 6 Z",[50,40,8],"M34 56 L18 78 L36 72","M66 56 L82 78 L64 72","M42 78 L50 96 L58 78"],trophy:["M28 14 L72 14 L68 46 C66 58 34 58 32 46 Z","M28 22 C8 22 8 44 32 46","M72 22 C92 22 92 44 68 46","M50 56 L50 74","M32 88 L68 88 L64 74 L36 74 Z"],lock:["M24 44 L76 44 L76 90 L24 90 Z","M34 44 L34 28 C34 8 66 8 66 28 L66 44",[50,64,6],"M50 70 L50 80"],key:[[28,50,18],"M46 50 L90 50","M76 50 L76 64","M88 50 L88 62"],flag:["M24 10 L24 94","M24 12 C44 4 56 24 80 14 L80 52 C56 62 44 42 24 52"],pencil:["M20 80 L26 62 L76 12 L88 24 L38 74 Z","M26 62 L38 74","M68 20 L80 32"],laptop:["M18 20 L82 20 L82 62 L18 62 Z","M8 70 L92 70 L86 82 L14 82 Z"],badge:[[50,42,28],"M38 42 L47 52 L64 32","M38 64 L30 94 L44 86","M62 64 L70 94 L56 86"],megaphone:["M14 40 L40 40 L80 14 L80 76 L40 52 L14 52 Z","M30 52 L36 76 L48 76 L44 56","M88 34 Q96 45 88 56"],calendar:["M12 22 L88 22 L88 88 L12 88 Z","M12 40 L88 40","M30 12 L30 30","M70 12 L70 30","M28 54 L40 54","M46 54 L58 54","M64 54 L76 54","M28 70 L40 70"],pin:["M50 92 C20 56 20 44 20 38 C20 20 34 8 50 8 C66 8 80 20 80 38 C80 44 80 56 50 92 Z",[50,38,12]],tree:[[50,34,26],"M44 58 L44 92","M56 58 L56 92","M36 92 L64 92"],mountain:["M6 86 L36 30 L52 56 L66 38 L94 86 Z","M28 46 L36 54 L42 44"],smile:[[50,50,40],[36,40,4],[64,40,4],"M30 60 Q50 82 70 60"],bolt:["M58 6 L22 56 L46 56 L38 94 L78 40 L52 40 Z"],graph:["M12 10 L12 88 L92 88","M26 88 L26 64 L40 64 L40 88","M48 88 L48 44 L62 44 L62 88","M70 88 L70 22 L84 22 L84 88"],target:[[50,50,42],[50,50,26],[50,50,8],"M50 50 L86 14"],coffee:["M16 34 L72 34 L68 78 C66 88 24 88 20 78 Z","M72 42 C92 42 92 68 70 68","M32 26 Q26 18 32 10","M48 26 Q42 18 48 10"]};
function xfPath(d,fn){const tk=d.match(/[A-Z]|-?\d*\.?\d+/g);let o='',i=0;while(i<tk.length){const k=tk[i];if(/[A-Z]/.test(k)){o+=k+' ';i++}else{const p=fn(+tk[i],+tk[i+1]);o+=p[0].toFixed(1)+' '+p[1].toFixed(1)+' ';i+=2}}return o}
function icon(name,x,y,s=2,{c=C.k,dur=.35,rotA=jit(3)}={}){const cx=x+50*s,cy=y+50*s,P=(px,py)=>{const q=rot({x:x+px*s,y:y+py*s},rotA,cx,cy);return[q.x,q.y]};
 claim({x,y,width:100*s,height:100*s});const b={x,y,width:100*s,height:100*s};let first=null;
 for(const e of ICON[name]){const it=Array.isArray(e)?S(circle(...[P(e[0],e[1])[0],P(e[0],e[1])[1],e[2]*s]),dur,c):S(xfPath(e,P),dur,c);first=first||it}
 BOXED.push({start:first.start,box:b,str:'icon:'+name,virt:1});return b}
/* put(): icon + label dropped into a free spot (spontaneous placement) */
function put(name,label,R=REG,{s=2,c=C.k,size=52}={}){const w=100*s+40,h=100*s+100,b=spot(w,h,R),cx=b.x+w/2;icon(name,cx-50*s,b.y,s,{c});Wr(label,cx,b.y+100*s+60,size,c,{maxW:w+60});return b}
/* ---- speech / thought bubble ---- */
function bubble(txt,cx,cy,{size=52,c=C.k,tail=[cx-70,cy+140],maxW=620}={}){const m=measure(txt,size),w=Math.min(m.width,maxW)+90,h=m.height+56,x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2,tx=clamp(tail[0],x0+50,x1-50);claim({x:x0,y:y0,width:w,height:h});
 S(rough([[x0,y0],[x1,y0],[x1,y1],[tx+26,y1],tail,[tx-18,y1],[x0,y1]],2.5,true),.9,c);return Wr(txt,cx,cy+size*.3,size,c,{maxW:maxW})}
/* ============ 4. STICKMAN: a rig. Pose angles in degrees from straight-down, + = toward +x ============ */
/* P=[lean, armL(up,low), armR(up,low), legL(up,low), legR(up,low)] */
const POSES={stand:t=>[Math.sin(t*1.6),-22,-10,22,10,-12,-5,12,5],wave:t=>[0,-22,-10,128,155+28*Math.sin(t*11),-12,-5,12,5],point:t=>[4,-22,-10,98,96,-12,-5,12,5],think:t=>[0,-22,-10,38,192,-12,-5,12,5],
 cheer:t=>[0,-150,-166+7*Math.sin(t*9),150,166-7*Math.sin(t*9),-14,-6,14,6],shrug:t=>[0,-70,-140,70,140,-12,-5,12,5],walk:t=>{const s=Math.sin(t*7);return[3,-26*s,-26*s-10,26*s,26*s+10,28*s,28*s-16,-28*s,-28*s-16]}};
const pp=p=>p[0].toFixed(1)+' '+p[1].toFixed(1);
function figD(f,P,x,y,expr,face){const s=f.s,hip=[x,y-.45*s],up=[Math.sin(rad(P[0])),-Math.cos(rad(P[0]))],neck=[hip[0]+up[0]*.3*s,hip[1]+up[1]*.3*s],r=.115*s,hc=[neck[0]+up[0]*(r+.02*s),neck[1]+up[1]*(r+.02*s)];
 const lm=(p,a,l)=>[p[0]+Math.sin(rad(a))*l,p[1]+Math.cos(rad(a))*l],seg=(p,a1,a2,L1,L2)=>{const k=lm(p,a1,L1),e=lm(k,a2,L2);return` M${pp(p)} L${pp(k)} L${pp(e)}`};
 let d=`M${pp(hip)} L${pp(neck)}`+seg(hip,P[5],P[6],.23*s,.22*s)+seg(hip,P[7],P[8],.23*s,.22*s)+seg(neck,P[1],P[2],.17*s,.17*s)+seg(neck,P[3],P[4],.17*s,.17*s);
 d+=` M${(hc[0]+r).toFixed(1)} ${hc[1].toFixed(1)} A${r} ${r} 0 1 1 ${(hc[0]-r).toFixed(1)} ${hc[1].toFixed(1)} A${r} ${r} 0 1 1 ${(hc[0]+r).toFixed(1)} ${hc[1].toFixed(1)}`;
 const fx=hc[0]+face*r*.22,ey=hc[1]-r*.15,my=hc[1]+r*.38;d+=` M${(fx-r*.34).toFixed(1)} ${ey.toFixed(1)} l.1 0 M${(fx+r*.34).toFixed(1)} ${ey.toFixed(1)} l.1 0`;
 const mx=fx,mw=r*.38;d+=expr==='sad'?` M${(mx-mw).toFixed(1)} ${(my+r*.12).toFixed(1)} Q${mx.toFixed(1)} ${(my-r*.2).toFixed(1)} ${(mx+mw).toFixed(1)} ${(my+r*.12).toFixed(1)}`:expr==='open'?` M${(mx-mw).toFixed(1)} ${my.toFixed(1)} Q${mx.toFixed(1)} ${(my+r*.7).toFixed(1)} ${(mx+mw).toFixed(1)} ${my.toFixed(1)} Z`:expr==='flat'?` M${(mx-mw).toFixed(1)} ${my.toFixed(1)} L${(mx+mw).toFixed(1)} ${my.toFixed(1)}`:` M${(mx-mw).toFixed(1)} ${my.toFixed(1)} Q${mx.toFixed(1)} ${(my+r*.5).toFixed(1)} ${(mx+mw).toFixed(1)} ${my.toFixed(1)}`;return d}
function figState(f,t){const K=f.K;let i=0;while(i+1<K.length&&K[i+1].t<=t)i++;const a=K[i],b=K[i-1];let P=POSES[a.pose](t);if(b){const k=E.inOut(clamp((t-a.t)/.4)),B=POSES[b.pose](t);P=P.map((v,j)=>lerp(B[j],v,k))}
 let x=f.x,y=f.y,face=1;for(const m of f.M)if(t>=m.t0){const k=clamp((t-m.t0)/(m.t1-m.t0));x=lerp(m.x0,m.x1,k);y=lerp(m.y0,m.y1,k);face=m.face}return{P,x,y,expr:a.expr,face}}
function figure(x,y,s,{color='var(--ink)',pose='stand',expr='smile',dur=1.8,w=6}={}){const el=document.createElementNS(NS,'path'),meas=document.createElementNS(NS,'path');Object.assign(el.style,{fill:'none',stroke:color,strokeWidth:w,strokeLinecap:'round',strokeLinejoin:'round'});el.setAttribute('pathLength','1');world.appendChild(el);defs.appendChild(meas);
 const f={x,y,s,K:[{t:0,pose,expr}],M:[]},d0=figD(f,POSES[pose](0),x,y,expr,1);meas.setAttribute('d',d0);const len=meas.getTotalLength()||1,start=at;let ph=null;
 f.it=mk({el,start,dur,ease:E.pen,kind:'rig',pos:p=>meas.getPointAtLength(len*p),tick:t=>{if(t<start+dur){if(ph!==1){el.setAttribute('d',d0);el.style.strokeDasharray='1';ph=1}const p=E.pen(clamp((t-start)/dur));el.style.strokeDashoffset=1-p;el.style.visibility=p<=0?'hidden':'visible'}
  else{if(ph!==0){el.style.strokeDasharray='none';el.style.strokeDashoffset=0;el.style.visibility='visible';ph=0}const q=figState(f,t);el.setAttribute('d',figD(f,q.P,q.x,q.y,q.expr,q.face))}}});
 const fb={x:x-.4*s,y:y-1.05*s,width:.8*s,height:1.05*s};claim(fb);f.it.box=fb;f.it.str='figure';f.it.over=true;BOXED.push(f.it);at+=dur+.12;
 f.pose=(name,{expr,t=at}={})=>{f.K.push({t,pose:name,expr:expr||f.K[f.K.length-1].expr});return f};
 f.go=(x2,y2,d=1.6,t=at)=>{const m=f.M[f.M.length-1]||{x1:x,y1:y},ex=f.K[f.K.length-1].expr;f.M.push({t0:t,t1:t+d,x0:m.x1,y0:m.y1,x1:x2,y1:y2,face:x2<m.x1?-1:1});f.K.push({t,pose:'walk',expr:ex},{t:t+d,pose:'stand',expr:ex});at=Math.max(at,t+d);return f};return f}
/* ============ 5. PICTURES: real assets (logo, photo, screenshot, transparent sticker) ============ */
const ASSETS={};async function loadAssets(){for(const[k,src]of Object.entries(ASSET_SRC)){const im=new Image();im.src=src;try{await im.decode()}catch(e){}ASSETS[k]={src,w:im.naturalWidth||400,h:im.naturalHeight||300}}}
/* frame: 'polaroid' | 'tape' | 'none' | 'sticker' (transparent PNG cut-out). style: '' | 'poster' (ink-wash look so photos match the doodles) */
function pic(name,cx,cy,w,{rotA=jit(3),frame='polaroid',style='',dur=1.2}={}){const AS=ASSETS[name];if(!AS){console.warn('missing asset',name);return null}
 const h=w*AS.h/AS.w,pad=frame==='polaroid'?18:0,bot=frame==='polaroid'?46:0,g=document.createElementNS(NS,'g'),mkn=(t,a)=>{const n=document.createElementNS(NS,t);for(const k in a)n.setAttribute(k,a[k]);return n};g.setAttribute('transform',`rotate(${rotA} ${cx} ${cy})`);
 const bb={x:cx-w/2-pad,y:cy-h/2-pad,width:w+2*pad,height:h+2*pad+bot};
 if(frame==='polaroid')g.appendChild(mkn('rect',{x:bb.x,y:bb.y,width:bb.width,height:bb.height,fill:'#fff',filter:'url(#lift)'}));
 const im=mkn('image',{href:AS.src,x:cx-w/2,y:cy-h/2,width:w,height:h,preserveAspectRatio:'xMidYMid slice'});const fl=frame==='sticker'?'sticker':style;if(fl)im.setAttribute('filter',`url(#${fl})`);g.appendChild(im);
 if(frame==='tape')g.appendChild(mkn('rect',{x:cx-34,y:bb.y-14,width:68,height:28,fill:'#E8A317','fill-opacity':.55,transform:`rotate(-5 ${cx} ${bb.y})`}));
 const gb={x:bb.x-20,y:bb.y-20,w:bb.width+40,h:bb.height+40},it=reveal(g,hatch(gb,60),{start:at,dur,brush:100,xf:rotA?{a:rotA,cx,cy}:null,host:art});
 it.box=rotBox(bb,rotA,cx,cy);it.str='pic:'+name;claim(it.box);BOXED.push(it);at+=dur+.15;
 if(frame==='tape'||frame==='none'){const P=(x,y)=>{const q=rot({x,y},rotA,cx,cy);return[q.x,q.y]};S(rough([P(bb.x,bb.y),P(bb.x+bb.width,bb.y),P(bb.x+bb.width,bb.y+bb.height),P(bb.x,bb.y+bb.height),P(bb.x-3,bb.y-4)],2),.7,C.k,4)}return it}
/* ============ 6. BEATS: narration first; each beat starts when voice AND drawing of the previous one are done ============ */
const CAPS=[],OVERRUN=[];let DURATION=0,cur=null,BEATS=[];
const speechSecs=txt=>txt.trim().split(/\s+/).length/2.4*1.15+.8;
const clr=t=>{items.forEach(i=>{if(i.until===undefined)i.until=t});BOXED.forEach(i=>{if(i.until===undefined)i.until=t});USED=[]};
function wipeBoard(){tool('eraser');const r=document.createElementNS(NS,'rect');['x','y'].forEach(k=>r.setAttribute(k,-20));r.setAttribute('width',W+40);r.setAttribute('height',H+40);r.setAttribute('fill','var(--board)');reveal(r,hatch({x:-20,y:-20,w:W+40,h:H+40},110),{start:at,dur:.9,brush:190});at+=1;tool(KIT.tool)}
function beat(text,{keep=false,wipe=false}={}){const T=TIMINGS?TIMINGS[CAPS.length]:null,end=T?T.start:(cur?Math.max(cur.start+cur.speech,at)+.4:0);
 if(cur){cur.end=end;if(T&&at>end+.15)OVERRUN.push(`beat ${CAPS.length-1}: drawing runs ${(at-end).toFixed(1)}s past its audio`);if(!keep){if(wipe){go(end);wipeBoard();clr(end+.8)}else clr(end)}}
 cur={start:end,speech:T?T.end-T.start:speechSecs(text),text};CAPS.push(cur);go(Math.max(at,end)+.3)}
const cam=(x,y,w)=>{CAM.push({t:cur.start,x,y,w:Math.max(w,W/2)});go(Math.max(at,cur.start+.9))};   // call right after beat(): camera moves before any stroke
function endBeats(){cur.end=Math.max(cur.end||0,cur.start+cur.speech,at)+1;DURATION=cur.end;BEATS=CAPS.map((c,i)=>({i,start:c.start,end:c.end,text:c.text}))}
/* ============ 7. THE HAND: tip is the origin; tools; lean follows motion; tip stays exactly on the ink ============ */
const TOOLS={marker:{c:'#2F6FDE',cap:'#1E2A3A',n:20,L:112,w:12},pen:{c:'#2B2F36',cap:'#8A8F98',n:22,L:124,w:6},pencil:{c:'#E8A317',cap:'#E9C9A0',n:26,L:116,w:8},chalk:{c:'#F2EFE6',cap:'#F2EFE6',n:4,L:46,w:10},eraser:{c:'#F4F1EA',cap:'#2F6FDE',n:2,L:52,w:26}},TOOLG={};
function handSVG(T){const a=rad(62),u=[Math.cos(a),-Math.sin(a)],v=[Math.sin(a),Math.cos(a)],P=(l,o)=>(u[0]*l+v[0]*o).toFixed(1)+' '+(u[1]*l+v[1]*o).toFixed(1),{n,L,w}=T,sk='#F2C9A5',ol='#B98862',xy=(l,o)=>P(l,o).split(' ');
 const ln=(p,q,wd,c)=>`<path d="M${p} L${q}" stroke="${c}" stroke-width="${wd}" stroke-linecap="round" fill="none"/>`,fin=(p,q,wd)=>ln(p,q,wd+4,ol)+ln(p,q,wd,sk),pm=xy(n+L*.8,10);
 /* order: pen first, then sleeve + palm cover its upper end (the grip), then thumb and index pinch it near the nib */
 let s=`<path d="M${P(0,0)} L${P(n,-w*.55)} L${P(n,w*.55)} Z" fill="${T.cap}"/><path d="M${P(n,-w)} L${P(n+L,-w)} L${P(n+L,w)} L${P(n,w)} Z" fill="${T.c}" stroke="#0003" stroke-width="2" stroke-linejoin="round"/><path d="M${P(n+L*.1,-w)} L${P(n+L*.1,w)}" stroke="#0002" stroke-width="3"/>`;
 s+=ln(P(n+L*.95,14),P(n+L*.95+120,26),62,'#4A5568')+ln(P(n+L*.9,12),P(n+L*1.02,16),44,ol)+ln(P(n+L*.9,12),P(n+L*1.02,16),40,sk);
 s+=`<ellipse cx="${pm[0]}" cy="${pm[1]}" rx="42" ry="34" fill="${sk}" stroke="${ol}" stroke-width="3" transform="rotate(-28 ${pm[0]} ${pm[1]})"/>`;
 s+=fin(P(n+L*.62,w+26),P(n+L*.3,w+18),17)+fin(P(n+L*.3,w+18),P(n+16,w+3),15)+fin(P(n+L*.66,-w-30),P(n+L*.36,-w-24),17)+fin(P(n+L*.36,-w-24),P(n+20,-w-3),15);return s}
function buildHand(){const sh=document.createElementNS(NS,'ellipse');sh.id='hSh';sh.setAttribute('rx',46);sh.setAttribute('ry',12);sh.setAttribute('fill','#000');sh.setAttribute('opacity','.16');sh.setAttribute('filter','url(#soft)');const rg=document.createElementNS(NS,'g');rg.id='hRot';rg.appendChild(sh);
 for(const[k,T]of Object.entries(TOOLS)){const g=document.createElementNS(NS,'g');g.innerHTML=handSVG(T);g.setAttribute('display','none');rg.appendChild(g);TOOLG[k]=g}
 const dot=document.createElementNS(NS,'circle');dot.setAttribute('r',9);dot.setAttribute('fill','var(--ink)');dot.setAttribute('display','none');rg.appendChild(dot);TOOLG.dot=dot;handG.appendChild(rg)}
let track=[];const REST={x:W-90,y:H-40};
function buildTrack(){const T=[];let last=REST,pe=0,tl=KIT.tool;for(const it of items){const a=it.pos(0),b=it.pos(1),tr=clamp(Math.hypot(a.x-last.x,a.y-last.y)/2400,.2,.5),t0=Math.max(pe,it.start-tr);
 if(t0>pe)T.push({t0:pe,t1:t0,from:last,to:last,hold:1,tool:tl});T.push({t0,t1:it.start,from:last,to:a,tool:it.tool});T.push({t0:it.start,t1:it.start+it.dur,it,down:1,tool:it.tool});last=b;pe=it.start+it.dur;tl=it.tool}
 T.push({t0:pe,t1:pe+.6,from:last,to:REST,tool:tl});T.push({t0:pe+.6,t1:1e9,from:REST,to:REST,hold:1,tool:tl});return T}
function handAt(t){for(const s of track)if(t>=s.t0&&t<s.t1){if(s.down){const p=s.it.ease(clamp((t-s.it.start)/s.it.dur)),q=s.it.pos(p);return{x:q.x+Math.sin(t*38)*.5,y:q.y+Math.cos(t*31)*.5,down:1,tool:s.tool}}
  const k=E.inOut(clamp((t-s.t0)/(s.t1-s.t0))),arc=s.hold?0:-Math.sin(k*Math.PI)*30,sw=s.hold?1:0;return{x:lerp(s.from.x,s.to.x,k)+sw*Math.sin(t*1.9)*4,y:lerp(s.from.y,s.to.y,k)+arc+sw*Math.cos(t*1.4)*3,down:0,tool:s.tool}}return{x:REST.x,y:REST.y,down:0,tool:KIT.tool}}
function drawHand(t){const h=handAt(t),h2=handAt(t-.08),vx=(h.x-h2.x)/.08,tl=Q.get('hand')==='0'?'dot':h.tool;for(const k in TOOLG)TOOLG[k].setAttribute('display',k===tl?'':'none');
 const lean=-9*Math.tanh(vx/800),sc=KIT.handScale*(h.down?1:1.06);handG.setAttribute('transform',`translate(${h.x.toFixed(1)},${h.y.toFixed(1)}) rotate(${lean.toFixed(1)}) scale(${sc})`);
 const sh=$('hSh');sh.setAttribute('cx',h.down?14:26);sh.setAttribute('cy',h.down?10:26);sh.setAttribute('opacity',h.down?.2:.12)}
/* ============ 8. CAMERA, RENDER, LAYOUT CHECK ============ */
function camAt(t){let i=0;for(let k=1;k<CAM.length;k++){if(CAM[k].t<=t)i=k;else break}const a=CAM[i],p=CAM[i-1];if(!p)return a;const k=E.inOut(clamp((t-a.t)/.9));return{x:lerp(p.x,a.x,k),y:lerp(p.y,a.y,k),w:lerp(p.w,a.w,k)}}
function render(t){for(const it of items){it.tick(t);const n=it.node||it.el,off=t<it.start||(it.until!==undefined&&t>=it.until+.6);n.style.display=off?'none':'';if(!off)n.style.opacity=it.until!==undefined&&t>=it.until?Math.max(0,1-(t-it.until)/.6):1}   // items not yet drawn or already erased are display:none, so the browser skips them (about 4x faster frames)
 drawHand(t);const c=camAt(t);svg.setAttribute('viewBox',`${c.x.toFixed(1)} ${c.y.toFixed(1)} ${c.w.toFixed(1)} ${(c.w*H/W).toFixed(1)}`);$('bn').setAttribute('seed',1+Math.floor(t*8)%4);updateCaption(t);scrub.value=t}
const alive=(it,t)=>it.start<=t&&(it.until===undefined||t<it.until),ov=(p,q)=>p.x<q.x+q.width&&q.x<p.x+p.width&&p.y<q.y+q.height&&q.y<p.y+p.height;
function layoutAt(t){const out=[],hit=(p,b)=>p.x>b.x-12&&p.x<b.x+b.width+12&&p.y>b.y-8&&p.y<b.y+b.height+8,bx=BOXED.filter(i=>alive(i,t)),tx=bx.filter(i=>i.str&&!i.virt&&!/^(pic|figure|icon)/.test(i.str)),st=items.filter(i=>i.kind==='stroke'&&!i.decor&&alive(i,t)),c=camAt(t),V={x:c.x,y:c.y,w:c.w,h:c.w*H/W};
 bx.forEach((a,i)=>bx.slice(i+1).forEach(b=>{if(!a.over&&!b.over&&ov(a.box,b.box))out.push(`overlap: "${(a.str||'').slice(0,20)}" vs "${(b.str||'').slice(0,20)}"`)}));
 const VB={x:V.x,y:V.y,width:V.w,height:V.h};tx.forEach(a=>{if(!ov(a.box,VB))return;const lab=a.str.slice(0,24);for(const it of st)for(let k=0;k<=24;k++)if(hit(it.pos(k/24),a.box)){out.push(`stroke crosses text: "${lab}"`);break}
  if(a.box.y+a.box.height>V.y+V.h-140)out.push(`text in caption zone: "${lab}"`);if(a.box.x<V.x+60||a.box.x+a.box.width>V.x+V.w-60)out.push(`text outside margins: "${lab}"`)});return[...new Set(out)]}
window.__layoutAt=layoutAt;
/* ============ 9. PLAYBACK, CAPTIONS, NARRATION (Mode A browser voice | Mode B recorded audio) ============ */
let t=0,playing=false,speed=1,last=0,capOn=true;const play=$('play'),scrub=$('scrub'),cap=$('cap'),vSel=$('voice'),muteBtn=$('mute'),vTest=$('vtest'),vStat=$('vstat'),setStat=s=>{vStat.textContent=s};
function updateCaption(t){const b=BEATS.find(b=>t>=b.start&&t<b.end)||BEATS[BEATS.length-1];if(!b||!capOn){cap.textContent='';return}const parts=b.text.match(/[^.!?]+[.!?]*/g).map(s=>s.trim()),f=clamp((t-b.start)/Math.max(.1,b.end-b.start-.5));cap.textContent=parts[Math.min(parts.length-1,Math.floor(f*parts.length))]}
const AUD=AUDIO_SRC?new Audio(AUDIO_SRC):null;if(AUD)AUD.preservesPitch=true;
const TTS={on:!AUD,voice:null,i:-1,tok:0,speaking:false,list:[]};
TTS.pick=()=>{const want=(navigator.language||'en').slice(0,2),sc=x=>(/natural|neural|google|online/i.test(x.name)?2:0)+(x.localService?0:1);TTS.list=speechSynthesis.getVoices().filter(x=>x.lang.startsWith(want)).sort((a,b)=>sc(b)-sc(a));if(!TTS.voice||!TTS.list.includes(TTS.voice))TTS.voice=TTS.list[0]||null;voiceUI();setStat(TTS.list.length?TTS.list.length+' voice(s) ready':'No voice found for this language; trying the device default')};
TTS.stop=()=>{TTS.tok++;TTS.speaking=false;if('speechSynthesis' in window)speechSynthesis.cancel()};
TTS.say=(i,frac=0)=>{TTS.stop();const b=BEATS[i],tok=++TTS.tok;TTS.i=i;TTS.speaking=true;const parts=(b.text.match(/[^.!?]+[.!?]*/g)||[b.text]).map(s=>s.trim());let k=Math.floor(frac*parts.length);
 const next=()=>{if(tok!==TTS.tok)return;if(k>=parts.length){TTS.speaking=false;return}const u=new SpeechSynthesisUtterance(parts[k++]);if(TTS.voice){u.voice=TTS.voice;u.lang=TTS.voice.lang}let started=false;u.rate=Math.min(1.4,.95*speed);
  u.onstart=()=>{started=true;setStat('Speaking')};u.onend=next;u.onerror=e=>{if(tok===TTS.tok){TTS.speaking=false;setStat('Voice error ('+(e.error||'unknown')+'). Captions only.')}};
  try{speechSynthesis.speak(u)}catch(e){TTS.speaking=false;setStat('Speech failed. Captions only.')}
  setTimeout(()=>{if(!started&&tok===TTS.tok){TTS.speaking=false;setStat('No sound started. Check volume and the silent switch, or open this page in your browser.')}},3000)};next()};
TTS.test=()=>{TTS.stop();const u=new SpeechSynthesisUtterance('Voice check. Can you hear this?');if(TTS.voice){u.voice=TTS.voice;u.lang=TTS.voice.lang}let st=false;u.onstart=()=>{st=true;setStat('Speaking')};u.onend=()=>setStat('Test finished. Heard nothing? Check volume, the silent switch, or open in your browser.');u.onerror=e=>setStat('Voice error ('+(e.error||'unknown')+')');
 try{speechSynthesis.speak(u)}catch(e){setStat('Speech failed')}setTimeout(()=>{if(!st)setStat('No sound started. Check volume and the silent switch, or open this page in your browser.')},3000)};
function narrate(prevT){if(!TTS.on)return t;const b=BEATS.find(b=>t>=b.start&&t<b.end);if(b&&TTS.i!==b.i)TTS.say(b.i);const pb=BEATS.find(x=>prevT>=x.start&&prevT<x.end);if(pb&&TTS.i===pb.i&&TTS.speaking&&t>=pb.end)return pb.end-.001;return t}
function voiceUI(){vSel.hidden=TTS.list.length<2;vSel.replaceChildren(...TTS.list.map((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${v.name} (${v.lang})`;return o}));vSel.value=Math.max(0,TTS.list.indexOf(TTS.voice))}
function resync(){if(AUD){AUD.currentTime=t;AUD.playbackRate=speed;if(playing)AUD.play().catch(e=>setStat('Audio blocked: '+e.message));return}if(!playing||!TTS.on)return;const b=BEATS.find(b=>t>=b.start&&t<b.end);if(b)TTS.say(b.i,(t-b.start)/(b.end-b.start))}
const silence=()=>{if(AUD)AUD.pause();TTS.stop();TTS.i=-1};
vSel.onchange=()=>{TTS.voice=TTS.list[+vSel.value];resync()};
muteBtn.onclick=()=>{if(AUD){AUD.muted=!AUD.muted;muteBtn.textContent=AUD.muted?'Voice off':'Voice on';muteBtn.setAttribute('aria-pressed',String(AUD.muted));return}TTS.on=!TTS.on;muteBtn.setAttribute('aria-pressed',String(!TTS.on));muteBtn.textContent=TTS.on?'Voice on':'Voice off';if(TTS.on)resync();else{TTS.stop();TTS.i=-1}};
vTest.onclick=()=>{if(AUD){AUD.currentTime=0;AUD.play().then(()=>{setStat('Playing narration audio');setTimeout(()=>{if(!playing)AUD.pause()},2000)}).catch(e=>setStat('Audio blocked: '+e.message))}else TTS.test()};
if(!AUD&&'speechSynthesis' in window){TTS.pick();speechSynthesis.onvoiceschanged=()=>TTS.pick()}else if(!AUD){TTS.on=false;muteBtn.hidden=vTest.hidden=true;setStat('Speech is not supported here. Captions only.')}
function tick(now){if(playing){const dt=Math.min(.1,(now-last)/1000);if(AUD&&!AUD.ended&&!AUD.paused)t=Math.min(DURATION,AUD.currentTime);else if(AUD)t=Math.min(DURATION,t+dt*speed);else{const pt=t;t=Math.min(DURATION,pt+dt*speed);t=narrate(pt)}
 if(t>=DURATION){playing=false;play.textContent='Play';silence()}}last=now;render(t);requestAnimationFrame(tick)}
const seek=s=>{t=clamp(s,0,DURATION);silence();if(AUD)AUD.currentTime=t;render(t)};
play.onclick=()=>{if(t>=DURATION){t=0;TTS.i=-1}playing=!playing;play.textContent=playing?'Pause':'Play';if(playing)resync();else silence()};
$('replay').onclick=()=>{t=0;silence();playing=true;play.textContent='Pause';resync()};
scrub.oninput=()=>seek(+scrub.value);$('spd').onchange=e=>{speed=+e.target.value;if(AUD)AUD.playbackRate=speed};
$('ccb').onclick=e=>{capOn=!capOn;e.target.setAttribute('aria-pressed',String(capOn));e.target.textContent=capOn?'Captions on':'Captions off'};
addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName)&&e.key!==' ')return;if(e.key===' '&&e.target.tagName!=='BUTTON'){e.preventDefault();play.onclick()}if(e.key==='ArrowRight')seek(t+2);if(e.key==='ArrowLeft')seek(t-2)});
window.__seek=s=>{t=s;playing=false;silence();render(t)};window.__beats=()=>BEATS;
/* ============ 10. SCENES (replace this demo with the real story) ============ */
async function main(){try{await document.fonts.load('700 64px Caveat')}catch(e){}await document.fonts.ready;await loadAssets();buildHand();
 /* demo: "Ada" — a story told in a loose, sketchy way, with one organized beat in the middle */
 beat("Meet Ada. She watched forty hours of guitar videos, and still could not play one song.");
 U(Wr("Meet Ada",W*.3,230,96,C.b));
 const ada=figure(W*.3,H*.8,400,{color:C.b,expr:'sad'});
 put('film','40 hours',{x:W*.52,y:300,width:W*.4,height:300},{c:C.r});Wr("?",W*.82,520,150,C.r,{rotA:8});ada.pose('shrug');
 beat("So she tried something different. Ten minutes. One small task. Then honest feedback.",{wipe:true});
 head("A tiny loop");const row=['clock','pencil','chat'],lab=['10 minutes','one task','feedback'];
 row.forEach((n,i)=>{const cx=W*.2+i*W*.3;icon(n,cx-100,340,2,{c:cl[i]});Wr(lab[i],cx,650,60,cl[i],{rotA:jit(2)});if(i<2)A(cx+130,440,cx+W*.3-130,440,C.k,.12)});mark('squig',W*.34,720,1,C.a);
 beat("A week later? She played her first song, and she could not stop smiling.",{wipe:true});
 const ada2=figure(W*.32,H*.8,420,{color:C.b,expr:'smile'});ada2.pose('cheer',{expr:'open'});bubble("I did it!",W*.62,400,{tail:[W*.42,H*.5]});
 mark('burst',W*.2,300,1.4,C.a);mark('sparkle',W*.8,330,1.2,C.g);put('note','first song',{x:W*.55,y:560,width:W*.35,height:300},{c:C.g});
 beat("Watch less. Do more. Start with one small task today.",{wipe:true});
 const t1=Wr("Watch less.",W/2,360,130,C.r,{rotA:-3});const t2=Wr("Do more.",W/2,560,150,C.g,{rotA:2});Rg(t2);Wr("Start today",W/2,800,90,C.b);
 endBeats();track=buildTrack();
 scrub.max=DURATION;window.__duration=DURATION;window.__overrun=OVERRUN;BEATS.forEach(b=>{const p=document.createElement('p');p.textContent=b.text;$('tr').appendChild(p)});
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)t=DURATION;render(t);requestAnimationFrame(tick)}
main();
</script></body></html>
```

### 6.1 Embed the handwriting font (required for video)

The template links Caveat from Google Fonts. Published pages load it, but the sandbox's headless Chromium usually cannot, and a video freezes whatever font it rendered. Fetch the Latin subset once (any machine with network, or the sandbox when outbound HTTPS works) and inline it at the top of the `<style>` block; it is about 50 KB.

```python
#!/usr/bin/env python3
"""embed_font.py page.html  -> inlines Caveat 700 (Latin) as a data: URI @font-face. Re-run safe."""
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
```

No network at all: ask the user for the `.woff2`/`.ttf` (or install `fonts-caveat`), else export anyway and state that the video uses a fallback font.

**Publishing note.** The Artifact tool wraps the page in its own document skeleton, so publish a copy with the leading `<!doctype html><html><head>` + metas, the `</head><body>` pair and the closing `</body></html>` removed. Keep the full document for QA, export and the downloadable `.html`.

### Scene cheat sheet

| Call | Does |
|---|---|
| `beat(text,{keep,wipe})` | Start a beat (window sized from narration or from `TIMINGS`); clears the previous board unless `keep`; `wipe` erases with the eraser |
| `Wr(text,x,y,size,color,{rotA,maxW})` | Handwritten text, centered, auto-fits |
| `head(text)` / `U(i)` / `Rg(i)` / `HL(i)` | Headline / underline / ring / highlighter behind text |
| `Rc(x,y,w,h,c)`, `S(path,dur,c,w)`, `A(x1,y1,x2,y2,c,bend)`, `Ck(x,y)` | Rough box, any stroke, curved arrow, checkmark |
| `icon(name,x,y,scale,{c})`, `put(name,label,region,{s,c})` | Sticker at a point / sticker + label in a free spot |
| `spot(w,h,region)` | Find a free place (seeded, deterministic) for loose layouts |
| `mark(kind,x,y,scale,c)` | burst, sparkle, squig, spiral |
| `bubble(text,cx,cy,{tail})` | Speech bubble |
| `figure(x,y,h,{color,expr})` + `.pose()` `.go()` | Stickman |
| `pic(name,cx,cy,w,{frame,style,rotA})` | Real image |
| `cam(x,y,w)` | Camera move for this beat (w at least W/2, zoom max 2x) |
| `tool(name)` | Pen tool for items created next |
| `endBeats()` | Finish; then `track=buildTrack()` (already in the demo) |

Query switches: `?theme=chalk|kraft|blueprint` (colors only), `?fmt=vertical` (1080x1920; place with fractions of `W`/`H`), `?hand=0`.

## 7. Voice: pick the best available, never fake audio

0. **Supabein TTS (preferred when the user gives a token).** Endpoint: `https://supabein.dxinnovationhub.com/tts/speak?token=TOKEN&text=TEXT` (`text` URL-encoded). Rules:
   - **One call per beat** (22 to 35 words, about 200 characters). Never send a whole script in one URL: long URLs fail.
   - **Token handling.** Pass it only as an environment variable for the one command: `SUPABEIN_TOKEN='...' python3 make_audio.py beats.json audio/ --engine supabein`. Never write it to a file, the HTML, `beats.json`, a QA report, a log or the reply. If an error message contains it, mask it. Tell the user to rotate or revoke the token afterwards if it was pasted in chat.
   - **Network.** The sandbox usually blocks outside hosts. If the call fails with a network or `x-deny-reason` error, tell the user to allow `supabein.dxinnovationhub.com` in their network settings, then fall back to the timed script (item 4) or Mode A. Do not pretend audio exists.
   - **Response.** The script accepts an audio file (mp3 or wav) or JSON with base64 audio or an audio URL, validates it with `ffprobe`, and converts it to mp3. If the service answers something else, show the user the status and first 200 characters of the reply (never the token) and stop.
   - **Pronunciation.** `make_audio.py` respells website names for the voice only (`Apprelab.com` is spoken as "Apprelab dot com"); captions keep the original text.
   - **Length.** A published page embeds the audio as a data URI. For anything over 5 minutes set `AUDIO_BITRATE=64k`; keep the file under about 10 MB.
1. **Check once for other engines:** `python3 -c "import edge_tts"`; `which edge-tts piper espeak-ng`; try `pip install edge-tts --break-system-packages`. The sandbox has no network by default, so Edge TTS usually cannot run there; say so plainly.
2. **Edge TTS** (best free voices, needs network): `make_audio.py` calls `edge-tts --voice V --rate R --text ... --write-media bNN.mp3` per beat. Good voices: `en-NG-EzinneNeural`, `en-NG-AbeoNeural`, `en-US-AriaNeural`, `en-US-AnaNeural` (kid-friendly), `en-GB-RyanNeural`. List with `edge-tts --list-voices`. Also works on the user's own machine.
3. **Other engines:** `piper` (set `PIPER_MODEL`), `espeak-ng` (robotic: timing drafts only), or any clips the user records or generates, named `b00.mp3`, `b01.mp3`...
4. **No engine: give the timed script.** `make_audio.py` writes `narration_script.txt` (one block per beat, one sentence per line) and `narration.srt` with timings from the page, exits 3. **Paste the SRT into the reply** in a code block, tell the user to feed each beat to any TTS (ElevenLabs, Edge TTS online, Google, phone recorder), and to return one clip per beat or one recording (`--split recording.mp3` finds beat gaps by silence; approximate, and it warns when it falls back to word counts).
5. **Wire audio in (audio first):** write `beats.json` (a plain list of the exact beat strings); run `python3 make_audio.py beats.json audio/`; paste `timings.json` start/end pairs into `TIMINGS`, set `AUDIO_SRC` (relative file, or base64 `data:audio/mpeg;base64,...` under about 10 MB for a published page). Audio is then the master clock; `beat()` takes its windows from `TIMINGS` and the page reports drawings that overrun their audio (`__overrun`, QA lists them). Fix by cutting drawn items or adding words.
6. **Nothing at all:** the page still ships with Mode A (browser voice) plus captions.

```python
#!/usr/bin/env python3
"""make_audio.py beats.json OUT_DIR [--engine auto|supabein|edge|piper|espeak|none] [--voice V] [--rate +0%] [--gap 0.5] [--lead 0.5] [--split recording.mp3]

beats.json: qa.js output [{start,end,text}] or a plain list of strings.
Per-beat clips are looked up as OUT_DIR/b00.mp3 (.wav .m4a .ogg), so user recordings and any TTS output work.
Cascade for missing clips: supabein (only if env SUPABEIN_TOKEN is set) -> edge-tts -> piper (needs PIPER_MODEL=/path/model.onnx) -> espeak-ng (robotic, draft only).
Nothing available (usual in the sandbox: no network): writes narration_script.txt + narration.srt to paste into any
external TTS, exits 3. --split: ONE long recording -> beat windows by silence detection (approximate).
Success: narration.mp3 + timings.json ([{start,end,text}] -> paste into TIMINGS, set AUDIO_SRC)."""
import json, os, re, shutil, subprocess, sys, base64, urllib.request, urllib.parse
BR = os.environ.get("AUDIO_BITRATE", "96k")   # use 64k for narrations over 5 minutes

def sh(cmd, **k): return subprocess.run(cmd, capture_output=True, text=True, **k)
def dur(p): return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout)
def srt_t(t):
    ms = int(round(t * 1000)); return f"{ms//3600000:02d}:{ms%3600000//60000:02d}:{ms%60000//1000:02d},{ms%1000:03d}"
def find(d, i):
    for e in (".mp3", ".wav", ".m4a", ".ogg"):
        p = os.path.join(d, f"b{i:02d}{e}")
        if os.path.exists(p): return p

def speak(text):
    """Respell for the voice only (captions keep the original text): Apprelab.com -> Apprelab dot com."""
    return re.sub(r"\b([A-Za-z0-9-]+)\.(com|org|net|io|ng)\b", r"\1 dot \2", text)

def supabein(text, path):
    """GET <SUPABEIN_URL>?token=...&text=... ; token comes ONLY from env SUPABEIN_TOKEN and is masked in messages."""
    tok = os.environ.get("SUPABEIN_TOKEN")
    if not tok: return False
    base = os.environ.get("SUPABEIN_URL", "https://supabein.dxinnovationhub.com/tts/speak")
    if len(text) > 1500: print("WARNING: beat is", len(text), "characters; split it into shorter beats")
    url = base + "?" + urllib.parse.urlencode({"token": tok, "text": speak(text)})
    mask = lambda m: str(m).replace(tok, "***").replace(urllib.parse.quote(tok), "***")[:200]
    def get(u):
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "whiteboard-skill"}), timeout=90) as r:
            return r.read(), (r.headers.get("Content-Type") or "").lower()
    for attempt in (1, 2):
        try:
            data, ct = get(url)
            if "json" in ct or data[:1] in (b"{", b"["):
                j = json.loads(data); j = j[0] if isinstance(j, list) and j else j
                b64 = next((j[k] for k in ("audio_base64", "audio", "base64", "data") if isinstance(j, dict) and isinstance(j.get(k), str) and len(j[k]) > 200), None)
                link = next((j[k] for k in ("audio_url", "url", "file") if isinstance(j, dict) and isinstance(j.get(k), str) and j[k].startswith("http")), None)
                if b64: data = base64.b64decode(b64.split(",")[-1])
                elif link: data, _ = get(link)
                else: print("supabein: unexpected JSON keys:", mask(list(j)[:8] if isinstance(j, dict) else type(j))); return False
            raw = path + ".raw"; open(raw, "wb").write(data)
            ok = sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).returncode == 0 and len(data) > 500
            if ok: ok = sh(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", BR, path]).returncode == 0
            os.remove(raw)
            if ok and os.path.getsize(path) > 500: return True
            print("supabein: reply was not playable audio. First bytes:", mask(data[:200]))
        except Exception as e:
            print("supabein error (try %d):" % attempt, type(e).__name__, mask(e))
    return False

def synth(engine, text, voice, rate, path):
    if engine == "supabein": return supabein(text, path)
    if engine == "edge":
        exe = [shutil.which("edge-tts")] if shutil.which("edge-tts") else [sys.executable, "-m", "edge_tts"]
        r = sh(exe + ["--voice", voice, "--rate", rate, "--text", text, "--write-media", path], timeout=90)
    elif engine == "piper":
        m = os.environ.get("PIPER_MODEL")
        if not (shutil.which("piper") and m): return False
        r = subprocess.run(["piper", "--model", m, "--output_file", path], input=text, capture_output=True, text=True, timeout=90)
    elif engine == "espeak":
        if not shutil.which("espeak-ng"): return False
        r = sh(["espeak-ng", "-v", "en", "-s", "150", "-w", path, text])
    else: return False
    return r.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 500

def script_files(d, beats, texts):
    est, t = [], 0.0
    for i, x in enumerate(texts):
        s, e = (beats[i]["start"], beats[i]["end"]) if isinstance(beats[i], dict) and "start" in beats[i] else (t, t + len(x.split()) / 2.4 * 1.15 + 0.8)
        est.append((s, e, x)); t = e + 0.4
    with open(os.path.join(d, "narration.srt"), "w") as f:
        for i, (s, e, x) in enumerate(est): f.write(f"{i+1}\n{srt_t(s)} --> {srt_t(e)}\n{x}\n\n")
    with open(os.path.join(d, "narration_script.txt"), "w") as f:
        for i, (s, e, x) in enumerate(est):
            f.write(f"[BEAT {i+1:02d}  {int(s//60)}:{s%60:04.1f} - {int(e//60)}:{e%60:04.1f}]\n" + "\n".join(re.findall(r"[^.!?]+[.!?]*", x)) + "\n\n")

def stitch(d, files, texts, gap, lead):
    parts, timings, t = [], [], 0.0
    sil = lambda s, p: sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", str(s), "-sample_fmt", "s16", p])
    sil(lead, os.path.join(d, "_lead.wav")); sil(gap, os.path.join(d, "_gap.wav"))
    for i, (f, x) in enumerate(zip(files, texts)):
        w = os.path.join(d, f"_n{i:02d}.wav"); sh(["ffmpeg", "-y", "-loglevel", "error", "-i", f, "-ar", "44100", "-ac", "1", "-sample_fmt", "s16", w])
        sp = dur(w); timings.append({"start": round(t, 3), "end": round(t + lead + sp + gap, 3), "text": x}); parts.append(w); t += lead + sp + gap
    ab = lambda p: os.path.abspath(p)
    with open(os.path.join(d, "_list.txt"), "w") as L:
        for w in parts: L.write(f"file '{ab(os.path.join(d, '_lead.wav'))}'\nfile '{ab(w)}'\nfile '{ab(os.path.join(d, '_gap.wav'))}'\n")
    sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(d, "_list.txt"), "-c:a", "libmp3lame", "-b:a", BR, os.path.join(d, "narration.mp3")])
    return timings, t

def split_recording(d, src, texts, gap):
    total = dur(src); r = sh(["ffmpeg", "-i", src, "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"])
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]; en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    gaps = [(b - a, (a + b) / 2) for a, b in zip(st, en) if a > .3 and b < total - .3]; need = len(texts) - 1
    if len(gaps) >= need: cuts = sorted(m for _, m in sorted(gaps, reverse=True)[:need])
    else:
        print(f"WARNING: found {len(gaps)} pauses for {need} beat gaps; falling back to word-count proportions (approximate)")
        w = [len(x.split()) for x in texts]; cuts, acc = [], 0
        for k in w[:-1]: acc += k; cuts.append(total * acc / sum(w))
    edges = [0.0] + cuts + [total + gap]
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-c:a", "libmp3lame", "-b:a", BR, os.path.join(d, "narration.mp3")])
    return [{"start": round(edges[i], 3), "end": round(edges[i + 1], 3), "text": x} for i, x in enumerate(texts)]

def main():
    a = sys.argv[1:]; opt = lambda k, df=None: a[a.index("--" + k) + 1] if "--" + k in a else df
    beats = json.load(open(a[0])); d = a[1]; os.makedirs(d, exist_ok=True)
    texts = [b["text"] if isinstance(b, dict) else b for b in beats]
    eng, voice, rate, gap, lead = opt("engine", "auto"), opt("voice", "en-US-AriaNeural"), opt("rate", "+0%"), float(opt("gap", .5)), float(opt("lead", .5))
    if opt("split"):
        timings = split_recording(d, opt("split"), texts, gap)
    else:
        files = [find(d, i) for i in range(len(texts))]
        if not all(files):
            order = ((["supabein"] if os.environ.get("SUPABEIN_TOKEN") else []) + ["edge", "piper", "espeak"]) if eng == "auto" else [eng]
            for e in order:
                made = []
                for i, x in enumerate(texts):
                    if files[i]: continue
                    p = os.path.join(d, f"b{i:02d}.{'mp3' if e in ('edge', 'supabein') else 'wav'}")
                    if synth(e, x, voice, rate, p): made.append((i, p))
                    else: break
                else:
                    for i, p in made: files[i] = p
                    print("audio engine:", e, "(espeak is robotic: use for timing drafts only)" if e == "espeak" else ""); break
                for i, p in made:
                    if os.path.exists(p): os.remove(p)
        if not all(files):
            script_files(d, beats, texts)
            print("NO AUDIO ENGINE AVAILABLE. Wrote narration_script.txt and narration.srt in", d)
            print("Paste the script into an external TTS, then either save one clip per beat as b00.mp3, b01.mp3 ... in", d, "and re-run, or re-run with --split recording.mp3")
            sys.exit(3)
        timings, _ = stitch(d, files, texts, gap, lead)
    json.dump(timings, open(os.path.join(d, "timings.json"), "w"), indent=1)
    print("wrote narration.mp3 + timings.json:", len(timings), "beats,", round(timings[-1]["end"], 1), "s")

if __name__ == "__main__": main()
```

Asset helper:

```python
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
```

## 8. Tooling

`qa.js` (screenshots mid and end of every beat, layout and density report, `beats.json`; exit 1 on issues) and `export.js` (frame-exact MP4, parallel workers, optional real audio or burned-in captions). Both need Node + Playwright, Python + Pillow, ffmpeg. If `qa.js` fails with `No module named 'PIL'`, run `pip install pillow --break-system-packages` and rerun. If `require('playwright')` fails, set `NODE_PATH=$(npm root -g)`.

### 8.1 Video export: capability check, speed, fallback

**Check before promising a video** (all must pass, else fall back to HTML and name the missing piece):

```bash
which ffmpeg ffprobe node && NODE_PATH=$(npm root -g) node -e "require('playwright').chromium.launch().then(b=>{console.log('chromium ok');return b.close()})"
```

**Speed.** The template keeps frames cheap: each reveal mask covers only its item, and items that are not drawn yet or already erased are `display:none`. Together these cut a frame from about 780 ms to about 190 ms (68 ms with `--fast`) in a 4-core container without a GPU. Keep both if you edit the engine. The `boil` filter is the largest remaining cost. `export.js` uses CDP `captureScreenshot` (about 2x faster than element screenshots) and splits frames across up to 4 browsers. Measured with the fast template on 4 CPU cores: a 68-second video (1,621 frames, 24 fps, 1280x720) took 316 s at full quality, about 4.7 minutes per minute of video; `--fast` is roughly 2 to 3 times quicker again. Always run it in the background and wait for completion; never block on a foreground timeout. Test a 2-second slice first (`--from 28 --to 30`) and extract a frame with `ffmpeg -ss 1 -i test.mp4 -frames:v 1 f.png` to check font, framing and hand before the full run.

**Options.** `--fast` freezes the line wobble (the `boil` filter) and uses 2 browsers: measured 1.8x faster, and it looks almost the same (use it for drafts, long videos and laptops without a fan). `--width 1920` for 1080p (about 2x slower); `--fps 20` to save time; `--query "?fmt=vertical"` for 9:16 (720x1280 by default); `--captions srt` burns the beat captions in (use when there is no real audio, or for social video that autoplays muted).

### 8.2 Render on the user's Mac (optional worker, preferred when it is online)

If the repo has a `render-worker/` folder, the user may run its worker on their Mac (see `render-worker/README.md`). It is much faster than the sandbox. Try it first:

1. `render-worker/submit.sh <name> page.html audio/narration.mp3 24 1280` (a new, unique `<name>` each time; the page must already have the font embedded).
2. Run `render-worker/wait.sh <name>` in the background (`run_in_background: true`); never block on it in the foreground.
3. Exit 0: the MP4 is at `render-jobs/<name>/out.mp4`; check one frame, then deliver it. Exit 2 (no worker claimed it in 3 minutes): say so in one line and render in the sandbox with `export.js` as above. Exit 3: show the error lines, fix the page, post a new job. Exit 4: tell the user the Mac claimed the job but did not finish.

The worker pushes to the branch the job was posted on, so pull before the next commit.

**Report** duration, resolution, size and audio stream from `ffprobe` only after the export ran. The MP4 can be large for an artifact; send it as a file and publish the HTML.

```js
// usage: node qa.js page.html [outDir] ["?fmt=vertical&theme=chalk"]
// -> outDir/contact_sheet.png, report.json, beats.json (start,end,text per beat). Exit 1 on issues.
const {chromium}=require('playwright'),{execSync}=require('child_process'),fs=require('fs'),path=require('path');
const [,,file,out='qa',qs='']=process.argv;
(async()=>{fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch(),vert=qs.includes('vertical'),p=await b.newPage({viewport:vert?{width:520,height:1000}:{width:1100,height:700}}),errs=[];
 p.on('pageerror',e=>errs.push(e.message));
 p.on('console',m=>{const x=m.text();if(m.type()==='error'&&!/Failed to load resource/.test(x))errs.push(x);if(m.type()==='warning'&&/crowded|missing asset|overrun/.test(x))errs.push('warn: '+x)});
 await p.goto('file://'+path.resolve(file)+qs);await p.waitForTimeout(1500);
 const beats=await p.evaluate(()=>window.__beats()),D=await p.evaluate(()=>window.__duration),over=await p.evaluate(()=>window.__overrun||[]);
 const rep={duration:+D.toFixed(1),beats:beats.length,errors:errs,overrun:over,issues:[]},shots=[];
 for(const [i,x] of beats.entries()){
  for(const [tag,t] of [['mid',x.start+(x.end-x.start)*.45],['end',x.end-.35]]){
   await p.evaluate(v=>window.__seek(v),t);await p.waitForTimeout(80);
   const f=`${out}/b${String(i).padStart(2,'0')}_${tag}.png`;await p.locator('#stage').screenshot({path:f});shots.push(f);
   if(tag==='end'){const w=await p.evaluate(v=>window.__layoutAt(v),t);w.forEach(m=>rep.issues.push({beat:i,t:+t.toFixed(1),issue:m}))}}
  const words=x.text.trim().split(/\s+/).length,win=x.end-x.start;
  if(words/win>2.9)rep.issues.push({beat:i,issue:`narration too dense: ${(words/win).toFixed(1)} words/s`});
  if(win>words/2.4*2.2+6)rep.issues.push({beat:i,issue:`long dead air: ${win.toFixed(0)}s window for ${words} words`})}
 over.forEach(m=>rep.issues.push({issue:m}));
 fs.writeFileSync(out+'/report.json',JSON.stringify(rep,null,1));
 fs.writeFileSync(out+'/beats.json',JSON.stringify(beats.map(x=>({start:+x.start.toFixed(2),end:+x.end.toFixed(2),text:x.text})),null,1));await b.close();
 const py=`from PIL import Image;import sys
f=sys.argv[2:];ims=[Image.open(x) for x in f];h=300;ims=[i.resize((int(i.width*h/i.height),h)) for i in ims]
c=min(4,len(ims));r=-(-len(ims)//c);w=max(i.width for i in ims);s=Image.new('RGB',((w+8)*c,(h+8)*r),'#888')
for k,i in enumerate(ims):s.paste(i,((k%c)*(w+8),(k//c)*(h+8)))
s.save(sys.argv[1])`;fs.writeFileSync('/tmp/sheet.py',py);execSync(`python3 /tmp/sheet.py ${out}/contact_sheet.png ${shots.join(' ')}`);
 console.log(JSON.stringify(rep,null,1));process.exit(rep.issues.length||errs.length?1:0)})();
```

```js
// usage: node export.js page.html out.mp4 [--fast] [--fps 24] [--from 0] [--to END] [--audio narration.mp3] [--query "?fmt=vertical"] [--workers 4] [--width 1280] [--captions srt]
// Frame-exact MP4 of the stage (controls hidden). Frames are split across parallel browsers and grabbed with
// CDP captureScreenshot (about 0.5-0.8 s per frame per worker without a GPU). Audio must be a real file (Mode B).
// No audio: pass --captions srt to burn the beat captions in (a silent video is still readable).
const {chromium}=require('playwright'),{execSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
// ffmpeg: $FFMPEG if set, else the ffmpeg-static npm package (no Homebrew needed), else ffmpeg on PATH.
const FF=process.env.FFMPEG||(()=>{try{return require('ffmpeg-static')||'ffmpeg'}catch(e){return 'ffmpeg'}})();
const a=process.argv.slice(2),file=a[0],out=a[1],opt=k=>{const i=a.indexOf('--'+k);return i>0?a[i+1]:null};
const fps=+(opt('fps')||24),qs=opt('query')||'',audio=opt('audio'),vert=qs.includes('vertical'),caps=opt('captions');
const FAST=a.includes('--fast');   // --fast: freeze the line wobble (boil filter), the most expensive part of each frame
const OW=+(opt('width')||(vert?720:1280)),OH=Math.round(OW*(vert?16/9:9/16)),NW=+(opt('workers')||Math.max(1,Math.min(FAST?2:4,os.cpus().length)));
async function openPage(b){const p=await b.newPage({viewport:{width:OW,height:OH}});await p.goto('file://'+path.resolve(file)+qs);await p.waitForTimeout(1500);
 await p.evaluate(([w,h])=>{document.querySelectorAll('.bar,#cap,#vstat,details').forEach(e=>e.style.display='none');document.querySelector('.wrap').style.cssText='max-width:none;margin:0;padding:0';
  Object.assign(document.getElementById('stage').style,{width:w+'px',height:h+'px',borderRadius:'0',boxShadow:'none'});document.body.style.margin='0'},[OW,OH]);
 if(FAST)await p.evaluate(()=>{const w=document.getElementById('world');if(w)w.removeAttribute('filter')});return p}
(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 const p0=await openPage(b),D=await p0.evaluate(()=>window.__duration),beats=await p0.evaluate(()=>window.__beats()),t0=+(opt('from')||0),t1=+(opt('to')||D),n=Math.round((t1-t0)*fps);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'frames_'));let done=0,last=Date.now();
 const pages=[p0];for(let k=1;k<NW;k++)pages.push(await openPage(b));
 await Promise.all(pages.map(async(p,k)=>{const cdp=await p.context().newCDPSession(p);
  for(let f=k;f<n;f+=NW){await p.evaluate(t=>window.__seek(t),t0+f/fps);
   const r=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:90,optimizeForSpeed:true,clip:{x:0,y:0,width:OW,height:OH,scale:1}});
   fs.writeFileSync(`${dir}/${String(f).padStart(6,'0')}.jpg`,Buffer.from(r.data,'base64'));done++;
   if(Date.now()-last>15000){last=Date.now();console.log(`frames ${done}/${n}`)}}}));
 await b.close();
 let vf='scale=trunc(iw/2)*2:trunc(ih/2)*2';
 if(caps){const T=s=>{const ms=Math.max(0,Math.round((s-t0)*1000));return`${String(ms/3600000|0).padStart(2,'0')}:${String(ms/60000%60|0).padStart(2,'0')}:${String(ms/1000%60|0).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`};
  const srt=beats.map((x,i)=>`${i+1}\n${T(x.start)} --> ${T(x.end)}\n${x.text}\n`).join('\n');fs.writeFileSync(dir+'/caps.srt',srt);vf+=`,subtitles=${dir}/caps.srt:force_style='FontSize=18,MarginV=24'`}
 const au=audio?`-ss ${t0} -t ${t1-t0} -i ${audio} -af apad -c:a aac -b:a 128k`:'';
 execSync(`"${FF}" -y -loglevel error -framerate ${fps} -i ${dir}/%06d.jpg ${au} -vf "${vf}" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart -t ${(n/fps).toFixed(3)} ${out}`);
 fs.rmSync(dir,{recursive:true});console.log('wrote',out,n,'frames @',fps,'fps',OW+'x'+OH)})();
```

Narrated MP4: build with `AUDIO_SRC`/`TIMINGS`, then `node export.js page.html out.mp4 --fps 24 --audio audio/narration.mp3`. Browser speech cannot be recorded, so a narrated MP4 needs real audio. Report size and duration from `ffprobe` only after it ran.

## 9. Self-critique checklist

| Check | Pass |
|---|---|
| Story | End-state sentence exists; hook, turn and action present; narration read aloud; 22–35 words per beat |
| Pen | Tip on the ink for strokes, shapes, pictures; text pen follows the baseline |
| Mix | Organized beats where there is structure, loose beats where there is story; no two beats laid out the same way |
| Assets | Logo or wordmark shown; pictures framed and labeled; each under budget; styles consistent |
| Characters | Named, 1–2 only, pose and face match the sentence |
| Collisions | `qa.js` clean; contact sheet viewed |
| Rhythm | Quick, quick, slow; pause after each key reveal; no camera during strokes; ends wide |
| Color | At most 4 accents with fixed meaning; color never the only signal |
| Scrub/replay | Any scrub position correct; replay restores a clean board |
| Dead voice | Silent engine never freezes the pen; status line explains |
| Reduced motion | Final frame first, no autoplay |
| Fonts | Caveat actually renders; accented letters checked in a frame |
| Console | No errors; no remote resources except Google Fonts and the allowed script hosts |
| Audio first | Clips generated before drawing; `TIMINGS` from real durations; `__overrun` empty |
| Token | Not in any file, the HTML, a log or the reply; env variable only |
| Video | Capability check run; slice test frame viewed; MP4 exported with real audio (or silent + captions, stated); `ffprobe` numbers reported; on failure the HTML is delivered and the blocker named |
| Honesty | Reply says what exists (HTML, MP4, audio) and what does not |

## 10. Common failures

| Symptom | Fix |
|---|---|
| Text mask clips letters | Measure after `document.fonts.load` + `ready`; `write()` already pads and sweeps densely |
| Picture blank | Asset not decoded or bad data URI; check `console.warn('missing asset')`; keep file small |
| Hand floats off the line | A transform on a drawn path; author in world coordinates (rotate points, not nodes) |
| Looks robotic | Use `rough()` shapes, tilt text ±3°, vary sizes, add marks |
| Looks messy | More than 2 text blocks per band, no anchor, or more than 3 marks; cut |
| Scrub breaks after erase | Never mutate the DOM at runtime; visibility is a function of `t` |
| Silent voice | Test voice button, volume, silent switch, open outside in-app previews |
| Drawing outruns audio | Cut items, shorten labels, or add words; check `__overrun` |
| Video stops before the last drawing finishes | Audio ended first and cut the video; `export.js` pads the audio with silence (`apad`) and sets the output length to the frame count (`-t`), which also works with ffmpeg 7 |
| MP4 text is a serif font | Font not embedded; run `embed_font.py` (section 6.1) and re-export |
| No Mac worker answers | It is offline or not installed; `wait.sh` exits 2 after 3 minutes, then render in the sandbox |
| Export takes forever / times out | Element screenshots and a single browser; use the v4 `export.js` (CDP + workers) in the background |

## 11. Known limits (state them when relevant)

- Browser voices were tested headless with no voices installed (watchdog, captions, pen never freezing); real device voices were not.
- Recorded-audio mode was tested with synthetic audio (clock, timings, overrun report), not a real voice or Edge TTS output; `edge-tts` and `piper` paths follow their documented commands but could not run here (no network or install).
- `--split` was tested on a synthetic recording with clear pauses; real speech with uneven pauses may need per-beat clips.
- Chalk, kraft and blueprint are color swaps only. Vertical mode renders; scenes must be laid out with fractions of `W` and `H`.
- The Supabein path was tested against a local mock server (audio reply and JSON reply), not the live service: its real response format, voices, rate limits and maximum text length are unconfirmed. Verify with one beat first.
- Pacing and hand look were judged from screenshots and timing math, not from watching full playback.
- Video export was measured in a 4-core container with no GPU: about 0.75 s per frame per worker with the boil filter. GPU or more cores change this a lot.

## 12. Reply format when delivering

One line on what was built (MP4 duration, resolution and size from `ffprobe`, plus the HTML link); a small table of beats with timings; control hints for the HTML; assumptions in one line; the voice used (Supabein, Edge, browser) and what was not made. If the video could not be exported, say so first, name the blocker, and give the HTML plus the one `export.js` command to run locally. Never print the token. If no audio engine ran, include the SRT block for copy-paste.
