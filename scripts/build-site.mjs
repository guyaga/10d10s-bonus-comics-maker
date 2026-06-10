// Comics Maker — optional: export the assembled comic as a self-contained
// interactive web reader (single HTML file, images embedded as data URIs).
// Real two-page book (StPageFlip, bundled): the cover stands alone, then facing
// pages turn with a soft bend + shadow. Drag a corner / arrows / click / swipe / dots.
//
// Usage: node build-site.mjs [projectDir]
// Config: reads `title`, `lettering.accent`/`boxFill`, optional site:{ctaUrl,ctaText}

import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(process.argv.slice(2).filter((a) => !a.startsWith("--"))[0] || process.cwd());
const configPath = path.join(projectDir, "comic.config.mjs");
const config = fs.existsSync(configPath) ? (await import(pathToFileURL(configPath).href)).default : {};
const BASE = config.base ? path.resolve(config.base) : projectDir;
const ASSEMBLED = path.join(BASE, "Assembled");

const files = fs.existsSync(ASSEMBLED) ? fs.readdirSync(ASSEMBLED).filter((f) => f.endsWith(".png")).sort() : [];
if (!files.length) { console.error(`No assembled pages in ${ASSEMBLED}. Run assemble.mjs first.`); process.exit(1); }

const accent = config.lettering?.accent || "#E63B2E";
const cream = config.lettering?.boxFill || "#F5F3EE";
const title = config.title || "Comic";
const site = config.site || {};
const ctaUrl = site.ctaUrl || "";
const ctaText = site.ctaText || "";
const ctaWhen = site.when || "";
const [brandMain, brandSub] = title.includes(" - ") ? title.split(" - ") : [title, ""];
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

const vJs = path.join(here, "..", "assets", "vendor", "page-flip.browser.js");
const vCss = path.join(here, "..", "assets", "vendor", "page-flip.css");
const flipJs = fs.existsSync(vJs) ? fs.readFileSync(vJs, "utf8") : null;
const flipCss = fs.existsSync(vCss) ? fs.readFileSync(vCss, "utf8") : "";
const CDN = "https://cdn.jsdelivr.net/npm/page-flip@2.0.7";

console.log(`Embedding ${files.length} pages...`);
const meta0 = await sharp(path.join(ASSEMBLED, files[0])).metadata();
const AR = +(meta0.width / meta0.height).toFixed(4);
// a dark blank page (so the cover-back / open-book empty side is dark, not white)
const blank = "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta0.width}" height="${meta0.height}"><rect width="100%" height="100%" fill="#0b0b0c"/></svg>`).toString("base64");
const images = [];
for (let i = 0; i < files.length; i++) {
  let pipe = sharp(path.join(ASSEMBLED, files[i]));
  // On the last page, dark-mask the lower CTA strip for the web build so the crisp,
  // clickable HTML call-to-action replaces the baked-in one (the PDF keeps the baked CTA).
  if (i === files.length - 1 && ctaUrl) {
    const m = await sharp(path.join(ASSEMBLED, files[i])).metadata();
    const top = Math.round(m.height * 0.7), bh = m.height - top;
    const mask = Buffer.from(`<svg width="${m.width}" height="${bh}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0c" stop-opacity="0"/><stop offset="0.18" stop-color="#0b0b0c" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
    pipe = pipe.composite([{ input: mask, top, left: 0 }]);
  }
  const buf = await pipe.resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  images.push("data:image/jpeg;base64," + buf.toString("base64"));
}

// optional per-page narration: Audio/page_0N.mp3 (e.g. from ElevenLabs)
const audioDir = path.join(BASE, "Audio");
let hasAudio = false;
const audios = files.map((_, i) => {
  const ap = path.join(audioDir, `page_${String(i + 1).padStart(2, "0")}.mp3`);
  if (fs.existsSync(ap)) { hasAudio = true; return "data:audio/mpeg;base64," + fs.readFileSync(ap).toString("base64"); }
  return null;
});
if (hasAudio) console.log(`Embedding narration for ${audios.filter(Boolean).length} pages...`);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ctaHeader = ctaUrl ? `<a class="cta" href="${esc(ctaUrl)}" target="_blank" rel="noopener">${esc(ctaText || "Open")}</a>` : "";
const readBtnTag = hasAudio ? `<button id="readbtn" class="readbtn" aria-label="Read aloud"><span class="ic">&#9658;</span>Read</button>` : "";
const ctaShort = ctaUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
const endCta = ctaUrl
  ? `<div id="endcta" class="endcta">
      <a class="endbtn" href="${esc(ctaUrl)}" target="_blank" rel="noopener">${esc(ctaText || "Join")} &rarr;</a>
      <div class="endmeta">${ctaWhen ? `<span>${esc(ctaWhen)}</span>` : ""}<a href="${esc(ctaUrl)}" target="_blank" rel="noopener">${esc(ctaShort)}</a></div>
    </div>`
  : "";
const flipCssTag = flipCss ? `<style>${flipCss}</style>` : `<link rel="stylesheet" href="${CDN}/src/Style/stPageFlip.css">`;
const FLIPJS = "@@FLIP_ENGINE@@";
const flipJsTag = flipJs ? `<script>${FLIPJS}</script>` : `<script src="${CDN}/dist/js/page-flip.browser.js"></script>`;

let html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
${flipCssTag}
<style>
:root{--accent:${accent};--cream:${cream};--bg:#0b0b0c;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--cream);font-family:"Space Grotesk",system-ui,sans-serif;overflow:hidden}
#bg{position:fixed;inset:0;z-index:0;opacity:.6}
.reader{position:relative;z-index:1;display:flex;flex-direction:column;height:100dvh}
.prog{position:fixed;top:0;left:0;height:3px;background:var(--accent);width:0;z-index:5;transition:width .5s ease;box-shadow:0 0 12px var(--accent)}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.06em;font-size:14px;text-transform:uppercase}
.brand .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent)}
.brand .sub{color:var(--accent)}
.right{display:flex;align-items:center;gap:16px}
#counter{font-family:"Space Mono",monospace;font-size:13px;color:#b9b6b0;letter-spacing:.08em}
.readbtn{font-family:"Space Grotesk",sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--cream);background:rgba(20,20,22,.6);border:1px solid rgba(245,243,238,.2);padding:8px 13px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:7px;transition:.2s}
.readbtn:hover{border-color:var(--accent);color:var(--accent)}
.readbtn.on{background:var(--accent);border-color:var(--accent);color:#fff}
.readbtn .ic{font-size:10px;line-height:1}
.cta{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:var(--accent);padding:9px 14px;border-radius:6px;text-decoration:none;white-space:nowrap}
.cta:hover{filter:brightness(1.08)}
.stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 8px}
#book{filter:drop-shadow(0 24px 60px rgba(0,0,0,.6)) drop-shadow(0 0 46px rgba(230,59,46,.12))}
#book img{width:100%;height:100%;display:block}
.stf__item{background:var(--bg)}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:1px solid rgba(245,243,238,.18);background:rgba(20,20,22,.55);color:var(--cream);font-size:24px;cursor:pointer;backdrop-filter:blur(6px);z-index:9;display:flex;align-items:center;justify-content:center;transition:.2s}
.nav:hover{border-color:var(--accent);color:var(--accent)}
.nav:disabled{opacity:.25;cursor:default}
.nav.prev{left:12px}.nav.next{right:12px}
footer{display:flex;justify-content:center;align-items:center;gap:18px;padding:14px}
#dots{display:flex;gap:9px}
.dot{width:9px;height:9px;border-radius:50%;border:0;background:rgba(245,243,238,.22);cursor:pointer;padding:0;transition:.2s}
.dot.on{background:var(--accent);box-shadow:0 0 8px var(--accent);transform:scale(1.25)}
.hint{position:fixed;bottom:14px;right:18px;font-family:"Space Mono",monospace;font-size:11px;color:#6c6a66;letter-spacing:.06em}
.endcta{position:fixed;left:50%;bottom:50px;transform:translate(-50%,14px);opacity:0;pointer-events:none;transition:.45s cubic-bezier(.2,.7,.2,1);z-index:8;text-align:center;background:rgba(11,11,12,.78);backdrop-filter:blur(8px);border:1px solid rgba(230,59,46,.45);border-radius:14px;padding:14px 20px 12px}
.endcta.show{opacity:1;pointer-events:auto;transform:translate(-50%,0)}
.endbtn{display:inline-block;font-weight:700;text-transform:uppercase;letter-spacing:.07em;font-size:14px;color:#fff;background:var(--accent);padding:13px 24px;border-radius:9px;text-decoration:none;box-shadow:0 12px 30px rgba(230,59,46,.4)}
.endbtn:hover{filter:brightness(1.08)}
.endmeta{margin-top:11px;font-family:"Space Mono",monospace;font-size:12px;color:#cfccc6;display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap;letter-spacing:.04em}
.endmeta a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(230,59,46,.5)}
@media(max-width:680px){.brand{font-size:12px}.nav{display:none}.cta{padding:8px 11px}.endcta{bottom:42px}}
</style>
</head>
<body>
<canvas id="bg"></canvas>
<div class="prog" id="prog"></div>
<div class="reader">
  <header>
    <div class="brand"><span class="dot"></span><span>${esc(brandMain)}</span>${brandSub ? `<span class="sub">${esc(brandSub)}</span>` : ""}</div>
    <div class="right">${readBtnTag}<span id="counter">01 / 01</span>${ctaHeader}</div>
  </header>
  <div class="stage">
    <button class="nav prev" id="prev" aria-label="Previous">&#8249;</button>
    <div id="book"></div>
    <button class="nav next" id="next" aria-label="Next">&#8250;</button>
  </div>
  <footer><div id="dots"></div></footer>
</div>
${endCta}
<audio id="narr" preload="auto"></audio>
<div class="hint">drag a corner &#8226; &#8592; &#8594; &#8226; swipe &#8226; tap dots</div>
${flipJsTag}
<script>
var PAGES=${JSON.stringify(images)};var AUDIO=${JSON.stringify(audios)};var BLANK=${JSON.stringify(blank)};
(function(){
  var c=document.getElementById('bg'),x=c.getContext('2d');
  function rs(){c.width=innerWidth;c.height=innerHeight;}rs();addEventListener('resize',rs);
  var P=[];for(var i=0;i<55;i++){P.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2+.4,s:Math.random()*.35+.08});}
  function tick(){x.clearRect(0,0,c.width,c.height);for(var i=0;i<P.length;i++){var p=P[i];p.y-=p.s;if(p.y<-6){p.y=c.height+6;p.x=Math.random()*c.width;}x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fillStyle='rgba(230,59,46,'+(0.10+p.r*0.07)+')';x.fill();}requestAnimationFrame(tick);}tick();
})();
function startBook(){
  var el=document.getElementById('book'),stage=document.querySelector('.stage'),AR=${AR},pf=null,curIdx=0,N=PAGES.length;
  var counter=document.getElementById('counter'),prog=document.getElementById('prog'),prev=document.getElementById('prev'),next=document.getElementById('next'),dots=document.getElementById('dots'),endcta=document.getElementById('endcta');
  for(var j=0;j<N;j++){(function(k){var b=document.createElement('button');b.className='dot';b.onclick=function(){if(pf)pf.flip(k);};dots.appendChild(b);})(j);}
  function pad(v){return(v<10?'0':'')+v;}
  function ui(idx){var n=(typeof idx==='number'&&!isNaN(idx))?idx:curIdx;n=Math.max(0,Math.min(N-1,n));curIdx=n;var L=n-(n%2),lo=L+1,hi=Math.min(N,L+2);counter.textContent=(lo===hi?pad(lo):pad(lo)+'–'+pad(hi))+' / '+pad(N);prog.style.width=(hi/N*100)+'%';for(var d=0;d<dots.children.length;d++){dots.children[d].className='dot'+((d===L||d===L+1)?' on':'');}prev.disabled=(L<=0);next.disabled=(L>=N-2);if(endcta){if(L>=N-2)endcta.classList.add('show');else endcta.classList.remove('show');}}
  function fit(){var aH=stage.clientHeight-10,aW=stage.clientWidth-132,h=aH,w=h*AR;if(2*w>aW){w=aW/2;h=w/AR;}return{w:Math.max(120,Math.floor(w)),h:Math.max(160,Math.floor(h))};}
  function build(){var s=fit();el.innerHTML='';pf=new St.PageFlip(el,{width:s.w,height:s.h,size:'fixed',minWidth:1,maxWidth:8000,minHeight:1,maxHeight:8000,maxShadowOpacity:0.5,showCover:false,usePortrait:true,drawShadow:true,flippingTime:820,useMouseEvents:true,mobileScrollSupport:false,swipeDistance:30,clickEventForward:true});pf.loadFromImages(PAGES);pf.on('flip',function(e){ui(e.data);});pf.on('init',function(e){ui(e.data);});}
  build();
  // read-along narration
  var narr=document.getElementById('narr'),readbtn=document.getElementById('readbtn'),playing=false,pidx=0;
  function setIcon(p){if(readbtn){readbtn.classList.toggle('on',p);readbtn.querySelector('.ic').innerHTML=p?'&#10073;&#10073;':'&#9658;';}}
  function stopRead(){playing=false;if(narr){narr.pause();}setIcon(false);}
  function stepRead(){if(!playing)return;if(pidx>=N){stopRead();return;}var src=AUDIO[pidx];if(!src){pidx++;stepRead();return;}var fresh=(pidx%2===0);if(fresh&&pf)pf.flip(pidx);setTimeout(function(){if(!playing)return;narr.src=src;var pr=narr.play();if(pr&&pr.catch)pr.catch(function(){stopRead();});},fresh?620:60);}
  if(narr)narr.onended=function(){if(!playing)return;pidx++;setTimeout(stepRead,300);};
  function startRead(){if(!narr)return;playing=true;setIcon(true);pidx=curIdx-(curIdx%2);stepRead();}
  if(readbtn)readbtn.onclick=function(){if(playing)stopRead();else startRead();};
  prev.onclick=function(){stopRead();if(pf)pf.flipPrev();};
  next.onclick=function(){stopRead();if(pf)pf.flipNext();};
  for(var dd=0;dd<dots.children.length;dd++){var ob=dots.children[dd].onclick;dots.children[dd].onclick=(function(o){return function(){stopRead();o();};})(ob);}
  addEventListener('keydown',function(e){if(!pf)return;if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();stopRead();pf.flipNext();}else if(e.key==='ArrowLeft'){stopRead();pf.flipPrev();}});
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){var i=curIdx;try{pf.destroy();}catch(_){ }build();setTimeout(function(){try{pf.turnToPage(i);}catch(_){ }ui(i);},60);},220);});
  ui(0);
}
if(document.readyState==='complete')startBook();else addEventListener('load',startBook);
</script>
</body>
</html>`;

if (flipJs) html = html.replace(FLIPJS, () => flipJs);

const out = path.join(BASE, slug(title) + ".html");
fs.writeFileSync(out, html);
console.log(`\nInteractive reader: ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB, ${files.length} pages)`);
console.log("Two-page book (StPageFlip). Open in a browser or host it anywhere.");
