# Chơi trên Wi-Fi nội bộ

Laptop MC chạy server; điện thoại cùng mạng truy cập IP của laptop. Cùng tên Wi-Fi chưa đủ nếu mạng công ty/Guest bật cô lập thiết bị. Khi đó cần mạng cho phép truy cập nội bộ, chẳng hạn router riêng của buổi workshop.

## Chuẩn bị laptop

Chạy bản production để tổ chức; dừng bản dev đang chiếm cùng cổng trước. Nếu dùng cấu hình cục bộ hiện có:

```powershell
cd C:\Workspace\software\eo-platform\rs-gaming-house
npm run build
npm run start:demo -- --port 3200
```

Để hoạt động cả khi mất Internet, cấu hình trong `.env.local` phải dùng database và ảnh trên laptop:

```dotenv
DATABASE_URL=
JOIN_BASE_URL=
MEDIA_STORAGE=local
```

Giữ mật mã admin riêng trong cấu hình hiện có. Không đổi `.env.local` của một tiến trình đang chạy rồi cho rằng cấu hình đã áp dụng: cần khởi động lại app. Các biến môi trường đã đặt ở terminal có ưu tiên hơn file cấu hình.

Database cục bộ là dữ liệu riêng; bộ câu hỏi đã chỉnh trên Render không tự đồng bộ về laptop. Kiểm tra đủ câu, ảnh và đáp án trước khi tạo phòng LAN. Nếu chỉ cần giơ tay và tính điểm ngoài, dùng HTML tải từ **Trình chiếu → Tải bản dự phòng** trên Render để giữ đúng nội dung hiện tại.

## Người chơi kết nối

1. Chạy `ipconfig`, tìm **IPv4 Address** của adapter Wi-Fi đang dùng, ví dụ `192.168.1.25`.
2. Laptop mở `http://localhost:3200/admin/`, tạo phòng. Điện thoại mở `http://192.168.1.25:3200/` rồi nhập mã phòng.
3. Kiểm tra **Địa chỉ cho người chơi** trong phòng chờ đúng IP và cổng. QR phải trỏ tới địa chỉ này; `localhost` trên điện thoại không trỏ về laptop.
4. Nếu Windows hỏi, cho phép Node truy cập mạng nội bộ đang dùng. Không cần tắt toàn bộ firewall hoặc mở port trên router ra Internet.
5. Thử bằng một điện thoại trước, rồi nhiều máy cùng BUZZ. Giữ laptop cắm sạc, không sleep và cửa sổ server mở trong suốt buổi chơi.

Trên địa chỉ HTTP nội bộ, dùng camera mặc định của điện thoại để mở QR; camera tích hợp trong website có thể yêu cầu HTTPS. Nếu điện thoại không mở được trang ngay cả khi gõ đúng IP, kiểm tra cô lập thiết bị, firewall và IP thay đổi khi chuyển Wi-Fi.

## Cách phân xử chuông

Server chọn một yêu cầu hợp lệ bằng giao dịch khóa trong database. Các yêu cầu sau nhận cùng người thắng. Phản hồi chậm hoặc mất sau khi giao dịch đã được ghi nhận không làm mất quyền trả lời; tải lại lấy trạng thái đã lưu. Mỗi lượt mở chuông có mã riêng để từ chối yêu cầu cũ đến trễ.

Điều này không đo được chính xác thời điểm ngón tay chạm màn hình giữa các thiết bị có đường mạng khác nhau. Đồng hồ trên điện thoại không được dùng để tự nhận quyền ưu tiên. LAN giảm phần độ trễ Internet, nhưng vẫn cần kiểm tra Wi-Fi thực tế của phòng.
