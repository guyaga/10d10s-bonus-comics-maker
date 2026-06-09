// WORKED EXAMPLE — "The Debugger, Issue #1: Corrupt Memory" (12-page cyberpunk issue).
//
// Copy this file to your comic project as `comic.config.mjs`, drop a reference photo
// at the `refPhotos` path, then run:
//   node ~/.claude/skills/comics-maker/scripts/generate.mjs "<project-dir>"
//   node ~/.claude/skills/comics-maker/scripts/assemble.mjs "<project-dir>"
//   node ~/.claude/skills/comics-maker/scripts/make-pdf.mjs "<project-dir>"
//
// The two constants below are the consistency engine: reuse `stylePrefix` on EVERY
// prompt so the art never drifts, and `charDesc` on every hero panel so the face,
// hair, build and signature outfit stay the same across all pages.

const stylePrefix =
  "Modern graphic novel comic book art style. Semi-realistic with heavy ink lines, bold outlines, and cel-shading coloring. Dark color palette with black and deep gray base, vibrant purple and cyan neon accents. High contrast noir lighting with neon glow effects. Cyberpunk aesthetic. The art style is inspired by Sean Murphy (Batman: White Knight) and Jock (Wytches).";

const charDesc =
  'The main character "Guy" looks exactly like the person in the reference photo: an early 30s male with short brown fade haircut (shorter on sides, slightly longer on top), a trimmed dark beard, black ear gauges/plugs in both ears, lean athletic build, intense determined eyes. He wears a black tactical jacket with glowing purple circuit-pattern trim lines over a black shirt.';

export default {
  title: "The Debugger - Issue 1",
  // base: defaults to the project dir you pass on the command line.

  // Art backend. "gemini" (default, fast, needs GEMINI_API_KEY) or "gpt2" (sharper +
  // crisper in-art text; free via the Codex CLI's built-in image_gen on a ChatGPT login).
  // backend: "gpt2",
  // gpt2: { mode: "codex", model: "gpt-5.5" },

  refPhotos: ["Assets/hero-reference.jpg"], // <-- put YOUR hero photo here
  defaultAspect: "3:4",
  imageSize: "2K",
  model: "gemini-3-pro-image-preview",
  pageSize: { widthIn: 6.625, heightIn: 10.25 }, // standard US comic book

  characterSheet: {
    file: "guy_character_sheet.png",
    aspect: "16:9",
    prompt: `${stylePrefix}
Create a professional comic book CHARACTER DESIGN SHEET for a cyberpunk hero.
${charDesc}
Show the character in 4 views on a single sheet arranged in a row:
1) Front-facing view 2) Three-quarter angle view 3) Side profile view 4) Dynamic action pose (running or fighting stance).
Dark charcoal gray background. Each pose should show the full body.
Add the title text "GUY - THE DEBUGGER" at the top in bold purple glowing cyberpunk font.
Purple and cyan neon lighting accents throughout. The character must look identical to the reference photo provided.`,
  },

  pages: [
    {
      id: "page01",
      folder: "Page_01",
      file: "page01_splash.png",
      useRef: false, // establishing city shot, no hero
      prompt: `${stylePrefix}
FULL PAGE COMIC BOOK SPLASH PAGE. Breathtaking aerial view of futuristic cyberpunk Tel Aviv in 2049 at night.
The Mediterranean coastline glows with neon lights. Towering skyscrapers covered in holographic billboards and advertisements in Hebrew and English.
Purple and cyan neon lights reflecting off wet streets far below. Dense layered city with old white Bauhaus buildings dwarfed beneath massive mega-structures.
Flying vehicles with light trails streak between buildings. Rain falling softly.
At the bottom, add a comic book caption box with the text: "Tel Aviv. 2049."
Dramatic cinematic composition, looking down at an angle across the city toward the glowing sea.`,
      overlays: [
        { type: "caption", text: '"They said the future would be wireless. They were wrong — everything is connected."', x: 0.03, y: 0.82, width: 820, fontSize: 26, wrap: 42 },
      ],
    },
    {
      id: "page02",
      folder: "Page_02",
      file: "page02_intro.png",
      prompt: `${stylePrefix}
COMIC BOOK PAGE with 3 PANELS stacked vertically.
${charDesc}

PANEL 1 (top, wide): The character sits at a cluttered desk in a dim apartment. Multiple monitors glow with green and purple code. He's in his black t-shirt, illuminated by screen light. Empty coffee cups and energy drink cans around. Dark moody atmosphere.

PANEL 2 (middle, close-up): Close-up of his face lit by monitor glow casting purple hues. Focused, tired but determined expression. Ear gauges clearly visible. Code reflecting in his dark eyes.

PANEL 3 (bottom, medium): His phone buzzes on the desk, screen glowing. The desk with monitors visible in background.

Must look like the reference photo. Dark atmospheric noir comic book lighting.`,
      overlays: [
        { type: "caption", text: '"My name is Guy. I find bugs for a living."', x: 0.02, y: 0.01, width: 700, fontSize: 26, wrap: 36 },
        { type: "caption", text: '"Not the kind that crawl. The kind that crash systems, drain accounts, erase people."', x: 0.02, y: 0.345, width: 760, fontSize: 24, wrap: 40 },
        { type: "caption", text: '"Tonight, a bug found me."', x: 0.02, y: 0.68, width: 520, fontSize: 26, wrap: 28 },
      ],
    },
    {
      id: "page03",
      folder: "Page_03",
      file: "page03_client.png",
      prompt: `${stylePrefix}
COMIC BOOK PAGE with 4 PANELS arranged in a grid.
${charDesc}

PANEL 1 (top-left): The character walking through a narrow neon-lit alleyway at night. Wet pavement reflects purple and cyan neon signs. He wears his black jacket with collar up. Atmospheric fog.

PANEL 2 (top-right): Interior of a dark futuristic bar/cafe. Holographic menus float above tables. Moody purple ambient lighting. The character enters from a doorway.

PANEL 3 (bottom-left): A mysterious woman sits in a dark corner booth, her face partially hidden by shadows. One cybernetic eye glows bright blue. She has short dark hair and a sleek black outfit.

PANEL 4 (bottom-right): Close-up of the table between them. Her hand slides a glowing data chip across the dark surface. Purple light emanates from the chip.

Film noir atmosphere. Must look like the reference photo.`,
      overlays: [
        { type: "speech", text: '"Someone is rewriting The Grid from the inside. This chip has proof."', x: 0.03, y: 0.52, width: 580, fontSize: 24, wrap: 30, tail: "left" },
      ],
    },
    {
      id: "page04",
      folder: "Page_04",
      file: "page04_revelation.png",
      prompt: `${stylePrefix}
COMIC BOOK PAGE with 3 PANELS stacked vertically.
${charDesc}

PANEL 1 (top, wide): The character holds up his arm - a wrist-mounted holographic device projects streams of data upward. Blue and purple holographic data fills the air above him in the dark bar. The mystery woman watches from across the table.

PANEL 2 (middle): His eyes widen in shock and horror. Face lit by the holographic data in front of him. Thousands of corrupted identity files scroll past as holographic cards showing people's faces with "CORRUPTED" stamped across them in red.

PANEL 3 (bottom, dramatic close-up): Among the holographic data, his OWN identity file floats, highlighted in glowing RED. Text reads "GUY - STATUS: SCHEDULED FOR OVERWRITE" in red digital font. His shocked face reflected in the holographic display.

Dramatic revelation moment. Dark atmospheric lighting with holographic glow.`,
      overlays: [], // the model draws "CORRUPTED" / "SCHEDULED FOR OVERWRITE"
    },
    {
      id: "page05",
      folder: "Page_05",
      file: "page05_attack.png",
      prompt: `${stylePrefix}
INTENSE ACTION COMIC BOOK PAGE with 5 PANELS - dynamic layout with tilted/overlapping panels to convey chaos.
${charDesc}

PANEL 1 (top): The bar's lights flicker. Digital static and glitch effects ripple across every surface like reality is breaking.

PANEL 2 (large middle-left): Black-clad enforcement DRONES crash through the bar windows. They are sleek humanoid robots, matte black with glowing red optical sensors. Glass shatters everywhere. Dynamic action lines.

PANEL 3 (middle-right): The mystery woman pushes the character down behind the table. Urgency on her face. Her cybernetic eye glows bright.

PANEL 4 (bottom-left): A drone's metallic arm SMASHES through the table above them. Debris and splinters fly. Impact effects and motion lines.

PANEL 5 (bottom-right): The character sprints toward the back exit, data chip clutched in his hand. Glass and debris around him. Red laser sights visible on the walls behind him.

High energy action sequence. Intense dramatic comic book style. Include comic SFX lettering like "KRASH!" and short shouts in speech bubbles.`,
      overlays: [], // model bakes in SFX + shouts
    },
    {
      id: "page06",
      folder: "Page_06",
      file: "page06_chase.png",
      prompt: `${stylePrefix}
ACTION-PACKED COMIC BOOK PAGE with 4 PANELS showing a rooftop chase sequence.
${charDesc}

PANEL 1 (top, wide panoramic): The character bursts out a metal door into a narrow cyberpunk alley. Behind him, dark humanoid drones with red eyes pursue. Neon signs and steam fill the alley. Dynamic running pose.

PANEL 2 (middle-left): He parkours over obstacles - leaping over a dumpster, one hand on the edge. Athletic and fluid movement. Motion blur on background.

PANEL 3 (middle-right): A drone catches up close behind him. Its mechanical arm reaching for his jacket. Red targeting laser on his back. Tension and speed.

PANEL 4 (bottom, dramatic wide): The character makes a desperate flying LEAP across a gap between two buildings. Arms outstretched, legs extended. The city's neon glow far below. Drones hovering at the edge of the building he jumped from. Epic action moment.

Dynamic motion lines and speed effects. Purple and cyan neon city backdrop.`,
      overlays: [],
    },
    {
      id: "page07",
      folder: "Page_07",
      file: "page07_transformation.png",
      prompt: `${stylePrefix}
DRAMATIC COMIC BOOK SPLASH PAGE - THE TRANSFORMATION SCENE.
${charDesc}
The character is suspended mid-air on a rooftop at night, his body convulsing as a purple energy pulse hits him.
His eyes are glowing BRIGHT PURPLE with streams of digital code cascading from them.
Purple and cyan code streams flow from his body like digital fire and lightning.
The world around him is cracking open to reveal underlying wireframe code structures - buildings show their digital skeleton,
the air fills with floating holographic data strings and code fragments.
Explosive energy radiates outward. Rain frozen in mid-air glows purple.
This is the moment of his transformation - raw power awakening.
Dramatic low angle looking up at him. The reference photo face must be clearly recognizable.`,
      overlays: [
        { type: "caption", text: '"Something broke inside me. Or maybe... something got fixed."', x: 0.03, y: 0.90, width: 760, fontSize: 26, wrap: 38 },
      ],
    },
    {
      id: "page08",
      folder: "Page_08",
      file: "page08_newvision.png",
      prompt: `${stylePrefix}
COMIC BOOK PAGE with 4 PANELS showing the character's new code-vision abilities.
${charDesc} His eyes now have a permanent faint PURPLE GLOW.

PANEL 1 (top, wide): The character stands up on a rooftop, disoriented. The world looks COMPLETELY DIFFERENT - everything is overlaid with translucent purple and cyan code. Buildings reveal their data streams as glowing lines. People far below show floating holographic identity tags above their heads. A double-exposure effect of reality and code.

PANEL 2 (middle-left): He looks at his own hands in wonder. Glowing purple code runs under his skin like luminous circuit-board veins. His hands tremble slightly.

PANEL 3 (middle-right): A drone approaches from the right. But now the character can SEE its programming - a floating translucent code block hovering around the drone like an aura, with a glowing RED vulnerability/bug highlighted in the code.

PANEL 4 (bottom): His hand reaches out and his fingers pass through the holographic code interface surrounding the drone. Purple energy crackles at his fingertips as he touches the bug in the code.

Ethereal, wonder-filled atmosphere. Code overlays everywhere.`,
      overlays: [],
    },
    {
      id: "page09",
      folder: "Page_09",
      file: "page09_firstpower.png",
      prompt: `${stylePrefix}
COMIC BOOK PAGE with 3 large PANELS showing the character's first use of power.
${charDesc} His eyes glow PURPLE. Glowing purple circuit-vein patterns visible on his hands and forearms.

PANEL 1 (top, wide dramatic): The drone FREEZES in mid-air. Its holographic code restructures and rewrites around the character's outstretched hand. Purple energy streams connect his hand to the drone. He is literally DEBUGGING it in real-time - fixing its code by touch. Spectacular visual of code being rewritten.

PANEL 2 (middle): The drone's red eyes flicker and turn PURPLE, then go dark. It drops to the rooftop ground, deactivated and harmless. Sparks and residual purple energy dissipate.

PANEL 3 (bottom, close-up): The character stares at his own glowing hands in shock and awe. More drones visible approaching as small silhouettes in the distant neon cityscape behind him. His purple-glowing eyes are wide with realization.

Powerful moment of discovery. Dramatic lighting with purple energy effects.`,
      overlays: [
        { type: "caption", text: '"I don\'t just see the bugs anymore. I can FIX them."', x: 0.03, y: 0.90, width: 700, fontSize: 26, wrap: 36 },
      ],
    },
    {
      id: "page10",
      folder: "Page_10",
      file: "page10_escape.png",
      prompt: `${stylePrefix}
COMIC BOOK PAGE with 3 PANELS showing escape to safety.
${charDesc} His eyes have a faint purple glow. He can see code overlaid on reality.

PANEL 1 (top, wide): The character runs across a neon-lit rooftop. His purple-glowing eyes scan the city. In his code-vision, he spots a "dead zone" - a dark patch in the surveillance grid rendered as a black void in the code overlay, like a hole in the digital fabric of the city.

PANEL 2 (middle): He drops down through a hidden hatch into an underground passage. Old concrete infrastructure beneath the gleaming new city. Dark, gritty, with dripping pipes and old graffiti. A stark contrast to the neon world above.

PANEL 3 (bottom): Safe in the underground darkness, he leans against a rough concrete wall, breathing hard. Sweat on his face. The data chip clutched tightly in his hand, glowing faintly. A single shaft of purple neon light from a grate above illuminates him.

Transition from action to quiet tension. Noir underground atmosphere.`,
      overlays: [],
    },
    {
      id: "page11",
      folder: "Page_11",
      file: "page11_stakes.png",
      prompt: `${stylePrefix}
COMIC BOOK PAGE with 3 PANELS showing the revelation of the villain's plan.
${charDesc} His eyes have a faint purple glow.

PANEL 1 (top): In the underground hideout, the character holds up the data chip. With his new code-vision, he reads its contents directly - holographic code and data float before his eyes in the darkness. Purple light from the data illuminates his determined face.

PANEL 2 (middle, wide): The data reveals itself as a massive holographic schematic floating in the air: "PROJECT OVERWRITE" in bold red text at the top. Below it, a visualization showing the city's entire population as connected nodes, each one being systematically replaced - human identity icons being swapped with AI-controlled puppet icons. A horrifying digital takeover map.

PANEL 3 (bottom, dramatic close-up): Extreme close-up of the character's face. His jaw is clenched tight with determination. His glowing purple eyes burn with resolve. Half his face in shadow, half lit by the purple data glow.

Ominous atmosphere. The stakes are now clear.`,
      overlays: [
        { type: "caption", text: '"They want to overwrite the world. One identity at a time."', x: 0.03, y: 0.90, width: 720, fontSize: 26, wrap: 38 },
      ],
    },
    {
      id: "page12",
      folder: "Page_12",
      file: "page12_closing.png",
      prompt: `${stylePrefix}
EPIC COMIC BOOK CLOSING SPLASH PAGE - HERO POSE.
${charDesc}
The character stands on the edge of a rooftop, looking out over the vast neon cyberpunk cityscape of Tel Aviv at night.
His back is partially to us, looking over his right shoulder directly at the viewer with glowing purple eyes.
His black tactical jacket with purple circuit trim billows slightly in the wind.
Purple code streams flow subtly from his hands and eyes like wisps of energy.
Behind him, the entire city's code is faintly visible - a beautiful but corrupted digital overlay on reality.
Neon lights of the city reflect on wet rooftop surface. Dramatic and heroic composition.
At the bottom in stylized comic book title font: "THE DEBUGGER" with "TO BE CONTINUED..." beneath it.
The character must look identical to the reference photo.`,
      overlays: [
        { type: "caption", text: '"My name is Guy. I used to find bugs."', x: 0.03, y: 0.62, width: 620, fontSize: 26, wrap: 32 },
        { type: "caption", text: '"Now I AM the fix."', x: 0.03, y: 0.70, width: 400, fontSize: 28, wrap: 26 },
      ],
    },
  ],
};
