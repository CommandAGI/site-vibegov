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
  to stay ours). Then what the contract holds, one section each: one person one voice (k2), no throne (k3), governed
  by human voice (k4, with the proposals in a row under it), robots by permission (a film of a robot at work),
  everything on the record (k11, live), an autonomous judicial system (k7), free to leave (k12). Then five things to do today, and the act:
  take your voice.
- **A heading is 2 to 4 words that a person would say.** One or two sentences under it. No kicker above a heading, no
  question as a heading, italics only in the page's first heading and its last.
- **Each section on what the contract holds quotes the kernel**, letter for letter, with a link to the article. An ellipsis marks a cut.
  `site.test.mjs` holds every quotation to the kernel's text. The site's own sentences explain; they never restate a
  clause as if it were the text.
- **Say what is true of the contract.** AI models read the answers and decide the cases; the page says so, and says
  who chooses the models. Today every voice is a human's; the law can recognize another kind only by an adopted RFC.
- **One act.** "Take your voice" is the only gold button on a page.

## the first screen: earthrise (`earth.js`, `sky/`) (owner, 2026-11-13)

"I wanted the earthrise with the curvature of the Earth's horizon at the bottom of the page, facing the sun, on the
hero. Not dot art for the 3D scene of the Earth. The sun and moon flying by as I scroll is distracting; they should
be in the view of the hero."

- The first screen is the view from orbit: the Earth's curved horizon across the bottom, the sun coming up over it, the
  moon above. It is one WebGL2 picture traced per pixel, with no library. The Earth looks real, not drawn.
- The ground is NASA's Blue Marble, the night side's lamps NASA's Black Marble, the moon the Clementine map (all
  public domain, from Wikimedia Commons; the originals are in the org Drive's `media/earth/`). Clouds are noise. The
  air is a thin shell: blue where the sun is up, orange where it is low.
- The sun rises in the first seconds after the page loads, then climbs very slowly. The ground turns under the camera.
- The sun and the moon are in this picture only. They scroll away with it. Nothing crosses the later sections.
- The moon is close to the sun in this sky, so it would be almost new. It is lit from the sun's side as a crescent.
  That is the one thing in the picture that is not where the light says.
- The Earth does not stop where the first screen stops (owner, 2026-11-13). The canvas is 1.75 times as tall as
  that screen and the picture is framed on the screen, so the ground goes on below the horizon, into the night and
  its lamps, under the words that follow, and fades out there.
- A narrow screen takes maps of half the size. With no WebGL2 the canvas stays empty. Reduced motion: one frame.

## the sky (`scene.js`)

One WebGL canvas (`#sky`) is fixed behind every page: about 10,000 stars as points, more along one band, the same sky
on every visit. It turns once in 20 minutes. The stars do not twinkle and do not follow the scroll. Nothing else is in it.

## a professional system (owner, 2026-11-13)

"The subtle animations across all the pages feel a bit too gamified. This is a financial and legal system, so it
needs to feel professional. The spacey Earth is to give a sense of futurism. But it needs an honest self-examination
regarding the other design elements."

The examination, and what it decided:

| element | verdict | now |
|---|---|---|
| the earthrise and the stars | keep: the one piece of futurism | the sun rises once; the stars turn slowly and do not twinkle or follow the scroll |
| dot pictures (a hand, a ballot, scales, a door) | remove: generated stock symbols, and they moved for show | a plate of facts under each thing the contract holds |
| the pyramid that turned into a ring | still | two structures side by side: "not this", "this" |
| the ledger that replayed old entries | remove the replay: it made the record look busier than it is | the three newest entries, still; a block moves only when the log gains one |
| pulsing dots, a breathing "next" slot | remove | a state is a word and a still colour |
| buttons that drew a frame, rows that slid, arrows that nudged | remove | a hover changes a colour |
| the caption in the header ("36,493 entries…") | unaligned, and one figure | the tape |
| the globe of systems at work | keep, slower | one turn in 4 minutes, a few pieces of work, no flash |
| the film of the robot | keep: it is a recording of a real run | plays while seen |

Rules that follow:

- **Nothing moves for show.** No keyframe animation. One transition moves a thing: the ledger's new block.
  `site.test.mjs` holds this.
- **Under a claim there is a fact.** A plate (`.pane--plate`, `.plate`) is a few rows: a figure read from the public
  record ("now, from the record") or a rule of the kernel or the law, with its source in the plate's header.
- **No generated picture.** The pictures are the Earth (NASA's maps), two diagrams, one film and the record itself.

## the tape (`live.js` `renderTape`)

Under the header of every page, on the page's grid: the record's state in a word, the ledger's length and last entry,
the version, the kernel's hash, proposals, voices, responses, cases, judgments, the pool, open credit and how many
checkpoints are anchored. One line, each a label over a value. It does not scroll by itself; on a narrow screen a
person scrolls it sideways.

## the pictures

| section | under it |
|---|---|
| the first screen | the Earth (`earth.js`) |
| one person, one voice | plate: persons with a voice now; what adds nothing to a voice (k2) |
| no throne | diagram: a pyramid and a ring (`figures.js` `apex`) |
| governed by human voice | plate: proposals now and the law's windows; then the proposals in a row |
| robots by permission | a film: a recording of the SO-101 cube simulation, with a link to the live one |
| everything on the record | the ledger's three newest entries as blocks, each hash recomputed in the page |
| an autonomous judicial system | plate: cases now; a case in order with the law's clocks and limits |
| free to leave | plate: what leaving ends and what survives (k12) |
| the last | diagram: people, agents and machines as one graph on a globe (`figures.js` `world`) |

The film is `robots/so101-cube/` (recorded from `commandagi.com/embed.html` in headless Chrome on a GPU; the full
recording is in the org Drive's `media/so101-cube/`). Its caption says it is a recording of a simulation.

## the diagrams (`figures.js`)

An idea that is a structure gets a diagram, not a literal picture. A diagram is lines and nodes on a 2D canvas. It
says in its `aria-label` what it shows, and the colophon says the diagrams are drawings, not data.

- **apex** (still): at the left a pyramid of thirteen seats, one above the rest, marked "not this"; at the right a
  ring of thirteen equal seats around an empty middle marked "no office", marked "this".
- **world**: 150 nodes on a slowly turning globe, people gold, agents blue, machines green, each joined to its
  neighbours. A piece of work starts at a person and passes from system to system.

## the ledger's blocks (`page.js` § chain)

The log's three newest entries, the newest on top, each with its number, its time, what it is, its hash and the hash
it follows. The page recomputes each hash. When the log gains an entry while the page is open, its block comes in at
the top. No block is made up, and no old entry is replayed.

## the contract page (owner, 2026-11-13)

"Just an opening paragraph, ToC, and closing paragraph + buttons. Click on a ToC entry to toggle expand it." And: "the
contract itself could use diagrams instead of ugly markdown."

- The page is three things: one opening paragraph, the contents, one closing paragraph with the kernel check and the
  buttons. No panel behind it: the text stands on the sky, as on the front door.
- An entry of the contents is a line like a clause (reference, title, one sentence, a plus) and a `<details>`. It
  holds its part of the contract, closed. An address inside a part (`#k7`) opens it (`contract.js`).
- A process is a diagram that the contract's source declares (a fenced `flow` block in CommandAGI's
  `docs/coordination-contract.md`). The generator draws it as SVG, top to bottom, so it fits a phone: the spine in
  solid boxes, branches in dashed gold ones. The site only colours it (`.flow`).

## controls: a line of the contract (owner, 2026-11-13)

"The style shouldn't use round pill buttons as much if it can find something more CC-coded, more original."

- **A button is a clause.** Square. Its reference is in a small margin cell at its left, in mono and gold (`k2`,
  `k11`, `sim`: the `data-ref` attribute), as an article's number stands in the contract's margin. Four corner marks
  frame it, as on a printed ballot; the whole frame draws when it is pointed at.
- **The one act a page asks for** is a gold stub with one corner cut, as a ballot's is.
- **A list of acts is a list of clauses** (`.clauses`): reference, act, one sentence, an arrow, between hairlines.
- **A pane** (`.pane`) frames something real: square, a mono header with its name and its source.
- No pill anywhere. The contents line marks its page with a gold underline. Radius is 3 px at most.

## rules

- **Time moves.** "4 seconds ago" and every countdown are re-worded each second; the views are read each 30 s.
- **A number is read, never typed.** Every figure comes from `/public/contract/*` at load. A zero is said in words.
  An unreachable API says so and names the address.
- **A check the visitor can repeat.** The kernel's hash and the log's hashes are recomputed in the page.
- **Colour has one meaning each.** Gold: the sun, the page's first heading, the kernel's words, a reference, and the
  one act a page asks for. Blue: a link. Green: a check that holds. Amber: not done. Red: a check that failed.
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
picture of `redesign/og.html` at 1200 × 630, on a GPU: the title over the earthrise.

## pages

`index.html` (the front door), `record.html` (the record, and everything that is alive now), `contract.html` (the
text), `join.html` (take part). One contents line on each.
