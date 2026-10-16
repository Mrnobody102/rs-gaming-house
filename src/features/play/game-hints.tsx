"use client";
import { useEffect, useRef } from "react";
import { readHint, type Hint } from "@/features/games/hints";

export function GameHints({
  hints,
  hideImages = false,
  follow = true,
}: {
  hints: Hint[];
  hideImages?: boolean;
  follow?: boolean;
}) {
  const lastVisible = hints.findLastIndex(
    (value) => !hideImages || readHint(value).type === "text",
  );
  const latest = useRef<HTMLLIElement>(null);
  function showLatest() {
    if (!follow) return;
    const item = latest.current,
      stage = item?.closest<HTMLElement>(".question-stage");
    if (!item || !stage) return;
    const delta =
      item.getBoundingClientRect().bottom -
      stage.getBoundingClientRect().bottom +
      16;
    if (delta > 0)
      stage.scrollBy({
        top: delta,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  useEffect(showLatest, [lastVisible, follow]);
  if (lastVisible < 0) return null;
  return (
    <ol className="game-hints" aria-label="Gợi ý đã mở">
      {hints.map((value, i) => {
        const hint = readHint(value);
        if (hideImages && hint.type === "image") return null;
        return (
          <li key={i} ref={i === lastVisible ? latest : undefined}>
            <span className="hint-number">{i + 1}</span>
            {hint.type === "text" ? (
              <span>{hint.text}</span>
            ) : (
              <a
                className="hint-image-link"
                href={hint.image}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={hint.image}
                  alt={`Gợi ý ${i + 1}`}
                  loading="eager"
                  onLoad={i === lastVisible ? showLatest : undefined}
                />
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}
