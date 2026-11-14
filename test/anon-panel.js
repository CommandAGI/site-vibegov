// test/anon-panel.html: mounts the anonymous-voice section exactly as desk.html does.
import { renderAnonymityPanel } from '../anon.js';

await renderAnonymityPanel(document.querySelector('[data-slot="anonymity"]'));
