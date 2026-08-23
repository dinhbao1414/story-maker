import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGenerationSettingsExport,
  parseGenerationSettingsExport,
} from '../src/settingsSnapshotHelpers.js';

test('generation settings round-trip preserves sanitized channel formula metadata', () => {
  const payload = buildGenerationSettingsExport({
    mode: 'novel',
    modeSource: 'channel-formula',
    characters: [],
    locked: {},
    universalAssets: [],
  }, {
    version: '5.3.6',
    modeCustom: '短編小説',
    supplement: 'formula supplement',
    axesDetailed: {},
    channelFormula: {
      id: 'formula-1',
      name: 'Daily Scat – Drama gia đình Nhật',
      reproductionPrompt: 'abstract rules',
      generationPolicy: {
        minNonWhitespaceChars: 20000,
        targetNonWhitespaceChars: 22000,
      },
      apiKey: 'remove-me',
      rawSourceText: 'remove-me',
    },
  });

  assert.equal(payload.settings.channelFormula.name, 'Daily Scat – Drama gia đình Nhật');
  assert.equal(payload.settings.channelFormula.generationPolicy.minNonWhitespaceChars, 20000);
  assert.equal(JSON.stringify(payload).includes('remove-me'), false);

  const imported = parseGenerationSettingsExport(JSON.stringify(payload));
  assert.equal(imported.settings.channelFormula.id, 'formula-1');
  assert.equal(imported.settings.channelFormula.language, 'ja');
  assert.equal(imported.settings.channelFormula.generationPolicy.targetNonWhitespaceChars, 22000);
});
