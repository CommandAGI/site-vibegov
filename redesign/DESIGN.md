# VibeGov: the design

## the concept: the contract and its live record (owner, 2026-11-02)

"We need to make VibeGov focus front and center on the Coordination Contract and live transaction data/stats, not
AI-generated antique/bureaucratic images."

The site is the public interface to the contract. The record leads: what is open, what was decided, how many have a
voice, whether the ledger is alive and anchored. The text is one click away and is rendered from its source. Every
act a member can take is a link into the contract editor, at the record it acts on. The 2026-10-26 design (a "living
constitution": ivory paper, wax seals, generated footage) is gone.

## rules

- **No picture stands in for the record.** No generated image, no video, no photograph. The one image is the mark, a
  drawn tick in a rounded square.
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
