const OPENAI_STYLE_ANALYZER_CHAR_LIMIT = 80000;
const ANALYZE_READY_LABEL = '🔬 Phân tích và tự điền thiết lập';
const OPENAI_LIMIT_LABEL = '⚠ Vượt giới hạn ký tự (OpenAI)';
const OPENAI_LIMIT_TITLE = 'Không thể chạy vì có khả năng vượt giới hạn đầu vào của model OpenAI. Hãy rút ngắn văn bản hoặc dùng Gemini.';

function hasDirectStyleText(value) {
  return String(value || '').trim().length > 0;
}

function countStyleAnalyzerTextChars(textFiles, directText = '') {
  const files = Array.isArray(textFiles) ? textFiles : [];
  return String(directText || '').length + files.reduce((total, file) => (
    total + (file?.content ? String(file.content).length : 0)
  ), 0);
}

function getAddDirectTextState(directText) {
  return { disabled: !hasDirectStyleText(directText) };
}

function getAnalyzeButtonState({
  apiKey,
  textFiles,
  imageFiles,
  directText,
  provider,
  openAiLimit = OPENAI_STYLE_ANALYZER_CHAR_LIMIT,
} = {}) {
  const hasTextFiles = Array.isArray(textFiles) && textFiles.length > 0;
  const hasImages = Array.isArray(imageFiles) && imageFiles.length > 0;
  const hasDirect = hasDirectStyleText(directText);
  const totalTextChars = countStyleAnalyzerTextChars(textFiles, directText);

  if (provider === 'openai' && totalTextChars > openAiLimit) {
    return {
      disabled: true,
      text: OPENAI_LIMIT_LABEL,
      title: OPENAI_LIMIT_TITLE,
    };
  }

  return {
    disabled: !(apiKey && (hasTextFiles || hasImages || hasDirect)),
    text: ANALYZE_READY_LABEL,
    title: '',
  };
}

function getReflectButtonState({ storyText, outputIsEmpty, hasAnalysis } = {}) {
  return {
    disabled: !(String(storyText || '').length >= 10 && !outputIsEmpty && hasAnalysis),
  };
}

export {
  ANALYZE_READY_LABEL,
  OPENAI_LIMIT_LABEL,
  OPENAI_LIMIT_TITLE,
  OPENAI_STYLE_ANALYZER_CHAR_LIMIT,
  countStyleAnalyzerTextChars,
  getAddDirectTextState,
  getAnalyzeButtonState,
  getReflectButtonState,
  hasDirectStyleText,
};
