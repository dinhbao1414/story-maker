# Story DNA Matrix & Novelty Checker Design

## Goal

Cho phép một channel formula sản xuất 30–50 story trong cùng một series mà vẫn giữ đúng DNA kênh, đồng thời phát hiện và ngăn concept mới trùng với story đã lên kế hoạch hoặc đã sản xuất.

## Scope

Đây là chỉnh sửa app `story-maker` hiện tại. Luồng tạo truyện được mở rộng nhưng không thay đổi nguyên tắc:

1. Chọn channel formula.
2. Tạo hoặc mở một Story DNA Matrix gắn với formula.
3. `AI Random mô típ & điền thiết lập` chọn một story card chưa dùng trong Matrix.
4. App kiểm tra novelty trước khi áp dụng.
5. App điền settings vào Dashboard.
6. Người dùng bấm `Tạo truyện`.
7. Khi story hoàn tất, story card được đánh dấu `used` và lưu metadata/fingerprint.

Nút Random không sinh 30–50 truyện hoàn chỉnh. Matrix chỉ gồm concept card ngắn và metadata chống trùng.

## Core concepts

### 1. Fixed channel DNA

Channel formula tiếp tục giữ các quy tắc bất biến:

- hook và giọng kể;
- cấu trúc chương;
- nhịp CTR/retention/comment;
- kiểu payoff và giới hạn sao chép nguồn.

Matrix không thay thế formula. Matrix chỉ quy hoạch các biến thể story trong cùng formula.

### 2. Series Story DNA Matrix

Một Matrix được liên kết bằng `formulaId` và có số lượng mục tiêu 30, 40 hoặc 50. Mỗi row là một concept card:

```json
{
  "id": "story-001",
  "formulaId": "builtin-daily-scat-family-drama-ja",
  "status": "planned",
  "titlePromise": "",
  "hook": "",
  "victim": "",
  "antagonist": "",
  "falseAccusation": "",
  "location": "",
  "evidence": "",
  "secret": "",
  "midpointTwist": "",
  "finalTwist": "",
  "villainConsequence": "",
  "ending": "",
  "moralDilemma": "",
  "noveltyFingerprint": "",
  "usedAt": null,
  "storyId": null
}
```

Các field phải là abstract story metadata, không lưu raw TXT nguồn, exact quote, API key hoặc thông tin bí mật.

### 3. Story history

Sau khi tạo story thành công, lưu một metadata snapshot tối thiểu:

- `matrixRowId`;
- `formulaId`;
- title/hook thực tế;
- các trường DNA đã dùng;
- `noveltyFingerprint`;
- `createdAt`;
- liên kết tới story/project nếu có.

Story text đầy đủ tiếp tục tuân theo cơ chế lưu story hiện tại; novelty ledger không cần sao chép toàn bộ manuscript.

## Matrix generation

### User flow

Trong tab `Công thức kênh`, thêm action:

`Tạo Story DNA Matrix`

Người dùng chọn 30, 40 hoặc 50 rows. App gửi một structured request yêu cầu AI tạo các concept card JSON. Nếu response quá dài hoặc lỗi parse, app chia thành batch nhỏ và retry theo cơ chế provider hiện tại. Không tạo request song song.

### Diversity constraints

Prompt và validator phải yêu cầu phủ đủ biến thể:

- ít nhất 8–12 location khác nhau;
- ít nhất 6 loại evidence;
- ít nhất 6 antagonist archetype;
- ít nhất 5 kiểu false accusation;
- ít nhất 5 midpoint twist;
- ít nhất 5 loại villain consequence;
- không để hai row liên tiếp trùng `evidence + midpointTwist`;
- không để một location hoặc evidence chiếm phần lớn Matrix.

Nếu AI tạo thiếu diversity, app giữ các row hợp lệ và yêu cầu tạo bổ sung cho nhóm field thiếu thay vì chấp nhận Matrix đơn điệu.

## Novelty checker

### Hard duplicate rules

Candidate bị reject ngay nếu:

- trùng hook + evidence + midpoint twist với row khác;
- trùng false accusation + location + final twist với row khác;
- trùng từ bốn field DNA quan trọng trở lên với một row đã dùng;
- row đó đã có status `used`, `skipped` hoặc đang bị khóa.

### Weighted similarity

Ngoài hard rules, app tính điểm tương đồng theo field. Trọng số mặc định:

- hook: 0.18;
- midpoint twist: 0.16;
- final twist: 0.13;
- evidence: 0.12;
- false accusation: 0.10;
- antagonist: 0.09;
- secret: 0.08;
- location: 0.06;
- ending: 0.05;
- villain consequence: 0.03.

Ngưỡng khởi đầu:

- `< 0.35`: safe;
- `0.35–0.55`: warning, hiển thị các field bị trùng;
- `> 0.55`: reject và chọn/regenerate row khác.

So sánh local trước. Chỉ dùng AI judge cho vùng `warning` khi người dùng yêu cầu kiểm tra sâu; không gọi AI cho mọi lần Random.

### Novelty report

Trước khi áp dụng Dashboard, hiển thị:

- novelty score;
- row gần nhất;
- field trùng;
- lý do safe/warning/reject.

Nếu reject, UI cung cấp hai lựa chọn:

- `Chọn story card khác`;
- `Tạo lại các field bị trùng`.

Không random lại toàn bộ Matrix chỉ vì một row bị reject.

## Random integration

`AI Random mô típ & điền thiết lập` thay đổi thành luồng:

1. tìm Matrix đang hoạt động của `formulaId`;
2. lấy các row `planned` chưa khóa;
3. chọn row có novelty score thấp nhất hoặc random trong nhóm safe;
4. mở rộng row thành settings hiện tại;
5. đưa `matrixRowId` và DNA metadata vào supplement;
6. áp dụng Dashboard và chuyển Dashboard;
7. không gọi Longify và không tạo story tại bước này.

Nếu formula chưa có Matrix:

- hỏi người dùng tạo Matrix; hoặc
- dùng fallback motif cũ ở chế độ tương thích, nhưng phải ghi rõ `matrix unavailable`.

Fallback local không được tự ý đánh dấu row `used`.

## Persistence and schema

Matrix nên được lưu trong IndexedDB store riêng, liên kết với `formulaId`, thay vì nhúng toàn bộ vào `reproductionPrompt`. Lý do:

- có thể cập nhật từng row;
- hỗ trợ nhiều series cho cùng một formula;
- không làm phình formula export;
- dễ đánh dấu `used/skipped/locked`;
- dễ migrate schema sau này.

Export/import Matrix phải sanitize cùng chuẩn formula hiện tại và loại bỏ secret-looking keys/raw-source fields.

## Failure and recovery

- AI timeout/429/invalid JSON: retry/fallback theo provider hiện tại, không request song song.
- Matrix generation thất bại giữa chừng: giữ các row hợp lệ đã lưu, cho phép resume phần còn thiếu.
- Novelty checker lỗi: không âm thầm cho qua; giữ candidate ở trạng thái `needs-review`.
- Story generation thất bại: row vẫn là `planned`, không đánh dấu `used`.
- Story generation thành công nhưng lưu history lỗi: giữ story output, hiển thị cảnh báo và cho phép retry metadata save.

## Non-goals

- Không phân tích CTR thực tế từ YouTube Analytics.
- Không tạo thumbnail bằng AI.
- Không dùng embedding/vector database ở phiên bản đầu.
- Không thay đổi quality gate 20K.
- Không lưu raw transcript vào Matrix.
- Không tự động tạo toàn bộ 30–50 manuscript.

## Acceptance criteria

- Người dùng tạo được Matrix 30/40/50 row cho một formula.
- Matrix được lưu và mở lại sau reload.
- Mỗi row có đủ 11 field DNA cốt lõi và trạng thái vòng đời.
- Random chỉ chọn row chưa dùng và đưa `matrixRowId` vào Dashboard settings.
- Candidate trùng theo hard rules bị chặn.
- Candidate warning hiển thị score và field trùng.
- Candidate safe được áp dụng bình thường.
- Story thành công đánh dấu đúng row `used`; story lỗi không đánh dấu.
- Fallback hiện tại vẫn hoạt động khi chưa có Matrix hoặc AI lỗi.
- Không raw source/API key xuất hiện trong Matrix export hoặc IndexedDB record.

