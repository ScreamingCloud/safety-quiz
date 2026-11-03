import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function worker({ online = true, oldCache = false } = {}) {
  const handlers = {};
  const deleted = [];
  const navigated = [];
  const fetched = [];
  const offlinePage = { version: 'offline-2026' };
  const networkPage = { version: 'online-2026' };
  const caches = {
    keys: async () => oldCache ? ['safety-quiz-2025-v2', 'safety-quiz-2026-v2'] : ['safety-quiz-2026-v2'],
    delete: async key => { deleted.push(key); return true; },
    match: async () => offlinePage,
  };
  const self = {
    location: { origin: 'https://example.test' },
    clients: {
      claim: async () => {},
      matchAll: async () => [{ url: 'https://example.test/safety-quiz/', navigate: async url => { navigated.push(url); } }],
    },
    addEventListener: (name, handler) => { handlers[name] = handler; },
  };
  const fetch = async request => {
    fetched.push(request.url);
    if (!online) throw new Error('offline');
    return networkPage;
  };
  runInNewContext(source, { self, caches, fetch, URL });
  return { handlers, deleted, navigated, fetched, offlinePage, networkPage };
}

test('the updated worker replaces an old quiz cache and refreshes open pages', async () => {
  const runtime = worker({ oldCache: true });
  let completion;
  runtime.handlers.activate({ waitUntil: promise => { completion = promise; } });
  await completion;
  assert.deepEqual(runtime.deleted, ['safety-quiz-2025-v2']);
  assert.deepEqual(runtime.navigated, ['https://example.test/safety-quiz/']);
});

test('navigations use the current page online and the cached page offline', async () => {
  for (const online of [true, false]) {
    const runtime = worker({ online });
    let response;
    const request = { method: 'GET', url: 'https://example.test/safety-quiz/', mode: 'navigate' };
    runtime.handlers.fetch({ request, respondWith: promise => { response = promise; } });
    assert.equal(await response, online ? runtime.networkPage : runtime.offlinePage);
    assert.deepEqual(runtime.fetched, [request.url]);
  }
});
