import test from 'node:test';
import assert from 'node:assert/strict';

import {
  consumeGeneratedStory,
  installStoryDnaMatrixGenerationBridge,
} from '../src/storyDnaMatrixGenerationBridge.js';

function createRepository() {
  const matrix = {
    id: 'matrix-1',
    rows: [{ id: 'story-001', status: 'planned' }],
  };
  return {
    matrix,
    async getMatrix(id) {
      return id === matrix.id ? structuredClone(matrix) : null;
    },
    async updateRow(matrixId, rowId, patch) {
      if (matrixId !== matrix.id || rowId !== matrix.rows[0].id) throw new Error('not found');
      matrix.rows[0] = { ...matrix.rows[0], ...patch };
      return structuredClone(matrix);
    },
  };
}

test('marks a Matrix row used after a successful generated story', async () => {
  const repository = createRepository();
  const result = await consumeGeneratedStory({
    outputText: `${'あ'.repeat(20000)}。`,
    settings: { matrixId: 'matrix-1', matrixRowId: 'story-001' },
    repository,
    storyId: 'output-1',
    now: () => new Date('2026-08-25T00:00:00.000Z'),
  });
  assert.equal(result.status, 'used');
  assert.equal(repository.matrix.rows[0].status, 'used');
  assert.equal(repository.matrix.rows[0].storyId, 'output-1');
});

test('does not mark a row used for empty or incomplete output', async () => {
  const repository = createRepository();
  const result = await consumeGeneratedStory({
    outputText: '',
    settings: { matrixId: 'matrix-1', matrixRowId: 'story-001' },
    repository,
  });
  assert.equal(result.status, 'ignored');
  assert.equal(repository.matrix.rows[0].status, 'planned');
});

test('consumes each Matrix row only once', async () => {
  const repository = createRepository();
  const options = {
    outputText: `${'あ'.repeat(20000)}。`,
    settings: { matrixId: 'matrix-1', matrixRowId: 'story-001' },
    repository,
  };
  const first = await consumeGeneratedStory(options);
  const second = await consumeGeneratedStory(options);
  assert.equal(first.status, 'used');
  assert.equal(second.status, 'already-used');
});

test('installs a one-shot generated-story listener', async () => {
  const repository = createRepository();
  const listeners = {};
  const win = {
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatchEvent() {},
  };
  const bridge = installStoryDnaMatrixGenerationBridge({ win, repository });
  assert.equal(typeof bridge.dispose, 'function');
  await listeners['story-maker:story-generated']({
    detail: {
      outputText: `${'あ'.repeat(20000)}。`,
      settings: { matrixId: 'matrix-1', matrixRowId: 'story-001' },
      storyId: 'output-2',
    },
  });
  assert.equal(repository.matrix.rows[0].status, 'used');
  bridge.dispose();
});
