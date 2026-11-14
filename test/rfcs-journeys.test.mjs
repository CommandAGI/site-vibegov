// What test/journeys.py found on the proposal pages against a local platform. Run: node --test test/rfcs-journeys.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../rfcs.js';
import * as P from '../rfc.js';

test('a visitor is asked to sign in to open a proposal, and comes back to the form', () => {
  const html = L.renderOpenAct({ rfcDepositCents: 1000 }, { signedIn: false });
  assert.match(html, /Sign in to open a proposal/);
  assert.ok(html.includes('href="signin.html?next=propose.html"'));
  assert.match(html, /deposit of \$10\.00/);
  assert.ok(!html.includes('href="propose.html"'));
});

test('opening a proposal needs an account and the deposit, not a voice (the route asks no personhood: openRfcFor)', () => {
  const html = L.renderOpenAct({ rfcDepositCents: 1000 });
  assert.doesNotMatch(html, /voice/);
  assert.match(html, /needs a CommandAGI account and a deposit of \$10\.00/);
});

// Journey 6: a law RFC whose deliberation kept the status quo is decided, and its outgoing engine was never asked.
test('a decided proposal never says it waits for the outgoing engine', () => {
  const v = { rfc: { target: 'law' }, status: 'rejected', concurrence: { deliberation: 'd1' } };
  assert.doesNotMatch(P.renderConcurrence(v), /Waiting for the outgoing engine/);
  assert.match(P.renderConcurrence({ ...v, status: 'deciding' }), /Waiting for the outgoing engine/);
});
