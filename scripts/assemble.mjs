// Comics Maker — stage 3: letter the pages.
// Composites each page's overlays (caption / speech / sfx / title / subtitle) plus a
// page-number badge onto the raw art, using sharp + hand-built SVG. Pages with no
// overlays still get copied (with a page number) so the PDF has every page.
//
// Usage: node assemble.mjs [projectDir]

import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const projectDir = path.resolve(process.argv.slice(2).filter((a) => !a.startsWith("--"))[0] || process.cwd());
const configPath = path.join(projectDir, "comic.config.mjs");
if (!fs.existsSync(configPath)) {
  console.error(`ERROR: no comic.config.mjs found in ${projectDir}`);
  process.exit(1);
}
const config = (await import(pathToFileURL(configPath).href)).default;
const BASE = config.base ? path.resolve(config.base) : projectDir;
const OUT = path.join(BASE, "Assembled");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Lettering theme. Defaults = classic comic (white box, Comic Neue, Bangers, shadow).
// Override via config.lettering for an on-brand look, e.g.:
//   lettering: { font:"Space Grotesk", boxFill:"#F5F3EE", border:"#111111",
//                textColor:"#111111", accent:"#E63B2E", shadow:false, radius:4 }
const THEME = {
  body: config.lettering?.font || config.fonts?.body || "Comic Neue",
  display: config.lettering?.display || config.fonts?.display || "Bangers",
  boxFill: config.lettering?.boxFill || "#ffffff",
  textColor: config.lettering?.textColor || "#111111",
  border: config.lettering?.border || "#000000",
  borderW: config.lettering?.borderW ?? 3.5,
  accent: config.lettering?.accent || null, // optional red left-bar on captions
  shadow: config.lettering?.shadow ?? true,
  radius: config.lettering?.radius ?? 3,
};
const FONT_BODY = THEME.body, FONT_DISPLAY = THEME.display;

// ---------- SVG helpers ----------
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text, maxChars) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line.length + word.length + 1 > maxChars) {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line += word + " ";
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

// caption left padding (accounts for the optional accent bar)
const captionBarW = (fontSize) => (THEME.accent ? Math.round(fontSize * 0.3) : 0);
const captionPadL = (fontSize) => 24 + (THEME.accent ? captionBarW(fontSize) + 12 : 0);

// Narrator caption box. Themeable: fill, border, optional red accent bar, drop
// shadow on/off, corner radius. Default = classic white comic box.
function captionSvg(text, width, fontSize = 32, maxCharsPerLine = 34) {
  const lines = wrapText(text, maxCharsPerLine);
  const lineHeight = fontSize * 1.26;
  const padY = 20, padL = captionPadL(fontSize);
  const boxW = width;
  const boxH = lines.length * lineHeight + padY * 2;
  const shadow = THEME.shadow ? Math.round(fontSize * 0.18) : 0;
  const r = THEME.radius;
  const textLines = lines
    .map((l, i) => `<text x="${padL}" y="${padY + fontSize + i * lineHeight}" font-family="${THEME.body}" font-weight="700" font-size="${fontSize}" fill="${THEME.textColor}">${esc(l)}</text>`)
    .join("\n    ");
  const shadowRect = THEME.shadow ? `<rect x="${shadow}" y="${shadow}" width="${boxW}" height="${boxH}" rx="${r}" fill="rgba(0,0,0,0.5)"/>` : "";
  const bar = THEME.accent ? `<rect x="1.75" y="1.75" width="${captionBarW(fontSize)}" height="${boxH - 3.5}" fill="${THEME.accent}"/>` : "";
  const keyline = !THEME.accent ? `<rect x="7" y="7" width="${boxW - 14}" height="${boxH - 14}" rx="2" fill="none" stroke="${THEME.border}" stroke-width="1.2" opacity="0.5"/>` : "";
  return {
    svg: Buffer.from(`<svg width="${boxW + shadow}" height="${boxH + shadow}" xmlns="http://www.w3.org/2000/svg">
  ${shadowRect}
  <rect x="1.75" y="1.75" width="${boxW - 3.5}" height="${boxH - 3.5}" rx="${r}" fill="${THEME.boxFill}" stroke="${THEME.border}" stroke-width="${THEME.borderW}"/>
  ${bar}
  ${keyline}
  ${textLines}
</svg>`),
    height: boxH + shadow,
    width: boxW + shadow,
  };
}

// Classic speech bubble: white, bold black outline + tail, bold black text.
// Sharp speech bubble: one rounded-rect-with-tail path so the tail merges
// seamlessly into the outline. Comic-font black text.
function speechSvg(text, width, fontSize = 32, maxCharsPerLine = 30, tailSide = "left") {
  const lines = wrapText(text, maxCharsPerLine);
  const lineHeight = fontSize * 1.26;
  const padX = 28, padY = 22;
  const W = width;
  const bubbleH = lines.length * lineHeight + padY * 2;
  const r = 24;   // corner radius
  const td = 30;  // tail depth
  const tw = 32;  // tail base width
  const baseX = tailSide === "left" ? W * 0.26 : W * 0.62;
  const tipX = tailSide === "left" ? baseX - 24 : baseX + tw + 24;
  const totalH = bubbleH + td;
  const d = [
    `M ${r} 1.75`, `H ${(W - r).toFixed(1)}`,
    `A ${r} ${r} 0 0 1 ${(W - 1.75).toFixed(1)} ${r}`, `V ${(bubbleH - r).toFixed(1)}`,
    `A ${r} ${r} 0 0 1 ${(W - r).toFixed(1)} ${(bubbleH - 1.75).toFixed(1)}`,
    `H ${(baseX + tw).toFixed(1)}`, `L ${tipX.toFixed(1)} ${(bubbleH + td).toFixed(1)}`, `L ${baseX.toFixed(1)} ${(bubbleH - 1.75).toFixed(1)}`,
    `H ${r}`, `A ${r} ${r} 0 0 1 1.75 ${(bubbleH - r).toFixed(1)}`, `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 1.75`, `Z`,
  ].join(" ");
  const textLines = lines
    .map((l, i) => `<text x="${padX}" y="${padY + fontSize + i * lineHeight}" font-family="${THEME.body}" font-weight="700" font-size="${fontSize}" fill="${THEME.textColor}">${esc(l)}</text>`)
    .join("\n    ");
  return {
    svg: Buffer.from(`<svg width="${W + 4}" height="${totalH + 4}" xmlns="http://www.w3.org/2000/svg">
  <path d="${d}" fill="${THEME.boxFill}" stroke="${THEME.border}" stroke-width="${THEME.borderW}" stroke-linejoin="round"/>
  ${textLines}
</svg>`),
    height: totalH + 4,
    width: W + 4,
  };
}

function sfxSvg(text, width, fontSize = 52) {
  const height = fontSize * 1.6;
  return {
    svg: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${fontSize * 1.18}" font-family="${FONT_DISPLAY}, Impact, sans-serif" font-size="${fontSize}" fill="#ff2a3a" stroke="#1a0008" stroke-width="2.5" text-anchor="middle" letter-spacing="2">${esc(text)}</text>
</svg>`),
    height,
    width,
  };
}

function titleSvg(text, width, fontSize = 60, color = "#bf5fff") {
  const height = fontSize * 1.6;
  return {
    svg: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${fontSize * 1.18}" font-family="${FONT_DISPLAY}, Impact, sans-serif" font-weight="700" font-size="${fontSize}" fill="${color}" stroke="black" stroke-width="3" text-anchor="middle" letter-spacing="3">${esc(text)}</text>
</svg>`),
    height,
    width,
  };
}

function subtitleSvg(text, width, fontSize = 30, color = "white") {
  const height = fontSize * 1.6;
  return {
    svg: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${fontSize * 1.15}" font-family="${FONT_BODY}" font-weight="700" font-size="${fontSize}" fill="${color}" text-anchor="middle">${esc(text)}</text>
</svg>`),
    height,
    width,
  };
}

function pageNumSvg(num) {
  const w = 44, h = 36;
  return {
    svg: Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="4" fill="rgba(0,0,0,0.6)" stroke="rgba(160,80,255,0.5)" stroke-width="1"/>
  <text x="${w / 2}" y="${h / 2 + 6}" font-family="Arial, sans-serif" font-size="17" fill="rgba(255,255,255,0.8)" text-anchor="middle">${num}</text>
</svg>`),
    height: h,
    width: w,
  };
}

// ---------- auto sizing + placement ----------
const emFactor = (font) => (font === FONT_DISPLAY || /bangers/i.test(font) ? 0.46 : 0.54);

// font size proportional to image width, clamped
function autoFont(type, w) {
  const frac = { caption: 0.028, speech: 0.030, sfx: 0.060, title: 0.072, subtitle: 0.026 }[type] || 0.028;
  const cap = { title: 110, sfx: 90 }[type] || 62;
  return Math.max(20, Math.min(Math.round(w * frac), cap));
}

// wrap to a target width and return a box width that hugs the text (no half-empty boxes)
function fitBox(text, type, fontSize, w, maxFrac) {
  const font = type === "sfx" || type === "title" ? THEME.display : THEME.body;
  const em = emFactor(font);
  const padL = type === "caption" ? captionPadL(fontSize) : 28;
  const padR = 26;
  const maxTextPx = (maxFrac || 0.5) * w - padL - padR;
  const wrapChars = Math.max(6, Math.floor(maxTextPx / (fontSize * em)));
  const lines = wrapText(text, wrapChars);
  const longest = Math.max(...lines.map((l) => l.length));
  const textPx = Math.ceil(longest * fontSize * em);
  const boxW = Math.min(Math.round(w * 0.92), textPx + padL + padR);
  return { boxW, wrapChars };
}

// coarse greyscale grid of the page for content-aware placement
async function lumGrid(src, GW, GH) {
  const { data } = await sharp(src).greyscale().resize(GW, GH, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  return { data, GW, GH };
}
function regionStats(L, w, h, left, top, bw, bh) {
  const gx0 = Math.max(0, Math.floor((left / w) * L.GW)), gy0 = Math.max(0, Math.floor((top / h) * L.GH));
  const gx1 = Math.min(L.GW - 1, Math.ceil(((left + bw) / w) * L.GW)), gy1 = Math.min(L.GH - 1, Math.ceil(((top + bh) / h) * L.GH));
  let sum = 0, sum2 = 0, n = 0;
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) { const v = L.data[gy * L.GW + gx]; sum += v; sum2 += v * v; n++; }
  if (!n) return { mean: 255, std: 255 };
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) };
}
const overlaps = (a, b, pad) => !(a.left + a.bw + pad <= b.left || b.left + b.bw + pad <= a.left || a.top + a.bh + pad <= b.top || b.top + b.bh + pad <= a.top);

// scan candidate positions; prefer dark + flat (empty) regions, avoid overlaps & faces
function autoPlace(L, w, h, bw, bh, band, placed) {
  const mx = Math.round(w * 0.045), my = Math.round(h * 0.03); // edge breathing room
  const margin = mx;
  const stepX = Math.max(10, Math.round(w * 0.03)), stepY = Math.max(10, Math.round(h * 0.02));
  const yLo = Math.max(my, band ? Math.round(band[0] * h) + Math.round(my * 0.5) : my);
  const yHi = Math.min(h - bh - my, (band ? Math.round(band[1] * h) : h - my) - bh);
  let best = { left: margin, top: yLo }, bestScore = Infinity;
  for (let top = yLo; top <= Math.max(yLo, yHi); top += stepY) {
    for (let left = margin; left <= w - bw - margin; left += stepX) {
      const { mean, std } = regionStats(L, w, h, left, top, bw, bh);
      let score = mean + std * 0.8;
      for (const p of placed) if (overlaps({ left, top, bw, bh }, p, Math.round(h * 0.012))) score += 1e6;
      const cy = (top + bh / 2) / h;
      if (!band && cy > 0.34 && cy < 0.66) score += 45; // keep off centered faces
      if (score < bestScore) { bestScore = score; best = { left, top }; }
    }
  }
  return best;
}

// ---------- assemble one page ----------
async function assemblePage(page, num) {
  const src = path.join(BASE, "Pages", page.folder || page.id, page.file);
  const dst = path.join(OUT, `page_${String(num).padStart(2, "0")}.png`);
  if (!fs.existsSync(src)) {
    console.log(`  SKIP: ${src} not found`);
    return;
  }
  console.log(`  Assembling page ${num} (${page.id})...`);

  const img = sharp(src);
  const meta = await img.metadata();
  const w = meta.width, h = meta.height;
  const composites = [];
  const placed = []; // {left,top,bw,bh} of overlays already positioned this page
  const L = await lumGrid(src, 80, 120);

  // build an overlay's SVG at a given tail side (size auto unless overridden)
  const build = (ov, fontSize, tailSide) => {
    if (ov.type === "caption") { const { boxW, wrapChars } = fitBox(ov.text, "caption", fontSize, w, ov.maxWidth); return captionSvg(ov.text, ov.width || boxW, fontSize, ov.wrap || wrapChars); }
    if (ov.type === "speech") { const { boxW, wrapChars } = fitBox(ov.text, "speech", fontSize, w, ov.maxWidth); return speechSvg(ov.text, ov.width || boxW, fontSize, ov.wrap || wrapChars, tailSide); }
    if (ov.type === "sfx") return sfxSvg(ov.text, ov.width || Math.round(w * 0.8), fontSize);
    if (ov.type === "title") return titleSvg(ov.text, ov.width || Math.round(w * 0.92), fontSize, ov.color || "#bf5fff");
    if (ov.type === "subtitle") return subtitleSvg(ov.text, ov.width || Math.round(w * 0.92), fontSize, ov.color || "white");
    return null;
  };

  for (const ov of page.overlays || []) {
    const fontSize = ov.fontSize || autoFont(ov.type, w);
    let side = ov.tail || "left";
    let svgObj = build(ov, fontSize, side);
    if (!svgObj) continue;

    let left, top;
    const auto = ov.at === "auto" && (ov.type === "caption" || ov.type === "speech");
    if (auto) {
      const band = ov.band || (ov.type === "speech" ? [0.02, 0.5] : null);
      let pos = autoPlace(L, w, h, svgObj.width, svgObj.height, band, placed);
      if (ov.type === "speech") {
        const want = (pos.left + svgObj.width / 2) / w < 0.5 ? "right" : "left"; // tail points inward
        if (want !== side) { side = want; svgObj = build(ov, fontSize, side); pos = autoPlace(L, w, h, svgObj.width, svgObj.height, band, placed); }
      }
      left = pos.left; top = pos.top;
    } else {
      left = ov.x != null ? Math.round(ov.x * w) : Math.round((w - svgObj.width) / 2);
      top = ov.y != null ? Math.round(ov.y * h) : Math.round(h * 0.05);
    }
    left = Math.max(0, Math.min(left, w - svgObj.width));
    top = Math.max(0, Math.min(top, h - svgObj.height));
    composites.push({ input: svgObj.svg, top, left });
    placed.push({ left, top, bw: svgObj.width, bh: svgObj.height });
  }

  const pn = pageNumSvg(num);
  composites.push({ input: pn.svg, top: h - pn.height - 16, left: w - pn.width - 16 });

  await img.composite(composites).png({ quality: 95 }).toFile(dst);
  console.log(`  SAVED: ${dst} (${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`);
}

// ---------- run ----------
console.log("========================================");
console.log(`  COMICS MAKER — assembly: ${config.title || "(untitled)"}`);
console.log("========================================\n");

let i = 0;
for (const page of config.pages || []) {
  i++;
  await assemblePage(page, page.num || i);
}

console.log("\n========================================");
const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
console.log(`  ASSEMBLY COMPLETE — ${files.length} page(s) in ${OUT}`);
console.log("========================================");
