import assert from 'node:assert/strict';
import { formatStyleAnalysisResult } from '../src/styleAnalyzerResultFormatter.js';

const fullResult = formatStyleAnalysisResult({
  style_name: '湿った硬質文体',
  tone: '静かで緊張感がある',
  narrative_voice: {
    person: '一人称',
    distance: '近い',
    reliability: '揺れる',
    intrusion: '少ない',
  },
  sentence_style: {
    avg_length: '短中混合',
    length_variation: '大きい',
    ending_patterns: '断定と余韻',
    rhythm: 'ためがある',
    paragraph_length: '短め',
    paragraph_structure: '視覚から感情へ移る',
  },
  vocabulary: {
    level: '日常語中心',
    density: '高め',
    register: 'くだけすぎない',
    quirks: '触感語が多い',
    foreign_words: '少ない',
    archaic_modern: '現代語',
  },
  rhetoric: {
    metaphor_style: '物理感覚',
    metaphor_source: '水と金属',
    repetition: '弱い反復',
    irony_level: '低い',
    humor_type: '乾いた笑い',
    other_techniques: '沈黙の挿入',
  },
  description_focus: {
    visual: '影',
    auditory: '小さな音',
    tactile: '冷たさ',
    olfactory_gustatory: '雨の匂い',
    kinesthetic: '重心',
    spatial: '狭い奥行き',
    psychological_depth: '深い',
    show_tell_ratio: '7:3',
  },
  dialogue: {
    style: '短い',
    function: '関係をずらす',
    tag_style: '少なめ',
    dialect_sociolect: 'なし',
    subtext: '本音を避ける',
  },
  structure: {
    pacing: '緩急あり',
    scene_transition: '余韻接続',
    time_handling: '現在進行',
    tension_curve: '後半上昇',
    opening_style: '小物から入る',
    closing_style: '選択で閉じる',
  },
  emotional_architecture: {
    dominant_emotions: '不安と希望',
    emotional_range: '狭く深い',
    catharsis_method: '小さな行動',
    reader_distance: '近い',
  },
  themes_tendency: '失ったものの回収',
  literary_influences: '現代短編',
  unique_features: ['比喩が物理的', '説明を急がない'],
  anti_patterns: ['万能感', '説明過多'],
  reproduction_prompt: '短く、湿度を残す。',
});

assert.match(fullResult, /^🏷️ Tên phong cách: 湿った硬質文体/);
assert.match(fullResult, /🎙️ Góc kể:\n  ・Ngôi kể: 一人称/);
assert.match(fullResult, /📝 Văn phong:\n  ・Độ dài câu trung bình: 短中混合/);
assert.match(fullResult, /🔮 Biện pháp tu từ:\n  ・Kiểu ẩn dụ: 物理感覚/);
assert.match(fullResult, /💬 Hội thoại:\n  ・Văn phong: 短い/);
assert.match(fullResult, /🏗️ Cấu trúc:\n  ・Nhịp độ: 緩急あり/);
assert.match(fullResult, /✨ Đặc điểm riêng:\n  ・比喩が物理的\n  ・説明を急がない/);
assert.match(fullResult, /🚫 Mẫu cần tránh:\n  ・万能感\n  ・説明過多/);
assert.match(fullResult, /━━━ Prompt tái tạo phong cách ━━━\n短く、湿度を残す。$/);

const fallbackResult = formatStyleAnalysisResult({
  narrative_voice: '三人称',
  dialogue_style: '間を置く',
  pacing: 'ゆっくり',
});

assert.match(fallbackResult, /🎙️ Góc kể: 三人称/);
assert.match(fallbackResult, /💬 Cách thoại: 間を置く/);
assert.match(fallbackResult, /⏱️ Nhịp độ: ゆっくり/);
assert.match(fallbackResult, /━━━ Prompt tái tạo phong cách ━━━\n\(Không tạo được\)$/);

console.log('styleAnalyzerResultFormatter tests passed');
