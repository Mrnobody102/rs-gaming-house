import type { Question } from "@/features/questions/model";

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
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EARTH//PLAY</title>
<style>*{box-sizing:border-box}body{margin:0;background:#182820;color:#faf5df;font:20px Arial,sans-serif}header,footer{padding:14px 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}header{border-bottom:1px solid #ffffff26}header span{margin-right:auto}main{text-align:center;max-width:1800px;margin:auto;padding:12px 24px}h1{font-size:clamp(22px,3vw,38px);margin:10px}#image{max-width:100%;max-height:64vh;object-fit:contain}button,select{font:inherit;border:1px solid #ffffff60;border-radius:8px;padding:10px;background:#344a3b;color:inherit;cursor:pointer}button:disabled{opacity:.4;cursor:default}footer{justify-content:center;position:sticky;bottom:0;background:#182820}#solution{font-size:28px;color:#d9f67d}#hints{display:flex;flex-wrap:wrap;gap:20px;justify-content:center}#hints img{max-width:360px;max-height:220px}#explanation{max-width:1100px;margin:16px auto;line-height:1.5}#options{display:flex;gap:24px;justify-content:center;flex-wrap:wrap}#points{color:#d9f67d;font-size:17px}a{color:inherit}</style>
<header><span>EARTH//PLAY · Chỉ trình chiếu</span><select id="select" aria-label="Chọn câu hỏi"></select><button id="full">Toàn màn hình</button></header>
<main><p id="points"></p><h1 id="title"></h1><a id="zoom" target="_blank"><img id="image" alt="Ảnh câu hỏi"></a><div id="options"></div><div id="hints"></div><p id="solution"></p><p id="explanation"></p></main>
<footer><button id="previous">Câu trước</button><button id="hint">Mở gợi ý</button><button id="reveal">Xem đáp án</button><button id="next">Câu tiếp theo</button><label><input id="penalty" type="checkbox"> Mỗi gợi ý −50 điểm</label></footer>
<script>const data=${data};document.title=data.title;let index=0,opened=0,revealed=false;const el=id=>document.getElementById(id);el('penalty').checked=data.hintPenalty===50;data.questions.forEach((q,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+' / '+data.questions.length;el('select').append(o)});
function render(){const q=data.questions[index];el('select').value=index;el('title').textContent=q.title;el('points').textContent=Math.max(0,q.points-opened*(el('penalty').checked?50:0))+' điểm';const image=revealed&&(q.answerImage||q.afterImage)||q.image;el('image').src=image;el('image').hidden=!image;el('zoom').href=image;el('solution').textContent=revealed?(q.solution||(q.kind==='choice'?q.options[q.correct]:'')||''):'';el('explanation').textContent=revealed?q.explanation:'';el('options').replaceChildren();if(q.kind==='choice')q.options.forEach((text,i)=>{const p=document.createElement('p');p.textContent='ABCD'[i]+'. '+text;if(revealed&&i===q.correct)p.style.color='#d9f67d';el('options').append(p)});el('hints').replaceChildren();q.hints.slice(0,opened).forEach((h,i)=>{const p=document.createElement('p');if(typeof h==='string')p.textContent=(i+1)+'. '+h;else if(h.type==='text')p.textContent=(i+1)+'. '+h.text;else{const a=document.createElement('a');a.href=h.image;a.target='_blank';const img=document.createElement('img');img.src=h.image;img.alt='Gợi ý '+(i+1);a.append(img);p.append(a)}el('hints').append(p)});el('hint').disabled=revealed||opened>=q.hints.length;el('hint').textContent='Mở gợi ý '+(opened+1)+(el('penalty').checked?' (−50)':'');el('reveal').textContent=revealed?'Ẩn đáp án':'Xem đáp án';el('previous').disabled=index===0;el('next').disabled=index===data.questions.length-1}
function move(i){index=Math.max(0,Math.min(data.questions.length-1,i));opened=0;revealed=false;render()}el('previous').onclick=()=>move(index-1);el('next').onclick=()=>move(index+1);el('select').onchange=e=>move(Number(e.target.value));el('hint').onclick=()=>{if(opened<data.questions[index].hints.length)opened++;render()};el('reveal').onclick=()=>{revealed=!revealed;render()};el('penalty').onchange=render;el('full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen()};document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.key==='ArrowRight')move(index+1);if(e.key==='ArrowLeft')move(index-1);if(e.key===' '){e.preventDefault();revealed=!revealed;render()}});render();</script></html>`;
}
