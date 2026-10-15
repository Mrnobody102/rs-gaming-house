import type { Question } from "@/features/questions/model";
import { starterBase } from "./shared";
export const riddleQuestions: Question[] = [
  {
    ...starterBase(1216, "easy"),
    kind: "riddle",
    title:
      "Làm cách nào quan sát một khu vực đã thay đổi ra sao qua nhiều năm?",
    solution: "Đối chiếu chuỗi ảnh vệ tinh của cùng khu vực ở nhiều thời điểm.",
    hints: [
      "Một lần quan sát chưa đủ.",
      "Cần cùng một khu vực, nhưng khác ngày chụp.",
      "Đặt ảnh vệ tinh cũ cạnh ảnh mới.",
    ],
    explanation:
      "Chấp nhận cách diễn đạt tương đương khi người chơi nêu được việc đối chiếu nhiều thời điểm.",
  },
  {
    ...starterBase(1217, "medium"),
    kind: "riddle",
    title:
      "Tòa nhà chưa xuất hiện trên ảnh cũ. Dựa vào đâu để tìm vị trí của nó?",
    solution:
      "Các mốc ổn định như giao điểm đường, sông, ranh đất và tọa độ tham chiếu.",
    hints: [
      "Tìm thứ vẫn tồn tại trước và sau khi tòa nhà xuất hiện.",
      "Một con sông hoặc nút giao có thể giúp định hướng.",
      "Dùng địa vật ổn định làm mốc, rồi đối chiếu tọa độ.",
    ],
    explanation:
      "MC chấp nhận lời giải nêu được mốc ổn định và quan hệ vị trí hợp lý.",
  },
  {
    ...starterBase(1218, "hard"),
    kind: "riddle",
    title: "Cây có màu đỏ trên ảnh nhưng chưa có bằng chứng cháy. Vì sao?",
    solution: "Ảnh màu giả có thể ánh xạ dải cận hồng ngoại vào kênh đỏ.",
    hints: [
      "Màu hiển thị không nhất thiết là màu mắt người nhìn thấy.",
      "Cần biết các dải phổ đã được gán vào RGB như thế nào.",
      "Trong một tổ hợp màu giả, phản xạ cận hồng ngoại của cây được hiển thị thành đỏ.",
    ],
    explanation:
      "Không suy ra cháy chỉ từ màu đỏ khi chưa biết tổ hợp kênh và các bằng chứng khác.",
  },
];
