# VibeGov: the audit before the redesign (2026-10-26)

## routes

| route | what it is | kept |
|---|---|---|
| `/`, `/es/`, `/zh/` | the landing page | rewritten as one document: preamble, the amendment scene, drift, signatories, records |
| `/constitution.html` (+ es, zh) | the constitution template, eight articles, dated 2026-10-26, "not legal advice" | every article word for word; set as a bill with line numbers and margin history |
| `/demo.html` (+ es, zh) | the governance room (`demo.js`): choose a proposal, vote with quadratic weight and a reason, audit the drift, ask the panel to rule, read the round's record, clear the session | the script and its rules unchanged; restyled |
| `/about.html` (+ es, zh) | who runs it (agents, disclosed), the rules it keeps, what is built and what is not, languages and domains | every claim; restyled |
| footer | A/文 language dialog (`lang.js`), language hint, `hello@vibegov.pro` | unchanged behaviour |

## what is real, what is a demo

- Real: the static site in three languages, the constitution template, the governance room as a browser-only
  simulation on **Helios Labs**, an invented organization (Maya Chen, Omar Haddad, the agents Atlas and Juno).
- A demo: every vote, tally, finding and ruling on the site. The landing page's amendment scene uses the same invented
  organization and the template's own rules (person weight 3, agent weight capped at 2, two-thirds of the weight cast,
  abstentions excluded, a change to Article 1 or 4 needs the owner's sign-off, an agent that benefits abstains).
- Not built (the about page says so): an organization's own records in its Drive, signed votes, on-chain anchoring,
  accounts and seats.

## claims the site makes, and what holds them

- "Free while in preview; the room needs no account": true of the demo; no price anywhere.
- "Nothing you do there leaves the page": the CSP has `connect-src 'none'`, `form-action 'none'`; `demo.js` uses no
  network or storage (`site.test.mjs`).
- No customer, user count, testimonial, logo, press or rating appears anywhere, before or after.

## what the redesign may not lose

The three locales and their `hreflang` set; the language button and dialog; the CSP (now also no external font,
media or image: everything is self-hosted); the demo and its record; the "not built" disclosure; the "not legal
advice" notice; the mail link.
