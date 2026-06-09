// Installs the bundled comic lettering fonts (assets/fonts/*.ttf) so sharp/librsvg
// can render them. Run once: `node scripts/install-fonts.mjs`
//
//   Windows -> %LOCALAPPDATA%\Microsoft\Windows\Fonts + per-user registry entry
//   macOS   -> ~/Library/Fonts
//   Linux   -> ~/.local/share/fonts  (+ fc-cache if available)

import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(here, "..", "assets", "fonts");
const fonts = fs.existsSync(fontsDir) ? fs.readdirSync(fontsDir).filter((f) => /\.(ttf|otf)$/i.test(f)) : [];
if (!fonts.length) { console.error(`No fonts found in ${fontsDir}`); process.exit(1); }

// pretty family name from filename, e.g. ComicNeue-Bold.ttf -> "Comic Neue Bold"
const familyName = (f) => path.basename(f).replace(/\.(ttf|otf)$/i, "")
  .replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();

if (process.platform === "win32") {
  const dest = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "Microsoft", "Windows", "Fonts");
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fonts) {
    const to = path.join(dest, f);
    fs.copyFileSync(path.join(fontsDir, f), to);
    const reg = `New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' ` +
      `-Name '${familyName(f)} (TrueType)' -Value '${to}' -PropertyType String -Force | Out-Null`;
    spawnSync("powershell", ["-NoProfile", "-Command", reg], { stdio: "ignore" });
    console.log(`installed ${f} (${familyName(f)})`);
  }
} else {
  const dest = process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Fonts")
    : path.join(os.homedir(), ".local", "share", "fonts");
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fonts) {
    fs.copyFileSync(path.join(fontsDir, f), path.join(dest, f));
    console.log(`installed ${f}`);
  }
  try { execFileSync("fc-cache", ["-f", dest], { stdio: "ignore" }); } catch {}
}
console.log("\nFonts installed. Re-run assemble.mjs to letter with the comic fonts.");
