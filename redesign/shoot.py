"""Screenshots of the site (redesign/shots/) and the rendered share card and touch icon.
Run from the site folder: python3 redesign/shoot.py og | shots [base-url]"""
import sys, pathlib, http.server, threading, functools
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
what = sys.argv[1]

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

def serve():
    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), lambda *a: handler(*a))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'

with sync_playwright() as p:
    browser = p.chromium.launch()
    httpd, base = serve()
    try:
        if what == 'og':
            page = browser.new_page(viewport={'width': 1200, 'height': 900})
            page.goto(f'{base}/redesign/og.html'); page.wait_for_timeout(600)
            page.locator('#og').screenshot(path=str(ROOT / 'og.png'))
            page.locator('#touch').screenshot(path=str(ROOT / 'apple-touch-icon.png'))
        else:
            if len(sys.argv) > 2 and sys.argv[2]: base = sys.argv[2]
            out = ROOT / 'redesign' / 'shots'; out.mkdir(exist_ok=True)
            pages = sys.argv[3].split(',') if len(sys.argv) > 3 else ['', 'constitution.html', 'demo.html', 'about.html', 'zh/', 'es/']
            for width in [1440, 768, 390, 320]:
                for motion in (['no-preference', 'reduce'] if width in (1440, 390) else ['no-preference']):
                    ctx = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion=motion)
                    page = ctx.new_page()
                    for path in pages:
                        page.goto(f'{base}/{path}'); page.wait_for_timeout(700)
                        # Walk down so lazy loops and scroll scenes settle, then come back.
                        page.evaluate('async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); }')
                        page.wait_for_timeout(500)
                        name = (path.strip('/').replace('/', '-').replace('.html', '') or 'index')
                        page.screenshot(path=str(out / f'{name}-{width}{"-still" if motion == "reduce" else ""}.png'), full_page=True)
                    ctx.close()
    finally:
        httpd.shutdown(); browser.close()
