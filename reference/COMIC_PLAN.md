# COMIC_PLAN.md — example / template

This is the planning doc you write **before** authoring `comic.config.mjs`. It pairs
with `comic.config.mjs` in this folder (the worked "Debugger" example). Use it as the
shape and quality bar; replace the content for your own comic.

---

## CONCEPT
- **Title:** *The Debugger*
- **Genre:** Cyberpunk / Sci-Fi Thriller
- **Setting:** Tel Aviv, 2049 — a neon-drenched megacity where code IS reality
- **Tone:** Blade Runner meets Mr. Robot — gritty, atmospheric, cerebral

## THE HERO — character sheet (drives `charDesc`)
- Early 30s, lean athletic build
- Short brown fade haircut, trimmed dark beard, black ear gauges
- Calm, determined, intense eyes; Mediterranean features
- Outfit: black t-shirt (civilian) / black tactical jacket with purple circuit trim (hero)
- Signature palette: **black + purple** (+ cyan neon)
- **Background:** a former cybersecurity dev who gains the power to *see and fix the code of
  reality* after his digital identity is corrupted.

## ART STYLE (drives `stylePrefix`)
- Modern graphic novel — semi-realistic, heavy ink lines, cel-shading
- Dark base (blacks, grays) + vibrant purple & cyan neon accents
- High-contrast noir lighting with neon glow
- Inspiration: Sean Murphy (Batman: White Knight) × Jock (Wytches)
- Lettering: white speech bubbles, purple narrator boxes, glitch SFX

## STORY ARC — ISSUE #1: "CORRUPT MEMORY" (12 pages)
1. **The City** (splash) — establishing Tel Aviv 2049. *"They said the future would be wireless..."*
2. **Intro** (3 panels) — Guy at his desk. *"My name is Guy. I find bugs for a living."*
3. **The Client** (4 panels) — mystery woman, the data chip. *"...This chip has proof."*
4. **The Revelation** (3 panels) — corrupted identities; his own marked **SCHEDULED FOR OVERWRITE**.
5. **The Attack** (5 panels) — enforcement drones crash in.
6. **The Chase** (4 panels) — rooftop parkour, the leap.
7. **The Glitch** (splash) — the transformation; eyes go purple. *"Something broke inside me..."*
8. **New Vision** (4 panels) — he sees code overlaid on reality.
9. **First Power** (3 panels) — he debugs a drone by touch. *"I can FIX them."*
10. **The Escape** (3 panels) — through a surveillance dead-zone, underground.
11. **The Stakes** (3 panels) — **PROJECT OVERWRITE** revealed.
12. **The Promise** (closing splash) — hero pose. *"Now I AM the fix." — TO BE CONTINUED...*

## GENERATION PLAN
1. **Character sheet first** — 4 views, lock the look.
2. **Key splashes** — pages 1, 7, 12.
3. **Sequential pages** — the rest, in order.
4. **Letter** — captions/bubbles in `assemble.mjs`; let the model bake big SFX/titles.
5. **Bind** — `make-pdf.mjs` → comic-sized PDF.

**Consistency:** feed the reference photo to every hero panel; reuse the style prefix and
character description on every prompt; keep one palette throughout.
