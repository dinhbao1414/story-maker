# Thiết kế Project Management Dashboard cho Story Maker

**Ngày:** 2026-07-31
**Trạng thái:** Đã được người dùng duyệt
**Phạm vi:** Bổ sung khu vực quản lý Dự án Story vào ứng dụng Story Maker hiện tại

## 1. Mục tiêu

Thêm tab **Dự án Story** để người dùng lưu một bộ phong cách và toàn bộ thiết lập tạo truyện thành một dự án sản xuất có thể tái sử dụng. Mỗi dự án quản lý mục tiêu số lượng, trạng thái, tiến độ, lịch sử chạy và các truyện đã tạo.

Tính năng phải giúp người dùng:

- Tạo dự án từ thiết lập hiện tại trên Dashboard hoặc từ một hay nhiều file TXT mới.
- Phân tích TXT, xem trước kết quả, sau đó lưu thành DNA phong cách của dự án.
- Tạo một truyện hoặc tạo hàng loạt với ít thao tác.
- Giữ DNA phong cách ổn định nhưng biến tấu nội dung có kiểm soát.
- Theo dõi số truyện thành công, lỗi và tiến độ mục tiêu.
- Mở lại, sửa, nhân bản, tạm dừng, tiếp tục, xuất, nhập hoặc xóa dự án.

## 2. Ngoài phạm vi

Phiên bản đầu không có:

- Tài khoản người dùng hoặc đăng nhập.
- Đồng bộ đám mây hoặc đồng bộ nhiều thiết bị.
- Lập lịch chạy theo giờ.
- Gửi nhiều yêu cầu AI song song.
- Thay đổi prompt cốt lõi, API client, retry `429`, định dạng đầu ra hoặc logic tạo truyện hiện tại.
- Lưu API key vào dữ liệu dự án hoặc file xuất.

## 3. Điều hướng

Thanh tab bên trái có thứ tự:

1. **Dashboard**
2. **Dự án Story**
3. **Cài đặt**

Dashboard tiếp tục là màn hình đầu tiên. Tab Dự án Story là khu vực quản lý sản xuất. Tab Cài đặt giữ nguyên chức năng hiện tại.

## 4. Bố cục tab Dự án Story

Thiết kế dùng hướng **Quản trị đầy đủ** nhưng vẫn giữ **Card View Grid**.

### 4.1 Khu vực tổng quan

Đầu trang hiển thị bốn chỉ số:

- Tổng dự án.
- Tổng truyện đã tạo thành công.
- Số dự án đang sản xuất.
- Số dự án đã hoàn thành.

Các chỉ số chỉ phục vụ tổng quan, không có biểu đồ phân tích nâng cao trong phiên bản đầu.

### 4.2 Thanh công cụ

Thanh công cụ gồm:

- Ô tìm kiếm theo tên dự án.
- Lọc theo trạng thái.
- Sắp xếp theo cập nhật mới nhất, tên hoặc tiến độ.
- Nút chính **＋ Tạo dự án**.

### 4.3 Card dự án

Mỗi Card hiển thị:

- Tên dự án.
- Trạng thái hiện tại.
- Tóm tắt DNA phong cách.
- Số file TXT đã dùng để phân tích.
- Tiến độ dạng `7/20 truyện — 35%`.
- Số lần tạo lỗi nếu lớn hơn 0.
- Thời gian cập nhật gần nhất.
- Nút chính **Tạo truyện**.
- Menu `•••` chứa **Sửa**, **Nhân bản**, **Tạm dừng/Tiếp tục**, **Xuất dự án** và **Xóa**.

Không đặt Sửa và Xóa thành hai nút nổi bật trên mọi Card. Cách này giảm nhiễu và tránh xóa nhầm.

## 5. Tạo dự án

Nút **＋ Tạo dự án** mở Modal ba bước.

### Bước 1: Chọn nguồn thiết lập

Người dùng chọn một trong hai cách:

- **Dùng Dashboard hiện tại:** chụp toàn bộ thiết lập, nhân vật và hồ sơ phong cách đang áp dụng.
- **Nhập TXT mới:** chọn một hoặc nhiều file TXT, chạy luồng phân tích phong cách hiện tại và xem trước kết quả.

Kết quả phân tích chưa tự động thay đổi Dashboard. Chỉ khi người dùng duyệt Modal thì snapshot mới được lưu vào dự án.

### Bước 2: Thông tin sản xuất

Các trường bắt buộc hoặc mặc định:

- Tên dự án: bắt buộc, không chỉ chứa khoảng trắng.
- Mục tiêu số truyện: số nguyên dương, mặc định `10`.
- Chế độ tạo: hỗ trợ một truyện hoặc hàng loạt.
- Mức biến tấu: mặc định **Biến tấu có kiểm soát**.

### Bước 3: Xem trước

Màn hình xem trước tách rõ:

- DNA phong cách được khóa.
- Thiết lập cố định.
- Yếu tố được phép ngẫu nhiên.
- Số file TXT nguồn và tên file.
- Mục tiêu sản xuất.

Nút **Tạo dự án** chỉ lưu dự án. Ứng dụng không tự gọi API hoặc tạo truyện ngay sau khi đóng Modal.

## 6. Biến tấu có kiểm soát

Mỗi dự án lưu một snapshot độc lập của hồ sơ phong cách và thiết lập. Khi tạo nhiều truyện:

### Luôn khóa

- DNA phong cách đã phân tích.
- Giọng văn, nhịp kể và ngôi kể cốt lõi.
- Độc giả mục tiêu.
- Các trường người dùng chủ động khóa trong thiết lập.
- Chế độ đầu ra và các ràng buộc bắt buộc của dự án.

### Được phép biến tấu

- Chủ đề cụ thể.
- Xung đột trung tâm.
- Nghề nghiệp, quan hệ và tên nhân vật.
- Bối cảnh chi tiết.
- Bí mật, cú lật và cơ chế đảo chiều.
- Cách trừng phạt hoặc giải quyết mâu thuẫn.
- Chi tiết kết thúc trong giới hạn kiểu kết thúc đã khóa.

Trước khi chạy, người dùng được xem trước các yếu tố biến tấu. Người dùng có thể tạo lại bản biến tấu hoặc chỉnh thủ công trước khi gọi API.

## 7. Tạo truyện và tạo hàng loạt

Nút **Tạo truyện** cho phép:

- Tạo một truyện.
- Chọn số lượng còn lại trong mục tiêu để tạo thành lô.

Tạo hàng loạt phải chạy **tuần tự**, mỗi lần chỉ tạo một truyện. Không gửi nhiều yêu cầu song song. Cách này giữ nguyên cơ chế retry hiện tại, giảm nguy cơ `429` và cho phép lưu chắc chắn từng kết quả.

Sau mỗi truyện:

- Nếu thành công, lưu truyện ngay và tăng bộ đếm thành công.
- Nếu thất bại, ghi lỗi và không tăng tiến độ.
- Lỗi của một truyện không xóa các truyện đã hoàn thành trước đó.
- Hàng đợi có thể tiếp tục với truyện kế tiếp hoặc dừng theo chính sách lỗi của giao diện.

Nút **Tạm dừng** chỉ dừng sau khi yêu cầu hiện tại kết thúc. Không hủy cưỡng bức một phản hồi đang được ghi để tránh mất dữ liệu.

## 8. Trạng thái dự án

Các trạng thái hợp lệ:

- **Sẵn sàng:** đã có cấu hình, chưa có tác vụ đang chạy.
- **Đang sản xuất:** đang tạo một truyện hoặc xử lý hàng đợi.
- **Tạm dừng:** hàng đợi còn việc nhưng không tự chạy tiếp.
- **Hoàn thành:** số truyện thành công đã đạt mục tiêu.
- **Có lỗi:** lần tạo gần nhất thất bại và cần người dùng xem hoặc thử lại.

Tiến độ chỉ dựa trên số truyện tạo thành công:

`progress = successfulStoryCount / targetStoryCount`

Truyện lỗi không được tính vào tiến độ. Nếu người dùng tăng mục tiêu, dự án đã hoàn thành có thể trở lại trạng thái Sẵn sàng.

## 9. Trang chi tiết dự án

Bấm vào Card mở trang chi tiết gồm bốn khu vực.

### 9.1 Tổng quan

- Trạng thái.
- Mục tiêu.
- Tiến độ.
- Số truyện thành công và lỗi.
- Lần cập nhật gần nhất.
- Hành động tạo, tạm dừng hoặc tiếp tục.

### 9.2 Phong cách và thiết lập

- Xem snapshot phong cách.
- Xem các trường cố định và trường được biến tấu.
- Sửa cấu hình dự án mà không âm thầm thay đổi Dashboard.
- Nút **Áp dụng lên Dashboard** để người dùng chủ động đưa snapshot về màn hình làm việc hiện tại.

### 9.3 Danh sách truyện

Mỗi truyện có:

- Tiêu đề.
- Trạng thái thành công hoặc lỗi.
- Thời gian tạo.
- Số ký tự.
- Hành động xem, đổi tên, tải TXT hoặc xóa.

### 9.4 Lịch sử

Ghi các sự kiện cần thiết:

- Bắt đầu và kết thúc lần tạo.
- Truyện thành công.
- Lỗi API hoặc lỗi phân tích.
- Tạm dừng, tiếp tục hoặc thử lại.
- Thay đổi mục tiêu và cấu hình.

Lịch sử không lưu API key, Authorization header hoặc nội dung bí mật khác.

## 10. Lưu trữ cục bộ

Dùng `IndexedDB`, tính năng gốc của trình duyệt, không thêm thư viện mới.

IndexedDB lưu:

- Metadata dự án.
- Snapshot thiết lập.
- Snapshot kết quả phân tích phong cách.
- Tên các file TXT nguồn; nội dung TXT gốc không được giữ sau khi phân tích trong phiên bản đầu.
- Nội dung đầy đủ của các truyện đã tạo.
- Hàng đợi và lịch sử chạy cần thiết.

API key tiếp tục theo luồng hiện tại và không thuộc dữ liệu dự án.

Ứng dụng phải hỗ trợ:

- **Xuất dự án:** tạo file JSON chứa cấu hình, metadata, phong cách, lịch sử cần thiết và truyện đã lưu; không chứa API key.
- **Nhập dự án:** kiểm tra schema trước khi ghi dữ liệu.
- Cảnh báo rằng xóa dữ liệu trình duyệt có thể xóa dự án chưa sao lưu.

## 11. Xóa và an toàn dữ liệu

Xóa dự án là hành động phá hủy và phải có xác nhận rõ.

- Hiển thị tên dự án trong hộp xác nhận.
- Cho chọn giữ lại truyện đã tạo dưới dạng bản xuất trước khi xóa.
- Chỉ xóa sau xác nhận cuối.
- Không dùng hoàn tác giả nếu dữ liệu đã bị xóa khỏi IndexedDB.

Xóa một truyện riêng cũng cần xác nhận nhưng không ảnh hưởng cấu hình dự án.

## 12. Trạng thái rỗng, lỗi và phản hồi giao diện

- Khi chưa có dự án, hiển thị hướng dẫn ngắn và nút **Tạo dự án đầu tiên**.
- Khi tìm kiếm không có kết quả, giữ bộ lọc và cho phép xóa nhanh điều kiện tìm kiếm.
- Khi đang phân tích TXT hoặc tạo truyện, hiển thị tiến trình rõ ràng; không dùng vòng xoay vô hạn không có thông tin.
- Khi lỗi, hiển thị lỗi gần tác vụ liên quan và cung cấp **Thử lại**.
- Nút đang chạy phải có trạng thái disabled phù hợp để tránh gửi lặp.

## 13. Responsive và khả năng truy cập

- Desktop: Card Grid ba hoặc bốn cột tùy chiều rộng.
- Tablet: hai cột.
- Mobile: một cột.
- Mọi nút có vùng bấm tối thiểu 44 px.
- Menu `•••` có nhãn truy cập, điều hướng bàn phím và focus rõ.
- Trạng thái không chỉ phân biệt bằng màu; luôn có nhãn chữ.
- Modal giữ focus, hỗ trợ Escape và trả focus về nút mở sau khi đóng.
- Thanh tiến độ có giá trị và nhãn đọc được bởi trình đọc màn hình.

## 14. Ràng buộc tích hợp

- Tái sử dụng luồng phân tích phong cách và áp dụng thiết lập hiện tại; không tạo trình phân tích thứ hai.
- Tái sử dụng một đường tạo truyện hiện tại; Project chỉ điều phối snapshot và hàng đợi.
- Không thay đổi mặc định Dashboard khi người dùng chỉ xem hoặc sửa dự án.
- Không thay đổi prompt, provider routing, timeout, retry hoặc cơ chế bảo vệ dữ liệu hiện có nếu không có yêu cầu riêng.
- Dự án phải lưu snapshot độc lập; sửa Dashboard sau đó không âm thầm sửa dự án đã lưu.

## 15. Tiêu chí nghiệm thu

Tính năng đạt yêu cầu khi:

1. Tab Dự án Story xuất hiện sau Dashboard và trước Cài đặt.
2. Người dùng tạo được dự án từ Dashboard hiện tại hoặc từ TXT mới.
3. Modal luôn có bước xem trước trước khi lưu.
4. Card Grid hiển thị đúng trạng thái, tiến độ và hành động chính.
5. Người dùng tạo được một truyện và một lô tuần tự từ dự án.
6. DNA phong cách được giữ, các trục nội dung được biến tấu có kiểm soát và có xem trước.
7. Mỗi truyện thành công được lưu ngay; lỗi không làm mất kết quả trước đó.
8. F5 không làm mất dự án hoặc truyện đã lưu.
9. Tìm kiếm, lọc và sắp xếp hoạt động trên danh sách dự án.
10. Xuất và nhập dự án không chứa API key.
11. Xóa dự án và truyện đều có xác nhận rõ.
12. Logic tạo truyện hiện tại tiếp tục hoạt động ngoài luồng Dự án.
