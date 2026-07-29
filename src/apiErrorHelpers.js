// Shared API error classification helpers used by the legacy runtime.
// The exported short aliases preserve the current legacyMain call sites.

export function toText(value) {
  return String(value || '');
}

export function toLowerText(value) {
  return toText(value).toLowerCase();
}

export function isSafetyError(value) {
  const text = toLowerText(value);
  return text.includes('safety') || text.includes('prohibited') || text.includes('block');
}

export function isQuotaError(value) {
  const text = toLowerText(value);
  return text.includes('quota') ||
    text.includes('429') ||
    text.includes('resource exhausted') ||
    text.includes('rate limit') ||
    text.includes('billing') ||
    text.includes('limit exceeded');
}

export function isAuthError(value) {
  const text = toLowerText(value);
  return text.includes('api key not valid') ||
    text.includes('api_key_invalid') ||
    text.includes('invalid api key') ||
    text.includes('invalid_api_key') ||
    text.includes('unauthenticated') ||
    text.includes('authentication') ||
    text.includes('401') ||
    text.includes('invalid authentication') ||
    (text.includes('permission denied') && (text.includes('api key') || text.includes('credential') || text.includes('auth')));
}

export function hasAvailableModels(value) {
  return toText(value).includes('Available Models:');
}

export function isModelOrRequestError(value) {
  const text = toLowerText(value);
  return text.includes('404') ||
    text.includes('not found') ||
    text.includes('not supported') ||
    text.includes('model') ||
    text.includes('bad request') ||
    text.includes('invalid argument') ||
    text.includes('invalid_argument') ||
    text.includes('thinkingconfig') ||
    text.includes('thinking_config') ||
    text.includes('generatecontent') ||
    text.includes('streamgeneratecontent');
}

export function buildApiFailureMessage(label, diagnosis, details, options = {}) {
  const diagnosisText = toText(diagnosis);
  const detailText = Array.isArray(details) ? details.join('\n') : toText(details);
  const diagnosisLooksAvailable = hasAvailableModels(diagnosisText);
  const detailBlock = detailText ? `\n\n[Chi tiết lỗi từng model]\n${detailText}` : '';

  if (options.safety || isSafetyError(diagnosisText) || isSafetyError(detailText)) {
    return options.vision ?
      '【Hạn chế nội dung】Bộ lọc an toàn đã chặn ảnh. Hãy thử ảnh khác.' :
      '【Hạn chế nội dung】Bộ lọc an toàn đã chặn yêu cầu. Hãy thay đổi cách diễn đạt.';
  }

  if (options.quota || isQuotaError(diagnosisText) || isQuotaError(detailText)) {
    return '【Giới hạn API】Đã đạt giới hạn sử dụng. Hãy chờ một lúc rồi thử lại.';
  }

  if (isAuthError(diagnosisText) || (options.auth && !diagnosisLooksAvailable && !isModelOrRequestError(detailText))) {
    return '【Lỗi xác thực】Khóa API không hợp lệ. Hãy nhập đúng khóa.';
  }

  if (diagnosisLooksAvailable || isModelOrRequestError(diagnosisText) || isModelOrRequestError(detailText)) {
    return `【Lỗi model / yêu cầu】Khóa API đã lưu nhưng model khả dụng hoặc định dạng yêu cầu không được chấp nhận.\nChẩn đoán: ${diagnosisText}${detailBlock}`;
  }

  return `${label}: ${diagnosisText}${detailBlock}`;
}

export {
  toText as Ho,
  toLowerText as kr,
  isSafetyError as Hs,
  isQuotaError as Js,
  isAuthError as fo,
  hasAvailableModels as Vd,
  isModelOrRequestError as ia,
  buildApiFailureMessage as xr,
};
