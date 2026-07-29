function pushLine(lines, icon, label, value) {
  if (value) lines.push(`${icon} ${label}: ${value}`);
}

function pushDetail(lines, label, value) {
  if (value) lines.push(`  ・${label}: ${value}`);
}

function pushSection(lines, icon, label) {
  lines.push('');
  lines.push(`${icon} ${label}:`);
}

function formatStyleAnalysisResult(analysis) {
  const lines = [];
  const style = analysis;

  pushLine(lines, '🏷️', 'Tên phong cách', style.style_name);
  pushLine(lines, '🎭', 'Sắc thái', style.tone);

  if (typeof style.narrative_voice === 'object' && style.narrative_voice) {
    pushSection(lines, '🎙️', 'Góc kể');
    pushDetail(lines, 'Ngôi kể', style.narrative_voice.person);
    pushDetail(lines, 'Khoảng cách', style.narrative_voice.distance);
    pushDetail(lines, 'Độ tin cậy', style.narrative_voice.reliability);
    pushDetail(lines, 'Mức can thiệp', style.narrative_voice.intrusion);
  } else {
    pushLine(lines, '🎙️', 'Góc kể', style.narrative_voice);
  }

  pushSection(lines, '📝', 'Văn phong');
  if (style.sentence_style) {
    pushDetail(lines, 'Độ dài câu trung bình', style.sentence_style.avg_length || style.sentence_style.length);
    pushDetail(lines, 'Biến thiên độ dài câu', style.sentence_style.length_variation);
    pushDetail(lines, 'Mẫu kết câu', style.sentence_style.ending_patterns || style.sentence_style.ending);
    pushDetail(lines, 'Nhịp câu', style.sentence_style.rhythm);
    pushDetail(lines, 'Độ dài đoạn', style.sentence_style.paragraph_length);
    pushDetail(lines, 'Cấu trúc đoạn', style.sentence_style.paragraph_structure);
  }

  pushSection(lines, '📖', 'Từ vựng');
  if (style.vocabulary) {
    pushDetail(lines, 'Cấp độ', style.vocabulary.level);
    pushDetail(lines, 'Mật độ thông tin', style.vocabulary.density);
    pushDetail(lines, 'Sắc thái ngôn ngữ', style.vocabulary.register);
    pushDetail(lines, 'Đặc trưng', style.vocabulary.quirks);
    pushDetail(lines, 'Từ vay mượn', style.vocabulary.foreign_words);
    pushDetail(lines, 'Cổ ngữ / hiện đại', style.vocabulary.archaic_modern);
  }

  if (style.rhetoric) {
    pushSection(lines, '🔮', 'Biện pháp tu từ');
    pushDetail(lines, 'Kiểu ẩn dụ', style.rhetoric.metaphor_style);
    pushDetail(lines, 'Nguồn hình ảnh', style.rhetoric.metaphor_source);
    pushDetail(lines, 'Phép lặp', style.rhetoric.repetition);
    pushDetail(lines, 'Mỉa mai', style.rhetoric.irony_level);
    pushDetail(lines, 'Hài hước', style.rhetoric.humor_type);
    pushDetail(lines, 'Khác', style.rhetoric.other_techniques);
  }

  pushSection(lines, '🖼️', 'Trọng tâm miêu tả');
  if (style.description_focus) {
    pushDetail(lines, 'Thị giác', style.description_focus.visual);
    pushDetail(lines, 'Thính giác', style.description_focus.auditory);
    pushDetail(lines, 'Xúc giác', style.description_focus.tactile);
    pushDetail(lines, 'Khứu giác / vị giác', style.description_focus.olfactory_gustatory);
    pushDetail(lines, 'Cảm giác vận động', style.description_focus.kinesthetic);
    pushDetail(lines, 'Không gian', style.description_focus.spatial);
    pushDetail(lines, 'Tâm lý', style.description_focus.psychological_depth || style.description_focus.psychological);
    pushDetail(lines, 'Show:Tell', style.description_focus.show_tell_ratio);
  }

  if (style.dialogue) {
    pushSection(lines, '💬', 'Hội thoại');
    pushDetail(lines, 'Văn phong', style.dialogue.style);
    pushDetail(lines, 'Chức năng', style.dialogue.function);
    pushDetail(lines, 'Cách dẫn thoại', style.dialogue.tag_style);
    pushDetail(lines, 'Phương ngữ', style.dialogue.dialect_sociolect);
    pushDetail(lines, 'Hàm ý', style.dialogue.subtext);
  } else {
    pushLine(lines, '💬', 'Cách thoại', style.dialogue_style);
  }

  if (style.structure) {
    pushSection(lines, '🏗️', 'Cấu trúc');
    pushDetail(lines, 'Nhịp độ', style.structure.pacing);
    pushDetail(lines, 'Chuyển cảnh', style.structure.scene_transition);
    pushDetail(lines, 'Thời', style.structure.time_handling);
    pushDetail(lines, 'Đường căng thẳng', style.structure.tension_curve);
    pushDetail(lines, 'Mẫu mở đầu', style.structure.opening_style);
    pushDetail(lines, 'Mẫu kết thúc', style.structure.closing_style);
  } else {
    pushLine(lines, '⏱️', 'Nhịp độ', style.pacing);
  }

  if (style.emotional_architecture) {
    pushSection(lines, '❤️', 'Thiết kế cảm xúc');
    pushDetail(lines, 'Cảm xúc chính', style.emotional_architecture.dominant_emotions);
    pushDetail(lines, 'Biên độ', style.emotional_architecture.emotional_range);
    pushDetail(lines, 'Giải tỏa cảm xúc', style.emotional_architecture.catharsis_method);
    pushDetail(lines, 'Khoảng cách với độc giả', style.emotional_architecture.reader_distance);
  }

  pushLine(lines, '🎯', 'Xu hướng chủ đề', style.themes_tendency);
  pushLine(lines, '📚', 'Ảnh hưởng văn học', style.literary_influences);
  lines.push('');

  if (style.unique_features?.length) {
    lines.push('✨ Đặc điểm riêng:');
    style.unique_features.forEach((item) => lines.push(`  ・${item}`));
  }

  if (style.anti_patterns?.length) {
    lines.push('');
    lines.push('🚫 Mẫu cần tránh:');
    style.anti_patterns.forEach((item) => lines.push(`  ・${item}`));
  }

  lines.push('');
  lines.push('━━━ Prompt tái tạo phong cách ━━━');
  lines.push(style.reproduction_prompt || '(Không tạo được)');

  return lines.join('\n');
}

export { formatStyleAnalysisResult };
