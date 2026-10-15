# Đưa EARTH//PLAY lên Render

Repo có `render.yaml` để tạo **một Web Service Node + một persistent disk**. Cấu hình này dùng dịch vụ trả phí, region Singapore và gói `1c-2g` (1 CPU / 2 GB RAM). Đây là cấu hình khởi điểm để thử, chưa phải kết quả đo tải trên Render. Kiểm tra chi phí Render hiển thị trước khi tạo.

## Tạo bằng Blueprint

1. Đẩy source và các thay đổi mới nhất lên GitHub. Không đẩy `.env.local`, `.local`, database hay ảnh tải lên vào Git.
2. Render → **New → Blueprint** → kết nối repo → chọn branch chứa code mới nhất. Blueprint path là `render.yaml`. Nếu đưa cả workspace vào một repo thì path là `rs-gaming-house/render.yaml`, và thêm `rootDir: rs-gaming-house` vào service trong YAML. Repo Git hiện tại có root ngay tại thư mục app nên không cần `rootDir`.
3. Render đọc cấu hình, hiển thị Web Service và disk 1 GB. Nhập **ADMIN_PASSCODE** riêng (nên từ 8 ký tự). `ADMIN_SESSION_SECRET` được sinh tự động; không đổi tùy tiện vì sẽ đăng xuất các phiên quản trị.
4. Xác nhận các tài nguyên và chi phí rồi tạo. Build chạy `npm ci && npm run build`; start chạy `node .next/standalone/server.js`. Không dùng lệnh dev hoặc `start:demo`.
5. Đợi deploy thành **Live**. Mở URL `https://<tên>.onrender.com` trên cả laptop MC và điện thoại dùng Wi-Fi công ty. Truy cập được dashboard Render chưa chứng minh mạng cho phép domain của app.
6. Trong service → **Environment**, thêm `JOIN_BASE_URL=https://<tên>.onrender.com` (thay bằng URL thật), lưu và redeploy. QR sau đó dùng đúng domain công khai.
7. Mở `<domain>/admin/`, đăng nhập bằng mật mã đã đặt. Soạn bộ → tạo phòng → mở trình chiếu. Người chơi mở domain hoặc quét QR → nhập tên.

Blueprint đã tắt tự deploy. Sau này đẩy code lên GitHub rồi dùng **Manual Deploy → Deploy latest commit** khi không có lượt chơi đang diễn ra. Một app có disk sẽ bị gián đoạn ngắn khi restart/deploy.

## Nếu tạo Web Service thủ công

Chọn **New → Web Service → repo GitHub**, cấu hình:

| Mục | Giá trị |
| --- | --- |
| Language / Runtime | **Node** (chọn rõ Node nếu Render tự nhận Docker) |
| Region | Singapore |
| Root Directory | Để trống nếu repo là app; `rs-gaming-house` nếu repo là cả workspace |
| Build Command | `npm ci && npm run build` |
| Start Command | `node .next/standalone/server.js` |
| Health Check Path | `/api/health/` |
| Số instance | 1 |
| Compute | Gói trả phí; cấu hình Blueprint là 1 CPU / 2 GB |
| Auto deploy | Tắt trong thời gian tổ chức |

**Trước khi chơi**, gắn disk 1 GB tại `/var/data`. Disk chỉ có trên gói hỗ trợ persistent disk. Thêm Environment:

```dotenv
NODE_ENV=production
NODE_VERSION=24
HOSTNAME=0.0.0.0
LOCAL_PREVIEW=0
APP_DATA_DIR=/var/data/postgres
ADMIN_SETTINGS_DIR=/var/data/settings
MEDIA_DIR=/var/data/media
MEDIA_STORAGE=local
ADMIN_PASSCODE=<mat-ma-rieng>
ADMIN_SESSION_SECRET=<chuoi-ngau-nhien-dai>
JOIN_BASE_URL=https://<ten-app>.onrender.com
```

Sinh secret nếu cần: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Không dùng nguyên dấu `<...>`. Render tự cấp `PORT`; không cần đặt. App dùng Node 24 theo `.node-version`. Không cần đặt biến `RAILWAY_RUN_UID`.

## Chuông và thời gian

Trắc nghiệm mới mặc định **bấm chuông, trả lời trực tiếp**. A/B/C/D vẫn hiện để đọc, không bấm chọn. Chế độ chọn trên điện thoại nằm trong tùy chọn soạn câu → **Cách trả lời**. Ghép ảnh vẫn cho gửi kết quả trên máy. Phòng trắc nghiệm đang chơi trước khi cập nhật giữ cách trả lời cũ; tạo phòng mới để dùng luật mới.

MC **Bắt đầu → Mở BUZZ**. Khi có người thắng, chuông tự khóa. MC chọn **Đúng** để cộng điểm và công bố; **Sai → Mở BUZZ** cho người khác. Mỗi lần mở có mã lượt riêng: lượt bấm cũ bị trễ không thể thắng lượt mới. Bấm chuông được gửi ngay khi nhấn xuống, không chờ thả tay.

Người thắng là yêu cầu hợp lệ đầu tiên được server chấp nhận trong transaction khóa phòng. Database ghi thời gian từ lúc MC mở chuông đến lúc server ghi nhận người thắng; điện thoại không gửi thời gian tự khai. Giá trị hiển thị tới mili giây, nhưng không thể dùng mạng Internet để khẳng định ai chạm màn hình sớm hơn tuyệt đối giữa hai máy có độ trễ khác nhau. Không dùng thời gian điện thoại để cộng điểm hay phân hạng.

Server đẩy thông báo mở/đóng/thắng qua SSE; trình duyệt vẫn có polling dự phòng khi kênh trực tiếp mất kết nối. Render cần chạy **một instance** để bus thông báo và PGlite dùng cùng process. Không scale ngang bản này.

## Chạy thử trước sự kiện

- Từ mạng công ty, vào đúng domain app trên laptop và vài điện thoại; kiểm tra ảnh, QR, đăng nhập, mở chuông, sai/mở lại và chấm điểm.
- Thử 50–60 thiết bị hoặc tải mô phỏng lên deployment thật; xem CPU, RAM, lỗi và độ trễ trong Render. Kết quả kiểm tra local không thay thế thử nghiệm này.
- Khởi động lại service và xác nhận câu hỏi/ảnh/phòng vẫn còn. Tăng dung lượng disk nếu ảnh gần đầy.
- Nội dung đã soạn trên laptop không tự đi theo Git. Muốn giữ cần sao lưu rồi chuyển database/media vào disk với app đã dừng; không sao chép database đang được ghi.

Tài liệu Render: [Blueprint](https://render.com/docs/blueprint-spec), [disk](https://render.com/docs/disks), [Node](https://render.com/docs/node-version), [monorepo](https://render.com/docs/monorepo-support), [health check](https://render.com/docs/health-checks).
