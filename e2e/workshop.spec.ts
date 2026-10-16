import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { workshopSet } from "../src/content/workshop";

test("the prepared workshop presents without players and exports a working offline copy", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(90000);
  mkdirSync("artifacts", { recursive: true });
  await context.request.post("/api/admin/auth/", {
    data: { passcode: "earthplay" },
  });
  await page.goto("/admin/sets/");
  const row = page
    .locator(".session-row")
    .filter({ hasText: workshopSet.title });
  await expect(row).toContainText("12 câu");
  await row.getByRole("link", { name: "Trình chiếu", exact: true }).click();
  const download = page.getByRole("button", { name: "Tải bản dự phòng" });
  await expect(download).toBeEnabled({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "BUZZ", exact: true }),
  ).toHaveCount(0);
  for (const width of [1280, 1920, 390]) {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/workshop-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  const file = resolve("artifacts/workshop-offline.html");
  const downloaded = page.waitForEvent("download");
  await download.click();
  await (await downloaded).saveAs(file);
  await context.setOffline(true);
  await page.getByLabel("Chọn câu hỏi").selectOption("1");
  await page.getByRole("checkbox", { name: "Mỗi gợi ý −50 điểm" }).check();
  await page.getByRole("button", { name: "Mở gợi ý 1 (−50)" }).click();
  await expect(page.locator(".question-chip")).toHaveText("150 điểm");
  await expect
    .poll(async () => {
      const hint = await page.locator(".game-hints li").last().boundingBox();
      const stage = await page.locator(".question-stage").boundingBox();
      return hint!.y + hint!.height <= stage!.y + stage!.height + 1;
    })
    .toBe(true);
  expect(
    await page
      .locator(".game-hints")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(30);
  await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
  await expect(page.locator(".place-solution")).toContainText("Lý Sơn");
  await page.getByLabel("Chọn câu hỏi").selectOption("7");
  await expect(page.getByRole("heading")).toContainText("năm 2018");
  await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
  await expect(page.locator(".place-solution")).toHaveText("Ô 16.");
  await expect(page.locator(".answer-explanation")).toContainText("hiện tại");
  await page.getByLabel("Chọn câu hỏi").selectOption("4");
  const stageImage = page.locator(".image-viewer svg > image").last();
  const original = await stageImage.getAttribute("href");
  await page
    .getByRole("button", { name: "Mở gợi ý 1 (−50)", exact: true })
    .click();
  await expect(stageImage).not.toHaveAttribute("href", original!);
  await page.getByRole("button", { name: "Ảnh ban đầu", exact: true }).click();
  await expect(stageImage).toHaveAttribute("href", original!);
  await page
    .getByRole("button", { name: "Mở gợi ý 2 (−50)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Gợi ý 2", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".question-chip")).toHaveText("200 điểm");
  const offlineContext = await browser.newContext({ offline: true });
  try {
    const offline = await offlineContext.newPage();
    await offline.goto(pathToFileURL(file).href);
    await expect(offline.locator("h1")).toContainText("Cần Giờ");
    expect(
      await offline
        .locator("#image")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    ).toBe(true);
    await offline.locator("#select").selectOption("4");
    await expect(offline.locator("#image")).toHaveAttribute(
      "src",
      /data:image/,
    );
    const initialImage = await offline.locator("#image").getAttribute("src");
    await offline.locator("#penalty").check();
    await offline.locator("#hint").click();
    await expect(offline.locator("#image")).not.toHaveAttribute(
      "src",
      initialImage!,
    );
    await offline
      .getByRole("button", { name: "Ảnh ban đầu", exact: true })
      .click();
    await expect(offline.locator("#image")).toHaveAttribute(
      "src",
      initialImage!,
    );
    await offline.locator("#hint").click();
    await expect(
      offline.getByRole("button", { name: "Gợi ý 2", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(offline.locator("#points")).toHaveText("200 điểm");
    await offline.locator("#select").selectOption("7");
    await offline.locator("#reveal").click();
    await expect(offline.locator("#solution")).toHaveText("Ô 16.");
    await offline.locator("#select").selectOption("11");
    await offline.locator("#reveal").click();
    await expect(offline.locator("#solution")).toContainText(
      "Thành cổ Quảng Trị",
    );
  } finally {
    await offlineContext.close();
  }
  // Fall back from an already running room, keeping its current question/hints.
  await context.setOffline(false);
  async function api<T>(command: string, args: object) {
    const response = await context.request.post("/api/command/", {
      data: { command, args },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()) as T;
  }
  const room = await api<{ id: string }>("session_create", {
    title: "Fallback",
    questionIds: workshopSet.questionIds.slice(0, 2),
    capacity: 60,
    hintPenalty: 50,
  });
  let game = await api<{ roundId: string }>("session_view", { p_id: room.id });
  for (const p_action of ["start", "reveal", "next"])
    game = await api("session_control", {
      p_id: room.id,
      p_round_id: game.roundId,
      p_action,
    });
  await api("session_hint", { p_id: room.id, p_round_id: game.roundId });
  await page.goto(`/admin/sessions/${room.id}/`);
  await page
    .getByRole("link", { name: "Chỉ trình chiếu", exact: true })
    .click();
  await expect(page.getByLabel("Chọn câu hỏi")).toHaveValue("1");
  await expect(page.locator(".question-chip")).toHaveText("150 điểm");
  await expect(page.locator(".game-hints li")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Tải bản dự phòng" }),
  ).toBeEnabled();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Xem đáp án", exact: true }).click();
  await expect(page.locator(".place-solution")).toContainText("Lý Sơn");
});
