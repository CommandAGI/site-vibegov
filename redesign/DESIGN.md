# VibeGov: the design

## the concept: A World in Command (owner, 2026-11-13)

"Make it have this overarching unifying theme of 'A World in Command' and be about the deep human-aligned desire of
keeping the world under human control instead of AI. … A strong politically salient message. … The site style needs
to be much more vigorous: a starry background with sun and moon, a slow orbiting camera, and interspersed sections of
dotted art plus content for features. Much cleaner, tighter messaging."

The site says one thing: AI should answer to the people who live with it, and the Coordination Contract is how. The
front door is that message in seven short sections. The record, the text and the way in are one click away.

**Who reads it** (owner, 2026-11-13). First: a politically active Democrat, and a technologist who believes AI can
make the world better. So the page is for AI and for people in charge of it, never against AI. Ten times as many
visitors only want to see what this is; every section must also tell them, in plain words.

The 2026-11-02 design (a light page that led with live figures) is gone. Its live parts are on `record.html`.

## the words

- **The front door's order.** The claim (A World in Command). Why (we want all that AI can do, and we want the world
  to stay ours). Then what the contract holds, one section each: one person one voice (k2), no throne (k3), changed
  only by voice (k4), AI works and people decide (k10), everything on the record (k11), harm has a remedy (k1), free to
  leave (k12). Then the act: take your voice.
- **A heading is 2 to 4 words that a person would say.** One or two sentences under it. No kicker above a heading, no
  question as a heading, italics only in the page's first heading and its last.
- **Each section quotes the kernel**, letter for letter, with a link to the article. An ellipsis marks a cut.
  `site.test.mjs` holds every quotation to the kernel's text. The site's own sentences explain; they never restate a
  clause as if it were the text.
- **Say what is true of the contract.** AI models read the answers and decide the cases; the page says so, and says
  who chooses the models. Today every voice is a human's; the law can recognize another kind only by an adopted RFC.
- **One act.** "Take your voice" is the only gold button on a page.

## the sky (`scene.js`)

One WebGL canvas (`#sky`) is fixed behind every page. No library.

- **Stars**: about 10,000 points on the sky, more of them along one band. The same sky on every visit (a fixed seed).
- **The sun and the moon** are on the sky. The sun is a disc of points with a corona that breathes. The moon is a
  sphere of points lit by the sun, so its phase is true to where the sun is.
- **The camera turns slowly**: one turn of the sky in 11 minutes, and most of a turn more from the top of a page to
  its end. So the sun crosses the page early and the moon later.
- **The Earth** is drawn where a page has a `.globe` box (the front door's first and last sections). Its land is points
  of light from `art/land.png` (Natural Earth 1:50m, `redesign/land.py`). The sun lights it: the day side is ivory,
  the night side shows lamps. It turns once in 4 minutes.
- With no WebGL the page keeps its dark ground. With reduced motion the sky is drawn still.

## the dot pictures (`dots.js`, `art/`, `redesign/art.mjs`)

Each section of the front door has one picture made of points: a raised hand, an empty throne, a ballot, a robot arm
resting in a hand, an open ledger, scales, an open door. A picture must show what its heading names.

- The source of each is a generated still (fal, seedream v5 pro), black and white on black. The still stays out of the
  site's folder (the org Drive's `media/dot-pictures/`). `redesign/art.mjs cut` reduces it to a 168 px grey map in `art/`.
- `dots.js` draws one point for each bright pixel. Until a picture is seen its points lie scattered like stars. When
  it scrolls into view they gather into the picture. So the stars, the Earth and the pictures are one material.
- The page never shows a generated still as a photograph, and its colophon says where the dot pictures come from.

## rules

- **Time moves.** "4 seconds ago" and every countdown are re-worded each second; the views are read each 30 s.
- **A number is read, never typed.** Every figure comes from `/public/contract/*` at load. A zero is said in words.
  An unreachable API says so and names the address.
- **A check the visitor can repeat.** The kernel's hash and the log's hashes are recomputed in the page.
- **Colour has one meaning each.** Gold: the sun, the page's first heading, the kernel's words, and the one act a page
  asks for. Blue: a link, the Earth's air. Green: a check that holds. Amber: not done. Red: a check that failed.
- **Text on the sky has no box** on the front door. The other pages put their text on one dark sheet, so long text
  reads well. A record (a figure, an RFC, an act) is a rounded panel.
- **One edge, square corners.** A line on one edge only never sits on a rounded corner.

## type

- **Literata** (variable): headings, the kernel's words, the contract's clauses. First heading: weight 480, tracking
  −0.04em.
- **Public Sans** (variable): body text, the interface and every number.

## colour

| role | value |
|---|---|
| sky | `#04060b` |
| panel | `rgb(13 18 32 / 0.72)` |
| ink | `#f2eee4` |
| muted | `#a4adc2` |
| sun (gold) | `#ffc65a` |
| link (blue) | `#a9c1ff` |
| ok / wait / bad | `#5fd39a` / `#f0b45a` / `#ff8a80` |

One scheme, dark: the page is the night sky.

## the mark and the share card

`mark.svg` is the sun as a gold disc with a tick that is also a V (`redesign/marks.py`). `og.png` is a browser's
picture of `redesign/og.html` at 1200 × 630: the title, the Earth and the sky.

## pages

`index.html` (the front door), `record.html` (the record, and everything that is alive now), `contract.html` (the
text), `join.html` (take part). One contents line on each.
