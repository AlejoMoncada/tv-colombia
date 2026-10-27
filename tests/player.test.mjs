// Player contract tests for tv-colombia.
//
// Run with:
//   NODE_PATH="$(npm root -g)" node tests/player.test.mjs
//
// The suite serves the repository over a local HTTP server, blocks every
// external request (YouTube, Dailymotion, instantvideocloud, RTVC) and asserts
// only the public behaviour: which source each channel resolves to, which
// fallback page it exposes, and how the remote-control keys navigate.

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readdirSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
void readdirSync;
void existsSync;

const SOURCES = {
  canal1: { title: 'Canal 1', page: 'https://canal1.com.co/senal-en-vivo/' },
  caracol: { title: 'Caracol', page: 'https://www.caracoltv.com/senal-vivo' },
  institucional: { title: 'Institucional', page: 'https://www.rtvcplay.co/en-vivo/canal-institucional' },
  senalcolombia: { title: 'Señal Colombia', page: 'https://www.rtvcplay.co/en-vivo/senal-colombia' },
  trece: { title: 'Canal Trece', page: 'https://canaltrece.com.co/canal-trece/' },
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
};

const require = createRequire(import.meta.url);

// ES module `import` ignores NODE_PATH, so resolve the CommonJS builds explicitly.
function loadPlaywright() {
  const searchPaths = (process.env.NODE_PATH ?? '')
    .split(process.platform === 'win32' ? ';' : ':')
    .filter(Boolean);
  const ids = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    'playwright-core',
    '@playwright/cli/node_modules/playwright',
  ].filter(Boolean);
  for (const id of ids) {
    for (const paths of [[], searchPaths]) {
      try {
        const resolved = require.resolve(id, paths.length ? { paths } : undefined);
        return require(resolved);
      } catch {
        /* try the next candidate */
      }
    }
  }
  throw new Error('playwright is not resolvable; set PLAYWRIGHT_MODULE or NODE_PATH');
}

async function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const file = join(root, path === '/' ? 'index.html' : path);
    if (!file.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, origin: `http://127.0.0.1:${port}` };
}

async function openPlayer(browser, origin, key, options = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Keep the run hermetic and fast: no CDN, no embeds, no stream manifests.
  // External document navigations are stubbed so the escape hatch can be asserted.
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith(origin)) return route.continue();
    if (options.stubExternalDocs && request.resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>official</title>' });
    }
    return route.abort();
  });
  await page.goto(`${origin}/player.html?ch=${key}`, { waitUntil: 'domcontentloaded' });
  return { page, errors };
}

async function pressKeyCode(page, keyCode) {
  await page.evaluate((code) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'keyCode', { get: () => code });
    Object.defineProperty(event, 'which', { get: () => code });
    document.dispatchEvent(event);
  }, keyCode);
}

const checks = [];
function test(name, fn) {
  checks.push({ name, fn });
}

test('Canal 1 plays the official Dailymotion live embed', async (browser, origin) => {
  const { page, errors } = await openPlayer(browser, origin, 'canal1');
  const src = await page.locator('#stage iframe').getAttribute('src');
  assert.match(src, /^https:\/\/www\.dailymotion\.com\/embed\/video\/[a-z0-9]+/);
  assert.equal(await page.title(), 'Canal 1 · TV Colombia');
  assert.equal(await page.evaluate(() => document.body.dataset.channel), 'canal1');
  assert.deepEqual(errors, []);
});

test('Caracol plays the official YouTube live of its channel', async (browser, origin) => {
  const { page, errors } = await openPlayer(browser, origin, 'caracol');
  const src = await page.locator('#stage iframe').getAttribute('src');
  assert.match(src, /^https:\/\/www\.youtube\.com\/embed\/live_stream\?channel=UCcpE1fmG2qBZatj28bak2ng/);
  assert.equal(await page.title(), 'Caracol · TV Colombia');
  assert.deepEqual(errors, []);
});

test('Señal Colombia plays the official RTVC HLS', async (browser, origin) => {
  const { page, errors } = await openPlayer(browser, origin, 'senalcolombia');
  const src = await page.locator('#stage video').getAttribute('src');
  assert.equal(src, 'https://streaming.rtvc.gov.co/TV_Senal_Colombia_live/smil:live.smil/playlist.m3u8');
  assert.equal(await page.title(), 'Señal Colombia · TV Colombia');
  assert.deepEqual(errors, []);
});

test('Canal Institucional plays the official RTVC HLS', async (browser, origin) => {
  const { page, errors } = await openPlayer(browser, origin, 'institucional');
  const src = await page.locator('#stage video').getAttribute('src');
  assert.equal(src, 'https://streaming.rtvc.gov.co/TV_CanalInstitucional_live/smil:live.smil/playlist.m3u8');
  assert.deepEqual(errors, []);
});

test('Canal Trece plays its official player embed', async (browser, origin) => {
  const { page, errors } = await openPlayer(browser, origin, 'trece');
  const src = await page.locator('#stage iframe').getAttribute('src');
  assert.match(src, /^https:\/\/player\.instantvideocloud\.net\/#\/embed\/[a-z0-9]+$/);
  assert.equal(await page.title(), 'Canal Trece · TV Colombia');
  assert.deepEqual(errors, []);
});

test('an unknown channel explains itself instead of showing a black screen', async (browser, origin) => {
  const { page, errors } = await openPlayer(browser, origin, 'no-existe');
  assert.equal(await page.locator('#stage iframe').count(), 0);
  assert.equal(await page.locator('#stage video').count(), 0);
  await page.locator('#aviso').waitFor({ state: 'visible' });
  const text = (await page.locator('#aviso').innerText()).toLowerCase();
  assert.match(text, /canal/);
  assert.match(page.url(), /player\.html\?ch=no-existe$/);
  assert.deepEqual(errors, []);
});

test('every channel exposes an official page as escape hatch', async (browser, origin) => {
  for (const [key, { page: official }] of Object.entries(SOURCES)) {
    const { page } = await openPlayer(browser, origin, key);
    assert.equal(await page.evaluate(() => document.body.dataset.page), official, key);
    await page.close();
  }
});

test('the back key returns to the guide', async (browser, origin) => {
  const { page } = await openPlayer(browser, origin, 'canal1');
  await pressKeyCode(page, 461);
  await page.waitForURL(/index\.html$/, { timeout: 5000 });
  await page.close();
});

test('key 1 opens the official page when the signal does not play', async (browser, origin) => {
  const { page } = await openPlayer(browser, origin, 'trece', { stubExternalDocs: true });
  await page.keyboard.press('Digit1');
  await page.waitForURL(/canaltrece\.com\.co/, { timeout: 5000 });
  await page.close();
});

test('the packaged copy ships the same player as the published one', async () => {
  for (const file of ['player.html', 'player.js']) {
    const [published, packaged] = await Promise.all([
      readFile(join(root, file)),
      readFile(join(root, 'webos', file)),
    ]);
    assert.ok(published.equals(packaged), `${file} differs between the root and webos/`);
  }
});

test('the guide sends the live channels through the player and leaves the rest untouched', async (browser, origin) => {
  const page = await browser.newPage();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    return url.startsWith(origin) ? route.continue() : route.abort();
  });

  const expected = {
    Caracol: 'player.html?ch=caracol',
    'Canal 1': 'player.html?ch=canal1',
    'Canal Trece': 'player.html?ch=trece',
    'Señal Colombia': 'player.html?ch=senalcolombia',
    Institucional: 'player.html?ch=institucional',
    'Canal RCN': 'https://www.canalrcn.com/co/tv-en-vivo',
    'Canal Capital': 'https://www.canalcapital.gov.co/en-vivo-canal-capital/',
    Citytv: 'https://www.citytv.com.co/en-vivo',
    Teleantioquia: 'https://www.teleantioquia.co/en-vivo/',
    Telecaribe: 'https://play.telecaribe.co/senal-en-vivo/',
    'Telepacífico': 'https://www.telepacifico.com/en-vivo',
    'RTVC Play': 'https://www.rtvcplay.co/en-vivo',
  };

  for (const [guide, tiles] of [
    ['index.html', expected],
    // The packaged app also offers Telemedellín; the published guide does not yet.
    ['webos/index.html', { ...expected, 'Telemedellín': 'https://www.telemedellin.tv/en-vivo/' }],
  ]) {
    await page.goto(`${origin}/${guide}`, { waitUntil: 'domcontentloaded' });
    for (const [label, href] of Object.entries(tiles)) {
      const tile = page.locator('a.tile', { hasText: label }).first();
      assert.equal(await tile.getAttribute('href'), href, `${guide}: ${label}`);
    }
  }

  await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded' });
  const caracol = page.locator('a.tile', { hasText: 'Caracol' }).first();
  await caracol.evaluate((node) => node.focus());
  await page.keyboard.press('Enter');
  await page.waitForURL(/player\.html\?ch=caracol$/, { timeout: 5000 });
  await page.close();
});

const { chromium } = loadPlaywright();

// The globally installed Playwright CLI ships a build that may not match the
// cached browser revision, so point it at the newest cached Chromium.
function chromiumBinary() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  try {
    const builds = readdirSync(cache)
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const build of builds) {
      const candidates = [
        join(cache, build, 'chrome-win64', 'chrome.exe'),
        join(cache, build, 'chrome-linux', 'chrome'),
        join(cache, build, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {
    /* fall back to Playwright's own resolution */
  }
  return undefined;
}

const { server, origin } = await serve();
const browser = await chromium.launch({ executablePath: chromiumBinary() });
let failed = 0;

try {
  for (const { name, fn } of checks) {
    try {
      await fn(browser, origin);
      console.log(`ok   ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL ${name}\n     ${error.message.split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
