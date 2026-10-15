import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test.use({ baseURL: "http://127.0.0.1:3202" });
test("production first run lets the owner set a password, create a room, then log back in", async ({
  page,
  context,
}) => {
  mkdirSync("artifacts", { recursive: true });
  await page.goto("/admin/");
  await expect(page.getByLabel("Tạo mật mã", { exact: true })).toBeVisible();
  await expect(page.getByText(/ADMIN_PASSCODE/)).toHaveCount(0);
  await page
    .getByLabel("Tạo mật mã", { exact: true })
    .fill("workshop-test-2026");
  await page
    .getByLabel("Nhập lại mật mã", { exact: true })
    .fill("workshop-test-2026");
  await page
    .getByRole("button", { name: "Đặt mật mã và vào", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chuẩn bị chơi" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/admin-dashboard.png",
    fullPage: true,
  });
  expect(
    (
      await context.request.post("/api/admin/setup/", {
        data: {
          passcode: "another-password",
          confirmation: "another-password",
        },
      })
    ).status(),
  ).toBe(409);
  await page
    .getByRole("button", { name: "Tạo phòng chơi thử", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bắt đầu", exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText(/QR tham gia phòng/)).toBeVisible();
  await page.getByRole("button", { name: "Khóa quản trị" }).click();
  await expect(page.getByLabel("Mật mã", { exact: true })).toBeVisible();
  await page.getByLabel("Mật mã", { exact: true }).fill("workshop-test-2026");
  await page.getByRole("button", { name: "Vào quản trị", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chuẩn bị chơi" }),
  ).toBeVisible();
  await page.goto("/admin/questions/");
  await expect(page.locator(".question-row")).toHaveCount(10);
  await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Trang 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("combobox", { name: "Số câu mỗi trang" })
    .selectOption("50");
  await expect(page.locator(".question-row")).toHaveCount(12);
  await page
    .getByRole("navigation", { name: "Câu hỏi theo game" })
    .getByRole("link", { name: /Truy tìm tọa độ/ })
    .click();
  await page.getByRole("combobox", { name: "Lọc độ khó" }).selectOption("hard");
  await expect(page.locator(".question-row")).toHaveCount(1);
  await expect(page.locator(".question-row")).toContainText("năm 2018");
  await page.screenshot({
    path: "artifacts/library-difficulty.png",
    fullPage: true,
  });
});
