import assert from 'node:assert/strict';

import {
  API_SESSION_KEY,
  clearPersistedApiSession,
  readApiSession,
  restoreApiSession,
  writeApiSession,
} from '../src/apiSession.js';
import {
  installThirdPartyUrlProxyBlock,
  isBlockedThirdPartyUrlProxy,
} from '../src/privacyGuards.js';

function installWindow(storage = null) {
  global.window = {
    name: '',
    sessionStorage: storage,
  };
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const storage = createStorage();
installWindow(storage);
writeApiSession({
  apiProvider: 'openai',
  openaiKey: 'sk-test-key-1234567890',
});

const expectedSession = {
  apiProvider: 'openai',
  geminiKey: '',
  openaiKey: 'sk-test-key-1234567890',
  apiKey: 'sk-test-key-1234567890',
};
assert.ok(storage.getItem(API_SESSION_KEY), 'API keys must persist for reloads in the same tab');
assert.equal(global.window.name, '', 'API keys must not persist in window.name');
installWindow(storage);
assert.deepEqual(readApiSession(), expectedSession, 'a reload must recover the API key from sessionStorage');
const restoredState = {};
assert.equal(restoreApiSession(restoredState), true, 'API key restoration must succeed after reload');
assert.deepEqual(restoredState, expectedSession);

assert.equal(isBlockedThirdPartyUrlProxy('https://api.codetabs.com/v1/proxy/?quest=https%3A%2F%2Fexample.com'), true);
assert.equal(isBlockedThirdPartyUrlProxy('https://api.allorigins.win/get?url=https%3A%2F%2Fexample.com'), true);
assert.equal(isBlockedThirdPartyUrlProxy('https://api.openai.com/v1/responses'), false);

const requests = [];
const guardedWindow = {
  fetch(input) {
    requests.push(String(input));
    return Promise.resolve('ok');
  },
};
assert.equal(installThirdPartyUrlProxyBlock(guardedWindow), true);
await assert.rejects(() => guardedWindow.fetch('https://api.codetabs.com/v1/proxy/?quest=https%3A%2F%2Fexample.com'));
await guardedWindow.fetch('https://api.openai.com/v1/responses');
assert.deepEqual(requests, ['https://api.openai.com/v1/responses']);

clearPersistedApiSession();
assert.equal(storage.getItem(API_SESSION_KEY), null);
assert.equal(global.window.name, '');

delete global.window;

console.log('apiSession tests passed');
