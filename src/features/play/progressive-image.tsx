"use client";
import { useEffect, useState } from "react";
import { readHint, type Hint } from "@/features/games/hints";
import { ImageViewer } from "./image-viewer";

// Only opened hints reach this component. Unopened image URLs stay on the server.
export function ProgressiveImage({
  image,
  hints,
}: {
  image: string;
  hints: Hint[];
}) {
  const stages = [
    { image, label: "Ảnh ban đầu" },
    ...hints.flatMap((value, i) => {
      const hint = readHint(value);
      return hint.type === "image"
        ? [{ image: hint.image, label: `Gợi ý ${i + 1}` }]
        : [];
    }),
  ];
  const latest = stages.length - 1;
  const [choice, setChoice] = useState({ latest, index: latest });
  const selectedIndex =
    choice.latest === latest && choice.index <= latest ? choice.index : latest;
  const selected = stages[selectedIndex].image;
  const [frame, setFrame] = useState({ image, previous: "" });
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (selected === frame.image) {
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    const next = new Image();
    setLoading(true);
    setError(false);
    next.onload = () => {
      if (cancelled) return;
      setFrame((old) => ({ image: selected, previous: old.image }));
      setLoading(false);
    };
    next.onerror = () => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    };
    next.src = selected;
    return () => {
      cancelled = true;
    };
  }, [selected, attempt, frame.image]);
  return (
    <div className="progressive-image">
      <ImageViewer src={frame.image} previousSrc={frame.previous} />
      <nav className="image-stages" aria-label="Ảnh đã mở">
        {stages.map((stage, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={selectedIndex === i}
            onClick={() => setChoice({ latest, index: i })}
          >
            {stage.label}
          </button>
        ))}
      </nav>
      <div className="image-stage-status" role="status">
        {loading && "Đang tải ảnh…"}
        {error && (
          <>
            Chưa tải được ảnh.{" "}
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Thử lại
            </button>
          </>
        )}
      </div>
    </div>
  );
}
