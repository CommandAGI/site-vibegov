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

One WebGL canvas (`#sky`) fills the night band of the front door, and is on no other page: about 10,000 stars as points, more along one band, the same sky
on every visit. It turns once in 20 minutes. The stars do not twinkle and do not follow the scroll. Nothing else is in it.

## a serious document (owner, 2026-11-13)

Two rounds of the same correction. First: "the subtle animations feel a bit too gamified. This is a financial and
legal system, so it needs to feel professional. The spacey Earth is to give a sense of futurism. But it needs an
honest self-examination regarding the other design elements." Then, after that pass: "the design style is still way
too game-y; it needs to be much more serious. Think about the idealistic people who would be supporting the
Coordination Contract and design with that audience in mind", with the taste skill (tasteskill.dev) as the measure.

What made it a game: a dark screen everywhere, stars behind every page, gold on black, buttons with corner brackets
and a cut corner, labels in mono capitals, boxes inside boxes, things that pulsed. That is a game's interface. The
people this is for read constitutions, court opinions and central-bank reports. So:

- **It is a document.** Ink on warm paper. A serif for what is said, a sans for what is done. Structure is a
  hairline, not a box. A thing is in at most one box, and most things are in none.
- **The night is the first screen only.** The Earth from orbit, with the reason on its night side, is the one image
  of the future. Every other page, and the rest of the front door, is paper. No stars behind text.
- **One system** (the taste skill's rule): one button (an ink outline; the page's one act is filled), one heading
  scale, one page frame (`.desk`: a title, then sections between hairlines), one pair of left and right edges for the
  header, the tape, the content and the footer.
- **Under a claim there is a fact.** A plate (`.pane`, `.plate`) is a ruled table: a figure read from the public
  record ("now, from the record") or a rule of the kernel or the law, with its source above it.
- **No generated picture.** The pictures are the Earth (NASA's maps), two diagrams, one film and the record itself.
- **What moves:** the tape; a shimmer where something is being read; a block the ledger gained while the page was
  open; the globe's slow turn; the sun rising once. Nothing else. `site.test.mjs` holds the stylesheet to this.
- **The footer is one small line.** Where the words, figures and pictures come from, and the licences, are on
  `legal.html`.

## the tape (`live.js` `renderTape`, `shell.js`)

Under the header of every page: the record's state in a word, the ledger's length and last entry, the version, the
kernel's hash, proposals, voices, responses, cases, judgments, the pool, open credit and how many checkpoints are
anchored. One small line. It holds the figures twice, end to end, and moves slowly to the left; it stops under a
pointer, a person can drag it either way, and with reduced motion it moves only when dragged.

## loading

A thing that is being read has a shimmer in its place (`.loading`), with its words kept for a screen reader
("Reading the proposals…"). When it is read, the thing stands there; when it cannot be read, the page says so.

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

## controls

- **A button** is a rectangle with an ink outline; pointed at, it fills. The one act a page asks for is filled.
  No corner mark, no cut corner, no reference cell, no arrow, no pill. (The `data-ref` attribute stays in the markup:
  it names the kernel article an act stands on, for a reader of the source.)
- **Home's acts** (`.acts`) are four tall rectangles, first on the page: open a proposal, file a case, answer a
  proposal, lend or borrow.
- **A list of acts** (`.clauses`) and the contract's contents (`.toc`): reference, title, one sentence, between
  hairlines.

## rules

- **Time moves.** "4 seconds ago" and every countdown are re-worded each second; the views are read each 30 s.
- **A number is read, never typed.** Every figure comes from `/public/contract/*` at load. A zero is said in words.
  An unreachable API says so and names the address.
- **A check the visitor can repeat.** The log's hashes are recomputed in the page.
- **Colour has one meaning each.** Ochre: a reference. Blue: a link. Green: a check that holds. Amber: not done.
  Red: a check that failed. Emphasis is italic, never a colour.
- **Two boxes deep at most**, and one where possible. A section is never inside a section.
- **A sideways scroller kisses the screen's edge** (owner, 2026-11-13: "so that it doesn't feel unnecessarily
  containerized"). A row of cards, a wide table or a flow starts on the page's left edge and runs to the screen's
  edges; it is never cut by an invisible column (`.strip`, `.bleed`; on a narrow screen `.table-wrap` and `.flow`).

## type

Owner, 2026-11-13: "the font should be something more appropriate for this topic." The headings were in Literata, a
face made for reading novels. This is a legal and financial system built on machines, so the type is an engineer's
and an institution's:

- **IBM Plex Serif** (400, 500, 600; italic 400, 500): headings, the kernel's words, a proposal's or a case's title.
  First heading: weight 400, tracking −0.04em.
- **Public Sans** (variable; the United States Web Design System's face): body text, the interface and every number.
- **IBM Plex Mono** (400, 500): references (`k2`, `§ 4`), hashes, the tape's labels, a plate's header.

All three are under the SIL Open Font License and are served from this site (`fonts/`).

## colour

| role | paper | the night (first screen) |
|---|---|---|
| ground | `#f7f4ed` | `#04060b` |
| ink | `#15181e` | `#f2eee4` |
| muted | `#5d636e` | `#b0b8c9` |
| rule | ink at 16% | white at 18% |
| link | `#1f3a66` | ink |
| reference (ochre) | `#8a5a0b` | `#ffc65a` |
| ok / wait / bad | `#1d6b45` / `#8a5a0b` / `#a12a1f` | |

## the mark and the share card

`mark.svg` is the sun as a gold disc with a tick that is also a V (`redesign/marks.py`). `og.png` is a browser's
picture of `redesign/og.html` at 1200 × 630, on a GPU: the title over the earthrise.

## pages

`index.html` (the front door), `record.html` (the ledger and what stands on it), `contract.html` (the text),
`legal.html` (about the site), and the signed-in pages (`APP.md`). One contents line on each.

## names (owner, 2026-11-13)

"Think seriously about the copy. 'Desk' is a bad word for what you might call 'Home'." A page is named by the word a
person would say, not by a figure of speech. The signed-in person's page is **Home** (`home.html`); the header's
control says "Sign in" or "Home". The wordmark is the way to the front door, so the contents line does not repeat
it. On a narrow screen the contents line is behind three bars, with no word on the button.

## to address later

- Owner, 2026-11-13: the case plate's "penalty at most 2× the proved harm" should read "penalty at most 2× the proved
  risk-adjusted harm". That is the law's own measure, not the site's wording: the change belongs in the contract
  (CommandAGI `docs/coordination-contract.md` § justice and k8) and then in `renderCasePlate`.
