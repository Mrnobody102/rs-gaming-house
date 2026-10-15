import type { Question } from "@/features/questions/model";
import { starterBase, scenes } from "./shared";
export const choiceQuestions: Question[] = [
  {
    ...starterBase(1210, "easy"),
    kind: "choice",
    image: scenes.port + "-after.svg",
    title: "Màu nước khác ảnh trước. Kết luận nào hợp lý?",
    options: [
      "Chắc chắn có ô nhiễm",
      "Cần thêm bằng chứng về điều kiện chụp và chất lượng nước",
      "Chắc chắn có tàu đổ chất thải",
      "Không thể quan sát mặt nước bằng ảnh",
    ],
    correct: 1,
    explanation:
      "Màu sắc có thể chịu ảnh hưởng của điều kiện quan sát và thành phần trong nước. Cần kiểm chứng trước khi gán nguyên nhân.",
  },
  {
    ...starterBase(1211, "medium"),
    kind: "choice",
    title:
      "Mép mọi công trình đều lệch cùng hướng giữa hai ảnh. Nên kiểm tra gì trước?",
    options: [
      "Độ tăng dân số",
      "Màu chú giải",
      "Việc căn chỉnh không gian của cặp ảnh",
      "Số người đang chơi",
    ],
    correct: 2,
    explanation:
      "Sai lệch đăng ký ảnh có thể tạo ra biến động giả dọc theo ranh giới địa vật.",
  },
  {
    ...starterBase(1212, "hard"),
    kind: "choice",
    title:
      "Một vùng rừng đỏ trong ảnh màu giả nhưng xanh trong ảnh màu thật. Có đủ bằng chứng mất rừng chưa?",
    options: [
      "Có, màu đỏ luôn là đất trống",
      "Có, hai màu khác nhau là hai lớp phủ khác nhau",
      "Có, rừng chỉ có thể màu xanh",
      "Chưa; cần biết tổ hợp kênh và so sánh dữ liệu tương thích",
    ],
    correct: 3,
    explanation:
      "Màu hiển thị phụ thuộc các dải phổ được ánh xạ vào RGB. Thực vật có thể có màu đỏ trong một tổ hợp màu giả.",
  },
];
