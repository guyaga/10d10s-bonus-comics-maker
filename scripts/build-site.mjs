// Comics Maker — optional: export the assembled comic as a self-contained
// interactive web reader (single HTML file, images embedded as data URIs).
// Page switching via arrows / click zones / swipe / dots, on-brand styling,
// a subtle animated background, and an end-page CTA.
//
// Usage: node build-site.mjs [projectDir]
// Config: reads `title`, `lettering.accent`/`boxFill`, and an optional
//   site: { ctaUrl, ctaText, subtitle }

import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

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
const subtitle = site.subtitle || "";
const [brandMain, brandSub] = title.includes(" - ") ? title.split(" - ") : [title, ""];
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

console.log(`Embedding ${files.length} pages...`);
const images = [];
for (const f of files) {
  const buf = await sharp(path.join(ASSEMBLED, f)).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  images.push("data:image/jpeg;base64," + buf.toString("base64"));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ctaHeader = ctaUrl ? `<a class="cta" href="${esc(ctaUrl)}" target="_blank" rel="noopener">${esc(ctaText || "Open")}</a>` : "";
// Floating end-of-comic CTA overlay — opt-in (site.endCta:true). Skip it when the
// last page is already a CTA, so it doesn't overlap the artwork.
const endCta = ctaUrl && site.endCta === true
  ? `<div id="endcta" class="endcta"><p>${esc(subtitle)}</p><a class="btn" href="${esc(ctaUrl)}" target="_blank" rel="noopener">${esc(ctaText || "Open")} &rarr;</a></div>`
  : "";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--accent:${accent};--cream:${cream};--bg:#0b0b0c;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--cream);font-family:"Space Grotesk",system-ui,sans-serif;overflow:hidden}
#bg{position:fixed;inset:0;z-index:0;opacity:.6}
.reader{position:relative;z-index:1;display:flex;flex-direction:column;height:100dvh}
.prog{position:fixed;top:0;left:0;height:3px;background:var(--accent);width:0;z-index:5;transition:width .45s ease;box-shadow:0 0 12px var(--accent)}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.06em;font-size:14px;text-transform:uppercase}
.brand .dot{width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent)}
.brand .sub{color:var(--accent)}
.right{display:flex;align-items:center;gap:16px}
#counter{font-family:"Space Mono",monospace;font-size:13px;color:#b9b6b0;letter-spacing:.08em}
.cta{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:var(--accent);padding:9px 14px;border-radius:6px;text-decoration:none;white-space:nowrap}
.cta:hover{filter:brightness(1.08)}
.stage{position:relative;flex:1;min-height:0;margin:0 8px}
.layer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateX(48px) scale(.97);transition:opacity .45s ease,transform .5s cubic-bezier(.2,.7,.2,1);pointer-events:none}
.layer.active{opacity:1;transform:none;pointer-events:auto}
.layer.left{opacity:0;transform:translateX(-48px) scale(.97)}
.layer img{max-height:100%;max-width:100%;border-radius:7px;box-shadow:0 0 0 1px rgba(245,243,238,.08),0 26px 70px rgba(0,0,0,.65),0 0 70px rgba(230,59,46,.16);user-select:none;-webkit-user-drag:none}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;border:1px solid rgba(245,243,238,.18);background:rgba(20,20,22,.55);color:var(--cream);font-size:24px;line-height:1;cursor:pointer;backdrop-filter:blur(6px);z-index:4;display:flex;align-items:center;justify-content:center;transition:.2s}
.nav:hover{border-color:var(--accent);color:var(--accent)}
.nav:disabled{opacity:.25;cursor:default}
.nav.prev{left:10px}.nav.next{right:10px}
footer{display:flex;justify-content:center;align-items:center;gap:18px;padding:14px}
#dots{display:flex;gap:9px}
.dot{width:9px;height:9px;border-radius:50%;border:0;background:rgba(245,243,238,.22);cursor:pointer;padding:0;transition:.2s}
.dot.on{background:var(--accent);box-shadow:0 0 8px var(--accent);transform:scale(1.25)}
.hint{position:fixed;bottom:14px;right:18px;font-family:"Space Mono",monospace;font-size:11px;color:#6c6a66;letter-spacing:.06em}
.endcta{position:fixed;left:50%;bottom:54px;transform:translate(-50%,16px);opacity:0;pointer-events:none;transition:.5s;text-align:center;z-index:6}
.endcta.show{opacity:1;pointer-events:auto;transform:translate(-50%,0)}
.endcta p{max-width:520px;margin:0 auto 12px;color:#cfccc6;font-size:15px}
.btn{display:inline-block;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:var(--accent);padding:13px 22px;border-radius:8px;text-decoration:none;box-shadow:0 10px 30px rgba(230,59,46,.35)}
.btn:hover{filter:brightness(1.08)}
@media(max-width:680px){.brand{font-size:12px}.nav{display:none}.cta{padding:8px 11px}}
</style>
</head>
<body>
<canvas id="bg"></canvas>
<div class="prog" id="prog"></div>
<div class="reader">
  <header>
    <div class="brand"><span class="dot"></span><span>${esc(brandMain)}</span>${brandSub ? `<span class="sub">${esc(brandSub)}</span>` : ""}</div>
    <div class="right"><span id="counter">01 / 01</span>${ctaHeader}</div>
  </header>
  <div class="stage" id="stage">
    <button class="nav prev" id="prev" aria-label="Previous">&#8249;</button>
    <button class="nav next" id="next" aria-label="Next">&#8250;</button>
  </div>
  <footer><div id="dots"></div></footer>
</div>
${endCta}
<div class="hint">&#8592; &#8594; / swipe / click</div>
<script>
var PAGES=${JSON.stringify(images)};
(function(){
  var c=document.getElementById('bg'),x=c.getContext('2d');
  function rs(){c.width=innerWidth;c.height=innerHeight;}rs();addEventListener('resize',rs);
  var P=[];for(var i=0;i<55;i++){P.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2+.4,s:Math.random()*.35+.08});}
  function tick(){x.clearRect(0,0,c.width,c.height);for(var i=0;i<P.length;i++){var p=P[i];p.y-=p.s;if(p.y<-6){p.y=c.height+6;p.x=Math.random()*c.width;}x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fillStyle='rgba(230,59,46,'+(0.10+p.r*0.07)+')';x.fill();}requestAnimationFrame(tick);}tick();
})();
(function(){
  var stage=document.getElementById('stage'),layers=[],cur=0,N=PAGES.length;
  for(var i=0;i<N;i++){var d=document.createElement('div');d.className='layer';var im=new Image();im.src=PAGES[i];im.alt='Page '+(i+1);d.appendChild(im);stage.appendChild(d);layers.push(d);}
  var counter=document.getElementById('counter'),dots=document.getElementById('dots'),prog=document.getElementById('prog'),prev=document.getElementById('prev'),next=document.getElementById('next'),endcta=document.getElementById('endcta');
  for(var j=0;j<N;j++){(function(k){var b=document.createElement('button');b.className='dot';b.onclick=function(){go(k);};dots.appendChild(b);})(j);}
  function pad(v){return(v<10?'0':'')+v;}
  function go(n){n=Math.max(0,Math.min(N-1,n));cur=n;
    for(var i=0;i<N;i++){layers[i].className='layer'+(i===n?' active':(i<n?' left':''));}
    counter.textContent=pad(n+1)+' / '+pad(N);
    prog.style.width=((n+1)/N*100)+'%';
    for(var d=0;d<dots.children.length;d++){dots.children[d].className='dot'+(d===n?' on':'');}
    prev.disabled=(n===0);next.disabled=(n===N-1);
    if(endcta){if(n===N-1)endcta.classList.add('show');else endcta.classList.remove('show');}
  }
  prev.onclick=function(){go(cur-1);};next.onclick=function(){go(cur+1);};
  addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();go(cur+1);}else if(e.key==='ArrowLeft'){go(cur-1);}});
  stage.addEventListener('click',function(e){if(e.target.closest('.nav'))return;var r=stage.getBoundingClientRect();var xr=(e.clientX-r.left)/r.width;if(xr>0.6)go(cur+1);else if(xr<0.4)go(cur-1);});
  var sx=0,sy=0;stage.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
  stage.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){if(dx<0)go(cur+1);else go(cur-1);}});
  go(0);
})();
</script>
</body>
</html>`;

const out = path.join(BASE, slug(title) + ".html");
fs.writeFileSync(out, html);
console.log(`\nInteractive reader: ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB, ${files.length} pages)`);
console.log("Open it in a browser, or host it anywhere — it is fully self-contained.");
