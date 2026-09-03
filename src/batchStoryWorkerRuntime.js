import { applyGenerationSettings } from './generationSettingsIo.js';
import { readApiSession } from './apiSession.js';
import { GEMINI_MODEL_VALUES } from './data.js';
import { stripGeneratedFooter, withStoryMakerFooter } from './footerHelpers.js';
import { Gt } from './providerClients.js';

const WORKER_FLAG = 'storyBatchWorker';
const MIN_BATCH_CHARS = 20000;

function countCharacters(value) {
  return Array.from(String(value || '').replace(/\s/gu, '')).length;
}

function stripTerminalEnding(value) {
  return stripGeneratedFooter(value)
    .replace(/\n*\s*【完】\s*$/u, '')
    .trimEnd();
}

export function buildBatchContinuationPrompt({
  text = '',
  deficit = 0,
  targetChars = MIN_BATCH_CHARS,
} = {}) {
  const manuscript = stripTerminalEnding(text);
  const required = Math.max(2500, Math.floor(Number(deficit) || 0) + 1800);
  return [
    '以下の日本語物語は途中まで完成しています。既存本文を最初から書き直さず、直後から自然に続きを書いてください。',
    `現在の不足は約${Math.max(0, Number(deficit) || 0).toLocaleString('ja-JP')}文字です。新規本文を最低${required.toLocaleString('ja-JP')}文字追加し、結合後に空白を除いて${Number(targetChars).toLocaleString('ja-JP')}文字を確実に超えてください。`,
    '出力するのは追加する新しい本文だけです。既存本文、タイトル、冒頭、あらすじ、説明、謝罪、作業報告を繰り返さないでください。',
    '章タイトル・章番号・Markdown見出し・区切り線は禁止です。時間経過や場面転換は「翌日」「二日後」「それから半年後」など自然な接続文で繋いでください。',
    '既存の人物関係、物証、秘密、因果、語り口を維持し、未回収の問いを段階的に回収しながら、反撃・証拠・感情的代償・議論可能な道徳的余韻まで場面として完成させてください。',
    '最後に必要な場合だけ【完】を一度付けてください。Story Makerのフッターは出力しないでください。',
    '',
    '=== 既存本文（ここは再出力禁止） ===',
    manuscript,
    '=== 既存本文ここまで ===',
    '',
    'この直後から始まる追加本文のみ:',
  ].join('\n');
}

async function continueCurrentStory(payload = {}, signal = null) {
  const output = globalThis.document?.getElementById?.('output');
  const currentText = String(output?.textContent || payload.text || '').trim();
  const currentChars = countCharacters(currentText);
  if (!currentText || currentChars < 10000) {
    throw new Error(`Bản hiện tại quá ngắn để viết tiếp (${currentChars.toLocaleString('vi-VN')} ký tự).`);
  }
  const session = readApiSession();
  if (!session.apiKey) throw new Error('Worker không đọc được API key của tab hiện tại.');
  const targetChars = Math.max(MIN_BATCH_CHARS, Number(payload.targetChars) || MIN_BATCH_CHARS);
  const deficit = Math.max(0, targetChars - currentChars);
  const response = await Gt(
    session.apiKey,
    GEMINI_MODEL_VALUES[0],
    buildBatchContinuationPrompt({ text: currentText, deficit, targetChars }),
    null,
    {
      temperature: 0.85,
      disableGoogleSearch: true,
      maxTokens: 16384,
      maxOutputTokens: 16384,
      timeoutMs: 5 * 60 * 1000,
      signal,
    },
  );
  const base = stripTerminalEnding(currentText);
  const addition = stripGeneratedFooter(response.text)
    .replace(/^```(?:text|markdown)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
  if (!addition) throw new Error('AI không trả về phần viết tiếp.');
  const merged = withStoryMakerFooter(`${base}\n\n${addition}`);
  if (output) {
    output.textContent = merged;
    output.classList?.remove?.('empty');
  }
  globalThis.dispatchEvent?.(new CustomEvent('story-maker:output-updated'));
  return merged;
}

function isBatchWorker() {
  try {
    return new URLSearchParams(globalThis.location?.search || '').get(WORKER_FLAG) === '1';
  } catch {
    return false;
  }
}

function notifyParent(message) {
  try {
    globalThis.parent?.postMessage?.({
      source: 'story-maker-batch-worker',
      ...message,
    }, globalThis.location?.origin || '*');
  } catch {
    // The parent may have been closed while a worker is finishing.
  }
}

export function disableBatchAutomaticBrushup(doc = globalThis.document) {
  const checkbox = doc?.getElementById?.('longify-auto-brushup-until-pass');
  if (!checkbox) return false;
  checkbox.checked = false;
  return true;
}

function boot() {
  if (!isBatchWorker() || globalThis.parent === globalThis) return;

  let started = false;
  let continuing = false;
  let continuationController = null;
  globalThis.addEventListener('message', async event => {
    const data = event?.data;
    if (!data || data.source !== 'story-maker-batch-parent') return;
    if (data.type === 'start') {
      if (started) return;
      started = true;
      try {
        await applyGenerationSettings(data.payload || {}, { announce: false });
        disableBatchAutomaticBrushup(globalThis.document);
        const button = globalThis.document?.getElementById?.('btn-generate');
        if (!button) throw new Error('Không tìm thấy nút Tạo truyện trong worker.');
        button.click();
        notifyParent({ type: 'started' });
      } catch (error) {
        notifyParent({
          type: 'failed',
          error: String(error?.message || error),
        });
      }
      return;
    }
    if (data.type === 'continue') {
      if (!started || continuing) return;
      continuing = true;
      continuationController = new AbortController();
      try {
        const text = await continueCurrentStory(data.payload || {}, continuationController.signal);
        notifyParent({
          type: 'continued',
          text,
          chars: countCharacters(text),
        });
      } catch (error) {
        notifyParent({
          type: 'failed',
          error: String(error?.message || error),
        });
      } finally {
        continuing = false;
        continuationController = null;
      }
      return;
    }
    if (data.type === 'abort') {
      continuationController?.abort();
      globalThis.document?.getElementById?.('btn-ln-abort')?.click?.();
    }
  });

  const ready = () => notifyParent({ type: 'ready' });
  if (globalThis.document?.readyState === 'loading') {
    globalThis.document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
}

boot();
