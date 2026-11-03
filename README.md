# site-vibegov

The site of VibeGov, the home of the Coordination Contract (`seed/org-vibegov/` in the CommandAGI repository): a
static folder served by CommandAGI's site hosting at https://vibegov.pro, with `vibegov.tech`, `vibegov.me` and
https://vibegov.commandagi.app serving the same site. The design and the reasons are in CommandAGI's
`docs/vibegov.md`.

- `index.html`: the front door. The contract's four parts with its kernel hash recomputed in the page, the live
  figures (open RFCs, responses counted, persons with a voice, cases, the pool, credit), the open RFCs with their
  deadlines and a Respond link, the decided ones, the ledger's state (log, sweep, on-chain anchor), the law's windows,
  and the acts a member can take.
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
- No generated picture, video or photograph. Every figure is read from the record; a zero says so in words.
- English only, one page per address.

## test

`node --test site.test.mjs` (Node 22 or 24, no dependencies) checks the four pages (contents line, canonical
address, links on disk, CSP), that no picture stands in for the record, that the contract page holds the twelve
kernel articles and the two PDFs, `live.js` against a fake API on a local port (empty states, escaping, deadlines, the
Respond link, a refusing API), and `verify.js` against real kernel and log entries (and that a changed word or digest
is caught).

## deploy

From this folder: `commandagi sites deploy --prod`.
