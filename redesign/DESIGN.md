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
on every visit. It turns once in 20 minutes and drifts a little with the scroll. Nothing else is in it.

## pictures: more than one kind (owner, 2026-11-13)

"We shouldn't only do dotted visuals, just in some places. In others we'll have a real embed or 3D or photos or
videos." And: "the content on the homepage could offer a bit more for practical-minded people to pick up, like the
robot simulation."

| section | its picture |
|---|---|
| the first | the Earth, real (`earth.js`) |
| one voice, governed by voice, the judicial system, leave | a dot picture that moves |
| no throne | a diagram: a pyramid becomes a ring of equals around an empty middle (`figures.js`) |
| governed by human voice | also a row of cards: the open and decided proposals, or the path a proposal takes |
| robots by permission | a film: a recording of the SO-101 cube simulation on CommandAGI, with a link to the live one |
| everything on the record | a live pane of blocks, all alike: the log's newest entries, three in view, each pushed down by the next |
| the last | a diagram: people, agents and machines as one graph on a turning globe, work passing along its lines |
| start today | five lines, each one act a person can do now |

The film is `robots/so101-cube/` (recorded from `commandagi.com/embed.html` in headless Chrome on a GPU; the full
recording is in the org Drive's `media/so101-cube/`). Its caption says it is a recording of a simulation. The live
simulation cannot be framed here yet: `commandagi.com` allows only its own pages to frame an embed. An embed share
(CommandAGI's `docs/site-hosting.md` § embedding your own design) is the way to put it in the page.

## the dot pictures (`dots.js`, `art/`, `redesign/art.mjs`)

A raised hand, a ballot, scales, an open door. A picture must show what its heading names.

- The source of each is a generated still (fal, seedream v5 pro), black and white on black. The still stays out of the
  site's folder (the org Drive's `media/dot-pictures/`). `redesign/art.mjs cut` reduces it to a 168 px grey map in `art/`.
- `dots.js` draws one point for each bright pixel. Until a picture is seen its points lie scattered like stars. When
  it scrolls into view they gather into the picture, in under a second.
- A dot picture is not static (owner, 2026-11-13). Each moves in its own way (`data-motion`): the hand waves, the
  ballot goes down, the scales tip, light comes through the door. The points move away from a pointer.
- The page never shows a generated still as a photograph, and its colophon says where the dot pictures come from.

## the diagrams (`figures.js`)

An idea that is a structure gets a diagram, not a literal picture (owner, 2026-11-13: "use a diagram for No throne to
take instead of a literal throne"). A diagram is lines and nodes on a 2D canvas. It says in its `aria-label` what it
shows, and the colophon says the diagrams are drawings, not data.

- **apex**: thirteen seats in a pyramid, one above the rest. Once, when it is first seen, it becomes a ring of
  thirteen equal seats. The gold circle of the top seat stays in the middle, empty: "no office".
- **world**: 150 nodes on a turning globe, people gold, agents blue, machines green, each joined to its neighbours.
  A piece of work starts at a person and passes from system to system.

## the ledger's blocks (`page.js` § chain)

The pane first replays the log's last 12 real entries, one each 3.2 s; each new block pushes the stack down. At the
head it waits, and an entry the log gains comes in the same way. With nothing new for a while it replays again. The
place above the stack always says which the reader sees ("replaying the last 12 entries" or "will appear here"). The
page recomputes each hash. No block is made up.

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
