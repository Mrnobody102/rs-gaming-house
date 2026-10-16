# Kiểm tra phòng chơi ngày 16/10/2026

Chưa đủ bằng chứng để dùng BUZZ cho 50 người một cách ổn định trên bản Render hiện tại. Kiểm tra cục bộ thành công; kiểm tra Render qua đường mạng công ty gặp timeout. Chưa xác định được phần chậm đến từ hosting, proxy hay đường mạng.

## Kết quả đã đo

| Môi trường                                                                   | Kết quả                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production cục bộ, PostgreSQL 17 tạm, 60 người + 60 SSE + một trình duyệt MC | 20/20 lượt tranh chuông thành công. Mỗi lượt chỉ có một người thắng; chấm lặp không cộng thêm điểm. p95 thời gian hiện người thắng trên MC: 556 ms, lớn nhất 652 ms.                    |
| Render Singapore, 50 người + một trình duyệt MC, polling dự phòng            | Cả 50 người vào được phòng, nhưng không mở được SSE từ mạng kiểm tra. Có 14 request lỗi; p95 lấy trạng thái 7.416 ms, p95 BUZZ 10.305 ms. Không hoàn thành được lượt kiểm tra đầu tiên. |
| Render, xóa rồi tạo phòng mới, dùng lại cùng 50 mã người chơi và tên         | Cả hai phòng đều nhận đủ 50 người; phòng cũ trả 404 sau khi xóa. Không có khóa thiết bị xuyên phòng.                                                                                    |

Trong bảng, dấu chấm phân cách hàng nghìn; 7.416 ms tương đương khoảng 7,4 giây. Thống kê request gồm cả các lần lỗi và timeout, không chỉ các lần thành công. Thời gian hiện người thắng tính từ lúc bắt đầu gửi cả đợt BUZZ đến khi trình duyệt MC nhận và vẽ tên, không phải thời gian phản xạ của người chơi.

Dữ liệu đo: [cục bộ 60 người](load-results/2026-10-16-local-60.json), [Render 50 người](load-results/2026-10-16-render-50.json), [tạo lại phòng trên Render](load-results/2026-10-16-room-reuse.json).

Các mã người chơi được mô phỏng độc lập trên một máy, không phải 50 điện thoại trên Wi-Fi sự kiện. Lượt cục bộ dùng SSE và timer polling 6 giây; lượt Render dùng polling dự phòng 1,2 giây sau khi request trước kết thúc, giống ứng dụng. Cục bộ có thử heartbeat sau 16 giây, chưa kiểm tra idle 20 phút. Kết quả cục bộ không chứng minh được khả năng chịu tải của gói Render Free.

## Xóa phòng

- Database xóa người chơi, câu hỏi chụp riêng của phòng, câu trả lời, sao và phân hạng của phòng theo cascade. Kho câu hỏi và bộ gốc vẫn giữ.
- Bản sửa này đóng các stream của phòng ngay trên server. Kiểm tra cục bộ xác nhận cả 60 stream đóng mà không cần người chơi chủ động ngắt.
- Màn chơi nhận thông báo xóa hoặc lỗi không tìm thấy phòng sẽ dừng đồng bộ và xóa mã đăng nhập của phòng trong bộ nhớ/localStorage/sessionStorage. Tên đã nhập và mã của phòng khác được giữ lại. Máy đang offline chỉ dọn mã sau khi kết nối lại và phát hiện phòng đã xóa.
- Mã còn lưu trong trình duyệt không chiếm kết nối database hay chỗ trong phòng mới. Mỗi người chơi thuộc một phòng; không có giới hạn một thiết bị trên toàn hệ thống.

## Dự phòng cho workshop

1. Vào **Bộ câu hỏi → Trình chiếu**, hoặc từ màn MC của phòng bấm **Chỉ trình chiếu**. Khi chuyển từ phòng đang chơi, màn này lấy câu hiện tại và số gợi ý đã mở.
2. MC dùng **Câu trước / Câu tiếp theo**, **Mở gợi ý**, **Xem đáp án** và **Toàn màn hình**. Người chơi giơ tay, MC ghi điểm bên ngoài. Chế độ này không chấm điểm hay cập nhật bảng xếp hạng của phòng.
3. Trước sự kiện, chờ nút **Tải bản dự phòng** bật rồi tải file HTML. File chứa ảnh, câu hỏi, gợi ý và đáp án; mở trực tiếp trên laptop khi không có mạng. Đã kiểm tra file với trình duyệt ở chế độ offline.

Nếu chuyển sang giơ tay giữa buổi, cho người chơi đóng màn điện thoại để ngừng các request của phòng cũ. Tab trình chiếu đã tải đủ ảnh vẫn chuyển câu khi mất mạng; mở một tab trình chiếu mới cần server, còn file HTML đã tải thì không.

Đã kiểm tra thêm trên Render thật: tải bộ workshop hiện tại (11 câu do quản trị chỉnh), xuất HTML, mở bằng một trình duyệt offline khác rồi chuyển tới câu cuối và xem đáp án. Ảnh được nhúng trong file và hiển thị khi offline. Kiểm tra cuối xác nhận không còn phòng `LOAD CHECK` trên Render.

## Kiểm tra lại

Lượt đo tiếp theo trên Render đã hoàn thành 20 lượt chuông, tổng cộng 960 yêu cầu BUZZ: tất cả phản hồi thống nhất một người thắng mỗi lượt, chấm lặp không cộng thêm điểm. Tuy nhiên vẫn có 5 request lấy trạng thái bị timeout kết nối; màn MC hiện người thắng trong 1,704–8,738 giây (p95 8,143 giây), nên chưa đạt mục tiêu 2 giây. SSE vẫn không mở được từ mạng kiểm tra, cả Node lẫn một trình duyệt Edge riêng. Các phòng thử đã được xóa. [Dữ liệu lần đo lại](load-results/2026-10-16-render-50-recheck.json).

Đã kiểm tra thêm trên trình duyệt cục bộ: cố tình giữ phản hồi BUZZ 2 giây rồi làm mất phản hồi sau khi server ghi nhận. Người chơi khác bấm sau và người thắng gửi lại vẫn nhận cùng kết quả; chấm lặp không cộng trùng, tải lại giữ đúng điểm. Không thay logic phân xử chuông của app trong lần kiểm tra này. [Cách chạy trên LAN](PLAY-ON-LAN.md).

`scripts/check-room-load.mjs` tạo phòng riêng có tiền tố `LOAD CHECK`, chỉ đọc kho câu hỏi, rồi xóa các phòng do nó tạo trong khối `finally`. Không chạy lên phòng đang tổ chức. Cần bốn câu BUZZ có sẵn và trình duyệt Playwright/Edge đã cài.

Đặt mật mã của server thử vào biến môi trường `LOAD_ADMIN_PASSCODE`, rồi chạy:

```powershell
node --use-system-ca scripts/check-room-load.mjs --url https://rs-gaming-house.onrender.com --players 50 --allow-polling --output artifacts/render-50.json
```

Bỏ `--allow-polling` nếu cần kiểm tra bắt buộc SSE. Script vẫn ghi rõ số kết nối SSE và lỗi, kể cả khi cho phép polling. Báo cáo không chứa mật mã, cookie hoặc token người chơi. Chạy trên hosting thật tạo tải thực, nên dùng lúc không có người đang chơi.

Script hiện kiểm tra cả ngưỡng trễ mặc định 2.000 ms: thời gian hiện tên trên MC và p95 nhận lượt mở của từng đợt. Có thể đổi bằng `--max-mc-ms`; kết quả đúng nhưng chậm vẫn trả mã lỗi, không báo đạt chỉ vì không có hai người thắng.

Build production, 47 unit/integration test và 18 kịch bản trình duyệt đã qua sau bản sửa dọn phòng; một test PostgreSQL tùy chọn không chạy trong lệnh unit mặc định. Bài đo 60 người ở trên chạy riêng với PostgreSQL thật.
