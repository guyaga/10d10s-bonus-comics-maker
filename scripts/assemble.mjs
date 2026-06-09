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

// Classic comic narrator caption: white box, bold black border + drop shadow,
// bold black text. Big and legible.
function captionSvg(text, width, fontSize = 34, maxCharsPerLine = 40) {
  const lines = wrapText(text, maxCharsPerLine);
  const lineHeight = fontSize * 1.3;
  const padX = 26, padY = 18;
  const boxW = width;
  const boxH = lines.length * lineHeight + padY * 2;
  const shadow = Math.round(fontSize * 0.16); // offset drop shadow
  const totalW = boxW + shadow;
  const totalH = boxH + shadow;
  const textLines = lines
    .map((l, i) => `<text x="${padX}" y="${padY + fontSize + i * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#111111">${esc(l)}</text>`)
    .join("\n    ");
  return {
    svg: Buffer.from(`<svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${shadow}" y="${shadow}" width="${boxW}" height="${boxH}" rx="3" fill="rgba(0,0,0,0.55)"/>
  <rect x="0" y="0" width="${boxW}" height="${boxH}" rx="3" fill="#ffffff" stroke="#000000" stroke-width="3"/>
  ${textLines}
</svg>`),
    height: totalH,
    width: totalW,
  };
}

// Classic speech bubble: white, bold black outline + tail, bold black text.
function speechSvg(text, width, fontSize = 30, maxCharsPerLine = 38, tailSide = "left") {
  const lines = wrapText(text, maxCharsPerLine);
  const lineHeight = fontSize * 1.3;
  const padX = 24, padY = 18;
  const bubbleHeight = lines.length * lineHeight + padY * 2;
  const tailHeight = 28;
  const totalHeight = bubbleHeight + tailHeight;
  const tailX = tailSide === "left" ? width * 0.25 : width * 0.7;
  const tail = `<polygon points="${tailX - 12},${bubbleHeight - 2} ${tailX + 12},${bubbleHeight - 2} ${tailX - 22},${bubbleHeight + tailHeight}" fill="white" stroke="black" stroke-width="3"/>`;
  const textLines = lines
    .map((l, i) => `<text x="${padX}" y="${padY + fontSize + i * lineHeight}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="black">${esc(l)}</text>`)
    .join("\n    ");
  return {
    svg: Buffer.from(`<svg width="${width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="${width - 4}" height="${bubbleHeight - 2}" rx="20" fill="white" stroke="black" stroke-width="3"/>
  ${tail}
  ${textLines}
</svg>`),
    height: totalHeight,
    width,
  };
}

function sfxSvg(text, width, fontSize = 52) {
  const height = fontSize * 1.6;
  return {
    svg: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${fontSize * 1.15}" font-family="Impact, 'Arial Black', sans-serif" font-size="${fontSize}" font-weight="bold" fill="#ff2255" stroke="#220011" stroke-width="2" text-anchor="middle" letter-spacing="4">${esc(text)}</text>
</svg>`),
    height,
    width,
  };
}

function titleSvg(text, width, fontSize = 60, color = "#bf5fff") {
  const height = fontSize * 1.6;
  return {
    svg: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${fontSize * 1.15}" font-family="Impact, 'Arial Black', sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}" stroke="black" stroke-width="3" text-anchor="middle" letter-spacing="6">${esc(text)}</text>
</svg>`),
    height,
    width,
  };
}

function subtitleSvg(text, width, fontSize = 30, color = "white") {
  const height = fontSize * 1.6;
  return {
    svg: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${fontSize * 1.15}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-style="italic" fill="${color}" text-anchor="middle">${esc(text)}</text>
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

  for (const ov of page.overlays || []) {
    let svgObj;
    const ovWidth = ov.width || Math.round(w * 0.85);
    switch (ov.type) {
      case "caption": svgObj = captionSvg(ov.text, ovWidth, ov.fontSize || 28, ov.wrap || 55); break;
      case "speech": svgObj = speechSvg(ov.text, ovWidth, ov.fontSize || 26, ov.wrap || 44, ov.tail || "left"); break;
      case "sfx": svgObj = sfxSvg(ov.text, ovWidth, ov.fontSize || 52); break;
      case "title": svgObj = titleSvg(ov.text, ovWidth, ov.fontSize || 60, ov.color || "#bf5fff"); break;
      case "subtitle": svgObj = subtitleSvg(ov.text, ovWidth, ov.fontSize || 30, ov.color || "white"); break;
      default: continue;
    }
    const left = ov.x != null ? Math.round(ov.x * w) : Math.round((w - svgObj.width) / 2);
    const top = ov.y != null ? Math.round(ov.y * h) : Math.round(h * 0.05);
    composites.push({
      input: svgObj.svg,
      top: Math.max(0, Math.min(top, h - svgObj.height)),
      left: Math.max(0, Math.min(left, w - svgObj.width)),
    });
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
