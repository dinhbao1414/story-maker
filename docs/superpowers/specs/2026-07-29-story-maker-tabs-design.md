# Thiết kế giao diện tab Dashboard / Cài đặt

**Ngày:** 2026-07-29  
**Trạng thái:** Đã được người dùng chốt  
**Ứng dụng:** Story Maker hiện tại

## 1. Mục tiêu

- Làm giao diện gọn hơn bằng thanh tab dọc bên trái.
- Mở ứng dụng vào tab **Dashboard** trước.
- Tách phần vận hành truyện khỏi phần cấu hình truyện.
- Giữ nguyên toàn bộ logic hiện có: API, model, tạo truyện, phân tích TXT, hồ sơ phong cách, tinh chỉnh, xuất file và lưu phiên.

## 2. Nguyên tắc bắt buộc

- Không đổi ID của phần tử đang được JavaScript sử dụng.
- Không đổi tên sự kiện, hàm xử lý, schema dữ liệu, storage key hoặc API request.
- Không sao chép control thành hai bản; mỗi control hiện có chỉ xuất hiện tại một vị trí.
- Không viết lại `legacyMain.js` hoặc refactor logic.
- Chỉ thêm trạng thái trình bày để chuyển tab, đặt class và cập nhật thuộc tính ARIA.
- Nếu một thành phần không thể di chuyển mà không ảnh hưởng logic, giữ nguyên DOM và chỉ thay đổi bố cục bằng CSS.

## 3. Bố cục đã chọn

### 3.1 Thanh tab bên trái

Thứ tự từ trên xuống:

1. **Dashboard** — tab mặc định khi mở trang.
2. **Cài đặt** — chứa toàn bộ thông số tạo truyện.

Không thêm tab mới trong đợt này.

Kích thước đề xuất:

- Desktop: thanh dọc rộng 68–76 px.
- Nút tab tối thiểu 48 px chiều cao, có biểu tượng và nhãn.
- Trạng thái đang chọn dùng nền tím nhạt, viền hoặc thanh chỉ báo; không chỉ dùng màu chữ.
- Tablet/mobile: chuyển thành hai tab ngang cố định để không chiếm chiều rộng.

## 4. Tab Dashboard

Dashboard là không gian vận hành chính, gồm các khối hiện có theo thứ tự:

### 4.1 Trạng thái API và model

- Giữ khu vực nhập/lưu API và đổi model ở phần trên cùng.
- Hiển thị trạng thái sẵn sàng rõ ràng.
- Không hiển thị lại khóa API trong nội dung Dashboard.

### 4.2 Hành động chính

- Đưa nút **Tạo truyện** thành CTA nổi bật của Dashboard.
- Giữ nguyên ID, trạng thái disabled, spinner và handler hiện tại.
- Các nút `Ngẫu nhiên tất cả`, nhập/xuất điều kiện nằm trong tab Cài đặt vì chúng thay đổi cấu hình.

### 4.3 Tiến độ AI

- Giữ nguyên cửa sổ tiến độ và nhật ký AI.
- Thu gọn khi đang chờ; tự thể hiện rõ khi đang tạo hoặc phân tích.
- Không thay đổi dữ liệu log hoặc cơ chế cập nhật.

### 4.4 Output

- Output là khối lớn nhất của Dashboard.
- Giữ nguyên các nút: Dán, Nhập TXT, Xóa, Sao chép, tải file và bộ đếm ký tự.
- Không thay đổi cơ chế nhập văn bản, render trực tiếp hoặc xử lý output.

### 4.5 Công cụ sau khi có nội dung

Nhóm dưới Output, dùng card/accordion để giảm chiều dài:

1. Phân tích TXT và tự điền thiết lập.
2. Hồ sơ phong cách đã lưu và bản xem trước trước khi áp dụng.
3. Tinh chỉnh truyện bằng AI.
4. Xem trước Kakuyomu.
5. Xem trước Alphapolis.

Các công cụ vẫn dùng DOM, ID, button và handler hiện tại. Chỉ thay đổi vị trí và cách thu gọn.

### 4.6 Hành động cuối

- Giữ các hành động hiện có như tạo lại, tinh chỉnh, sao chép và tải xuống tại vùng gần Output.
- Không thêm workflow xuất bản mới.

## 5. Tab Cài đặt

Chứa toàn bộ control hiện có của cột trái:

1. Chế độ đầu ra.
2. Chủ đề / ý tưởng.
3. Nhân vật.
4. Thể loại.
5. Bối cảnh.
6. Đối tượng độc giả.
7. Thời đại.
8. Kiểu kết thúc.
9. Ngôi kể.
10. Tài nguyên đầu vào đa năng.
11. Thông tin bổ sung.

Thanh hành động cố định của tab Cài đặt gồm:

- Ngẫu nhiên tất cả.
- Đặt lại tất cả.
- Xuất điều kiện.
- Nhập điều kiện.
- Nút quay lại Dashboard.

Không đặt Output hoặc công cụ tinh chỉnh trong tab này.

## 6. Hành vi chuyển tab

- Dashboard được chọn sau lần tải trang đầu tiên.
- Bấm tab chỉ đổi class hiển thị; không tạo lại DOM và không reset dữ liệu.
- Chuyển tab trong lúc AI đang chạy không được hủy request.
- Các phần tử đang disabled vẫn giữ trạng thái disabled.
- Khi một tác vụ cần người dùng kiểm tra thiết lập, có thể chuyển sang tab Cài đặt bằng nút điều hướng UI; không tự áp dụng thay đổi.
- Khi bấm **Tạo truyện**, giao diện chuyển về Dashboard để theo dõi tiến độ và Output, nhưng không thay đổi luồng tạo truyện.

## 7. Phong cách giao diện

- Giữ dark theme tím hiện tại.
- Dùng khoảng cách theo nhịp 8 px.
- Giảm viền và card lồng nhau; ưu tiên phân cấp bằng nền và khoảng trắng.
- CTA chính dùng tím; trạng thái thành công dùng xanh; cảnh báo dùng vàng; lỗi dùng đỏ.
- Không dùng hiệu ứng chuyển động dài; chuyển tab 150–200 ms và hỗ trợ `prefers-reduced-motion`.

## 8. Khả năng truy cập

- Tab dùng button thật, có `aria-selected`, `aria-controls` và trạng thái focus rõ.
- Thứ tự bàn phím: Dashboard, Cài đặt, sau đó nội dung tab đang mở.
- Vùng tab ẩn không nhận focus.
- Nút chạm tối thiểu 44 × 44 px.
- Trạng thái tab không được truyền đạt chỉ bằng màu sắc.

## 9. Responsive

- Desktop: rail bên trái + vùng nội dung rộng.
- Tablet: rail thu gọn, panel Cài đặt rộng tối đa khoảng 420 px.
- Mobile: hai tab ngang; mỗi tab chiếm 50% chiều rộng; Output hiển thị trước.
- Không xuất hiện thanh cuộn ngang.

## 10. Ngoài phạm vi

- Không thêm lịch sử truyện, thống kê, biểu đồ hoặc quản lý dự án.
- Không thay đổi endpoint, model, API key hoặc cách lưu khóa.
- Không thay đổi prompt, phân tích phong cách hoặc sinh truyện.
- Không build, deploy, tăng phiên bản hoặc tạo release trong giai đoạn thiết kế.

## 11. Tiêu chí nghiệm thu

- Trang mở vào Dashboard.
- Tab Dashboard và Cài đặt chuyển qua lại mà không mất dữ liệu.
- Mọi ID và handler hiện có vẫn hoạt động.
- Tạo truyện, nhập TXT, phân tích phong cách, lưu hồ sơ, F5, áp dụng thiết lập, tinh chỉnh, Kakuyomu và Alphapolis không bị thay đổi hành vi.
- Desktop, tablet và mobile không bị tràn ngang.
- Toàn bộ test hiện có vẫn đạt.
