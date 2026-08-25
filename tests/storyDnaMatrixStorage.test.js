import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createStoryDnaMatrixRepository,
  parseStoryDnaMatrixImport,
} from '../src/storyDnaMatrixStorage.js';

function memoryBackend() {
  const matrices = new Map();
  return {
    async putMatrix(matrix) {
      matrices.set(matrix.id, structuredClone(matrix));
      return matrix;
    },
    async listMatrices(formulaId) {
      return [...matrices.values()].filter(item => item.formulaId === formulaId);
    },
    async getMatrix(id) {
      return matrices.get(id) || null;
    },
    async deleteMatrix(id) {
      return matrices.delete(id);
    },
  };
}

test('creates, lists, reads, updates, and deletes Matrices by formula', async () => {
  const repository = createStoryDnaMatrixRepository({ backend: memoryBackend() });
  const matrix = await repository.saveMatrix({
    id: 'matrix-1',
    formulaId: 'formula-1',
    targetCount: 30,
    rows: [{
      id: 'story-001',
      formulaId: 'formula-1',
      hook: 'hook',
      evidence: 'evidence',
      midpointTwist: 'twist',
    }],
  });

  assert.equal(matrix.schema, 'story-maker-story-dna-matrix-v1');
  assert.equal((await repository.listMatrices('formula-1')).length, 1);
  assert.equal((await repository.getMatrix('matrix-1')).formulaId, 'formula-1');

  await repository.updateRow('matrix-1', 'story-001', {
    status: 'used',
    storyId: 'story-output-1',
  });
  const updated = await repository.getMatrix('matrix-1');
  assert.equal(updated.rows[0].status, 'used');
  assert.equal(updated.rows[0].storyId, 'story-output-1');

  assert.equal(await repository.deleteMatrix('matrix-1'), true);
  assert.equal((await repository.listMatrices('formula-1')).length, 0);
});

test('exports and imports a sanitized Matrix without secrets or raw source', () => {
  const repository = createStoryDnaMatrixRepository({ backend: memoryBackend() });
  const exported = repository.exportMatrix({
    id: 'matrix-1',
    formulaId: 'formula-1',
    rows: [{
      id: 'story-001',
      hook: 'hook',
      apiKey: 'remove',
      rawSourceText: 'remove',
    }],
    apiKey: 'remove',
  });

  assert.equal(exported.schema, 'story-maker-story-dna-matrix-v1');
  assert.equal(JSON.stringify(exported).includes('apiKey'), false);
  assert.equal(JSON.stringify(exported).includes('rawSourceText'), false);
  const parsed = parseStoryDnaMatrixImport(JSON.stringify({ matrix: exported }));
  assert.equal(parsed.id, 'matrix-1');
  assert.equal(parsed.rows[0].id, 'story-001');
});

test('rejects imports with an invalid Matrix schema', () => {
  assert.throws(
    () => parseStoryDnaMatrixImport(JSON.stringify({ matrix: { schema: 'wrong' } })),
    /Invalid story DNA Matrix import/,
  );
});
