import type { Question } from "@/features/questions/model";
import { starterBase, scenes } from "./shared";
export const changeQuestions: Question[] = [
  {
    ...starterBase(1207, "easy"),
    kind: "change",
    solution: "",
    image: scenes.farm + "-before.svg",
    afterImage: scenes.farm + "-after.svg",
    beforeLabel: "Trước",
    afterLabel: "Sau",
    title: "Ô đất nào đã chuyển sang khu xây dựng?",
    regions: [
      {
        x: 29.1667,
        y: 31.25,
        radius: 12,
        label: "Sân và cụm nhà mới xuất hiện phía tây sông.",
      },
    ],
    hints: ["Tìm cấu trúc mái nhà và ranh sân mới."],
    explanation:
      "Các mái nhà và bề mặt sân mới là dấu hiệu rõ hơn sự khác màu của các ô ruộng.",
  },
  {
    ...starterBase(1208, "medium"),
    kind: "change",
    solution: "",
    image: scenes.forest + "-before.svg",
    afterImage: scenes.forest + "-after.svg",
    beforeLabel: "Trước",
    afterLabel: "Sau",
    title: "Vùng nào có bằng chứng mất lớp phủ cây?",
    regions: [
      {
        x: 70.8333,
        y: 71.25,
        radius: 15,
        label:
          "Mảng cây được thay bằng ô đất trống có đường tiếp cận và công trình.",
      },
    ],
    hints: ["Quan sát sự thay đổi cả cấu trúc bề mặt lẫn hình dạng ranh giới."],
    explanation:
      "Mảng đất trống, đường vào và mái nhà mới là nhiều bằng chứng đồng thời. Đổi sắc ở những mảng cây khác chưa tự nó chứng minh mất rừng.",
  },
  {
    ...starterBase(1209, "hard"),
    kind: "change",
    solution: "",
    image: scenes.port + "-before.svg",
    afterImage: scenes.port + "-after.svg",
    beforeLabel: "Trước",
    afterLabel: "Sau",
    title: "Phân biệt mở rộng cảng với thay đổi màu nước",
    regions: [
      {
        x: 85,
        y: 65,
        radius: 12,
        label: "Cầu tàu mới vươn ra biển ở phía nam.",
      },
      {
        x: 65.8333,
        y: 65,
        radius: 7,
        label: "Nhà điều hành mới trên phần đất phía tây cầu tàu.",
      },
    ],
    hints: [
      "Cần tìm những cấu trúc mới, không chỉ vùng nước đổi màu.",
      "Có hai khu vực liên quan đến cùng hoạt động xây dựng.",
    ],
    explanation:
      "Hai cấu trúc mới có vị trí ổn định so với bờ là biến động thật trong cặp ảnh minh họa. Màu nước thay đổi chưa đủ để kết luận có ô nhiễm.",
  },
];
