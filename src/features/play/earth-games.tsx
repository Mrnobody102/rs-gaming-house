"use client";
import { useState, useEffect, type CSSProperties } from "react";
import { ImageViewer } from "./image-viewer";
export { ImageViewer } from "./image-viewer";
import { usesProgressiveHints } from "@/features/games/hints";
import { ProgressiveImage } from "./progressive-image";
import type {
  Coordinate,
  PublicQuestion,
  Region,
} from "@/features/questions/model";
type EarthQuestion = Exclude<PublicQuestion, { kind: "choice" | "puzzle" }>;
export function distanceMeters(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad,
    h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function CompareImages({
  before,
  after,
  beforeLabel = "Trước",
  afterLabel = "Sau",
  regions = [],
  onMark,
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  regions?: Region[];
  onMark?: (x: number, y: number) => void;
}) {
  const [split, setSplit] = useState(50),
    [ratio, setRatio] = useState(10 / 7);
  return (
    <div
      className="comparison"
      style={{ "--image-ratio": ratio } as CSSProperties}
    >
      <div
        className="comparison-images"
        style={{ aspectRatio: ratio }}
        onClick={(e) => {
          if (!onMark) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onMark(
            ((e.clientX - rect.left) / rect.width) * 100,
            ((e.clientY - rect.top) / rect.height) * 100,
          );
        }}
      >
        <img
          src={before}
          alt={beforeLabel}
          onLoad={(e) =>
            setRatio(
              e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
            )
          }
        />
        <img
          className="comparison-after"
          src={after}
          alt={afterLabel}
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
        />
        <span className="comparison-line" style={{ left: `${split}%` }} />
        <span className="image-date before">{beforeLabel}</span>
        <span className="image-date after">{afterLabel}</span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label="Vùng biến động"
        >
          {regions.map((r, i) => (
            <g key={i}>
              <circle
                cx={r.x}
                cy={r.y}
                r={r.radius}
                fill="#d9f67d25"
                stroke="#d9f67d"
                strokeWidth=".6"
              />
              <text
                x={r.x}
                y={r.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize="4"
                stroke="#182820"
                strokeWidth=".6"
                paintOrder="stroke"
              >
                {i + 1}
              </text>
              <title>{r.label}</title>
            </g>
          ))}
        </svg>
      </div>
      <label className="comparison-slider">
        <span>{beforeLabel}</span>
        <input
          aria-label="So sánh trước và sau"
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
        />
        <span>{afterLabel}</span>
      </label>
      <button
        className="mc-text-button"
        type="button"
        onClick={() => setSplit(split > 0 ? 0 : 100)}
      >
        Chuyển ảnh nhanh
      </button>
    </div>
  );
}
export function EarthStage({
  question: q,
  reveal,
  interactive,
  roundId,
  guess,
  onGuess,
}: {
  question: EarthQuestion;
  reveal: boolean;
  interactive: boolean;
  roundId: string;
  guess?: Coordinate | null;
  onGuess?: (point: Coordinate) => void;
}) {
  if (reveal && q.answerImage)
    return (
      <div className="earth-stage">
        <ImageViewer key={q.answerImage} src={q.answerImage} />
        {q.solution && <p className="place-solution">{q.solution}</p>}
      </div>
    );
  if (usesProgressiveHints(q))
    return (
      <div className="earth-stage">
        <ProgressiveImage key={roundId} image={q.image} hints={q.hints} />
        {reveal && q.solution && <p className="place-solution">{q.solution}</p>}
      </div>
    );
  return (
    <EarthRound
      key={roundId}
      q={q}
      reveal={reveal}
      interactive={interactive}
      serverGuess={guess}
      onGuess={onGuess}
    />
  );
}
function EarthRound({
  q,
  reveal,
  interactive,
  serverGuess,
  onGuess,
}: {
  q: EarthQuestion;
  reveal: boolean;
  interactive: boolean;
  serverGuess?: Coordinate | null;
  onGuess?: (point: Coordinate) => void;
}) {
  const [guess, setGuess] = useState<Coordinate | null>(serverGuess || null),
    [past, setPast] = useState(false),
    [mark, setMark] = useState<Region | null>(null);
  useEffect(() => {
    if (!interactive) setGuess(serverGuess || null);
  }, [serverGuess, interactive]);
  if (q.kind === "riddle")
    return (
      <div className="earth-stage riddle-stage">
        {(q.image || (reveal && q.answerImage)) && (
          <ImageViewer
            key={reveal && q.answerImage ? q.answerImage : q.image}
            src={reveal && q.answerImage ? q.answerImage : q.image}
          />
        )}
        {reveal && <p className="place-solution">{q.solution}</p>}
      </div>
    );
  if (q.kind === "place")
    return (
      <div className="earth-stage">
        <ImageViewer src={q.image} />
        {reveal && <p className="place-solution">{q.solution}</p>}
      </div>
    );
  if (q.kind === "change")
    return (
      <div className="earth-stage">
        {q.afterImage ? (
          <CompareImages
            before={q.image}
            after={q.afterImage}
            beforeLabel={q.beforeLabel}
            afterLabel={q.afterLabel}
            regions={reveal ? q.regions || [] : mark ? [mark] : []}
            onMark={
              !reveal && interactive
                ? (x, y) => setMark({ x, y, radius: 6, label: "Vùng nghi vấn" })
                : undefined
            }
          />
        ) : (
          <ImageViewer src={q.image} />
        )}
        {reveal && q.solution && <p className="place-solution">{q.solution}</p>}
        {reveal && !q.solution && (
          <ul className="change-findings">
            {q.regions?.map((r, i) => (
              <li key={i}>
                <b>{i + 1}</b>
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  const bounds = q.bounds;
  const error = guess && q.target ? distanceMeters(guess, q.target) : null;
  return (
    <div className="earth-stage locate-stage">
      <ImageViewer
        src={reveal && q.afterImage && !past ? q.afterImage : q.image}
        bounds={bounds}
        guess={guess}
        target={reveal ? q.target : undefined}
        onPlace={
          interactive && !reveal
            ? (point) => {
                setGuess(point);
                onGuess?.(point);
              }
            : undefined
        }
      />
      {bounds && interactive && !reveal && (
        <div className="coordinate-entry">
          <label>
            Kinh độ
            <input
              aria-label="Kinh độ dự đoán"
              type="number"
              step="0.00001"
              min={bounds.west}
              max={bounds.east}
              value={guess?.lng ?? ""}
              placeholder={`${bounds.west}…`}
              onChange={(e) => {
                if (e.target.value !== "")
                  setGuess({
                    lng: Number(e.target.value),
                    lat: guess?.lat ?? (bounds.south + bounds.north) / 2,
                  });
              }}
            />
          </label>
          <label>
            Vĩ độ
            <input
              aria-label="Vĩ độ dự đoán"
              type="number"
              step="0.00001"
              min={bounds.south}
              max={bounds.north}
              value={guess?.lat ?? ""}
              placeholder={`${bounds.south}…`}
              onChange={(e) => {
                if (e.target.value !== "")
                  setGuess({
                    lat: Number(e.target.value),
                    lng: guess?.lng ?? (bounds.west + bounds.east) / 2,
                  });
              }}
            />
          </label>
          <button
            className="button secondary small"
            disabled={!guess}
            onClick={() => {
              if (guess) onGuess?.(guess);
            }}
          >
            Đặt vị trí
          </button>
        </div>
      )}
      {bounds && !reveal && interactive && (
        <p className="map-help">Bấm lên ảnh hoặc nhập tọa độ dự đoán.</p>
      )}
      {reveal && (
        <div className="location-reveal">
          {q.solution && <p className="place-solution">{q.solution}</p>}
          {!q.solution && q.target && (
            <strong>
              {q.target?.lng.toFixed(5)}° E · {q.target?.lat.toFixed(5)}° N
            </strong>
          )}
          {error !== null && (
            <span>
              Sai số {Math.round(error)} m ·{" "}
              {error <= q.tolerance ? "Trong dung sai" : "Ngoài dung sai"}{" "}
              {q.tolerance} m
            </span>
          )}
          {q.afterImage && (
            <button
              className="button secondary small"
              onClick={() => setPast(!past)}
            >
              {past ? "Xem hiện tại" : "Xem quá khứ"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
