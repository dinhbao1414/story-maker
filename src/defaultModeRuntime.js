export const DEFAULT_MODE = 'long_10000';

export function selectDefaultModeChip(doc = globalThis.document) {
  const chip = doc?.querySelector?.(`#mode-chips .chip[data-v="${DEFAULT_MODE}"]`);
  if (!chip || chip.classList?.contains?.('active')) return false;
  chip.click?.();
  return true;
}

export function installDefaultModeRuntime({
  doc = globalThis.document,
  win = globalThis.window,
} = {}) {
  if (!doc?.addEventListener) return null;
  const schedule = win?.setTimeout || globalThis.setTimeout;
  const onClick = event => {
    const modeResetButton = event.target?.closest?.('.btn-section-clear[data-section="mode"]');
    const resetAllButton = event.target?.closest?.('#btn-reset-all');
    if (!modeResetButton && !resetAllButton) return;
    const section = doc.getElementById?.('section-mode');
    if (modeResetButton && section?.classList?.contains?.('is-locked')) return;
    schedule(() => selectDefaultModeChip(doc), 0);
  };
  doc.addEventListener('click', onClick, true);
  schedule(() => selectDefaultModeChip(doc), 0);
  return {
    dispose() {
      doc.removeEventListener?.('click', onClick, true);
    },
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installDefaultModeRuntime(), { once: true });
  } else {
    installDefaultModeRuntime();
  }
}
