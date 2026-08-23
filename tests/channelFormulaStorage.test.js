import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHANNEL_FORMULA_DB_NAME,
  CHANNEL_FORMULA_SCHEMA,
  createChannelFormulaRepository,
  parseChannelFormulaImport,
} from '../src/channelFormulaStorage.js';

function createFakeBackend() {
  const formulas = new Map();
  const checkpoints = new Map();
  return {
    formulas,
    checkpoints,
    async listFormulas() {
      return [...formulas.values()];
    },
    async getFormula(id) {
      return formulas.get(id) || null;
    },
    async putFormula(formula) {
      formulas.set(formula.id, formula);
      return formula;
    },
    async deleteFormula(id) {
      formulas.delete(id);
    },
    async listCheckpoints(formulaId) {
      return [...checkpoints.values()].filter(item => item.formulaId === formulaId);
    },
    async putCheckpoint(checkpoint) {
      checkpoints.set(`${checkpoint.formulaId}:${checkpoint.fileFingerprint}`, checkpoint);
      return checkpoint;
    },
  };
}

test('repository saves, lists, reads, and protects built-in formulas', async () => {
  const backend = createFakeBackend();
  const repository = createChannelFormulaRepository({ backend });
  const dynamic = await repository.saveFormula({
    id: 'dynamic-1',
    name: 'Dynamic',
    reproductionPrompt: 'rules',
  });
  const builtIn = await repository.saveFormula({
    id: 'built-in-1',
    name: 'Built in',
    builtIn: true,
    reproductionPrompt: 'rules',
  });

  assert.equal(dynamic.schema, CHANNEL_FORMULA_SCHEMA);
  assert.equal((await repository.getFormula(dynamic.id)).name, 'Dynamic');
  assert.equal((await repository.listFormulas()).length, 2);
  assert.equal(await repository.deleteDynamicFormula(builtIn.id), false);
  assert.equal(await repository.deleteDynamicFormula(dynamic.id), true);
  assert.equal(await repository.getFormula(dynamic.id), null);
  assert.equal(builtIn.builtIn, true);
  assert.equal(CHANNEL_FORMULA_DB_NAME, 'story-maker-channel-formulas');
});

test('repository checkpoints are replaced by formula and file fingerprint', async () => {
  const backend = createFakeBackend();
  const repository = createChannelFormulaRepository({ backend });

  await repository.saveAnalysisCheckpoint({
    formulaId: 'formula-1',
    fileName: 'one.txt',
    fileFingerprint: 'fingerprint-1',
    status: 'complete',
    analysis: { tone: 'old' },
  });
  await repository.saveAnalysisCheckpoint({
    formulaId: 'formula-1',
    fileName: 'one.txt',
    fileFingerprint: 'fingerprint-1',
    status: 'complete',
    analysis: { tone: 'new' },
  });

  const checkpoints = await repository.listAnalysisCheckpoints('formula-1');
  assert.equal(checkpoints.length, 1);
  assert.equal(checkpoints[0].analysis.tone, 'new');
});

test('formula export/import strips secrets and enforces schema', async () => {
  const backend = createFakeBackend();
  const repository = createChannelFormulaRepository({ backend });
  const formula = await repository.saveFormula({
    id: 'formula-1',
    name: 'Safe',
    reproductionPrompt: 'rules',
    apiKey: 'secret',
    rawSourceText: 'source',
  });

  const exported = repository.exportFormula(formula);
  assert.equal(exported.schema, CHANNEL_FORMULA_SCHEMA);
  assert.equal('apiKey' in exported, false);
  assert.equal('rawSourceText' in exported, false);
  assert.deepEqual(parseChannelFormulaImport(JSON.stringify(exported)).name, 'Safe');
  assert.throws(
    () => parseChannelFormulaImport({ schema: 'wrong', formula: {} }),
    /formula/i,
  );
});
