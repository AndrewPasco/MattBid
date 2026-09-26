/**
 * HTTP contract tests for the sync Worker. They start `wrangler dev` (local runtime, no
 * account, no network), then call the API. Run: npm test (in worker/).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const APP = 'https://andrewpasco.github.io';
const state = mkdtempSync(join(tmpdir(), 'mattbid-sync-'));
let dev;

const newKey = () => randomBytes(16).toString('base64url');
const get = key => fetch(`${BASE}/s/${key}`, { headers: { Origin: APP } });
const put = (key, months) => fetch(`${BASE}/s/${key}`, {
  method: 'PUT', headers: { Origin: APP, 'Content-Type': 'application/json' }, body: JSON.stringify({ months }),
});

before(async () => {
  dev = spawn('node_modules/.bin/wrangler', ['dev', '--ip', '127.0.0.1', '--port', String(PORT), '--persist-to', state], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/`)).status === 404) return; } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('wrangler dev did not start');
});

after(() => { dev.kill(); rmSync(state, { recursive: true, force: true }); });

test('a new key: GET returns an empty document', async () => {
  assert.deepEqual(await (await get(newKey())).json(), { months: {} });
});

test('a PUT: a later GET returns the same months', async () => {
  const key = newKey();
  const months = { 'B777 OCTOBER 2026 MEM': { updatedAt: 1, state: { selected: [{ t: 'line', num: 1001 }] } } };
  assert.deepEqual((await (await put(key, months)).json()).months, months);
  assert.deepEqual((await (await get(key)).json()).months, months);
});

test('two devices PUT: each month keeps its newest state', async () => {
  const key = newKey();
  await put(key, { OCT: { updatedAt: 5, state: 'ipad-oct' }, NOV: { updatedAt: 1, state: 'ipad-nov' } });
  const doc = await (await put(key, { OCT: { updatedAt: 3, state: 'pc-oct-older' }, NOV: { updatedAt: 9, state: 'pc-nov' } })).json();
  assert.deepEqual(doc.months, { OCT: { updatedAt: 5, state: 'ipad-oct' }, NOV: { updatedAt: 9, state: 'pc-nov' } });
});

test('two keys: each has its own document', async () => {
  const a = newKey(), b = newKey();
  await put(a, { OCT: { updatedAt: 1, state: 'a' } });
  assert.deepEqual(await (await get(b)).json(), { months: {} });
});

test('bad requests: short key, bad JSON, and a large body are refused', async () => {
  assert.equal((await get('short')).status, 404);
  assert.equal((await fetch(`${BASE}/s/${newKey()}`, { method: 'PUT', body: '{nope' })).status, 400);
  const big = { OCT: { updatedAt: 1, state: 'x'.repeat(300 * 1024) } };
  assert.equal((await put(newKey(), big)).status, 413);
});

test('CORS: the app origin gets the headers, another origin does not', async () => {
  const ok = await fetch(`${BASE}/s/${newKey()}`, { method: 'OPTIONS', headers: { Origin: APP } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), APP);
  const other = await fetch(`${BASE}/s/${newKey()}`, { headers: { Origin: 'https://example.com' } });
  assert.equal(other.headers.get('Access-Control-Allow-Origin'), null);
});
