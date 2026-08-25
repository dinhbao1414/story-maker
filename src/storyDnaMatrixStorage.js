import {
  STORY_DNA_MATRIX_SCHEMA,
  normalizeStoryDnaMatrix,
} from './storyDnaMatrix.js';

export const STORY_DNA_MATRIX_DB_NAME = 'story-maker-story-dna-matrix';
const MATRIX_STORE = 'matrices';

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Story DNA Matrix IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Story DNA Matrix transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('Story DNA Matrix transaction aborted.'));
  });
}

function createIndexedDbBackend({
  indexedDB = globalThis.indexedDB,
  dbName = STORY_DNA_MATRIX_DB_NAME,
} = {}) {
  if (!indexedDB?.open) {
    throw new Error('Trình duyệt không hỗ trợ IndexedDB cho Story DNA Matrix.');
  }
  let databasePromise;
  const openDatabase = () => {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(MATRIX_STORE)) {
            const store = database.createObjectStore(MATRIX_STORE, { keyPath: 'id' });
            store.createIndex('formulaId', 'formulaId', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Story DNA Matrix database open failed.'));
      });
    }
    return databasePromise;
  };
  return {
    async putMatrix(matrix) {
      const database = await openDatabase();
      const transaction = database.transaction(MATRIX_STORE, 'readwrite');
      transaction.objectStore(MATRIX_STORE).put(matrix);
      await transactionToPromise(transaction);
      return matrix;
    },
    async listMatrices(formulaId) {
      const database = await openDatabase();
      const store = database.transaction(MATRIX_STORE, 'readonly').objectStore(MATRIX_STORE);
      return requestToPromise(store.index('formulaId').getAll(String(formulaId || '')));
    },
    async getMatrix(id) {
      const database = await openDatabase();
      const store = database.transaction(MATRIX_STORE, 'readonly').objectStore(MATRIX_STORE);
      return requestToPromise(store.get(String(id || '')));
    },
    async deleteMatrix(id) {
      const database = await openDatabase();
      const transaction = database.transaction(MATRIX_STORE, 'readwrite');
      transaction.objectStore(MATRIX_STORE).delete(String(id || ''));
      await transactionToPromise(transaction);
      return true;
    },
  };
}

function safeId(prefix = 'matrix') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createStoryDnaMatrixRepository({
  backend = createIndexedDbBackend(),
  now = () => new Date(),
  makeId = () => safeId('matrix'),
} = {}) {
  if (!backend) throw new TypeError('Story DNA Matrix storage backend is required.');
  return {
    async saveMatrix(input) {
      const current = input?.id ? await backend.getMatrix(input.id) : null;
      const matrix = normalizeStoryDnaMatrix({
        ...current,
        ...input,
        createdAt: input?.createdAt || current?.createdAt,
        updatedAt: now().toISOString(),
      }, { now: now(), makeId });
      await backend.putMatrix(matrix);
      return matrix;
    },
    async listMatrices(formulaId) {
      const matrices = await backend.listMatrices(formulaId);
      return matrices.map(item => normalizeStoryDnaMatrix(item)).sort((left, right) => (
        String(right.updatedAt).localeCompare(String(left.updatedAt))
      ));
    },
    async getMatrix(id) {
      const matrix = await backend.getMatrix(id);
      return matrix ? normalizeStoryDnaMatrix(matrix) : null;
    },
    async updateRow(matrixId, rowId, patch = {}) {
      const matrix = await this.getMatrix(matrixId);
      if (!matrix) throw new Error('Story DNA Matrix not found.');
      const index = matrix.rows.findIndex(row => row.id === rowId);
      if (index < 0) throw new Error('Story DNA Matrix row not found.');
      matrix.rows[index] = {
        ...matrix.rows[index],
        ...patch,
        updatedAt: now().toISOString(),
      };
      return this.saveMatrix(matrix);
    },
    async deleteMatrix(matrixId) {
      return backend.deleteMatrix(matrixId);
    },
    exportMatrix(matrix) {
      return normalizeStoryDnaMatrix(matrix);
    },
  };
}

export function parseStoryDnaMatrixImport(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('Invalid story DNA Matrix import JSON.');
    }
  }
  const matrix = parsed?.matrix && typeof parsed.matrix === 'object'
    ? parsed.matrix
    : parsed;
  if (!matrix || matrix.schema !== STORY_DNA_MATRIX_SCHEMA) {
    throw new Error('Invalid story DNA Matrix import.');
  }
  return normalizeStoryDnaMatrix(matrix);
}

export { createIndexedDbBackend };
