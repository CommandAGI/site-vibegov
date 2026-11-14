// rfcs.html for a visitor (redesign/APP.md § the pages): the act is "Sign in to …", which comes back to the form.
// Found by test/journeys.py (journey 1). Run: node --test test/rfcs-visitor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../rfcs.js';

test('a visitor is asked to sign in to open a proposal, and comes back to the form', () => {
  const html = L.renderOpenAct({ rfcDepositCents: 1000 }, { signedIn: false });
  assert.match(html, /Sign in to open a proposal/);
  assert.ok(html.includes('href="signin.html?next=propose.html"'));
  assert.match(html, /deposit of \$10\.00/);
  assert.ok(!html.includes('href="propose.html"'));
});
