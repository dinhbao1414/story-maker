function createDirectStyleTextEntry(value, existingCount = 0) {
  const text = String(value || '').trim();
  if (!text) return null;

  return {
    name: `Văn bản nhập trực tiếp_${existingCount + 1}`,
    text,
    charCount: text.length,
  };
}

function countStyleAnalyzerTextFileChars(textFiles) {
  const files = Array.isArray(textFiles) ? textFiles : [];
  return files.reduce((total, file) => total + (file?.charCount || 0), 0);
}

function createStyleAnalyzerFileCountLabel(textFiles) {
  const files = Array.isArray(textFiles) ? textFiles : [];
  return `${files.length} mục / ${countStyleAnalyzerTextFileChars(files).toLocaleString()} ký tự`;
}

export {
  countStyleAnalyzerTextFileChars,
  createDirectStyleTextEntry,
  createStyleAnalyzerFileCountLabel,
};
