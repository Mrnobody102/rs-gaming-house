import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { mkdirSync } from "node:fs";
import { samples } from "../src/features/questions/samples";
import { shuffledTiles } from "../src/features/play/puzzle";
import type { GameView } from "../src/features/sessions/model";
import type { Question } from "../src/features/questions/model";
import QRCode from "qrcode";
test("spoken answer with three optional hints", async ({
  browser,
  page,
  context,
}) => {
  await auth(context);
  const title = `Direct answer ${Date.now()}`;
  await page.goto("/admin/questions/new/");
  await page.getByLabel("Câu hỏi", { exact: true }).fill(title);
  await page.getByLabel("Đáp án", { exact: true }).fill("Ảnh vệ tinh");
  await expect(page.locator(".hint-field")).toHaveCount(3);
  await page
    .getByRole("textbox", { name: "Nội dung gợi ý 1", exact: true })
    .fill("Quan sát từ trên cao");
  await page
    .getByRole("combobox", { name: "Loại gợi ý 2", exact: true })
    .selectOption("image");
  await page.getByLabel("Tải ảnh gợi ý 2", { exact: true }).setInputFiles({
    name: "hint.png",
    mimeType: "image/png",
    buffer: await QRCode.toBuffer("EARTH PLAY", { width: 300 }),
  });
  await expect(page.getByAltText("Ảnh gợi ý 2", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nội dung gợi ý 3", exact: true })
    .fill("Được chụp từ vệ tinh");
  await page.locator("details.editor-details > summary").last().click();
  await page
    .getByRole("checkbox", { name: /Cho phép ngôi sao hy vọng/ })
    .check();
  await page.getByRole("button", { name: "Lưu câu hỏi", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/questions\/\?game=riddle/, {
    timeout: 20000,
  });
  await expect(
    page.locator(".question-row").filter({ hasText: title }),
  ).toBeVisible();
  const bank = await api<{ id: string; title: string }[]>(
    context.request,
    "bank_list",
  );
  await page.goto(
    `/admin/questions/${bank.find((q) => q.title === title)!.id}/`,
  );
  await expect(
    page.getByRole("combobox", { name: "Loại gợi ý 2", exact: true }),
  ).toHaveValue("image");
  await expect(page.getByAltText("Ảnh gợi ý 2", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/hints-editor.png", fullPage: true });
  const s = await api<{ id: string; code: string }>(
    context.request,
    "session_create",
    {
      title: "Trả lời trực tiếp",
      capacity: 60,
      questionIds: [bank.find((q) => q.title === title)!.id],
    },
  );
  await page.goto(`/admin/sessions/${s.id}/`);
  const playerContext = await browser.newContext(),
    player = await playerContext.newPage();
  try {
    await join(player, s.code, "Speaker");
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await expect(
      player.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeDisabled();
    await expect(
      player.locator(".answer-grid,.puzzle-play,.game-timer"),
    ).toHaveCount(0);
    await player
      .getByRole("button", { name: "Ngôi sao hy vọng", exact: true })
      .click();
    await expect(
      player.getByRole("button", { name: "Ngôi sao hy vọng", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await player.reload();
    await expect(
      player.getByRole("button", { name: "Ngôi sao hy vọng", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await player.screenshot({
      path: "artifacts/hope-star-player.png",
      fullPage: true,
    });
    for (let i = 0; i < 3; i++) {
      const hint =
        i === 1
          ? player.getByAltText("Gợi ý 2", { exact: true })
          : player.getByText(
              i === 0 ? "Quan sát từ trên cao" : "Được chụp từ vệ tinh",
              { exact: true },
            );
      await expect(hint).toHaveCount(0);
      await page
        .getByRole("button", { name: `Mở gợi ý ${i + 1}`, exact: true })
        .click();
      await expect(hint).toBeVisible();
    }
    await player.setViewportSize({ width: 390, height: 844 });
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await player.screenshot({
      path: "artifacts/hints-player-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(
      player.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await player.getByRole("button", { name: "BUZZ", exact: true }).click();
    await page
      .getByRole("button", { name: "Đúng · +600", exact: true })
      .click();
    await expect(player.getByText("+600 điểm", { exact: true })).toBeVisible();
    await expect(player.locator(".place-solution")).toHaveText("Ảnh vệ tinh");
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await expect(player.locator(".podium-place")).toHaveCount(1);
    await expect(player.getByTestId("podium-1")).toContainText("Speaker");
    await page.getByRole("button", { name: "Kết thúc", exact: true }).click();
    await expect(
      player.getByText("1 người dẫn đầu", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/ranking-top-three.png",
      fullPage: true,
    });
  } finally {
    await playerContext.close();
  }
});
test("prepares ten questions as a set, authors into it, then edits the room before play", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await auth(context);
  const title = `Tomorrow ${Date.now()}`;
  await page.goto("/admin/sets/new/");
  await page.getByLabel("Tên bộ câu hỏi").fill(title);
  await page
    .getByRole("button", { name: "Tạo bộ và soạn câu", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/sets\/[a-f0-9-]{36}\//);
  await expect(
    page.getByRole("heading", { name: "Sửa bộ câu hỏi", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".bank-choices > button").first()).toBeVisible();
  for (let i = 0; i < 9; i++)
    await page.locator(".bank-choices > button").nth(i).click();
  await page.locator(".ordered-question").first().getByRole("checkbox").check();
  await page.getByRole("button", { name: "Soạn câu mới", exact: true }).click();
  await page.getByLabel("Câu hỏi", { exact: true }).fill(`New for ${title}`);
  await page.getByLabel("Đáp án", { exact: true }).fill("Prepared answer");
  await page.getByRole("button", { name: "Lưu câu hỏi", exact: true }).click();
  await expect(page.locator(".ordered-question")).toHaveCount(10);
  await expect(
    page.locator(".ordered-question").first().getByRole("checkbox"),
  ).toBeChecked();
  await page.locator(".reserve-fields > summary").click();
  await page.locator(".reserve-choices").getByRole("checkbox").first().check();
  await page.screenshot({ path: "artifacts/prepared-set.png", fullPage: true });
  await page
    .getByRole("button", { name: "Lưu bộ câu hỏi", exact: true })
    .click();
  await page
    .locator(".session-row")
    .filter({ hasText: title })
    .getByRole("link", { name: "Tạo phòng", exact: true })
    .click();
  await expect(page.getByLabel("Tên phòng", { exact: true })).toHaveValue(
    title,
  );
  await expect(page.locator(".ordered-question")).toHaveCount(10);
  await page.getByRole("button", { name: "Tạo phòng", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Chỉnh sửa phiên", exact: true }),
  ).toBeVisible();
  const saved = (await api<Question[]>(context.request, "bank_list")).find(
    (q) => q.title === `New for ${title}`,
  )!;
  await api(context.request, "bank_save", {
    p_question: { ...saved, title: "Changed after creating the room" },
  });
  await api(context.request, "bank_archive", { p_id: saved.id });
  await page
    .getByRole("link", { name: "Chỉnh sửa phiên", exact: true })
    .click();
  await expect(
    page.locator(".ordered-question").filter({ hasText: `New for ${title}` }),
  ).toBeVisible();
  await expect(page.locator(".notice.error")).toHaveCount(0);
  await page.getByLabel("Tên phòng", { exact: true }).fill(`${title} revised`);
  for (const box of await page
    .locator(".ordered-question")
    .getByRole("checkbox")
    .all())
    await box.uncheck();
  await page
    .getByRole("button", { name: "Đưa câu 10 lên", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/session-plan-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lưu phiên", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `${title} revised`, exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1)!;
  const plan = await api<{
    questionIds: string[];
    starQuestionIds: string[];
    reserveQuestionIds: string[];
  }>(context.request, "session_plan", { p_id: id });
  expect(plan.questionIds).toHaveLength(10);
  expect(plan.starQuestionIds).toEqual([]);
  expect(plan.reserveQuestionIds).toHaveLength(1);
  const sets = await api<{ title: string; starQuestionIds: string[] }[]>(
    context.request,
    "set_list",
  );
  expect(
    sets.find((s) => s.title === title)?.starQuestionIds.length,
  ).toBeGreaterThan(0);
});
test.beforeEach(() => mkdirSync("artifacts", { recursive: true }));
test("tied finalists use reserve BUZZ questions to settle the prize podium", async ({
  browser,
  page,
  context,
  request,
}) => {
  test.setTimeout(90000);
  await auth(context);
  const main = {
    ...samples[0],
    id: crypto.randomUUID(),
    title: "Final ranking question",
  };
  const reserves = [1, 2].map((i) => ({
    ...samples.find((q) => q.kind === "place")!,
    id: crypto.randomUUID(),
    title: `Reserve question ${i}`,
  }));
  for (const q of [main, ...reserves])
    await api(context.request, "bank_save", { p_question: q });
  const s = await api<{ id: string; code: string }>(
    context.request,
    "session_create",
    {
      title: "Prize playoff",
      questionIds: [main.id],
      reserveQuestionIds: reserves.map((q) => q.id),
      capacity: 60,
      starQuestionIds: [],
    },
  );
  const bContext = await browser.newContext(),
    cContext = await browser.newContext();
  const b = await bContext.newPage(),
    c = await cContext.newPage();
  const aToken = crypto.randomUUID(),
    outsideToken = crypto.randomUUID();
  try {
    await api(request, "session_join", {
      p_code: s.code,
      p_name: "A",
      p_token: aToken,
    });
    await api(request, "session_join", {
      p_code: s.code,
      p_name: "Outside",
      p_token: outsideToken,
    });
    await join(b, s.code, "B");
    await join(c, s.code, "C");
    await page.goto(`/admin/sessions/${s.id}/`);
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await b.locator(".answer-grid > button").first().click();
    await c.locator(".answer-grid > button").first().click();
    let g = await api(context.request, "session_view", { p_id: s.id });
    await api(request, "answer_submit", {
      p_id: s.id,
      p_round_id: g.roundId,
      p_token: aToken,
      p_payload: { choice: 0 },
    });
    await expect(
      page.getByText("3 / 4 đã trả lời", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await expect(page.getByText("Top 3 nhận quà", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Chơi câu dự bị", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "artifacts/tiebreak-pending.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Chơi câu dự bị", exact: true })
      .click();
    await expect(
      page.getByText("Reserve question 1", { exact: true }),
    ).toBeVisible();
    g = await api(context.request, "session_view", { p_id: s.id });
    expect(
      (
        await request.post("/api/command/", {
          data: {
            command: "buzz_submit",
            args: { p_id: s.id, p_round_id: g.roundId, p_token: outsideToken },
          },
        })
      ).status(),
    ).toBe(403);
    await expect(
      b.getByRole("button", { name: "Ngôi sao hy vọng", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(
      b.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await expect(
      c.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await Promise.all([
      b.getByRole("button", { name: "BUZZ", exact: true }).click(),
      c.getByRole("button", { name: "BUZZ", exact: true }).click(),
    ]);
    await expect(page.locator(".buzz-winner strong")).toBeVisible();
    const winner = await page.locator(".buzz-winner strong").innerText();
    const loser = winner === "B" ? c : b,
      loserName = winner === "B" ? "C" : "B";
    await page
      .getByRole("button", { name: "Đúng · giành hạng", exact: true })
      .click();
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await expect(page.getByTestId("podium-1")).toContainText(winner);
    await page
      .getByRole("button", { name: "Chơi câu dự bị", exact: true })
      .click();
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(
      loser.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await loser.getByRole("button", { name: "BUZZ", exact: true }).click();
    await page
      .getByRole("button", { name: "Đúng · giành hạng", exact: true })
      .click();
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page.getByRole("button", { name: "Kết thúc", exact: true }).click();
    await expect(
      page.getByText("Top 3 nhận quà", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("podium-2")).toContainText(loserName);
    await expect(page.getByTestId("podium-3")).toContainText("A");
    g = await api(context.request, "session_view", { p_id: s.id });
    expect(g.standings.map((p) => p.score)).toEqual([200, 200, 200, 0]);
    await page.screenshot({
      path: "artifacts/tiebreak-ranking.png",
      fullPage: true,
    });
    await expect(
      b.getByRole("heading", { name: "Kết quả", exact: true }),
    ).toBeVisible();
    await b.setViewportSize({ width: 390, height: 844 });
    expect(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await b.screenshot({
      path: "artifacts/tiebreak-ranking-mobile.png",
      fullPage: true,
    });
  } finally {
    await bContext.close();
    await cContext.close();
  }
});
test("60 concurrent players read state and compete for a single BUZZ winner through HTTP", async ({
  context,
  request,
}) => {
  await auth(context);
  const s = await room(context.request, ["place"]);
  const tokens = Array.from({ length: 60 }, () => crypto.randomUUID());
  await Promise.all(
    tokens.map((p_token, i) =>
      api(request, "session_join", {
        p_code: s.code,
        p_name: `Load ${i + 1}`,
        p_token,
      }),
    ),
  );
  let g = await api(context.request, "session_view", { p_id: s.id });
  expect(g.count).toBe(60);
  const readStart = performance.now();
  await Promise.all(
    tokens.map((p_token) =>
      api(request, "session_view", { p_id: s.id, p_token }),
    ),
  );
  const readMs = Math.round(performance.now() - readStart);
  g = await api(context.request, "session_control", {
    p_id: s.id,
    p_round_id: g.roundId,
    p_action: "start",
  });
  await api(context.request, "buzz_control", {
    p_id: s.id,
    p_round_id: g.roundId,
    p_open: true,
  });
  const buzzStart = performance.now();
  const results = await Promise.all(
    tokens.map((p_token) =>
      api(request, "buzz_submit", {
        p_id: s.id,
        p_round_id: g.roundId,
        p_token,
      }),
    ),
  );
  expect(new Set(results.map((r) => r.buzzWinner?.id)).size).toBe(1);
  expect(results[0].buzzWinner).toBeTruthy();
  const buzzMs = Math.round(performance.now() - buzzStart);
  g = await api(context.request, "buzz_grade", {
    p_id: s.id,
    p_round_id: g.roundId,
    p_participant_id: results[0].buzzWinner!.id,
    p_correct: true,
  });
  expect(g.standings.filter((p) => p.score > 0)).toHaveLength(1);
  console.log(
    `[local HTTP load] 60 players; read burst ${readMs} ms; BUZZ burst ${buzzMs} ms; 1 winner; 0 request failures`,
  );
});
async function api<T = GameView>(
  request: APIRequestContext,
  command: string,
  args: object = {},
) {
  const r = await request.post("/api/command/", { data: { command, args } });
  const body = await r.json();
  expect(r.ok(), JSON.stringify(body)).toBe(true);
  return body as T;
}
async function auth(context: BrowserContext) {
  expect(
    (
      await context.request.post("/api/admin/auth/", {
        data: { passcode: "earthplay" },
      })
    ).ok(),
  ).toBe(true);
}
async function room(request: APIRequestContext, kinds: string[]) {
  return api<{ id: string; code: string; view_token: string }>(
    request,
    "session_create",
    {
      title: `Workshop ${Date.now()}`,
      capacity: 60,
      questionIds: kinds.map(
        (kind) => samples.find((q) => q.kind === kind)!.id,
      ),
    },
  );
}
async function join(page: Page, code: string, name: string) {
  await page.goto(`/?code=${code}`);
  await expect(page.getByLabel("Mã phòng")).toHaveValue(code);
  await page.getByLabel("Tên của bạn").fill(name);
  await page.getByRole("button", { name: "Vào chơi", exact: true }).click();
  await expect(page.getByText("Chờ MC bắt đầu…")).toBeVisible();
}

test("entry is concise, supports QR deep links and has no text decoration or mobile overflow", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vào game" })).toBeVisible();
  await expect(page.locator("input")).toHaveCount(2);
  expect(
    await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).textDecorationLine),
  ).toBe("none");
  await page.screenshot({ path: "artifacts/join-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/join-mobile.png", fullPage: true });
  for (const command of ["bank_list", "set_list", "session_list"]) {
    expect(
      (
        await request.post("/api/command/", { data: { command, args: {} } })
      ).status(),
    ).toBe(403);
  }
  expect((await request.post("/api/upload/")).status()).toBe(403);
});

test("admin unlocks with a passcode, then can author the three Earth game formats", async ({
  page,
  context,
}) => {
  await page.goto("/admin/");
  await expect(page.getByLabel("Mật mã", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await page.getByLabel("Mật mã", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Vào quản trị" }).click();
  await expect(page.locator(".notice.error")).toContainText("Mật mã chưa đúng");
  await page.getByLabel("Mật mã", { exact: true }).fill("earthplay");
  await page.getByRole("button", { name: "Vào quản trị" }).click();
  await expect(
    page.getByRole("heading", { name: "Chuẩn bị chơi" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo phòng chơi thử", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await page.goto("/admin/questions/");
  await expect(page.getByRole("link", { name: "Soạn câu hỏi" })).toBeVisible();
  for (const kind of [
    "Đoán địa danh",
    "Truy tìm tọa độ",
    "Giải mã biến động",
  ]) {
    await expect(
      page
        .getByRole("navigation", { name: "Câu hỏi theo game" })
        .getByRole("link", { name: new RegExp(kind) }),
    ).toHaveCount(1);
  }
  for (const label of await page.locator(".eyebrow").all())
    expect(
      await label.evaluate((el) => getComputedStyle(el).textDecorationLine),
    ).toBe("none");
  await page.screenshot({ path: "artifacts/admin-bank.png", fullPage: true });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfFoAAAAASUVORK5CYII=",
    "base64",
  );
  for (const kind of ["place", "locate", "change"]) {
    await page.goto(`/admin/questions/?game=${kind}`);
    await page.getByRole("link", { name: "Soạn câu hỏi" }).click();
    await expect(
      page.getByRole("combobox", { name: "Game", exact: true }),
    ).toHaveValue(kind);
    const title = `Authored ${kind} ${Date.now()}`;
    await page.getByLabel("Câu hỏi", { exact: true }).fill(title);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "source.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByAltText("Ảnh câu hỏi")).toBeVisible();
    await page
      .getByLabel("Đáp án", { exact: true })
      .fill("Đáp án do tác giả soạn");
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    if (kind === "locate") {
      await page.screenshot({
        path: "artifacts/question-editor-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "artifacts/question-editor-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    await page
      .getByRole("button", { name: "Lưu câu hỏi", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/questions/\\?game=${kind}`),
    );
    await expect(
      page.locator(".question-row").filter({ hasText: title }),
    ).toBeVisible();
    const bank = await api<{ title: string; kind: string }[]>(
      context.request,
      "bank_list",
    );
    expect(bank.find((q) => q.title === title)?.kind).toBe(kind);
  }
  await page.goto("/admin/sessions/new/");
  await page
    .getByLabel("Tên phòng", { exact: true })
    .fill("Phiên tạo bằng form");
  for (const kind of ["place", "locate", "change"]) {
    const title = samples.find((q) => q.kind === kind)!.title;
    await page
      .locator(".bank-choices button")
      .filter({ hasText: title })
      .click();
  }
  await page.getByRole("button", { name: "Tạo phòng", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bắt đầu", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/questions/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/admin-mobile.png", fullPage: true });
});

test("room QR, individual BUZZ, coordinates, change slider, quiz and puzzle work across independent browsers", async ({
  browser,
  page,
  context,
}) => {
  test.setTimeout(120000);
  await auth(context);
  const s = await room(context.request, [
    "place",
    "locate",
    "change",
    "choice",
    "puzzle",
  ]);
  await page.goto(`/admin/sessions/${s.id}/`);
  await expect(
    page.getByRole("heading", { name: s.code, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Địa chỉ tham gia").fill("http://127.0.0.1:3201");
  const qr = page.getByAltText(`QR tham gia phòng ${s.code}`);
  const qrSrc = await qr.getAttribute("src");
  expect(qrSrc).toContain(encodeURIComponent(`/?code=${s.code}`));
  const qrResponse = await context.request.get(qrSrc!);
  expect(qrResponse.ok()).toBe(true);
  expect(qrResponse.headers()["content-type"]).toContain("image/svg+xml");
  const aContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    bContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    displayContext = await browser.newContext();
  const a = await aContext.newPage(),
    b = await bContext.newPage(),
    display = await displayContext.newPage();
  try {
    await join(a, s.code, "Linh");
    await join(b, s.code, "Nam");
    await display.goto(`/screen/${s.id}/?view=${s.view_token}`);
    await expect(page.getByText("2 người chơi", { exact: true })).toBeVisible();
    await expect(display.getByText("Linh", { exact: true })).toBeVisible();
    await expect(display.locator(".host-controls")).toHaveCount(0);
    await page.screenshot({ path: "artifacts/room-qr.png", fullPage: true });
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Mở gợi ý 1" }).click();
    await expect(
      a.getByText("Quan sát nơi lòng sông mở rộng.", { exact: true }),
    ).toBeVisible();
    await display.screenshot({
      path: "artifacts/place-screen.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await expect(
      b.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await Promise.all([
      a.getByRole("button", { name: "BUZZ", exact: true }).click(),
      b.getByRole("button", { name: "BUZZ", exact: true }).click(),
    ]);
    await expect(page.locator(".buzz-winner strong")).toBeVisible();
    const winner = await page.locator(".buzz-winner strong").innerText();
    await page
      .getByRole("button", { name: "Đúng · +200", exact: true })
      .click();
    await expect(display.locator(".place-solution")).toBeVisible();
    let g = await api(context.request, "session_view", { p_id: s.id });
    expect(
      g.standings.filter((p) => p.score === 200).map((p) => p.name),
    ).toEqual([winner]);
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page
      .getByRole("button", { name: "Câu tiếp theo", exact: true })
      .click();
    await page.getByLabel("Kinh độ dự đoán").fill("105.8041666667");
    await page.getByLabel("Vĩ độ dự đoán").fill("21.0058333333");
    await page.getByRole("button", { name: "Đặt vị trí", exact: true }).click();
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await a.getByRole("button", { name: "BUZZ", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Đúng · +300", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Đúng · +300", exact: true })
      .click();
    await expect(page.getByText(/Sai số 0 m/)).toBeVisible();
    await expect(display.getByText(/Sai số 0 m/)).toBeVisible();
    expect(
      await display
        .getByRole("button", { name: "Xem quá khứ", exact: true })
        .evaluate((el) => getComputedStyle(el).color),
    ).toBe("rgb(33, 50, 31)");
    await display.screenshot({
      path: "artifacts/location-reveal.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page
      .getByRole("button", { name: "Câu tiếp theo", exact: true })
      .click();
    await expect(
      display.getByRole("slider", { name: "So sánh trước và sau" }),
    ).toBeVisible();
    await page
      .getByRole("slider", { name: "So sánh trước và sau" })
      .press("Home");
    await expect(
      page.getByRole("slider", { name: "So sánh trước và sau" }),
    ).toHaveValue("0");
    await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
    await expect(display.locator(".change-findings li")).toContainText(
      "Cụm công trình mới xuất hiện trên ô đất màu vàng.",
    );
    await display.screenshot({
      path: "artifacts/change-reveal.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page
      .getByRole("button", { name: "Câu tiếp theo", exact: true })
      .click();
    await expect(a.locator(".answer-grid > button")).toHaveCount(4);
    await a.locator(".answer-grid > button").nth(0).click();
    await expect(
      a.getByText("Đã gửi. Chờ đáp án…", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("1 / 2 đã trả lời", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
    await expect(a.getByText("+200 điểm", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page
      .getByRole("button", { name: "Câu tiếp theo", exact: true })
      .click();
    await expect(
      a.getByRole("button", { name: "Gửi đáp án", exact: true }),
    ).toBeVisible();
    g = await api(context.request, "session_view", { p_id: s.id });
    const tiles = shuffledTiles(g.roundId, 2);
    for (let i = 0; i < tiles.length; i++) {
      const j = tiles.indexOf(i);
      if (j !== i) {
        await a
          .getByRole("button", { name: `Mảnh ${i + 1}`, exact: true })
          .click();
        await a
          .getByRole("button", { name: `Mảnh ${j + 1}`, exact: true })
          .click();
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
    }
    await a.screenshot({ path: "artifacts/puzzle-mobile.png", fullPage: true });
    await a.getByRole("button", { name: "Gửi đáp án", exact: true }).click();
    await expect(
      page.getByText("1 / 2 đã trả lời", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
    await expect(a.getByText("+200 điểm", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page.getByRole("button", { name: "Kết thúc", exact: true }).click();
    await expect(
      display.getByRole("heading", { name: "Kết quả", exact: true }),
    ).toBeVisible();
    g = await api(context.request, "session_view", { p_id: s.id });
    expect(g.standings.find((p) => p.name === "Linh")?.score).toBe(
      700 + (winner === "Linh" ? 200 : 0),
    );
    await a.reload();
    await expect(
      a.getByRole("heading", { name: "Kết quả", exact: true }),
    ).toBeVisible();
    await display.screenshot({
      path: "artifacts/final-scores.png",
      fullPage: true,
    });
  } finally {
    await Promise.all([
      aContext.close(),
      bContext.close(),
      displayContext.close(),
    ]);
  }
});

test("a player reconnects without losing their identity or submitted answer", async ({
  browser,
  context,
}) => {
  await auth(context);
  const s = await room(context.request, ["choice"]);
  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  try {
    await join(player, s.code, "Reconnect");
    let g = await api(context.request, "session_view", { p_id: s.id });
    g = await api(context.request, "session_control", {
      p_id: s.id,
      p_round_id: g.roundId,
      p_action: "start",
    });
    await expect(player.locator(".answer-grid > button").first()).toBeEnabled();
    await playerContext.setOffline(true);
    await expect(player.locator(".notice.error")).toContainText("Mất kết nối");
    await playerContext.setOffline(false);
    await expect(player.locator(".notice.error")).toHaveCount(0);
    await player.locator(".answer-grid > button").first().click();
    await expect(
      player.getByText("Đã gửi. Chờ đáp án…", { exact: false }),
    ).toBeVisible();
    await player.reload();
    await expect(
      player.getByText("Đã gửi. Chờ đáp án…", { exact: false }),
    ).toBeVisible();
    await api(context.request, "session_control", {
      p_id: s.id,
      p_round_id: g.roundId,
      p_action: "reveal",
    });
    await expect(player.getByText("+200 điểm", { exact: true })).toBeVisible();
  } finally {
    await playerContext.close();
  }
});
test("QR image scanner fills the room code and works without randomUUID", async ({
  page,
  context,
}) => {
  await auth(context);
  const s = await room(context.request, ["choice"]);
  await page.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/");
  for (let maskPattern = 0; maskPattern < 8; maskPattern++) {
    await page.getByRole("button", { name: "Quét QR", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Ảnh mã QR", { exact: true }).setInputFiles({
      name: "room.png",
      mimeType: "image/png",
      buffer: await QRCode.toBuffer(`http://192.168.1.8:3100/?code=${s.code}`, {
        width: 400,
        maskPattern: maskPattern as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
      }),
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Mã phòng", { exact: true })).toHaveValue(
      s.code,
    );
  }
  await page.getByLabel("Tên của bạn").fill("QR player");
  await page.getByRole("button", { name: "Vào chơi", exact: true }).click();
  await expect(page.getByText("Chờ MC bắt đầu…")).toBeVisible();
});
