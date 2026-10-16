import { test, expect } from "@playwright/test";
import { workshopQuestions } from "../src/content/workshop";
import type { GameView } from "../src/features/sessions/model";

test("opened image hints replace the large image, can be compared and recover from a failed image request", async ({
  page,
  context,
  browser,
}) => {
  await context.request.post("/api/admin/auth/", {
    data: { passcode: "earthplay" },
  });
  const stadium = workshopQuestions.find((q) => q.tags.includes("Slide 5"))!;
  const response = await context.request.post("/api/command/", {
    data: {
      command: "session_create",
      args: {
        title: "Progressive images",
        questionIds: [stadium.id],
        capacity: 60,
        hintPenalty: 50,
      },
    },
  });
  expect(response.ok()).toBe(true);
  const room = await response.json();
  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  try {
    let failHint = true;
    await player.route("**/workshop/image-6.webp", (route) =>
      failHint ? route.abort() : route.continue(),
    );
    await player.goto(`/?code=${room.code}`);
    await player.getByLabel("Tên của bạn").fill("Observer");
    await player.getByRole("button", { name: "Vào chơi", exact: true }).click();
    await expect(player.getByText("Chờ MC bắt đầu…")).toBeVisible();
    await page.goto(`/admin/sessions/${room.id}/`);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    const image = page.locator(".image-viewer svg > image").last();
    await expect(image).toHaveAttribute("href", "/workshop/image-5.webp");
    await expect(
      page.getByRole("button", { name: "Gợi ý 1", exact: true }),
    ).toHaveCount(0);
    const publicView = await player.request.post("/api/command/", {
      data: {
        command: "session_view",
        args: { p_id: room.id, p_token: room.view_token },
      },
    });
    expect(((await publicView.json()) as GameView).question.hints).toEqual([]);
    expect(
      (await page.locator(".image-viewer").boundingBox())!.width,
    ).toBeGreaterThan(600);
    await page
      .getByRole("button", { name: "Mở gợi ý 1 (−50)", exact: true })
      .click();
    await expect(image).toHaveAttribute("href", "/workshop/image-6.webp");
    await expect(player.getByRole("status")).toContainText("Chưa tải được ảnh");
    failHint = false;
    await player.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(
      player.locator(".image-viewer svg > image").last(),
    ).toHaveAttribute("href", "/workshop/image-6.webp");
    await page.getByRole("button", { name: "Phóng to", exact: true }).click();
    await page
      .getByRole("button", { name: "Ảnh ban đầu", exact: true })
      .click();
    await expect(image).toHaveAttribute("href", "/workshop/image-5.webp");
    await expect(page.locator(".image-tools")).toContainText("1.5×");
    await page
      .getByRole("button", { name: "Mở gợi ý 2 (−50)", exact: true })
      .click();
    await expect(image).toHaveAttribute("href", "/workshop/image-7.webp");
    await expect(
      page.getByRole("button", { name: "Gợi ý 2", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".game-hints")).toHaveCount(0);
    await expect(page.locator(".question-chip")).toContainText("200 điểm");
    await page.getByRole("button", { name: "Gợi ý 1", exact: true }).click();
    await expect(image).toHaveAttribute("href", "/workshop/image-6.webp");
    await expect(page.locator(".question-chip")).toContainText("200 điểm");
    await page.screenshot({
      path: "artifacts/progressive-projector.png",
      fullPage: true,
    });
    await player.setViewportSize({ width: 390, height: 844 });
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      player.getByRole("button", { name: "BUZZ", exact: true }),
    ).toBeVisible();
  } finally {
    await playerContext.close();
  }
});
