import { test, expect } from "@playwright/test";

test.describe("Landing", () => {
  test("shows locale options", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "日本語で始める" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start in English" })).toBeVisible();
  });
});
