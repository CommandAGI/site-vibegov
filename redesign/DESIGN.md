# VibeGov: the design (2027)

*By the house's civic and public-document designer: the one who sets bills, statutes and gazettes, and believes a
public document is the most honest interface there is.*

## the concept: a living constitution (the Coordination Contract's home since 2026-11-02)

The site is not a page about a constitution. It is one. Every page is a sheet of a public document: a running head, a
margin that carries article numbers and line numbers, the way a parliamentary bill does, and a history column that says
when each article changed and by what vote. A change is never a new paragraph: it is a **redline** in ballot blue
(struck words, inserted words) until it is ratified, and then it is **sealed** in red and the clean text takes its
place, with the amendment added to the article's history. Signatories, human and AI, sign at the end in two different
hands.

Nothing here is a card. Structure comes from rules (hairlines and double rules), numbering (§, Art., Roman numerals,
line numbers), and the margin.

## type

- **Literata** (variable: `opsz` 7–72, `wght` 200–900) for everything a person reads. Display at `opsz` 72, weight
  320, tight tracking (−0.02em); article text at `opsz` 12–16, weight 400; marginalia at `opsz` 7, weight 500. Italic
  is the voice of a proposal ("be it resolved") and of a person's signature.
- **Public Sans** (`wght` 100–900) for the apparatus: running heads, labels, line numbers, tallies, buttons; uppercase
  at 0.72–0.8rem, tracking 0.09em, weight 600. Agents sign in Public Sans: a machine's hand is a set hand.
- Scale: a perfect fourth (1.333) for text; display jumps to `clamp(3rem, 8.4vw, 9rem)`.
- Numerals: oldstyle proportional in prose, lining tabular in tallies and line numbers. Real quotes, real dashes,
  `text-wrap: balance` on headings, `pretty` on paragraphs.

## color (OKLCH, sRGB fallbacks first)

| role | sRGB | OKLCH | on ivory |
|---|---|---|---|
| ivory paper | `#f5f1e7` | `oklch(95.6% 0.016 85)` | — |
| shade paper (margins, plates) | `#ebe4d3` | `oklch(91.9% 0.025 85)` | — |
| ink | `#20252a` | `oklch(25.5% 0.012 250)` | 13.7 : 1 |
| seal red (ratified only) | `#832f35` | `oklch(43.5% 0.12 18)` | 7.7 : 1 |
| ballot blue (proposals only) | `#1f4bb0` | `oklch(45.5% 0.17 263)` | 6.9 : 1 |
| muted ink (marginalia) | `#5f5d57` | `oklch(47.5% 0.008 90)` | 5.8 : 1 |
| rules | `#a8a294` | — | decoration only |

Red means ratified and blue means proposed, everywhere; neither is ever decoration. Color is never the only signal: a
deletion is struck, an insertion underlined, a seal says "Ratified" in words.

## layout

The document grid: margin column (article and line numbers) + measure (≤ 36em) + history column.

- **2560 / 1440**: margin 11rem, measure 40rem, history 20rem; the hero is a full-bleed plate of moving ink with the
  preamble set over its plain left third.
- **768**: the history column folds under each article as a footnote; the margin keeps line numbers (3rem).
- **390**: the running head becomes "VibeGov" + "Contents" (a popover of the pages); line numbers stay at 2rem, set at
  0.62rem; the amendment scene's controls become a full-width stepper under the article; the preamble sets at 2.6rem.
- **320**: same as 390, the measure fills the screen less 1rem each side; the seal shrinks to 5.5rem; nothing scrolls
  sideways.

## the nav: a running head, not a menu bar

A thin running head like a printed document's: the wordmark, the title of the sheet in small caps, and on the right the
pages as a short contents line. On phones the contents line is a `popover` opened by "Contents". The footer is a
colophon.

## buttons

Zero radius. A button is a ballot line: a small square box before its label that fills when the button is pressed or
active, a 1.5px ink rule, no shadow. Primary is ink-filled. Focus: a 2px seal-red outline offset 3px, always visible.

## motion grammar: the pen and the seal

Motion only ever does one of three things: a redline is **written** (the strike or underline draws left to right), a
tally is **counted** (bars fill to their weight), a seal is **pressed** (scale from 1.15 to 1 with a 120ms settle). Each
step of the amendment scene is a View Transition, so the article morphs into its next state. The drift figure draws
with `animation-timeline: view()`. Reduced motion: every step crossfades or appears at its end state; videos show their
poster frames and do not play.

## media plan (fal, budget ≤ $15; the log is NOTES.md)

Three generated stills, each turned into a five-second loop. Art direction: archival macro, raking warm window light
from the left, iron-gall ink and oxblood wax on ivory cotton paper, fine grain, slow. No people, no text, no real
document.

1. **The pen**: a nib drawing one line of blue-black ink: the hero, full-bleed.
2. **The seal**: an oxblood wax seal with an abstract guilloche impression, light sweeping across it: "Ratified".
3. **The archive**: archival boxes tied with red tape: "the records are the organization's own files".

Each loop: AV1 + H.264 MP4, under ~2.5 MB, a JPEG/AVIF poster, `muted loop playsinline`, `preload="none"` below the
first screen and played only when visible. A caption on each says it is generated footage.

## the signature moment: an RFC, adopted

A sticky scene on the landing page: one clause of the contract's law (the appeal window) with its line numbers. Five
steps, driven by scroll and by five keyboard buttons alike:

0. **In force**: the window as the genesis law sets it (7 days).
1. **Opened**: "7 days" is struck and "14 days" is written in, in ballot blue.
2. **Answered**: five confirmed responses arrive in the margin, each scored from −2 to +2 (two people, two anonymous
   voices, one agent's voice of a kind the law names); a histogram fills, and the change scores their sum, +4.
3. **Concurred**: the pinned engine reads the tally and a seeded sample; a line fills: "Concur".
4. **Adopted**: the seal is pressed, the redline resolves into clean text, and the adoption joins the clause's history.

Everything is labeled illustrative; the state is announced in an `aria-live` line.

## the pages

1. **The front door** (`index.html`): the preamble (the pen loop); the four parts as a statute's divisions with huge
   Roman numerals, and a figure of a question climbing the engine's tiers; the RFC scene; the three outcomes of a
   determination (the seal loop); five reasons it matters, as a schedule of clauses (i)–(v) with their citations; the
   way in (the archive loop).
2. **The contract** (`contract.html`): the text, rendered from its source: a facts line (the kernel's hash, the
   source's digest), the contents, then each clause as a sheet with § numbers in the margin; the kernel's twelve
   articles carry their numbers and line numbers the way a bill is printed.
3. **Take part** (`join.html`): six numbered ways in, a prompt box that opens a draft RFC in the workbench, and one
   honest line of status.

## don'ts

No cards, no rounded rectangles, no shadows, no gradient text, no icons in squares, no stock people, no counters of
anything that did not happen, no blue or red used as decoration, no animation on a loop that is not a video, nothing
that flashes.
