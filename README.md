# EARTH//PLAY

Game viễn thám cho workshop: **Đoán địa danh**, **Truy tìm tọa độ quá khứ**, **Giải mã biến động**. Có thêm trắc nghiệm và ghép ảnh. Người chơi nhập mã phòng hoặc quét QR, nhập tên và thi đấu cá nhân. MC điều khiển trên laptop, có màn trình chiếu riêng.

## Chạy thử

Node.js 24 LTS:

```powershell
npm ci
npm run dev
```

Dev dùng `.next-dev`, build production dùng `.next`, để chạy kiểm tra build không làm hỏng tài nguyên của trang dev đang mở.

- Người chơi: http://localhost:3100/ — nhập mã phòng và tên.
- MC: http://localhost:3100/admin/ — mật mã bản thử `earthplay` nếu chưa đặt `ADMIN_PASSCODE`.
- Trang quản trị có nút **Tạo phòng**: chọn bộ đề hoặc từng câu, sắp thứ tự rồi **Tạo phòng**. Nút **Tạo phòng chơi thử** chuẩn bị một vòng trả lời trực tiếp qua BUZZ.
- Phòng chờ hiển thị mã, QR và tên người tham gia. MC bấm **Bắt đầu**; **Mở trình chiếu** mở tab chỉ hiển thị nội dung, không có nút điều khiển.

Điện thoại cần dùng cùng mạng Wi-Fi với laptop. QR tự chọn địa chỉ LAN; có thể sửa **Địa chỉ cho người chơi** ngay ở phòng chờ nếu máy có nhiều adapter mạng. Cho phép Node qua Windows Firewall nếu máy chặn kết nối LAN. `localhost` trên điện thoại trỏ về chính điện thoại.

Trang tham gia có **Quét QR**: mở camera trên HTTPS/localhost hoặc chọn ảnh QR để đọc. Trên LAN HTTP, có thể dùng camera mặc định của điện thoại để mở link QR, hoặc chọn ảnh trong trang. Mã QR được đọc trong trình duyệt, không gửi ảnh lên dịch vụ bên ngoài.

## Các kiểu chơi

| Game | Tương tác | Chấm điểm |
| --- | --- | --- |
| Đoán đáp án | Câu hỏi có thể không cần ảnh; MC mở lần lượt tối đa 3 gợi ý khi cần | Người chơi BUZZ, trả lời trực tiếp; MC chọn đúng/sai |
| Đoán địa danh | Quan sát ảnh, zoom/pan, MC mở gợi ý | Người chơi BUZZ, trả lời trực tiếp; MC chọn đúng/sai |
| Truy tìm tọa độ | Quan sát ảnh có chú thích do tác giả chuẩn bị, trả lời tọa độ bằng lời | BUZZ và MC xác nhận |
| Giải mã biến động | Quan sát một ảnh hoặc so sánh hai ảnh bằng thanh kéo | BUZZ và MC xác nhận |
| Trắc nghiệm | Mặc định bấm chuông, trả lời trực tiếp; tùy chọn chọn đáp án trên điện thoại | MC chấm khi dùng chuông; server tự chấm chế độ chọn |
| Ghép ảnh | Chọn hai mảnh để đổi chỗ, gửi kết quả | Server kiểm tra thứ tự mảnh khi MC công bố |

Sau đáp án: **Bảng điểm → Câu tiếp theo**. Điểm thuộc từng cá nhân, được lưu trong database; tải lại trang giữ tên, câu trả lời và điểm. BUZZ sai có thể mở lại cho người khác. Mỗi người chỉ được chấm một lần mỗi câu, retry không cộng điểm thêm.

Phiên mới dùng thang điểm **Dễ 200 · Vừa 300 · Khó 400**, sai 0. Tác giả có thể cho phép **ngôi sao hy vọng** ở từng câu trong bộ/phiên: mỗi người một sao mỗi phiên, chọn trước khi trả lời, đúng ×2 và sai 0. Chỉ khi gửi bài hoặc được MC chấm thì sao mới bị dùng; chưa giành được quyền nói thì vẫn giữ sao. Ngôi sao và trạng thái đã dùng được lưu trên server.

Bảng điểm có bục **top 3** và danh sách toàn bộ người chơi. Đồng điểm giữ chung hạng; không ưu tiên số câu đúng, thời gian các câu trước hay thứ tự vào phòng. Nếu nhóm đồng điểm ảnh hưởng một vị trí trong top 3, MC bấm **Chơi câu dự bị**: chỉ nhóm đó được BUZZ, người bấm trước và trả lời đúng giành hạng cao nhất còn trống của nhóm. Trả lời sai thì người khác tranh tiếp. Câu dự bị không cộng điểm, không dùng sao. Tiếp tục với câu khác nếu vẫn cần phân hạng; dừng khi top 3 đã rõ. Các hạng dưới top 3 có thể tiếp tục đồng hạng.

Trong bộ/phiên có mục **Câu dự bị** để chọn sẵn tối đa 10 câu dùng BUZZ, khác các câu chính. Nếu hết dự bị, MC có thể thêm câu chưa dùng từ kho ngay tại bảng điểm. Bục trao quà chỉ được xác nhận khi các vị trí top 3 đã phân định.

Tên được chuẩn hóa Unicode, gộp khoảng trắng, bỏ ký tự vô hình và kiểm tra trùng không phân biệt chữ hoa/thường trong cùng phòng; tham gia lại với cùng token giữ nguyên người chơi. Server còn chặn vượt sức chứa, câu hỏi trùng trong một phiên, dùng sao lần hai, gửi/chấm lặp và thao tác sai câu/sai giai đoạn.

Cách chơi chính là BUZZ để giành quyền nói trong phòng, MC chấm lời giải. Trắc nghiệm mặc định cũng dùng BUZZ. MC bấm **Bắt đầu → Mở BUZZ**; bấm sai thì MC mở lại cho người khác. Các lượt này không tự hết giờ. Ghép ảnh và trắc nghiệm được đặt rõ chế độ chọn trên điện thoại mới dùng đồng hồ và bài gửi. Kết quả chuông do server chốt nguyên tử; mỗi lần mở có mã lượt riêng để chặn yêu cầu cũ đến trễ. Thời gian ghi bằng đồng hồ server, không dùng thời gian do điện thoại tự khai.

Các ảnh mẫu là SVG minh họa, **không phải ảnh vệ tinh hay tư liệu lịch sử đã kiểm chứng**. Người biên soạn tự thay ảnh, câu hỏi, đáp án và gợi ý. Game *Lost Field Notes* vẫn là concept theo mô tả ban đầu.

## Soạn nội dung và lưu ảnh

`/admin` chỉ dùng mật mã, không cần email hay Supabase Auth. Bản production chưa cấu hình sẽ hiện **Tạo mật mã / Nhập lại mật mã** ngay trên web. Mật mã được băm scrypt và lưu ở thư mục settings cạnh database; lần sau chỉ cần đăng nhập. `ADMIN_PASSCODE` vẫn có thể dùng để cấu hình hoặc ghi đè mật mã khi vận hành. Bản dev chưa có mật mã riêng vẫn dùng `earthplay`.

Trang **Câu hỏi** chia theo sáu game, có tìm kiếm, lọc **Dễ / Vừa / Khó** và phân trang 10 / 20 / 50 câu. Bấm **Soạn câu hỏi** trong một game để thêm câu vào đúng game đó. Bản mới khởi tạo có 23 câu mẫu; nội dung thực tế do người tổ chức tự biên soạn.

Form chính gồm ảnh, câu hỏi, đáp án, gợi ý và **Giải thích / thông tin thêm**. Độ khó chọn ngay đầu form; điểm, thời gian của trắc nghiệm/ghép ảnh và nhãn nằm trong mục thu gọn. Game tọa độ có thể thêm ảnh đáp án; game biến động có thể thêm ảnh thứ hai. Bộ câu hỏi tham chiếu nội dung trong kho. Phòng đã tạo giữ bản nội dung riêng, không bị thay đổi khi sửa hoặc lưu trữ câu trong kho, kể cả khi MC đổi tên hay sắp xếp lại phòng trước khi chơi.

Gợi ý mặc định có **3 ô**, mỗi ô chọn **Chữ / Ảnh**. Ô trống không được lưu. Ảnh có thể tải lên hoặc dán URL HTTPS; MC mở từng gợi ý theo thứ tự. Bấm ảnh gợi ý trên màn chơi để mở ảnh đầy đủ.

**Bộ đề** có thể lưu nháp rỗng, chọn câu có sẵn hoặc **Soạn câu mới** ngay trong bộ, sắp thứ tự và đánh dấu các câu cho phép ngôi sao. Từ danh sách bộ đề bấm **Tạo phòng** để dùng lại nội dung đã chuẩn bị. Tại phòng chờ, MC có thể **Xem danh sách câu hỏi → Chỉnh sửa phiên** để đổi câu, thứ tự và ngôi sao riêng cho phòng đó. Bắt đầu chơi sẽ khóa chỉnh sửa nội dung; sửa một phòng không sửa bộ gốc. Các phòng đã tạo trước khi đổi thang điểm vẫn giữ điểm trong snapshot cũ.

Mặc định ảnh tải lên được lưu trong `.local/media`. Có thể dán URL HTTPS, hoặc dùng Cloudinary để ảnh tồn tại độc lập với hosting:

```dotenv
MEDIA_STORAGE=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Sao chép `.env.example` sang `.env.local` để cấu hình. Khóa Cloudinary chỉ được dùng trên server. Form **Chọn ảnh** hỗ trợ PNG/JPEG/WebP tối đa 8 MB. Không cần tài khoản Cloudinary để thử bằng ảnh cục bộ. [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference).

Tọa độ, đường lưới hay vùng đánh dấu có thể vẽ sẵn lên ảnh. Form không yêu cầu phạm vi địa lý, dung sai hay khoanh vùng. Câu hỏi cũ có dữ liệu tọa độ vẫn mở được. Nếu dùng hai ảnh với thanh so sánh, tác giả cần chuẩn bị ảnh cùng phạm vi và căn chỉnh.

## Source và triển khai

```text
src/app/                 Routes, layout, API handlers
src/features/admin/     Mật mã và khung quản trị
src/features/questions/ Danh sách theo game, form, bộ lọc, bộ đề
src/features/games/     Catalog game, factory và schema riêng theo game
src/content/starter/    Bộ câu mẫu chia theo game, có độ khó
src/features/sessions/  Tạo phòng, danh sách, điều khiển MC
src/features/play/      Join, đồng bộ, màn chơi, tương tác ảnh
src/server/             Auth, whitelist command, database, lưu ảnh
supabase/migrations/    SQL có lịch sử migration, giữ dữ liệu cũ
tests/                  Luật SQL, BUZZ, tọa độ, auth
e2e/                    Luồng MC và người chơi qua trình duyệt
```

```powershell
npm test
npm run build
npm run test:e2e
npm run start:demo # bản production cục bộ, cổng 3200
```

Triển khai lên **một Node.js server/container có ổ đĩa bền vững**, đặt mật mã riêng và dùng HTTPS. Build standalone và Dockerfile đã có sẵn. Mount thư mục dữ liệu; ví dụ `APP_DATA_DIR=/data/postgres`, `ADMIN_SETTINGS_DIR=/data/settings`, `MEDIA_DIR=/data/media`. Không dùng filesystem tạm của serverless cho database; Cloudinary chỉ lưu ảnh. Khi chuyển sang nhiều app instance hoặc serverless, cần thay adapter database sang Postgres được quản lý. Hiện tại chưa cần Supabase để thử hoặc tổ chức một phòng 30–60 người.

Để dùng **Vercel**, cần thay PGlite/file ảnh bằng database và storage dùng chung, cấu hình mật mã qua environment, đồng thời xử lý upload trực tiếp cho ảnh lớn. Xem [đánh giá tải 50–60 người và các thay đổi cần thiết](docs/VERCEL.md).

Deploy **Render**: đã có Blueprint `render.yaml`, Node 24, disk bền vững, health check và secret quản trị. Xem [hướng dẫn từng bước](docs/RENDER.md); Blueprint tạo tài nguyên trả phí.

Trạng thái chơi và điểm được ghi trên server; trình duyệt giữ token tham gia để nối lại. Chỉ thử tải đồng thời trên máy cục bộ, chưa phải benchmark hosting thật. Chi tiết ở [kiến trúc](docs/ARCHITECTURE.md) và [kiểm tra](docs/VALIDATION.md).
