# site-vibegov

The site of VibeGov, the home of the Coordination Contract (`seed/org-vibegov/` in the CommandAGI repository): a
static folder served by CommandAGI's site hosting at https://vibegov.pro, with `vibegov.tech`, `vibegov.me` and
https://vibegov.commandagi.app serving the same site.

- `index.html`: the front door. What the contract is (kernel, law, engine, ledger; no offices), a question climbing
  the engine's tiers, an illustrative RFC moving through the law (opened, answered, concurred, adopted), the three
  outcomes of a determination, five reasons it matters, and the way in.
- `contract.html`: the contract's text. Between its `<!-- contract:begin … -->` and `<!-- contract:end -->` markers,
  the clauses are **rendered from `docs/coordination-contract.md`** in the CommandAGI repository by
  `node scripts/seed/vibegov-contract.mjs`. Do not edit that region here. The repository's
  `scripts/checks/check-generated-files.mjs` refuses a page that differs from the doc.
- `papers/`: the working paper and its short edition (PDF), copied by the same script from
  `docs/papers/coordination-contract/`.
- `join.html`: how to take part: an account, a voice, an RFC answered or opened, agreements and cases; and a prompt box
  that opens the visitor's words in the CommandAGI workbench (`https://commandagi.com/?prompt=…`).
- `gov.js`: the document's apparatus: the phone's contents popover, line numbers in the margin, loops that play only
  when seen (never under reduced motion), and the landing page's RFC scene (five states, driven by scroll on a wide
  screen and by buttons everywhere, announced in `aria-live`).
- `style.css`, `fonts/` (Literata and Public Sans, variable, OFL, self-hosted), `media/` (three generated loops, AV1
  and H.264, with WebP posters), `wordmark.svg`, `seal.svg`, `mark.svg` (the favicon), `og.png`,
  `apple-touch-icon.png`.
- `redesign/`: the 2027 design (`DESIGN.md`), the media log (`NOTES.md`) and the scripts that made the media and marks.
  None of them runs when the site is served.

## when the contract changes

The doc is the source. After a change to `docs/coordination-contract.md` (or the paper), in the CommandAGI checkout:

```
node scripts/seed/vibegov-contract.mjs
```

then commit here, push this repository's `main`, and move the gitlink in CommandAGI.

## what the site keeps

- Static, with no build: `site.json`, HTML, CSS, SVG, fonts, media, PDFs and JavaScript.
- No request leaves the page. Every page's CSP is `default-src 'self'`, `script-src 'self'`, `connect-src 'none'`.
  The one exception is the join page's form, which a visitor sends on purpose (`form-action https://commandagi.com`).
- English only, one page per address.
- The RFC on the landing page is illustrative, and says so.

## test

`node --test site.test.mjs` (Node 22 or 24, no dependencies) checks the three pages: their contents line and canonical
address, that every relative link resolves on disk, the CSP of each page, that the contract page holds the twelve
kernel articles and the two PDFs, that every loop is muted, poster-first, under 3 MB and captioned as generated, and
that the RFC scene tallies as the contract does (an option scores the sum of its voices' −2 to +2).

## deploy

From this folder: `commandagi sites deploy --prod`.
