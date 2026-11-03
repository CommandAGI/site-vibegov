# site-vibegov

The site of VibeGov, the home of the Coordination Contract (`seed/org-vibegov/` in the CommandAGI repository): a
static folder served by CommandAGI's site hosting at https://vibegov.pro, with `vibegov.tech`, `vibegov.me` and
https://vibegov.commandagi.app serving the same site. The design and the reasons are in CommandAGI's
`docs/vibegov.md`.

- `index.html`: the front door, in the order a newcomer asks: what VibeGov is for (the mission) and what the
  contract binds itself to (six of the kernel's promises, the kernel hash recomputed in the page, the log's on-chain
  anchor); what is alive right now (the ledger's height and last entry ticking, open RFCs with countdowns, decisions
  this week, voices; the activity feed in plain words, `/public/contract/activity`; what comes next,
  `/public/contract/calendar`, with its `.ics` feed); the open and decided RFCs; machines under the contract (the
  machines their owners made public and published, live or labelled a recording, and the commands the contract
  authorized, `/public/contract/robots`; with none on view, "No live robot right now" and a recorded run); the
  figures and the ledger; how to take part; the library.
- `record.html`: the public record: every RFC, the judgments, the last 50 log entries with each hash recomputed in the
  page, the checkpoints, the engine's seats (who runs each, what pins its model, its figures;
  `/public/contract/engine`), the versions. `record.html#rfc=<id>` shows one RFC (`/public/contract/rfcs/:id/tally`):
  before its responses are read, its options and how many responses count, and no score (the contract publishes the
  tally only after interpretation, § RFCs 4); after, each option's score, its histogram from −2 to +2 and the
  decision with the determinations it rests on. The overview's RFCs link here.
- `contract.html`: the contract's text. Between its `<!-- contract:begin … -->` and `<!-- contract:end -->` markers,
  the clauses are **rendered from `docs/coordination-contract.md`** in the CommandAGI repository by
  `node scripts/seed/vibegov-contract.mjs`. Do not edit that region here. The repository's
  `scripts/checks/check-generated-files.mjs` refuses a page that differs from the doc.
- `join.html`: how to take part, with links into the contract editor, and a prompt box that opens the visitor's words
  in the CommandAGI workbench (`https://commandagi.com/app?prompt=…`).
- `live.js`: the live record as HTML (pure: data in, escaped markup out). `page.js` fetches the public API
  (`<meta name="vibegov-api">`, https://api.commandagi.com) and places each `data-live` part. `verify.js` recomputes
  the kernel's hash and the log's hashes with Web Crypto, by the contract's own rules. `gov.js`: the contents popover
  and line numbers.
- `papers/`: the working paper and its short edition (PDF), copied by the same script from
  `docs/papers/coordination-contract/`.
- `robots/labrat/`: a recorded simulated run (an SO-101 arm picks a pipette tip on LabRat's bench), copied byte for
  byte by the same script from `cloud://global/worlds/labrat` (its servo stream, its run record, two frames its README
  names). The page plots the stream and labels the run a recording and a simulation.
- `style.css`, `fonts/` (Literata and Public Sans, variable, OFL, self-hosted), `mark.svg`, `og.png`,
  `apple-touch-icon.png` (drawn by `redesign/marks.py`), `fixtures/` (real entries of the public record that the test
  recomputes).
- `redesign/`: the design (`DESIGN.md`), the audit before the 2026-10-26 redesign (`CONTENT.md`) and `marks.py`.

## acting

Every act (respond to an RFC, confirm its receipt, contest a reading, open an RFC, file or follow a case, the
anonymous voice) happens in CommandAGI's contract editor, signed in. The site links to it at the record:
`https://commandagi.com/app?open=/app/contract?rfc=<id>` (URL-encoded) opens the editor on that RFC. The editor's
first panel, Needs you, lists what waits on the signed-in person or agent (`GET /contract/awaiting`); the overview and
the take-part page link to it.

## when the contract changes

The doc is the source. After a change to `docs/coordination-contract.md` (or the paper), in the CommandAGI checkout:

```
node scripts/seed/vibegov-contract.mjs
```

then commit here, push this repository's `main`, and move the gitlink in CommandAGI.

## what the site keeps

- Static, with no build: `site.json`, HTML, CSS, SVG, fonts, PDFs and JavaScript modules (`package.json` says only
  that they are modules).
- Each page connects to itself and the public API only: `connect-src 'self' https://api.commandagi.com`. It reads
  `/public/contract/*` with no credential. The join page's form is sent only on purpose (`form-action
  https://commandagi.com`).
- No generated picture, video or photograph. The only pictures besides the mark are frames of machines: a live
  frame from the API (`img-src https://api.commandagi.com`) while its owner shows it, and the recorded run's frames,
  each labelled a recording. Every figure is read from the record; a zero says so in words.
- English only, one page per address.

## test

`node --test site.test.mjs` (Node 22 or 24, no dependencies) checks the four pages (contents line, canonical
address, links on disk, CSP), that no picture stands in for the record, that the contract page holds the twelve
kernel articles and the two PDFs, `live.js` against a fake API on a local port (empty states, escaping, deadlines, the
Respond link, a refusing API), and `verify.js` against real kernel and log entries (and that a changed word or digest
is caught).

## deploy

From this folder: `commandagi sites deploy --prod`.
