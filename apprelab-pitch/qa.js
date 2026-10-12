// usage: node qa.js page.html [outDir] ["?fmt=vertical&theme=chalk"]
// -> outDir/contact_sheet.png, report.json, beats.json (start,end,text per beat). Exit 1 on issues.
// Needs: node + playwright (NODE_PATH=$(npm root -g)), python3 + Pillow (pip install pillow).
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
s.save(sys.argv[1])`;const sheet=path.join(out,'_sheet.py');fs.writeFileSync(sheet,py);
 let ok=false;for(const pyx of [process.env.PYTHON,'python3'].filter(Boolean)){try{execSync(`${pyx} ${sheet} ${out}/contact_sheet.png ${shots.join(' ')}`,{stdio:'pipe'});ok=true;break}catch(e){}}fs.rmSync(sheet);
 if(!ok)console.log('NOTE: no contact sheet (Pillow missing: run pip install pillow, or set PYTHON=/path/to/python with Pillow). The per-beat PNGs are in '+out);
 console.log(JSON.stringify(rep,null,1));process.exit(rep.issues.length||errs.length?1:0)})();
