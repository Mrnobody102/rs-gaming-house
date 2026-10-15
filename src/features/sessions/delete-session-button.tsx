"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { command } from "@/shared/client/api";

export function DeleteSessionButton({
  id,
  title,
  onDeleted,
  onError,
}: {
  id: string;
  title: string;
  onDeleted?: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const router = useRouter();
  async function remove() {
    if (
      pending.current ||
      !confirm(
        `Xóa phòng “${title}”? Người chơi, lượt trả lời và điểm trong phòng sẽ bị xóa. Bộ câu hỏi và kho vẫn được giữ.`,
      )
    )
      return;
    pending.current = true;
    setBusy(true);
    onError("");
    try {
      await command("session_delete", { p_id: id });
      if (onDeleted) onDeleted();
      else router.replace("/admin/sessions/");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      className="button secondary small danger-action"
      aria-label={`Xóa phòng ${title}`}
      disabled={busy}
      onClick={remove}
    >
      <Trash2 size={16} />
      <span>{busy ? "Đang xóa…" : "Xóa phòng"}</span>
    </button>
  );
}
