import { questionSchema, type Question } from "@/features/questions/model";

// One entry per question, rather than per slide. Slides 6–7, 10, 12 and 14
// belong to the preceding question. Hidden question slides are retained too.
const asset = (name: string) => `/workshop/${name}.webp`;
function question(
  slide: number,
  difficulty: "easy" | "medium" | "hard",
  title: string,
  image: string,
  solution: string,
  hints: Question["hints"] = [],
  answerImage?: string,
  kind: "riddle" | "place" | "locate" = "place",
): Question {
  return questionSchema.parse({
    id: `b1a76c21-713c-4d54-8c65-0000000000${String(slide).padStart(2, "0")}`,
    kind,
    title,
    image: asset(image),
    solution,
    hints,
    answerImage: answerImage ? asset(answerImage) : undefined,
    difficulty,
    points: { easy: 200, medium: 300, hard: 400 }[difficulty],
    seconds: 120,
    explanation: "",
    tags: ["Workshop", `Slide ${slide}`],
  });
}
export const workshopQuestions: Question[] = [
  question(
    1,
    "easy",
    "Rừng ngập mặn Cần Giờ nằm ở những ô nào?",
    "slide-01",
    "Vùng rừng ngập mặn ven biển, chủ yếu ở ô 10 và 14.",
    [],
    undefined,
    "locate",
  ),
  question(2, "easy", "Đây là đảo nào?", "image-2", "Đảo Lý Sơn.", [
    "Nổi tiếng với những bãi biển trong xanh.",
    "Có dấu tích núi lửa.",
    "Đặc sản nổi tiếng là tỏi.",
  ]),
  question(
    3,
    "easy",
    "Đây là thành phố nào?",
    "image-3",
    "Barcelona, Tây Ban Nha.",
    [
      "Một thành phố có lịch sử lâu đời.",
      "Nổi tiếng với bóng đá.",
      "Lionel Messi từng gắn bó với câu lạc bộ của thành phố này.",
    ],
  ),
  question(4, "medium", "Đây là thành phố nào?", "image-4", "Tây Ninh.", [
    "Nằm ở miền Nam Việt Nam.",
    "Tỉnh này giáp Campuchia.",
    "Nổi tiếng với muối tôm.",
  ]),
  question(
    5,
    "medium",
    "Đây là sân vận động nào?",
    "image-5",
    "Sân vận động Quốc gia Mỹ Đình, Hà Nội.",
    [
      { type: "image", image: asset("image-6") },
      { type: "image", image: asset("image-7") },
    ],
  ),
  question(
    8,
    "medium",
    "Địa điểm trong khung vàng là gì?",
    "slide-08",
    "Văn Miếu – Quốc Tử Giám, Hà Nội.",
    [
      "Học sinh, sinh viên thường đến đây cầu may trong thi cử.",
      "Nằm ở Hà Nội.",
      "Gắn với trường đại học đầu tiên của Việt Nam.",
    ],
  ),
  question(
    9,
    "hard",
    "Ảnh này chụp thành phố nào?",
    "image-9",
    "Huế; có thể nhận ra Kinh thành và dòng sông Hương.",
    [
      "Đây là một thành phố ở Việt Nam.",
      { type: "image", image: asset("image-17") },
    ],
    "image-10",
  ),
  {
    ...question(
      11,
      "hard",
      "Trên ảnh Vinhomes Ocean Park 1 năm 2018, vị trí xây tòa TechnoPark nằm ở ô nào?",
      "slide-11",
      "Ô 16.",
      [],
      "image-12",
      "locate",
    ),
    explanation:
      "Ảnh câu hỏi chụp năm 2018, trước khi xây tòa TechnoPark. Ảnh đáp án là khu vực ở thời điểm hiện tại.",
  },
  question(
    13,
    "hard",
    "Ghi chép thực địa này tương ứng với ảnh A, B hay C?",
    "field-notes",
    "Ảnh A.",
    [],
    undefined,
    "riddle",
  ),
  question(15, "medium", "Đây là hồ nào?", "image-18", "Hồ Ba Bể."),
  question(16, "medium", "Đây là thành phố nào?", "image-19", "Huế."),
  question(
    17,
    "medium",
    "Địa điểm trong khung vàng là gì?",
    "slide-17",
    "Thành cổ Quảng Trị.",
  ),
];

export const workshopSet = {
  id: "b1a76c21-713c-4d54-8c65-000000000100",
  title: "Workshop · Quan sát Trái Đất",
  questionIds: workshopQuestions.map((q) => q.id),
  starQuestionIds: [] as string[],
  reserveQuestionIds: [] as string[],
};
