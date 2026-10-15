import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { samples } from "../src/features/questions/samples";

test("admin pages keep sets discoverable, forms complete and controls readable at mobile/tablet/desktop widths", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  mkdirSync("artifacts", { recursive: true });
  expect(
    (
      await context.request.post("/api/admin/auth/", {
        data: { passcode: "earthplay" },
      })
    ).ok(),
  ).toBe(true);
  // Wait for the embedded database's first boot before measuring page layout.
  const ready = await context.request.post("/api/command/", {
    data: { command: "bank_list", args: {} },
    timeout: 30000,
  });
  expect(ready.ok()).toBe(true);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const routes = [
    "/admin/",
    "/admin/questions/",
    "/admin/sets/",
    "/admin/sets/new/",
    "/admin/sessions/new/",
    "/admin/questions/new/?game=puzzle",
  ];
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible({
        timeout: 20000,
      });
      await expect(
        page
          .locator(".admin-topbar")
          .getByRole("link", { name: "Bộ câu hỏi", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}: ${route}`,
      ).toBe(true);
      const clipped = await page
        .locator(".heading-actions .button, .admin-topbar nav a")
        .evaluateAll((elements) =>
          elements
            .filter((el) => el.scrollWidth > el.clientWidth + 1)
            .map((el) => el.textContent),
        );
      expect(clipped, `${width}: ${route}`).toEqual([]);
      if (route.includes("game=puzzle")) {
        await expect(
          page.getByRole("combobox", { name: "Game", exact: true }),
        ).toHaveValue("puzzle");
        await expect(page.getByLabel("Câu hỏi", { exact: true })).toBeVisible();
        await expect(page.locator(".hint-field")).toHaveCount(3);
        await expect(
          page.getByRole("combobox", { name: "Số mảnh", exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: `artifacts/editor-puzzle-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.goto("/admin/questions/");
  await page
    .locator(".page-heading")
    .getByRole("link", { name: "Bộ câu hỏi", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/sets\/$/);
  for (const path of ["questions", "sets"]) {
    await page.goto(`/admin/${path}/00000000-0000-4000-8000-000000000001/`);
    await expect(page.locator(".notice.error")).toContainText("Không tìm thấy");
    await expect(page.locator("main form")).toHaveCount(0);
  }
  const archived = {
    ...samples[0],
    id: crypto.randomUUID(),
    title: "Archived member of a set",
  };
  const setId = crypto.randomUUID();
  for (const [command, args] of [
    ["bank_save", { p_question: samples[1] }],
    ["bank_save", { p_question: archived }],
    [
      "set_save",
      {
        p_id: setId,
        p_title: "Audit set",
        p_question_ids: [archived.id, samples[1].id],
      },
    ],
    ["bank_archive", { p_id: archived.id }],
  ] as const)
    expect(
      (
        await context.request.post("/api/command/", { data: { command, args } })
      ).ok(),
    ).toBe(true);
  await page.goto(`/admin/sets/${setId}/`);
  await expect(page.locator(".notice.error")).toHaveCount(0);
  await expect(page.locator(".ordered-question")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Lưu bộ câu hỏi", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
