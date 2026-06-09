// Comics Maker — stage 2: generate the art.
// Two backends, selectable per-config (`backend: "gemini" | "gpt2"`) or per-page:
//   - "gemini" (default): Gemini 3 Pro Image (Nano Banana Pro) via @google/genai. Fast.
//   - "gpt2": OpenAI gpt-image-2 via the Codex imagegen CLI. Sharper line work and
//             crisper in-art text; ~10x slower and pricier. Uses `edit --image <ref>`
//             so the hero's face carries from the reference photo.
// Both feed the reference photo(s) so the hero stays consistent (unless useRef:false).
//
// Usage:
//   node generate.mjs [projectDir] [--only=id1,id2] [--retries=1]
//
// Env: GEMINI_API_KEY (gemini backend), OPENAI_API_KEY + python + Codex imagegen (gpt2).

import { GoogleGenAI } from "@google/genai";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
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

const configPath = path.join(projectDir, "comic.config.mjs");
if (!fs.existsSync(configPath)) {
  console.error(`ERROR: no comic.config.mjs found in ${projectDir}`);
  process.exit(1);
}
const config = (await import(pathToFileURL(configPath).href)).default;

const BASE = config.base ? path.resolve(config.base) : projectDir;
const BACKEND = config.backend || "gemini";
const DEFAULT_ASPECT = config.defaultAspect || "3:4";

// ---- reference photos (paths for gpt2, inline data for gemini) ----
function mimeFor(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
const refPaths = (config.refPhotos || []).map((rel) => {
  const p = path.isAbsolute(rel) ? rel : path.join(BASE, rel);
  if (!fs.existsSync(p)) {
    console.error(`ERROR: reference photo not found: ${p}`);
    process.exit(1);
  }
  return p;
});

// ---- gemini backend ----
const GEMINI_MODEL = config.model || "gemini-3-pro-image-preview";
const GEMINI_IMAGE_SIZE = config.imageSize || "2K";
let _ai = null, _refParts = null;
function geminiClient() {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { console.error("ERROR: set GEMINI_API_KEY for the gemini backend."); process.exit(1); }
    _ai = new GoogleGenAI({ apiKey });
    _refParts = refPaths.map((p) => ({ inlineData: { mimeType: mimeFor(p), data: fs.readFileSync(p).toString("base64") } }));
  }
  return _ai;
}

async function generateGemini(job) {
  const ai = geminiClient();
  const contents = [{ text: job.prompt }];
  if (job.useRef !== false) contents.push(..._refParts);
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio: job.aspect || DEFAULT_ASPECT, imageSize: GEMINI_IMAGE_SIZE },
    },
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.text) console.log(`   note: ${part.text.slice(0, 160)}`);
    else if (part.inlineData) {
      fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });
      const buffer = Buffer.from(part.inlineData.data, "base64");
      fs.writeFileSync(job.outputPath, buffer);
      console.log(`   SAVED: ${job.outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
      return true;
    }
  }
  return false;
}

// ---- gpt2 backend ----
// Two modes:
//   "codex" (default, FREE): drive the Codex CLI's built-in image_gen tool via
//            `codex exec` on a ChatGPT-account login. No OPENAI_API_KEY billed.
//   "api"  (paid): the Codex imagegen fallback CLI (scripts/image_gen.py), which
//            calls the OpenAI gpt-image-2 Image API and needs OPENAI_API_KEY.
const GPT2 = config.gpt2 || {};
const GPT2_MODE = GPT2.mode || "codex";
const CODEX_MODEL = GPT2.model || "gpt-5.5"; // must be allowed on the account's login
// The `codex` shell wrapper isn't directly spawnable on Windows; it just runs
// `node .../@openai/codex/bin/codex.js`. Resolve that JS so we can spawn it with
// the current Node (clean arg array, no shell quoting of the long prompt).
const CODEX_JS = GPT2.codexJs || process.env.CODEX_JS ||
  [
    path.join(os.homedir(), "AppData", "Roaming", "npm", "node_modules", "@openai", "codex", "bin", "codex.js"),
    "/usr/local/lib/node_modules/@openai/codex/bin/codex.js",
    path.join(os.homedir(), ".npm-global", "lib", "node_modules", "@openai", "codex", "bin", "codex.js"),
  ].find((p) => fs.existsSync(p)) || null;
const CODEX_BIN = GPT2.codexBin || process.env.CODEX_BIN || "codex";
const CODEX_IMAGE_GEN = GPT2.codexImageGen || process.env.CODEX_IMAGE_GEN ||
  path.join(os.homedir(), ".codex", "skills", ".system", "imagegen", "scripts", "image_gen.py");
// gpt-image-2 (api mode) sizes: multiples of 16, ratio <= 3:1, 655,360..8,294,400 px.
const ASPECT_TO_GPT2_SIZE = {
  "3:4": "1536x2048", "4:3": "2048x1536",
  "9:16": "1080x1920", "16:9": "1920x1080",
  "2:3": "1024x1536", "3:2": "1536x1024", "1:1": "1024x1024",
};
const ASPECT_HINT = {
  "3:4": "a tall vertical portrait page (about 3:4 aspect ratio)",
  "4:3": "a landscape page (about 4:3)",
  "9:16": "a tall vertical page (9:16)",
  "16:9": "a wide landscape image (16:9)",
  "2:3": "a tall vertical portrait page (2:3)",
  "1:1": "a square image (1:1)",
};

// FREE path: built-in image_gen via `codex exec`.
function generateViaCodex(job) {
  const useRef = job.useRef !== false && refPaths.length > 0;
  const out = job.outputPath.replace(/\\/g, "/");
  const hint = ASPECT_HINT[job.aspect || DEFAULT_ASPECT] || "a tall vertical portrait page";
  const mode = useRef
    ? "You have a photo attached (the recurring hero character). Use your built-in image_gen tool in EDIT mode on that attached photo"
    : "Use your built-in image_gen tool to generate";
  const instruction =
    `${mode} to create the following comic book art as ${hint}. ` +
    `It must be a drawn graphic-novel illustration, NOT a photo. ` +
    (useRef ? "Keep the man's facial identity and likeness from the attached photo. " : "") +
    `\n\nART DIRECTION:\n${job.prompt}\n\n` +
    `Only render text that the art direction explicitly asks for (a title logo, SFX, signage). ` +
    `Otherwise leave clean negative space and do NOT invent caption boxes, narration boxes, or speech bubbles. ` +
    `After generating, copy the final PNG to exactly ${out} (create folders as needed). ` +
    `Reply with only that absolute path.`;

  fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });
  const before = fs.existsSync(job.outputPath) ? fs.statSync(job.outputPath).mtimeMs : 0;
  const codexArgs = ["exec", "-m", CODEX_MODEL, "--dangerously-bypass-approvals-and-sandbox",
    "--skip-git-repo-check", "-C", BASE];
  if (useRef) codexArgs.push("-i", refPaths[0]);
  codexArgs.push("-"); // prompt comes from stdin (the `-i` flag is variadic and would
                       // otherwise swallow a trailing prompt argument as another image)

  // Prefer spawning codex.js with this Node (no shell quoting); fall back to the wrapper.
  const cmd = CODEX_JS ? process.execPath : CODEX_BIN;
  const args = CODEX_JS ? [CODEX_JS, ...codexArgs] : codexArgs;
  const opts = { input: instruction, stdio: ["pipe", "inherit", "inherit"], maxBuffer: 64 * 1024 * 1024 };
  if (!CODEX_JS) opts.shell = true;
  const res = spawnSync(cmd, args, opts);
  if (res.error) { console.error(`   ERROR: ${res.error.message}`); return false; }
  if (!fs.existsSync(job.outputPath)) return false;
  return fs.statSync(job.outputPath).mtimeMs > before || before === 0;
}

// PAID path: gpt-image-2 via the Codex imagegen fallback CLI.
function generateViaApi(job) {
  if (!fs.existsSync(CODEX_IMAGE_GEN)) {
    console.error(`   ERROR: Codex imagegen CLI not found at ${CODEX_IMAGE_GEN}`); return false;
  }
  if (!process.env.OPENAI_API_KEY) { console.error("   ERROR: set OPENAI_API_KEY for gpt2 api mode."); return false; }
  const size = GPT2.size || ASPECT_TO_GPT2_SIZE[job.aspect || DEFAULT_ASPECT] || "1536x2048";
  const quality = GPT2.quality || "high";
  fs.mkdirSync(path.dirname(job.outputPath), { recursive: true });
  const promptFile = path.join(path.dirname(job.outputPath), `.prompt_${job.id}.txt`);
  fs.writeFileSync(promptFile, job.prompt);
  const useRef = job.useRef !== false && refPaths.length > 0;
  const sub = useRef ? "edit" : "generate";
  const args = [CODEX_IMAGE_GEN, sub, "--prompt-file", promptFile, "--no-augment",
    "--size", size, "--quality", quality, "--out", job.outputPath, "--force"];
  if (useRef) args.push("--image", refPaths[0]);
  const res = spawnSync(process.env.PYTHON || "python", args, { stdio: "inherit" });
  try { fs.unlinkSync(promptFile); } catch {}
  return res.status === 0 && fs.existsSync(job.outputPath);
}

function generateGpt2(job) {
  if (refPaths.length > 1) console.log(`   note: gpt2 uses the first of ${refPaths.length} ref photos`);
  return GPT2_MODE === "api" ? generateViaApi(job) : generateViaCodex(job);
}

async function runJob(job) {
  const backend = job.backend || BACKEND;
  if (backend === "gpt2") return generateGpt2(job);
  return generateGemini(job);
}

// ---- build job list (character sheet first, then pages in order) ----
const jobs = [];
if (config.characterSheet) {
  const cs = config.characterSheet;
  jobs.push({
    id: cs.id || "character-sheet",
    prompt: cs.prompt,
    outputPath: path.join(BASE, "Character_Sheets", cs.file || "character_sheet.png"),
    aspect: cs.aspect || "16:9",
    useRef: cs.useRef,
    backend: cs.backend,
  });
}
for (const page of config.pages || []) {
  jobs.push({
    id: page.id,
    prompt: page.prompt,
    outputPath: path.join(BASE, "Pages", page.folder || page.id, page.file),
    aspect: page.aspect,
    useRef: page.useRef,
    backend: page.backend,
  });
}

const selected = onlyIds ? jobs.filter((j) => onlyIds.includes(j.id)) : jobs;
if (selected.length === 0) {
  console.error("Nothing to generate (check --only ids against your config).");
  process.exit(1);
}

console.log("========================================");
console.log(`  COMICS MAKER — generating: ${config.title || "(untitled)"}`);
console.log(`  ${selected.length} image(s) | backend: ${BACKEND}`);
console.log("========================================");

const failed = [];
for (const job of selected) {
  console.log(`\n>> ${job.id} [${job.backend || BACKEND}] -> ${path.basename(job.outputPath)}`);
  let ok = false;
  for (let attempt = 0; attempt <= retries && !ok; attempt++) {
    if (attempt > 0) console.log(`   retry ${attempt}/${retries}...`);
    try {
      ok = await runJob(job);
      if (!ok) console.log("   WARNING: no image produced.");
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
