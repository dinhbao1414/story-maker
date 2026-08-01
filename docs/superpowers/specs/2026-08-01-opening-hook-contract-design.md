# Opening Hook Contract Design

Date: 2026-08-01
Target: `C:\Users\thedu\Desktop\CODE\Story Maker\story-maker`

## Mục tiêu

Bổ sung hợp đồng hook mở đầu dùng chung cho mọi mode kể chuyện công khai. Câu đầu tiên của thân truyện phải tạo xung đột, bất thường, nguy cơ, mất mát hoặc câu hỏi cụ thể. Khoảng 200 ký tự đầu phải tiếp tục mở rộng lực hút, không chuyển sang giải thích dài.

Hook thích nghi với hồ sơ phong cách phân tích từ TXT. Style quyết định giọng, nhịp, mức kịch tính và hình thức mở đầu nhưng không được vô hiệu hóa yêu cầu có hook.

## Phạm vi mode

Áp dụng cho `short_short`, `novel`, `medium`, `long_10000`, `scenario`, `manga`, `fairy`, `documentary`, `radio`, `4koma`, `4koma_scenario`.

Không ép hợp đồng hook kể chuyện cho `essay`, `poem`, `letter`, `diary`.

Với output có tiêu đề, hook được tính từ câu đầu tiên của thân truyện, không tính dòng tiêu đề hoặc khoảng trắng phân cách. Với `4koma` và `4koma_scenario`, hook nằm trong nội dung khung đầu tiên.

Ranh giới sửa hook được tính trên thân truyện sau khi bỏ khoảng trắng đầu. Hệ thống ưu tiên kết thúc tại dấu kết câu cuối cùng không vượt quá 200 ký tự Unicode; nếu chưa có dấu kết câu, dùng đúng mốc 200 ký tự. Quy tắc này chỉ xác định vùng được phép thay, không dùng để tự chấm chất lượng văn học.

## Kiến trúc

Thêm helper hợp đồng hook độc lập, dự kiến `src/openingHookContracts.js`. Helper nhận mode và ngữ cảnh style, trả về chỉ dẫn phù hợp để tái sử dụng tại các điểm tạo prompt và biên tập.

Hợp đồng được tích hợp vào:

- quality prompt chung trong `src/promptBuilder.js`;
- prompt trực tiếp của `long_10000` trong `src/directLong10000.js`;
- rubric AI review trong `src/editorialReviewContracts.js`;
- chỉ dẫn auto brush-up hiện có;
- dữ liệu style preset từ `src/stylePresetHelpers.js` khi có `opening_style`.

Không thêm UI, dependency, provider route hoặc lượt API chuyên kiểm tra hook. Hệ thống dùng lượt AI review và brush-up hiện có.

## Hợp đồng theo nhóm mode

### Văn xuôi

Áp dụng cho `short_short`, `novel`, `medium`, `long_10000`. Câu đầu ưu tiên hành động gây hậu quả, lời thoại làm lộ xung đột, mất mát/nguy cơ cụ thể, nghịch lý liên quan nhân vật chính hoặc thông tin khiến hoàn cảnh bị đảo nghĩa.

### Kịch bản và radio

Áp dụng cho `scenario`, `radio`. Mở bằng lời thoại, hành động sân khấu hoặc âm thanh báo hiệu biến cố. Không dẫn giải dài trước tình huống đáng chú ý.

### Manga và 4koma

Áp dụng cho `manga`, `4koma`, `4koma_scenario`. Khung đầu phải chứa hình ảnh, hành động, lời thoại hoặc tình huống tạo câu hỏi ngay lập tức. Không dùng khung đầu chỉ để giới thiệu bối cảnh trung tính.

### Truyện cổ tích

Áp dụng cho `fairy`. Mở bằng điều bất thường, mong muốn rõ ràng hoặc nguy cơ phù hợp đối tượng. Không ép giật gân, bạo lực hoặc sắc thái trái style.

### Documentary

Áp dụng cho `documentary`. Mở bằng phát hiện, mâu thuẫn, hậu quả hoặc câu hỏi điều tra cụ thể. Không khẳng định dữ kiện chưa được cung cấp như sự thật.

## Thích nghi theo style TXT

Khi preset có `opening_style`, hợp đồng hook truyền trực tiếp dữ liệu này vào prompt thay vì chỉ phụ thuộc vào `reproduction_prompt` tổng quát.

Thứ tự ưu tiên:

1. Luôn bảo đảm chức năng hook.
2. Giữ đúng mode và định dạng output.
3. Thích nghi nhịp, giọng, mức trực diện và hình thức theo `opening_style`.
4. Tránh sao chép câu chữ hoặc tình tiết từ TXT nguồn.

Nếu không có `opening_style`, dùng hợp đồng mặc định của nhóm mode. Style không được tạo ngoại lệ cho mở đầu nhạt.

## Mở đầu bị cấm

Cấm tuyệt đối các dạng sau khi chúng chỉ đóng vai trò dẫn nhập, chưa tạo xung đột hoặc tò mò cụ thể:

- mô tả thời tiết chung chung;
- nhân vật thức dậy hoặc bắt đầu ngày mới;
- giới thiệu tiểu sử nhân vật;
- giải thích thế giới hoặc bối cảnh dài;
- triết lý trừu tượng;
- cấu trúc “đây là câu chuyện về…”;
- tóm tắt chủ đề thay cho cảnh truyện.

Một chi tiết thuộc danh sách trên chỉ hợp lệ nếu ngay câu đầu nó trực tiếp gây biến cố, làm lộ nguy cơ hoặc đảo nghĩa tình huống.

## AI review

Rubric review thêm trục `opening_hook`: sức hút câu đầu, khả năng duy trì tò mò trong 200 ký tự đầu, mức phù hợp mode, mức phù hợp `opening_style`, và không vi phạm danh sách mở đầu bị cấm.

Review phải nêu hook đạt hay yếu cùng lý do ngắn. Không dùng bộ dò từ khóa cứng để kết luận chất lượng hook.

## Auto brush-up

Khi review xác định hook yếu, lượt brush-up hiện có nhận chỉ dẫn sửa hook. Không phát sinh lượt API mới.

Đối với sửa chữa riêng lỗi hook:

- chỉ phần mở đầu tối đa 200 ký tự của thân truyện được thay đổi;
- giữ nguyên tiêu đề và phần thân sau ranh giới sửa;
- không đổi cốt truyện, dữ kiện, nhân vật, ngôi kể hoặc style;
- đoạn thay thế phải nối tự nhiên với phần còn lại.

Lượt brush-up phải trả về riêng đoạn mở đầu thay thế, không trả lại toàn bộ truyện. Hệ thống chỉ ghép đoạn này vào vùng mở đầu đã xác định. Nếu phản hồi rỗng, vượt giới hạn, sai định dạng hoặc không thể ghép an toàn, giữ nguyên bản gốc và báo sửa hook thất bại; không làm mất output đã tạo.

Nếu review đồng thời phát hiện lỗi khác cần sửa rộng hơn, luồng brush-up hiện tại vẫn xử lý theo hợp đồng biên tập đang có. Giới hạn 200 ký tự chỉ khóa sửa chữa hook độc lập.

## Luồng dữ liệu

1. Xác định output mode.
2. Lấy `opening_style` từ style preset nếu có.
3. Tạo hợp đồng hook theo nhóm mode.
4. Inject hợp đồng vào prompt tạo truyện.
5. AI review chấm `opening_hook` trong lượt hiện có.
6. Nếu chỉ hook yếu, brush-up tạo bản vá mở đầu giới hạn 200 ký tự.
7. Ghép bản vá với phần thân giữ nguyên; tiếp tục kiểm tra hiện có.

## Kiểm thử

Kiểm thử tự động phải xác nhận:

- mọi mode kể chuyện ánh xạ đúng nhóm hook;
- các mode ngoài phạm vi không nhận hợp đồng hook kể chuyện;
- prompt chung chứa yêu cầu câu đầu và 200 ký tự đầu;
- `long_10000` nhận cùng hợp đồng hook;
- `4koma` và `4koma_scenario` yêu cầu hook ở khung đầu;
- `opening_style` được truyền trực tiếp khi có dữ liệu;
- fallback hoạt động khi thiếu `opening_style`;
- rubric review có tiêu chí `opening_hook`;
- sửa hook độc lập giới hạn thay đổi ở 200 ký tự đầu;
- phản hồi sửa hook không hợp lệ giữ nguyên bản gốc;
- không tăng số lượt API của luồng review/brush-up.

Kiểm thử chỉ khóa việc tạo và truyền đúng hợp đồng. Chất lượng thực tế được kiểm tra bằng AI review và test tạo truyện thủ công.

## Điều kiện hoàn thành

- Mọi mode kể chuyện trong phạm vi yêu cầu hook tại câu đầu thân truyện hoặc khung đầu.
- Khoảng 200 ký tự đầu tiếp tục tăng xung đột hoặc tò mò.
- Hook thích nghi theo `opening_style` nhưng không trở thành mở đầu nhạt.
- AI review chấm riêng hook.
- Hook yếu được sửa bằng brush-up hiện có, không thêm API call.
- Sửa chữa riêng hook không thay đổi phần thân sau 200 ký tự đầu.
- Các mode ngoài phạm vi giữ nguyên hành vi.

## Ngoài phạm vi

- Thêm lựa chọn loại hook trên UI.
- Thêm API call chuyên chấm hook.
- Kiểm tra hoặc tự sửa hook bằng danh sách từ khóa cứng.
- Thay đổi model, endpoint, provider hoặc timeout.
- Thay đổi logic cốt truyện ngoài phần mở đầu.
- Deploy, version bump, push, tag hoặc release.
