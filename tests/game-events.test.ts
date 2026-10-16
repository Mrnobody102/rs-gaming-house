import { expect, it, vi } from "vitest";
import { publishGameChange, subscribeGame } from "../src/server/game-events";

it("deleting a room notifies its listeners and releases the channel without affecting another room", () => {
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  const first = vi.fn(),
    second = vi.fn();
  const leaveA = subscribeGame(a, first),
    leaveB = subscribeGame(b, second);
  publishGameChange(a, 9, true);
  expect(first).toHaveBeenCalledWith(9, true);
  expect(second).not.toHaveBeenCalled();
  const fresh = vi.fn(),
    leaveFresh = subscribeGame(a, fresh);
  leaveA();
  publishGameChange(a, 1);
  expect(fresh).toHaveBeenCalledWith(1, false);
  expect(first).toHaveBeenCalledTimes(1);
  publishGameChange(b, 2);
  expect(second).toHaveBeenCalledWith(2, false);
  leaveFresh();
  leaveB();
});
