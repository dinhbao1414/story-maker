import assert from 'node:assert/strict';
import {
  STYLE_PROFILE_STORAGE_KEY,
  buildStyleProfile,
  deleteStyleProfile,
  extractStyleAnalysisFromPayload,
  formatStyleProfilePreview,
  isStyleAnalysisRequest,
  loadStyleProfiles,
  saveStyleProfile,
} from '../src/stylePresetHelpers.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

const analysis = {
  style_name: 'Kịch tính đảo ngược',
  tone: 'Dồn dập, giàu kịch tính',
  reproduction_prompt: 'Giữ nhịp nhanh, hội thoại mạnh và kết thúc có dư âm.',
  generation_preset: {
    mode: 'documentary',
    theme: 'Bí mật trong khu tập thể',
    genre: 'Tâm lý xã hội',
    worldview: 'Nhật Bản hiện đại',
    target: 'Người lớn',
    era: 'Đầu thời Showa',
    ending: 'Kết thúc mở có dư âm',
    narration: 'Ngôi thứ nhất dạng nhật ký',
    characters: [
      { name: 'Aoi', sex: 'Nữ', role: 'Nhân vật chính', personality: 'Kiên nhẫn', note: 'Không sao chép nhân vật nguồn' },
    ],
    supplement: 'Dùng nhân vật và cốt truyện hoàn toàn mới.',
  },
};

const profile = buildStyleProfile(analysis, {
  id: 'profile-1',
  now: new Date('2026-07-28T12:00:00.000Z'),
});

assert.equal(profile.id, 'profile-1');
assert.equal(profile.name, 'Kịch tính đảo ngược');
assert.equal(profile.settingsPayload.schema, 'story-maker-generation-settings-v1');
assert.equal(profile.settingsPayload.settings.mode, 'documentary');
assert.equal(profile.settingsPayload.settings.axes.theme.customValue, 'Bí mật trong khu tập thể');
assert.equal(profile.settingsPayload.settings.axes.narr.customValue, 'Ngôi thứ nhất dạng nhật ký');
assert.equal(profile.settingsPayload.settings.characters[0].name, 'Aoi');
assert.match(profile.settingsPayload.settings.supplement, /Dùng nhân vật và cốt truyện hoàn toàn mới/);
assert.match(profile.settingsPayload.settings.supplement, /Giữ nhịp nhanh/);
assert.equal(JSON.stringify(profile).includes('apiKey'), false);

const preview = formatStyleProfilePreview(profile);
assert.match(preview, /Chế độ: Tư liệu/);
assert.match(preview, /Chủ đề: Bí mật trong khu tập thể/);
assert.match(preview, /Nhân vật: Aoi/);

const storage = memoryStorage();
assert.deepEqual(loadStyleProfiles(storage), []);
assert.equal(saveStyleProfile(storage, profile).length, 1);
assert.equal(loadStyleProfiles(storage)[0].id, 'profile-1');
assert.ok(storage.getItem(STYLE_PROFILE_STORAGE_KEY));

saveStyleProfile(storage, { ...profile, name: 'Tên mới' });
assert.equal(loadStyleProfiles(storage).length, 1);
assert.equal(loadStyleProfiles(storage)[0].name, 'Tên mới');
assert.deepEqual(deleteStyleProfile(storage, 'profile-1'), []);

const analysisRequest = {
  body: JSON.stringify({
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: 'Return JSON with style_name, reproduction_prompt, and generation_preset.' }],
  }),
};
assert.equal(isStyleAnalysisRequest('https://api.openai.com/v1/chat/completions', analysisRequest), true);
assert.equal(isStyleAnalysisRequest('https://api.openai.com/v1/chat/completions', {
  body: JSON.stringify({ response_format: { type: 'json_object' }, messages: [{ role: 'user', content: 'Score this story.' }] }),
}), false);
assert.deepEqual(extractStyleAnalysisFromPayload({
  choices: [{ message: { content: '```json\n{"style_name":"Test","generation_preset":{"mode":"novel"}}\n```' } }],
}), { style_name: 'Test', generation_preset: { mode: 'novel' } });

console.log('stylePresetHelpers tests passed');
