# the signed-in pages: an interface to the government

Owner, 2026-11-13: "make it so that users can log in and submit cases, view RFCs, etc: do everything to interface with
the government, without needing to go through CommandAGI." And: "this is a financial and legal system, so it needs to
feel professional."

A person signs in on this site and does every act of the Coordination Contract here. The site stays static: no
server, no database, no build. Read this file before you write a signed-in page.

## the session (`session.js`)

VibeGov is a brand of CommandAGI (CommandAGI `docs/brands.md`): a platform-owned OAuth client, `vibegov`. A person
signs in with a CommandAGI account (`signIn`, `signUp`), and the page calls the API from the browser with that
person's own token (`api(path, { method, body })`). The site holds no credential of its own. An act is the same act
the workbench's contract editor does, through the same door, and the contract records who did it.

- `signedIn()`, `session()`, `requireSignIn()` (sends a visitor to `signin.html?next=<this page>`), `signOut()`.
- `api()` throws `ApiError` (`status`, `code`, `message` in plain words, `body`).
- The document fires a `session` event when the session changes.

## the API (`contract-api.js`)

One function per act, copied from the contract editor's `api.ts` (CommandAGI
`packages/applets/contract/src/ui/api.ts`): `loadMe`, `loadAwaiting`, `listRfcs`, `loadRfc`, `openRfc`,
`respondToRfc`, `confirmResponse`, `contestInterpretation`, `listMyCases`, `loadCase`, `fileCase`, `submitEvidence`,
`appealCase`, `raiseStakes`, `requestFreeze`, `uploadMedia`, `listNotices`, `markNoticeRead`, `listMandates`,
`createMandate`, `closeMandate`, `drawFacility`, `loadMyCredit`, `loadFacility`, `repayFacility`, `offerTransfer`,
`acceptOffer`, `withdrawOffer`, `startIdentityVerification`, `loadDetermination`, `loadOverview`.

- A read answers its data, or `null` when it could not be read.
- An act answers `{ ok: true, … }` or `{ ok: false, refusals: [{ code, … }] }`.
- The public record needs no session: `live.js` reads it (`getJson(fetch, API, '/public/contract/…')`).

To update it: copy the editor's `api.ts` with its types removed, keep this file's `get` and `post`.

## words (`contract-words.js`)

`WORDS` is the editor's English catalog (CommandAGI `packages/applets/contract/messages/en/app.json`, the keys under
`app.contract`), and the helpers under it are the editor's `words.ts`. `words('refusals')(code, values)` words a
refusal; `words('caseForm')`, `words('rfcForm')`, `words('respond')`, `words('needs')`, `words('credit')`,
`words('stages')`, `words('status')` … word each surface. Use these words. Do not write a second wording of a thing
the catalog words. A refusal code with no words is shown as its code (`hasWords`).

To update it: flatten the catalog's `app.contract` keys into `WORDS` and paste
`words.ts` with its types removed under it.

## the reference implementation

The contract editor in CommandAGI (`packages/applets/contract/src/ui/`, React) does every act already. A signed-in
page here is a port of the editor's surface to plain HTML and one JavaScript module, not a new design of the act:

| this site | the editor's source |
|---|---|
| Home: what needs you, your voice, notices | `NeedsPanel.tsx`, `Overview.tsx`, `ContractEditor.tsx` |
| proposals: the list, one RFC, respond, confirm, contest | `RfcView.tsx`, `RespondPanel.tsx`, `MediaAttach.tsx`, `DeterminationView.tsx` |
| open a proposal | `RfcForm.tsx`, `words.ts` (`describeLawChange`, `PARAMETER_KEYS`) |
| cases: the list, one case, file, answer, evidence, appeal | `CaseForm.tsx`, `CaseView.tsx`, `CaseActions.tsx`, `words.ts` (`reliefProblems`, `toRemedies`) |
| credit: mandates, facilities, repayments, offers | `Credit.tsx`, `words.ts` (`mandateRequest`) |

Keep the editor's checks, its order of fields and its refusals. Leave out what is the workbench's own (files in a
Drive: `files.ts`, `code-source.ts`; the device stream picker: `StreamAttach.tsx`).

## the pages

| page | who | what |
|---|---|---|
| `signin.html` | a visitor | sign in, make an account, reset a password; then back to `?next=` |
| `home.html` (Home) | signed in | the four acts, what needs you, your voice (and how to get one), notices, balance, sign out |
| `rfcs.html` | anyone | every proposal, open first; a signed-in person sees which ones wait for them |
| `rfc.html?id=` | anyone reads; a voice acts | the options, the count or the tally, the decision; respond, confirm, contest |
| `propose.html` | signed in | open a proposal: options, each a set of changes to the law or the engine |
| `cases.html` | anyone | the public judgments; a signed-in person's own cases |
| `case.html?id=` | a party | the record, the clock, answer, add evidence, appeal, raise stakes, ask a freeze |
| `file.html` | signed in | file a case: respondent, act, duty, harm items, remedies |
| `credit.html` | anyone reads; an account acts | open mandates; your facilities; draw, repay, offer, accept |

A page that only a signed-in person can use calls `requireSignIn()` first. A page that anyone reads shows the public
record to a visitor, and the acts with "Sign in to …" in their place.

## how a page is made

Copy this frame. Change the title, the description, the canonical address, `aria-current` and the body of `<main>`.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.commandagi.com; media-src 'self' blob: https://api.commandagi.com; connect-src 'self' https://api.commandagi.com; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="vibegov-api" content="https://api.commandagi.com">
<title>PAGE · VibeGov</title>
<meta name="description" content="…">
<link rel="canonical" href="https://vibegov.pro/PAGE.html">
<meta name="theme-color" content="#f7f4ed">
<link rel="preload" href="fonts/public-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
<link rel="icon" href="mark.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<script src="gov.js" defer></script>
<script type="module" src="shell.js"></script>
<script type="module" src="PAGE.js"></script>
</head>
<body class="open">
<a class="skip" href="#main">Skip to the content</a>
<header class="runhead">
  <div class="runhead__in">
    <a class="wordmark" href="index.html" aria-label="VibeGov, home"><img src="mark.svg" alt="" width="26" height="26">VibeGov</a>
    <button class="contents-btn" type="button" popovertarget="contents" aria-controls="contents" aria-label="Menu"><span aria-hidden="true"></span></button>
    <nav id="contents" class="contents" popover aria-label="Site">
      <ol><li><a href="record.html">The record</a></li><li><a href="contract.html">The contract</a></li><li><a href="rfcs.html">Proposals</a></li><li><a href="cases.html">Cases</a></li><li><a href="credit.html">Credit</a></li></ol>
    </nav>
    <span class="runhead__act" data-account></span>
  </div>
</header>
<div class="tape" data-live="tape" aria-label="The contract’s figures now" aria-busy="true"></div>

<main id="main" class="sheet">
  <div class="desk">
    <header class="desk__head"><div><h1>…</h1><p>One sentence that says what this page is for.</p></div></header>
    <section aria-labelledby="…"><h2 id="…">…</h2> … </section>
  </div>
</main>

<footer class="site-foot"> (copy record.html's footer: one line, "a company of CommandAGI" linked to commandagi.com) </footer>
</body>
</html>
```

- **On a narrow screen the header is the wordmark and three bars.** The bars open the menu over the whole screen
  under the header and turn into an X; `shell.js` ends the menu with the account control (Home or Sign in), which
  the header shows only on a wide screen.
- **No inline script and no inline event handler**: the CSP refuses them. One module per page (`PAGE.js`).
- **No library, no build, no framework.** Plain DOM. A render function is pure where it can be (data in, escaped
  HTML out, like `live.js`), so a test can call it with no browser.
- **Every value from the API or a person is escaped** (`esc` from `session.js` or `live.js`) before it goes into
  HTML. A title is text, never markup.
- **Reuse `live.js`** for numbers, money, times and durations (`count`, `money`, `relative`, `date`, `duration`,
  `countdown`), and for the public record's renderers.

## how a signed-in page looks

It is a desk, not a show: the classes are in `style.css` § the signed-in pages.

- `.desk` (the page), `.desk__head` (title and one sentence), a `<section>` per thing with a serif `<h2>`.
- `.rows` for a list (reference, title with a `<small>` line, a `.state` at the right).
- `.form`, `.field` (a `<label>` above, a `.hint` under), `.fieldset` for a group that repeats, `.form__act` for the
  button and what it costs.
- `.kv` for facts. `.state` (`--open`, `--yours`, `--done`, `--bad`) for a status. `.refusal` for what was refused,
  in the catalog's words. `.done` for what was done.
- Buttons are `.btn` (and one `.btn.primary` for the page's one act). No pill, no rounded corner, no card with a
  shadow, no icon font, no emoji.
- **No motion** but a shimmer where something is being read (`<p class="note loading">Reading …</p>`): no other
  animation, no transition that moves something, no confetti, no count-up. This is a legal and financial system.
- **Say what an act costs and what it binds before the button**: a deposit and whether it comes back, a deadline, that
  a confirmed response is counted, that a filing is served on the respondent. Money is exact (`money(cents)`).
- **Say every state in words**: loading ("Reading your cases…"), none ("You have no open case."), refused (the
  refusal's words), not reached (the API's address).
- English only. Headings are 2 to 4 words. Sentences are short and active.

## testing

- `node test/serve.mjs --fake test/fake-<area>.mjs` serves the site and answers the API from a module, on one origin
  (the pages' CSP admits only the site's own origin and the API). `--api <url>` proxies to a local platform
  instead. `serve()` is exported for tests.
- A page's test is `test/<area>.test.mjs` (`node --test test/<area>.test.mjs`): its pure render functions against
  shapes the API really answers (read the route and its test in CommandAGI for the shape; do not invent a field),
  and the page's frame (CSP, one module, no inline script, the contents line).
- `site.test.mjs` is the public pages' test. A signed-in page's test never edits it.
- Browser check: headless Chrome is at
  `/home/brandonin/.cache/commandagi/chrome-for-testing/157.0.8103.78/chrome-linux-arm64/chrome` (Python Playwright
  is installed; launch with `--enable-gpu --ignore-gpu-blocklist --use-angle=gl-egl`). Never open a window on the
  owner's display.
