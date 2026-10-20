// Regenerates the README screenshots in docs/ from the demo data, using headless Edge.
// Run: node scripts/screenshots.mjs   (needs Microsoft Edge; starts its own Vite server)
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demoData } from './demo-data.mjs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const VITE_PORT = 1431;
const CDP_PORT = 9333;
const APP = `http://127.0.0.1:${VITE_PORT}/`;
const OUT = 'docs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(url); if (r.ok) return r; } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${url}`);
}

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(VITE_PORT), '--strictPort'], { stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'subs-shots-'));
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });

try {
  await waitFor(APP);
  await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const js = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true });
  const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
  const go = async (url, wait = 2500) => { await send('Page.navigate', { url }); await sleep(wait); };
  const key = async (k, extra = '') => { await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true ${extra} }))`); await sleep(900); };
  const clickText = async (text) => {
    const r = await js(`(() => { const el = [...document.querySelectorAll('button, [role=button], .row, div')].reverse()
      .find((e) => e.textContent.trim().startsWith(${JSON.stringify(text)}) && e.offsetParent); if (el) el.click(); return !!el; })()`);
    if (!r.result.value) throw new Error(`nothing to click: ${text}`);
    await sleep(1000);
  };
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`docs/${name}.png`);
  };

  mkdirSync(OUT, { recursive: true });
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await size(1240, 800);
  await go(APP, 800);
  await js(`localStorage.setItem('subscriptions-plus', ${JSON.stringify(JSON.stringify(demoData()))})`);

  await go(APP);
  await shot('main');
  await key('s');
  await shot('statistics');
  await key('Escape');
  await key(',', ', ctrlKey: true');
  await shot('settings');
  await key('Escape');
  await key('n');
  await shot('add');
  await key('Escape');
  await clickText('Notion');
  await shot('detail');

  await size(340, 480);
  await go(`${APP}?view=tray`);
  await shot('tray');
  await send('Browser.close').catch(() => {});
  ws.close();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  // Edge and Vite start child processes: end the whole trees.
  for (const p of [edge, vite]) spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' });
  await sleep(2000);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    console.warn(`could not remove the temporary Edge profile ${profile}`);
  }
}
