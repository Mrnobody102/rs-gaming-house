# Kiểm tra

## Adapter PostgreSQL ngoài ngày 16/10/2026

- `DATABASE_URL` chọn pool PostgreSQL 8 kết nối; health và command dùng cùng adapter, không import PGlite ở nhánh này. Không có URL vẫn chạy PGlite như trước.
- TypeScript và build standalone pass; 45 test cũ pass khi chạy tuần tự.
- Kiểm tra trên PostgreSQL 16 thật với tài khoản không phải superuser nhưng có CREATEROLE: migrations/seed, 60 transaction BUZZ đồng thời cùng một người thắng, chỉ MC được chấm, chấm lặp không cộng thêm, rollback và claims không rò sang request khác đều pass (`tests/postgres.test.ts`, cần `TEST_DATABASE_URL` riêng để chạy).
- Hai test E2E qua bản standalone + PostgreSQL thật pass: SSE/pointer-down/hiển thị người thắng trên Host, và 60 người đọc/BUZZ qua HTTP. Toàn đợt đọc 652 ms, toàn đợt BUZZ 1410 ms trên máy kiểm tra; không phải độ trễ render hoặc phép đo Render.
- Lần E2E đầu không kết nối được database do WSL tắt khi không có terminal giữ hoạt động; đã xác nhận ECONNREFUSED và chạy lại sau khi giữ WSL hoạt động. Không thay test để bỏ qua lỗi.
- Chưa có kết quả đo RAM, 60 SSE, idle 20 phút hoặc tải trên Render thật. Hướng dẫn deployment: [RENDER-POSTGRES-FREE.md](RENDER-POSTGRES-FREE.md).

## Rà soát workshop Render ngày 16/10/2026

- Production build standalone thành công với Node 24.22.0, gồm TypeScript và đóng gói assets/migrations.
- `vitest run --maxWorkers=1`: 8 file, 45/45 test pass. Lần chạy mặc định nhiều worker gặp lỗi hết bộ nhớ trên máy kiểm tra; kết quả pass này là chạy tuần tự.
- Chạy test HTTP `60 concurrent players` với `--repeat-each=20` trên production local: **19 pass, 1 fail**. Lượt đầu timeout 10 giây ở `bank_save` khi chuẩn bị phòng trên database mới, trước đợt BUZZ; 19 lượt sau mỗi lượt 60 người đều cùng nhận một người thắng và chỉ một người có điểm, không có request lỗi trong các lượt pass.
- 19 đợt BUZZ hoàn tất toàn bộ 60 phản hồi trong khoảng **1.211–1.826 ms** (tức **1,211–1,826 giây**). Đây là thời gian hoàn tất cả đợt, không phải độ trễ hiện tên trên Host/Presentation, không phải p95 và không so trực tiếp được với các lần đo trên máy khác.
- **Chưa đạt bằng chứng 20/20 lượt liên tiếp**, chưa mở 60 kênh SSE cùng tải nền, chưa đo thời gian hiển thị dưới 1 giây và chưa thử idle 20 phút trên Render. Không dùng kết quả này để tick các mục tương ứng của checklist deployment.

Hướng dẫn: [Render Free](RENDER-FREE.md), [so sánh hosting cho workshop](HOSTING-WORKSHOP.md).

## Các kiểm tra trong repo

`npm test`: luật SQL, phân quyền, snapshot, chấm điểm một lần, 60 người gửi bài, migration cũ; ba game EO, 60 người BUZZ đồng thời chỉ một người thắng, gợi ý/đáp án được che trước reveal, điểm cá nhân, từ chối bài giả, lưu tọa độ MC, khoảng cách WGS84 và cookie admin.

`npm run build`: build standalone, kiểm tra TypeScript và đóng gói migration/media tĩnh.

Kiểm tra chuông trắc nghiệm mặc định: không chọn đáp án trực tiếp, không có đồng hồ hết giờ, lấy thời gian từ database, khóa đúng người thắng đầu tiên, chặn mã mở chuông cũ. Trình duyệt kiểm tra SSE thật (không dựa vào polling), nhận lượt nhấn ngay ở pointer-down, chấm đúng và hiển thị điểm. Chế độ chọn trên điện thoại được kiểm tra riêng bằng câu đặt `interaction: submit`.

Luồng chấm sai kiểm tra thông báo 0 điểm ngay, mất sao đã dùng, mở lượt mới cho người còn lại và chặn người đã trả lời. Câu 300 điểm mở một gợi ý −50, dùng sao và trả lời đúng được đúng 500 điểm; chấm/gửi lặp không cộng thêm. Server chặn công bố khi chưa chấm người thắng chuông và chặn kết thúc khi chưa tính điểm. Khi tất cả đều sai, không mở lại chuông rỗng; câu dự bị vẫn phân hạng mà không cộng điểm.

Luồng tham gia kiểm tra mất phản hồi sau khi server đã nhận đăng ký: bấm lại giữ cùng người, không lỗi trùng tên. Khi localStorage bị chặn, sessionStorage giữ token để vào phòng và tải lại màn chơi. Nếu cả hai loại storage đều bị chặn, token chỉ giữ được trong tab hiện tại, qua điều hướng nội bộ.

Kiểm tra nâng cấp database đã ghi nhận bản 012 sớm nhưng thiếu cột/hàm mã lượt chuông: migration 013 sửa phòng đang mở, giữ người chơi, nội dung và điểm; khởi tạo lại không đổi mã lượt hợp lệ. Health check từ chối báo sẵn sàng nếu schema chuông thiếu cột, hàm nhận mã lượt hoặc trường mã lượt trong trạng thái.

Màn trình chiếu được kiểm tra ở 1280/1920 px: ảnh lớn hơn giới hạn cũ theo kích thước viewport và không che thanh điều khiển; MC có thể bắt đầu, mở chuông, công bố, xem bảng điểm, chuyển câu và kết thúc từ trình chiếu. Có kiểm tra ẩn/hiện điều khiển, toàn màn hình riêng game, link xem không có quyền chuyển câu và nút BUZZ vẫn nhìn thấy trên điện thoại.

`npm run test:e2e`: trình duyệt Edge trên Windows hoặc Chromium trên Linux. Chạy server production riêng cổng 3201 với database/media thử riêng. Kiểm tra giao diện tham gia, mật mã admin, phòng có QR, nhiều browser độc lập, các kiểu chơi, chấm điểm và form soạn nội dung. Ảnh chụp nằm trong `artifacts/`, trace lỗi trong `test-results/`.

CI dùng Ubuntu 24.04 và Node 24. Test tranh chuông dùng mouse-down vì đó là thời điểm gửi BUZZ; một thao tác click đầy đủ có thể bị thay nút giữa nhấn và nhả khi người khác thắng. Khi CI lỗi, tải artifact `browser-results` trong GitHub Actions để xem HTML report, ảnh và trace. Không tự retry test để che lỗi.

Có thêm server production cổng 3202 không đặt mật mã sẵn để kiểm tra setup lần đầu, giữ mật mã sau đăng xuất, tạo phòng chơi thử, quản lý câu hỏi theo game, lọc độ khó và phân trang 10/20/50 câu. Form tọa độ/biến động được kiểm tra với một ảnh và đáp án chữ, không cần tọa độ hay khoanh vùng. Có kiểm tra che đáp án/thông tin thêm trước công bố và ba gợi ý do MC mở.

Kiểm tra thêm bộ nháp, soạn trực tiếp vào bộ 10 câu, tạo và sửa riêng nội dung phòng trước khi bắt đầu. Luật SQL kiểm tra ngôi sao chỉ dùng một lần, ×2 đúng một lần, sai mất sao, chưa được chấm giữ sao. Luồng trình duyệt có chọn sao, tải lại giữ lựa chọn và bục top 3.

Sửa phòng chờ giữ nguyên nội dung câu chính/câu dự bị đã chốt dù câu trong kho đã sửa hoặc lưu trữ; câu mới thêm lấy từ kho. Kiểm tra rollback cả thứ tự và câu dự bị khi lưu thất bại.

Tên trùng được thử với hoa/thường, khoảng trắng, ký tự vô hình, Unicode tương đương và nhiều lượt đăng ký cùng tên đồng thời. Điểm chuẩn 200/300/400; những người bằng điểm giữ chung hạng bất kể số câu đúng/thời gian. Câu dự bị được kiểm tra qua hai lượt: chặn người ngoài nhóm, sai có thể mở lại BUZZ, đúng giành hạng, không cộng điểm/không dùng sao, rồi phân định top 3. Bộ/phiên lưu câu dự bị riêng, không lẫn vào thứ tự các câu chính.

Rà UI quản trị ở 360/768/1440 px: đường vào Bộ câu hỏi, các trang quản lý/soạn/tạo phiên, form ghép ảnh đủ trường, không tràn ngang hoặc cắt nhãn nút. Trang không tìm thấy câu/bộ không hiện form trống để lưu. Bộ có câu đã lưu trữ giữ nguyên số câu và cảnh báo, không âm thầm bỏ câu khi tạo phiên. Kiểm tra thêm lưu câu vào bộ trong một giao dịch, rollback khi bộ đầy/không tồn tại, chặn trùng câu chính/dự bị và đáp án trắc nghiệm trùng nhau.

Gợi ý được kiểm tra với ba ô mặc định, trộn chữ/ảnh, upload ảnh, sửa lại câu đã lưu, và ảnh chỉ xuất hiện sau khi MC mở đúng gợi ý. Có thêm kiểm tra HTTP 60 người đọc/BUZZ đồng thời trên server production cục bộ; kết quả và giới hạn ở [đánh giá Vercel](VERCEL.md). Đây chưa phải kiểm tra tải Vercel hay 60 thiết bị thật.

QR được kiểm tra bằng ảnh PNG giải mã trong trình duyệt; camera thật trên điện thoại chưa được kiểm tra vật lý. Mã người chơi được kiểm tra khi `randomUUID` không khả dụng. Bộ mẫu gồm 23 câu với ID duy nhất, đủ sáu game và ba mức khó; lựa chọn địa chỉ LAN tránh adapter VMware/WSL.

Giới hạn: chưa kiểm tra Cloudinary bằng tài khoản thật, chưa đo tải trên hosting hoặc mạng Wi-Fi của sự kiện. Nội dung EO thật và độ chính xác georeference cần được tác giả kiểm chứng trước workshop.
