# VibeGov: the design

## the concept: the contract and its live record (owner, 2026-11-02)

"We need to make VibeGov focus front and center on the Coordination Contract and live transaction data/stats, not
AI-generated antique/bureaucratic images."

The site is the public interface to the contract. The record leads: what is open, what was decided, how many have a
voice, whether the ledger is alive and anchored. The text is one click away and is rendered from its source. Every
act a member can take is a link into the contract editor, at the record it acts on. The 2026-10-26 design (a "living
constitution": ivory paper, wax seals, generated footage) is gone.

## the living home (owner, 2026-11-02)

"The site still looks really old school and out of contact with reality. Something like jw.org — showing VibeGov
active in the real world, with a mission and a binding commitment, live metrics, upcoming events, and live views of some
of its robots — would be more appropriate."

The structure of a large, living, mission-driven organisation's home, not its look: the mission up front in one
sentence, the commitment beside it (a deep-blue seal card: the kernel's promises, its hash checked live, the anchor),
then what is happening now (big ticking vitals, a timeline of acts in plain words, a calendar of deadlines with
countdowns), the machines at work, how to take part, and a library. Warm, plain words; every number read live.

## rules

- **No picture stands in for the record.** No generated image, no video, no stock photograph. Besides the mark, the
  only pictures are frames of real runs: a live machine's frame from the API, and a recorded run's frames, labelled
  "Recording". A run is never called live when it is not.
- **Time moves.** "4 seconds ago" and every countdown are re-worded each second; the views are read each 30 s.
- **A number is read, never typed.** Every figure comes from `/public/contract/*` at load. A zero is said in words
  ("No RFC is open. Anyone may open one."). An unreachable API says so and names the address.
- **A check the visitor can repeat.** The kernel's hash and the log's hashes are recomputed in the page; green means
  it held, red names what failed.
- **Colour has one meaning each.** Blue: what a member can act on (links, Respond, the primary button). Green: a check
  that holds, a live sweep. Amber: not done (not anchored, a quiet sweep). Red: a check that failed. Ink and grey for
  everything else.
- **Cards for records, rules for text.** A figure, an RFC and an act are rounded panels; the contract's text keeps its
  margin, its article numbers and its line numbers.

## type

- **Public Sans** (variable) for the interface, the headings and every number (tabular figures in tallies and tables).
- **Literata** (variable) for the contract's clauses only: the text a member is held to reads as a text.
- Display: weight 700, tracking −0.03em. Labels: 0.74rem, weight 600, uppercase, tracking 0.06–0.08em.

## colour

| role | light | dark |
|---|---|---|
| paper | `#fbfbf9` | `#111316` |
| panel | `#ffffff` | `#181b1f` |
| ink | `#16191d` | `#ecedef` |
| muted | `#5b6068` | `#a3a8b0` |
| act (blue) | `#1f4bb0` | `#8eaaff` |
| ok (green) | `#17784a` | `#5fd39a` |
| wait (amber) | `#9a5b00` | `#f0b45a` |
| bad (red) | `#b3261e` | `#ff8a80` |

## pages

`index.html` (overview), `record.html` (the record), `contract.html` (the text), `join.html` (take part). One
contents line on each, the current page in ink.
