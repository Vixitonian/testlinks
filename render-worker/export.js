// usage: node export.js page.html out.mp4 [--fps 24] [--from 0] [--to END] [--audio narration.mp3] [--query "?fmt=vertical"] [--workers 4] [--width 1280] [--captions srt]
// Frame-exact MP4 of the stage (controls hidden). Frames are split across parallel browsers and grabbed with
// CDP captureScreenshot (about 0.5-0.8 s per frame per worker without a GPU). Audio must be a real file (Mode B).
// No audio: pass --captions srt to burn the beat captions in (a silent video is still readable).
const {chromium}=require('playwright'),{execSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
// ffmpeg: $FFMPEG if set, else the ffmpeg-static npm package (no Homebrew needed), else ffmpeg on PATH.
const FF=process.env.FFMPEG||(()=>{try{return require('ffmpeg-static')||'ffmpeg'}catch(e){return 'ffmpeg'}})();
const a=process.argv.slice(2),file=a[0],out=a[1],opt=k=>{const i=a.indexOf('--'+k);return i>0?a[i+1]:null};
const fps=+(opt('fps')||24),qs=opt('query')||'',audio=opt('audio'),vert=qs.includes('vertical'),caps=opt('captions');
const OW=+(opt('width')||(vert?720:1280)),OH=Math.round(OW*(vert?16/9:9/16)),NW=+(opt('workers')||Math.max(1,Math.min(4,os.cpus().length)));
async function openPage(b){const p=await b.newPage({viewport:{width:OW,height:OH}});await p.goto('file://'+path.resolve(file)+qs);await p.waitForTimeout(1500);
 await p.evaluate(([w,h])=>{document.querySelectorAll('.bar,#cap,#vstat,details').forEach(e=>e.style.display='none');document.querySelector('.wrap').style.cssText='max-width:none;margin:0;padding:0';
  Object.assign(document.getElementById('stage').style,{width:w+'px',height:h+'px',borderRadius:'0',boxShadow:'none'});document.body.style.margin='0'},[OW,OH]);return p}
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
