// Comics Maker — stage 4: bind the assembled pages into a print-ready PDF.
// Lays every Assembled/page_NN.png onto a US-comic-sized page (6.625 x 10.25 in
// by default) with a black background, in reading order.
//
// Usage: node make-pdf.mjs [projectDir]

import PDFDocument from "pdfkit";
import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const projectDir = path.resolve(process.argv.slice(2).filter((a) => !a.startsWith("--"))[0] || process.cwd());
const configPath = path.join(projectDir, "comic.config.mjs");
const config = fs.existsSync(configPath)
  ? (await import(pathToFileURL(configPath).href)).default
  : {};

const BASE = config.base ? path.resolve(config.base) : projectDir;
const ASSEMBLED = path.join(BASE, "Assembled");

const slug = (s) => String(s || "comic").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
const OUTPUT = path.join(BASE, config.pdfName || `${slug(config.title)}.pdf`);

const pageWidthPt = (config.pageSize?.widthIn ?? 6.625) * 72;
const pageHeightPt = (config.pageSize?.heightIn ?? 10.25) * 72;

async function main() {
  console.log("Creating PDF...\n");

  const pages = fs.existsSync(ASSEMBLED)
    ? fs.readdirSync(ASSEMBLED).filter((f) => f.endsWith(".png")).sort()
    : [];
  if (pages.length === 0) {
    console.error(`No assembled pages found in ${ASSEMBLED}. Run assemble.mjs first.`);
    process.exit(1);
  }

  const firstMeta = await sharp(path.join(ASSEMBLED, pages[0])).metadata();
  const imgW = firstMeta.width, imgH = firstMeta.height;

  const doc = new PDFDocument({ size: [pageWidthPt, pageHeightPt], margin: 0, autoFirstPage: false });
  const stream = fs.createWriteStream(OUTPUT);
  doc.pipe(stream);

  for (const name of pages) {
    console.log(`  Adding ${name}...`);
    const jpgBuffer = await sharp(path.join(ASSEMBLED, name)).jpeg({ quality: 92 }).toBuffer();
    doc.addPage({ size: [pageWidthPt, pageHeightPt], margin: 0 });

    const scale = Math.min(pageWidthPt / imgW, pageHeightPt / imgH);
    const drawW = imgW * scale, drawH = imgH * scale;
    const offsetX = (pageWidthPt - drawW) / 2, offsetY = (pageHeightPt - drawH) / 2;

    doc.rect(0, 0, pageWidthPt, pageHeightPt).fill("black");
    doc.image(jpgBuffer, offsetX, offsetY, { width: drawW, height: drawH });
  }

  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));

  console.log(`\nPDF created: ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Pages: ${pages.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
