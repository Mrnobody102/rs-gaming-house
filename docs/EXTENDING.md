# Thêm nội dung và game

## Thêm câu hỏi

Trên web: **Câu hỏi → chọn game → Soạn câu hỏi**. Nhập ảnh, câu hỏi, đáp án bằng chữ; gợi ý và giải thích là tùy chọn. Có thể vẽ tọa độ hoặc chú thích lên ảnh trước khi tải. Không cần nhập bounds/target/tolerance hay đánh dấu regions. Các trường này chỉ còn để tương thích dữ liệu cũ. Bộ đề lưu thứ tự câu, phòng chơi chụp snapshot nên không đổi khi sửa kho.

`features/games/hints.ts` định nghĩa gợi ý chữ/ảnh, giữ tương thích các chuỗi chữ cũ. Form `questions/hint-fields.tsx` luôn có ít nhất ba ô; chỉ lưu ô có nội dung. Màn chơi `play/game-hints.tsx` render các gợi ý mà server đã mở. Không đưa URL của ảnh gợi ý chưa mở vào snapshot công khai.

Trong source: thêm vào `src/content/starter/<game>.ts`, dùng UUID ổn định và khai báo `difficulty: easy | medium | hard`. Bộ mẫu được ghép trong `index.ts`. Dùng ảnh cục bộ hoặc URL HTTPS; ảnh trước/sau phải căn chỉnh và có quyền sử dụng. `npm test` kiểm tra schema, ID không trùng và độ phủ game/độ khó.

Ảnh ở `public/starter/` là SVG minh họa, không phải ảnh vệ tinh/historical thật. Xem [NASA về tổ hợp màu giả](https://science.nasa.gov/earth/earth-observatory/how-to-interpret-a-false-color-satellite-image/) để đối chiếu khi soạn nội dung thực tế.

## Thêm game

1. Thêm schema trong `src/features/games/schemas/`, đăng ký trong `question-schema.ts`.
2. Khai báo nhãn/cách trả lời ở `catalog.ts`, thêm dữ liệu mặc định trong factory `newQuestion`.
3. Thêm form soạn và renderer cho game; game ảnh có thể dùng lại `ImageViewer`, `CompareImages`, `Puzzle`.
4. Nếu thay đổi luật trả lời hoặc bí mật cần che trước reveal, thêm migration SQL mới và command Zod tương ứng. Không sửa migration đã chạy.
5. Thêm kiểm thử câu hợp lệ/không hợp lệ, che đáp án, chấm điểm và chuyển vòng. Không tự bật loại mới chỉ bằng một nhãn giao diện.

`features/questions/model.ts` giữ API re-export cho những nơi đang dùng; schema thật và metadata game nằm trong `features/games`. Bộ lọc nội dung nằm trong `questions/filter.ts`, dùng chung giữa kho và màn tạo phòng. Mức khó là metadata do tác giả chọn; không tự suy ra từ điểm.

Thang điểm ở `features/games/scoring.ts` và hàm SQL `difficulty_points`: dễ 200, vừa 300, khó 400. Khi thay thang điểm, cập nhật cả hai và thêm migration; chỉ áp dụng cho các snapshot phiên mới. `hopeStar` là mặc định của câu, còn `starQuestionIds` trong bộ/phiên ghi đè theo buổi chơi. Server giữ trạng thái chọn/dùng sao, khóa lựa chọn khi đã BUZZ hoặc gửi bài, và tính ×2 lúc công bố. Giao diện bục xếp hạng tách ở `features/play/ranking.tsx`.

`reserveQuestionIds` lưu các câu dự bị riêng với câu chính; `session_reserves` giữ snapshot theo phòng. Migration `009` xử lý tên chuẩn hóa, hạng bằng điểm, nhóm được tranh hạng và kết quả câu dự bị. `prize_standings` chỉ dùng điểm và các hạng đã giành ở câu dự bị; số câu đúng và thời gian trước đó không quyết định hạng. Chỉ `tie_start` tạo lượt dự bị có điểm 0 và không dùng sao. Quyền BUZZ được kiểm tra lại trên server theo nhóm của lượt, không dựa vào nút disabled ở client.
