import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MODE,
  installDefaultModeRuntime,
} from '../src/defaultModeRuntime.js';

test('reselects the long 10,000-character mode after the mode section is reset', () => {
  let clickHandler;
  let selected = 0;
  const section = {
    classList: {
      contains: () => false,
    },
  };
  const chip = {
    classList: {
      contains: () => false,
    },
    click: () => { selected += 1; },
  };
  const clearButton = {
    closest: selector => selector === '.btn-section-clear[data-section="mode"]' ? clearButton : null,
  };
  const doc = {
    addEventListener: (name, handler) => {
      if (name === 'click') clickHandler = handler;
    },
    getElementById: id => id === 'section-mode' ? section : null,
    querySelector: selector => selector === `#mode-chips .chip[data-v="${DEFAULT_MODE}"]` ? chip : null,
  };
  const win = {
    setTimeout: callback => callback(),
  };
  const runtime = installDefaultModeRuntime({ doc, win });

  assert.equal(typeof runtime.dispose, 'function');
  assert.equal(selected, 1);
  clickHandler({ target: clearButton });
  assert.equal(selected, 2);
  runtime.dispose();
});

test('reselects the long mode after resetting all settings', () => {
  let clickHandler;
  let selected = 0;
  const chip = {
    classList: { contains: () => false },
    click: () => { selected += 1; },
  };
  const resetAllButton = {
    closest: selector => selector === '#btn-reset-all' ? resetAllButton : null,
  };
  const doc = {
    addEventListener: (name, handler) => {
      if (name === 'click') clickHandler = handler;
    },
    getElementById: () => null,
    querySelector: selector => selector === `#mode-chips .chip[data-v="${DEFAULT_MODE}"]` ? chip : null,
  };
  const win = { setTimeout: callback => callback() };

  installDefaultModeRuntime({ doc, win });
  assert.equal(selected, 1);
  clickHandler({ target: resetAllButton });
  assert.equal(selected, 2);
});
