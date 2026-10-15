import type { Question } from "@/features/questions/model";
import { starterBase, scenes } from "./shared";
const bounds = { west: 105.8, south: 21, east: 105.82, north: 21.0133333333 };
function target(x: number, y: number) {
  return {
    lng: bounds.west + (x / 1200) * (bounds.east - bounds.west),
    lat: bounds.north - (y / 800) * (bounds.north - bounds.south),
  };
}
export const locateQuestions: Question[] = [
  {
    ...starterBase(1204, "easy"),
    kind: "locate",
    solution: "",
    image: scenes.farm + "-before.svg",
    afterImage: scenes.farm + "-after.svg",
    bounds,
    target: target(350, 250),
    tolerance: 200,
    title: "Tìm khu nhà mới phía tây con sông",
    hints: [
      "Khu nhà nằm trong ô đất phía tây sông.",
      "Tâm khu nhà gần kinh độ 105,80583° E, vĩ độ 21,00917° N.",
    ],
    explanation:
      "Ảnh mô phỏng: dùng sông và ô đất làm mốc. Công trình mới nằm tại tâm sân hình chữ nhật phía tây sông.",
  },
  {
    ...starterBase(1205, "medium"),
    kind: "locate",
    solution: "",
    image: scenes.forest + "-before.svg",
    afterImage: scenes.forest + "-after.svg",
    bounds,
    target: target(850, 570),
    tolerance: 120,
    title: "Định vị trạm mới bằng đường và dòng sông",
    hints: [
      "Trạm nằm phía đông sông và phía nam tuyến đường ngang.",
      "Từ giao điểm đường–sông, đi khoảng 450 m về đông và 300 m về nam.",
    ],
    explanation:
      "Ảnh mô phỏng. Điểm nằm gần tâm ô đất mới, phía đông nam giao điểm đường và sông.",
  },
  {
    ...starterBase(1206, "hard"),
    kind: "locate",
    solution: "",
    image: scenes.port + "-before.svg",
    afterImage: scenes.port + "-after.svg",
    bounds,
    target: target(790, 520),
    tolerance: 80,
    title: "Tìm nhà điều hành cảng khi công trình chưa xuất hiện",
    hints: [
      "Vị trí nằm trên đất liền, phía tây đầu cầu tàu mới ở nửa dưới ảnh.",
      "Kinh độ gần 105,81317° E; so với đường ngang ở y=400, điểm nằm về phía nam khoảng 220 m.",
    ],
    explanation:
      "Ảnh mô phỏng: nhà điều hành mới nằm cạnh sân cảng phía nam. Reveal cho phép đối chiếu công trình và khoảng cách dự đoán.",
  },
];
