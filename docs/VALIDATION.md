# Kiểm tra

`npm test`: luật SQL, phân quyền, snapshot, chấm điểm một lần, 60 người gửi bài, migration cũ; ba game EO, 60 người BUZZ đồng thời chỉ một người thắng, gợi ý/đáp án được che trước reveal, điểm cá nhân, từ chối bài giả, lưu tọa độ MC, khoảng cách WGS84 và cookie admin.

`npm run build`: build standalone, kiểm tra TypeScript và đóng gói migration/media tĩnh.

Kiểm tra chuông trắc nghiệm mặc định: không chọn đáp án trực tiếp, không có đồng hồ hết giờ, lấy thời gian từ database, khóa đúng người thắng đầu tiên, chặn mã mở chuông cũ. Trình duyệt kiểm tra SSE thật (không dựa vào polling), nhận lượt nhấn ngay ở pointer-down, chấm đúng và hiển thị điểm. Chế độ chọn trên điện thoại được kiểm tra riêng bằng câu đặt `interaction: submit`.

Kiểm tra nâng cấp database đã ghi nhận bản 012 sớm nhưng thiếu cột/hàm mã lượt chuông: migration 013 sửa phòng đang mở, giữ người chơi, nội dung và điểm; khởi tạo lại không đổi mã lượt hợp lệ. Health check từ chối báo sẵn sàng nếu schema chuông thiếu cột, hàm nhận mã lượt hoặc trường mã lượt trong trạng thái.

`npm run test:e2e`: trình duyệt Edge trên Windows hoặc Chromium trên Linux. Chạy server production riêng cổng 3201 với database/media thử riêng. Kiểm tra giao diện tham gia, mật mã admin, phòng có QR, nhiều browser độc lập, các kiểu chơi, chấm điểm và form soạn nội dung. Ảnh chụp nằm trong `artifacts/`, trace lỗi trong `test-results/`.

Có thêm server production cổng 3202 không đặt mật mã sẵn để kiểm tra setup lần đầu, giữ mật mã sau đăng xuất, tạo phòng chơi thử, quản lý câu hỏi theo game, lọc độ khó và phân trang 10/20/50 câu. Form tọa độ/biến động được kiểm tra với một ảnh và đáp án chữ, không cần tọa độ hay khoanh vùng. Có kiểm tra che đáp án/thông tin thêm trước công bố và ba gợi ý do MC mở.

Kiểm tra thêm bộ nháp, soạn trực tiếp vào bộ 10 câu, tạo và sửa riêng nội dung phòng trước khi bắt đầu. Luật SQL kiểm tra ngôi sao chỉ dùng một lần, ×2 đúng một lần, sai mất sao, chưa được chấm giữ sao. Luồng trình duyệt có chọn sao, tải lại giữ lựa chọn và bục top 3.

Sửa phòng chờ giữ nguyên nội dung câu chính/câu dự bị đã chốt dù câu trong kho đã sửa hoặc lưu trữ; câu mới thêm lấy từ kho. Kiểm tra rollback cả thứ tự và câu dự bị khi lưu thất bại.

Tên trùng được thử với hoa/thường, khoảng trắng, ký tự vô hình, Unicode tương đương và nhiều lượt đăng ký cùng tên đồng thời. Điểm chuẩn 200/300/400; những người bằng điểm giữ chung hạng bất kể số câu đúng/thời gian. Câu dự bị được kiểm tra qua hai lượt: chặn người ngoài nhóm, sai có thể mở lại BUZZ, đúng giành hạng, không cộng điểm/không dùng sao, rồi phân định top 3. Bộ/phiên lưu câu dự bị riêng, không lẫn vào thứ tự các câu chính.

Rà UI quản trị ở 360/768/1440 px: đường vào Bộ câu hỏi, các trang quản lý/soạn/tạo phiên, form ghép ảnh đủ trường, không tràn ngang hoặc cắt nhãn nút. Trang không tìm thấy câu/bộ không hiện form trống để lưu. Bộ có câu đã lưu trữ giữ nguyên số câu và cảnh báo, không âm thầm bỏ câu khi tạo phiên. Kiểm tra thêm lưu câu vào bộ trong một giao dịch, rollback khi bộ đầy/không tồn tại, chặn trùng câu chính/dự bị và đáp án trắc nghiệm trùng nhau.

Gợi ý được kiểm tra với ba ô mặc định, trộn chữ/ảnh, upload ảnh, sửa lại câu đã lưu, và ảnh chỉ xuất hiện sau khi MC mở đúng gợi ý. Có thêm kiểm tra HTTP 60 người đọc/BUZZ đồng thời trên server production cục bộ; kết quả và giới hạn ở [đánh giá Vercel](VERCEL.md). Đây chưa phải kiểm tra tải Vercel hay 60 thiết bị thật.

QR được kiểm tra bằng ảnh PNG giải mã trong trình duyệt; camera thật trên điện thoại chưa được kiểm tra vật lý. Mã người chơi được kiểm tra khi `randomUUID` không khả dụng. Bộ mẫu gồm 23 câu với ID duy nhất, đủ sáu game và ba mức khó; lựa chọn địa chỉ LAN tránh adapter VMware/WSL.

Giới hạn: chưa kiểm tra Cloudinary bằng tài khoản thật, chưa đo tải trên hosting hoặc mạng Wi-Fi của sự kiện. Nội dung EO thật và độ chính xác georeference cần được tác giả kiểm chứng trước workshop.
