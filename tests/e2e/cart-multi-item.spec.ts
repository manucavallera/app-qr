import { collectBrowserErrors, test, expect } from "./fixtures";

test("el carrito conserva hamburguesa y gaseosa y avisa al agregar", async ({ page, qrToken }, testInfo) => {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `e2e-cart-${testInfo.project.name}-${Date.now()}` });
  const browserErrors = collectBrowserErrors(page);
  await page.goto(`/m/${encodeURIComponent(qrToken)}`);
  await page.getByLabel("Tu nombre o apodo").fill("Prueba carrito");
  await page.getByRole("button", { name: "Ver la carta" }).click();
  await expect(page.getByRole("heading", { name: "Elegí algo rico." })).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${testInfo.project.name}-1-menu.png`, fullPage: true });

  await page.getByRole("button", { name: /Agregar Hamburguesa clásica/ }).click();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Hamburguesa clásica agregado" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Ver pedido, 1 producto/ })).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${testInfo.project.name}-2-toast.png` });

  await page.getByRole("button", { name: /Agregar Gaseosa/ }).click();
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await expect(page.getByRole("button", { name: /^Ver pedido, 2 productos/ })).toBeVisible();

  await page.getByRole("button", { name: /^Ver pedido, 2 productos/ }).click();
  const dialog = page.getByRole("dialog", { name: /El pedido de/ });
  await expect(dialog.getByText("1 × Hamburguesa clásica")).toBeVisible();
  await expect(dialog.getByText("1 × Gaseosa")).toBeVisible();
  await page.screenshot({ path: `test-results/shots/${testInfo.project.name}-3-cart.png` });

  await page.reload();
  await page.getByRole("button", { name: /^Ver pedido, 2 productos/ }).click();
  await expect(page.getByRole("dialog", { name: /El pedido de/ }).getByText("1 × Gaseosa")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  expect(browserErrors).toEqual([]);
});
