// OPTIONAL — generate per-page narration audio for the interactive reader.
// Reads `narration` (one entry per page, in page order) + `site.voice` from the config
// and writes Audio/page_0N.mp3. The reader's "Read" button only appears if these files
// exist, so narration is purely opt-in.
//
// Usage: node gen-narration.mjs [projectDir]
// Env:   ELEVEN_API_KEY (ElevenLabs)
//
// In comic.config.mjs:
//   narration: [
//     "[confident] Better content. Built with Claude Code.",   // page 1 (v3 emotion tags ok)
//     { text: "[tired] It took hours. Then days." },            // or {text} form; "" to skip a page
//     ...
//   ],
//   site: { voice: "JBFqnCBsd6RMkjVDRZzb" }   // ElevenLabs voice id (optional)

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const projectDir = path.resolve(process.argv.slice(2).filter((a) => !a.startsWith("--"))[0] || process.cwd());
const config = (await import(pathToFileURL(path.join(projectDir, "comic.config.mjs")).href)).default;
const BASE = config.base ? path.resolve(config.base) : projectDir;

const KEY = process.env.ELEVEN_API_KEY;
if (!KEY) { console.error("ERROR: set ELEVEN_API_KEY"); process.exit(1); }
const narration = config.narration;
if (!Array.isArray(narration) || !narration.length) {
  console.error("No `narration` array in comic.config.mjs — narration is optional, nothing to do.");
  process.exit(0);
}
const VOICE = config.site?.voice || "JBFqnCBsd6RMkjVDRZzb"; // George — warm storyteller
const OUT = path.join(BASE, "Audio");
fs.mkdirSync(OUT, { recursive: true });
const stripTags = (s) => String(s).replace(/\[[^\]]+\]/g, "").replace(/\s+/g, " ").trim();

async function tts(text, model, settings) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
  return Buffer.from(await r.arrayBuffer());
}

for (let i = 0; i < narration.length; i++) {
  const raw = typeof narration[i] === "string" ? narration[i] : narration[i]?.text || "";
  const n = String(i + 1).padStart(2, "0");
  if (!raw.trim()) { console.log(`page ${n}: (skipped)`); continue; }
  process.stdout.write(`page ${n}... `);
  let buf;
  try {
    buf = await tts(raw, "eleven_v3", { stability: 0.4, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true });
    console.log("ok (v3)");
  } catch (e) {
    console.log(`v3 failed (${e.message}); turbo fallback`);
    buf = await tts(stripTags(raw), "eleven_turbo_v2_5", { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true });
  }
  fs.writeFileSync(path.join(OUT, `page_${n}.mp3`), buf);
}
console.log("done →", OUT, "\nRe-run build-site.mjs to embed the narration + Read button.");
