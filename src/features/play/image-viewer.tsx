"use client";
import { useRef, useState, type PointerEvent, type CSSProperties } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Coordinate } from "@/features/questions/model";
export function ImageViewer({
  src,
  previousSrc,
  bounds,
  guess,
  target,
  onPlace,
}: {
  src: string;
  previousSrc?: string;
  bounds?: { west: number; south: number; east: number; north: number };
  guess?: Coordinate | null;
  target?: Coordinate;
  onPlace?: (point: Coordinate) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [ratio, setRatio] = useState(10 / 7),
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
    <div
      className="image-viewer"
      style={
        {
          "--image-ratio": bounds
            ? (bounds.east - bounds.west) / (bounds.north - bounds.south)
            : ratio,
        } as CSSProperties
      }
    >
      <svg
        style={
          bounds
            ? {
                aspectRatio:
                  (bounds.east - bounds.west) / (bounds.north - bounds.south),
              }
            : { aspectRatio: ratio }
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
        {previousSrc && (
          <image
            href={previousSrc}
            width={1000}
            height={700}
            preserveAspectRatio="none"
          />
        )}
        <image
          key={src}
          className={previousSrc ? "image-reveal" : undefined}
          href={src}
          width={1000}
          height={700}
          preserveAspectRatio="none"
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
      {!bounds && (
        <img
          src={src}
          alt=""
          hidden
          onLoad={(e) =>
            setRatio(
              e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
            )
          }
        />
      )}
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
