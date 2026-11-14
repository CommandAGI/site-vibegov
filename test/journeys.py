#!/usr/bin/env python3
"""The signed-in site's journeys, end to end, in headless Chrome, against a LOCAL CommandAGI platform.

Never against production: the Coordination Contract there is a real public ledger.

    # 0. a CommandAGI checkout at github/main with its dependencies (pnpm install --frozen-lockfile --ignore-scripts;
    #    git submodule update --init sdk/typescript), named by COMMANDAGI_ROOT when it is not five folders up
    # 1. a local platform (the api worker under workerd, no network, a stand-in engine; test/platform.mjs's header)
    COMMANDAGI_ROOT=<checkout> nice -n 10 node test/platform.mjs --dir /tmp/vibegov-platform --port 8799 --fake-engine &
    # 2. the site, proxying the API on its own origin (the pages' CSP admits only 'self')
    node test/serve.mjs --port 4330 --api http://127.0.0.1:8799 &
    # 3. the journeys (Python Playwright)
    python3 test/journeys.py --site http://127.0.0.1:4330 --api http://127.0.0.1:8799 \
        --control http://127.0.0.1:8800 --db <state>/state/v3/d1/miniflare-D1DatabaseObject/<id>.sqlite --shots <dir>

Every act is done through the pages (clicks and typing). The test calls the API or the database only to set up what
a second party or the world must do, and says so where it does:
- a voice: Stripe Identity cannot run here, so the account's row gets what a verified identity writes
  (`id_verified`, `personhood_key`, `personhood_issuer = platform_kyc`), as the API's own tests seed it.
- a balance: Stripe Checkout cannot run here, so an operator account (made `is_admin` in the database) grants
  credits through the platform's own admin door, `POST /admin/console/users/:id/credits`.
- time: an RFC's window or a case's clock is moved into the past in the database, then the contract's sweep runs
  (test/platform.mjs's control port), as the cron would when the time came.
- the engine: with --fake-engine every model seat is answered by test/platform.mjs with the first label of its own
  question (FAKE_ENGINE_PREFER changes that); the Workers AI seats are unavailable. Readings and judgments are real
  runs of the contract's code over meaningless answers.
- the anonymous answer (journey 11) is real: the browser proves with Semaphore and the platform verifies the proof.
A run takes about 6 minutes. Screenshots go to --shots; a failed journey leaves j<n>-FAILED-<i>.png there.
"""
import argparse, json, os, re, sqlite3, sys, time, traceback, urllib.request, uuid
from playwright.sync_api import sync_playwright, expect

CHROME = '/home/brandonin/.cache/commandagi/chrome-for-testing/157.0.8103.78/chrome-linux-arm64/chrome'
ap = argparse.ArgumentParser()
ap.add_argument('--site', default='http://127.0.0.1:4330')
ap.add_argument('--api', default='http://127.0.0.1:8799')
ap.add_argument('--control', default='http://127.0.0.1:8800')
ap.add_argument('--db', required=True)
ap.add_argument('--shots', default='/tmp/vibegov-e2e')
ap.add_argument('--only', default='')
args = ap.parse_args()
os.makedirs(args.shots, exist_ok=True)
SITE = args.site.rstrip('/')
RUN = uuid.uuid4().hex[:6]
# The contract refuses options a recent RFC already put (rfc.repeat): each run's values differ by a few seconds or cents.
JITTER = int(RUN, 16) % 900 + 1
results = {}


# ─── setup doors: what a second party or the world does ─────────────────────────

def http(method, url, body=None, token=None, form=False):
    data = None
    headers = {'accept': 'application/json'}
    if body is not None:
        if form:
            data = '&'.join(f'{k}={urllib.request.quote(str(v))}' for k, v in body.items()).encode()
            headers['content-type'] = 'application/x-www-form-urlencoded'
        else:
            data = json.dumps(body).encode()
            headers['content-type'] = 'application/json'
    if token:
        headers['authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            text = r.read().decode()
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        try:
            return e.code, json.loads(text)
        except Exception:
            return e.code, {'raw': text}


def sql(stmt, params=()):
    db = sqlite3.connect(args.db, timeout=30)
    try:
        cur = db.execute(stmt, params)
        rows = cur.fetchall()
        db.commit()
        return rows
    finally:
        db.close()


def user_id(email):
    rows = sql('select id from users where email = ?', (email,))
    return rows[0][0] if rows else None


def give_voice(email):
    """Stand-in for Stripe Identity: what a verified identity writes on the account (contract.test.ts seeds the same)."""
    uid = user_id(email)
    sql("update users set id_verified = 1, id_verified_at = ?, id_verification_status = 'verified', personhood_key = ?, personhood_issuer = 'platform_kyc' where id = ?",
        (int(time.time() * 1000), f'journey-{RUN}-{uid[:8]}', uid))
    return uid


OPERATOR = {}


def operator_token():
    """An operator account, made `is_admin` in the database, whose token uses the platform's admin door."""
    if 'token' not in OPERATOR:
        email = f'operator-{RUN}@example.test'
        s, b = http('POST', f'{args.api}/oauth/signup', {'client_id': 'vibegov', 'name': 'Operator', 'email': email, 'password': 'operator-password-1', 'scope': '*'})
        assert s == 200, (s, b)
        sql('update users set is_admin = 1 where email = ?', (email,))
        OPERATOR['token'] = b['access_token']
    return OPERATOR['token']


def give_credits(email, credits):
    """Stand-in for Stripe Checkout: credits granted through `POST /admin/console/users/:id/credits`."""
    s, b = http('POST', f'{args.api}/admin/console/users/{user_id(email)}/credits', {'amount': credits, 'reason': 'journey.deposits'}, token=operator_token())
    assert s == 200, (s, b)
    return b['credits']


def tick():
    s, b = http('POST', f'{args.control}/__tick')
    assert s == 200, (s, b)


# ─── the browser ─────────────────────────────────────────────────────────────────

class Watch:
    """Every page error, console error, CSP violation and request to another origin, per person."""

    def __init__(self, name):
        self.name, self.errors, self.foreign = name, [], []

    def attach(self, page):
        page.on('pageerror', lambda e: self.errors.append(f'pageerror {page.url}: {e}'))
        page.on('console', lambda m: m.type == 'error' and self.errors.append(f'console {page.url}: {m.text}'))
        page.on('request', lambda r: (not r.url.startswith(SITE) and not r.url.startswith('data:') and not r.url.startswith('blob:')) and self.foreign.append(r.url))


def person(browser, name, viewport=None):
    ctx = browser.new_context(viewport=viewport or {'width': 1280, 'height': 900})
    page = ctx.new_page()
    w = Watch(name)
    w.attach(page)
    page.watch = w
    return page


def shot(page, name, full=True):
    path = os.path.join(args.shots, f'{name}.png')
    page.screenshot(path=path, full_page=full)
    return path


def go(page, path):
    page.goto(f'{SITE}/{path}', wait_until='domcontentloaded')
    page.wait_for_load_state('networkidle')


def text(page, sel):
    return page.locator(sel).inner_text()


def sign_up(page, name, email, password):
    go(page, 'signin.html?mode=signup')
    page.fill('#up-name', name)
    page.fill('#up-email', email)
    page.fill('#up-password', password)
    page.click('#signup button[type=submit]')
    page.wait_for_url(re.compile(r'home\.html'))
    page.wait_for_load_state('networkidle')


def sign_in(page, email, password, next_=None):
    go(page, 'signin.html' + (f'?next={urllib.request.quote(next_)}' if next_ else ''))
    page.fill('#in-email', email)
    page.fill('#in-password', password)
    page.click('#signin button[type=submit]')


def sign_out(page):
    go(page, 'home.html')
    page.click('[data-signout]')
    expect(page).to_have_url(re.compile(r'/index\.html$'))
    expect(page.locator('[data-account] a')).to_have_text('Sign in')


def journey(n, title):
    def wrap(fn):
        def run(*a, **k):
            if args.only and str(n) not in args.only.split(','):
                return
            print(f'── journey {n}: {title}', flush=True)
            try:
                note = fn(*a, **k)
                results[n] = ('passed', note or '')
            except Exception as e:
                traceback.print_exc()
                for i, pg in enumerate(a):
                    try:
                        shot(pg, f'j{n}-FAILED-{i}')
                    except Exception:
                        pass
                results[n] = ('failed', f'{type(e).__name__}: {e}')
        return run
    return wrap


# ─── the journeys ────────────────────────────────────────────────────────────────

A = {'name': f'Ada Journey {RUN}', 'email': f'ada-{RUN}@example.test', 'password': 'ada-password-1'}
B = {'name': f'Ben Journey {RUN}', 'email': f'ben-{RUN}@example.test', 'password': 'ben-password-1'}


@journey(1, 'a visitor reads the public pages; each act says Sign in to …')
def j1(visitor):
    for page in ['rfcs.html', 'cases.html', 'credit.html']:
        go(visitor, page)
        visitor.wait_for_timeout(800)
        body = text(visitor, 'main')
        shot(visitor, f'j1-visitor-{page[:-5]}')
        assert re.search(r'Sign in to ', body), f'{page}: no "Sign in to …" for a visitor'


@journey(2, 'make an account, land on the desk, sign out and in, a wrong password, ?next=')
def j2(a):
    sign_up(a, A['name'], A['email'], A['password'])
    expect(a.locator('[data-part="account"]')).to_contain_text(A['email'])
    shot(a, 'j2-desk-new-account')
    sign_out(a)
    sign_in(a, A['email'], 'not-the-password')
    expect(a.locator('#signin [data-error]')).to_have_text('That email or password is not right.')
    shot(a, 'j2-wrong-password')
    sign_in(a, A['email'], A['password'], next_='rfcs.html')
    expect(a).to_have_url(re.compile(r'/rfcs\.html$'))
    sign_out(a)
    # An outside address in ?next= is refused: the person lands on the desk.
    # Five sign-ins in this journey: the platform allows five a minute per account (LOGIN_RL_ACCOUNT).
    for outside in ['https://evil.example/', '//evil.example']:
        sign_in(a, A['email'], A['password'], next_=outside)
        expect(a).to_have_url(re.compile(r'/home\.html$'))
        sign_out(a)
    sign_in(a, A['email'], A['password'])
    expect(a).to_have_url(re.compile(r'/home\.html$'))


@journey(3, 'a voice (stood in for Stripe Identity), shown on the desk')
def j3(a):
    go(a, 'home.html')
    expect(a.locator('[data-part="voice"]')).not_to_contain_text('Reading')
    before = text(a, '[data-part="voice"]')
    shot(a, 'j3-desk-no-voice')
    give_voice(A['email'])
    go(a, 'home.html')
    expect(a.locator('[data-part="voice"] code')).to_contain_text('human:')
    shot(a, 'j3-desk-voice')
    return f'before: {before[:120]!r}'


@journey(4, 'a balance for deposits (stood in for Stripe Checkout), shown exactly')
def j4(a):
    credits = give_credits(A['email'], 2345)  # shown exactly below; journey 8 adds what a mandate escrows
    go(a, 'home.html')
    expect(a.locator('[data-part="balance"] .desk__figure')).to_contain_text('$23.45')
    expect(a.locator('[data-part="balance"] .desk__figure')).to_contain_text('2,345 credits')
    shot(a, 'j4-desk-balance')
    return f'granted; the API says {credits} credits'


RFC = {}
CASE = {}


@journey(5, 'propose.html opens an RFC with two options; it shows on rfc.html, rfcs.html and the public pages')
def j5(a):
    proposals_before = len(http('GET', f'{args.api}/public/contract/rfcs')[1]['rfcs'])
    go(a, 'propose.html')
    expect(a.locator('#f-title')).to_be_visible()
    title = f'A shorter appeal window {RUN}'
    a.fill('#f-title', title)
    a.fill('#f-body', 'Seven days to appeal is long for small cases. Shorten it, or keep it and halve the deposit.')
    a.fill('#f-options-0-title', 'Five day appeals')
    a.select_option('#f-options-0-changes-0-key', 'appealMs')
    a.fill('#f-options-0-changes-0-value', str(5 * 86_400_000 + JITTER * 1000))
    a.click('[data-act="add-option"]')
    a.fill('#f-options-1-title', 'Cheaper cases')
    a.select_option('#f-options-1-changes-0-key', 'caseDepositCents')
    a.fill('#f-options-1-changes-0-value', str(200 + JITTER % 100))
    shot(a, 'j5-propose-filled')
    expect(a.locator('#open')).to_be_enabled()
    a.click('#open')
    a.wait_for_url(re.compile(r'rfc\.html\?id='), timeout=30000)
    RFC['id'] = a.url.split('id=')[1]
    RFC['title'] = title
    expect(a.locator('main')).to_contain_text(title)
    a.wait_for_load_state('networkidle')
    shot(a, 'j5-rfc-opened')
    go(a, 'rfcs.html')
    expect(a.locator('[data-slot="list"]')).to_contain_text(title)
    shot(a, 'j5-rfcs-list')
    go(a, 'index.html')
    a.wait_for_timeout(1500)
    home = text(a, 'body')
    shot(a, 'j5-home', full=True)
    go(a, 'record.html')
    a.wait_for_timeout(1500)
    record = text(a, 'body')
    shot(a, 'j5-record')
    tape = text(a, '[data-live="tape"]')
    notes = []
    if title not in home: notes.append('the title is not on index.html')
    if title not in record: notes.append('the title is not on record.html')
    if not re.search(rf'Proposals\s*{proposals_before + 1}\b', tape, re.I): notes.append(f'tape: {tape[:200]!r}')
    assert not notes, '; '.join(notes)
    return f'rfc {RFC["id"]}; balance after the deposit: ' + balance_of(a)


def balance_of(page):
    go(page, 'home.html')
    loc = page.locator('[data-part="balance"] .desk__figure')
    expect(loc).to_be_visible()
    return loc.inner_text().replace('\n', ' ')


@journey(6, 'a second person with a voice answers the RFC; the desk changes; the sweep reads it')
def j6(a, b):
    sign_up(b, B['name'], B['email'], B['password'])
    give_voice(B['email'])
    give_credits(B['email'], 1500)
    go(b, 'home.html')
    expect(b.locator('[data-part="needs"]')).to_contain_text(RFC['title'])
    shot(b, 'j6-desk-b-needs')
    go(b, f'rfc.html?id={RFC["id"]}')
    expect(b.locator('#resp-text')).to_be_visible()
    b.fill('#resp-text', 'Five days is enough to appeal. Keep the case deposit as it is.')
    b.click('[data-act="send"]')
    expect(b.locator('[data-act="confirm-receipt"]')).to_be_visible()
    shot(b, 'j6-rfc-receipt')
    b.click('[data-act="confirm-receipt"]')
    b.wait_for_timeout(1500)
    shot(b, 'j6-rfc-confirmed')
    expect(b.locator('main')).to_contain_text(re.compile('Confirmed', re.I))
    go(b, 'home.html')
    expect(b.locator('[data-part="needs"]')).not_to_contain_text(RFC['title'])
    shot(b, 'j6-desk-b-after')
    # The window runs out (moved in the database), then the sweep reads the responses.
    past = int(time.time() * 1000) - 1000
    sql("update contract_rfcs set closes_at = ?, next_due_at = ?, rfc = case when json_extract(rfc, '$.closesAt') is null then rfc else json_set(rfc, '$.closesAt', ?) end where id = ?", (past, past, past, RFC['id']))
    tick()
    time.sleep(3)
    tick()
    go(b, f'rfc.html?id={RFC["id"]}')
    b.wait_for_timeout(1500)
    shot(b, 'j6-rfc-after-sweep')
    s, rfc = http('GET', f'{args.api}/public/contract/rfcs/{RFC["id"]}')
    read = rfc.get('status')
    shot(b, 'j6-rfc-reading')
    # The contest window runs out (moved in the database); the sweep decides.
    for _ in range(4):
        past = int(time.time() * 1000) - 1000
        sql("update contract_rfcs set contest_until = ?, next_due_at = ?, rfc = case when json_extract(rfc, '$.contestUntil') is null then rfc else json_set(rfc, '$.contestUntil', ?) end where id = ?", (past, past, past, RFC['id']))
        # Each reading's own contest window (the extraction's `contestUntil`) is what the sweep waits for.
        sql("update contract_extractions set extraction = json_set(extraction, '$.contestUntil', ?) where rfc_id = ?", (past, RFC['id']))
        tick()
        time.sleep(3)
        s, rfc = http('GET', f'{args.api}/public/contract/rfcs/{RFC["id"]}')
        if rfc.get('status') in ('adopted', 'rejected'):
            break
    go(b, f'rfc.html?id={RFC["id"]}')
    b.wait_for_timeout(1500)
    shot(b, 'j6-rfc-decided')
    assert rfc.get('status') in ('adopted', 'rejected'), f'not decided: {rfc.get("status")}'
    expect(b.locator('#h-tally')).to_have_text('Tally')
    expect(b.locator('#h-decision')).to_be_visible()
    go(b, 'rfcs.html')
    expect(b.locator('section[aria-labelledby="g-decided"]')).to_contain_text(RFC['title'])
    return f'read ({read}), then decided: {rfc.get("status")}'


def first_option(page, sel):
    vals = page.eval_on_selector(sel, 'el => [...el.options].filter(o => o.value && !o.disabled).map(o => o.value)')
    page.select_option(sel, vals[0])
    return vals[0]


def png(path):
    """A small real PNG (an 8x8 red square), written once, for the media door."""
    import struct, zlib
    if not os.path.exists(path):
        raw = b''.join(b'\x00' + b'\xff\x00\x00' * 8 for _ in range(8))
        chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
        open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 8, 8, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
    return path


def advance_case(cid, ticks=3, clocks=True):
    """The case's clock runs out (moved in the database; with `clocks` false only the sweep is woken); the sweep moves it."""
    past = int(time.time() * 1000) - 1000
    if not clocks:
        sql('update contract_cases set next_due_at = ? where id = ?', (past, cid))
        for _ in range(ticks):
            tick()
            time.sleep(2)
        return sql('select stage from contract_cases where id = ?', (cid,))[0][0]
    # The clock is the case's own (`responseDue`, `evidenceDue` in its record); the row's `next_due_at` wakes the sweep.
    sql("""update contract_cases set next_due_at = ?, record = json_set(record,
             '$.case.responseDue', case when json_extract(record, '$.case.responseDue') is null then null else ? end,
             '$.case.evidenceDue', case when json_extract(record, '$.case.evidenceDue') is null then null else ? end)
           where id = ?""", (past, past, past, cid))
    for _ in range(ticks):
        tick()
        time.sleep(2)
    return sql('select stage from contract_cases where id = ?', (cid,))[0][0]


@journey(7, 'file.html: A files against B; B is served and answers with a figure; A adds text and an image; judgment; appeal')
def j7(a, b):
    b_id = user_id(B['email'])  # what B tells A: their account id (the site shows it nowhere: see the report)
    go(a, 'file.html')
    expect(a.locator('#f-respondent')).to_be_visible()
    a.fill('#f-respondent', b_id)
    duty = 'breach'  # civil: an agreement the respondent did not perform
    a.select_option('#f-duty', duty)
    a.fill('#f-act', 'On 2 November the respondent took the delivered parts and did not pay the agreed price.')
    a.fill('#f-harm-0-id', 'unpaid')
    a.select_option('#f-harm-0-interest', 'agreement')
    a.fill('#f-harm-0-description', 'The price of the parts, not paid.')
    a.fill('#f-harm-0-amount', '120.00')
    first_option(a, '#f-relief-0-kind')
    box = a.locator('input[data-k="relief.0.harm"]').first
    if not box.is_checked():
        box.check()
    a.fill('#f-relief-0-description', 'Pay the price.')
    if a.locator('#f-relief-0-amount').count():
        a.fill('#f-relief-0-amount', '120.00')
    a.fill('#f-evidence', 'The delivery note, signed by the respondent on 2 November.')
    shot(a, 'j7-file-filled')
    expect(a.locator('#file-submit')).to_be_enabled(timeout=5000)
    a.click('#file-submit')
    a.wait_for_url(re.compile(r'case\.html\?id='), timeout=30000)
    cid = a.url.split('id=')[1]
    CASE['id'] = cid
    a.wait_for_load_state('networkidle')
    shot(a, 'j7-case-filed')
    stage = advance_case(cid, clocks=False)  # screened and served
    go(b, 'home.html')
    b.wait_for_timeout(1000)
    shot(b, 'j7-desk-b-served')
    expect(b.locator('[data-part="notices"]')).to_contain_text(re.compile('case', re.I))
    expect(b.locator('[data-part="needs"]')).to_contain_text(re.compile('respondent', re.I))
    go(b, f'case.html?id={cid}')
    expect(b.locator('#ev-text')).to_be_visible()
    b.fill('#ev-text', 'The parts came late and two were broken. I owe less than the price.')
    b.fill('#fig-unpaid', '40.00')
    shot(b, 'j7-case-b-answer')
    b.click('form[data-act="evidence"] button[type="submit"], form[data-act="evidence"] .btn.primary')
    b.wait_for_timeout(2000)
    shot(b, 'j7-case-b-answered')
    go(a, f'case.html?id={cid}')
    expect(a.locator('#ev-text')).to_be_visible()
    a.fill('#ev-text', 'A photograph of the parts on arrival: none is broken.')
    a.set_input_files('#ev-media', png(os.path.join(args.shots, 'evidence.png')))
    expect(a.locator('form[data-act="evidence"] .attached')).to_be_visible(timeout=20000)
    a.click('form[data-act="evidence"] .btn.primary')
    a.wait_for_timeout(2000)
    shot(a, 'j7-case-a-evidence')
    stages = [advance_case(cid)]
    for _ in range(3):
        if stages[-1] in ('judged', 'appealable', 'decided', 'final', 'closed', 'executed'):
            break
        stages.append(advance_case(cid))
    go(a, f'case.html?id={cid}')
    a.wait_for_timeout(1500)
    shot(a, 'j7-case-a-judged')
    go(b, f'case.html?id={cid}')
    b.wait_for_timeout(1500)
    shot(b, 'j7-case-b-judged')
    appealed = None
    for who, page in (('B', b), ('A', a)):  # the losing side appeals, if offered
        if page.locator('form[data-act="appeal"]').count():
            page.click('form[data-act="appeal"] .btn.primary')
            page.wait_for_timeout(2000)
            shot(page, f'j7-case-{who.lower()}-appealed')
            appealed = who
            break
    assert stages[-1] not in ('screening', 'serving', 'response', 'evidence'), f'no judgment: stages after the clocks {stages}'
    assert appealed, 'a judgment, and neither party was offered the appeal'
    expect((a if appealed == 'A' else b).locator('main')).to_contain_text(re.compile('appeal', re.I))
    return f'case {cid}; duty {duty}; stages after the clocks: {stages}; appealed by {appealed}'


@journey(8, 'credit.html: A opens a mandate; B draws; B repays an installment')
def j8(a, b):
    give_credits(A['email'], 10000)
    go(a, 'credit.html')
    expect(a.locator('#m-capital')).to_be_visible()
    a.fill('#m-capital', '50.00')
    a.fill('#m-min', '10.00')
    a.fill('#m-max', '30.00')
    a.fill('#m-rate', '5')
    a.fill('#m-term', '90')
    a.fill('#m-n', '3')
    a.fill('#m-open', '30')
    a.locator('input[name="borrowers"][value="persons"]').check()
    shot(a, 'j8-credit-mandate-filled')
    a.click('[data-act="create-mandate"]')
    a.wait_for_timeout(2000)
    shot(a, 'j8-credit-mandate-open')
    go(b, 'credit.html')
    b.locator('[data-act="open-draw"]').first.click()
    b.fill('#draw-amount', '20.00')
    b.fill('#draw-purpose', 'Parts for the next batch.')
    shot(b, 'j8-credit-draw-filled')
    b.click('[data-act="draw"]')
    b.wait_for_timeout(2000)
    shot(b, 'j8-credit-drawn')
    b.locator('[data-act="open-facility"]').first.click()
    expect(b.locator('#repay-amount')).to_be_visible()
    b.fill('#repay-amount', '7.00')
    b.click('[data-act="repay"]')
    b.wait_for_timeout(2000)
    shot(b, 'j8-credit-repaid')
    return text(b, '[data-slot="facility"]')[:400]


PAGES = ['index.html', 'record.html', 'contract.html', 'join.html', 'signin.html', 'home.html', 'rfcs.html', 'propose.html',
         'cases.html', 'file.html', 'credit.html']


@journey(9, 'every page at 390x844: no sideways overflow, nothing clipped')
def j9(browser):
    bad = []
    pages = PAGES + ([f'rfc.html?id={RFC["id"]}'] if RFC.get('id') else []) + ([f'case.html?id={CASE["id"]}'] if CASE.get('id') else [])
    for who, creds in (('visitor', None), ('A', A)):
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.watch = Watch(f'phone-{who}')
        page.watch.attach(page)
        if creds:
            sign_in(page, creds['email'], creds['password'])
            expect(page).to_have_url(re.compile(r'/home\.html$'))
        for path in pages:
            go(page, path)
            page.wait_for_timeout(1200)
            over = page.evaluate("""() => {
              const W = document.documentElement.clientWidth;
              // On a phone the page zooms out to the widest thing it held: innerWidth past the viewport is a sideways scroll.
              const wide = document.documentElement.scrollWidth > W + 1 || innerWidth > W + 1;
              // A box that scrolls or cuts on purpose (a table's wrapper, a strip of cards) holds what is past the edge.
              const scroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
              const out = [];
              for (const el of document.querySelectorAll('main *, header *, footer *')) {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                if (!r.width || cs.position === 'fixed' || el.closest('[hidden], .vh, .sr-only, [popover]')) continue;
                // Words that do not wrap spill out of their own box (a long id in a sentence).
                if (cs.overflowX === 'visible' && !scroller(el) && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && ![...el.children].some(c => c.scrollWidth > c.clientWidth + 1)) out.push(`spills: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: ${el.textContent.trim().slice(0, 40)}`);
                if ((r.right > W + 1 || r.left < -1) && !scroller(el)) out.push(`past the edge: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.left)}..${Math.round(r.right)}`);
                // Text cut with no ellipsis to say so.
                if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && !el.children.length) out.push(`cut: ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: ${el.textContent.trim().slice(0, 40)}`);
              }
              return { wide, sw: Math.max(document.documentElement.scrollWidth, innerWidth), W, out: out.slice(0, 8) };
            }""")
            name = re.sub(r'\W+', '-', path.split('?')[0].replace('.html', ''))
            shot(page, f'j9-phone-{who}-{name}')
            if over['wide'] or over['out']:
                bad.append(f'{who} {path}: scrollWidth {over["sw"]} > {over["W"]}; {over["out"]}')
        PHONES.append(page)
    assert not bad, '\n'.join(bad)


PHONES = []


@journey(11, 'anonymous voice: an identity made and registered on the desk answers a later RFC with a real proof')
def j11(a, b):
    go(a, 'home.html')
    panel = a.locator('[data-slot="anonymity"]')
    expect(panel.locator('[data-anon="create"]')).to_be_visible(timeout=20000)
    panel.locator('[data-anon="create"]').click()
    expect(panel.locator('[data-anon="register"]')).to_be_visible(timeout=30000)
    panel.locator('[data-anon="register"]').click()
    expect(panel).to_contain_text(re.compile('registered', re.I), timeout=30000)
    shot(a, 'j11-desk-registered')
    # A proposal opened after the registration pins the set with A in it. B opens it, through the form.
    give_credits(B['email'], 2000)
    go(b, 'propose.html')
    expect(b.locator('#f-title')).to_be_visible()
    title = f'Longer evidence windows {RUN}'
    b.fill('#f-title', title)
    b.fill('#f-body', 'Give each side ten days for evidence.')
    b.fill('#f-options-0-title', 'Ten day evidence')
    b.select_option('#f-options-0-changes-0-key', 'caseEvidenceMs')
    b.fill('#f-options-0-changes-0-value', str(10 * 86_400_000 + JITTER * 1000))
    b.click('#open')
    b.wait_for_url(re.compile(r'rfc\.html\?id='), timeout=30000)
    rid = b.url.split('id=')[1]
    go(a, f'rfc.html?id={rid}')
    expect(a.locator('[data-act="anon-send"]')).to_be_visible(timeout=30000)
    shot(a, 'j11-rfc-anonymous-panel')
    a.fill('#resp-text', 'Ten days is fairer to a party who must find records.')
    a.click('[data-act="anon-send"]')
    expect(a.locator('main')).to_contain_text('Received anonymously', timeout=120000)
    shot(a, 'j11-rfc-anonymous-sent')
    s, pub = http('GET', f'{args.api}/public/contract/rfcs/{rid}')
    assert pub.get('responses') == 1, f'the public count says {pub.get("responses")}'
    return f'rfc {rid}: the API verified the proof and counts {pub["responses"]} response'


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True, args=['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=gl-egl'])
        visitor, a, b = person(browser, 'visitor'), person(browser, 'A'), person(browser, 'B')
        j1(visitor)
        j2(a)
        j3(a)
        j4(a)
        j5(a)
        j6(a, b)
        j7(a, b)
        j8(a, b)
        j11(a, b)
        j9(browser)
        browser.close()
        results[10] = ('passed', '')
        for pg in (visitor, a, b, *PHONES):
            w = pg.watch
            print(f'[{w.name}] {len(w.errors)} error(s), {len(w.foreign)} foreign request(s)')
            for e in w.errors:
                print('   ', e)
            for u in sorted(set(w.foreign)):
                print('    foreign:', u)
            # The one expected console line: the wrong password of journey 2, refused 400 by the token door.
            unexpected = [e for e in w.errors if not (w.name == 'A' and 'signin.html' in e and 'status of 400' in e)]
            if unexpected or w.foreign:
                results[10] = ('failed', f'{w.name}: {len(unexpected)} unexpected error(s), {len(w.foreign)} foreign request(s)')
    print(json.dumps(results, indent=1))


if __name__ == '__main__':
    main()
