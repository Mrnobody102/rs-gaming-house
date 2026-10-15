import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { workshopQuestions } from "../src/content/workshop";
import type { SessionPlan } from "../src/features/sessions/model";

test("removals respect their scope and deleting a live room returns players to entry", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90000);
  mkdirSync("artifacts", { recursive: true });
  await context.request.post("/api/admin/auth/", {
    data: { passcode: "earthplay" },
  });
  async function api<T>(command: string, args: object = {}) {
    const response = await context.request.post("/api/command/", {
      data: { command, args },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as T;
  }
  const [a, b, reserve] = workshopQuestions
    .slice(1, 4)
    .map((q, i) => ({
      ...q,
      id: crypto.randomUUID(),
      title: `Deletion test ${i + 1}`,
      hopeStar: false,
    }));
  for (const q of [a, b, reserve]) await api("bank_save", { p_question: q });
  const set = crypto.randomUUID();
  await api("set_save", {
    p_id: set,
    p_title: "Deletion scope",
    p_question_ids: [a.id, b.id],
    p_star_question_ids: [a.id],
    p_reserve_question_ids: [reserve.id],
  });
  const room = await api<{ id: string; code: string }>("session_create", {
    title: "Room to delete",
    capacity: 60,
    questionIds: [a.id, b.id],
    starQuestionIds: [a.id],
    reserveQuestionIds: [reserve.id],
    setId: set,
  });
  const other = await api<{ id: string }>("session_create", {
    title: "Room to keep",
    capacity: 60,
    questionIds: [a.id, b.id],
    setId: set,
  });
  await page.goto(`/admin/sets/${set}/`);
  await page.getByRole("button", { name: "Bỏ câu 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Lưu bộ câu hỏi", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/sets\/$/);
  expect(
    (await api<SessionPlan>("session_plan", { p_id: room.id })).questionIds,
  ).toHaveLength(2);
  await page.goto(`/admin/sessions/${room.id}/edit/`);
  await page.getByRole("button", { name: "Bỏ câu 1", exact: true }).click();
  await page
    .locator(".bank-choices button")
    .filter({ hasText: a.title })
    .click();
  await expect(
    page
      .locator(".ordered-question")
      .filter({ hasText: a.title })
      .getByRole("checkbox"),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Bỏ câu 1", exact: true }).click();
  await page.getByRole("button", { name: "Lưu phiên", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/sessions/${room.id}/$`));
  expect(
    (await api<SessionPlan>("session_plan", { p_id: room.id })).questionIds,
  ).toEqual([a.id]);
  expect(
    (await api<SessionPlan>("session_plan", { p_id: other.id })).questionIds,
  ).toEqual([a.id, b.id]);
  const sets = await api<{ id: string; questionIds: string[] }[]>("set_list");
  expect(sets.find((s) => s.id === set)?.questionIds).toEqual([b.id]);
  const playerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3201",
  });
  try {
    const player = await playerContext.newPage();
    await player.goto(`/?code=${room.code}`);
    await expect(
      player.getByRole("link", { name: "PIXEL HUNT — Trang chủ" }),
    ).toBeVisible();
    await expect(player).toHaveTitle("PIXEL//HUNT");
    await player.getByLabel("Tên của bạn").fill("Player");
    await player.getByRole("button", { name: "Vào chơi", exact: true }).click();
    await expect(player.getByText("Chờ MC bắt đầu…")).toBeVisible();
    const denied = await playerContext.request.post("/api/command/", {
      data: { command: "session_delete", args: { p_id: room.id } },
    });
    expect(denied.status()).toBe(403);
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(
      player.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Xóa phòng Room to delete", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Đóng BUZZ", exact: true }),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Xóa phòng Room to delete", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/sessions\/$/);
    await expect(player.locator(".notice.error")).toContainText(
      "Phòng không còn tồn tại",
    );
    await expect(
      player.getByRole("button", { name: "BUZZ", exact: true }),
    ).toHaveCount(0);
    await expect(
      player.getByRole("link", { name: "Về màn nhập mã" }),
    ).toBeVisible();
    const missing = await playerContext.request.post("/api/command/", {
      data: { command: "session_view", args: { p_id: room.id } },
    });
    expect(missing.status()).toBe(404);
    expect((await missing.json()).code).toBe("ROOM_NOT_FOUND");
    await expect(
      page.locator(".session-row").filter({ hasText: "Room to delete" }),
    ).toHaveCount(0);
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/rooms-${width}.png`,
        fullPage: true,
      });
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Xóa phòng Room to keep", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Xóa phòng Room to keep", exact: true }),
    ).toHaveCount(0);
  } finally {
    await playerContext.close();
  }
  // A bank deletion removes references from reusable sets, preserving remaining questions.
  await page.goto("/admin/questions/");
  await page.getByLabel("Tìm câu hỏi").fill(b.title);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Xóa câu hỏi ${b.title}`, exact: true })
    .click();
  await expect(page.locator(".question-row")).toHaveCount(0);
  await page.goto(`/admin/sets/${set}/`);
  await expect(page.locator(".ordered-question")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lưu bộ câu hỏi", exact: true }),
  ).toBeEnabled();
  await page.goto("/admin/sets/");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Xóa bộ câu hỏi Deletion scope", exact: true })
    .click();
  await expect(
    page.locator(".session-row").filter({ hasText: "Deletion scope" }),
  ).toHaveCount(0);
  const bank = await api<{ id: string }[]>("bank_list");
  expect(bank.some((q) => q.id === a.id)).toBe(true);
  expect(bank.some((q) => q.id === reserve.id)).toBe(true);
});
