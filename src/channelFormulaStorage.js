import {
  CHANNEL_FORMULA_SCHEMA,
  createChannelFormula,
  sanitizeChannelFormula,
} from './channelFormula.js';

export const CHANNEL_FORMULA_DB_NAME = 'story-maker-channel-formulas';
export const CHANNEL_FORMULA_DB_VERSION = 1;

const FORMULA_STORE = 'formulas';
const CHECKPOINT_STORE = 'analysisCheckpoints';

function sanitizeCheckpoint(checkpoint = {}) {
  const safe = {
    formulaId: String(checkpoint.formulaId || '').trim().slice(0, 160),
    fileName: String(checkpoint.fileName || '').trim().slice(0, 240),
    fileFingerprint: String(checkpoint.fileFingerprint || '').trim().slice(0, 160),
    fileIndex: Math.max(0, Number(checkpoint.fileIndex || 0)),
    totalFiles: Math.max(0, Number(checkpoint.totalFiles || 0)),
    status: ['pending', 'running', 'complete', 'error'].includes(checkpoint.status)
      ? checkpoint.status
      : 'pending',
    analysis: checkpoint.analysis && typeof checkpoint.analysis === 'object'
      ? sanitizeObject(checkpoint.analysis)
      : null,
    error: String(checkpoint.error || '').trim().slice(0, 2000),
    updatedAt: String(checkpoint.updatedAt || new Date().toISOString()).slice(0, 80),
  };
  if (!safe.formulaId || !safe.fileFingerprint) {
    throw new Error('Channel formula checkpoint requires formulaId and fileFingerprint.');
  }
  return safe;
}

function sanitizeObject(value, depth = 0) {
  if (depth > 6 || value == null) return null;
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n').trim().slice(0, 12000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map(item => sanitizeObject(item, depth + 1));
  if (typeof value !== 'object') return null;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:api.?key|authorization|token|secret|raw.?source|source.?text|full.?text)/i.test(key))
    .map(([key, item]) => [key, sanitizeObject(item, depth + 1)]));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Channel formula IndexedDB request failed.'));
  });
}

function runTransaction(database, stores, mode, configure) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Channel formula transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Channel formula transaction aborted.'));
    configure(transaction);
  });
}

export function createIndexedDbChannelFormulaBackend(indexedDB = globalThis.indexedDB) {
  if (!indexedDB?.open) throw new Error('Trình duyệt không hỗ trợ IndexedDB cho công thức kênh.');

  let databasePromise;
  const openDatabase = () => {
    databasePromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(CHANNEL_FORMULA_DB_NAME, CHANNEL_FORMULA_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(FORMULA_STORE)) {
          database.createObjectStore(FORMULA_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(CHECKPOINT_STORE)) {
          const checkpoints = database.createObjectStore(CHECKPOINT_STORE, { keyPath: 'key' });
          checkpoints.createIndex('formulaId', 'formulaId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Không thể mở kho công thức kênh.'));
    });
    return databasePromise;
  };

  return {
    async listFormulas() {
      const database = await openDatabase();
      return requestToPromise(database.transaction(FORMULA_STORE, 'readonly').objectStore(FORMULA_STORE).getAll());
    },
    async getFormula(id) {
      const database = await openDatabase();
      return requestToPromise(database.transaction(FORMULA_STORE, 'readonly').objectStore(FORMULA_STORE).get(id));
    },
    async putFormula(formula) {
      const database = await openDatabase();
      await requestToPromise(database.transaction(FORMULA_STORE, 'readwrite').objectStore(FORMULA_STORE).put(formula));
      return formula;
    },
    async deleteFormula(id) {
      const database = await openDatabase();
      await runTransaction(database, [FORMULA_STORE, CHECKPOINT_STORE], 'readwrite', transaction => {
        transaction.objectStore(FORMULA_STORE).delete(id);
        const checkpoints = transaction.objectStore(CHECKPOINT_STORE);
        const request = checkpoints.index('formulaId').openCursor(id);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          cursor.delete();
          cursor.continue();
        };
      });
    },
    async listCheckpoints(formulaId) {
      const database = await openDatabase();
      return requestToPromise(
        database.transaction(CHECKPOINT_STORE, 'readonly')
          .objectStore(CHECKPOINT_STORE)
          .index('formulaId')
          .getAll(formulaId),
      );
    },
    async putCheckpoint(checkpoint) {
      const database = await openDatabase();
      await requestToPromise(
        database.transaction(CHECKPOINT_STORE, 'readwrite')
          .objectStore(CHECKPOINT_STORE)
          .put(checkpoint),
      );
      return checkpoint;
    },
  };
}

export function createChannelFormulaRepository({
  backend = createIndexedDbChannelFormulaBackend(),
  now = () => new Date(),
} = {}) {
  if (!backend) throw new TypeError('Channel formula storage backend is required.');

  return {
    async saveFormula(input) {
      const current = input?.id ? await backend.getFormula(input.id) : null;
      const timestamp = now() instanceof Date ? now().toISOString() : new Date().toISOString();
      const formula = createChannelFormula({
        ...(current || {}),
        ...(input || {}),
        createdAt: input?.createdAt || current?.createdAt || timestamp,
        updatedAt: timestamp,
      });
      formula.builtIn = Boolean(input?.builtIn ?? current?.builtIn);
      await backend.putFormula(formula);
      return formula;
    },
    async listFormulas() {
      const formulas = await backend.listFormulas();
      return formulas.map(sanitizeChannelFormula).sort((left, right) => (
        String(left.name).localeCompare(String(right.name), 'vi')
      ));
    },
    async getFormula(id) {
      const formula = await backend.getFormula(id);
      return formula ? sanitizeChannelFormula(formula) : null;
    },
    async deleteDynamicFormula(id) {
      const formula = await backend.getFormula(id);
      if (!formula || formula.builtIn) return false;
      await backend.deleteFormula(id);
      return true;
    },
    async saveAnalysisCheckpoint(input) {
      const checkpoint = sanitizeCheckpoint(input);
      checkpoint.key = `${checkpoint.formulaId}:${checkpoint.fileFingerprint}`;
      await backend.putCheckpoint(checkpoint);
      return checkpoint;
    },
    async listAnalysisCheckpoints(formulaId) {
      return (await backend.listCheckpoints(formulaId)).map(sanitizeCheckpoint);
    },
    exportFormula(formula) {
      return sanitizeChannelFormula(formula);
    },
    parseFormulaImport(input) {
      return parseChannelFormulaImport(input);
    },
  };
}

export function parseChannelFormulaImport(input) {
  const payload = typeof input === 'string' ? JSON.parse(input) : input;
  const formula = payload?.formula && typeof payload.formula === 'object'
    ? payload.formula
    : payload;
  if (!formula || formula.schema !== CHANNEL_FORMULA_SCHEMA) {
    throw new Error('Invalid channel formula import.');
  }
  return sanitizeChannelFormula(formula);
}

export { CHANNEL_FORMULA_SCHEMA, sanitizeCheckpoint };
