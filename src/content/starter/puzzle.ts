import type { Question } from "@/features/questions/model";
import { starterBase, scenes } from "./shared";
export const puzzleQuestions: Question[] = [
  {
    ...starterBase(1213, "easy"),
    kind: "puzzle",
    image: scenes.farm + "-before.svg",
    grid: 2,
    title: "Ghép liền dòng sông qua vùng ruộng",
    hints: ["Nối hai bờ sông trước, rồi đối chiếu ranh thửa."],
    explanation:
      "Dòng sông và các đường nội đồng phải nối liên tục qua mép mảnh.",
  },
  {
    ...starterBase(1214, "medium"),
    kind: "puzzle",
    image: scenes.port + "-after.svg",
    grid: 2,
    title: "Khôi phục bờ biển và hệ thống cầu tàu",
    hints: ["Giữ mặt nước liền một phía; nối đường ngang qua bờ."],
    explanation:
      "Dùng đường bờ, tuyến đường và các cầu tàu để kiểm tra thứ tự mảnh.",
  },
  {
    ...starterBase(1215, "hard"),
    kind: "puzzle",
    image: scenes.forest + "-after.svg",
    grid: 3,
    title: "Ghép lại 9 mảnh bản đồ vùng rừng",
    hints: [
      "Xác định mảnh có giao điểm đường–sông trước.",
      "Dùng ô đất mới để phân biệt góc đông nam.",
    ],
    explanation:
      "Ba loại mốc độc lập — sông, đường và ô đất mới — giúp loại trừ những mảnh có màu tương tự.",
  },
];
