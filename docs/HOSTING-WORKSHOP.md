# Chọn hosting cho workshop

Rà soát ngày 16/10/2026, với code hiện tại và mục tiêu 50–60 người BUZZ trong workshop ngày 17/10.

**Đề xuất:** nếu có thể chi một khoản nhỏ, dùng một Render Web Service Singapore gói `1c-2g` cho thời gian chạy thử và tổ chức. Nếu bắt buộc miễn phí, thử Render Free và chỉ nghiệm thu sau khi test trên deployment thật. Không chuyển kiến trúc sang Vercel sát giờ workshop.

| Phương án | Phù hợp code hiện tại | Đánh đổi cho ngày mai |
| --- | --- | --- |
| Render Free | Một process Node, PGlite và SSE dùng chung | 0,1 CPU / 512 MB; idle sau 15 phút không có inbound traffic; có thể restart và mất dữ liệu tạm |
| Render `0.5c-512mb` | Giữ nguyên mô hình | Bỏ idle sleep, tăng CPU; vẫn chỉ 512 MB RAM, cần theo dõi bộ nhớ thực |
| Render `1c-2g` | Khớp `render.yaml` hiện có | Bỏ idle sleep, 1 CPU / 2 GB có thêm khoảng trống CPU/RAM; vẫn phải đo độ trễ thật |
| Vercel Hobby | Cần thay adapter database và bus realtime | Không phải lựa chọn deploy nguyên trạng; nhiều thay đổi cần kiểm thử lại |
| Railway Trial/Hobby | Hỗ trợ kiểu Node/container tương tự | Thêm nền tảng/cấu hình cần kiểm tra; có thể dùng nếu đã quen Railway |
| Laptop MC qua LAN | Giữ nguyên mô hình production Node | Không phụ thuộc Internet, nhưng cần mạng LAN cho phép thiết bị liên lạc, router đủ tải, firewall và laptop không sleep |

## Vì sao Vercel Free chưa phù hợp nguyên trạng

Vấn đề không phải riêng con số 60 người. Repo hiện dùng database PGlite trên filesystem và bus SSE trong `globalThis`. Vercel Functions có các instance độc lập và filesystem chỉ ghi được trong `/tmp`. Chuyển database vào `/tmp` chỉ tránh lỗi ghi file; không biến nó thành database chung giữa các instance. Khi các request của người chơi/MC vào các instance khác nhau, không còn một trạng thái phòng và một nơi quyết định người thắng dùng chung.

Để dùng Vercel cần:

1. Chuyển adapter sang PostgreSQL dùng chung, giữ transaction/row lock và claims trong cùng transaction.
2. Chuyển thông báo realtime sang pub/sub dùng chung hoặc dịch vụ realtime; không dựa vào bus trong process.
3. Dùng environment cho mật mã/secret và object storage cho media.
4. Kiểm tra reconnect: Function Hobby với Fluid compute có tối đa 300 giây, tính cả streaming SSE.

Vercel đã có WebSocket beta trên mọi plan theo tài liệu hiện tại; không nên lấy lý do “Vercel không có WebSocket” để quyết định. WebSocket cũng không tự giải quyết database và pub/sub bị tách giữa các instance. App hiện tại dùng SSE + HTTP.

Đánh giá chi tiết hơn: [VERCEL.md](VERCEL.md).

## Chi phí và lựa chọn

Giá niêm yết Render hiện tại: `0.5c-512mb` $7/tháng; `1c-2g` $25/tháng. Compute được tính theo thời gian chạy, prorate theo giây. Nếu chạy `1c-2g` khoảng một ngày, tiền compute ước khoảng $0,8–0,9, chưa gồm thuế, disk, bandwidth hay khoản khác. Đây là ước tính từ giá tháng, cần xem billing thực tế. Kết thúc workshop cần tắt/xóa tài nguyên không còn dùng; để service chạy tiếp thì tiếp tục tính phí.

Gói trả phí bỏ cơ chế idle sleep; không đồng nghĩa server sẽ không bao giờ restart. Disk giúp giữ database qua restart, nhưng cần client reconnect và phục hồi đúng để tiếp tục phiên. `render.yaml` đã có disk; [RENDER.md](RENDER.md) mô tả cấu hình này. Render Free dùng [RENDER-FREE.md](RENDER-FREE.md).

Railway hiện có trial $5 trong tối đa 30 ngày, sau đó Free credit $1/tháng; trial giới hạn RAM 1 GB. Hobby $5/tháng gồm $5 usage, phần vượt tính thêm. Đây là lựa chọn Node/container có thể cân nhắc, không có kết quả đo trong repo để khẳng định nhanh hơn Render.

Nếu không muốn trả phí, vẫn có thể thử Render Free. Tuy nhiên, giữ service thức chỉ giải quyết idle; không tăng CPU/RAM hay chứng minh đạt mục tiêu màn hình nhận kết quả dưới 1 giây. Nếu Free không đạt, chuyển gói rồi test lại trước khi tạo phòng cuối cùng.

## Nguồn

- [Render compute plans](https://render.com/docs/compute-plans)
- [Render pricing](https://render.com/pricing) và [FAQ billing/paid compute](https://render.com/docs/faq)
- [Render Free limitations](https://render.com/docs/free)
- [Vercel filesystem và instance isolation](https://vercel.com/docs/functions/runtimes)
- [Vercel Function duration](https://vercel.com/docs/functions/limitations)
- [Vercel WebSockets và state coordination](https://vercel.com/docs/functions/websockets)
- [Railway trial](https://docs.railway.com/pricing/free-trial) và [plans](https://docs.railway.com/pricing/plans)
