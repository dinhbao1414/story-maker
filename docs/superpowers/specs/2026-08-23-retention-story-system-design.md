# CTR–Retention–Comment Story System Design

## Goal

Nâng cấp công thức `Daily Scat – Drama gia đình Nhật` và các công thức được phân tích sau này thành một hệ thống viết truyện tối ưu cho ba chỉ số liên kết: thumbnail/title tạo CTR, hook 30 giây đầu giữ người xem, và payoff đạo đức kích thích comment.

## Scope

Đây là chỉnh sửa app `story-maker` hiện tại. Luồng người dùng giữ nguyên:

1. Chọn công thức kênh.
2. Bấm `AI Random mô típ & điền thiết lập`.
3. AI hoặc fallback local tạo một gói motif/settings ngắn.
4. Settings được áp dụng vào Dashboard.
5. Người dùng bấm `Tạo truyện` như hiện tại.

Nút Random không sinh truyện dài và không gọi Longify.

## Design

### 1. Formula analysis contract

Mỗi phân tích file và bản tổng hợp công thức sẽ mô tả thêm một `audienceGrowthSystem` trừu tượng, không lưu raw transcript:

- `ctrPromise`: công thức title/thumbnail dựa trên bất công, bí mật, quan hệ hoặc địa vị, kèm lời hứa đảo chiều.
- `hook30s`: cảnh hoặc câu thoại gây sốc phải xuất hiện ngay; cấm mở đầu bằng giới thiệu dài.
- `curiosityLadder`: các cặp `question`/`answer` nối tiếp, trong đó mỗi answer tạo ra câu hỏi lớn hơn.
- `retentionBeats`: các mốc 30 giây–3 phút, 3–8 phút, 8–15 phút, 15–20 phút, 20–25 phút.
- `commentPayoff`: payoff cụ thể và vấn đề đạo đức còn đủ mở để người xem tranh luận.
- `antiDropRules`: không để câu hỏi sống quá lâu, không lặp cùng một cảnh, không giải thích thay cho hành động.

Các trường được sanitize cùng quy tắc hiện tại; không được chứa API key, raw source, exact quote, tên riêng hoặc sự kiện độc nhất của file nguồn.

### 2. Random motif/settings contract

Structured AI random trả JSON ngắn với các trường mới:

- `titlePromise`: một lời hứa tiêu đề hướng CTR, không phải title cố định bắt buộc.
- `thumbnailConcept`: mô tả hình ảnh/đối lập cảm xúc; không yêu cầu tạo ảnh.
- `hook30s`: tình huống và câu thoại mở đầu có thể đưa thẳng vào truyện.
- `questionLadder`: 3–5 phần tử `{ question, answer, nextQuestion }`.
- `retentionBeats`: danh sách beat bám theo các mốc thời gian.
- `twist`: twist trung tâm và điều khán giả hiểu sai ban đầu.
- `commentDilemma`: câu hỏi đạo đức cuối truyện.

Các trường này được chuẩn hóa và gộp vào `supplement` theo nhãn rõ ràng để prompt Dashboard sử dụng. Các axis/characters hiện có vẫn được điền như trước; `channelFormula` vẫn được khóa. Fallback local phải tạo cùng cấu trúc tối thiểu, để mất API không làm mất hệ thống retention.

### 3. Generation prompt contract

Prompt sinh truyện dài 20K phải yêu cầu:

- Tiếng Nhật בלבד, output story only, không xuất prompt/JSON/checklist.
- Hook 30 giây đầu bắt đầu bằng hành động hoặc câu nói gây sốc; không chào kênh/CTA trước hook.
- Title/thumbnail promise phải được trả bằng xung đột sớm, không hứa một cú twist không tồn tại.
- Dùng chuỗi `Question A → Answer A → Question B → Answer B...`; mọi câu hỏi phải được trả lời trong cùng hoặc chương kế tiếp.
- Bắt buộc có các mốc leo thang và twist theo `retentionBeats`.
- Kết thúc giải quyết được xung đột chính bằng hành động/bằng chứng, đồng thời để lại `commentDilemma` tự nhiên; không chèn CTA máy móc.
- Duy trì quality gate tối thiểu 20.000 ký tự không whitespace và kết thúc hoàn chỉnh hiện có.

### 4. Error/fallback behavior

- Structured AI lỗi, timeout hoặc 429: dùng fallback motif cục bộ hiện có, mở rộng với hook/question ladder/comment dilemma.
- Không tạo request song song.
- Không lưu raw TXT trong formula catalog, IndexedDB hoặc export settings.
- Không thay đổi provider, retry hoặc longify ledger behavior đã sửa trước đó.

## Non-goals

- Không xây hệ thống phân tích CTR thực tế từ YouTube Analytics.
- Không tạo thumbnail bằng AI.
- Không thay đổi UI Dashboard ngoài việc hiển thị/điền phần supplement đã có.
- Không tự động sinh truyện tại bước Random.
- Không thêm CTA cố định vào mọi truyện.

## Verification criteria

- Prompt analysis/synthesis chứa contract mới và cấm sao chép nguồn.
- Prompt random yêu cầu đầy đủ trường CTR/hook/question ladder/retention/twist/comment.
- Normalization loại bỏ dữ liệu nhạy cảm và giữ `channelFormula` locked.
- Fallback luôn tạo được tối thiểu 3 câu hỏi liên kết và một dilemma đạo đức.
- Generation prompt chứa các mốc retention, hook 30s, question ladder và comment payoff.
- Full Node test suite, generic-rule check, build và local HTTP smoke đều pass.

