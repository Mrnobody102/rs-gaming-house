import { Crown, Trophy } from "lucide-react";
import type { Standing } from "@/features/sessions/model";

export function Ranking({
  standings,
  myId,
  finished,
  pending = false,
  controls,
}: {
  standings: Standing[];
  myId: string | null;
  finished: boolean;
  pending?: boolean;
  controls?: React.ReactNode;
}) {
  const slots = Array.from(
    { length: Math.min(3, standings.length) },
    (_, i) => i + 1,
  );
  return (
    <main className="scoreboard">
      <Trophy className="trophy" size={35} />
      <h1>{finished ? "Kết quả" : "Bảng điểm"}</h1>
      {pending && (
        <p className="tie-notice">
          Đồng điểm ở top 3 · Chơi câu dự bị để phân hạng
        </p>
      )}
      {controls}
      {finished && !pending && slots.length > 0 && (
        <p className="podium-caption">
          {slots.length === 3
            ? "Top 3 nhận quà"
            : `${slots.length} người dẫn đầu`}
        </p>
      )}
      <div className="podium" aria-label="Top 3 người chơi">
        {slots.map((rank) => {
          const p = standings.find((p) => p.rank === rank && !p.tied);
          return (
            <article
              className={`podium-place place-${rank} ${p?.id === myId ? "is-me" : ""}`}
              key={rank}
              data-testid={`podium-${rank}`}
            >
              <span className="podium-medal">
                {rank === 1 ? <Crown size={27} /> : rank}
              </span>
              <strong>{p?.name || "Chờ phân hạng"}</strong>
              <span className="podium-points">
                {p ? (
                  <>
                    {p.score} <small>điểm</small>
                  </>
                ) : (
                  "Đồng điểm"
                )}
              </span>
              <div className="podium-step">{rank}</div>
            </article>
          );
        })}
      </div>
      <div className="score-rows">
        {standings.map((p) => (
          <div
            key={p.id}
            className={p.id === myId ? "is-me" : ""}
            data-testid={`standing-${p.name}`}
          >
            <span>{p.tied ? `=${p.rank}` : p.rank}</span>
            <strong>{p.name}</strong>
            <b>
              {p.score} <small>điểm</small>
            </b>
          </div>
        ))}
      </div>
      {!standings.length && <p>Chưa có người chơi.</p>}
      {standings.length > 1 && (
        <p className="ranking-rule">
          Đồng điểm: nhóm tranh hạng chơi câu dự bị. BUZZ trước và trả lời đúng
          sẽ giành hạng.
        </p>
      )}
    </main>
  );
}
