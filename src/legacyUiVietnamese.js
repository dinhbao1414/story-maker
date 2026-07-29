const EXACT_TRANSLATIONS = new Map([
  ['対応する画像ファイルがありません。\nPNG/JPG/WEBP/GIF のみ対応しています。', 'Không có tệp ảnh được hỗ trợ.\nChỉ hỗ trợ PNG/JPG/WEBP/GIF.'],
  ['🎨 この作風でリライト実行', '🎨 Viết lại theo phong cách này'],
  ['✅ コピー完了', '✅ Đã sao chép'],
  ['📋 コピー', '📋 Sao chép'],
  ['この項目のロックを解除する', 'Mở khóa mục này'],
  ['この項目をロックしてランダム変更から保護', 'Khóa mục này để tránh thay đổi ngẫu nhiên'],
  ['現在の設定内容は保持したまま、ChatGPT APIに切り替えます（現在: Gemini）', 'Giữ nguyên thiết lập và chuyển sang ChatGPT API (hiện tại: Gemini)'],
  ['現在の設定内容は保持したまま、Gemini APIに切り替えます（現在: ChatGPT）', 'Giữ nguyên thiết lập và chuyển sang Gemini API (hiện tại: ChatGPT)'],
  ['⚠ API未設定', '⚠ Chưa cấu hình API'],
  ['OpenAI APIキーを入力（sk-...）', 'Nhập khóa OpenAI API (sk-...)'],
  ['Gemini APIキーを入力', 'Nhập khóa Gemini API'],
  ['Gemini または OpenAI のAPIキーを入力', 'Nhập khóa API Gemini hoặc OpenAI'],
  ['APIキーを入力してください', 'Vui lòng nhập khóa API'],
  ['AIの思考を待っています...（しばらくお待ちください）', 'Đang chờ AI xử lý... Vui lòng đợi.'],
]);

const SHARED_REPLACEMENTS = [
  ['リライトエラー:', 'Lỗi viết lại:'],
  ['フォールバック中:', 'Đang chuyển sang model dự phòng:'],
  ['フォールバック:', 'Model dự phòng:'],
  ['⚠️ <strong>稼働中:</strong>', '⚠️ <strong>Đang chạy:</strong>'],
  ['[システム] 応答遅延または制限のため、モデルを', '[Hệ thống] Phản hồi chậm hoặc bị giới hạn; chuyển model sang'],
  ['にフォールバックします...', '...'],
  ['・ステータス: 完了', '• Trạng thái: Hoàn tất'],
  ['・最終文字数:', '• Số ký tự cuối:'],
];

const PROGRESS_REPLACEMENTS = [
  ['[検査]', '[Kiểm tra]'],
  ['[修正]', '[Sửa]'],
  ['設定整合性チェックを実行中...', 'Đang kiểm tra tính nhất quán...'],
  ['設定整合性チェックを実行中', 'Đang kiểm tra tính nhất quán'],
  ['検査APIエラー', 'Lỗi API kiểm tra'],
  ['矛盾検査APIエラー', 'Lỗi API kiểm tra mâu thuẫn'],
  ['矛盾検査APIコールが失敗しました:', 'Lệnh gọi API kiểm tra mâu thuẫn thất bại:'],
  ['矛盾修正APIコールが失敗しました:', 'Lệnh gọi API sửa mâu thuẫn thất bại:'],
  ['指摘を検出', 'phát hiện vấn đề'],
  ['重大な矛盾なし', 'Không có mâu thuẫn nghiêm trọng'],
  ['矛盾は検出されませんでした', 'Không phát hiện mâu thuẫn'],
  ['修正対象の矛盾は残っていません', 'Không còn mâu thuẫn cần sửa'],
  ['修正完了。再検査を実行します...', 'Sửa xong. Đang kiểm tra lại...'],
  ['修正結果の文字数が異常に変動', 'Độ dài sau sửa thay đổi bất thường'],
  ['この修正を棄却します', 'Bỏ kết quả sửa này'],
  ['修正上限', 'giới hạn số lần sửa'],
  ['重大な矛盾が', 'còn mâu thuẫn nghiêm trọng: '],
  ['件残存しています', ' vấn đề'],
  ['重大:', 'nghiêm trọng:'],
  ['軽微:', 'nhẹ:'],
  ['再検査', 'kiểm tra lại'],
];

function isProgressTarget(target) {
  return target?.id === 'progress-log' || target?.id === 'progress-title-text';
}

function translateLegacyUiText(value, target = null) {
  const original = String(value ?? '');
  const exact = EXACT_TRANSLATIONS.get(original);
  if (exact) return exact;

  let translated = original;
  for (const [from, to] of SHARED_REPLACEMENTS) translated = translated.replaceAll(from, to);

  if (isProgressTarget(target)) {
    translated = translated.replace(/第(\d+)章の設定整合性チェックを実行中/g, 'Đang kiểm tra tính nhất quán của Chương $1');
    for (const [from, to] of PROGRESS_REPLACEMENTS) translated = translated.replaceAll(from, to);
  }

  if (target?.id === 'output' && translated.includes('class="error-msg"')) {
    translated = translated.replaceAll('エラー:', 'Lỗi:');
  }
  return translated;
}

function wrapSetter(prototype, property) {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
  if (!descriptor?.set || !descriptor.get) return;
  Object.defineProperty(prototype, property, {
    ...descriptor,
    set(value) {
      descriptor.set.call(this, translateLegacyUiText(value, this));
    },
  });
}

function installLegacyUiVietnameseRuntime(windowObject = globalThis.window) {
  if (!windowObject || windowObject.__storyMakerVietnameseUiInstalled) return;
  windowObject.__storyMakerVietnameseUiInstalled = true;

  wrapSetter(windowObject.Node.prototype, 'textContent');
  wrapSetter(windowObject.Element.prototype, 'innerHTML');
  wrapSetter(windowObject.HTMLElement.prototype, 'title');
  wrapSetter(windowObject.HTMLInputElement.prototype, 'placeholder');

  const nativeAlert = windowObject.alert.bind(windowObject);
  const nativeConfirm = windowObject.confirm.bind(windowObject);
  windowObject.alert = message => nativeAlert(translateLegacyUiText(message));
  windowObject.confirm = message => nativeConfirm(translateLegacyUiText(message));
}

export { installLegacyUiVietnameseRuntime, translateLegacyUiText };
