import type { GameView } from "@/features/sessions/model";
export function acceptSnapshot(
  current: GameView | null,
  next: GameView,
): GameView {
  return current &&
    (current.revision > next.revision ||
      (current.revision === next.revision &&
        Date.parse(current.serverTime) > Date.parse(next.serverTime)))
    ? current
    : next;
}
