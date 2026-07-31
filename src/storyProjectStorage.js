export const STORY_PROJECT_DB_NAME = 'story-maker-projects';
export const STORY_PROJECT_DB_VERSION = 1;

const PROJECT_STORE = 'projects';
const STORY_STORE = 'stories';
const INDEXED_DB_UNAVAILABLE = 'Trình duyệt không hỗ trợ IndexedDB.';

export function createIndexedDbStoryProjectBackend(indexedDB = globalThis.indexedDB) {
  if (!indexedDB?.open) throw new Error(INDEXED_DB_UNAVAILABLE);

  let databasePromise;
  const openDatabase = () => {
    databasePromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open(STORY_PROJECT_DB_NAME, STORY_PROJECT_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const projects = database.objectStoreNames.contains(PROJECT_STORE)
          ? request.transaction.objectStore(PROJECT_STORE)
          : database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        if (!projects.indexNames.contains('updatedAt')) projects.createIndex('updatedAt', 'updatedAt');

        const stories = database.objectStoreNames.contains(STORY_STORE)
          ? request.transaction.objectStore(STORY_STORE)
          : database.createObjectStore(STORY_STORE, { keyPath: 'id' });
        if (!stories.indexNames.contains('projectId')) stories.createIndex('projectId', 'projectId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Không thể mở cơ sở dữ liệu dự án.'));
    });
    return databasePromise;
  };

  return {
    async listProjects() {
      const database = await openDatabase();
      return requestToPromise(database.transaction(PROJECT_STORE, 'readonly').objectStore(PROJECT_STORE).getAll());
    },
    async getProject(id) {
      const database = await openDatabase();
      return requestToPromise(database.transaction(PROJECT_STORE, 'readonly').objectStore(PROJECT_STORE).get(id));
    },
    async putProject(project) {
      const database = await openDatabase();
      await requestToPromise(database.transaction(PROJECT_STORE, 'readwrite').objectStore(PROJECT_STORE).put(project));
      return project;
    },
    async deleteProject(id) {
      const database = await openDatabase();
      await runTransaction(database, [PROJECT_STORE, STORY_STORE], 'readwrite', (transaction) => {
        transaction.objectStore(PROJECT_STORE).delete(id);
        const stories = transaction.objectStore(STORY_STORE);
        const request = stories.index('projectId').openCursor(id);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          cursor.delete();
          cursor.continue();
        };
      });
    },
    async listStories(projectId) {
      const database = await openDatabase();
      return requestToPromise(database.transaction(STORY_STORE, 'readonly').objectStore(STORY_STORE).index('projectId').getAll(projectId));
    },
    async putStory(story) {
      const database = await openDatabase();
      await requestToPromise(database.transaction(STORY_STORE, 'readwrite').objectStore(STORY_STORE).put(story));
      return story;
    },
    async deleteStory(id) {
      const database = await openDatabase();
      await requestToPromise(database.transaction(STORY_STORE, 'readwrite').objectStore(STORY_STORE).delete(id));
    },
  };
}

export function createStoryProjectRepository({ backend = createIndexedDbStoryProjectBackend() } = {}) {
  if (!backend) throw new TypeError('Story Project storage backend is required.');
  return {
    listProjects: () => backend.listProjects(),
    getProject: (id) => backend.getProject(id),
    saveProject: (project) => backend.putProject(project),
    deleteProject: (id) => backend.deleteProject(id),
    listStories: (projectId) => backend.listStories(projectId),
    saveStory: (story) => backend.putStory(story),
    deleteStory: (id) => backend.deleteStory(id),
  };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function runTransaction(database, stores, mode, configure) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
    configure(transaction);
  });
}
