# 📖 Bonus: Comics Maker

> **10 Days 10 Skills — course bonus**
> Turn a one-line concept (and your own face) into a **full, print-ready comic book**.
> Plan → generate art → letter → bind PDF. The hero stays recognizable on every page.

This is the skill behind **"The Debugger"** — a 12-page cyberpunk issue where a real
person becomes a code-bending hero in Tel Aviv 2049. You describe the comic in one config
file; three small Node scripts do the rest. A reference photo is fed into **every**
generation call, so the face, hair, build and signature outfit stay consistent across all
twelve pages.

It builds on the course's image day:

| Step | Tool | Course day |
|---|---|---|
| Plan the issue | `COMIC_PLAN.md` (character sheet + page-by-page script) | — |
| Generate the art | **Gemini 3 Pro Image** (Nano Banana Pro), photo on every panel | [Day 1: Image Generation](https://github.com/guyaga/10d10s-day01-image-generation) |
| Letter the pages | `sharp` + hand-built SVG (captions, speech bubbles, SFX) | — |
| Bind the book | `pdfkit` → US-comic-sized PDF | — |

---

## 🔁 The pipeline

```
plan (COMIC_PLAN.md) → comic.config.mjs → generate.mjs → assemble.mjs → make-pdf.mjs → <title>.pdf
```

1. **Plan** — interview the user, write `COMIC_PLAN.md` (concept, hero, art style, page breakdown).
2. **Config** — author `comic.config.mjs`: a `stylePrefix` + `charDesc` reused on every
   prompt, then one entry per page (prompt + text overlays).
3. **Generate** — `scripts/generate.mjs` makes the character sheet + every page, feeding the
   reference photo to each call. Re-run a single page with `--only=page04`.
4. **Letter** — `scripts/assemble.mjs` composites caption boxes / speech bubbles / SFX onto
   the art (pages where the model already drew the text just get a page number).
5. **Bind** — `scripts/make-pdf.mjs` lays every page onto a comic-sized PDF.

---

## 🚀 Quick start

```bash
git clone https://github.com/guyaga/10d10s-bonus-comics-maker
cd 10d10s-bonus-comics-maker
cp .env.example .env          # add your GEMINI_API_KEY
npm install

# set up a comic project
mkdir -p "My Comic/Assets"
cp reference/comic.config.mjs "My Comic/comic.config.mjs"   # then edit it
# drop your hero photo at "My Comic/Assets/hero-reference.jpg"

export GEMINI_API_KEY=your-key      # PowerShell: $env:GEMINI_API_KEY="your-key"

# run the three stages
node scripts/generate.mjs "My Comic"
node scripts/assemble.mjs "My Comic"
node scripts/make-pdf.mjs "My Comic"
# -> "My Comic/The_Debugger_Issue_1.pdf"
```

> Installed as a Claude Code skill (in `~/.claude/skills/comics-maker/`), just say
> *"make me a comic about …"* and Claude runs the whole pipeline for you.

---

## 🔑 Keys

| Key | For | Required? |
|---|---|---|
| `GEMINI_API_KEY` | Gemini 3 Pro Image art generation | yes |

---

## 🧱 Config in one screen

`comic.config.mjs` exports the whole comic. Define the two consistency constants once,
reuse them everywhere:

```js
const stylePrefix = "Modern graphic novel comic book art style. ...";
const charDesc    = 'The main character looks exactly like the reference photo: ...';

export default {
  title: "The Debugger - Issue 1",
  refPhotos: ["Assets/hero-reference.jpg"],   // fed into every page
  defaultAspect: "3:4",
  pageSize: { widthIn: 6.625, heightIn: 10.25 },
  characterSheet: { file: "sheet.png", aspect: "16:9", prompt: `${stylePrefix} ...` },
  pages: [
    {
      id: "page01", folder: "Page_01", file: "page01.png",
      useRef: false,                          // no hero on this page
      prompt: `${stylePrefix} FULL PAGE SPLASH ...`,
      overlays: [{ type: "caption", text: '"Tel Aviv. 2049."', x: 0.03, y: 0.82, width: 820 }],
    },
    // ...one entry per page
  ],
};
```

Overlay types: `caption` (purple narrator box), `speech` (white bubble w/ tail), `sfx`
(red glitch text), `title`, `subtitle`. Positions are fractions of the page (0–1).

See `reference/comic.config.mjs` for the complete 12-page "Debugger" example and
`reference/COMIC_PLAN.md` for the planning doc that precedes it.

---

## 💡 Hard-won lessons (baked into the skill)

- **Feed the reference photo to every hero panel.** This is the single biggest lever on
  face consistency — far more than describing the face in words.
- **Reuse the style prefix verbatim** on every prompt, or the art style drifts page to page.
- **Let the model draw the big lettering** (SFX, title cards, signage) inside the art, and
  add only clean narrator captions / speech bubbles afterward. Mixing both reads best.
- **Position overlays with fractions**, not pixels, so they survive any output resolution.
- **Splash pages** (1, 7, 12) carry the issue — spend the most prompt care there.
- **A page came out wrong?** Tweak its prompt and re-run just that page with `--only=` —
  no need to regenerate the whole issue.

---

*Course bonus for [10 Days, 10 Skills](https://github.com/guyaga?tab=repositories&q=10d10s). MIT licensed.*
