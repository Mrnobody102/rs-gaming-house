# Render Free cho workshop 50–60 người

**Cập nhật sau lỗi OOM thực tế:** dùng [Render Web Free + PostgreSQL Free](RENDER-POSTGRES-FREE.md) để đưa database ra khỏi RAM của web. Hướng PGlite trong cùng service bên dưới đã gặp giới hạn 512 MiB và chưa được nghiệm thu cho workshop.

Rà soát ngày 16/10/2026. Có thể deploy bản hiện tại thành một Node Web Service để kiểm thử trên Render Free. Chỉ chốt dùng BUZZ cho workshop sau khi deployment thật vượt qua các kiểm tra bên dưới. Chưa có kết quả đo tải Render Free trong repo.

So sánh Render Free/trả phí, Vercel và các lựa chọn khác: [HOSTING-WORKSHOP.md](HOSTING-WORKSHOP.md).

## Những gì hệ thống đang có

- BUZZ gửi bằng HTTP POST; server báo thay đổi qua **SSE** (`/api/events/`), rồi client đọc trạng thái. Không dùng WebSocket.
- Transaction khóa phòng, kiểm tra mã lượt mở chuông và chốt một người thắng. Các yêu cầu hợp lệ còn lại nhận cùng kết quả. Có test 60 yêu cầu BUZZ đồng thời ở tầng SQL và HTTP.
- Client đối soát mỗi 6 giây khi SSE hoạt động, mỗi 1,2 giây khi SSE lỗi; tab ẩn đặt lịch mỗi 15 giây. Trình duyệt/hệ điều hành vẫn có thể đình chỉ tab.
- Heartbeat SSE mỗi 15 giây đi từ server ra client. Bản thân heartbeat này không phải HTTP request gửi vào service để chống idle.
- Có **Chỉ trình chiếu** và **Tải bản dự phòng** HTML. Phương án giơ tay dùng MC gọi người trả lời và ghi điểm bên ngoài. Chưa có chức năng chỉ định người thắng thủ công trong phòng BUZZ.
- Chạy **một instance, một Node process** vì database PGlite và bus SSE ở cùng process.

Người thắng là yêu cầu hợp lệ đầu tiên được server chấp nhận. Độ trễ mạng khác nhau có thể ảnh hưởng thứ tự; không thể khẳng định ai chạm màn hình sớm nhất tuyệt đối. Thời gian `… s` cạnh tên người thắng tính từ lúc MC mở chuông đến lúc server ghi nhận, không đo thời gian từ bấm đến hiện kết quả trên màn hình lớn.

## Tạo Web Service Free

`render.yaml` hiện tạo **gói trả phí `1c-2g` và persistent disk**. Với hướng dẫn Free này, tạo Web Service thủ công trong Dashboard.

1. Đẩy commit cần dùng lên GitHub; không đẩy `.env.local`, `.local`, database hoặc ảnh upload vào Git.
2. Render → **New → Web Service** → kết nối repo và chọn đúng branch/commit.
3. Điền cấu hình:

| Mục | Giá trị |
| --- | --- |
| Runtime / Language | Node; chọn rõ nếu Render tự nhận Docker |
| Region | Singapore |
| Root Directory | Để trống khi repo root là thư mục app này |
| Instance Type | Free |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `node .next/standalone/server.js` |
| Health Check Path | `/api/health/` |
| Instance / process | 1; không dùng cluster hoặc PM2 nhiều worker |
| Auto Deploy | Off |
| Persistent disk | Không gắn; Free không hỗ trợ |

`--include=dev` giữ các công cụ build Tailwind/TypeScript khi có `NODE_ENV=production`. Build của repo đã đóng gói public, static assets và SQL migrations vào standalone.

4. Thêm Environment, thay các giá trị mẫu:

```dotenv
NODE_VERSION=24
NODE_ENV=production
HOSTNAME=0.0.0.0
LOCAL_PREVIEW=0
APP_DATA_DIR=/tmp/pixel-hunt/postgres
ADMIN_SETTINGS_DIR=/tmp/pixel-hunt/settings
MEDIA_DIR=/tmp/pixel-hunt/media
MEDIA_STORAGE=local
ADMIN_PASSCODE=<mat-ma-rieng>
ADMIN_SESSION_SECRET=<chuoi-ngau-nhien-dai>
```

Sinh secret trên máy mình bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Render tự cấp `PORT`.

5. Tạo service và đợi **Live**. Mở `https://<ten-app>.onrender.com/api/health/`; yêu cầu HTTP 200 và `{"ok":true}`. Nếu lỗi, xem Logs trước khi tạo phòng.
6. Thêm `JOIN_BASE_URL=https://<ten-app>.onrender.com`, lưu và hoàn tất redeploy trước khi chuẩn bị phòng cuối cùng. Kiểm tra QR trên điện thoại mở đúng HTTPS domain.
7. Vào `/admin/`, đăng nhập, kiểm tra bộ câu hỏi/ảnh và tạo **phòng thử riêng**, capacity 60. Mở Host và Presentation; thử tải trên đúng deployment này.

Các thư mục `/tmp/pixel-hunt/...` là dữ liệu tạm. Free có thể mất dữ liệu đã ghi khi sleep, restart hoặc redeploy: cả phòng, người chơi, điểm, sửa câu hỏi và ảnh upload. Bộ workshop/ảnh có sẵn trong source được seed lại; nội dung tự soạn trên laptop không tự đi theo Git. Đây là rủi ro cho cả phiên đang chơi, dù chưa cần lưu lâu dài.

## Checklist trước khi bắt đầu

Chỉ tick sau khi quan sát được trên deployment thật:

- [ ] Render báo Live; `/api/health/` trả HTTP 200 và `{"ok":true}` ổn định trên mạng sự kiện.
- [ ] 60 người chơi giữ kênh SSE đồng thời, cộng thêm Host và Presentation; các màn nhận sự kiện mở/đóng/thắng chuông.
- [ ] 20 lượt liên tiếp, mỗi lượt 60 yêu cầu BUZZ gần đồng thời với mã mở chuông hiện tại: đúng một người thắng, mọi kết quả hợp lệ thống nhất người thắng, chấm điểm không bị cộng lặp.
- [ ] Đo từ lúc nhấn BUZZ đến lúc tên người thắng thực sự hiện trên cả Host và Presentation: mục tiêu ít nhất 19/20 lượt dưới 1 giây; mọi client cập nhật hoặc phục hồi, không có client mắc kẹt phải tải lại.
- [ ] Để phòng chờ ít nhất 20 phút với cách giữ hoạt động sẽ dùng thật; sau đó BUZZ ngay, xác nhận phòng/người chơi còn nguyên và cập nhật nhanh. Kiểm tra đường SSE riêng; polling dự phòng có thể che việc SSE lỗi.
- [ ] MC đã mở thử **Chỉ trình chiếu**, tải và mở file HTML dự phòng khi ngắt mạng; thống nhất giơ tay và ghi điểm bên ngoài nếu BUZZ gặp lỗi. Đây là phương án dự phòng hiện có; chưa phải chọn người thắng thủ công trong app.
- [ ] Hoàn tất deploy/thay đổi Environment, tắt Auto Deploy và không restart/deploy trong workshop.

Test HTTP có sẵn để lặp 20 lần trên **production local** sau khi cài Node 24, dependencies và build:

```powershell
npm run build
npm run test:e2e -- e2e/platform.spec.ts --grep "60 concurrent players" --repeat-each=20
```

Lệnh này tạo phòng thử, chạy 20 đợt HTTP 60 người và kiểm tra một người thắng/một người có điểm. Nó **không** mở 60 kênh SSE, không đo thời gian render của màn hình và không chạy lên Render. Cấu hình Playwright hiện cố định server local cổng 3201/3202; đổi mỗi URL trong câu lệnh không biến nó thành test deployment.

Lần chạy ngày 16/10 có 19 pass và 1 timeout khi khởi tạo phòng đầu tiên; chưa đạt 20/20. Chi tiết và thời gian toàn đợt ở [VALIDATION.md](VALIDATION.md). Production local cũng cần kiểm tra `/api/health/` sẵn sàng trước khi chơi; webServer của Playwright hiện chỉ đợi trang `/` trả lời, chưa đợi database khởi tạo xong.

Để đạt checklist, cần thêm buổi chạy thử trên Render với các kết nối SSE/polling thực, nhiều lượt cùng BUZZ và quan sát/đo Host, Presentation. Dùng phòng thử riêng để không đưa người chơi giả vào phòng workshop. Mục tiêu dưới 1 giây là tiêu chí nghiệm thu, không phải cam kết hiệu năng của Free.

## Giữ service hoạt động trong buổi chơi

Render Free idle sau 15 phút không có traffic gửi vào; đánh thức thường mất khoảng một phút. Với app này, polling HTTP từ tab game đang chạy tạo inbound traffic. Giữ laptop MC cắm điện, không sleep, tab phòng game hoạt động và mạng ổn định; không chỉ mở trang danh sách phòng quản trị.

Có thể chạy vòng gọi HTTP dưới đây trên **laptop có mạng**, bắt đầu trước workshop và giữ trong buổi chơi. Thay URL thật; Ctrl+C để dừng:

```powershell
$workshopHealthUrl = 'https://<ten-app>.onrender.com/api/health/'
while ($true) {
  try {
    $workshopHealth = Invoke-RestMethod -Uri $workshopHealthUrl -TimeoutSec 20
    if (-not $workshopHealth.ok) { throw 'Health check chưa sẵn sàng' }
    Write-Host "$(Get-Date -Format HH:mm:ss) health OK"
  } catch {
    Write-Warning $_.Exception.Message
  }
  Start-Sleep -Seconds 60
}
```

Vòng HTTP này giúp tránh idle trong điều kiện laptop/mạng hoạt động; không ngăn restart của nền tảng, hết quota hoặc quá tải. Nếu service đang ngủ, lần gọi đầu có thể timeout: đợi service khởi động xong và kiểm tra lại `ok:true`.

Trước workshop khoảng 30 phút: đánh thức service, kiểm tra health, đăng nhập MC, chuẩn bị phòng cuối cùng, kiểm tra ảnh/QR, giữ phòng hoạt động và chơi thử trên vài điện thoại dùng Wi-Fi/4G tại chỗ. Nếu đã mất phòng sau restart, tạo lại phòng và phát lại mã/QR. Giữ sẵn HTML dự phòng trên máy MC.

Render có thể restart Free bất kỳ lúc nào. Nếu tải thực không đạt, dùng phương án giơ tay hoặc đổi compute rồi kiểm thử lại trước khi bắt đầu. Không điều chỉnh deployment giữa lượt chơi.

## Tài liệu nền tảng

- [Render Free: idle, filesystem tạm và giới hạn](https://render.com/docs/free)
- [Render Blueprint: tài nguyên của gói Free](https://render.com/docs/blueprint-spec#plan)
- [Tạo Node Web Service và bind PORT](https://render.com/docs/web-services)
- [Cấu hình Node.js](https://render.com/docs/node-version)
- [npm include/omit dependencies](https://docs.npmjs.com/cli/using-npm/config/)
