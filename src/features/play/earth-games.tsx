"use client";
import { useRef, useState, useEffect, type PointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
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
export function ImageViewer({
  src,
  bounds,
  guess,
  target,
  onPlace,
}: {
  src: string;
  bounds?: { west: number; south: number; east: number; north: number };
  guess?: Coordinate | null;
  target?: Coordinate;
  onPlace?: (point: Coordinate) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [center, setCenter] = useState({ x: 500, y: 350 }),
    [hover, setHover] = useState<Coordinate | null>(null);
  const drag = useRef<{
      x: number;
      y: number;
      cx: number;
      cy: number;
      moved: boolean;
    } | null>(null),
    w = 1000 / zoom,
    h = 700 / zoom;
  function point(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    return {
      x: center.x - w / 2 + ((e.clientX - box.left) / box.width) * w,
      y: center.y - h / 2 + ((e.clientY - box.top) / box.height) * h,
    };
  }
  function geo(p: { x: number; y: number }) {
    return bounds
      ? {
          lng: bounds.west + (p.x / 1000) * (bounds.east - bounds.west),
          lat: bounds.north - (p.y / 700) * (bounds.north - bounds.south),
        }
      : null;
  }
  function marker(p: Coordinate) {
    return bounds
      ? {
          x: ((p.lng - bounds.west) / (bounds.east - bounds.west)) * 1000,
          y: ((bounds.north - p.lat) / (bounds.north - bounds.south)) * 700,
        }
      : { x: 0, y: 0 };
  }
  const showMarker = (p: Coordinate, color: string, label: string) => {
    const pixel = marker(p);
    return (
      <g transform={`translate(${pixel.x},${pixel.y})`}>
        <circle
          r={12 / zoom}
          fill={color}
          stroke="#15221b"
          strokeWidth={3 / zoom}
        />
        <path
          d={`M ${-20 / zoom} 0 H ${20 / zoom} M 0 ${-20 / zoom} V ${20 / zoom}`}
          stroke={color}
          strokeWidth={3 / zoom}
        />
        <title>{label}</title>
      </g>
    );
  };
  return (
    <div className="image-viewer">
      <svg
        style={
          bounds
            ? {
                aspectRatio:
                  (bounds.east - bounds.west) / (bounds.north - bounds.south),
              }
            : undefined
        }
        role="img"
        aria-label={
          bounds ? "Ảnh với tọa độ WGS84" : "Ảnh địa danh, có thể phóng to"
        }
        viewBox={`${center.x - w / 2} ${center.y - h / 2} ${w} ${h}`}
        preserveAspectRatio="none"
        onPointerDown={(e) => {
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            cx: center.x,
            cy: center.y,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = point(e);
          setHover(geo(p));
          if (drag.current) {
            const d = drag.current,
              box = e.currentTarget.getBoundingClientRect();
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5)
              d.moved = true;
            if (d.moved)
              setCenter({
                x: Math.max(
                  w / 2,
                  Math.min(
                    1000 - w / 2,
                    d.cx - ((e.clientX - d.x) / box.width) * w,
                  ),
                ),
                y: Math.max(
                  h / 2,
                  Math.min(
                    700 - h / 2,
                    d.cy - ((e.clientY - d.y) / box.height) * h,
                  ),
                ),
              });
          }
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const p = geo(point(e));
            if (p) onPlace?.(p);
          }
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerLeave={() => {
          if (!drag.current) setHover(null);
        }}
      >
        <image
          href={src}
          width={1000}
          height={700}
          preserveAspectRatio={bounds ? "none" : "xMidYMid meet"}
        />
        {bounds &&
          [1, 2, 3].map((i) => (
            <g key={i} opacity=".7">
              <path
                d={`M ${i * 250} 0 V 700 M 0 ${i * 175} H 1000`}
                stroke="#fff"
                strokeDasharray="5 7"
                strokeWidth={1 / zoom}
              />
              <text
                x={i * 250 + 5}
                y={22}
                fontSize={26 / zoom}
                paintOrder="stroke"
                stroke="#15221b"
                strokeWidth={3 / zoom}
                fill="#fff"
              >
                {(bounds.west + ((bounds.east - bounds.west) * i) / 4).toFixed(
                  4,
                )}
                °
              </text>
              <text
                x={6}
                y={i * 175 - 5}
                fontSize={26 / zoom}
                paintOrder="stroke"
                stroke="#15221b"
                strokeWidth={3 / zoom}
                fill="#fff"
              >
                {(
                  bounds.north -
                  ((bounds.north - bounds.south) * i) / 4
                ).toFixed(4)}
                °
              </text>
            </g>
          ))}
        {bounds && guess && showMarker(guess, "#ffb378", "Dự đoán")}
        {bounds && target && showMarker(target, "#d9f67d", "Đáp án")}
        {bounds && guess && target && (
          <line
            x1={marker(guess).x}
            y1={marker(guess).y}
            x2={marker(target).x}
            y2={marker(target).y}
            stroke="#fff"
            strokeDasharray="8 8"
            strokeWidth={2 / zoom}
          />
        )}
      </svg>
      <div className="image-tools">
        <button
          className="icon-button"
          aria-label="Thu nhỏ"
          disabled={zoom === 1}
          onClick={() => {
            const next = Math.max(1, zoom / 1.5);
            setZoom(next);
            setCenter({ x: 500, y: 350 });
          }}
        >
          <Minus size={17} />
        </button>
        <span>{zoom.toFixed(1)}×</span>
        <button
          className="icon-button"
          aria-label="Phóng to"
          disabled={zoom >= 5}
          onClick={() => setZoom(Math.min(5, zoom * 1.5))}
        >
          <Plus size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Đặt lại ảnh"
          onClick={() => {
            setZoom(1);
            setCenter({ x: 500, y: 350 });
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      {bounds && (
        <div className="map-coordinates">
          WGS84 ·{" "}
          {hover
            ? `${hover.lng.toFixed(5)}° E · ${hover.lat.toFixed(5)}° N`
            : `${bounds.west}° → ${bounds.east}° E`}
        </div>
      )}
    </div>
  );
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
    <div className="comparison">
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
        {q.image && <ImageViewer src={q.image} />}
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
