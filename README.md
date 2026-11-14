# site-vibegov

The site of VibeGov, the home of the Coordination Contract (`seed/org-vibegov/` in the CommandAGI repository): a
static folder served by CommandAGI's site hosting at https://vibegov.pro, with `vibegov.tech`, `vibegov.me` and
https://vibegov.commandagi.app serving the same site. The design and the reasons are in CommandAGI's
`docs/vibegov.md`.

- `index.html`: the front door, **A World in Command**: AI should answer to the people who live with it. The first
  screen is the night: the Earth's horizon, the sun coming up, the moon, and the reason on the night side. The rest is
  paper: what the contract holds, one short section each with the kernel's own words and a fact under it (a plate of
  figures from the record, a diagram, a film of a simulated robot arm, the ledger's newest entries), the proposals in
  a row, five things to do, and a diagram of people, agents and machines as one graph. The act is "Take your voice".
- `record.html`: the ledger and what stands on it, each under one heading: activity and what comes next
  (`/public/contract/activity`, `/calendar`), the last 50 log entries with each hash recomputed in the page, the
  checkpoints, the engine's seats (`/public/contract/engine`), the machines their owners put on view and the
  commands the contract authorized (`/public/contract/robots`), the law's windows and the versions.
- `contract.html`: the contract's text: an opening paragraph with the acts, the contents (each entry opens its part;
  a process is a diagram the source declares), and the source line. Between its markers
  the clauses are **rendered from `docs/coordination-contract.md`** in the CommandAGI repository by
  `node scripts/seed/vibegov-contract.mjs`. Do not edit that region here. The repository's
  `scripts/checks/check-generated-files.mjs` refuses a page that differs from the doc.
- `legal.html`: who runs the site, where its words, figures and pictures come from, and the licences.
- The signed-in pages (`redesign/APP.md`): `signin.html`, `home.html`, `rfcs.html`, `rfc.html`, `propose.html`,
  `cases.html`, `case.html`, `file.html`, `credit.html`, each with its module and its test under `test/`.
- `live.js`: the live record as HTML (pure: data in, escaped markup out). `page.js` fetches the public API
  (`<meta name="vibegov-api">`, https://api.commandagi.com) and places each `data-live` part. `verify.js` recomputes
  the kernel's hash and the log's hashes with Web Crypto, by the contract's own rules. `gov.js`: the contents popover
  and line numbers.
- `papers/`: the working paper and its short edition (PDF), copied by the same script from
  `docs/papers/coordination-contract/`.
- `robots/labrat/`: a recorded simulated run (an SO-101 arm picks a pipette tip on LabRat's bench), copied byte for
  byte by the same script from `cloud://global/worlds/labrat` (its servo stream, its run record, two frames its README
  names). The page plots the stream and labels the run a recording and a simulation.
- `scene.js`: the stars behind every page, in one WebGL canvas. `earth.js`: the Earth as a camera in orbit sees it
  (WebGL2, traced per pixel from the maps in `sky/`: NASA's Blue Marble and Black Marble, the Clementine moon map; all
  public domain). `figures.js`: the front door's two diagrams. `film.js`: the film's play and pause. `robots/so101-cube/`: the film, a recording of a simulation on CommandAGI.
- `style.css`, `fonts/` (IBM Plex Serif, IBM Plex Mono and Public Sans, OFL, self-hosted), `mark.svg`, `apple-touch-icon.png`
  (drawn by `redesign/marks.py`), `og.png` (a browser's picture of `redesign/og.html`), `fixtures/` (real entries of
  the public record that the test recomputes).
- `redesign/`: the design (`DESIGN.md`), `marks.py`, `og.html`, the signed-in pages' rules (`APP.md`), and the audit before the 2026-10-26 redesign (`CONTENT.md`).

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
- The pictures are the mark, the sky, the Earth (drawn from NASA's maps), two diagrams, one film (a recording of a simulated robot arm, labelled as
  one), and frames of machines on the record page: a live frame from the
  API (`img-src https://api.commandagi.com`) while its owner shows it, and the recorded run's frames, each labelled a
  recording. Every figure is read from the record; a zero says so in words.
- English only, one page per address.

## test

`node --test site.test.mjs` (Node 22 or 24, no dependencies) checks the pages (contents line, canonical
address, links on disk, CSP), the pictures, that every quotation on the front door is the kernel's text, that the contract page holds the twelve
kernel articles and the two PDFs, `live.js` against a fake API on a local port (empty states, escaping, deadlines, the
Respond link, a refusing API), and `verify.js` against real kernel and log entries (and that a changed word or digest
is caught).

## deploy

From this folder: `commandagi sites deploy --prod`.
