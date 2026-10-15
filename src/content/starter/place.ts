import type { Question } from "@/features/questions/model";
import { starterBase, scenes } from "./shared";
export const placeQuestions: Question[] = [
  {
    ...starterBase(1201, "easy"),
    kind: "place",
    image: scenes.farm + "-before.svg",
    title: "Đâu là vùng canh tác trên ảnh?",
    solution: "Các ô ruộng hình chữ nhật ở phía đông con sông.",
    hints: [
      "Tìm các ô có ranh giới đều đặn.",
      "Quan sát phía bên phải dòng sông.",
    ],
    explanation:
      "Hình học thửa đất và hệ thống đường nội đồng là bằng chứng; màu xanh riêng lẻ chưa đủ.",
  },
  {
    ...starterBase(1202, "medium"),
    kind: "place",
    image: scenes.forest + "-before.svg",
    title: "Xác định điểm đường giao thông vượt qua sông",
    solution: "Giao điểm của tuyến đường ngang và dòng sông ở gần giữa ảnh.",
    hints: [
      "Bám theo tuyến đường sáng màu.",
      "Tìm nơi đường cắt qua dải nước xanh.",
    ],
    explanation:
      "Đọc tính liên tục của đường và sông để xác định vị trí vượt sông.",
  },
  {
    ...starterBase(1203, "hard"),
    kind: "place",
    image: scenes.port + "-before.svg",
    title: "Khu bến cảng nằm ở đoạn bờ nào?",
    solution:
      "Phần bờ phía đông, tại các cầu tàu vươn ra mặt nước ở nửa trên ảnh.",
    hints: [
      "Tìm các cấu trúc hẹp vươn khỏi bờ.",
      "Phân biệt cầu tàu với đường giao thông nằm trên đất liền.",
    ],
    explanation:
      "Các cầu tàu nối với sân bãi trên bờ; quan hệ không gian này giúp phân biệt chúng với đường hay đê ven biển.",
  },
];
