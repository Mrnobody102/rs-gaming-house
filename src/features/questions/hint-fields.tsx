"use client";
import { hintSlots, readHint, type Hint } from "@/features/games/hints";
import { MediaField } from "./media-field";

export function HintFields({
  hints,
  uploading,
  onChange,
  onUpload,
}: {
  hints: Hint[];
  uploading: boolean;
  onChange: (hints: Hint[]) => void;
  onUpload: (index: number, file?: File) => void;
}) {
  const slots = hintSlots(hints);
  function update(index: number, value: Hint) {
    onChange(slots.map((hint, i) => (i === index ? value : hint)));
  }
  return (
    <fieldset className="hint-fields">
      <legend>
        Gợi ý <small>Tùy chọn · MC mở lần lượt</small>
      </legend>
      {slots.map((value, i) => {
        const hint = readHint(value);
        return (
          <div className="hint-field" key={i}>
            <div className="hint-field-heading">
              <span>Gợi ý {i + 1}</span>
              <select
                aria-label={`Loại gợi ý ${i + 1}`}
                value={hint.type}
                disabled={uploading}
                onChange={(e) =>
                  update(
                    i,
                    e.target.value === "image"
                      ? { type: "image", image: "" }
                      : { type: "text", text: "" },
                  )
                }
              >
                <option value="text">Chữ</option>
                <option value="image">Ảnh</option>
              </select>
            </div>
            {hint.type === "text" ? (
              <textarea
                aria-label={`Nội dung gợi ý ${i + 1}`}
                rows={2}
                maxLength={220}
                value={hint.text}
                placeholder="Nhập gợi ý…"
                onChange={(e) =>
                  update(i, { type: "text", text: e.target.value })
                }
              />
            ) : (
              <MediaField
                label={`Ảnh gợi ý ${i + 1}`}
                value={hint.image}
                busy={uploading}
                onChange={(image) => update(i, { type: "image", image })}
                onUpload={(file) => onUpload(i, file)}
              />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
