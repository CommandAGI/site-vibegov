# site-vibegov

The site of VibeGov, a company of CommandAGI (`seed/drive/platform/org-vibegov/` in the CommandAGI repository): a
static folder served by CommandAGI's site hosting at https://vibegov.commandagi.app, with `vibegov.pro`,
`vibegov.tech` and `vibegov.me` as its domains.

- `index.html`, `constitution.html`, `about.html`: the site. The constitution template is the company's charter
  (`charter.md` on the org's Drive) written out article by article.
- `demo.html` and `demo.js`: the governance room. One round of governance on **Helios Labs**, an invented sample
  organization: choose a proposal, vote with a weight and a reason, audit the round against the constitution, read the
  panel's ruling. Every word is in `demo.js` in the three locales; the record stays in the page.
- `es/`, `zh/`: the same pages in Spanish and Simplified Chinese, one static page per locale, with `hreflang`
  alternates on every page.
- `gov.js`: the document's apparatus on every page: the phone's contents popover, line numbers in the margin, the
  loops that play only when seen (and never under reduced motion), and the landing page's amendment scene (five states
  of Article 4 of Helios Labs, driven by scroll on a wide screen and by buttons everywhere, announced in `aria-live`).
- `style.css`, `fonts/` (Literata and Public Sans, variable, OFL, self-hosted), `media/` (three generated loops, AV1
  and H.264, with WebP posters), `wordmark.svg`, `seal.svg`, `mark.svg` (the favicon), `og.png`,
  `apple-touch-icon.png`.
- `redesign/`: the 2027 redesign: the audit (`CONTENT.md`), the design (`DESIGN.md`), the media log and scores
  (`NOTES.md`), and the scripts that made the media and marks (`media.mjs`, `encode.sh`, `marks.py`, `og.html`,
  `shoot.py` for screenshots). None of them runs when the site is served.
- `lang.js`: the footer's **A/文** button and its language dialog (`docs/sites.md` § the language button in the
  CommandAGI repository). The rows are plain links, so the pages work with no script.

## what the site keeps

- Static, with no build: `site.json`, HTML, CSS, SVG, fonts, media and JavaScript (the media were made once and are
  committed).
- No request leaves the page. Every page's CSP is `default-src 'self'`, `script-src 'self'`, `connect-src 'none'`.
  There is no external font, script, stylesheet, image, video or tracker.
- English at `/`, Spanish at `/es/`, Simplified Chinese at `/zh/`; `en`, `es` and `zh-Hans` `hreflang` alternates on
  every page, `x-default` to the English one.
- The sample organization, its people and its agents are invented. The site names no real customer and no price.

## test

`node --test site.test.mjs` (Node 22 or 24, no dependencies) checks the pages: the three locales of every page, the
`hreflang` set, the language button and its dialog, that every relative link resolves on disk, that each locale's files
are the same site, the CSP on every page, and that the demo's messages exist in all three locales and match the labels
the script uses; that every loop is muted, poster-first, under 3 MB and captioned as generated; and that the
amendment scene counts by the template's rules (a person 3, an agent at most 2, two-thirds of the weight cast) with
one count in every locale.
