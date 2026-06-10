---
name: comics-maker
description: Create a complete multi-page comic book / graphic novel end-to-end — from a one-line concept to a print-ready PDF — starring a real person whose face stays consistent across every page. Plans the story (character sheet + page-by-page script), generates the art with Gemini 3 Pro Image (Nano Banana Pro) while feeding a reference photo to every panel for face consistency, letters it (caption boxes, speech bubbles, SFX) with sharp + SVG, and binds the pages into a comic-sized PDF with pdfkit. Use when the user wants to make a comic, graphic novel, comic book, manga, comic strip, "turn me into a comic hero", an issue/chapter of a comic, or a sequential-art story. Triggers on "make a comic", "comic book", "graphic novel", "comic strip", "turn this into a comic", "comic issue".
allowed-tools: Read, Write, Edit, Bash, Glob, AskUserQuestion
---

# Comics Maker — concept → printed comic book

Build a full comic book in four stages: **plan → generate art → letter → bind PDF**.
The whole comic is described by one data file (`comic.config.mjs`) that three Node
scripts operate on. The hero stays recognizable across every page because a
**reference photo is fed into every generation call**.

```
plan (COMIC_PLAN.md) → comic.config.mjs → generate.mjs → assemble.mjs → make-pdf.mjs → <title>.pdf
```

## One-time setup

The scripts need three npm packages. Install them **once** in this skill folder
(Node resolves them from here no matter where the comic project lives):

```bash
cd ~/.claude/skills/comics-maker      # Windows: C:\Users\<you>\.claude\skills\comics-maker
npm install
node scripts/install-fonts.mjs        # installs the bundled comic lettering fonts (Bangers, Comic Neue, Luckiest Guy)
```

Then set up whichever **backend** you'll generate art with (see Backends below):

- **gemini** (default): `export GEMINI_API_KEY=your-key`  (PowerShell: `$env:GEMINI_API_KEY="..."`)
- **gpt2** (sharper, free): just a logged-in `codex` CLI on a ChatGPT account
  (`codex login`). No API key billed — it drives Codex's built-in `image_gen` tool.

## Backends

Set `backend: "gemini" | "gpt2"` in the config (or per page). Both feed the reference
photo so the hero stays consistent.

| Backend | Engine | Notes |
|---|---|---|
| `gemini` (default) | Gemini 3 Pro Image via `@google/genai` | Fast (~seconds/page). Needs `GEMINI_API_KEY`. |
| `gpt2` | OpenAI image model via the **Codex CLI's built-in `image_gen`** (`codex exec -m gpt-5.5`) | **Sharper line work and crisper in-art text** (titles, SFX, signage). ~1–2 min/page. **Free** on a ChatGPT-account `codex` login — no `OPENAI_API_KEY` billed. |

`gpt2` options live under a `gpt2` config key: `{ mode, model, codexJs }`.
- `mode`: `"codex"` (default, free, built-in tool) or `"api"` (paid `gpt-image-2` via the
  Codex `image_gen.py` fallback — needs `OPENAI_API_KEY`).
- `model`: the Codex agent model, default `"gpt-5.5"` (must be allowed on your login).
- `codexJs`: override the path to `@openai/codex/bin/codex.js` if auto-detect misses it.

## Workflow

### 1. Interview the user (briefly), then plan

Ask only what you can't reasonably default (use `AskUserQuestion`):
- **Concept & genre** (e.g. cyberpunk thriller, fantasy, slice-of-life, kids' adventure).
- **The hero** — get a **reference photo** if they want a real person in it. Save it to
  `<project>/Assets/`.
- **Length** — default **12 pages** for an "issue", fewer for a strip.
- **Art style & palette** — default to a strong, named style (the example uses Sean
  Murphy / Jock noir cyberpunk, black + purple + cyan).

Then write **`<project>/COMIC_PLAN.md`**: concept, a visual character sheet, art-style
lock, and a page-by-page breakdown (panels + captions + dialogue). See
`reference/COMIC_PLAN.md` for the shape and quality bar.

### 2. Author `comic.config.mjs`

This is the heart of the skill. Write **`<project>/comic.config.mjs`** describing the
whole comic. Define a `stylePrefix` and `charDesc` once, then reuse them in every page
prompt so the art stays consistent. See `reference/comic.config.mjs` for a complete
worked example, and the **Config reference** below.

Consistency rules baked into good output:
1. **Feed the reference photo to every hero panel** (`refPhotos` — the script attaches
   them automatically; set `useRef:false` only on pages with no hero, like an
   establishing city shot).
2. **Reuse `stylePrefix` verbatim** on every prompt so the art style never drifts.
3. **Reuse `charDesc`** (hair, beard, build, signature outfit/colors) on every hero panel.
4. **Generate the character sheet first**, eyeball it, then do the pages.
5. **Let the model bake in big lettering** (SFX, title cards, signage) via the prompt;
   add clean narrator captions and speech bubbles afterward in stage 3.

### 3. Generate the art

```bash
node ~/.claude/skills/comics-maker/scripts/generate.mjs "<project-dir>"
```
- Generates the character sheet (if defined) → `Character_Sheets/`, and every page →
  `Pages/<folder>/<file>`.
- Regenerate just one or a few pages (the "rename / fix a panel" case) with
  `--only`: `node .../generate.mjs "<project-dir>" --only=page04,page07`
- Review the output. Re-run `--only` on any page that came out wrong (tweak its prompt
  in `comic.config.mjs` first).

### 4. Letter the pages

```bash
node ~/.claude/skills/comics-maker/scripts/assemble.mjs "<project-dir>"
```
Composites each page's `overlays` (caption / speech / sfx / title / subtitle) + a page
number onto the raw art → `Assembled/page_NN.png`. Pages with `overlays: []` just get a
page number (use this when the model already drew the text).

### 5. Bind the PDF

```bash
node ~/.claude/skills/comics-maker/scripts/make-pdf.mjs "<project-dir>"
```
Lays every assembled page onto a US-comic-sized page (6.625 × 10.25 in by default) →
`<project>/<title>.pdf`. Show the user the PDF.

### 6. (Optional) Interactive web reader

```bash
node ~/.claude/skills/comics-maker/scripts/build-site.mjs "<project-dir>"
```
Exports a **single self-contained HTML file** (images embedded, no dependencies) — a
realistic **single-page book reader**: each page curls around the spine (CSS 3D) to reveal
the next, with arrow/click/swipe/dot navigation, progress bar, a subtle animated
background, brand colors (from `lettering.accent`/`boxFill`) and a header CTA. Configure
via `site: { ctaUrl, ctaText }`. Works opened directly or hosted.

## Config reference (`comic.config.mjs`)

`export default { ... }` with:

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Used for the PDF filename. |
| `base` | no | Project dir. Defaults to the dir passed on the command line. |
| `refPhotos` | yes (for a real hero) | Array of image paths (relative to `base` or absolute). Attached to every page unless `useRef:false`. |
| `defaultAspect` | no | Default `"3:4"` (portrait comic page). |
| `imageSize` | no | Default `"2K"`. |
| `model` | no | Default `"gemini-3-pro-image-preview"`. |
| `pageSize` | no | `{ widthIn, heightIn }` for the PDF. Default `6.625 × 10.25`. |
| `characterSheet` | no | `{ file, prompt, aspect, useRef }` → saved to `Character_Sheets/`. |
| `pages` | yes | Array, in reading order. |

Each **page**: `{ id, folder, file, aspect, useRef, prompt, num, overlays }`
- `id` — short id (e.g. `"page04"`), used by `--only`.
- `folder` — subfolder under `Pages/` (defaults to `id`).
- `file` — output PNG name.
- `prompt` — the full generation prompt (compose `stylePrefix` + panel description + `charDesc`).
- `useRef` — `false` to skip the reference photo (no-hero pages).
- `num` — page number for lettering/order (defaults to array position).
- `overlays` — array of overlay objects.

Each **overlay**: `{ type, text, at, band, maxWidth, x, y, width, fontSize, wrap, tail, color }`
- `type` — `"caption"` (white narrator box), `"speech"` (white bubble w/ tail),
  `"sfx"` (display text), `"title"`, `"subtitle"`.
- `at: "auto"` — auto-place into the emptiest region (recommended for captions/speech).
  `band: [yTop, yBottom]` — constrain auto-placement to a vertical zone/panel (fractions).
- `maxWidth` — cap box width as a fraction of page width (default 0.5); box hugs the text.
- `x`, `y` — manual top-left as a **fraction** (0–1); `x:null` centers. Overrides `at`.
- `width`/`fontSize`/`wrap` — manual overrides (otherwise auto from image size).
- `tail` — `"left"`/`"right"` (speech; auto when `at:"auto"`). `color` — title/subtitle color.

## Avoiding photo-stitched faces (gpt2)

`gpt2` `edit` mode can keep a *photographic* face on otherwise-drawn art (a stitched look).
Two defenses, both built in:
1. The prompt wrapper tells the model to use the reference **only for likeness** and to
   **fully redraw** the face in inked, cel-shaded comic style (no photo compositing).
2. Best fix: make a **comic-style reference** once, then point `refPhotos` at *that* instead
   of the raw photo — the model then matches a drawing, not a photo. Generate it with a quick
   one-off (upper-body portrait, "bold inked outlines, flat cel shading, NOT a photo"), eyeball
   it, then use it as the reference for every page.

## Lettering / fonts
- Default = classic comic: **Comic Neue** captions/dialogue, **Bangers** SFX/titles, white box,
  black border, drop shadow (run `scripts/install-fonts.mjs` first — bundles Comic Neue, Bangers,
  Luckiest Guy, Space Grotesk).
- Speech bubbles are a single rounded-rect-with-tail path so the tail merges cleanly.

### Lettering theme (on-brand looks)
Set a `lettering` object in the config to restyle every caption/bubble at once:
```js
lettering: {
  font: "Space Grotesk",   // caption + dialogue font (display: SFX/title font)
  boxFill: "#F5F3EE",      // box color (cream)
  textColor: "#111111",
  border: "#111111", borderW: 2.5,
  accent: "#E63B2E",       // optional signal-red left accent bar on captions
  shadow: false,           // drop the drop-shadow for a Swiss/editorial feel
  radius: 4,
}
```
The bundled fonts include **Space Grotesk** (a clean brand sans). Defaults reproduce the classic
white comic box, so existing comics are unchanged.

### Sizing & placement
Overlays size and place themselves — you rarely hand-tune coordinates:
- **Auto size**: omit `fontSize`/`width` and the box scales to the image and **hugs its text**
  (no half-empty boxes). Cap the width with `maxWidth` (fraction of page width, default 0.5).
- **Auto place** (`at: "auto"`): the engine scans the page for the darkest, flattest (emptiest)
  region, avoids overlapping other overlays, keeps off centered faces, and drops the box there.
  Constrain it to a panel/zone with `band: [yTop, yBottom]` (fractions). For speech, the tail
  side is chosen automatically to point inward toward the figure.
- **Manual** still works: give `x`/`y` (fractions; `x:null` centers) for full control — used for
  deliberate layouts like a cover logo or a CTA banner.

## Notes
- Images come out ~1792×2400 px at `3:4` / `2K`. Position overlays with fractions so they
  stay correct regardless of exact size.
- If a generation returns no image (safety filter / transient), re-run that page with
  `--only`; the script reports which pages failed.
- Never commit `.env` or API keys. The scripts read `GEMINI_API_KEY` from the environment.
