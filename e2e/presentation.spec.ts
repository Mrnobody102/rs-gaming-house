import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { samples } from "../src/features/questions/samples";
import type { GameView } from "../src/features/sessions/model";

test("the MC can control a large presentation while shared viewers stay read-only", async ({
  browser,
  page,
  context,
}) => {
  test.setTimeout(60000);
  mkdirSync("artifacts", { recursive: true });
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
  const questions = ["locate", "change"].map((kind) => ({
    ...samples.find((q) => q.kind === kind)!,
    id: crypto.randomUUID(),
  }));
  for (const q of questions) await api("bank_save", { p_question: q });
  const s = await api<{ id: string; code: string; view_token: string }>(
    "session_create",
    {
      title: "Presentation",
      questionIds: questions.map((q) => q.id),
      capacity: 60,
    },
  );
  const url = `/screen/${s.id}/?view=${s.view_token}`;
  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  const playerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const player = await playerContext.newPage();
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(url);
    await viewer.goto(url);
    await expect(
      page.getByRole("button", { name: "Bắt đầu", exact: true }),
    ).toBeVisible();
    await expect(viewer.locator(".host-controls")).toHaveCount(0);
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await expect(page.locator(".image-viewer")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "BUZZ", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Kinh độ dự đoán")).toHaveCount(0);
    for (const width of [1280, 1920]) {
      await page.setViewportSize({
        width,
        height: width === 1280 ? 800 : 1080,
      });
      const layout = await page.evaluate(() => {
        const image = document
          .querySelector(".image-viewer")!
          .getBoundingClientRect();
        const footer = document
          .querySelector(".host-controls")!
          .getBoundingClientRect();
        return {
          width: image.width,
          bottom: image.bottom,
          controlsTop: footer.top,
          controlsBottom: footer.bottom,
          height: innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(layout.width).toBeGreaterThan(Math.min(620, layout.height * 0.57));
      expect(layout.bottom).toBeLessThanOrEqual(layout.controlsTop);
      expect(layout.controlsBottom).toBeLessThanOrEqual(layout.height);
      expect(layout.overflow).toBe(false);
      await page.screenshot({
        path: `artifacts/presentation-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Ẩn điều khiển", exact: true })
      .click();
    await expect(page.locator(".host-controls")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Hiện điều khiển", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Mở BUZZ", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Toàn màn hình", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fullscreenElement?.classList.contains("game-screen"),
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Mở BUZZ", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Thoát toàn màn hình", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);

    const g = await api<GameView>("session_view", { p_id: s.id });
    const denied = await viewerContext.request.post("/api/command/", {
      data: {
        command: "session_control",
        args: { p_id: s.id, p_round_id: g.roundId, p_action: "reveal" },
      },
    });
    expect(denied.status()).toBe(403);
    await player.goto(`/?code=${s.code}`);
    await player.getByLabel("Tên của bạn").fill("Phone player");
    await player.getByRole("button", { name: "Vào chơi", exact: true }).click();
    await expect(
      player.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeVisible();
    const bell = await player
      .getByRole("button", { name: "BUZZ", exact: true })
      .boundingBox();
    expect(bell!.y + bell!.height).toBeLessThanOrEqual(844);
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await player.screenshot({
      path: "artifacts/large-image-player.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mở BUZZ", exact: true }).click();
    await expect(
      player.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page
      .getByRole("button", { name: "Câu tiếp theo", exact: true })
      .click();
    await expect(
      page.getByRole("slider", { name: "So sánh trước và sau" }),
    ).toBeVisible();
    await expect(
      viewer.getByRole("slider", { name: "So sánh trước và sau" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
    await page.getByRole("button", { name: "Bảng điểm", exact: true }).click();
    await page.getByRole("button", { name: "Kết thúc", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Tạo lượt chơi mới", exact: true }),
    ).toBeVisible();
  } finally {
    await viewerContext.close();
    await playerContext.close();
  }
});
