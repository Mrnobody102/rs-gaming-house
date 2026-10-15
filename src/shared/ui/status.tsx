"use client";
import { LoaderCircle } from "lucide-react";
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="notice error" role="alert">
      {message}
    </p>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>Đang tải…</span>
    </div>
  );
}
export const phaseLabels: Record<string, string> = {
  lobby: "Chờ bắt đầu",
  question: "Đang chơi",
  result: "Đáp án",
  leaderboard: "Bảng điểm",
  finished: "Đã kết thúc",
};
