import assert from 'node:assert/strict';
import { createStoryProjectRepository } from '../src/storyProjectStorage.js';

function createMemoryBackend() {
  const projects = new Map();
  const stories = new Map();
  return {
    async listProjects() { return [...projects.values()]; },
    async getProject(id) { return projects.get(id) || null; },
    async putProject(project) { projects.set(project.id, structuredClone(project)); return project; },
    async deleteProject(id) {
      projects.delete(id);
      for (const [key, story] of stories) {
        if (story.projectId === id) stories.delete(key);
      }
    },
    async listStories(projectId) { return [...stories.values()].filter(story => story.projectId === projectId); },
    async putStory(story) { stories.set(story.id, structuredClone(story)); return story; },
    async deleteStory(id) { stories.delete(id); },
  };
}

const repository = createStoryProjectRepository({ backend: createMemoryBackend() });
await repository.saveProject({ id: 'p1', name: 'Project', updatedAt: '2026-07-31T08:00:00.000Z' });
assert.equal((await repository.listProjects())[0].id, 'p1');
assert.equal((await repository.getProject('p1')).name, 'Project');
await repository.saveStory({ id: 's1', projectId: 'p1', text: 'Story' });
assert.equal((await repository.listStories('p1'))[0].text, 'Story');
await repository.deleteStory('s1');
assert.deepEqual(await repository.listStories('p1'), []);
await repository.saveStory({ id: 's2', projectId: 'p1', text: 'Story 2' });
await repository.deleteProject('p1');
assert.deepEqual(await repository.listProjects(), []);
assert.deepEqual(await repository.listStories('p1'), []);

console.log('storyProjectStorage tests passed');
