// Story Maker runtime entrypoint.
// Keep side-effect modules in this order:
// 1. modulePreloadPolyfill owns the former repeated Vite preload boilerplate.
// 2. qualityBoost augments generation contracts before legacy UI boot.
// 3. legacyMain owns the existing UI and generation flow.
// 4. publicRuntime seals public-only behavior after the UI is present.
// 5. generationSettingsIo owns settings import/export and unified save names.
// 6. stylePresetRuntime previews, saves, and applies analyzer-generated presets.

import './modulePreloadPolyfill.js';
import './privacyGuards.js';
import { installOpenAiEndpointConfig } from './openAiEndpointConfig.js';
import './qualityBoost.js';
import { installLegacyUiVietnameseRuntime } from './legacyUiVietnamese.js';

installLegacyUiVietnameseRuntime();
import './legacyMain.js';
import './directLong10000Runtime.js';
import './publicRuntime.js';
import './generationSettingsIo.js';
import './stylePresetRuntime.js';
import './storyProjectRuntime.js';
import './channelFormulaRuntime.js';
import './storyDnaMatrixRuntime.js';
import './defaultModeRuntime.js';
import './workspaceTabs.js';
import './batchStoryWorkerRuntime.js';
import './batchStoryRuntime.js';
import { installStoryDnaMatrixGenerationBridge } from './storyDnaMatrixGenerationBridge.js';

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installOpenAiEndpointConfig(globalThis);
  const isBatchWorker = new URLSearchParams(window.location.search).get('storyBatchWorker') === '1';
  if (!isBatchWorker) {
    const installMatrixBridge = () => installStoryDnaMatrixGenerationBridge({ doc: document, win: window });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMatrixBridge, { once: true });
    else installMatrixBridge();
  }
}
