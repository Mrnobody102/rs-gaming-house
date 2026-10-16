# Bộ workshop

Nguồn: `questions.pptx`. Bản nội dung dùng trong app: `src/content/workshop/index.ts`.
Ảnh đã trích nằm trong `public/workshop/`, được đóng gói cùng bản deploy. Không cần Cloudinary hay tải ảnh lên lại cho bộ này.

| Câu | Slide nguồn | Nội dung / đáp án | Điểm |
| --- | --- | --- | --- |
| 1 | 1 | Cần Giờ, vùng rừng ven biển ở ô 10 và 14 | 200 |
| 2 | 2 + ghi chú | Lý Sơn; giữ 3 gợi ý | 200 |
| 3 | 3 + ghi chú | Barcelona; giữ 3 gợi ý, diễn đạt gợi ý cuối rõ hơn | 200 |
| 4 | 4 + ghi chú | Tây Ninh; giữ ý giáp Campuchia và muối tôm. Gợi ý “trúng số” được thay bằng miền Nam | 300 |
| 5 | 5–7 | Sân Mỹ Đình; ba mức ảnh từ phân giải thấp đến rõ hơn, thay trực tiếp trong khung lớn và có nút đối chiếu lại | 300 |
| 6 | 8 + ghi chú | Văn Miếu – Quốc Tử Giám; giữ khung vàng và 3 gợi ý | 300 |
| 7 | 9, 10, 14 | Huế; ảnh đen trắng → gợi ý ảnh màu cũ ở slide 14 → ảnh hiện tại ở slide 10 khi mở đáp án | 400 |
| 8 | 11–12 | TechnoPark, Ocean Park 1, ảnh năm 2018; đáp án ô 16. Slide 12 là ảnh hiện tại dùng giải thích | 400 |
| 9 | 13 | Ghi chép thực địa tương ứng ảnh A; giữ đúng vùng crop trang sổ, góc xoay, tỷ lệ và vị trí A/B/C như PowerPoint | 400 |
| 10 | 15 (ẩn) | Hồ Ba Bể | 300 |
| 11 | 16 (ẩn) | Huế | 300 |
| 12 | 17 (ẩn) | Thành cổ Quảng Trị; giữ khung vàng | 300 |

Các đáp án A, Ba Bể, Huế (slide 16), Thành cổ Quảng Trị và ô 16 do tác giả xác nhận. Slide không ghi điểm tạm đặt mức vừa 300; có thể đổi trong quản trị. Các câu chưa có gợi ý được để trống, form vẫn có sẵn ba ô để bổ sung. Câu Cần Giờ giữ nguyên câu hỏi và đáp án cũ theo yêu cầu của tác giả.

Giữ số ô TechnoPark như bản gốc, chưa gắn kinh/vĩ độ vì PPT không có thông tin định vị đủ để hiệu chỉnh lưới. Có thể thay ảnh câu hỏi bằng ảnh đã vẽ tọa độ trong quản trị.

## Cập nhật

- Dùng ngay: sửa trong `/admin`. Nội dung nằm trên ổ dữ liệu, được giữ khi restart/deploy dùng cùng ổ.
- Muốn bản deploy mới cũng mang nội dung đã sửa: cập nhật `src/content/workshop/index.ts` và ảnh trong `public/workshop/`. Seed chạy một lần theo phiên bản; không tự ghi đè nội dung đã biên tập trong database.
- Bản cập nhật gợi ý bật cách mở ảnh nét dần cho câu Mỹ Đình mặc định trong kho và phòng còn chờ. Phòng đã bắt đầu, câu đã lưu trữ và phần tác giả tự sửa được giữ nguyên; áp dụng cho cả PostgreSQL và database cục bộ.
- Nếu thay PowerPoint và cần trích lại ảnh: `python scripts/extract-workshop.py`, sau đó `node scripts/workshop-assets.mjs`. Hai script giữ crop, lưới số và khung vàng của bản PPT này; sửa danh mục TS nếu cấu trúc slide thay đổi. Script Node dùng Sharp có trong dependencies của Next. Không cần chạy lại để deploy.

Thay đổi PowerPoint riêng lẻ không tự cập nhật bộ trong app. Giữ bản gốc để đối chiếu; bản build chỉ cần các ảnh WebP, dữ liệu TS và migration.
