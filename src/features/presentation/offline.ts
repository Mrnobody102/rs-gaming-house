import type { Question } from "@/features/questions/model";
import { APP_NAME } from "@/shared/brand";
import { runOfflinePresentation } from "./offline-player";

export async function embedImages(questions: Question[]) {
  const urls = new Set<string>();
  for (const q of questions) {
    for (const value of [
      q.image,
      q.answerImage,
      "afterImage" in q ? q.afterImage : "",
    ])
      if (value) urls.add(value);
    for (const h of q.hints)
      if (typeof h !== "string" && h.type === "image") urls.add(h.image);
  }
  const images = new Map(
    await Promise.all(
      [...urls].map(async (url) => {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error("Không tải được ảnh. Thử lại khi có mạng.");
        const blob = await response.blob();
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return [url, data] as const;
      }),
    ),
  );
  return questions.map((q) => ({
    ...q,
    image: images.get(q.image) || q.image,
    answerImage: images.get(q.answerImage || "") || q.answerImage,
    ...("afterImage" in q
      ? { afterImage: images.get(q.afterImage) || q.afterImage }
      : {}),
    hints: q.hints.map((h) =>
      typeof h !== "string" && h.type === "image"
        ? { ...h, image: images.get(h.image)! }
        : h,
    ),
  })) as Question[];
}

// A single file, including images. No CDN, app server or player connection needed.
export function presentationHtml(
  title: string,
  questions: Question[],
  hintPenalty: number,
) {
  const data = JSON.stringify({ title, questions, hintPenalty }).replace(
    /</g,
    "\\u003c",
  );
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${APP_NAME}</title>
<style>
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:#182820;color:#faf5df;font:20px Arial,sans-serif}
header,footer{padding:14px 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header{border-bottom:1px solid #ffffff26}header span{margin-right:auto}
main{text-align:center;max-width:1800px;margin:auto;padding:12px 24px}
h1{font-size:clamp(22px,3vw,38px);margin:10px}
#zoom{display:block;width:100%}.offline-image{position:relative}
#image{display:block;width:100%;height:60vh;object-fit:contain}
#previous-image{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
button,select{font:inherit;border:1px solid #ffffff60;border-radius:8px;padding:10px 16px;background:#344a3b;color:inherit;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
footer{justify-content:center;position:sticky;bottom:0;background:#182820}
#solution{font-size:32px;color:#d9f67d}
#hints{max-width:1400px;margin:auto;font-size:clamp(24px,2.4vw,40px);line-height:1.5}
#hints img{width:100%;height:58vh;object-fit:contain}
#explanation{max-width:1100px;margin:16px auto;line-height:1.5}
#options,#stages{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
#stages{margin-top:12px}#stages:empty{display:none}
#stages button[aria-pressed=true]{border-color:#d9f67d;background:#d9f67d20;color:#d9f67d}
#points{color:#d9f67d;font-size:17px}a{color:inherit}
#image-status{color:#f4ac90}
@media(max-width:680px){header,footer{padding:12px}main{padding:12px}#hints img{height:auto;max-height:65vh}#image{height:48vh}}
</style>
<header><span>${APP_NAME} · Chỉ trình chiếu</span><select id="select" aria-label="Chọn câu hỏi"></select><button id="full">Toàn màn hình</button></header>
<main><p id="points"></p><h1 id="title"></h1><a id="zoom" target="_blank" rel="noreferrer"><div class="offline-image"><img id="previous-image" alt="" hidden><img id="image" alt="Ảnh câu hỏi"></div></a><nav id="stages" aria-label="Ảnh đã mở"></nav><p id="image-status" role="status"></p><div id="options"></div><div id="hints"></div><p id="solution"></p><p id="explanation"></p></main>
<footer><button id="previous">Câu trước</button><button id="hint">Mở gợi ý</button><button id="reveal">Xem đáp án</button><button id="next">Câu tiếp theo</button><label><input id="penalty" type="checkbox"> Mỗi gợi ý −50 điểm</label></footer>
<script>(${runOfflinePresentation.toString()})(${data});</script></html>`;
}
