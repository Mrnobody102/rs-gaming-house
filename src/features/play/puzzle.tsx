"use client";
import { useState, useEffect } from "react";
export function shuffledTiles(roundId: string, grid: number) {
  const list = Array.from({ length: grid * grid }, (_, i) => i);
  let seed = Array.from(roundId).reduce(
    (n, c) => (n * 31 + c.charCodeAt(0)) >>> 0,
    2166136261,
  );
  for (let i = list.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  if (list.every((v, i) => v === i)) [list[0], list[1]] = [list[1], list[0]];
  return list;
}
export function Puzzle({
  image,
  grid,
  roundId,
  disabled,
  onChange,
  result = false,
  value,
}: {
  image: string;
  grid: number;
  roundId: string;
  disabled?: boolean;
  onChange?: (tiles: number[]) => void;
  result?: boolean;
  value?: number[];
}) {
  const [tiles, setTiles] = useState(() => shuffledTiles(roundId, grid)),
    [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`puzzle:${roundId}`) || "null",
      );
      if (
        Array.isArray(saved) &&
        saved.length === grid * grid &&
        new Set(saved).size === saved.length &&
        saved.every((t) => Number.isInteger(t) && t >= 0 && t < grid * grid)
      )
        setTiles(saved);
    } catch {}
  }, [roundId, grid]);
  useEffect(() => {
    onChange?.(tiles);
  }, [tiles, onChange]);
  const shown = result
    ? Array.from({ length: grid * grid }, (_, i) => i)
    : value || tiles;
  function pick(i: number) {
    if (disabled || result) return;
    if (selected === null) {
      setSelected(i);
      return;
    }
    const next = [...shown];
    [next[selected], next[i]] = [next[i], next[selected]];
    setTiles(next);
    setSelected(null);
    try {
      sessionStorage.setItem(`puzzle:${roundId}`, JSON.stringify(next));
    } catch {}
  }
  return (
    <div
      className={`puzzle-board ${result ? "solved" : ""}`}
      style={{ gridTemplateColumns: `repeat(${grid},1fr)` }}
    >
      {shown.map((tile, i) => (
        <button
          type="button"
          className={selected === i ? "picked" : ""}
          key={i}
          aria-label={`Mảnh ${i + 1}`}
          aria-pressed={selected === i}
          disabled={disabled || result}
          onClick={() => pick(i)}
          style={{
            backgroundImage: `url(${JSON.stringify(image)})`,
            backgroundSize: `${grid * 100}% ${grid * 100}%`,
            backgroundPosition: `${((tile % grid) / (grid - 1)) * 100}% ${(Math.floor(tile / grid) / (grid - 1)) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
