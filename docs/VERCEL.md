# Chạy 50–60 người trên Vercel

Đánh giá ngày 15/10/2026: quy mô này có thể triển khai với Vercel và database dùng chung, nhưng **repo hiện tại chưa sẵn sàng deploy nguyên trạng lên Vercel**. Chưa có kiểm tra tải trên một deployment Vercel thật.

Hiện `server/local-database.ts` mở PGlite trên filesystem; `admin-settings.ts` lưu mật mã thiết lập lần đầu vào file; ảnh mặc định ở `.local/media`. Vercel Functions có filesystem chỉ đọc ngoài `/tmp`, và các instance không dùng chung ổ đĩa. Chuyển đường dẫn sang `/tmp` không tạo được database bền vững dùng chung. Nguồn: [Vercel runtimes](https://vercel.com/docs/functions/runtimes#file-system-support).

## Cấu hình đề xuất

- Next.js và API chạy trên Vercel.
- Câu hỏi, bộ, phòng, BUZZ, sao và điểm dùng một PostgreSQL được quản lý, ví dụ Supabase Postgres. Giữ các transaction và khóa hiện có; thay adapter PGlite bằng kết nối Postgres qua transaction pooler. Không cần thêm đăng nhập email cho admin. [Supabase kết nối từ serverless](https://supabase.com/docs/guides/database/connecting-to-postgres#shared-pooler-transaction-mode).
- Ảnh câu hỏi và gợi ý lưu trên Cloudinary hoặc object storage. Upload trực tiếp có chữ ký để ảnh lớn không đi qua body của Vercel Function. Route upload hiện tại proxy ảnh tối đa 8 MB, trong khi Vercel Function giới hạn payload 4,5 MB. Chỉ đổi `MEDIA_STORAGE=cloudinary` chưa giải quyết giới hạn này. [Vercel request body size](https://vercel.com/docs/functions/limitations#request-body-size).
- Đặt `ADMIN_PASSCODE`, `ADMIN_SESSION_SECRET` ổn định trong environment; không dùng setup mật mã qua file trên Vercel. Đặt `JOIN_BASE_URL` bằng domain HTTPS công khai.
- Đặt API và database gần nhau. Nếu dùng transaction pooler, giữ claims trong cùng transaction với lời gọi SQL; tắt prepared statements theo hướng dẫn của provider.

## Tải cần kiểm chứng

Hiện client lấy trạng thái khoảng mỗi 1,2 giây: 60 máy đang hoạt động tương đương khoảng **50 request/giây**, chưa tính MC, trình chiếu, thao tác và retry. Vercel có khả năng mở rộng Functions, nhưng giới hạn nền tảng không chứng minh độ trễ BUZZ hay khả năng chịu tải của database ứng dụng. [Vercel Functions limits](https://vercel.com/docs/functions/limitations).

Kiểm tra HTTP cục bộ ngày 15/10/2026, trên bản Next.js production và PGlite: 60 người tham gia, một đợt 60 yêu cầu đọc đồng thời hoàn tất trong **290 ms**, một đợt 60 yêu cầu BUZZ đồng thời trong **308 ms**; đúng một người thắng, chỉ một người được cộng điểm, không có request lỗi. Đây là thời gian toàn đợt trên loopback, không phải p95 từng request, không mô phỏng 60 trình duyệt tải ảnh hay tải liên tục và không phải kết quả đo trên Vercel.

Trước buổi chơi, cần thử trên deployment thật: 60 người vào phòng, duy trì đọc trạng thái trong một phiên, 60 người cùng BUZZ, mở gợi ý ảnh, chấm và công bố top 3. Theo dõi tỷ lệ lỗi, độ trễ p95, kết nối database và lượng request. Với BUZZ cạnh tranh, có thể thay polling dày bằng kênh realtime sau khi adapter database đã dùng chung; việc chọn người thắng vẫn phải được quyết định nguyên tử trong database.

Nếu muốn dùng nguyên bản code hiện tại, mô hình đang hỗ trợ là một Node server/container có ổ đĩa bền vững. Đây là hai cách triển khai khác nhau, không thể chỉ đổi lệnh deploy.
