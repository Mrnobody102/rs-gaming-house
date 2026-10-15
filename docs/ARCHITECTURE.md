# Kiến trúc

Một app Next.js, một instance Node, một database PGlite trên filesystem bền vững. Ngân hàng, bộ đề và phiên chơi là dữ liệu server dùng chung. Cloudinary là adapter ảnh tùy chọn; mặc định upload vào ổ đĩa. Chưa cần dịch vụ Supabase.

## Quyền truy cập

Admin dùng mật mã phía server và cookie HMAC có hạn 8 giờ, HttpOnly, SameSite strict. API đăng nhập giới hạn số lần sai; mật mã và secret không đưa vào bundle trình duyệt. Các lệnh quản trị, upload và chuyển bước đều kiểm tra cookie. Sử dụng HTTPS khi triển khai.

Nếu chưa cấu hình, web cho tạo mật mã ban đầu. Settings lưu hash scrypt và secret ký cookie; tạo file bằng chế độ exclusive để không có hai yêu cầu setup cùng lúc. Settings phải nằm trên ổ bền vững như database; `ADMIN_SETTINGS_DIR` cấu hình riêng. Mật mã cũ được giữ khi khởi động lại.

Người chơi tự nhập nickname khi tham gia, không có tài khoản. Browser sinh token ngẫu nhiên và giữ để nối lại; database chỉ lưu SHA-256 của token. Màn chiếu dùng view token riêng và không có quyền điều khiển. API chỉ cho gọi những SQL function trong whitelist, kiểm tra input bằng Zod.

## Game và tính điểm

`kind` quyết định renderer và cách trả lời, độc lập với tên phiên/bộ đề. Ba game EO dùng BUZZ và MC chấm lời giải trực tiếp; trắc nghiệm và puzzle dùng bài gửi cá nhân. BUZZ được khóa trên hàng phiên bằng `FOR UPDATE`, nên chỉ một người thắng kể cả khi bấm đồng thời. Sai có thể mở lượt mới cho những người chưa trả lời. Lệnh chấm kèm participant ID và round ID, tránh chấm nhầm lượt đã thay đổi.

Câu hỏi và câu dự bị được snapshot khi tạo phiên. Sửa hoặc lưu trữ trong kho không đổi nội dung đã chốt của phiên. Sửa tên, sức chứa hay thứ tự trong phòng chờ giữ các snapshot còn được chọn; câu mới thêm lấy từ kho đang hoạt động. Bộ câu hỏi lưu danh sách ID để dùng nội dung trong kho khi tạo phiên mới. Trước reveal, server loại đáp án, địa danh, tọa độ mục tiêu, vùng biến động và gợi ý chưa mở. Ảnh hiện tại của game tọa độ chỉ có sau reveal. Ảnh trước/sau game biến động luôn có để so sánh. Tính điểm trong transaction, chỉ một answer cho mỗi người/câu; retry không cộng thêm.

Client dùng polling 1,2 giây, chậm hơn khi tab ẩn, có abort, không chồng request và không nhận lại snapshot cũ hơn. Không cần Realtime service. Khi mất mạng, màn hiện tại giữ lại và không nhận thêm bài; khôi phục kết nối sẽ đọc trạng thái server. Token và phần ghép ảnh chưa gửi giữ trong browser; điểm không nằm trong localStorage.

## Tọa độ và ảnh

Ảnh WGS84 được ánh xạ tuyến tính theo extent do tác giả nhập, không tự đăng ký tọa độ ảnh. Điểm MC đặt được lưu ở round và đồng bộ với màn chiếu. Sai số dùng khoảng cách great-circle theo Haversine (bán kính Trái Đất trung bình 6.371.008,8 m). Dung sai do tác giả đặt; MC quyết định đúng/sai theo luật workshop, app không tự thưởng precision bonus.

Cặp ảnh biến động phải cùng extent, căn chỉnh từ trước. Slider không tự sửa sai lệch giữa hai ảnh. Vùng đáp án theo phần trăm ảnh, không theo pixel màn hình. Ảnh mẫu chỉ là minh họa thao tác, không giả làm ảnh EO thật.

## Migration và vận hành

Ứng dụng chạy các migration được liệt kê trong `src/server/local-database.ts`, ghi lịch sử trong `local_migrations`; không xóa dữ liệu khi nâng cấp. `002_storage_realtime` được giữ cho lịch sử hướng Supabase trước đây, không áp dụng trong runtime hiện tại. Không sửa migration đã áp dụng; các thay đổi tiếp theo thêm file mới.

Chỉ một process được mở thư mục PGlite. Sao lưu thư mục database và media khi app dừng; mount ổ bền vững khi chạy container. Có thể dùng Cloudinary cho ảnh, nhưng vẫn phải giữ database. Nếu dùng nhiều instance/serverless, thay adapter database bằng managed Postgres trước.
