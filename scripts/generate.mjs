// Comics Maker — stage 2: generate the art with Gemini 3 Pro Image (Nano Banana Pro).
// Reads <project>/comic.config.mjs and generates the character sheet + every page,
// feeding the reference photo(s) into each call so the hero stays consistent.
//
// Usage:
//   node generate.mjs [projectDir] [--only=id1,id2] [--retries=1]
//   node generate.mjs "D:/My Comic"
//   node generate.mjs "D:/My Comic" --only=page04,character-sheet
//
// Requires: GEMINI_API_KEY in the environment.

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith("--"));
const getFlag = (name, def) => {
  const f = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!f) return def;
  const eq = f.indexOf("=");
  return eq === -1 ? true : f.slice(eq + 1);
};

const projectDir = path.resolve(positional[0] || process.cwd());
const onlyRaw = getFlag("only", null);
const onlyIds = onlyRaw ? String(onlyRaw).split(",").map((s) => s.trim()).filter(Boolean) : null;
const retries = Number(getFlag("retries", 1));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERROR: set GEMINI_API_KEY in your environment.");
  process.exit(1);
}

const configPath = path.join(projectDir, "comic.config.mjs");
if (!fs.existsSync(configPath)) {
  console.error(`ERROR: no comic.config.mjs found in ${projectDir}`);
  process.exit(1);
}
const config = (await import(pathToFileURL(configPath).href)).default;

const BASE = config.base ? path.resolve(config.base) : projectDir;
const MODEL = config.model || "gemini-3-pro-image-preview";
const IMAGE_SIZE = config.imageSize || "2K";
const DEFAULT_ASPECT = config.defaultAspect || "3:4";

const ai = new GoogleGenAI({ apiKey });

// --- load reference photo(s) once ---
function mimeFor(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
const refParts = (config.refPhotos || []).map((rel) => {
  const p = path.isAbsolute(rel) ? rel : path.join(BASE, rel);
  if (!fs.existsSync(p)) {
    console.error(`ERROR: reference photo not found: ${p}`);
    process.exit(1);
  }
  return { inlineData: { mimeType: mimeFor(p), data: fs.readFileSync(p).toString("base64") } };
});

async function generate({ prompt, outputPath, aspect, useRef }) {
  const contents = [{ text: prompt }];
  if (useRef !== false) contents.push(...refParts);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: aspect || DEFAULT_ASPECT, imageSize: IMAGE_SIZE },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.text) console.log(`   note: ${part.text.slice(0, 160)}`);
    else if (part.inlineData) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const buffer = Buffer.from(part.inlineData.data, "base64");
      fs.writeFileSync(outputPath, buffer);
      console.log(`   SAVED: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
      return true;
    }
  }
  return false;
}

// --- build the job list (character sheet first, then pages in order) ---
const jobs = [];
if (config.characterSheet) {
  const cs = config.characterSheet;
  jobs.push({
    id: cs.id || "character-sheet",
    prompt: cs.prompt,
    outputPath: path.join(BASE, "Character_Sheets", cs.file || "character_sheet.png"),
    aspect: cs.aspect || "16:9",
    useRef: cs.useRef,
  });
}
for (const page of config.pages || []) {
  jobs.push({
    id: page.id,
    prompt: page.prompt,
    outputPath: path.join(BASE, "Pages", page.folder || page.id, page.file),
    aspect: page.aspect,
    useRef: page.useRef,
  });
}

const selected = onlyIds ? jobs.filter((j) => onlyIds.includes(j.id)) : jobs;
if (selected.length === 0) {
  console.error("Nothing to generate (check --only ids against your config).");
  process.exit(1);
}

console.log("========================================");
console.log(`  COMICS MAKER — generating: ${config.title || "(untitled)"}`);
console.log(`  ${selected.length} image(s) | model ${MODEL} | ${IMAGE_SIZE}`);
console.log("========================================");

const failed = [];
for (const job of selected) {
  console.log(`\n>> ${job.id} -> ${path.basename(job.outputPath)}`);
  let ok = false;
  for (let attempt = 0; attempt <= retries && !ok; attempt++) {
    if (attempt > 0) console.log(`   retry ${attempt}/${retries}...`);
    try {
      ok = await generate(job);
      if (!ok) console.log("   WARNING: no image in response.");
    } catch (err) {
      console.error(`   ERROR: ${err.message}`);
    }
  }
  if (!ok) failed.push(job.id);
}

console.log("\n========================================");
if (failed.length) {
  console.log(`  DONE with ${failed.length} failure(s): ${failed.join(", ")}`);
  console.log(`  Re-run: node generate.mjs "${projectDir}" --only=${failed.join(",")}`);
} else {
  console.log("  GENERATION COMPLETE!");
}
console.log("========================================");
