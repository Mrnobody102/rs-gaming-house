import { test, expect } from "@playwright/test";
import { newQuestion } from "../src/features/games/catalog";
import type { GameView } from "../src/features/sessions/model";

test("a lost BUZZ response after two seconds cannot replace the committed winner or duplicate points", async ({
  browser,
  context,
}) => {
  await context.request.post("/api/admin/auth/", {
    data: { passcode: "earthplay" },
  });
  async function api<T = GameView>(command: string, args: object) {
    const response = await context.request.post("/api/command/", {
      data: { command, args },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as T;
  }
  const q = {
    ...newQuestion("riddle"),
    title: "Delayed bell response",
    solution: "Answer",
    hints: [],
  };
  await api("bank_save", { p_question: q });
  const room = await api<{ id: string; code: string }>("session_create", {
    title: "Delayed response",
    questionIds: [q.id],
    capacity: 60,
  });
  const tokens = [crypto.randomUUID(), crypto.randomUUID()];
  for (const [i, token] of tokens.entries())
    await api("session_join", {
      p_code: room.code,
      p_name: `Player ${i + 1}`,
      p_token: token,
    });
  const playerContext = await browser.newContext();
  try {
    await playerContext.addInitScript(
      ({ id, token }) => {
        localStorage.setItem(`earthplay.player:${id}`, token);
      },
      { id: room.id, token: tokens[0] },
    );
    const player = await playerContext.newPage();
    await player.goto(`/play/${room.id}/`);
    let game = await api("session_view", { p_id: room.id });
    game = await api("session_control", {
      p_id: room.id,
      p_round_id: game.roundId,
      p_action: "start",
    });
    game = await api("buzz_control", {
      p_id: room.id,
      p_round_id: game.roundId,
      p_open: true,
    });
    const bell = player.getByRole("button", { name: "BUZZ", exact: true });
    await expect(bell).toBeEnabled();
    let received!: (game: GameView) => void;
    const committed = new Promise<GameView>((resolve) => {
      received = resolve;
    });
    let lostResponse = false;
    await player.route("**/api/command/", async (route) => {
      if (route.request().postDataJSON().command !== "buzz_submit")
        return route.continue();
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      received(await response.json());
      // The server commits normally; only the phone's response is delayed and lost.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.abort("failed");
      lostResponse = true;
    });
    await bell.dispatchEvent("pointerdown", { button: 0 });
    const accepted = await committed;
    expect(accepted.buzzWinner?.id).toBe(accepted.myId);
    for (const token of [tokens[1], tokens[0]]) {
      const later = await api("buzz_submit", {
        p_id: room.id,
        p_round_id: game.roundId,
        p_buzz_id: game.buzzId,
        p_token: token,
      });
      expect(later.buzzWinner?.id).toBe(accepted.myId);
      expect(later.buzzOpen).toBe(false);
    }
    await expect.poll(() => lostResponse).toBe(true);
    await expect(player.locator(".buzz-winner strong")).toHaveText("Player 1");
    const grade = {
      p_id: room.id,
      p_round_id: game.roundId,
      p_participant_id: accepted.myId,
      p_correct: true,
    };
    const scored = await api("buzz_grade", grade);
    const repeated = await api("buzz_grade", grade);
    expect(repeated.standings).toEqual(scored.standings);
    expect(scored.standings.filter((p) => p.score > 0)).toEqual([
      expect.objectContaining({ id: accepted.myId, score: 300 }),
    ]);
    await player.reload();
    await expect(player.locator(".feedback.correct")).toContainText("+300");
  } finally {
    await playerContext.close();
    await api("session_delete", { p_id: room.id });
  }
});

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
    let buzzRequests = 0;
    player.on("request", (request) => {
      if (
        request.url().includes("/api/command/") &&
        request.postDataJSON()?.command === "buzz_submit"
      )
        buzzRequests++;
    });
    await bell.dispatchEvent("pointerdown", { button: 0 });
    const beforeOpen = await api<GameView>("session_view", { p_id: room.id });
    expect(beforeOpen.buzzWinner).toBeNull();
    expect(buzzRequests).toBe(0);
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(bell).toBeEnabled({ timeout: 3000 });
    // Reproduce a tab kept open across the update: its first request lacks the window ID.
    let oldClient = true;
    await player.route("**/api/command/", async (route) => {
      const payload = route.request().postDataJSON();
      if (oldClient && payload.command === "buzz_submit") {
        oldClient = false;
        delete payload.args.p_buzz_id;
        await route.continue({ postData: JSON.stringify(payload) });
      } else await route.continue();
    });
    const outdatedResponse = player.waitForResponse(
      (r) => r.url().includes("/api/command/") && r.status() === 409,
    );
    await bell.click();
    expect((await (await outdatedResponse).json()).code).toBe(
      "BUZZ_CLIENT_OUTDATED",
    );
    await expect(player.locator(".notice.error")).toContainText(
      "Tải lại trang",
    );
    expect(
      (await api<GameView>("session_view", { p_id: room.id })).buzzWinner,
    ).toBeNull();
    await player
      .getByRole("button", { name: "Tải lại màn chơi", exact: true })
      .click();
    await expect(bell).toBeEnabled();
    expect(
      await player.evaluate(
        (id) => localStorage.getItem(`earthplay.player:${id}`),
        room.id,
      ),
    ).toBe(token);
    expect(
      (await api<GameView>("session_view", { p_id: room.id })).buzzWinner,
    ).toBeNull();
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
