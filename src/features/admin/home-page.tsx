"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, BookOpen, Play, Layers } from "lucide-react";
import { command } from "@/shared/client/api";
import type { Question } from "@/features/questions/model";
import type { SessionSummary } from "@/features/sessions/model";
import { ErrorMessage } from "@/shared/ui/status";
export function AdminHome() {
  const [questions, setQuestions] = useState<Question[]>([]),
    [rooms, setRooms] = useState<SessionSummary[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const router = useRouter();
  useEffect(() => {
    Promise.all([
      command<Question[]>("bank_list"),
      command<SessionSummary[]>("session_list"),
    ])
      .then(([q, s]) => {
        setQuestions(q);
        setRooms(s);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function quickRoom() {
    setBusy(true);
    setError("");
    try {
      const ids = questions.slice(0, 4).map((q) => q.id);
      const room = await command<{ id: string }>("session_create", {
        title: "Vòng khởi động",
        capacity: 60,
        questionIds: ids,
      });
      router.push(`/admin/sessions/${room.id}/`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Chuẩn bị chơi</h1>
          <p className="muted">
            {loaded
              ? `${questions.length} câu hỏi · ${rooms.length} phòng`
              : "Đang tải nội dung…"}
          </p>
        </div>
        <Link className="button primary" href="/admin/sessions/new/">
          <Plus size={18} /> Tạo phòng
        </Link>
      </div>
      <ErrorMessage message={error} />
      <div className="admin-home-grid">
        <Link className="panel home-content-link" href="/admin/sets/">
          <Layers size={28} />
          <h2>Bộ câu hỏi</h2>
          <p>Chuẩn bị câu, thứ tự và ngôi sao cho mỗi phiên.</p>
          <span className="text-link">
            Quản lý bộ câu hỏi <ArrowRight size={16} />
          </span>
        </Link>
        <section className="panel quick-room">
          <Play size={29} />
          <h2>Chơi thử một vòng</h2>
          <p>Đoán trực tiếp, có mã phòng và QR.</p>
          <button
            className="button primary"
            disabled={busy || !questions.length}
            onClick={quickRoom}
          >
            {busy ? "Đang tạo…" : "Tạo phòng chơi thử"}
            <ArrowRight size={17} />
          </button>
        </section>
        <Link className="panel home-content-link" href="/admin/questions/">
          <BookOpen size={28} />
          <h2>Kho câu hỏi</h2>
          <p>Soạn nội dung, ảnh và mức độ khó.</p>
          <span className="text-link">
            Mở kho câu hỏi <ArrowRight size={16} />
          </span>
        </Link>
      </div>
      <div className="home-section-heading">
        <h2>Phòng đã tạo</h2>
        <Link className="text-link" href="/admin/sessions/">
          Xem tất cả <ArrowRight size={15} />
        </Link>
      </div>
      {rooms.length ? (
        <div className="session-list">
          {rooms.slice(0, 5).map((s) => (
            <Link
              className="session-row"
              key={s.id}
              href={`/admin/sessions/${s.id}/`}
            >
              <div className="session-code">{s.code}</div>
              <div className="session-name">
                <h2>{s.title}</h2>
                <p>
                  {s.total} câu · {s.capacity} người tối đa
                </p>
              </div>
              <ArrowRight size={19} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted">Tạo phòng để lấy mã và QR cho người chơi.</p>
      )}
    </>
  );
}
