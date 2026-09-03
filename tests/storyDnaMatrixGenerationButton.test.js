import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dispatchStoryDnaMatrixUpdated,
  deleteSelectedStoryDnaMatrix,
  syncStoryDnaMatrixGenerationButton,
} from '../src/storyDnaMatrixRuntime.js';

function buttonStub() {
  const classes = new Map();
  return {
    disabled: false,
    classList: {
      toggle(name, value) {
        classes.set(name, Boolean(value));
      },
      has(name) {
        return classes.get(name) === true;
      },
    },
  };
}

test('keeps AI motif generation hidden until a Matrix with rows is ready', () => {
  const button = buttonStub();
  assert.equal(syncStoryDnaMatrixGenerationButton({ button, matrix: null, hasFormula: true }), false);
  assert.equal(button.disabled, true);
  assert.equal(button.classList.has('hidden'), true);

  assert.equal(syncStoryDnaMatrixGenerationButton({
    button,
    matrix: { rows: [{ id: 'story-001' }] },
    hasFormula: true,
  }), true);
  assert.equal(button.disabled, false);
  assert.equal(button.classList.has('hidden'), false);
});

test('keeps AI motif generation hidden for an unvalidated formula', () => {
  const button = buttonStub();
  assert.equal(syncStoryDnaMatrixGenerationButton({
    button,
    matrix: { rows: [{ id: 'story-001' }] },
    hasFormula: true,
    formulaReady: false,
  }), false);
  assert.equal(button.disabled, true);
  assert.equal(button.classList.has('hidden'), true);
});

test('deletes the selected Matrix only after confirmation', async () => {
  const deleted = [];
  const repository = {
    async deleteMatrix(id) {
      deleted.push(id);
      return true;
    },
  };
  const cancelled = await deleteSelectedStoryDnaMatrix({
    repository,
    matrix: { id: 'matrix-cancelled' },
    confirm: () => false,
  });
  assert.equal(cancelled.deleted, false);
  assert.deepEqual(deleted, []);

  const removed = await deleteSelectedStoryDnaMatrix({
    repository,
    matrix: { id: 'matrix-1' },
    confirm: () => true,
  });
  assert.deepEqual(removed, { deleted: true, id: 'matrix-1' });
  assert.deepEqual(deleted, ['matrix-1']);
});

test('dispatches a Matrix update event for dependent runtimes', () => {
  const events = [];
  const win = {
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent(event) {
      events.push(event);
      return true;
    },
  };
  assert.equal(dispatchStoryDnaMatrixUpdated(win, {
    matrixId: 'matrix-1',
    status: 'created',
  }), true);
  assert.deepEqual(events.map(event => ({
    type: event.type,
    detail: event.detail,
  })), [{
    type: 'story-maker:matrix-updated',
    detail: {
      source: 'story-dna-matrix-runtime',
      matrixId: 'matrix-1',
      status: 'created',
    },
  }]);
});
