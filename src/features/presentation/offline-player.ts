import type { Question } from "@/features/questions/model";

// Serialized into the standalone HTML. Keep all runtime helpers inside here.
export function runOfflinePresentation(data: {
  title: string;
  questions: Question[];
  hintPenalty: number;
}) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  document.title = data.title;
  let index = 0,
    opened = 0,
    revealed = false,
    choice = -1;
  let currentImage = "",
    requestId = 0;
  const select = el<HTMLSelectElement>("select"),
    penalty = el<HTMLInputElement>("penalty");
  penalty.checked = data.hintPenalty === 50;
  data.questions.forEach((_, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${i + 1} / ${data.questions.length}`;
    select.append(option);
  });
  function showImage(src: string) {
    const sequence = ++requestId;
    el("image-status").textContent = "";
    if (src === currentImage) return;
    const image = el<HTMLImageElement>("image"),
      previous = el<HTMLImageElement>("previous-image");
    if (!src) {
      image.hidden = previous.hidden = true;
      currentImage = "";
      return;
    }
    const next = new Image();
    next.onload = () => {
      if (sequence !== requestId) return;
      previous.hidden = !currentImage;
      previous.src = currentImage || src;
      image.src = src;
      image.hidden = false;
      el<HTMLAnchorElement>("zoom").href = src;
      if (
        currentImage &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        image.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
      currentImage = src;
      el("image-status").textContent = "";
    };
    next.onerror = () => {
      if (sequence === requestId)
        el("image-status").textContent = "Chưa tải được ảnh.";
    };
    next.src = src;
  }
  function render() {
    const q = data.questions[index];
    select.value = String(index);
    el("title").textContent = q.title;
    el("points").textContent =
      `${Math.max(0, q.points - opened * (penalty.checked ? 50 : 0))} điểm`;
    const progressive =
      !!q.image &&
      q.hintMode === "progressive" &&
      (q.kind === "place" || q.kind === "riddle");
    const stages = [
      { image: q.image, label: "Ảnh ban đầu" },
      ...q.hints
        .slice(0, opened)
        .flatMap((h, i) =>
          typeof h !== "string" && h.type === "image"
            ? [{ image: h.image, label: `Gợi ý ${i + 1}` }]
            : [],
        ),
    ];
    const selected =
      choice >= 0 && choice < stages.length ? choice : stages.length - 1;
    const answerImage = revealed
      ? q.answerImage || ("afterImage" in q ? q.afterImage : "")
      : "";
    showImage(answerImage || (progressive ? stages[selected].image : q.image));
    el("stages").replaceChildren();
    if (progressive && !answerImage)
      stages.forEach((stage, i) => {
        const button = document.createElement("button");
        button.textContent = stage.label;
        button.setAttribute("aria-pressed", String(selected === i));
        button.onclick = () => {
          choice = i;
          render();
        };
        el("stages").append(button);
      });
    el("solution").textContent = revealed
      ? ("solution" in q && q.solution) ||
        (q.kind === "choice" ? q.options[q.correct] : "") ||
        ""
      : "";
    el("explanation").textContent = revealed ? q.explanation : "";
    el("options").replaceChildren();
    if (q.kind === "choice")
      q.options.forEach((text, i) => {
        const option = document.createElement("p");
        option.textContent = `${"ABCD"[i]}. ${text}`;
        if (revealed && i === q.correct) option.style.color = "#d9f67d";
        el("options").append(option);
      });
    el("hints").replaceChildren();
    q.hints.slice(0, opened).forEach((hint, i) => {
      if (progressive && typeof hint !== "string" && hint.type === "image")
        return;
      const item = document.createElement("p");
      if (typeof hint === "string" || hint.type === "text")
        item.textContent = `${i + 1}. ${typeof hint === "string" ? hint : hint.text}`;
      else {
        const a = document.createElement("a"),
          image = document.createElement("img");
        a.href = image.src = hint.image;
        a.target = "_blank";
        a.rel = "noreferrer";
        image.alt = `Gợi ý ${i + 1}`;
        a.append(image);
        item.append(a);
      }
      el("hints").append(item);
    });
    el<HTMLButtonElement>("hint").disabled =
      revealed || opened >= q.hints.length;
    el("hint").textContent =
      `Mở gợi ý ${opened + 1}${penalty.checked ? " (−50)" : ""}`;
    el("reveal").textContent = revealed ? "Ẩn đáp án" : "Xem đáp án";
    el<HTMLButtonElement>("previous").disabled = index === 0;
    el<HTMLButtonElement>("next").disabled =
      index === data.questions.length - 1;
  }
  function move(target: number) {
    const next = Math.max(0, Math.min(data.questions.length - 1, target));
    if (next === index) return;
    index = next;
    opened = 0;
    revealed = false;
    choice = -1;
    render();
  }
  const toggle = () => {
    revealed = !revealed;
    choice = -1;
    render();
  };
  el("previous").onclick = () => move(index - 1);
  el("next").onclick = () => move(index + 1);
  select.onchange = () => move(Number(select.value));
  el("hint").onclick = () => {
    if (revealed || opened >= data.questions[index].hints.length) return;
    opened++;
    choice = -1;
    render();
  };
  el("reveal").onclick = toggle;
  penalty.onchange = render;
  el("full").onclick = () => {
    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    action.catch(() => {
      el("image-status").textContent = "Dùng F11 để mở toàn màn hình.";
    });
  };
  document.addEventListener("keydown", (event) => {
    if (
      /INPUT|SELECT|TEXTAREA|BUTTON/.test((event.target as HTMLElement).tagName)
    )
      return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(index + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(index - 1);
    }
    if (event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });
  render();
}
