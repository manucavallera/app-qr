import { test, expect } from "./fixtures";
test("la carta QR muestra el acceso por nombre", async ({ page }) => { await page.goto("/m/demo"); await expect(page.getByRole("heading", { name: /cómo te llamamos/i })).toBeVisible(); });
