# VibeGov redesign: notes (2026-10-26)

## generated media (fal)

Made by `redesign/media.mjs` (the key from the CommandAGI `.env` cascade, never printed, never in the client), encoded
by `redesign/encode.sh` into `media/`. Art direction: archival macro, raking warm window light from the left,
iron-gall ink and burgundy wax on ivory cotton paper, fine grain, slow; no people, no text, no real document. Every
loop on the site carries a caption saying it is generated.

| asset | model | prompt (abridged; the full text is in media.mjs) | used as |
|---|---|---|---|
| `ink` still | `fal-ai/flux-pro/v1.1`, 1920×1088 | a steel fountain-pen nib on ivory cotton laid paper, a fresh line of blue-black iron-gall ink | the preamble's poster |
| `ink` loop | `fal-ai/kling-video/v2.1/standard/image-to-video`, 5 s | the nib glides right, the wet ink catches the light; static camera | the preamble, full-bleed |
| `seal` still | flux-pro v1.1 | a round burgundy sealing-wax seal on an ivory document, an abstract engraved rosette with no letters, a burgundy ribbon | "Ratified" poster |
| `seal` loop | kling v2.1 standard, 5 s | a slow sweep of warm light across the seal; very slow push in | "Ratified", full-bleed |
| `archive` still | flux-pro v1.1 | low shelves of ivory archive boxes tied with faded red cotton tape | Article 8 poster |
| `archive` loop | kling v2.1 standard, 5 s | a slow lateral dolly along the shelves, dust in the light | Article 8, full-bleed |

Each loop plays forward then back (10 s, no jump), AV1 (250–420 KB) with an H.264 fallback (0.7–1.2 MB), 1600 px wide,
with a WebP poster (1440 px, quality 50: 25–40 KB, the first paint).

**Cost.** fal calls made: 4 flux-pro stills (one, the first seal, came back black from fal's safety checker: the
words "oxblood-red" were reworded to "burgundy") and up to 8 kling clips submitted (the first two runs were stopped
before they downloaded; their clips were billed and lost: the script now logs each request id at submission). At
fal's list prices (flux-pro v1.1 about $0.04 per megapixel, kling v2.1 standard about $0.25 per 5 s clip): about
$0.35 + $2.00 = **about $2.35, at most**, against the $15 budget.

## the marks

`redesign/marks.py` draws `wordmark.svg` from the site's own Literata ("Vibe" italic 330, a red section sign, "Gov"
roman 600, opsz 72, tightened by hand), `seal.svg` (a guilloche rosette: 17 sine-modulated circles in three woven
bands) and `mark.svg` (the favicon: the seal's frame and its section sign; the engraving is mud at 16 px).
`redesign/og.html` is the share card; `python3 redesign/shoot.py og` renders it to `og.png` and
`apple-touch-icon.png`.

## looking at it

`python3 redesign/shoot.py shots [base-url] [pages]` takes full-page screenshots at 1440, 768, 390 and 320, and at 1440
and 390 with reduced motion, into `redesign/shots/` (not committed).

### what the screenshots changed

1. The phone's Contents button showed on the desktop (a `.btn` rule won over `display: none`): scoped to the running
   head.
2. The running head's pages wrapped onto two lines at 1440: one line each, and the sheet title hides below 92rem.
3. Line numbers sat on top of the article numeral: the margin keeps a 2.75rem lane for them.
4. The powers, the drift figure and the signatories ran to the right edge (a `padding` shorthand dropped the sheet's
   gutter): `padding-block`.
5. The seal covered the article on a phone: it sits under the text there.
6. The struck and inserted words touched ("treasurycapped"): a space between them, none in Chinese.
7. Red was used as decoration (the about page's numbering, the sheet signs): red now means ratified only, blue a
   proposal, ink the rest.

### scores (my own, against the brief's bar of 8 average, nothing under 7)

| | score | why |
|---|---|---|
| art direction | 8 | one idea, held everywhere: a public document with a margin, a seal and a redline; the footage is warm, slow and of the same paper |
| brand specificity | 9 | nothing here could be another company's: line numbers, articles, signatories in two hands, a guilloche seal |
| product expression | 8 | the signature scene is the product's own loop (propose, vote, sign off, ratify, history) with the template's real rules |
| interaction | 8 | scroll and keyboard drive the same five states; View Transitions on a press; the governance room keeps its whole flow |
| technical quality | 8 | no framework, ~6 KB of new script, self-hosted fonts, AV1 loops lazy beyond the first screen, CSP unchanged |
| craft | 8 | optical sizes used, oldstyle figures in prose and tabular in tallies, measured contrast (13.7, 7.7, 6.9, 5.8 : 1) |

Average 8.2.
