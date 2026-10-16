# Render Web Free + PostgreSQL Free

Đặt `DATABASE_URL` để web dùng PostgreSQL bên ngoài và không nạp PGlite. Giữ một instance Node cho SSE. Không cần chuyển sang WebSocket hay tự chạy SQL trong Dashboard: app tự chạy migrations và seed bộ workshop khi kết nối database lần đầu.

## 1. Tạo database

Render → **New → Postgres**:

- Name: `pixel-hunt-db`.
- Database / User: để Render tự sinh.
- Region: **Singapore**, cùng region web service.
- Version: **17** (hoặc 18).
- Instance: **Free**. Kiểm tra phần tổng tiền vẫn $0 trước khi tạo.

Đợi **Available**. Vào **Connect / Info**, copy **Internal Database URL**. Đây là secret; dán trực tiếp vào Environment của web, không commit vào Git và không gửi vào chat.

## 2. Cập nhật web service

Push code mới có adapter PostgreSQL lên branch deploy trước. Trong web service hiện tại:

| Mục | Giá trị |
| --- | --- |
| Language | Node |
| Instance | Free |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `node .next/standalone/server.js` |
| Health Check Path | `/api/health/` |
| Auto Deploy | Off |

Thêm hoặc giữ Environment:

```dotenv
DATABASE_URL=<Internal Database URL vừa copy>
NODE_VERSION=24
NODE_ENV=production
HOSTNAME=0.0.0.0
LOCAL_PREVIEW=0
ADMIN_PASSCODE=<mật mã MC riêng>
ADMIN_SETTINGS_DIR=/tmp/pixel-hunt/settings
MEDIA_STORAGE=local
MEDIA_DIR=/tmp/pixel-hunt/media
JOIN_BASE_URL=https://<domain-web-thật>.onrender.com
```

Giữ `ADMIN_SESSION_SECRET` nếu đã đặt. `APP_DATA_DIR` không được dùng khi đã có `DATABASE_URL`; có thể xóa biến này. Các giá trị có `<...>` là chỗ thay bằng giá trị thật.

Chọn **Save, rebuild and deploy**, hoặc **Manual Deploy → Deploy latest commit** sau khi lưu Environment. Phải deploy commit có adapter mới: chỉ thêm biến vào code cũ không thay đổi database.

## 3. Xác nhận

1. Mở `/api/health/`, cần HTTP 200 và `{"ok":true}`. Lần đầu app chuẩn bị schema/bộ câu hỏi nên có thể lâu hơn; đợi deploy Live.
2. Vào `/admin/`, đăng nhập, kiểm tra bộ workshop và ảnh.
3. Tạo phòng thử capacity 60, mở Host và Presentation; cho vài điện thoại BUZZ/chấm điểm trước.
4. Theo dõi Metrics → Memory để xác nhận web không còn vượt 512 MiB; kiểm tra tải thật trước workshop.

Nếu health báo lỗi, Logs có `[health] Database unavailable` kèm mã lỗi. `ENOTFOUND` thường là URL/region sai; `28P01` là sai thông tin đăng nhập; `42501` là thiếu quyền database. Không thêm dấu nháy quanh URL trong ô Environment.

Phòng/điểm mới ở PostgreSQL không mất khi web sleep, nhưng ảnh upload trên filesystem tạm vẫn có thể mất. Bộ workshop và ảnh đi kèm source vẫn có sẵn. Dữ liệu PGlite cũ không tự chuyển sang PostgreSQL mới.

Web Free vẫn có idle sleep, cần đánh thức trước buổi chơi và giữ tab game MC hoạt động. PostgreSQL Free của Render có thời hạn 30 ngày, phù hợp lần workshop này; cần đổi kế hoạch trước khi hết hạn nếu tiếp tục dùng. Không phải phương án database miễn phí vĩnh viễn.

Nguồn: [Render Postgres: tạo và kết nối](https://render.com/docs/postgresql-creating-connecting), [giới hạn Free](https://render.com/docs/free).
