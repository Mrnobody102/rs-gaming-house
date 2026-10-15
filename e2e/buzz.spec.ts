import { test, expect } from "@playwright/test";
import { newQuestion } from "../src/features/games/catalog";
import type { GameView } from "../src/features/sessions/model";

test("quiz defaults to a server-timed bell with live notifications and pointer-down capture", async ({
  browser,
  page,
  context,
}) => {
  test.setTimeout(60000);
  await context.request.post("/api/admin/auth/", {
    data: { passcode: "earthplay" },
  });
  async function api<T>(command: string, args: object) {
    const response = await context.request.post("/api/command/", {
      data: { command, args },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as T;
  }
  const q = {
    ...newQuestion("choice"),
    title: "Quiz with a bell",
    options: ["Yes", "No"],
    correct: 0,
  };
  await api("bank_save", { p_question: q });
  const room = await api<{ id: string; code: string }>("session_create", {
    title: "Bell test",
    questionIds: [q.id],
    capacity: 60,
  });
  const playerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const player = await playerContext.newPage();
  const abort = new AbortController();
  try {
    await player.goto(`/?code=${room.code}`);
    await player.getByLabel("Tên của bạn").fill("Bell player");
    const streamReady = player.waitForResponse(
      (r) => r.url().includes("/api/events/") && r.status() === 200,
    );
    await player.getByRole("button", { name: "Vào chơi", exact: true }).click();
    expect((await streamReady).headers()["content-type"]).toContain(
      "text/event-stream",
    );
    const token = await player.evaluate(
      (id) => localStorage.getItem(`earthplay.player:${id}`)!,
      room.id,
    );
    // Check the actual server push channel, independently of fallback polling.
    const stream = await fetch(
      `http://127.0.0.1:3201/api/events/?${new URLSearchParams({ id: room.id, token })}`,
      { signal: abort.signal },
    );
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "ready",
    );
    await page.goto(`/admin/sessions/${room.id}/`);
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    const pushed = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("No live game event")), 3000),
      ),
    ]);
    expect(new TextDecoder().decode(pushed.value)).toContain("event: change");
    await reader.cancel();
    await expect(
      player.locator(".answer-grid > button").first(),
    ).toBeDisabled();
    await expect(player.getByRole("timer")).toHaveCount(0);
    const bell = player.getByRole("button", { name: "BUZZ", exact: true });
    await expect(bell).toBeDisabled();
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(bell).toBeEnabled({ timeout: 3000 });
    const rect = await bell.boundingBox();
    await player.mouse.move(
      rect!.x + rect!.width / 2,
      rect!.y + rect!.height / 2,
    );
    await player.mouse.down();
    // Server accepts the press before pointer-up/click is dispatched.
    await expect(page.locator(".buzz-winner strong")).toHaveText(
      "Bell player",
      { timeout: 3000 },
    );
    await player.mouse.up();
    await expect(page.locator(".buzz-time")).toHaveText(/\d+\.\d{3} s/);
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const state = await api<GameView>("session_view", { p_id: room.id });
    expect(state.buzzWinner?.elapsedMs).toBeGreaterThanOrEqual(0);
    await page.getByRole("button", { name: /^Đúng · \+/ }).click();
    await expect(player.locator(".feedback.correct")).toContainText("+300");
  } finally {
    abort.abort();
    await playerContext.close();
  }
});
