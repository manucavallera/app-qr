import { expect, test } from "./fixtures";

test("la comandera requiere sesión de staff", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "La protección de acceso se ejecuta una vez en escritorio.");
  await page.goto("/staff/commands");
  await expect(page).toHaveURL(/\/staff\/login/);
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
});
