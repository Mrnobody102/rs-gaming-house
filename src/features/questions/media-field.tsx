"use client";
import { Upload, X } from "lucide-react";

export function MediaField({
  label,
  value,
  busy,
  onChange,
  onUpload,
}: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (url: string) => void;
  onUpload: (file?: File) => void;
}) {
  return (
    <div className="question-media">
      <span className="field-label">{label}</span>
      {value ? (
        <div className="uploaded-image">
          <img src={value} alt={label} />
          <button
            type="button"
            className="icon-button"
            aria-label={`Bỏ ${label.toLowerCase()}`}
            onClick={() => onChange("")}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label className="upload-zone">
          <Upload size={24} />
          <strong>{busy ? "Đang tải…" : "Chọn ảnh"}</strong>
          <span>PNG, JPG, WebP · tối đa 8 MB</span>
          <input
            aria-label={`Tải ${label.toLowerCase()}`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => {
              onUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      <details className="media-url">
        <summary>Dùng link ảnh</summary>
        <input
          aria-label={`Link ${label.toLowerCase()}`}
          type="url"
          placeholder="https://…"
          value={value.startsWith("https://") ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </details>
    </div>
  );
}
