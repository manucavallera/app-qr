import { test } from "./fixtures";
test("la comandera requiere sesión de staff", async ({ page }) => { await page.goto("/staff/commands"); });
